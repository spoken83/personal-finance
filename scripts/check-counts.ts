import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  const txns = await db.query.transactions.findMany({
    columns: { date: true },
  });
  const counts: Record<string, number> = {};
  for (const tx of txns) {
    const m = new Date(tx.date).toISOString().slice(0, 7);
    counts[m] = (counts[m] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  console.log("Transactions by month:");
  let total = 0;
  for (const [month, count] of sorted) {
    console.log(`  ${month}: ${count}`);
    total += count;
  }
  console.log(`  Total: ${total}`);
}

main().catch(console.error);
