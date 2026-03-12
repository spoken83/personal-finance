import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgets, runwayConfig } from "@/lib/schema";
import { eq, and, isNull, asc } from "drizzle-orm";

export async function GET() {
  const budgetList = await db.query.budgets.findMany({
    where: isNull(budgets.effectiveTo),
    with: {
      masterCategory: true,
      spendCategory: true,
    },
    orderBy: [asc(budgets.masterCategoryId)],
  });

  const config = await db.query.runwayConfig.findFirst();

  return NextResponse.json({ budgets: budgetList, runwayConfig: config });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { masterCategoryId, spendCategoryId, monthlyAmount } = body;

  // Deactivate any existing budget for this category
  const conditions = [isNull(budgets.effectiveTo)];
  if (masterCategoryId) conditions.push(eq(budgets.masterCategoryId, parseInt(masterCategoryId)));
  if (spendCategoryId) conditions.push(eq(budgets.spendCategoryId, parseInt(spendCategoryId)));

  await db
    .update(budgets)
    .set({ effectiveTo: new Date() })
    .where(and(...conditions));

  // Create new budget
  const [budget] = await db
    .insert(budgets)
    .values({
      masterCategoryId: masterCategoryId ? parseInt(masterCategoryId) : null,
      spendCategoryId: spendCategoryId ? parseInt(spendCategoryId) : null,
      monthlyAmount: parseFloat(monthlyAmount).toString(),
      effectiveFrom: new Date(),
    })
    .returning();

  const budgetWithRelations = await db.query.budgets.findFirst({
    where: eq(budgets.id, budget.id),
    with: { masterCategory: true, spendCategory: true },
  });

  return NextResponse.json(budgetWithRelations);
}
