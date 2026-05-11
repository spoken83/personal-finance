import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const txId = parseInt(id);
  const { targetMonth } = (await request.json()) as { targetMonth: string };

  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json(
      { error: "targetMonth (YYYY-MM) is required" },
      { status: 400 }
    );
  }

  const parent = await db.query.transactions.findFirst({
    where: eq(transactions.id, txId),
  });

  if (!parent) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  if (parent.isAmortized) {
    return NextResponse.json(
      { error: "Transaction is already amortized or shifted" },
      { status: 400 }
    );
  }
  if (parent.parentTransactionId) {
    return NextResponse.json(
      { error: "Cannot shift a child transaction" },
      { status: 400 }
    );
  }

  const [year, mon] = targetMonth.split("-").map(Number);
  const targetDate = new Date(year, mon - 1, 15);

  await db
    .update(transactions)
    .set({ isAmortized: true })
    .where(eq(transactions.id, txId));

  const [child] = await db
    .insert(transactions)
    .values({
      bankAccountId: parent.bankAccountId,
      date: targetDate,
      description: parent.description,
      accountingAmt: parent.accountingAmt,
      amountFcy: parent.amountFcy,
      fcyCurrency: parent.fcyCurrency,
      spendCategoryId: parent.spendCategoryId,
      masterCategoryId: parent.masterCategoryId,
      isConfirmed: true,
      parentTransactionId: txId,
    })
    .returning();

  return NextResponse.json({ parent: txId, child });
}
