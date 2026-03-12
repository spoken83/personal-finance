import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import * as schema from "../lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const EXCEL_PATH =
  "/Users/froisagent/Library/CloudStorage/GoogleDrive-froisagent@gmail.com/My Drive/Finanace/Finance_Tracker(shared).xlsx";

// Normalize source names from Excel to match seeded bank accounts
function normalizeBankAccount(
  source: string,
  account: string
): { source: string; accountName: string } | null {
  const s = source?.trim();
  const a = account?.trim();

  if (!s) return null;

  if (s === "CITIBANK" || s === "Citibank" || s === "Citi") {
    if (a?.includes("PremierMiles") || a?.includes("Prem")) {
      return { source: "Citibank", accountName: "Citi PremierMiles" };
    }
    if (a?.includes("Rewards") || !a) {
      return { source: "Citibank", accountName: "Citi Rewards" };
    }
  }
  if (s === "CITIBANK-MILES") {
    return { source: "Citibank", accountName: "Citi PremierMiles" };
  }
  if (s === "OCBC") {
    if (a?.includes("Statement") || a?.includes("Sav")) {
      return { source: "OCBC", accountName: "OCBC Statement Savings" };
    }
    return { source: "OCBC", accountName: "OCBC 360 Account" };
  }
  if (s === "TRUST Bank" || s === "Trust Card") {
    return { source: "Trust Bank", accountName: "Trust Card" };
  }
  if (s === "DBS") {
    return { source: "DBS", accountName: "DBS Account" };
  }

  console.warn(`Unknown source: "${s}" / account: "${a}"`);
  return null;
}

// Normalize category names that differ between Excel and seed data
function normalizeCategory(name: string): string {
  if (!name) return "";
  const n = name.trim();
  const map: Record<string, string> = {
    "Repayment-Exclude": "Repayment(exclude)",
    "Internal Trf (exclude)": "Internal Trf(exclude)",
    "Final loan Payment (exclude)": "Final loan Payment(exclude)",
    "Food & Beverage": "Food & Dining",
    "Home Services": "Urban Company Cleaning",
    "Bank Fees": "Fees & Charges",
    "Donation": "Charity & Donations",
    "Government": "Others",
    "Cash": "Cash Withdrawal",
    "Bills & Utilities": "Utilities",
    "Health & Wellness": "Healthcare",
    "Travel": "Others",
    "Fees": "Fees & Charges",
  };
  return map[n] || n;
}

async function main() {
  console.log("Reading Excel file...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets["Data "];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  console.log(`Found ${rows.length} rows in Data sheet`);

  // Load lookup maps from DB
  const bankAccountsList = await db.query.bankAccounts.findMany();
  const spendCategoriesList = await db.query.spendCategories.findMany({
    with: { masterCategory: true },
  });
  const masterCategoriesList = await db.query.masterCategories.findMany();

  const baMap = new Map(
    bankAccountsList.map((ba) => [`${ba.source}|${ba.accountName}`, ba.id])
  );
  const scMap = new Map(spendCategoriesList.map((sc) => [sc.name, sc]));
  const mcMap = new Map(masterCategoriesList.map((mc) => [mc.name, mc.id]));

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const missingCategories = new Set<string>();

  for (const row of rows) {
    const source = String(row["Source"] || "").trim();
    const account = String(row["Account"] || "").trim();
    const dateVal = row["Date"];
    const description = String(row["Description"] || "").trim();
    const amountFcy = row["Amount in FCY"];
    const fcyCurrency = row["FCY Currency"];
    const accountingAmt = row["Accounting Amt"];
    const spendCatName = normalizeCategory(String(row["Spend Category"] || ""));
    const masterCatName = normalizeCategory(String(row["Master Category"] || ""));

    if (!source || !description || accountingAmt === undefined || accountingAmt === null || accountingAmt === "") {
      skipped++;
      continue;
    }

    // Parse date
    let date: Date;
    if (typeof dateVal === "number") {
      const parsed = XLSX.SSF.parse_date_code(dateVal);
      date = new Date(parsed.y, parsed.m - 1, parsed.d);
    } else if (typeof dateVal === "string") {
      date = new Date(dateVal);
    } else if (dateVal instanceof Date) {
      date = dateVal;
    } else {
      console.warn(`Skipping row with invalid date: ${JSON.stringify(dateVal)}`);
      skipped++;
      continue;
    }

    if (isNaN(date.getTime())) {
      console.warn(`Skipping row with unparseable date: ${JSON.stringify(dateVal)}`);
      skipped++;
      continue;
    }

    // Resolve bank account
    const ba = normalizeBankAccount(source, account);
    if (!ba) {
      skipped++;
      continue;
    }
    const bankAccountId = baMap.get(`${ba.source}|${ba.accountName}`);
    if (!bankAccountId) {
      console.warn(`Bank account not found: ${ba.source} | ${ba.accountName}`);
      skipped++;
      continue;
    }

    // Resolve spend category
    let sc = scMap.get(spendCatName);
    if (!sc) {
      // Try to create the category if we have a master category
      const mcId = mcMap.get(masterCatName);
      if (mcId && spendCatName) {
        const [created] = await db
          .insert(schema.spendCategories)
          .values({ name: spendCatName, masterCategoryId: mcId })
          .returning();
        const full = await db.query.spendCategories.findFirst({
          where: eq(schema.spendCategories.id, created.id),
          with: { masterCategory: true },
        });
        if (full) {
          scMap.set(spendCatName, full);
          sc = full;
          console.log(`Created new spend category: "${spendCatName}" → ${masterCatName}`);
        }
      }
      if (!sc) {
        missingCategories.add(`${spendCatName} (${masterCatName})`);
        skipped++;
        continue;
      }
    }

    // Resolve master category (use transaction-level override if different from spend default)
    let masterCategoryId = sc.masterCategoryId;
    if (masterCatName && mcMap.has(masterCatName)) {
      masterCategoryId = mcMap.get(masterCatName)!;
    }

    // Parse amounts
    const amt = typeof accountingAmt === "number" ? accountingAmt : parseFloat(String(accountingAmt));
    const fcy = amountFcy
      ? typeof amountFcy === "number"
        ? amountFcy
        : parseFloat(String(amountFcy))
      : null;

    try {
      await db.insert(schema.transactions).values({
        bankAccountId,
        date,
        description,
        amountFcy: fcy && !isNaN(fcy) ? String(fcy) : null,
        fcyCurrency: fcyCurrency ? String(fcyCurrency).trim() || null : null,
        accountingAmt: String(amt),
        spendCategoryId: sc.id,
        masterCategoryId,
        isConfirmed: true,
      });
      imported++;
    } catch (e) {
      console.error(`Error importing row: ${description} on ${date}`, e);
      errors++;
    }
  }

  console.log(`\nImport complete!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  if (missingCategories.size > 0) {
    console.log(`  Missing categories: ${[...missingCategories].join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
