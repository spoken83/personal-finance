"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useTransactionModal,
  TransactionModal,
} from "@/components/transactions/transaction-modal";
import { formatCurrency } from "@/lib/format";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  Save,
  X,
} from "lucide-react";

interface HealthCheckMonth {
  month: string;
  spending: number;
  rental: number;
  moneyIn: number;
  netFlow: number;
  expectedBalance: number;
  actualBankBalance: number | null;
  actualInvestmentBalance: number | null;
  actualTotal: number | null;
  bankAccounts: Record<string, number>;
  bankAccountIds: Record<string, number>;
  investments: Record<string, number>;
  investmentAccountIds: Record<string, number>;
  nonLiquid: Record<string, number>;
  nonLiquidIds: Record<string, number>;
  nonLiquidTotal: number | null;
  variance: number | null;
  categoryBreakdown: Record<string, number>;
}

interface Summary {
  startingBalance: number;
  currentExpectedBalance: number;
  currentActualBalance: number | null;
  avgMonthlyBurn: number;
  avgMonthlyMoneyIn: number;
  monthsRemaining: number;
}

interface AccountRef {
  id: number;
  name: string;
  source?: string;
  provider?: string;
}

interface BudgetItem {
  id: number;
  masterCategoryId: number | null;
  spendCategoryId: number | null;
  monthlyAmount: string;
  masterCategory: { id: number; name: string } | null;
  spendCategory: { id: number; name: string } | null;
}

interface MasterCategory {
  id: number;
  name: string;
  isExcluded: boolean;
}

const SPENDING_EXCLUDES = [
  "Money In",
  "Investment",
  "Repayment(exclude)",
  "Internal Trf(exclude)",
  "Rental",
];

const BUDGET_CATEGORIES = [
  "Expense",
  "Business Expense",
  "Fixed Payment",
  "Adhoc",
  "Rental",
];

