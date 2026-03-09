"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

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
  investments: Record<string, number>;
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

// Categories excluded from the spending breakdown (they have their own columns or are non-spending)
const SPENDING_EXCLUDES = [
  "Money In",
  "Investment",
  "Repayment(exclude)",
  "Internal Trf(exclude)",
  "Rental",
];

export default function BudgetPage() {
  const router = useRouter();
  const [healthCheck, setHealthCheck] = useState<HealthCheckMonth[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const { state: modalState, openModal, closeModal, categoryMap } = useTransactionModal();

  useEffect(() => {
    fetch("/api/dashboard/health-check")
      .then((r) => r.json())
      .then((data) => {
        setHealthCheck(data.monthlyHealthCheck);
        setSummary(data.summary);
        setLoading(false);
      });
  }, []);

  function formatMonth(month: string) {
    return new Date(month + "-01").toLocaleDateString("en-SG", {
      month: "short",
      year: "2-digit",
    });
  }

  if (loading || !summary) {
    return <div className="text-gray-500 py-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Budget & Runway</h1>

      {/* Runway Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Starting Proceeds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.startingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Avg Monthly Burn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.avgMonthlyBurn)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Avg Monthly Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.avgMonthlyMoneyIn)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Runway (Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                summary.monthsRemaining > 24
                  ? "text-green-600"
                  : summary.monthsRemaining > 12
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {summary.monthsRemaining === Infinity
                ? "∞"
                : `${summary.monthsRemaining} months`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Health Check Table */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Health Check</CardTitle>
          <p className="text-xs text-gray-400">
            Click a row to expand the category breakdown. Click a category to
            see its transactions.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-white w-[36px] px-2"></TableHead>
                <TableHead className="sticky left-[36px] bg-white w-[70px] px-2">
                  Month
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Spending
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Rental
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Money In
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Net Flow
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Expected Bal
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Actual (Bank)
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Actual (Inv)
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Actual Total
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Variance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {healthCheck.map((row) => {
                const isExpanded = expandedMonth === row.month;

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

                return (
                  <>
                    <TableRow
                      key={row.month}
                      className={`cursor-pointer hover:bg-gray-50 ${isExpanded ? "bg-blue-50" : ""}`}
                      onClick={() =>
                        setExpandedMonth(isExpanded ? null : row.month)
                      }
                    >
                      <TableCell className="sticky left-0 bg-inherit w-[36px] px-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell className="sticky left-[36px] bg-inherit font-medium w-[70px] px-2 whitespace-nowrap">
                        {formatMonth(row.month)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600 whitespace-nowrap">
                        {formatCurrency(-row.spending)}
                      </TableCell>
                      <TableCell
                        className="text-right font-mono text-orange-600 whitespace-nowrap cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (row.rental > 0)
                            openModal({
                              month: row.month,
                              masterCategory: "Rental",
                              title: "Rental",
                            });
                        }}
                      >
                        {row.rental > 0 ? formatCurrency(-row.rental) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600 whitespace-nowrap">
                        {row.moneyIn > 0 ? formatCurrency(row.moneyIn) : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono whitespace-nowrap ${
                          row.netFlow >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatCurrency(row.netFlow)}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {formatCurrency(row.expectedBalance)}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {row.actualBankBalance !== null
                          ? formatCurrency(row.actualBankBalance)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {row.actualInvestmentBalance !== null
                          ? formatCurrency(row.actualInvestmentBalance)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold whitespace-nowrap">
                        {row.actualTotal !== null
                          ? formatCurrency(row.actualTotal)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {row.variance !== null
                          ? `${(row.variance * 100).toFixed(1)}%`
                          : "-"}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${row.month}-detail`}>
                        <TableCell colSpan={11} className="bg-gray-50 p-0">
                          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-700">
                                  Spending Breakdown
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(
                                      `/transactions?month=${row.month}`
                                    );
                                  }}
                                >
                                  <ExternalLink className="mr-1 h-3 w-3" />
                                  View All Transactions
                                </Button>
                              </div>
                              <table className="w-full text-sm">
                                <tbody>
                                  {spendingBreakdown.map((item) => (
                                    <tr
                                      key={item.category}
                                      className="cursor-pointer border-b border-gray-100 hover:bg-blue-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openModal({
                                          month: row.month,
                                          masterCategory: item.category,
                                          title: item.category,
                                        });
                                      }}
                                    >
                                      <td className="py-1.5 pr-4 text-blue-700 underline decoration-blue-300">
                                        {item.category}
                                      </td>
                                      <td
                                        className={`py-1.5 text-right font-mono ${
                                          item.amount >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {formatCurrency(item.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="border-t-2 font-bold">
                                    <td className="py-1.5 text-gray-900">
                                      Total Spending
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-red-600">
                                      {formatCurrency(-row.spending)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <div>
                              {otherBreakdown.length > 0 && (
                                <>
                                  <h4 className="mb-2 text-sm font-semibold text-gray-700">
                                    Other Categories
                                  </h4>
                                  <table className="mb-4 w-full text-sm">
                                    <tbody>
                                      {otherBreakdown.map((item) => (
                                        <tr
                                          key={item.category}
                                          className="cursor-pointer border-b border-gray-100 hover:bg-blue-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openModal({
                                              month: row.month,
                                              masterCategory: item.category,
                                              title: item.category,
                                            });
                                          }}
                                        >
                                          <td className="py-1.5 pr-4 text-blue-700 underline decoration-blue-300">
                                            {item.category}
                                          </td>
                                          <td
                                            className={`py-1.5 text-right font-mono ${
                                              item.amount >= 0
                                                ? "text-green-600"
                                                : "text-gray-500"
                                            }`}
                                          >
                                            {formatCurrency(item.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </>
                              )}

                              {(row.actualBankBalance !== null ||
                                row.actualInvestmentBalance !== null) && (
                                <>
                                  <h4 className="mb-2 text-sm font-semibold text-gray-700">
                                    Actual Balance Details
                                  </h4>
                                  <table className="w-full text-sm">
                                    <tbody>
                                      {Object.entries(row.bankAccounts).map(
                                        ([name, amt]) => (
                                          <tr
                                            key={name}
                                            className="border-b border-gray-100"
                                          >
                                            <td className="py-1.5 pr-4 text-gray-500">
                                              {name}
                                            </td>
                                            <td className="py-1.5 text-right font-mono">
                                              {formatCurrency(amt)}
                                            </td>
                                          </tr>
                                        )
                                      )}
                                      {Object.entries(row.investments).map(
                                        ([name, amt]) => (
                                          <tr
                                            key={name}
                                            className="border-b border-gray-100"
                                          >
                                            <td className="py-1.5 pr-4 text-blue-600">
                                              {name}
                                            </td>
                                            <td className="py-1.5 text-right font-mono text-blue-600">
                                              {formatCurrency(amt)}
                                            </td>
                                          </tr>
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
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
