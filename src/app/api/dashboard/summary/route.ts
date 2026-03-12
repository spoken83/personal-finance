import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, masterCategories } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  // Get all transactions with both master and spend categories
  const txList = await db.query.transactions.findMany({
    where: eq(transactions.isAmortized, false),
    with: {
      masterCategory: true,
      spendCategory: true,
    },
    orderBy: [asc(transactions.date)],
  });

  // Build monthly breakdown by master category
  const monthlyBreakdown: Record<string, Record<string, number>> = {};
  const categoryTotals: Record<string, number> = {};

  // Build monthly breakdown by spend category (keyed as "masterName::spendName")
  const monthlySpendBreakdown: Record<string, Record<string, number>> = {};
  const spendCategoryTotals: Record<string, number> = {};

  for (const tx of txList) {
    const month = new Date(tx.date).toISOString().slice(0, 7);
    const masterName = tx.masterCategory.name;
    const spendName = tx.spendCategory.name;
    const amt = Number(tx.accountingAmt);

    // Master category level
    if (!monthlyBreakdown[month]) monthlyBreakdown[month] = {};
    monthlyBreakdown[month][masterName] = (monthlyBreakdown[month][masterName] || 0) + amt;
    categoryTotals[masterName] = (categoryTotals[masterName] || 0) + amt;

    // Spend category level (keyed under master)
    const spendKey = `${masterName}::${spendName}`;
    if (!monthlySpendBreakdown[month]) monthlySpendBreakdown[month] = {};
    monthlySpendBreakdown[month][spendKey] = (monthlySpendBreakdown[month][spendKey] || 0) + amt;
    spendCategoryTotals[spendKey] = (spendCategoryTotals[spendKey] || 0) + amt;
  }

  // Get master categories for ordering
  const masterCats = await db.query.masterCategories.findMany({
    orderBy: [asc(masterCategories.displayOrder)],
  });

  // Calculate totals excluding excluded categories
  const months = Object.keys(monthlyBreakdown).sort();
  const monthlyTotals: Record<string, number> = {};
  const monthlySpending: Record<string, number> = {};

  for (const month of months) {
    let total = 0;
    let spending = 0;
    for (const mc of masterCats) {
      const val = monthlyBreakdown[month][mc.name] || 0;
      total += val;
      if (!mc.isExcluded) spending += val;
    }
    monthlyTotals[month] = total;
    monthlySpending[month] = spending;
  }

  return NextResponse.json({
    months,
    masterCategories: masterCats,
    monthlyBreakdown,
    monthlySpendBreakdown,
    categoryTotals,
    spendCategoryTotals,
    monthlyTotals,
    monthlySpending,
  });
}
