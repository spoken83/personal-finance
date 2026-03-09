"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

interface AmortizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    id: number;
    date: string;
    description: string;
    accountingAmt: string;
  } | null;
  onAmortized: () => void;
}

export function AmortizeDialog({
  open,
  onOpenChange,
  transaction,
  onAmortized,
}: AmortizeDialogProps) {
  const [months, setMonths] = useState(3);
  const [startMonth, setStartMonth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Derive a sensible default start month when dialog opens
  function handleOpenChange(isOpen: boolean) {
    if (isOpen && transaction) {
      const txDate = new Date(transaction.date);
      // Default: start N months before the transaction month
      const start = new Date(txDate.getFullYear(), txDate.getMonth() - (months - 1), 1);
      setStartMonth(
        `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`
      );
      setError("");
    }
    onOpenChange(isOpen);
  }

  if (!transaction) return null;

  const totalAmt = parseFloat(transaction.accountingAmt);
  const splitAmt = Math.round((totalAmt / months) * 100) / 100;

  // Generate preview of how the split will look
  function getPreviewMonths() {
    if (!startMonth) return [];
    const [y, m] = startMonth.split("-").map(Number);
    const result = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(y, m - 1 + i, 1);
      const label = d.toLocaleDateString("en-SG", { month: "short", year: "2-digit" });
      const isLast = i === months - 1;
      const amt = isLast
        ? Math.round((totalAmt - splitAmt * (months - 1)) * 100) / 100
        : splitAmt;
      result.push({ label, amt });
    }
    return result;
  }

  async function handleSubmit() {
    if (!transaction) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/amortize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months, startMonth }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to amortize");
        return;
      }
      onAmortized();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const preview = getPreviewMonths();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split / Amortize Transaction</DialogTitle>
          <DialogDescription>
            Spread this transaction evenly across multiple months.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original transaction info */}
          <div className="rounded-lg border bg-gray-50 p-3 text-sm">
            <div className="font-medium">{transaction.description}</div>
            <div className="text-gray-500 mt-1">
              {new Date(transaction.date).toLocaleDateString("en-SG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {" · "}
              <span className={`font-mono font-medium ${totalAmt >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totalAmt)}
              </span>
            </div>
          </div>

          {/* Split config */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Number of months</label>
              <Input
                type="number"
                min={2}
                max={24}
                value={months}
                onChange={(e) => {
                  const n = parseInt(e.target.value) || 2;
                  setMonths(Math.max(2, Math.min(24, n)));
                }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Start month</label>
              <Input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="rounded-lg border p-3">
              <div className="text-xs font-medium text-gray-500 mb-2">Preview</div>
              <div className="space-y-1">
                {preview.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{p.label}</span>
                    <span className={`font-mono ${p.amt >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(p.amt)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-medium border-t pt-1 mt-1">
                  <span>Total</span>
                  <span className={`font-mono ${totalAmt >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(totalAmt)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !startMonth}>
              {submitting ? "Splitting..." : `Split into ${months} months`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
