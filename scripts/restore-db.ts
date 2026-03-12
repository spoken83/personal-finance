import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as fs from "fs";
import * as path from "path";
import * as schema from "../src/lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  const dumpPath = path.join(__dirname, "..", "db-dump.json");
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
  await db.delete(schema.investmentSnapshots);
  await db.delete(schema.accountBalances);
  await db.delete(schema.categorizationRules);
  await db.delete(schema.transactions);
  await db.delete(schema.runwayConfig);
  await db.delete(schema.budgets);
  await db.delete(schema.statementUploads);
  await db.delete(schema.spendCategories);
  await db.delete(schema.masterCategories);
  await db.delete(schema.bankAccounts);
  await db.delete(schema.investmentAccounts);

  // Restore in dependency order
  console.log("Restoring master categories...");
  for (const mc of dump.masterCategories) {
    await db.insert(schema.masterCategories).values(mc);
  }

  console.log("Restoring spend categories...");
  for (const sc of dump.spendCategories) {
    await db.insert(schema.spendCategories).values(sc);
  }

  console.log("Restoring bank accounts...");
  for (const ba of dump.bankAccounts) {
    await db.insert(schema.bankAccounts).values(ba);
  }

  console.log("Restoring investment accounts...");
  for (const ia of dump.investmentAccounts) {
    await db.insert(schema.investmentAccounts).values(ia);
  }

  console.log("Restoring transactions...");
  const batchSize = 100;
  for (let i = 0; i < dump.transactions.length; i += batchSize) {
    const batch = dump.transactions.slice(i, i + batchSize);
    await db.insert(schema.transactions).values(batch);
  }
  console.log(`  ${dump.transactions.length} transactions restored`);

  console.log("Restoring account balances...");
  for (const ab of dump.accountBalances) {
    await db.insert(schema.accountBalances).values(ab);
  }

  console.log("Restoring investment snapshots...");
  for (const is_ of dump.investmentSnapshots) {
    await db.insert(schema.investmentSnapshots).values(is_);
  }

  if (dump.categorizationRules?.length > 0) {
    console.log("Restoring categorization rules...");
    for (const cr of dump.categorizationRules) {
      await db.insert(schema.categorizationRules).values(cr);
    }
  }

  if (dump.runwayConfig?.length > 0) {
    console.log("Restoring runway config...");
    for (const rc of dump.runwayConfig) {
      await db.insert(schema.runwayConfig).values(rc);
    }
  }

  console.log("\nRestore complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
