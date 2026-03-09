import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const rules = await prisma.categorizationRule.findMany({
    where: { isActive: true },
    include: {
      spendCategory: {
        include: { masterCategory: true },
      },
    },
    orderBy: { priority: "desc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { pattern, spendCategoryId, masterCategoryId, priority } = body;

  const rule = await prisma.categorizationRule.create({
    data: {
      pattern,
      spendCategoryId: parseInt(spendCategoryId),
      masterCategoryId: masterCategoryId ? parseInt(masterCategoryId) : null,
      priority: priority || 0,
    },
    include: {
      spendCategory: {
        include: { masterCategory: true },
      },
    },
  });

  return NextResponse.json(rule);
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  await prisma.categorizationRule.update({
    where: { id: parseInt(id) },
    data: { isActive: false },
  });
  return NextResponse.json({ success: true });
}
