import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categorizationRules } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const rules = await db.query.categorizationRules.findMany({
    where: eq(categorizationRules.isActive, true),
    with: {
      spendCategory: {
        with: { masterCategory: true },
      },
    },
    orderBy: [desc(categorizationRules.priority)],
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pattern, spendCategoryId, masterCategoryId, priority } = body;

  const [rule] = await db
    .insert(categorizationRules)
    .values({
      pattern,
      spendCategoryId: parseInt(spendCategoryId),
      masterCategoryId: masterCategoryId ? parseInt(masterCategoryId) : null,
      priority: priority || 0,
    })
    .returning();

  const ruleWithRelations = await db.query.categorizationRules.findFirst({
    where: eq(categorizationRules.id, rule.id),
    with: {
      spendCategory: {
        with: { masterCategory: true },
      },
    },
  });

  return NextResponse.json(ruleWithRelations);
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  await db
    .update(categorizationRules)
    .set({ isActive: false })
    .where(eq(categorizationRules.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
