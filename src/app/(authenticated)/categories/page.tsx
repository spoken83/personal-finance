"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";

interface SpendCategory {
  id: number;
  name: string;
  masterCategory: { id: number; name: string };
}

interface MasterCategory {
  id: number;
  name: string;
  isExcluded: boolean;
}

interface CategorizationRule {
  id: number;
  pattern: string;
  priority: number;
  spendCategory: {
    id: number;
    name: string;
    masterCategory: { id: number; name: string };
  };
}

export default function CategoriesPage() {
  const [spendCategories, setSpendCategories] = useState<SpendCategory[]>([]);
  const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [newPattern, setNewPattern] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newPriority, setNewPriority] = useState("0");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        setSpendCategories(data.spendCategories);
        setMasterCategories(data.masterCategories);
      });
    fetchRules();
  }, []);

  function fetchRules() {
    fetch("/api/categories/rules")
      .then((r) => r.json())
      .then(setRules);
  }

  async function addRule() {
    if (!newPattern || !newCategoryId) return;
    await fetch("/api/categories/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern: newPattern,
        spendCategoryId: newCategoryId,
        priority: parseInt(newPriority) || 0,
      }),
    });
    setNewPattern("");
    setNewCategoryId("");
    setNewPriority("0");
    fetchRules();
  }

  async function deleteRule(id: number) {
    await fetch("/api/categories/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchRules();
  }

  // Group spend categories by master category
  const grouped = masterCategories.map((mc) => ({
    ...mc,
    spendCategories: spendCategories.filter(
      (sc) => sc.masterCategory.id === mc.id
    ),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categories</h1>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="rules">
            Auto-Categorization Rules ({rules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          {grouped.map((mc) => (
            <Card key={mc.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  {mc.name}
                  {mc.isExcluded && (
                    <Badge variant="outline" className="text-xs">
                      Excluded from totals
                    </Badge>
                  )}
                  <span className="text-sm font-normal text-gray-500">
                    ({mc.spendCategories.length} categories)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mc.spendCategories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {mc.spendCategories.map((sc) => (
                      <Badge key={sc.id} variant="secondary">
                        {sc.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No spend categories</p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Categorization Rules</CardTitle>
              <p className="text-sm text-gray-500">
                When a transaction description contains a pattern, it will be
                automatically categorized. Higher priority rules are checked first.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new rule */}
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-gray-500">
                    Pattern (substring match)
                  </label>
                  <Input
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    placeholder="e.g. CARDUP, GRAB, NTUC"
                  />
                </div>
                <div className="w-[250px] space-y-1">
                  <label className="text-xs font-medium text-gray-500">
                    Category
                  </label>
                  <Select
                    value={newCategoryId}
                    onValueChange={(v) => setNewCategoryId(v ?? "")}
                  >
                    <SelectTrigger>
                      <span className="truncate">
                        {newCategoryId
                          ? spendCategories.find((sc) => sc.id.toString() === newCategoryId)?.name || "Select category"
                          : "Select category"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {spendCategories.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id.toString()}>
                          {sc.name}{" "}
                          <span className="text-gray-400">
                            ({sc.masterCategory.name})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[80px] space-y-1">
                  <label className="text-xs font-medium text-gray-500">
                    Priority
                  </label>
                  <Input
                    type="number"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                  />
                </div>
                <Button onClick={addRule} disabled={!newPattern || !newCategoryId}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>

              {/* Rules table */}
              {rules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Master Category</TableHead>
                      <TableHead className="w-[80px]">Priority</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono text-sm">
                          {rule.pattern}
                        </TableCell>
                        <TableCell>{rule.spendCategory.name}</TableCell>
                        <TableCell className="text-gray-500">
                          {rule.spendCategory.masterCategory.name}
                        </TableCell>
                        <TableCell className="text-center">
                          {rule.priority}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => deleteRule(rule.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-4 text-center text-sm text-gray-500">
                  No rules yet. Add patterns above to auto-categorize transactions during upload.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
