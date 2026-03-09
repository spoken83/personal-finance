import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const txns = await prisma.transaction.findMany({ select: { date: true } });
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

main().catch(console.error).finally(() => prisma.$disconnect());
