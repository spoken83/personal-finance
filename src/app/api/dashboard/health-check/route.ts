import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const transactions = await prisma.transaction.findMany({
    include: { masterCategory: true },
    orderBy: { date: "asc" },
  });

  // Build monthly aggregates
  // "Spending" = discretionary/fixed outflows (Expense, Business Expense, Fixed Payment, Adhoc, Final loan Payment)
  // "Rental" = tracked separately (budgeted from a different pot)
  const monthlySpending: Record<string, number> = {};
  const monthlyRental: Record<string, number> = {};
  const monthlyMoneyIn: Record<string, number> = {};
  const monthlyByCategory: Record<string, Record<string, number>> = {};

  const excludeFromSpending = ["Money In", "Investment", "Repayment(exclude)", "Internal Trf(exclude)", "Rental"];

  for (const tx of transactions) {
    const month = new Date(tx.date).toISOString().slice(0, 7);
    const cat = tx.masterCategory.name;
    const amt = Number(tx.accountingAmt);

    if (!monthlyByCategory[month]) monthlyByCategory[month] = {};
    monthlyByCategory[month][cat] = (monthlyByCategory[month][cat] || 0) + amt;

    if (cat === "Money In") {
      monthlyMoneyIn[month] = (monthlyMoneyIn[month] || 0) + amt;
    } else if (cat === "Rental") {
      monthlyRental[month] = (monthlyRental[month] || 0) + amt;
    } else if (!excludeFromSpending.includes(cat)) {
      monthlySpending[month] = (monthlySpending[month] || 0) + amt;
    }
  }

  // Get all months that have any transactions
  const allMonths = new Set<string>();
  for (const tx of transactions) {
    allMonths.add(new Date(tx.date).toISOString().slice(0, 7));
  }
  const months = [...allMonths].sort();

  // Get actual bank balances
  const bankBalances = await prisma.accountBalance.findMany({
    include: { bankAccount: true },
    orderBy: [{ month: "asc" }, { bankAccountId: "asc" }],
  });

  const balancesByMonth: Record<string, { accounts: Record<string, number>; total: number }> = {};
  for (const bal of bankBalances) {
    const month = bal.month.toISOString().slice(0, 7);
    if (!balancesByMonth[month]) balancesByMonth[month] = { accounts: {}, total: 0 };
    const amt = Number(bal.actualBalance);
    balancesByMonth[month].accounts[bal.bankAccount.accountName] = amt;
    balancesByMonth[month].total += amt;
  }

  // Get investment snapshots
  const investmentSnapshots = await prisma.investmentSnapshot.findMany({
    include: { investmentAccount: true },
    orderBy: [{ month: "asc" }, { investmentAccountId: "asc" }],
  });

  const investmentsByMonth: Record<string, { accounts: Record<string, number>; total: number }> = {};
  for (const snap of investmentSnapshots) {
    const month = snap.month.toISOString().slice(0, 7);
    if (!investmentsByMonth[month]) investmentsByMonth[month] = { accounts: {}, total: 0 };
    const amt = Number(snap.balance);
    investmentsByMonth[month].accounts[snap.investmentAccount.name] = amt;
    investmentsByMonth[month].total += amt;
  }

  // Calculate expected balance
  // Logic matches Excel: Start with totalProceeds, subtract only actual spending each month
  // Do NOT add Money In (the proceeds ARE the starting balance, Money In would double-count)
  // Do NOT subtract Investment outflows (they're reallocations to investment accounts)
  const runwayConfig = await prisma.runwayConfig.findFirst();
  const startingBalance = runwayConfig ? Number(runwayConfig.totalProceeds) : 0;

  let expectedBalance = startingBalance;
  const monthlyHealthCheck = months.map((month) => {
    const spending = Math.abs(monthlySpending[month] || 0); // spending amounts are negative, make positive
    const rental = Math.abs(monthlyRental[month] || 0);
    const moneyIn = monthlyMoneyIn[month] || 0;
    const totalOutflow = spending + rental;
    const netFlow = -totalOutflow + moneyIn;

    expectedBalance -= totalOutflow; // subtract both spending and rental

    const actualBankTotal = balancesByMonth[month]?.total ?? null;
    const actualInvestmentTotal = investmentsByMonth[month]?.total ?? null;
    const actualTotal =
      actualBankTotal !== null || actualInvestmentTotal !== null
        ? (actualBankTotal || 0) + (actualInvestmentTotal || 0)
        : null;

    return {
      month,
      spending,
      rental,
      moneyIn,
      netFlow,
      expectedBalance,
      actualBankBalance: actualBankTotal,
      actualInvestmentBalance: actualInvestmentTotal,
      actualTotal,
      bankAccounts: balancesByMonth[month]?.accounts || {},
      investments: investmentsByMonth[month]?.accounts || {},
      variance: actualTotal !== null && expectedBalance !== 0
        ? actualTotal / expectedBalance
        : null,
      categoryBreakdown: monthlyByCategory[month] || {},
    };
  });

  // Average monthly burn (last 6 months of spending)
  const recentMonths = months.slice(-6);
  const avgMonthlyBurn =
    recentMonths.reduce((sum, m) => sum + Math.abs(monthlySpending[m] || 0), 0) /
    recentMonths.length;

  // Average monthly money in (last 6 months, excluding outlier Sales Proceeds)
  const avgMonthlyMoneyIn =
    recentMonths.reduce((sum, m) => sum + (monthlyMoneyIn[m] || 0), 0) /
    recentMonths.length;

  // Runway: how many months until expected balance hits 0
  const netBurn = avgMonthlyBurn - avgMonthlyMoneyIn;
  const currentExpected = monthlyHealthCheck.length > 0
    ? monthlyHealthCheck[monthlyHealthCheck.length - 1].expectedBalance
    : startingBalance;
  const monthsRemaining = netBurn > 0 ? currentExpected / netBurn : Infinity;

  return NextResponse.json({
    months,
    monthlyHealthCheck,
    summary: {
      startingBalance,
      currentExpectedBalance: currentExpected,
      currentActualBalance: monthlyHealthCheck.findLast((m) => m.actualTotal !== null)?.actualTotal ?? null,
      avgMonthlyBurn,
      avgMonthlyMoneyIn,
      monthsRemaining: Math.round(monthsRemaining * 10) / 10,
      runwayConfig: runwayConfig
        ? {
            totalProceeds: Number(runwayConfig.totalProceeds),
            expectedReturnRate: Number(runwayConfig.expectedReturnRate),
            projectionYears: runwayConfig.projectionYears,
            monthlyInvestmentTarget: Number(runwayConfig.monthlyInvestmentTarget),
          }
        : null,
    },
  });
}