export default function BudgetPage() {
  const router = useRouter();
  const [healthCheck, setHealthCheck] = useState<HealthCheckMonth[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const [editingBalanceMonth, setEditingBalanceMonth] = useState<string | null>(null);
  const [balanceEdits, setBalanceEdits] = useState<Record<string, string>>({});
  const [savingBalances, setSavingBalances] = useState(false);

  const [allBankAccounts, setAllBankAccounts] = useState<AccountRef[]>([]);
  const [allInvestmentAccounts, setAllInvestmentAccounts] = useState<AccountRef[]>([]);
  const [allNonLiquidAccounts, setAllNonLiquidAccounts] = useState<AccountRef[]>([]);

  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({});
  const [savingBudgets, setSavingBudgets] = useState(false);

  const { state: modalState, openModal, closeModal, categoryMap } = useTransactionModal();

  const loadData = useCallback(() => {
    Promise.all([
      fetch("/api/dashboard/health-check").then((r) => r.json()),
      fetch("/api/budget").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([hcData, budgetData, catData]) => {
      setHealthCheck(hcData.monthlyHealthCheck);
      setSummary(hcData.summary);
      setAllBankAccounts(hcData.allBankAccounts || []);
      setAllInvestmentAccounts(hcData.allInvestmentAccounts || []);
      setAllNonLiquidAccounts(hcData.allNonLiquidAccounts || []);
      setBudgets(budgetData.budgets || []);
      setMasterCategories(catData.masterCategories || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const fmt = (n: number) => formatCurrency(n);

  function formatMonth(month: string) {
    return new Date(month + "-01").toLocaleDateString("en-SG", {
      month: "short",
      year: "2-digit",
    });
  }

  function getBudgetForCategory(masterName: string): number | null {
    const mc = masterCategories.find((c) => c.name === masterName);
    if (!mc) return null;
    const b = budgets.find((b) => b.masterCategoryId === mc.id && !b.spendCategoryId);
    return b ? Number(b.monthlyAmount) : null;
  }

  function getTotalMonthlyBudget(): number {
    return BUDGET_CATEGORIES.reduce((sum, cat) => sum + (getBudgetForCategory(cat) || 0), 0);
  }

  // Balance editing
  function startEditingBalances(month: string, row: HealthCheckMonth) {
    const edits: Record<string, string> = {};
    for (const acct of allBankAccounts) {
      const v = row.bankAccounts[acct.name];
      edits[`bank_${acct.id}`] = v !== undefined ? String(v) : "";
    }
    for (const acct of allInvestmentAccounts) {
      const v = row.investments[acct.name];
      edits[`inv_${acct.id}`] = v !== undefined ? String(v) : "";
    }
    for (const acct of allNonLiquidAccounts) {
      const v = row.nonLiquid[acct.name];
      edits[`nl_${acct.id}`] = v !== undefined ? String(v) : "";
    }
    setBalanceEdits(edits);
    setEditingBalanceMonth(month);
  }

  async function saveBalances(month: string) {
    setSavingBalances(true);
    const promises: Promise<Response>[] = [];
    for (const acct of allBankAccounts) {
      const val = balanceEdits[`bank_${acct.id}`];
      if (val !== "" && val !== undefined)
        promises.push(fetch("/api/balances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bankAccountId: acct.id, month, actualBalance: val }) }));
    }
    for (const acct of allInvestmentAccounts) {
      const val = balanceEdits[`inv_${acct.id}`];
      if (val !== "" && val !== undefined)
        promises.push(fetch("/api/investments/snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ investmentAccountId: acct.id, month, balance: val }) }));
    }
    for (const acct of allNonLiquidAccounts) {
      const val = balanceEdits[`nl_${acct.id}`];
      if (val !== "" && val !== undefined)
        promises.push(fetch("/api/investments/snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ investmentAccountId: acct.id, month, balance: val }) }));
    }
    await Promise.all(promises);
    setSavingBalances(false);
    setEditingBalanceMonth(null);
    setBalanceEdits({});
    setLoading(true);
    loadData();
  }

  // Budget editing
  function startEditingBudgets() {
    const edits: Record<string, string> = {};
    for (const cat of BUDGET_CATEGORIES) {
      const b = getBudgetForCategory(cat);
      edits[cat] = b !== null ? String(b) : "";
    }
    setBudgetEdits(edits);
    setShowBudgetEditor(true);
  }

  async function saveBudgets() {
    setSavingBudgets(true);
    const promises: Promise<Response>[] = [];
    for (const catName of BUDGET_CATEGORIES) {
      const val = budgetEdits[catName];
      const mc = masterCategories.find((c) => c.name === catName);
      if (!mc) continue;
      const current = getBudgetForCategory(catName);
      const next = val !== "" ? parseFloat(val) : null;
      if (next !== null && next !== current)
        promises.push(fetch("/api/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ masterCategoryId: mc.id, monthlyAmount: next }) }));
    }
    await Promise.all(promises);
    setSavingBudgets(false);
    setShowBudgetEditor(false);
    setBudgetEdits({});
    fetch("/api/budget").then((r) => r.json()).then((d) => setBudgets(d.budgets || []));
  }

  if (loading || !summary) {
    return <div className="text-gray-500 py-8 text-center">Loading...</div>;
  }

  const totalBudget = getTotalMonthlyBudget();
  const hasBudget = totalBudget > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Budget & Runway</h1>
        <p className="text-sm text-gray-400">Track spending against your financial runway</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Starting Proceeds</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold">{fmt(summary.startingBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Avg Monthly Burn</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-red-600">{fmt(summary.avgMonthlyBurn)}</p>
            {hasBudget && <p className="text-xs text-gray-400">Budget: {fmt(totalBudget)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Avg Monthly Income</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-green-600">{fmt(summary.avgMonthlyMoneyIn)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Runway</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-xl font-bold ${summary.monthsRemaining < 0 || summary.monthsRemaining > 24 ? "text-green-600" : summary.monthsRemaining > 12 ? "text-yellow-600" : "text-red-600"}`}>
              {summary.monthsRemaining < 0 ? "∞" : `${summary.monthsRemaining} mo`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-500">Monthly Budget</CardTitle>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => showBudgetEditor ? setShowBudgetEditor(false) : startEditingBudgets()}>
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {hasBudget ? <p className="text-xl font-bold">{fmt(totalBudget)}</p> : <p className="text-sm text-gray-400">Not set</p>}
          </CardContent>
        </Card>
      </div>

      {/* Budget Editor */}
      {showBudgetEditor && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Set Monthly Budgets</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowBudgetEditor(false)}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs" onClick={saveBudgets} disabled={savingBudgets}>{savingBudgets ? "Saving..." : "Save"}</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {BUDGET_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <label className="text-xs text-gray-500 mb-1 block">{cat}</label>
                  <Input type="number" step="100" min="0" placeholder="0" value={budgetEdits[cat] || ""} onChange={(e) => setBudgetEdits((p) => ({ ...p, [cat]: e.target.value }))} className="h-7 text-xs bg-white" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Check Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Financial Health Check</CardTitle>
          <p className="text-xs text-gray-400">Click row to expand details</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="text-2xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-white w-[28px] px-1"></TableHead>
                <TableHead className="sticky left-[28px] z-10 bg-white min-w-[60px] px-2">Month</TableHead>
                <TableHead className="text-right px-2">Spending</TableHead>
                {hasBudget && <TableHead className="text-right px-2">Budget</TableHead>}
                <TableHead className="text-right px-2">Rental</TableHead>
                <TableHead className="text-right px-2">Money In</TableHead>
                <TableHead className="text-right px-2">Net Flow</TableHead>
                <TableHead className="text-right px-2">Expected</TableHead>
                <TableHead className="text-right px-2">Bank</TableHead>
                <TableHead className="text-right px-2">Investments</TableHead>
                <TableHead className="text-right px-2 font-bold">Total</TableHead>
                <TableHead className="text-right px-2">Var</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {healthCheck.map((row) => {
                const isExpanded = expandedMonth === row.month;
                const isEditingBalance = editingBalanceMonth === row.month;

                const spendingBreakdown = Object.entries(row.categoryBreakdown)
                  .filter(([cat]) => !SPENDING_EXCLUDES.includes(cat))
                  .map(([cat, amt]) => ({ category: cat, amount: amt }))
                  .filter((item) => item.amount !== 0)
                  .sort((a, b) => a.amount - b.amount);

                const otherBreakdown = Object.entries(row.categoryBreakdown)
                  .filter(([cat]) => SPENDING_EXCLUDES.includes(cat))
                  .map(([cat, amt]) => ({ category: cat, amount: amt }))
                  .filter((item) => item.amount !== 0)
                  .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

                const spendingBudgetTotal = BUDGET_CATEGORIES
                  .filter((c) => c !== "Rental")
                  .reduce((sum, cat) => sum + (getBudgetForCategory(cat) || 0), 0);
                const overBudget = spendingBudgetTotal > 0 ? row.spending - spendingBudgetTotal : null;
                const colSpan = hasBudget ? 12 : 11;

                return (
                  <Fragment key={row.month}>
                    <TableRow
                      className={`cursor-pointer hover:bg-gray-50 ${isExpanded ? "bg-blue-50/60" : ""}`}
                      onClick={() => setExpandedMonth(isExpanded ? null : row.month)}
                    >
                      <TableCell className="sticky left-0 z-10 bg-inherit w-[28px] px-1">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                      </TableCell>
                      <TableCell className="sticky left-[28px] z-10 bg-inherit font-medium px-2 whitespace-nowrap">
                        {formatMonth(row.month)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 px-2 whitespace-nowrap">
                        {fmt(-row.spending)}
                      </TableCell>
                      {hasBudget && (
                        <TableCell className="text-right px-2 whitespace-nowrap">
                          {spendingBudgetTotal > 0 ? (
                            <span className={overBudget !== null && overBudget > 0 ? "text-red-500" : "text-green-600"}>
                              {fmt(-spendingBudgetTotal)}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right text-orange-600 px-2 whitespace-nowrap cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); if (row.rental > 0) openModal({ month: row.month, masterCategory: "Rental", title: "Rental" }); }}>
                        {row.rental > 0 ? fmt(-row.rental) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="text-right text-green-600 px-2 whitespace-nowrap">
                        {row.moneyIn > 0 ? fmt(row.moneyIn) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className={`text-right px-2 whitespace-nowrap ${row.netFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(row.netFlow)}
                      </TableCell>
                      <TableCell className="text-right px-2 whitespace-nowrap text-gray-600">
                        {fmt(row.expectedBalance)}
                      </TableCell>
                      <TableCell className="text-right px-2 whitespace-nowrap">
                        {row.actualBankBalance !== null ? fmt(row.actualBankBalance) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="text-right px-2 whitespace-nowrap">
                        {row.actualInvestmentBalance !== null ? fmt(row.actualInvestmentBalance) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-bold px-2 whitespace-nowrap">
                        {row.actualTotal !== null ? fmt(row.actualTotal) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="text-right px-2 whitespace-nowrap">
                        {row.variance !== null ? (
                          <span className={row.variance >= 1 ? "text-green-600" : "text-red-500"}>
                            {(row.variance * 100).toFixed(0)}%
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={colSpan} className="bg-gray-50/80 p-0">
                          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
                            {/* Spending Breakdown */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Spending</h4>
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); router.push(`/transactions?month=${row.month}`); }}>
                                  <ExternalLink className="mr-1 h-3 w-3" /> Transactions
                                </Button>
                              </div>
                              <table className="w-full text-2xs">
                                {hasBudget && (
                                  <thead>
                                    <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                                      <th className="text-left py-0.5 font-normal">Category</th>
                                      <th className="text-right py-0.5 font-normal">Actual</th>
                                      <th className="text-right py-0.5 font-normal">Budget</th>
                                      <th className="text-right py-0.5 font-normal">Diff</th>
                                    </tr>
                                  </thead>
                                )}
                                <tbody>
                                  {spendingBreakdown.map((item) => {
                                    const budget = getBudgetForCategory(item.category);
                                    const diff = budget !== null ? Math.abs(item.amount) - budget : null;
                                    return (
                                      <tr key={item.category} className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/80"
                                        onClick={(e) => { e.stopPropagation(); openModal({ month: row.month, masterCategory: item.category, title: item.category }); }}>
                                        <td className="py-1 pr-2 text-blue-700 hover:underline">{item.category}</td>
                                        <td className={`py-1 text-right ${item.amount >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(item.amount)}</td>
                                        {hasBudget && (
                                          <>
                                            <td className="py-1 text-right text-gray-400">{budget !== null ? fmt(-budget) : "-"}</td>
                                            <td className={`py-1 text-right ${diff === null ? "text-gray-300" : diff > 0 ? "text-red-500" : "text-green-500"}`}>
                                              {diff !== null ? `${diff > 0 ? "+" : ""}${fmt(-diff)}` : "-"}
                                            </td>
                                          </>
                                        )}
                                      </tr>
                                    );
                                  })}
                                  <tr className="border-t-2 font-semibold">
                                    <td className="py-1">Total</td>
                                    <td className="py-1 text-right text-red-600">{fmt(-row.spending)}</td>
                                    {hasBudget && (
                                      <>
                                        <td className="py-1 text-right text-gray-500">{fmt(-spendingBudgetTotal)}</td>
                                        <td className={`py-1 text-right ${overBudget !== null && overBudget > 0 ? "text-red-500" : "text-green-500"}`}>
                                          {overBudget !== null ? `${overBudget > 0 ? "+" : ""}${fmt(-overBudget)}` : "-"}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* Other Categories */}
                            <div>
                              {otherBreakdown.length > 0 && (
                                <>
                                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Other</h4>
                                  <table className="w-full text-2xs">
                                    <tbody>
                                      {otherBreakdown.map((item) => (
                                        <tr key={item.category} className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/80"
                                          onClick={(e) => { e.stopPropagation(); openModal({ month: row.month, masterCategory: item.category, title: item.category }); }}>
                                          <td className="py-1 pr-2 text-blue-700 hover:underline">{item.category}</td>
                                          <td className={`py-1 text-right ${item.amount >= 0 ? "text-green-600" : "text-gray-500"}`}>{fmt(item.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </>
                              )}
                            </div>

                            {/* Balances */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Balances</h4>
                                {!isEditingBalance ? (
                                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                                    onClick={(e) => { e.stopPropagation(); startEditingBalances(row.month, row); }}>
                                    <Pencil className="mr-1 h-3 w-3" /> Edit
                                  </Button>
                                ) : (
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                                      onClick={(e) => { e.stopPropagation(); setEditingBalanceMonth(null); setBalanceEdits({}); }}>
                                      Cancel
                                    </Button>
                                    <Button size="sm" className="h-6 text-xs px-2" disabled={savingBalances}
                                      onClick={(e) => { e.stopPropagation(); saveBalances(row.month); }}>
                                      <Save className="mr-1 h-3 w-3" /> {savingBalances ? "..." : "Save"}
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {isEditingBalance ? (
                                <table className="w-full text-2xs">
                                  <tbody>
                                    <tr><td colSpan={2} className="pb-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Bank Accounts</td></tr>
                                    {allBankAccounts.map((acct) => (
                                      <tr key={`bank_${acct.id}`} className="border-b border-gray-100">
                                        <td className="py-0.5 pr-2 text-gray-500">{acct.name}</td>
                                        <td className="py-0.5 text-right">
                                          <Input type="number" step="1" value={balanceEdits[`bank_${acct.id}`] || ""} onChange={(e) => setBalanceEdits((p) => ({ ...p, [`bank_${acct.id}`]: e.target.value }))} onClick={(e) => e.stopPropagation()} className="h-6 w-28 text-right text-xs ml-auto" />
                                        </td>
                                      </tr>
                                    ))}
                                    <tr><td colSpan={2} className="pt-2 pb-0.5 text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Investments (Liquid)</td></tr>
                                    {allInvestmentAccounts.map((acct) => (
                                      <tr key={`inv_${acct.id}`} className="border-b border-gray-100">
                                        <td className="py-0.5 pr-2 text-blue-600">{acct.name}</td>
                                        <td className="py-0.5 text-right">
                                          <Input type="number" step="1" value={balanceEdits[`inv_${acct.id}`] || ""} onChange={(e) => setBalanceEdits((p) => ({ ...p, [`inv_${acct.id}`]: e.target.value }))} onClick={(e) => e.stopPropagation()} className="h-6 w-28 text-right text-xs ml-auto" />
                                        </td>
                                      </tr>
                                    ))}
                                    {allNonLiquidAccounts.length > 0 && (
                                      <>
                                        <tr><td colSpan={2} className="pt-2 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Non-Liquid (Reference)</td></tr>
                                        {allNonLiquidAccounts.map((acct) => (
                                          <tr key={`nl_${acct.id}`} className="border-b border-gray-100">
                                            <td className="py-0.5 pr-2 text-gray-400">{acct.name}</td>
                                            <td className="py-0.5 text-right">
                                              <Input type="number" step="1" value={balanceEdits[`nl_${acct.id}`] || ""} onChange={(e) => setBalanceEdits((p) => ({ ...p, [`nl_${acct.id}`]: e.target.value }))} onClick={(e) => e.stopPropagation()} className="h-6 w-28 text-right text-xs ml-auto" />
                                            </td>
                                          </tr>
                                        ))}
                                      </>
                                    )}
                                  </tbody>
                                </table>
                              ) : (
                                <table className="w-full text-2xs">
                                  <tbody>
                                    {Object.entries(row.bankAccounts).map(([name, amt]) => (
                                      <tr key={name} className="border-b border-gray-100">
                                        <td className="py-1 pr-2 text-gray-500">{name}</td>
                                        <td className="py-1 text-right">{fmt(amt)}</td>
                                      </tr>
                                    ))}
                                    {Object.keys(row.investments).length > 0 && (
                                      <tr><td colSpan={2} className="pt-2 pb-0.5 text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Investments (Liquid)</td></tr>
                                    )}
                                    {Object.entries(row.investments).map(([name, amt]) => (
                                      <tr key={name} className="border-b border-gray-100">
                                        <td className="py-1 pr-2 text-blue-600">{name}</td>
                                        <td className="py-1 text-right text-blue-600">{fmt(amt)}</td>
                                      </tr>
                                    ))}
                                    {allNonLiquidAccounts.length > 0 && (
                                      <>
                                        <tr><td colSpan={2} className="pt-2 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Non-Liquid (Reference)</td></tr>
                                        {allNonLiquidAccounts.map((acct) => {
                                          const amt = row.nonLiquid[acct.name];
                                          return (
                                            <tr key={acct.id} className="border-b border-gray-100">
                                              <td className="py-1 pr-2 text-gray-400">{acct.name}</td>
                                              <td className="py-1 text-right text-gray-400">{amt !== undefined ? fmt(amt) : "-"}</td>
                                            </tr>
                                          );
                                        })}
                                      </>
                                    )}
                                    {Object.keys(row.bankAccounts).length === 0 && Object.keys(row.investments).length === 0 && (
                                      <tr><td colSpan={2} className="py-2 text-center text-gray-400">No balances. Click Edit to add.</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionModal state={modalState} onClose={() => closeModal()} categoryMap={categoryMap} />
    </div>
  );
}
