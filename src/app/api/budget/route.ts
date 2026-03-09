import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const budgets = await prisma.budget.findMany({
    where: { effectiveTo: null },
    include: {
      masterCategory: true,
      spendCategory: true,
    },
    orderBy: { masterCategoryId: "asc" },
  });

  const runwayConfig = await prisma.runwayConfig.findFirst();

  return NextResponse.json({ budgets, runwayConfig });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { masterCategoryId, spendCategoryId, monthlyAmount } = body;

  // Deactivate any existing budget for this category
  const where: Record<string, unknown> = { effectiveTo: null };
  if (masterCategoryId) where.masterCategoryId = parseInt(masterCategoryId);
  if (spendCategoryId) where.spendCategoryId = parseInt(spendCategoryId);

  await prisma.budget.updateMany({
    where,
    data: { effectiveTo: new Date() },
  });

  // Create new budget
  const budget = await prisma.budget.create({
    data: {
      masterCategoryId: masterCategoryId ? parseInt(masterCategoryId) : null,
      spendCategoryId: spendCategoryId ? parseInt(spendCategoryId) : null,
      monthlyAmount: parseFloat(monthlyAmount),
      effectiveFrom: new Date(),
    },
    include: { masterCategory: true, spendCategory: true },
  });

  return NextResponse.json(budget);
}
