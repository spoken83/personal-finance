"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { ChevronLeft, ChevronRight, Search, X, Scissors, Undo2 } from "lucide-react";
import { InlineCategoryEditor, RulePrompt } from "@/components/transactions/category-editor";
import { SearchableCategoryPicker } from "@/components/transactions/category-picker";
import { AmortizeDialog } from "@/components/transactions/amortize-dialog";

interface Transaction {
  id: number;
  date: string;
  description: string;
  accountingAmt: string;
  amountFcy: string | null;
  fcyCurrency: string | null;
  bankAccount: { source: string; accountName: string };
  spendCategory: { id: number; name: string };
  masterCategory: { id: number; name: string; isExcluded: boolean };
  parentTransactionId: number | null;
  isAmortized: boolean;
}

interface CategoryData {
  masterCategories: { id: number; name: string }[];
  spendCategories: {
    id: number;
    name: string;
    masterCategory: { id: number; name: string };
  }[];
  bankAccounts: { id: number; source: string; accountName: string }[];
}

function getAvailableMonths(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  // Go back 24 months
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-SG", {
      month: "short",
      year: "2-digit",
    });
    months.push({ value, label });
  }
  return months;
}

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [bankAccountId, setBankAccountId] = useState(
    searchParams.get("bankAccountId") || ""
  );
  const [masterCategoryId, setMasterCategoryId] = useState(
    searchParams.get("masterCategoryId") || ""
  );
  const [spendCategoryId, setSpendCategoryId] = useState(
    searchParams.get("spendCategoryId") || ""
  );
  const [selectedMonth, setSelectedMonth] = useState(
    searchParams.get("month") || ""
  );
  const [categories, setCategories] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rulePrompt, setRulePrompt] = useState<{
    id: number;
    description: string;
    spendCategoryId: number;
    spendCategoryName: string;
    masterCategoryId: number;
    masterCategoryName: string;
  } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [amortizeTx, setAmortizeTx] = useState<Transaction | null>(null);

  const availableMonths = getAvailableMonths();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: "50" });
    if (search) params.set("search", search);
    if (bankAccountId) params.set("bankAccountId", bankAccountId);
    if (masterCategoryId) params.set("masterCategoryId", masterCategoryId);
    if (spendCategoryId) params.set("spendCategoryId", spendCategoryId);

    if (selectedMonth) {
      const [y, m] = selectedMonth.split("-");
      params.set("dateFrom", `${y}-${m}-01`);
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      params.set("dateTo", `${y}-${m}-${lastDay}`);
    }

    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, search, bankAccountId, masterCategoryId, spendCategoryId, selectedMonth]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    fetchTransactions();
  }, [fetchTransactions]);

  // Sync URL params for deep-linking from health check
  useEffect(() => {
    const month = searchParams.get("month");
    const master = searchParams.get("masterCategoryId");
    const spend = searchParams.get("spendCategoryId");
    if (month) setSelectedMonth(month);
    if (master) setMasterCategoryId(master);
    if (spend) setSpendCategoryId(spend);
  }, [searchParams]);

  // Filter spend categories by selected master category
  const filteredSpendCategories = masterCategoryId
    ? categories?.spendCategories.filter(
        (sc) => sc.masterCategory.id === parseInt(masterCategoryId)
      )
    : categories?.spendCategories;

  function clearFilters() {
    setSearch("");
    setBankAccountId("");
    setMasterCategoryId("");
    setSpendCategoryId("");
    setSelectedMonth("");
    setPage(1);
    router.replace("/transactions");
  }

  const hasFilters =
    search || bankAccountId || masterCategoryId || spendCategoryId || selectedMonth;

  // Sum of visible transactions
  const pageTotal = transactions.reduce(
    (sum, tx) => sum + parseFloat(tx.accountingAmt),
    0
  );

  function handleCategorySaved(updated: {
    id: number;
    spendCategoryId: number;
    spendCategoryName: string;
    masterCategoryId: number;
    masterCategoryName: string;
  }) {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === updated.id
          ? {
              ...tx,
              spendCategory: { id: updated.spendCategoryId, name: updated.spendCategoryName },
              masterCategory: {
                ...tx.masterCategory,
                id: updated.masterCategoryId,
                name: updated.masterCategoryName,
              },
            }
          : tx
      )
    );
    const tx = transactions.find((t) => t.id === updated.id);
    if (tx) {
      setRulePrompt({
        ...updated,
        description: tx.description,
      });
    }
  }

  async function toggleAmountSign(txId: number) {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;
    const newAmt = (parseFloat(tx.accountingAmt) * -1).toString();
    const newFcy = tx.amountFcy
      ? (parseFloat(tx.amountFcy) * -1).toString()
      : null;

    // Optimistic update
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId
          ? { ...t, accountingAmt: newAmt, amountFcy: newFcy }
          : t
      )
    );

    await fetch(`/api/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountingAmt: parseFloat(newAmt),
        ...(newFcy !== null ? { amountFcy: parseFloat(newFcy) } : {}),
      }),
    });
  }

  async function undoAmortization(parentId: number) {
    await fetch(`/api/transactions/${parentId}/amortize`, { method: "DELETE" });
    fetchTransactions();
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)));
    }
  }

  async function handleBulkCategoryChange(spendCategoryId: number) {
    const sc = categories?.spendCategories.find((c) => c.id === spendCategoryId);
    if (!sc || selectedIds.size === 0) return;

    setBulkUpdating(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selectedIds],
          spendCategoryId: sc.id,
          masterCategoryId: sc.masterCategory.id,
        }),
      });

      if (res.ok) {
        // Update local state
        setTransactions((prev) =>
          prev.map((tx) =>
            selectedIds.has(tx.id)
              ? {
                  ...tx,
                  spendCategory: { id: sc.id, name: sc.name },
                  masterCategory: {
                    ...tx.masterCategory,
                    id: sc.masterCategory.id,
                    name: sc.masterCategory.name,
                  },
                }
              : tx
          )
        );
        setSelectedIds(new Set());
      }
    } finally {
      setBulkUpdating(false);
    }
  }

  function handleCategoryCreated(newCat: {
    id: number;
    name: string;
    masterCategory: { id: number; name: string };
  }) {
    setCategories((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        spendCategories: [...prev.spendCategories, newCat],
      };
    });
  }

  function getMasterCategoryColor(name: string): string {
    const colors: Record<string, string> = {
      Expense: "bg-red-100 text-red-800",
      "Business Expense": "bg-purple-100 text-purple-800",
      "Fixed Payment": "bg-orange-100 text-orange-800",
      Rental: "bg-yellow-100 text-yellow-800",
      Adhoc: "bg-pink-100 text-pink-800",
      Investment: "bg-blue-100 text-blue-800",
      "Money In": "bg-green-100 text-green-800",
      "Repayment(exclude)": "bg-gray-100 text-gray-600",
      "Internal Trf(exclude)": "bg-gray-100 text-gray-600",
      "Final loan Payment(exclude)": "bg-gray-100 text-gray-600",
    };
    return colors[name] || "bg-gray-100 text-gray-800";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-gray-500">{total} transactions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-4">
        {/* Month picker */}
        <Select
          value={selectedMonth || "all"}
          onValueChange={(v) => {
            setSelectedMonth(v === "all" ? "" : v ?? "");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <span className="truncate">
              {selectedMonth
                ? availableMonths.find((m) => m.value === selectedMonth)?.label || selectedMonth
                : "All Months"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {availableMonths.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        {/* Bank account */}
        <Select
          value={bankAccountId || "all"}
          onValueChange={(v) => {
            setBankAccountId(v === "all" ? "" : v ?? "");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <span className="truncate">
              {bankAccountId
                ? categories?.bankAccounts.find((ba) => ba.id.toString() === bankAccountId)?.accountName || bankAccountId
                : "All Accounts"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {categories?.bankAccounts.map((ba) => (
              <SelectItem key={ba.id} value={ba.id.toString()}>
                {ba.accountName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Master category */}
        <Select
          value={masterCategoryId || "all"}
          onValueChange={(v) => {
            setMasterCategoryId(v === "all" ? "" : v ?? "");
            setSpendCategoryId(""); // reset spend when master changes
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <span className="truncate">
              {masterCategoryId
                ? categories?.masterCategories.find((mc) => mc.id.toString() === masterCategoryId)?.name || masterCategoryId
                : "All Master Categories"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Master Categories</SelectItem>
            {categories?.masterCategories.map((mc) => (
              <SelectItem key={mc.id} value={mc.id.toString()}>
                {mc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Spend category */}
        <Select
          value={spendCategoryId || "all"}
          onValueChange={(v) => {
            setSpendCategoryId(v === "all" ? "" : v ?? "");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <span className="truncate">
              {spendCategoryId
                ? filteredSpendCategories?.find((sc) => sc.id.toString() === spendCategoryId)?.name || spendCategoryId
                : "All Spend Categories"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Spend Categories</SelectItem>
            {filteredSpendCategories?.map((sc) => (
              <SelectItem key={sc.id} value={sc.id.toString()}>
                {sc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Rule creation prompt */}
      {rulePrompt && (
        <div className="sticky top-0 z-20 shadow-sm">
          <RulePrompt
            description={rulePrompt.description}
            spendCategoryId={rulePrompt.spendCategoryId}
            spendCategoryName={rulePrompt.spendCategoryName}
            masterCategoryId={rulePrompt.masterCategoryId}
            masterCategoryName={rulePrompt.masterCategoryName}
            onCreated={() => setRulePrompt(null)}
            onDismiss={() => setRulePrompt(null)}
          />
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && categories && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} selected
          </span>
          <span className="text-sm text-blue-600">Change category to:</span>
          <SearchableCategoryPicker
            value={0}
            label="Pick category..."
            categoryMap={categories}
            onSelect={handleBulkCategoryChange}
            onCategoryCreated={handleCategoryCreated}
            disabled={bulkUpdating}
            className="h-8 text-xs bg-white"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-blue-600"
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px] px-3">
                <input
                  type="checkbox"
                  checked={transactions.length > 0 && selectedIds.size === transactions.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                />
              </TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[140px]">Account</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead className="w-[160px]">Master Category</TableHead>
              <TableHead className="w-[150px] text-right">Amount (SGD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              <>
                {transactions.map((tx) => {
                  const amt = parseFloat(tx.accountingAmt);
                  return (
                    <TableRow
                      key={tx.id}
                      className={selectedIds.has(tx.id) ? "bg-blue-50/50" : ""}
                    >
                      <TableCell className="px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => toggleSelect(tx.id)}
                          className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{tx.description}</div>
                        {tx.amountFcy && tx.fcyCurrency && (
                          <div className="text-xs text-gray-400">
                            {tx.fcyCurrency} {parseFloat(tx.amountFcy).toFixed(2)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {tx.bankAccount.accountName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {categories ? (
                          <InlineCategoryEditor
                            transactionId={tx.id}
                            currentSpendCategoryId={tx.spendCategory.id}
                            currentSpendCategoryName={tx.spendCategory.name}
                            categoryMap={categories}
                            onSaved={handleCategorySaved}
                            onCategoryCreated={handleCategoryCreated}
                          />
                        ) : (
                          tx.spendCategory.name
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getMasterCategoryColor(
                            tx.masterCategory.name
                          )}
                        >
                          {tx.masterCategory.name}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${
                          amt >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleAmountSign(tx.id)}
                            className="hover:underline cursor-pointer"
                            title="Click to flip sign (credit ↔ debit)"
                          >
                            {formatCurrency(amt)}
                          </button>
                          {tx.parentTransactionId ? (
                            <button
                              onClick={() => undoAmortization(tx.parentTransactionId!)}
                              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-orange-600"
                              title="Undo split (restore original transaction)"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setAmortizeTx(tx)}
                              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                              title="Split / amortize across months"
                            >
                              <Scissors className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Page total row */}
                <TableRow className="border-t-2 bg-gray-50">
                  <TableCell colSpan={6} className="text-sm font-medium text-gray-600">
                    Page Total ({transactions.length} transactions)
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-sm font-bold ${
                      pageTotal >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(pageTotal)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Amortize dialog */}
      <AmortizeDialog
        open={!!amortizeTx}
        onOpenChange={(open) => { if (!open) setAmortizeTx(null); }}
        transaction={amortizeTx}
        onAmortized={fetchTransactions}
      />
    </div>
  );
}
