import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { totalProceeds, monthlyInvestmentTarget, expectedReturnRate, projectionYears } = body;

  const config = await prisma.runwayConfig.upsert({
    where: { id: 1 },
    update: {
      totalProceeds: parseFloat(totalProceeds),
      monthlyInvestmentTarget: parseFloat(monthlyInvestmentTarget),
      expectedReturnRate: parseFloat(expectedReturnRate),
      projectionYears: parseInt(projectionYears),
    },
    create: {
      totalProceeds: parseFloat(totalProceeds),
      monthlyInvestmentTarget: parseFloat(monthlyInvestmentTarget),
      expectedReturnRate: parseFloat(expectedReturnRate),
      projectionYears: parseInt(projectionYears),
    },
  });

  return NextResponse.json(config);
}
