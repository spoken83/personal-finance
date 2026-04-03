import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, accountBalances, investmentSnapshots, bankAccounts, investmentAccounts } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const txList = await db.query.transactions.findMany({
    with: { masterCategory: true },
    orderBy: [asc(transactions.date)],
  });

  // Build monthly aggregates
  // "Spending" = discretionary/fixed outflows (Expense, Business Expense, Fixed Payment, Adhoc, Final loan Payment)
  // "Rental" = tracked separately (budgeted from a different pot)
  const monthlySpending: Record<string, number> = {};
  const monthlyRental: Record<string, number> = {};
  const monthlyMoneyIn: Record<string, number> = {};
  const monthlyByCategory: Record<string, Record<string, number>> = {};

  const excludeFromSpending = ["Money In", "Investment", "Repayment(exclude)", "Internal Trf(exclude)", "Rental"];

  for (const tx of txList) {
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
  for (const tx of txList) {
    allMonths.add(new Date(tx.date).toISOString().slice(0, 7));
  }
  const months = [...allMonths].sort();

  // Non-liquid investment account types (tracked for reference, excluded from calculations)
  const NON_LIQUID_TYPES = ["endowment", "SRS"];

  // Get actual bank balances (exclude credit cards — they're not savings)
  const bankBalanceList = await db.query.accountBalances.findMany({
    with: { bankAccount: true },
    orderBy: [asc(accountBalances.month), asc(accountBalances.bankAccountId)],
  });

  const balancesByMonth: Record<string, { accounts: Record<string, number>; accountIds: Record<string, number>; total: number }> = {};
  for (const bal of bankBalanceList) {
    if (bal.bankAccount.accountType === "credit_card") continue;
    const month = bal.month.toISOString().slice(0, 7);
    if (!balancesByMonth[month]) balancesByMonth[month] = { accounts: {}, accountIds: {}, total: 0 };
    const amt = Number(bal.actualBalance);
    balancesByMonth[month].accounts[bal.bankAccount.accountName] = amt;
    balancesByMonth[month].accountIds[bal.bankAccount.accountName] = bal.bankAccountId;
    balancesByMonth[month].total += amt;
  }

  // Get investment snapshots — separate liquid vs non-liquid
  const investmentSnapshotList = await db.query.investmentSnapshots.findMany({
    with: { investmentAccount: true },
    orderBy: [asc(investmentSnapshots.month), asc(investmentSnapshots.investmentAccountId)],
  });

  const investmentsByMonth: Record<string, { accounts: Record<string, number>; accountIds: Record<string, number>; total: number }> = {};
  const nonLiquidByMonth: Record<string, { accounts: Record<string, number>; accountIds: Record<string, number>; total: number }> = {};
  for (const snap of investmentSnapshotList) {
    const month = snap.month.toISOString().slice(0, 7);
    const isNonLiquid = NON_LIQUID_TYPES.includes(snap.investmentAccount.accountType || "");
    const target = isNonLiquid ? nonLiquidByMonth : investmentsByMonth;
    if (!target[month]) target[month] = { accounts: {}, accountIds: {}, total: 0 };
    const amt = Number(snap.balance);
    target[month].accounts[snap.investmentAccount.name] = amt;
    target[month].accountIds[snap.investmentAccount.name] = snap.investmentAccountId;
    target[month].total += amt;
  }

  // Get all active accounts for balance editing (exclude credit cards from bank accounts)
  const allBankAccounts = await db.query.bankAccounts.findMany({
    where: eq(bankAccounts.isActive, true),
    orderBy: [asc(bankAccounts.source)],
  });
  const allInvestmentAccounts = await db.query.investmentAccounts.findMany({
    where: eq(investmentAccounts.isActive, true),
    orderBy: [asc(investmentAccounts.name)],
  });

  // Calculate expected balance
  const config = await db.query.runwayConfig.findFirst();
  const startingBalance = config ? Number(config.totalProceeds) : 0;

  let expectedBalance = startingBalance;
  const monthlyHealthCheck = months.map((month) => {
    const spending = Math.abs(monthlySpending[month] || 0);
    const rental = Math.abs(monthlyRental[month] || 0);
    const moneyIn = monthlyMoneyIn[month] || 0;
    const totalOutflow = spending + rental;
    const netFlow = -totalOutflow + moneyIn;

    // Expected balance tracks: starting proceeds minus cumulative outflows
    // Income is shown separately and reflected in actual balances, not here
    expectedBalance -= totalOutflow;

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
      bankAccountIds: balancesByMonth[month]?.accountIds || {},
      investments: investmentsByMonth[month]?.accounts || {},
      investmentAccountIds: investmentsByMonth[month]?.accountIds || {},
      nonLiquid: nonLiquidByMonth[month]?.accounts || {},
      nonLiquidIds: nonLiquidByMonth[month]?.accountIds || {},
      nonLiquidTotal: nonLiquidByMonth[month]?.total ?? null,
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

  // Average monthly money in (last 6 months)
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
    allBankAccounts: allBankAccounts
      .filter((a) => a.accountType !== "credit_card")
      .map((a) => ({ id: a.id, name: a.accountName, source: a.source })),
    allInvestmentAccounts: allInvestmentAccounts
      .filter((a) => !NON_LIQUID_TYPES.includes(a.accountType || ""))
      .map((a) => ({ id: a.id, name: a.name, provider: a.provider })),
    allNonLiquidAccounts: allInvestmentAccounts
      .filter((a) => NON_LIQUID_TYPES.includes(a.accountType || ""))
      .map((a) => ({ id: a.id, name: a.name, provider: a.provider })),
    summary: {
      startingBalance,
      currentExpectedBalance: currentExpected,
      currentActualBalance: monthlyHealthCheck.findLast((m) => m.actualTotal !== null)?.actualTotal ?? null,
      avgMonthlyBurn,
      avgMonthlyMoneyIn,
      monthsRemaining: monthsRemaining === Infinity ? -1 : Math.round(monthsRemaining * 10) / 10,
      runwayConfig: config
        ? {
            totalProceeds: Number(config.totalProceeds),
            expectedReturnRate: Number(config.expectedReturnRate),
            projectionYears: config.projectionYears,
            monthlyInvestmentTarget: Number(config.monthlyInvestmentTarget),
          }
        : null,
    },
  });
}
