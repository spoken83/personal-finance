import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  // Get all transactions with both master and spend categories
  const transactions = await prisma.transaction.findMany({
    where: { isAmortized: false },
    include: {
      masterCategory: true,
      spendCategory: true,
    },
    orderBy: { date: "asc" },
  });

  // Build monthly breakdown by master category
  const monthlyBreakdown: Record<string, Record<string, number>> = {};
  const categoryTotals: Record<string, number> = {};

  // Build monthly breakdown by spend category (keyed as "masterName::spendName")
  const monthlySpendBreakdown: Record<string, Record<string, number>> = {};
  const spendCategoryTotals: Record<string, number> = {};

  for (const tx of transactions) {
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
  const masterCategories = await prisma.masterCategory.findMany({
    orderBy: { displayOrder: "asc" },
  });

  // Calculate totals excluding excluded categories
  const months = Object.keys(monthlyBreakdown).sort();
  const monthlyTotals: Record<string, number> = {};
  const monthlySpending: Record<string, number> = {};

  for (const month of months) {
    let total = 0;
    let spending = 0;
    for (const mc of masterCategories) {
      const val = monthlyBreakdown[month][mc.name] || 0;
      total += val;
      if (!mc.isExcluded) spending += val;
    }
    monthlyTotals[month] = total;
    monthlySpending[month] = spending;
  }

  return NextResponse.json({
    months,
    masterCategories,
    monthlyBreakdown,
    monthlySpendBreakdown,
    categoryTotals,
    spendCategoryTotals,
    monthlyTotals,
    monthlySpending,
  });
}
