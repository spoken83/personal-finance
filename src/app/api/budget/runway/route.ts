import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runwayConfig } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { totalProceeds, monthlyInvestmentTarget, expectedReturnRate, projectionYears } = body;

  const values = {
    totalProceeds: parseFloat(totalProceeds).toString(),
    monthlyInvestmentTarget: parseFloat(monthlyInvestmentTarget).toString(),
    expectedReturnRate: parseFloat(expectedReturnRate).toString(),
    projectionYears: parseInt(projectionYears),
  };

  const [config] = await db
    .insert(runwayConfig)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({
      target: runwayConfig.id,
      set: values,
    })
    .returning();

  return NextResponse.json(config);
}
