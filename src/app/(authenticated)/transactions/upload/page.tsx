"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  RotateCcw,
} from "lucide-react";
import { SearchableCategoryPicker } from "@/components/transactions/category-picker";
import { RulePrompt } from "@/components/transactions/category-editor";

interface ReviewTransaction {
  id: number;
  date: string;
  description: string;
  accountingAmt: string;
  amountFcy: string | null;
  fcyCurrency: string | null;
  spendCategory: { id: number; name: string };
  masterCategory: { id: number; name: string };
  bankAccount: { source: string; accountName: string };
  confidence?: string;
  deleted?: boolean;
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

type UploadState = "idle" | "uploading" | "review" | "confirming" | "done" | "error";

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState("");
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState("");
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [categories, setCategories] = useState<CategoryData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pastUploads, setPastUploads] = useState<
    {
      id: number;
      filename: string;
      status: string;
      transactionCount: number | null;
      uploadedAt: string;
      bankAccount: { source: string; accountName: string } | null;
    }[]
  >([]);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [rulePrompt, setRulePrompt] = useState<{
    description: string;
    spendCategoryId: number;
    spendCategoryName: string;
    masterCategoryId: number;
    masterCategoryName: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
    fetch("/api/upload")
      .then((r) => r.json())
      .then(setPastUploads);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (
      dropped &&
      (dropped.name.endsWith(".pdf") || dropped.name.endsWith(".csv"))
    ) {
      setFile(dropped);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) setFile(selected);
    },
    []
  );

  async function handleUpload() {
    if (!file) return;

    setState("uploading");
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    if (bankAccountId) formData.append("bankAccountId", bankAccountId);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.details ? `${data.error}: ${data.details}` : data.error || "Upload failed");
        setState("error");
        return;
      }

      setUploadId(data.uploadId);
      setSkippedCount(data.skippedCount || 0);
      setTransactions(
        data.transactions.map((tx: ReviewTransaction & { confidence?: string }) => ({
          ...tx,
          confidence: tx.confidence || "high",
          deleted: false,
        }))
      );
      setState("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    }
  }

  function updateTransactionCategory(
    txId: number,
    spendCategoryId: number
  ) {
    const sc = categories?.spendCategories.find((c) => c.id === spendCategoryId);
    if (!sc) return;

    const tx = transactions.find((t) => t.id === txId);

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId
          ? {
              ...t,
              spendCategory: { id: sc.id, name: sc.name },
              masterCategory: {
                id: sc.masterCategory.id,
                name: sc.masterCategory.name,
              },
            }
          : t
      )
    );

    // Show rule creation prompt
    if (tx) {
      setRulePrompt({
        description: tx.description,
        spendCategoryId: sc.id,
        spendCategoryName: sc.name,
        masterCategoryId: sc.masterCategory.id,
        masterCategoryName: sc.masterCategory.name,
      });
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

  async function loadPastUpload(id: number) {
    setLoadingUpload(true);
    setError("");
    try {
      const res = await fetch(`/api/upload/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load upload");
        setLoadingUpload(false);
        return;
      }
      setUploadId(data.upload.id);
      setSkippedCount(0);
      setTransactions(
        data.transactions.map((tx: ReviewTransaction & { isConfirmed?: boolean }) => ({
          ...tx,
          confidence: "high",
          deleted: false,
        }))
      );
      setState("review");
    } catch {
      setError("Failed to load upload");
    } finally {
      setLoadingUpload(false);
    }
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

  function bulkUpdateCategory(spendCategoryId: number) {
    const sc = categories?.spendCategories.find((c) => c.id === spendCategoryId);
    if (!sc || selectedIds.size === 0) return;

    setTransactions((prev) =>
      prev.map((tx) =>
        selectedIds.has(tx.id)
          ? {
              ...tx,
              spendCategory: { id: sc.id, name: sc.name },
              masterCategory: {
                id: sc.masterCategory.id,
                name: sc.masterCategory.name,
              },
            }
          : tx
      )
    );
    setSelectedIds(new Set());
  }

  function toggleAmountSign(txId: number) {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== txId) return tx;
        const flippedAmt = (parseFloat(tx.accountingAmt) * -1).toString();
        const flippedFcy = tx.amountFcy
          ? (parseFloat(tx.amountFcy) * -1).toString()
          : null;
        return { ...tx, accountingAmt: flippedAmt, amountFcy: flippedFcy };
      })
    );
  }

  function toggleDeleteTransaction(txId: number) {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === txId ? { ...tx, deleted: !tx.deleted } : tx
      )
    );
  }

  async function handleConfirm() {
    if (!uploadId) return;

    setState("confirming");

    const txUpdates = transactions.map((tx) => ({
      id: tx.id,
      spendCategoryId: tx.spendCategory.id,
      masterCategoryId: tx.masterCategory.id,
      accountingAmt: parseFloat(tx.accountingAmt),
      amountFcy: tx.amountFcy ? parseFloat(tx.amountFcy) : undefined,
      delete: tx.deleted || false,
    }));

    try {
      await fetch(`/api/upload/${uploadId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: txUpdates }),
      });
      setState("done");
      // Refresh past uploads list
      fetch("/api/upload").then((r) => r.json()).then(setPastUploads);
    } catch {
      setError("Failed to confirm transactions");
      setState("error");
    }
  }

  function reset() {
    setFile(null);
    setBankAccountId("");
    setState("idle");
    setError("");
    setUploadId(null);
    setTransactions([]);
    setSkippedCount(0);
    setSelectedIds(new Set());
  }

  function getConfidenceColor(confidence: string) {
    switch (confidence) {
      case "high":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  // Upload + Select Bank step
  if (state === "idle" || state === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Upload Statement</h1>

        <Card>
          <CardHeader>
            <CardTitle>Upload Bank Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bank account selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Bank Account (optional):</label>
              <Select
                value={bankAccountId}
                onValueChange={(v) => setBankAccountId(v === "auto" ? "" : v ?? "")}
              >
                <SelectTrigger className="w-[250px]">
                  <span className="truncate">
                    {bankAccountId
                      ? (() => {
                          const ba = categories?.bankAccounts.find((b) => b.id.toString() === bankAccountId);
                          return ba ? `${ba.source} — ${ba.accountName}` : "Auto-detect from file";
                        })()
                      : "Auto-detect from file"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect from file</SelectItem>
                  {categories?.bankAccounts.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id.toString()}>
                      {ba.source} — {ba.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                dragOver
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 bg-gray-50"
              }`}
            >
              {file ? (
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-blue-500" />
                  <p className="mt-2 font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => setFile(null)} variant="outline">
                      Remove
                    </Button>
                    <Button onClick={handleUpload}>Process Statement</Button>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400" />
                  <p className="mt-4 text-sm text-gray-600">
                    Drag and drop a PDF or CSV bank statement here
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Supports Citibank, OCBC, Trust Bank statements
                  </p>
                  <label className="mt-4">
                    <input
                      type="file"
                      accept=".pdf,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <span className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                      Browse Files
                    </span>
                  </label>
                </>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-sm text-gray-500 space-y-1">
          <p><strong>PDF files:</strong> Extracted and categorized using GPT-4.1. Requires OPENAI_API_KEY in .env.</p>
          <p><strong>CSV files:</strong> Parsed directly. Must follow the format: Source, Account, Date, Description, Amount in FCY, FCY Currency, Accounting Amt, Spend Category, Master Category.</p>
        </div>

        {/* Previous Uploads */}
        {pastUploads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Previous Uploads</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Transactions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastUploads.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          {u.filename}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {u.bankAccount
                          ? `${u.bankAccount.source} — ${u.bankAccount.accountName}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.transactionCount ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            u.status === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : u.status === "pending_review"
                                ? "bg-yellow-100 text-yellow-800"
                                : u.status === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-600"
                          }
                        >
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(u.uploadedAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadPastUpload(u.id)}
                          disabled={loadingUpload}
                          title="Re-review this upload"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Processing state
  if (state === "uploading") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Upload Statement</h1>
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <p className="mt-4 text-lg font-medium">Processing statement...</p>
            <p className="text-sm text-gray-500">
              {file?.name.endsWith(".pdf")
                ? "Extracting transactions with GPT-4.1..."
                : "Parsing CSV file..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Review state
  if (state === "review" || state === "confirming") {
    const activeTransactions = transactions.filter((tx) => !tx.deleted);
    const deletedCount = transactions.filter((tx) => tx.deleted).length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Review Transactions</h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              {activeTransactions.length} transactions
              {deletedCount > 0 && ` (${deletedCount} removed)`}
              {skippedCount > 0 && (
                <span className="text-amber-600"> · {skippedCount} duplicates skipped</span>
              )}
            </p>
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={state === "confirming"}>
              {state === "confirming" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm All
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Bulk action bar - sticky so it's visible while scrolling */}
        {selectedIds.size > 0 && categories && (
          <div className="sticky top-0 z-20 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-sm">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} selected
            </span>
            <span className="text-sm text-blue-600">Change category to:</span>
            <SearchableCategoryPicker
              value={0}
              label="Pick category..."
              categoryMap={categories}
              onSelect={bulkUpdateCategory}
              onCategoryCreated={handleCategoryCreated}
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

        <Card>
          <CardContent className="p-0">
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
                  <TableHead className="w-[160px]">Master Category</TableHead>
                  <TableHead className="w-[180px]">Subcategory</TableHead>
                  <TableHead className="w-[80px]">Confidence</TableHead>
                  <TableHead className="w-[120px] text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const amt = parseFloat(tx.accountingAmt);
                  return (
                    <TableRow
                      key={tx.id}
                      className={`${tx.deleted ? "opacity-40 line-through" : ""} ${selectedIds.has(tx.id) ? "bg-blue-50/50" : ""}`}
                    >
                      <TableCell className="px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => toggleSelect(tx.id)}
                          className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {tx.description}
                        </div>
                        {tx.amountFcy && tx.fcyCurrency && (
                          <div className="text-xs text-gray-400">
                            {tx.fcyCurrency}{" "}
                            {parseFloat(tx.amountFcy).toFixed(2)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className={
                          ({
                            "Expense": "bg-red-100 text-red-800",
                            "Business Expense": "bg-purple-100 text-purple-800",
                            "Fixed Payment": "bg-orange-100 text-orange-800",
                            "Rental": "bg-yellow-100 text-yellow-800",
                            "Adhoc": "bg-pink-100 text-pink-800",
                            "Investment": "bg-blue-100 text-blue-800",
                            "Money In": "bg-green-100 text-green-800",
                          } as Record<string, string>)[tx.masterCategory.name] || "bg-gray-100 text-gray-600"
                        }>
                          {tx.masterCategory.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {categories ? (
                          <SearchableCategoryPicker
                            value={tx.spendCategory.id}
                            label={tx.spendCategory.name}
                            categoryMap={categories}
                            onSelect={(id) => updateTransactionCategory(tx.id, id)}
                            onCategoryCreated={handleCategoryCreated}
                            disabled={tx.deleted}
                            className="h-8 text-xs w-[160px]"
                          />
                        ) : (
                          <span className="text-xs">{tx.spendCategory.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getConfidenceColor(
                            tx.confidence || "high"
                          )}
                        >
                          {tx.confidence || "high"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${
                          amt >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        <button
                          onClick={() => toggleAmountSign(tx.id)}
                          className="hover:underline cursor-pointer"
                          title="Click to flip sign (credit ↔ debit)"
                        >
                          {formatCurrency(amt)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleDeleteTransaction(tx.id)}
                          className="text-gray-400 hover:text-red-500"
                          title={
                            tx.deleted ? "Restore" : "Remove this transaction"
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Done state
  if (state === "done") {
    const confirmedCount = transactions.filter((tx) => !tx.deleted).length;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Upload Complete</h1>
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="mt-4 text-lg font-medium">
              {confirmedCount} transactions confirmed!
            </p>
            <p className="text-sm text-gray-500">
              From {file?.name}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={reset}>
                Upload Another
              </Button>
              <Button
                onClick={() => (window.location.href = "/transactions")}
              >
                View Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
