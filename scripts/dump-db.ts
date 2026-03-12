import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { asc } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import * as schema from "../src/lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  console.log("Dumping database...");

  const masterCategoriesList = await db.query.masterCategories.findMany({ orderBy: [asc(schema.masterCategories.id)] });
  const spendCategoriesList = await db.query.spendCategories.findMany({ orderBy: [asc(schema.spendCategories.id)] });
  const bankAccountsList = await db.query.bankAccounts.findMany({ orderBy: [asc(schema.bankAccounts.id)] });
  const investmentAccountsList = await db.query.investmentAccounts.findMany({ orderBy: [asc(schema.investmentAccounts.id)] });
  const transactionsList = await db.query.transactions.findMany({ orderBy: [asc(schema.transactions.id)] });
  const accountBalancesList = await db.query.accountBalances.findMany({ orderBy: [asc(schema.accountBalances.id)] });
  const investmentSnapshotsList = await db.query.investmentSnapshots.findMany({ orderBy: [asc(schema.investmentSnapshots.id)] });
  const categorizationRulesList = await db.query.categorizationRules.findMany({ orderBy: [asc(schema.categorizationRules.id)] });
  const runwayConfigList = await db.query.runwayConfig.findMany();

  const dump = {
    exportedAt: new Date().toISOString(),
    counts: {
      masterCategories: masterCategoriesList.length,
      spendCategories: spendCategoriesList.length,
      bankAccounts: bankAccountsList.length,
      investmentAccounts: investmentAccountsList.length,
      transactions: transactionsList.length,
      accountBalances: accountBalancesList.length,
      investmentSnapshots: investmentSnapshotsList.length,
      categorizationRules: categorizationRulesList.length,
    },
    masterCategories: masterCategoriesList,
    spendCategories: spendCategoriesList,
    bankAccounts: bankAccountsList,
    investmentAccounts: investmentAccountsList,
    transactions: transactionsList,
    accountBalances: accountBalancesList,
    investmentSnapshots: investmentSnapshotsList,
    categorizationRules: categorizationRulesList,
    runwayConfig: runwayConfigList,
  };

  const outPath = path.join(__dirname, "..", "db-dump.json");
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2));

  console.log(`\nDump complete → ${outPath}`);
  console.log(`  Master categories: ${masterCategoriesList.length}`);
  console.log(`  Spend categories: ${spendCategoriesList.length}`);
  console.log(`  Bank accounts: ${bankAccountsList.length}`);
  console.log(`  Investment accounts: ${investmentAccountsList.length}`);
  console.log(`  Transactions: ${transactionsList.length}`);
  console.log(`  Account balances: ${accountBalancesList.length}`);
  console.log(`  Investment snapshots: ${investmentSnapshotsList.length}`);
  console.log(`  Categorization rules: ${categorizationRulesList.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
