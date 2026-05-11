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

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    id: number;
    date: string;
    description: string;
    accountingAmt: string;
  } | null;
  onShifted: () => void;
}

export function ShiftDialog({
  open,
  onOpenChange,
  transaction,
  onShifted,
}: ShiftDialogProps) {
  const [targetMonth, setTargetMonth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleOpenChange(isOpen: boolean) {
    if (isOpen && transaction) {
      const txDate = new Date(transaction.date);
      // Default: next month after txn date
      const next = new Date(txDate.getFullYear(), txDate.getMonth() + 1, 1);
      setTargetMonth(
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
      );
      setError("");
    }
    onOpenChange(isOpen);
  }

  if (!transaction) return null;

  const totalAmt = parseFloat(transaction.accountingAmt);

  const targetLabel = targetMonth
    ? new Date(`${targetMonth}-01`).toLocaleDateString("en-SG", {
        month: "long",
        year: "numeric",
      })
    : "";

  async function handleSubmit() {
    if (!transaction || !targetMonth) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMonth }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to shift");
        return;
      }
      onShifted();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shift Transaction to Another Month</DialogTitle>
          <DialogDescription>
            Move this transaction into a different reporting month. The original
            payment date is preserved (hidden) and can be restored via Undo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-gray-50 p-3 text-sm">
            <div className="font-medium">{transaction.description}</div>
            <div className="text-gray-500 mt-1">
              {new Date(transaction.date).toLocaleDateString("en-SG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {" · "}
              <span
                className={`font-medium ${
                  totalAmt >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(totalAmt, 2)}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Report in month
            </label>
            <Input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="mt-1"
            />
            {targetLabel && (
              <p className="text-xs text-gray-500 mt-1">
                Will appear as a transaction on the 15th of {targetLabel}.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !targetMonth}
            >
              {submitting ? "Shifting..." : "Shift transaction"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
