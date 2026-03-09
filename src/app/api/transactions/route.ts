import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  const { ids, spendCategoryId, masterCategoryId } = await request.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }
  if (!spendCategoryId || !masterCategoryId) {
    return NextResponse.json(
      { error: "spendCategoryId and masterCategoryId are required" },
      { status: 400 }
    );
  }

  const result = await prisma.transaction.updateMany({
    where: { id: { in: ids } },
    data: { spendCategoryId, masterCategoryId },
  });

  return NextResponse.json({ updated: result.count });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const bankAccountId = searchParams.get("bankAccountId");
  const masterCategoryId = searchParams.get("masterCategoryId");
  const spendCategoryId = searchParams.get("spendCategoryId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Record<string, unknown> = {
    isAmortized: false, // Hide amortized parents; their children show instead
  };

  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }
  if (bankAccountId) {
    where.bankAccountId = parseInt(bankAccountId);
  }
  if (masterCategoryId) {
    where.masterCategoryId = parseInt(masterCategoryId);
  }
  if (spendCategoryId) {
    where.spendCategoryId = parseInt(spendCategoryId);
  }
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        bankAccount: true,
        spendCategory: true,
        masterCategory: true,
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
