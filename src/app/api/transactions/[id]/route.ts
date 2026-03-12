import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.spendCategoryId !== undefined) data.spendCategoryId = body.spendCategoryId;
  if (body.masterCategoryId !== undefined) data.masterCategoryId = body.masterCategoryId;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.description !== undefined) data.description = body.description;
  if (body.accountingAmt !== undefined) data.accountingAmt = body.accountingAmt;
  if (body.amountFcy !== undefined) data.amountFcy = body.amountFcy;

  await db
    .update(transactions)
    .set(data)
    .where(eq(transactions.id, parseInt(id)));

  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, parseInt(id)),
    with: {
      bankAccount: true,
      spendCategory: true,
      masterCategory: true,
    },
  });

  return NextResponse.json(transaction);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(transactions).where(eq(transactions.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
