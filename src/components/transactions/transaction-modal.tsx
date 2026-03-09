"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { InlineCategoryEditor, RulePrompt } from "./category-editor";

export interface ModalTransaction {
  id: number;
  date: string;
  description: string;
  accountingAmt: string;
  amountFcy: string | null;
  fcyCurrency: string | null;
  bankAccount: { source: string; accountName: string };
  spendCategory: { id: number; name: string };
  masterCategory: { id: number; name: string };
}

interface CategoryMap {
  masterCategories: { id: number; name: string }[];
  spendCategories: { id: number; name: string; masterCategory: { id: number; name: string } }[];
}

interface TransactionModalState {
  open: boolean;
  month: string;
  title: string;
  transactions: ModalTransaction[];
  loading: boolean;
}

export function useTransactionModal() {
  const [state, setState] = useState<TransactionModalState>({
    open: false,
    month: "",
    title: "",
    transactions: [],
    loading: false,
  });
  const [categoryMap, setCategoryMap] = useState<CategoryMap | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategoryMap);
  }, []);

  const openModal = useCallback(
    async (opts: {
      month: string;
      masterCategory?: string;
      spendCategory?: string;
      title?: string;
    }) => {
      const { month, masterCategory, spendCategory } = opts;
      const displayTitle =
        opts.title ||
        [spendCategory, masterCategory].filter(Boolean).join(" — ") ||
        "Transactions";

      setState({
        open: true,
        month,
        title: displayTitle,
        transactions: [],
        loading: true,
      });

      const [y, m] = month.split("-");
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      const params = new URLSearchParams({
        page: "1",
        limit: "200",
        dateFrom: `${y}-${m}-01`,
        dateTo: `${y}-${m}-${lastDay}`,
      });

      if (masterCategory && categoryMap) {
        const mc = categoryMap.masterCategories.find(
          (c) => c.name === masterCategory
        );
        if (mc) params.set("masterCategoryId", mc.id.toString());
      }

      if (spendCategory && categoryMap) {
        const sc = categoryMap.spendCategories.find(
          (c) => c.name === spendCategory
        );
        if (sc) params.set("spendCategoryId", sc.id.toString());
      }

      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();

      setState((prev) => ({
        ...prev,
        transactions: data.transactions,
        loading: false,
      }));
    },
    [categoryMap]
  );

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return { state, openModal, closeModal, categoryMap };
}

function formatMonth(month: string) {
  return new Date(month + "-01").toLocaleDateString("en-SG", {
    month: "short",
    year: "2-digit",
  });
}

interface EditedTransaction {
  id: number;
  description: string;
  spendCategoryId: number;
  spendCategoryName: string;
  masterCategoryId: number;
  masterCategoryName: string;
}

export function TransactionModal({
  state,
  onClose,
  categoryMap,
  onTransactionUpdated,
}: {
  state: TransactionModalState;
  onClose: (open: boolean) => void;
  categoryMap?: CategoryMap | null;
  onTransactionUpdated?: () => void;
}) {
  const [transactions, setTransactions] = useState<ModalTransaction[]>([]);
  const [rulePrompt, setRulePrompt] = useState<EditedTransaction | null>(null);
  const [localCategoryMap, setLocalCategoryMap] = useState<CategoryMap | null>(categoryMap ?? null);

  // Sync from prop
  useEffect(() => {
    if (categoryMap) setLocalCategoryMap(categoryMap);
  }, [categoryMap]);

  // Sync transactions from state
  useEffect(() => {
    setTransactions(state.transactions);
    setRulePrompt(null);
  }, [state.transactions]);

  const total = transactions.reduce(
    (sum, tx) => sum + parseFloat(tx.accountingAmt),
    0
  );

  function handleCategoryCreated(newCat: {
    id: number;
    name: string;
    masterCategory: { id: number; name: string };
  }) {
    setLocalCategoryMap((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        spendCategories: [...prev.spendCategories, newCat],
      };
    });
  }

  function handleCategorySaved(updated: {
    id: number;
    spendCategoryId: number;
    spendCategoryName: string;
    masterCategoryId: number;
    masterCategoryName: string;
  }) {
    // Update transaction in local state
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === updated.id
          ? {
              ...tx,
              spendCategory: { id: updated.spendCategoryId, name: updated.spendCategoryName },
              masterCategory: { id: updated.masterCategoryId, name: updated.masterCategoryName },
            }
          : tx
      )
    );
    // Find the transaction to get its description for the rule prompt
    const tx = transactions.find((t) => t.id === updated.id);
    if (tx) {
      setRulePrompt({
        id: updated.id,
        description: tx.description,
        spendCategoryId: updated.spendCategoryId,
        spendCategoryName: updated.spendCategoryName,
        masterCategoryId: updated.masterCategoryId,
        masterCategoryName: updated.masterCategoryName,
      });
    }
    onTransactionUpdated?.();
  }

  return (
    <Dialog open={state.open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {state.title} — {state.month && formatMonth(state.month)}
          </DialogTitle>
          <DialogDescription>
            {transactions.length} transactions
            {!state.loading && transactions.length > 0 && (
              <>
                {" "}· Total:{" "}
                <span className="font-mono font-medium">
                  {formatCurrency(total)}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {rulePrompt && (
          <RulePrompt
            description={rulePrompt.description}
            spendCategoryId={rulePrompt.spendCategoryId}
            spendCategoryName={rulePrompt.spendCategoryName}
            masterCategoryId={rulePrompt.masterCategoryId}
            masterCategoryName={rulePrompt.masterCategoryName}
            onCreated={() => setRulePrompt(null)}
            onDismiss={() => setRulePrompt(null)}
          />
        )}
        <div className="overflow-y-auto flex-1 -mx-4 px-4">
          {state.loading ? (
            <p className="text-center text-gray-500 py-8">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No transactions found
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b">
                <tr>
                  <th className="py-2 text-left font-medium text-gray-500">
                    Date
                  </th>
                  <th className="py-2 text-left font-medium text-gray-500">
                    Description
                  </th>
                  <th className="py-2 text-left font-medium text-gray-500">
                    Category
                  </th>
                  <th className="py-2 text-left font-medium text-gray-500">
                    Account
                  </th>
                  <th className="py-2 text-right font-medium text-gray-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const amt = parseFloat(tx.accountingAmt);
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-2 pr-3">
                        <div>{tx.description}</div>
                        {tx.amountFcy && tx.fcyCurrency && (
                          <div className="text-xs text-gray-400">
                            {tx.fcyCurrency}{" "}
                            {parseFloat(tx.amountFcy).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {localCategoryMap ? (
                          <InlineCategoryEditor
                            transactionId={tx.id}
                            currentSpendCategoryId={tx.spendCategory.id}
                            currentSpendCategoryName={tx.spendCategory.name}
                            categoryMap={localCategoryMap}
                            onSaved={handleCategorySaved}
                            onCategoryCreated={handleCategoryCreated}
                          />
                        ) : (
                          tx.spendCategory.name
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-500 text-xs">
                        {tx.bankAccount.accountName}
                      </td>
                      <td
                        className={`py-2 text-right font-mono whitespace-nowrap ${
                          amt >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(amt)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 font-bold">
                  <td colSpan={4} className="py-2 text-gray-900">
                    Total
                  </td>
                  <td
                    className={`py-2 text-right font-mono ${
                      total >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
