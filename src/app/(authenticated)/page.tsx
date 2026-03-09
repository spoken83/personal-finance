"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface DashboardData {
  months: string[];
  masterCategories: { id: number; name: string; isExcluded: boolean }[];
  monthlyBreakdown: Record<string, Record<string, number>>;
  monthlySpendBreakdown: Record<string, Record<string, number>>;
  categoryTotals: Record<string, number>;
  spendCategoryTotals: Record<string, number>;
  monthlyTotals: Record<string, number>;
  monthlySpending: Record<string, number>;
}

const CHART_COLORS: Record<string, string> = {
  Expense: "#ef4444",
  "Business Expense": "#8b5cf6",
  "Fixed Payment": "#f97316",
  Adhoc: "#ec4899",
  Investment: "#3b82f6",
  "Money In": "#22c55e",
};

// These are excluded from the "spending" chart (Rental is separate pot, others are non-spending)
const CHART_SPENDING_EXCLUDES = ["Money In", "Investment", "Rental"];

const SUB_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6",
  "#a855f7", "#64748b", "#d946ef", "#0ea5e9", "#84cc16",
];

type MonthFilter = "all" | "6" | "3" | "custom";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const { state: modalState, openModal, closeModal, categoryMap } = useTransactionModal();
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [viewMonth, setViewMonth] = useState<string>("");

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Default to second-to-last month (last complete month)
        if (d.months.length >= 2) {
          setViewMonth(d.months[d.months.length - 2]);
        } else if (d.months.length === 1) {
          setViewMonth(d.months[0]);
        }
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div className="text-gray-500 py-8 text-center">
        Loading dashboard...
      </div>
    );
  }

  function toggleCategory(name: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Get spend subcategories for a master category
  function getSpendCategories(masterName: string): string[] {
    const prefix = `${masterName}::`;
    const subs = new Set<string>();
    // Check all months for spend keys under this master
    for (const month of data!.months) {
      const monthData = data!.monthlySpendBreakdown[month] || {};
      for (const key of Object.keys(monthData)) {
        if (key.startsWith(prefix)) {
          subs.add(key.slice(prefix.length));
        }
      }
    }
    // Also check totals
    for (const key of Object.keys(data!.spendCategoryTotals)) {
      if (key.startsWith(prefix)) {
        subs.add(key.slice(prefix.length));
      }
    }
    // Sort by total amount (largest absolute value first)
    return [...subs].sort((a, b) => {
      const aTotal = Math.abs(data!.spendCategoryTotals[`${masterName}::${a}`] || 0);
      const bTotal = Math.abs(data!.spendCategoryTotals[`${masterName}::${b}`] || 0);
      return bTotal - aTotal;
    });
  }

  // Filter months based on selection
  const allMonths = data.months;
  const filteredMonths = (() => {
    if (monthFilter === "all") return allMonths;
    if (monthFilter === "3") return allMonths.slice(-3);
    if (monthFilter === "6") return allMonths.slice(-6);
    // custom
    return allMonths.filter(
      (m) => (!customFrom || m >= customFrom) && (!customTo || m <= customTo)
    );
  })();

  const nonExcludedCategories = data.masterCategories.filter(
    (mc) => !mc.isExcluded
  );
  const spendingCategories = nonExcludedCategories.filter(
    (mc) => !CHART_SPENDING_EXCLUDES.includes(mc.name)
  );

  // Insight cards: compute anomalies per master category
  const INSIGHT_CATEGORIES = ["Expense", "Business Expense", "Fixed Payment", "Adhoc"];
  const currentMonth = viewMonth || allMonths[allMonths.length - 1] || "";
  const currentMonthIdx = allMonths.indexOf(currentMonth);
  const prev3Months = currentMonthIdx >= 1
    ? allMonths.slice(Math.max(0, currentMonthIdx - 3), currentMonthIdx)
    : [];

  interface SubInsight {
    name: string;
    current: number;
    avg: number;
    pctChange: number;
    isSpike: boolean;
    isNew: boolean;
  }

  interface CategoryInsight {
    masterName: string;
    color: string;
    currentTotal: number;
    avgTotal: number;
    pctChange: number;
    topSpender: SubInsight | null;
    spikes: SubInsight[];
    allSubs: SubInsight[];
  }

  const insights: CategoryInsight[] = INSIGHT_CATEGORIES.map((masterName) => {
    const color = CHART_COLORS[masterName] || "#94a3b8";
    const rawCurrent = data.monthlyBreakdown[currentMonth]?.[masterName] || 0;
    const currentTotal = rawCurrent < 0 ? Math.abs(rawCurrent) : 0;
    const prevTotals = prev3Months.map((m) => {
      const raw = data.monthlyBreakdown[m]?.[masterName] || 0;
      return raw < 0 ? Math.abs(raw) : 0;
    });
    const avgTotal = prevTotals.length > 0 ? prevTotals.reduce((a, b) => a + b, 0) / prevTotals.length : 0;
    const pctChange = avgTotal > 0 ? (currentTotal - avgTotal) / avgTotal : 0;

    // Get subcategories for this master
    const prefix = `${masterName}::`;
    const subNames = new Set<string>();
    for (const key of Object.keys(data.monthlySpendBreakdown[currentMonth] || {})) {
      if (key.startsWith(prefix)) subNames.add(key.slice(prefix.length));
    }
    for (const m of prev3Months) {
      for (const key of Object.keys(data.monthlySpendBreakdown[m] || {})) {
        if (key.startsWith(prefix)) subNames.add(key.slice(prefix.length));
      }
    }

    const allSubs: SubInsight[] = [...subNames]
      .map((name) => {
        const spendKey = `${masterName}::${name}`;
        const rawCur = data.monthlySpendBreakdown[currentMonth]?.[spendKey] || 0;
        const current = rawCur < 0 ? Math.abs(rawCur) : 0;
        const prevAmts = prev3Months.map((m) => {
          const raw = data.monthlySpendBreakdown[m]?.[spendKey] || 0;
          return raw < 0 ? Math.abs(raw) : 0;
        });
        const avg = prevAmts.length > 0 ? prevAmts.reduce((a, b) => a + b, 0) / prevAmts.length : 0;
        const pct = avg > 0 ? (current - avg) / avg : 0;
        const isNew = current > 0 && avg === 0;
        const isSpike = (pct > 0.5 && current > 50) || isNew;
        return { name, current, avg, pctChange: pct, isSpike, isNew };
      })
      .filter((s) => s.current > 0)
      .sort((a, b) => b.current - a.current);

    const topSpender = allSubs.length > 0 ? allSubs[0] : null;
    const spikes = allSubs
      .filter((s) => s.isSpike)
      .sort((a, b) => b.pctChange - a.pctChange);

    return { masterName, color, currentTotal, avgTotal, pctChange, topSpender, spikes, allSubs };
  });

  // Determine if we're drilling into a single master category
  const expandedSpendingCats = spendingCategories.filter((mc) =>
    expandedCategories.has(mc.name)
  );
  const drillCategory =
    expandedSpendingCats.length === 1 ? expandedSpendingCats[0].name : null;
  const drillSubs = drillCategory ? getSpendCategories(drillCategory) : [];
  // For drill-down line chart: top 8 subcategories by total spend
  const drillTopSubs = drillSubs.slice(0, 8);

  // Overview chart data (stacked bar)
  const overviewChartData = filteredMonths.map((month) => {
    const entry: Record<string, string | number> = {
      month: new Date(month + "-01").toLocaleDateString("en-SG", {
        month: "short",
        year: "2-digit",
      }),
    };
    let total = 0;
    for (const mc of spendingCategories) {
      const raw = data.monthlyBreakdown[month]?.[mc.name] || 0;
      const val = raw < 0 ? Math.abs(raw) : 0; // Only count actual spending (negative), ignore credits
      entry[mc.name] = val;
      total += val;
    }
    entry._total = total;
    return entry;
  });

  // Drill-down chart data (line chart for subcategories)
  const drillChartData = drillCategory
    ? filteredMonths.map((month) => {
        const entry: Record<string, string | number> = {
          month: new Date(month + "-01").toLocaleDateString("en-SG", {
            month: "short",
            year: "2-digit",
          }),
        };
        for (const sub of drillTopSubs) {
          const raw = data.monthlySpendBreakdown[month]?.[`${drillCategory}::${sub}`] || 0;
          entry[sub] = raw < 0 ? Math.abs(raw) : 0; // Only count actual spending, ignore credits
        }
        return entry;
      })
    : [];

  const chartTitle = drillCategory
    ? `${drillCategory} — Spending Trends`
    : "Monthly Spending by Category";
  const chartSubtitle = drillCategory
    ? `Top ${drillTopSubs.length} subcategories · Collapse in table to return to overview`
    : "Excludes Rental (budgeted separately)";

  function formatMonth(month: string) {
    return new Date(month + "-01").toLocaleDateString("en-SG", {
      month: "short",
      year: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financial Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Viewing:</span>
          <select
            value={currentMonth}
            onChange={(e) => setViewMonth(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm font-medium"
          >
            {[...allMonths].reverse().map((m) => (
              <option key={m} value={m}>
                {new Date(m + "-01").toLocaleDateString("en-SG", {
                  month: "long",
                  year: "numeric",
                })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {insights.map((ins) => {
          const isAdhoc = ins.masterName === "Adhoc";
          const hasData = ins.currentTotal > 0;
          const trendUp = ins.pctChange > 0.05;
          const trendDown = ins.pctChange < -0.05;

          return (
            <Card key={ins.masterName} className="relative overflow-hidden">
              <div
                className="absolute top-0 left-0 w-1 h-full"
                style={{ backgroundColor: ins.color }}
              />
              <CardHeader className="pb-2 pl-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    {ins.masterName}
                  </CardTitle>
                  <span className="text-xs text-gray-400">
                    {formatMonth(currentMonth)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold" style={{ color: ins.color }}>
                    {hasData ? formatCurrency(-ins.currentTotal) : "$0"}
                  </p>
                  {hasData && ins.avgTotal > 0 && (
                    <span
                      className={`flex items-center gap-0.5 text-xs font-medium ${
                        trendUp
                          ? "text-red-500"
                          : trendDown
                            ? "text-green-500"
                            : "text-gray-400"
                      }`}
                    >
                      {trendUp ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : trendDown ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      {Math.abs(ins.pctChange * 100).toFixed(0)}%
                      <span className="text-gray-400 font-normal ml-0.5">
                        vs avg
                      </span>
                    </span>
                  )}
                </div>
                {ins.avgTotal > 0 && (
                  <p className="text-xs text-gray-400">
                    3-mo avg: {formatCurrency(-ins.avgTotal)}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pl-5 pt-0">
                {!hasData ? (
                  <p className="text-xs text-gray-400">No spending this month</p>
                ) : isAdhoc ? (
                  /* Adhoc: just list all items */
                  <div className="space-y-1">
                    {ins.allSubs.map((sub) => (
                      <div
                        key={sub.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <button
                          className="text-blue-600 hover:underline text-left truncate mr-2"
                          onClick={() =>
                            openModal({
                              month: currentMonth,
                              masterCategory: ins.masterName,
                              spendCategory: sub.name,
                              title: sub.name,
                            })
                          }
                        >
                          {sub.name}
                        </button>
                        <span className="font-mono text-gray-700 whitespace-nowrap">
                          {formatCurrency(-sub.current)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Expense / Business / Fixed: show top + spikes */
                  <div className="space-y-1.5">
                    {ins.topSpender && (
                      <div className="text-xs text-gray-500">
                        Top:{" "}
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() =>
                            openModal({
                              month: currentMonth,
                              masterCategory: ins.masterName,
                              spendCategory: ins.topSpender!.name,
                              title: ins.topSpender!.name,
                            })
                          }
                        >
                          {ins.topSpender.name}
                        </button>{" "}
                        <span className="font-mono">
                          {formatCurrency(-ins.topSpender.current)}
                        </span>
                      </div>
                    )}
                    {ins.spikes.length > 0 ? (
                      <div className="space-y-1 mt-1">
                        {ins.spikes.slice(0, 3).map((spike) => (
                          <div
                            key={spike.name}
                            className="flex items-start gap-1 text-xs"
                          >
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <button
                                className="text-blue-600 hover:underline truncate"
                                onClick={() =>
                                  openModal({
                                    month: currentMonth,
                                    masterCategory: ins.masterName,
                                    spendCategory: spike.name,
                                    title: spike.name,
                                  })
                                }
                              >
                                {spike.name}
                              </button>{" "}
                              <span className="font-mono text-gray-700">
                                {formatCurrency(-spike.current)}
                              </span>
                              <span className="text-red-500 ml-1">
                                {spike.isNew
                                  ? "new"
                                  : `+${(spike.pctChange * 100).toFixed(0)}%`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : hasData ? (
                      <p className="text-xs text-green-600">
                        All subcategories within normal range
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monthly Spending Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{chartTitle}</CardTitle>
          <p className="text-xs text-gray-400">{chartSubtitle}</p>
        </CardHeader>
        <CardContent>
          {drillCategory ? (
            /* Drill-down: Line chart for subcategory trends */
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={drillChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                />
                <Tooltip
                  itemSorter={(item) => -(Number(item.value) || 0)}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                    return (
                      <div className="bg-white border rounded shadow-lg p-3 text-sm">
                        <p className="font-medium mb-1">{label}</p>
                        {[...payload]
                          .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
                          .map((p) => (
                            <div key={p.dataKey as string} className="flex justify-between gap-4">
                              <span style={{ color: p.color }}>{p.dataKey as string}</span>
                              <span className="font-mono">{formatCurrency(Number(p.value))}</span>
                            </div>
                          ))}
                        <div className="flex justify-between gap-4 border-t mt-1 pt-1 font-bold">
                          <span>Total</span>
                          <span className="font-mono">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                {drillTopSubs.map((sub, i) => (
                  <Line
                    key={sub}
                    type="monotone"
                    dataKey={sub}
                    stroke={SUB_COLORS[i % SUB_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            /* Overview: Stacked bar chart */
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={overviewChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const items = payload.filter((p) => p.dataKey !== "_total");
                    const total = items.reduce((s, p) => s + (Number(p.value) || 0), 0);
                    return (
                      <div className="bg-white border rounded shadow-lg p-3 text-sm">
                        <p className="font-medium mb-1">{label}</p>
                        {items
                          .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
                          .map((p) => (
                            <div key={p.dataKey as string} className="flex justify-between gap-4">
                              <span style={{ color: p.color }}>{p.dataKey as string}</span>
                              <span className="font-mono">{formatCurrency(Number(p.value))}</span>
                            </div>
                          ))}
                        <div className="flex justify-between gap-4 border-t mt-1 pt-1 font-bold">
                          <span>Total</span>
                          <span className="font-mono">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                {spendingCategories.map((mc) => (
                  <Bar
                    key={mc.name}
                    dataKey={mc.name}
                    stackId="spending"
                    fill={CHART_COLORS[mc.name] || "#94a3b8"}
                  />
                ))}
                {/* Invisible bar just for total labels on top */}
                <Bar
                  dataKey="_total"
                  stackId="total"
                  fill="transparent"
                  legendType="none"
                >
                  <LabelList
                    dataKey="_total"
                    position="top"
                    formatter={(v: unknown) => {
                      const n = Number(v);
                      return n >= 1000
                        ? `$${(n / 1000).toFixed(1)}k`
                        : `$${n.toFixed(0)}`;
                    }}
                    style={{ fontSize: 11, fill: "#6b7280" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table (Pivot) — expandable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Monthly Breakdown</CardTitle>
              <p className="text-xs text-gray-400 mt-1">
                Click a category to expand · Click a number to see transactions
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(["all", "6", "3", "custom"] as MonthFilter[]).map((f) => (
                <Button
                  key={f}
                  variant={monthFilter === f ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setMonthFilter(f)}
                >
                  {f === "all" ? "All" : f === "custom" ? "Custom" : `${f}M`}
                </Button>
              ))}
            </div>
          </div>
          {monthFilter === "custom" && (
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="month"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 text-xs w-40"
                placeholder="From"
              />
              <span className="text-gray-400 text-xs">to</span>
              <Input
                type="month"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 text-xs w-40"
                placeholder="To"
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-white min-w-[180px]">
                  Category
                </TableHead>
                {filteredMonths.map((month) => (
                  <TableHead
                    key={month}
                    className="text-right min-w-[90px] whitespace-nowrap"
                  >
                    {formatMonth(month)}
                  </TableHead>
                ))}
                <TableHead className="text-right font-bold min-w-[100px]">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nonExcludedCategories.map((mc) => {
                const isExpanded = expandedCategories.has(mc.name);
                const spendSubs = isExpanded
                  ? getSpendCategories(mc.name)
                  : [];
                const mcTotal = filteredMonths.reduce(
                  (sum, m) => sum + (data.monthlyBreakdown[m]?.[mc.name] || 0),
                  0
                );

                return (
                  <>
                    {/* Master category row */}
                    <TableRow
                      key={mc.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleCategory(mc.name)}
                    >
                      <TableCell className="sticky left-0 bg-inherit font-medium">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                          )}
                          {mc.name}
                        </div>
                      </TableCell>
                      {filteredMonths.map((month) => {
                        const val =
                          data.monthlyBreakdown[month]?.[mc.name] || 0;
                        return (
                          <TableCell
                            key={month}
                            className={`text-right font-mono whitespace-nowrap cursor-pointer hover:underline ${
                              val >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (val !== 0)
                                openModal({
                                  month,
                                  masterCategory: mc.name,
                                  title: mc.name,
                                });
                            }}
                          >
                            {val !== 0 ? formatCurrency(val) : "-"}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className={`text-right font-mono font-bold whitespace-nowrap ${
                          mcTotal >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(mcTotal)}
                      </TableCell>
                    </TableRow>

                    {/* Spend subcategory rows */}
                    {isExpanded &&
                      spendSubs.map((spendName) => {
                        const spendKey = `${mc.name}::${spendName}`;
                        const spendTotal = filteredMonths.reduce(
                          (sum, m) =>
                            sum + (data.monthlySpendBreakdown[m]?.[spendKey] || 0),
                          0
                        );
                        return (
                          <TableRow
                            key={spendKey}
                            className="bg-gray-50/50"
                          >
                            <TableCell className="sticky left-0 bg-inherit pl-10 text-gray-500">
                              {spendName}
                            </TableCell>
                            {filteredMonths.map((month) => {
                              const val =
                                data.monthlySpendBreakdown[month]?.[
                                  spendKey
                                ] || 0;
                              return (
                                <TableCell
                                  key={month}
                                  className={`text-right font-mono whitespace-nowrap ${
                                    val === 0
                                      ? "text-gray-300"
                                      : val >= 0
                                        ? "text-green-500 cursor-pointer hover:underline"
                                        : "text-red-500 cursor-pointer hover:underline"
                                  }`}
                                  onClick={() => {
                                    if (val !== 0)
                                      openModal({
                                        month,
                                        masterCategory: mc.name,
                                        spendCategory: spendName,
                                        title: spendName,
                                      });
                                  }}
                                >
                                  {val !== 0 ? formatCurrency(val) : "-"}
                                </TableCell>
                              );
                            })}
                            <TableCell
                              className={`text-right font-mono whitespace-nowrap ${
                                spendTotal >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(spendTotal)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </>
                );
              })}
              {(() => {
                const filteredNet = filteredMonths.reduce(
                  (sum, m) => sum + (data.monthlyTotals[m] || 0),
                  0
                );
                return (
                  <TableRow className="border-t-2">
                    <TableCell className="sticky left-0 bg-white font-bold">
                      Net Total
                    </TableCell>
                    {filteredMonths.map((month) => {
                      const val = data.monthlyTotals[month] || 0;
                      return (
                        <TableCell
                          key={month}
                          className={`text-right font-mono font-bold whitespace-nowrap ${
                            val >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(val)}
                        </TableCell>
                      );
                    })}
                    <TableCell
                      className={`text-right font-mono font-bold whitespace-nowrap ${
                        filteredNet >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(filteredNet)}
                    </TableCell>
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionModal state={modalState} onClose={() => closeModal()} categoryMap={categoryMap} />
    </div>
  );
}
