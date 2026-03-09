"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, ArrowLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface CategoryMap {
  masterCategories: { id: number; name: string }[];
  spendCategories: {
    id: number;
    name: string;
    masterCategory: { id: number; name: string };
  }[];
}

interface SearchableCategoryPickerProps {
  value: number;
  label: string;
  categoryMap: CategoryMap;
  onSelect: (spendCategoryId: number) => void;
  onCategoryCreated?: (category: {
    id: number;
    name: string;
    masterCategory: { id: number; name: string };
  }) => void;
  disabled?: boolean;
  className?: string;
}

export function SearchableCategoryPicker({
  value,
  label,
  categoryMap,
  onSelect,
  onCategoryCreated,
  disabled,
  className,
}: SearchableCategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedMasterId, setSelectedMasterId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Group spend categories by master category
  const grouped = new Map<string, { id: number; name: string }[]>();
  for (const sc of categoryMap.spendCategories) {
    const key = sc.masterCategory.name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ id: sc.id, name: sc.name });
  }

  function resetCreate() {
    setCreating(false);
    setNewName("");
    setSelectedMasterId(null);
    setError("");
  }

  async function handleCreate() {
    if (!newName.trim() || !selectedMasterId) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          masterCategoryId: selectedMasterId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create category");
        setSaving(false);
        return;
      }

      // Notify parent so it can refresh the category map
      onCategoryCreated?.(data);
      onSelect(data.id);
      resetCreate();
      setOpen(false);
    } catch {
      setError("Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetCreate();
      }}
    >
      <PopoverTrigger
        className={cn(
          "flex items-center justify-between gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        disabled={disabled}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        {creating ? (
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={resetCreate}
                className="text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">New Category</span>
            </div>
            <input
              type="text"
              placeholder="Category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim() && selectedMasterId) {
                  handleCreate();
                }
              }}
            />
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Master Category</label>
              <div className="grid grid-cols-2 gap-1">
                {categoryMap.masterCategories.map((mc) => (
                  <button
                    key={mc.id}
                    onClick={() => setSelectedMasterId(mc.id)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs text-left transition-colors",
                      selectedMasterId === mc.id
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50"
                    )}
                  >
                    {mc.name}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !selectedMasterId || saving}
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating..." : "Create Category"}
            </button>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Search category..." />
            <CommandList className="max-h-[250px]">
              <CommandEmpty>No category found.</CommandEmpty>
              {[...grouped.entries()].map(([masterName, cats]) => (
                <CommandGroup key={masterName} heading={masterName}>
                  {cats
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((cat) => (
                      <CommandItem
                        key={cat.id}
                        value={`${cat.name} ${masterName}`}
                        onSelect={() => {
                          onSelect(cat.id);
                          setOpen(false);
                        }}
                        data-checked={cat.id === value}
                      >
                        {cat.name}
                        <Check
                          className={cn(
                            "ml-auto h-3 w-3",
                            cat.id === value ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => setCreating(true)}
                  className="text-blue-600"
                >
                  <Plus className="h-3 w-3" />
                  Create new category
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
