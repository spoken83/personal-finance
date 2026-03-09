import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Dumping database...");

  const masterCategories = await prisma.masterCategory.findMany({ orderBy: { id: "asc" } });
  const spendCategories = await prisma.spendCategory.findMany({ orderBy: { id: "asc" } });
  const bankAccounts = await prisma.bankAccount.findMany({ orderBy: { id: "asc" } });
  const investmentAccounts = await prisma.investmentAccount.findMany({ orderBy: { id: "asc" } });
  const transactions = await prisma.transaction.findMany({ orderBy: { id: "asc" } });
  const accountBalances = await prisma.accountBalance.findMany({ orderBy: { id: "asc" } });
  const investmentSnapshots = await prisma.investmentSnapshot.findMany({ orderBy: { id: "asc" } });
  const categorizationRules = await prisma.categorizationRule.findMany({ orderBy: { id: "asc" } });
  const runwayConfig = await prisma.runwayConfig.findMany();

  const dump = {
    exportedAt: new Date().toISOString(),
    counts: {
      masterCategories: masterCategories.length,
      spendCategories: spendCategories.length,
      bankAccounts: bankAccounts.length,
      investmentAccounts: investmentAccounts.length,
      transactions: transactions.length,
      accountBalances: accountBalances.length,
      investmentSnapshots: investmentSnapshots.length,
      categorizationRules: categorizationRules.length,
    },
    masterCategories,
    spendCategories,
    bankAccounts,
    investmentAccounts,
    transactions,
    accountBalances,
    investmentSnapshots,
    categorizationRules,
    runwayConfig,
  };

  const outPath = path.join(__dirname, "..", "prisma", "db-dump.json");
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2));

  console.log(`\nDump complete → ${outPath}`);
  console.log(`  Master categories: ${masterCategories.length}`);
  console.log(`  Spend categories: ${spendCategories.length}`);
  console.log(`  Bank accounts: ${bankAccounts.length}`);
  console.log(`  Investment accounts: ${investmentAccounts.length}`);
  console.log(`  Transactions: ${transactions.length}`);
  console.log(`  Account balances: ${accountBalances.length}`);
  console.log(`  Investment snapshots: ${investmentSnapshots.length}`);
  console.log(`  Categorization rules: ${categorizationRules.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
