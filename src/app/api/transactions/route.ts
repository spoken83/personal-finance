import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq, and, ilike, gte, lte, inArray, desc, count, sql } from "drizzle-orm";

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

  const result = await db
    .update(transactions)
    .set({ spendCategoryId, masterCategoryId })
    .where(inArray(transactions.id, ids));

  return NextResponse.json({ updated: result.rowCount });
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

  const conditions = [eq(transactions.isAmortized, false)];

  if (search) {
    conditions.push(ilike(transactions.description, `%${search}%`));
  }
  if (bankAccountId) {
    conditions.push(eq(transactions.bankAccountId, parseInt(bankAccountId)));
  }
  if (masterCategoryId) {
    conditions.push(eq(transactions.masterCategoryId, parseInt(masterCategoryId)));
  }
  if (spendCategoryId) {
    conditions.push(eq(transactions.spendCategoryId, parseInt(spendCategoryId)));
  }
  if (dateFrom) {
    conditions.push(gte(transactions.date, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(transactions.date, new Date(dateTo)));
  }

  const where = and(...conditions);

  const [txList, [{ total }]] = await Promise.all([
    db.query.transactions.findMany({
      where,
      with: {
        bankAccount: true,
        spendCategory: true,
        masterCategory: true,
      },
      orderBy: [desc(transactions.date)],
      offset: (page - 1) * limit,
      limit,
    }),
    db.select({ total: count() }).from(transactions).where(where),
  ]);

  return NextResponse.json({
    transactions: txList,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
