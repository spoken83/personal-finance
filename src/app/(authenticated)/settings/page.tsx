"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Save, Settings, Info } from "lucide-react";

export default function SettingsPage() {
  const [totalProceeds, setTotalProceeds] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [returnRate, setReturnRate] = useState("");
  const [projectionYears, setProjectionYears] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/health-check")
      .then((r) => r.json())
      .then((data) => {
        const rc = data.summary?.runwayConfig;
        if (rc) {
          setTotalProceeds(rc.totalProceeds.toString());
          setMonthlyTarget(rc.monthlyInvestmentTarget.toString());
          setReturnRate(rc.expectedReturnRate.toString());
          setProjectionYears(rc.projectionYears.toString());
        }
        setLoading(false);
      });
  }, []);

  async function saveRunwayConfig() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/budget/runway", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalProceeds,
        monthlyInvestmentTarget: monthlyTarget,
        expectedReturnRate: returnRate,
        projectionYears,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Runway Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Runway Configuration
          </CardTitle>
          <p className="text-sm text-gray-500">
            These settings drive the Financial Health Check on the Budget page.
            The expected balance is calculated as: Starting Proceeds minus
            cumulative monthly spending.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-gray-500 py-4">Loading...</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="totalProceeds">
                  Total Sale Proceeds (SGD)
                </Label>
                <Input
                  id="totalProceeds"
                  type="number"
                  step="0.01"
                  value={totalProceeds}
                  onChange={(e) => setTotalProceeds(e.target.value)}
                />
                <p className="flex items-start gap-1.5 text-xs text-gray-400">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Your starting capital (e.g., property sale proceeds). This is
                  the baseline for the &quot;Expected Balance&quot; column in the
                  health check — spending is subtracted from this each month.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="monthlyTarget">
                  Monthly Investment Target (SGD)
                </Label>
                <Input
                  id="monthlyTarget"
                  type="number"
                  step="0.01"
                  value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(e.target.value)}
                />
                <p className="flex items-start gap-1.5 text-xs text-gray-400">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  How much you plan to invest per month. Used for future
                  projection calculations.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="returnRate">
                  Expected Annual Return Rate
                </Label>
                <Input
                  id="returnRate"
                  type="number"
                  step="0.001"
                  value={returnRate}
                  onChange={(e) => setReturnRate(e.target.value)}
                  placeholder="e.g. 0.06 for 6%"
                />
                <p className="flex items-start gap-1.5 text-xs text-gray-400">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Expected annual return on investments as a decimal (0.06 =
                  6%). Used for projection calculations.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="projectionYears">Projection Years</Label>
                <Input
                  id="projectionYears"
                  type="number"
                  value={projectionYears}
                  onChange={(e) => setProjectionYears(e.target.value)}
                />
                <p className="flex items-start gap-1.5 text-xs text-gray-400">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Number of years to project forward for investment growth
                  calculations.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={saveRunwayConfig} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Configuration"}
                </Button>
                {saved && (
                  <span className="text-sm text-green-600">
                    Settings saved successfully
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bank Accounts placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Bank Accounts & Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            Manage bank accounts, import settings, and app configuration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
