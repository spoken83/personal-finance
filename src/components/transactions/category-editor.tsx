"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lightbulb, X } from "lucide-react";
import { SearchableCategoryPicker } from "./category-picker";

interface CategoryMap {
  masterCategories: { id: number; name: string }[];
  spendCategories: {
    id: number;
    name: string;
    masterCategory: { id: number; name: string };
  }[];
}

// --- Pattern extraction for rule creation ---
const STRIP_PREFIXES = [
  "POS", "NETS", "GIRO", "IBT", "IBG", "FAST", "BILL",
  "PAYNOW", "TRF", "TRANSFER", "PAYMENT", "DD",
];

export function extractPattern(description: string): string {
  let d = description.trim();
  // Remove leading date-like patterns (DD/MM, DD-MM, etc.)
  d = d.replace(/^\d{1,2}[\/\-]\d{1,2}(\s|$)/, "");
  // Remove common prefixes
  for (const prefix of STRIP_PREFIXES) {
    const re = new RegExp(`^${prefix}\\s+`, "i");
    d = d.replace(re, "");
  }
  // Take meaningful words (skip reference numbers at end)
  const words = d.split(/\s+/).filter(Boolean);
  const meaningful: string[] = [];
  for (const w of words) {
    // Stop at pure alphanumeric reference codes (e.g., A-EWKFJ234)
    if (/^[A-Z0-9\-]{6,}$/i.test(w) && /\d/.test(w)) break;
    meaningful.push(w);
    if (meaningful.length >= 3) break;
  }
  return meaningful.join(" ") || words[0] || description.slice(0, 20);
}

// --- Inline Category Editor ---
interface InlineCategoryEditorProps {
  transactionId: number;
  currentSpendCategoryId: number;
  currentSpendCategoryName: string;
  categoryMap: CategoryMap;
  onSaved: (tx: {
    id: number;
    spendCategoryId: number;
    spendCategoryName: string;
    masterCategoryId: number;
    masterCategoryName: string;
  }) => void;
  onCategoryCreated?: (category: {
    id: number;
    name: string;
    masterCategory: { id: number; name: string };
  }) => void;
  className?: string;
}

export function InlineCategoryEditor({
  transactionId,
  currentSpendCategoryId,
  currentSpendCategoryName,
  categoryMap,
  onSaved,
  onCategoryCreated,
  className,
}: InlineCategoryEditorProps) {
  const [saving, setSaving] = useState(false);

  async function handleSelect(scId: number) {
    const sc = categoryMap.spendCategories.find((c) => c.id === scId);
    if (!sc || scId === currentSpendCategoryId) return;

    setSaving(true);
    const res = await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spendCategoryId: sc.id,
        masterCategoryId: sc.masterCategory.id,
      }),
    });

    if (res.ok) {
      onSaved({
        id: transactionId,
        spendCategoryId: sc.id,
        spendCategoryName: sc.name,
        masterCategoryId: sc.masterCategory.id,
        masterCategoryName: sc.masterCategory.name,
      });
    }
    setSaving(false);
  }

  return (
    <SearchableCategoryPicker
      value={currentSpendCategoryId}
      label={currentSpendCategoryName}
      categoryMap={categoryMap}
      onSelect={handleSelect}
      onCategoryCreated={onCategoryCreated}
      disabled={saving}
      className={className}
    />
  );
}

// --- Rule Creation Prompt ---
interface RulePromptProps {
  description: string;
  spendCategoryId: number;
  spendCategoryName: string;
  masterCategoryId: number;
  masterCategoryName: string;
  onCreated: () => void;
  onDismiss: () => void;
}

export function RulePrompt({
  description,
  spendCategoryId,
  spendCategoryName,
  masterCategoryId,
  masterCategoryName,
  onCreated,
  onDismiss,
}: RulePromptProps) {
  const [pattern, setPattern] = useState(extractPattern(description));
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  async function handleCreate() {
    if (!pattern.trim()) return;
    setCreating(true);
    await fetch("/api/categories/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: pattern.trim(),
        spendCategoryId,
        masterCategoryId,
        priority: 0,
      }),
    });
    setCreating(false);
    onCreated();
  }

  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs">
      <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="text-gray-600 shrink-0">Create rule?</span>
      <Input
        ref={inputRef}
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        className="h-6 text-xs w-[140px] px-1.5"
        placeholder="Pattern..."
      />
      <span className="text-gray-400 shrink-0">→</span>
      <span className="text-gray-700 font-medium shrink-0 truncate max-w-[120px]" title={`${spendCategoryName} (${masterCategoryName})`}>
        {spendCategoryName}
      </span>
      <Button
        size="sm"
        className="h-6 text-xs px-2"
        onClick={handleCreate}
        disabled={creating || !pattern.trim()}
      >
        {creating ? "..." : "Create"}
      </Button>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
