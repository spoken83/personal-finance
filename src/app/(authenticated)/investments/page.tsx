"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import { TrendingUp, DollarSign, Save } from "lucide-react";

interface InvestmentAccount {
  id: number;
  name: string;
  provider: string;
  accountType: string | null;
  snapshots: {
    id: number;
    month: string;
    balance: string;
    contributions: string;
    withdrawals: string;
  }[];
}

interface BankAccount {
  id: number;
  source: string;
  accountName: string;
}

interface AccountBalance {
  id: number;
  month: string;
  actualBalance: string;
  bankAccount: BankAccount;
}

export default function InvestmentsPage() {
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankBalances, setBankBalances] = useState<AccountBalance[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [investmentValues, setInvestmentValues] = useState<Record<number, string>>({});
  const [bankValues, setBankValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [months, setMonths] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    const [invRes, balRes] = await Promise.all([
      fetch("/api/investments"),
      fetch(`/api/balances?month=${selectedMonth}`),
    ]);
    const invData = await invRes.json();
    const balData = await balRes.json();

    setInvestmentAccounts(invData.accounts);
    setBankAccounts(balData.bankAccounts);
    setBankBalances(balData.balances);

    // Merge months from both sources
    const allMonths = [...new Set([...invData.months, ...balData.months])].sort().reverse();
    setMonths(allMonths);

    // Pre-fill current values
    const invVals: Record<number, string> = {};
    for (const acc of invData.accounts) {
      const snap = acc.snapshots.find(
        (s: { month: string }) => s.month.slice(0, 7) === selectedMonth
      );
      if (snap) invVals[acc.id] = snap.balance;
    }
    setInvestmentValues(invVals);

    const bankVals: Record<number, string> = {};
    for (const bal of balData.balances) {
      bankVals[bal.bankAccount.id] = bal.actualBalance;
    }
    setBankValues(bankVals);
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function saveInvestmentSnapshot(accountId: number) {
    const balance = investmentValues[accountId];
    if (!balance) return;
    setSaving(true);
    await fetch("/api/investments/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        investmentAccountId: accountId,
        month: selectedMonth,
        balance,
        contributions: "0",
        withdrawals: "0",
      }),
    });
    setSaving(false);
    fetchData();
  }

  async function saveBankBalance(bankAccountId: number) {
    const balance = bankValues[bankAccountId];
    if (!balance) return;
    setSaving(true);
    await fetch("/api/balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankAccountId,
        month: selectedMonth,
        actualBalance: balance,
      }),
    });
    setSaving(false);
    fetchData();
  }

  async function saveAll() {
    setSaving(true);
    const promises: Promise<Response>[] = [];

    for (const [id, balance] of Object.entries(investmentValues)) {
      if (balance) {
        promises.push(
          fetch("/api/investments/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              investmentAccountId: parseInt(id),
              month: selectedMonth,
              balance,
              contributions: "0",
              withdrawals: "0",
            }),
          })
        );
      }
    }

    for (const [id, balance] of Object.entries(bankValues)) {
      if (balance) {
        promises.push(
          fetch("/api/balances", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bankAccountId: parseInt(id),
              month: selectedMonth,
              actualBalance: balance,
            }),
          })
        );
      }
    }

    await Promise.all(promises);
    setSaving(false);
    fetchData();
  }

  // Calculate totals
  const bankTotal = Object.values(bankValues).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );
  const investmentTotal = Object.values(investmentValues).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );
  const grandTotal = bankTotal + investmentTotal;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Portfolio & Balances</h1>
        <div className="flex items-center gap-3">
          <Label>Month:</Label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-[180px]"
          />
          <Button onClick={saveAll} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Bank Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(bankTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Investments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(investmentTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Net Worth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(grandTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bank">
        <TabsList>
          <TabsTrigger value="bank">
            <DollarSign className="mr-1 h-4 w-4" />
            Bank Accounts
          </TabsTrigger>
          <TabsTrigger value="investments">
            <TrendingUp className="mr-1 h-4 w-4" />
            Investments
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>
                Bank Account Balances — {new Date(selectedMonth + "-01").toLocaleDateString("en-SG", { month: "long", year: "numeric" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="w-[200px]">Balance (SGD)</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.map((ba) => (
                    <TableRow key={ba.id}>
                      <TableCell className="font-medium">{ba.source}</TableCell>
                      <TableCell>{ba.accountName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={bankValues[ba.id] || ""}
                          onChange={(e) =>
                            setBankValues({ ...bankValues, [ba.id]: e.target.value })
                          }
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveBankBalance(ba.id)}
                          disabled={saving}
                        >
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell>{formatCurrency(bankTotal)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investments">
          <Card>
            <CardHeader>
              <CardTitle>
                Investment Balances — {new Date(selectedMonth + "-01").toLocaleDateString("en-SG", { month: "long", year: "numeric" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[200px]">Balance (SGD)</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investmentAccounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.provider}</TableCell>
                      <TableCell>{acc.name}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {acc.accountType || "-"}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={investmentValues[acc.id] || ""}
                          onChange={(e) =>
                            setInvestmentValues({
                              ...investmentValues,
                              [acc.id]: e.target.value,
                            })
                          }
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveInvestmentSnapshot(acc.id)}
                          disabled={saving}
                        >
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell>{formatCurrency(investmentTotal)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Balance History</CardTitle>
            </CardHeader>
            <CardContent>
              {months.length === 0 ? (
                <p className="text-gray-500 py-4 text-center">
                  No balance records yet. Enter balances above to start tracking.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Bank Total</TableHead>
                      <TableHead className="text-right">Investment Total</TableHead>
                      <TableHead className="text-right font-bold">Grand Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {months.map((month) => {
                      const bankBals = bankBalances.filter(
                        (b) => b.month.slice(0, 7) === month
                      );
                      const bt = bankBals.reduce(
                        (sum, b) => sum + parseFloat(b.actualBalance),
                        0
                      );
                      const invAccs = investmentAccounts.flatMap((a) =>
                        a.snapshots.filter((s) => s.month.slice(0, 7) === month)
                      );
                      const it = invAccs.reduce(
                        (sum, s) => sum + parseFloat(s.balance),
                        0
                      );
                      return (
                        <TableRow key={month}>
                          <TableCell>
                            {new Date(month + "-01").toLocaleDateString("en-SG", {
                              month: "long",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {bt > 0 ? formatCurrency(bt) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {it > 0 ? formatCurrency(it) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {formatCurrency(bt + it)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
