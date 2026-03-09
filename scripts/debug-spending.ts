import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Total ChiangMai Trip + Harbin Travel
  const trips = await prisma.transaction.findMany({
    where: { spendCategory: { name: { in: ["ChiangMai Trip", "Harbin Travel"] } } },
    select: { date: true, accountingAmt: true, spendCategory: { select: { name: true } } },
  });
  const cmTotal = trips.filter(t => t.spendCategory.name === "ChiangMai Trip").reduce((s, t) => s + Number(t.accountingAmt), 0);
  const htTotal = trips.filter(t => t.spendCategory.name === "Harbin Travel").reduce((s, t) => s + Number(t.accountingAmt), 0);
  console.log("ChiangMai Trip total:", cmTotal.toFixed(2), "(" + trips.filter(t => t.spendCategory.name === "ChiangMai Trip").length + " txns)");
  console.log("Harbin Travel total:", htTotal.toFixed(2));

  // App spending Jul-Dec by master category
  const excludeFromSpending = ["Money In", "Investment", "Repayment(exclude)", "Internal Trf(exclude)"];
  const txs = await prisma.transaction.findMany({
    where: { date: { gte: new Date("2025-07-01"), lt: new Date("2026-01-01") } },
    include: { masterCategory: true },
  });

  const byMaster: Record<string, number> = {};
  let totalSpending = 0;
  for (const t of txs) {
    const cat = t.masterCategory.name;
    const amt = Number(t.accountingAmt);
    if (excludeFromSpending.indexOf(cat) === -1) {
      totalSpending += amt;
      byMaster[cat] = (byMaster[cat] || 0) + amt;
    }
  }

  console.log("\n=== App Jul-Dec spending by master category ===");
  for (const [cat, amt] of Object.entries(byMaster).sort((a, b) => a[1] - b[1])) {
    console.log(`  ${cat.padEnd(30)} ${amt.toFixed(2)}`);
  }
  console.log(`  ${"TOTAL".padEnd(30)} ${totalSpending.toFixed(2)}`);

  // Excel totals
  const excelTotal = 107601.42 + 25378.98 + 17511.86 + 10509.48 + 12444.94 + 17033.34;
  console.log(`\nExcel Jul-Dec total spending: ${excelTotal.toFixed(2)}`);
  console.log(`App Jul-Dec total spending:   ${Math.abs(totalSpending).toFixed(2)}`);
  console.log(`Difference:                   ${(Math.abs(totalSpending) - excelTotal).toFixed(2)}`);
  console.log(`Adhoc (trips) total:          ${Math.abs(byMaster["Adhoc"] || 0).toFixed(2)}`);

  // Per-month Fixed Payment comparison
  console.log("\n=== Fixed Payment per month ===");
  for (let m = 7; m <= 12; m++) {
    const month = `2025-${String(m).padStart(2, "0")}`;
    const monthTxs = txs.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === 2025 && d.getMonth() + 1 === m && t.masterCategory.name === "Fixed Payment";
    });
    const total = monthTxs.reduce((s, t) => s + Number(t.accountingAmt), 0);
    console.log(`  ${month}: ${total.toFixed(2)}`);
  }

  process.exit(0);
}

main();
