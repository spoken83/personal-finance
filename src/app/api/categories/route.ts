import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [masterCategories, spendCategories, bankAccounts] = await Promise.all([
    prisma.masterCategory.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.spendCategory.findMany({
      include: { masterCategory: true },
      orderBy: { name: "asc" },
    }),
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { source: "asc" } }),
  ]);

  return NextResponse.json({ masterCategories, spendCategories, bankAccounts });
}

export async function POST(request: NextRequest) {
  const { name, masterCategoryId } = await request.json();

  if (!name || !masterCategoryId) {
    return NextResponse.json(
      { error: "name and masterCategoryId are required" },
      { status: 400 }
    );
  }

  // Check for duplicate name
  const existing = await prisma.spendCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A category with this name already exists" },
      { status: 409 }
    );
  }

  const category = await prisma.spendCategory.create({
    data: { name: name.trim(), masterCategoryId },
    include: { masterCategory: true },
  });

  return NextResponse.json(category, { status: 201 });
}
