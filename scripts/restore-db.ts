import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const dumpPath = path.join(__dirname, "..", "prisma", "db-dump.json");
  if (!fs.existsSync(dumpPath)) {
    console.error("No dump file found at", dumpPath);
    process.exit(1);
  }

  console.log("Reading dump file...");
  const dump = JSON.parse(fs.readFileSync(dumpPath, "utf-8"));
  console.log(`Dump from: ${dump.exportedAt}`);
  console.log(`Counts:`, dump.counts);

  // Clear all data in dependency order
  console.log("\nClearing existing data...");
  await prisma.investmentSnapshot.deleteMany();
  await prisma.accountBalance.deleteMany();
  await prisma.categorizationRule.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.runwayConfig.deleteMany();
  await prisma.spendCategory.deleteMany();
  await prisma.masterCategory.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.investmentAccount.deleteMany();

  // Restore in dependency order
  console.log("Restoring master categories...");
  for (const mc of dump.masterCategories) {
    await prisma.masterCategory.create({ data: mc });
  }

  console.log("Restoring spend categories...");
  for (const sc of dump.spendCategories) {
    await prisma.spendCategory.create({ data: sc });
  }

  console.log("Restoring bank accounts...");
  for (const ba of dump.bankAccounts) {
    await prisma.bankAccount.create({ data: ba });
  }

  console.log("Restoring investment accounts...");
  for (const ia of dump.investmentAccounts) {
    await prisma.investmentAccount.create({ data: ia });
  }

  console.log("Restoring transactions...");
  // Batch insert for performance
  const batchSize = 100;
  for (let i = 0; i < dump.transactions.length; i += batchSize) {
    const batch = dump.transactions.slice(i, i + batchSize);
    await prisma.transaction.createMany({ data: batch });
  }
  console.log(`  ${dump.transactions.length} transactions restored`);

  console.log("Restoring account balances...");
  for (const ab of dump.accountBalances) {
    await prisma.accountBalance.create({ data: ab });
  }

  console.log("Restoring investment snapshots...");
  for (const is_ of dump.investmentSnapshots) {
    await prisma.investmentSnapshot.create({ data: is_ });
  }

  if (dump.categorizationRules?.length > 0) {
    console.log("Restoring categorization rules...");
    for (const cr of dump.categorizationRules) {
      await prisma.categorizationRule.create({ data: cr });
    }
  }

  if (dump.runwayConfig?.length > 0) {
    console.log("Restoring runway config...");
    for (const rc of dump.runwayConfig) {
      await prisma.runwayConfig.create({ data: rc });
    }
  }

  console.log("\nRestore complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
