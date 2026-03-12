import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { masterCategories, spendCategories, bankAccounts } from "@/lib/schema";
import { eq, asc, sql } from "drizzle-orm";

export async function GET() {
  const [masterCats, spendCats, bankAccts] = await Promise.all([
    db.query.masterCategories.findMany({ orderBy: [asc(masterCategories.displayOrder)] }),
    db.query.spendCategories.findMany({
      with: { masterCategory: true },
      orderBy: [asc(spendCategories.name)],
    }),
    db.query.bankAccounts.findMany({
      where: eq(bankAccounts.isActive, true),
      orderBy: [asc(bankAccounts.source)],
    }),
  ]);

  return NextResponse.json({ masterCategories: masterCats, spendCategories: spendCats, bankAccounts: bankAccts });
}

export async function POST(request: NextRequest) {
  const { name, masterCategoryId } = await request.json();

  if (!name || !masterCategoryId) {
    return NextResponse.json(
      { error: "name and masterCategoryId are required" },
      { status: 400 }
    );
  }

  // Check for duplicate name (case-insensitive)
  const existing = await db.query.spendCategories.findFirst({
    where: sql`lower(${spendCategories.name}) = lower(${name})`,
  });
  if (existing) {
    return NextResponse.json(
      { error: "A category with this name already exists" },
      { status: 409 }
    );
  }

  const [category] = await db
    .insert(spendCategories)
    .values({ name: name.trim(), masterCategoryId })
    .returning();

  const categoryWithRelation = await db.query.spendCategories.findFirst({
    where: eq(spendCategories.id, category.id),
    with: { masterCategory: true },
  });

  return NextResponse.json(categoryWithRelation, { status: 201 });
}
