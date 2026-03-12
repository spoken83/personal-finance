import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { statementUploads, transactions } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uploadId = parseInt(id);
  const body = await request.json();

  // Body can contain transaction updates: { transactions: [{ id, spendCategoryId, masterCategoryId }] }
  if (body.transactions && Array.isArray(body.transactions)) {
    for (const tx of body.transactions) {
      const data: Record<string, unknown> = { isConfirmed: true };
      if (tx.spendCategoryId) data.spendCategoryId = tx.spendCategoryId;
      if (tx.masterCategoryId) data.masterCategoryId = tx.masterCategoryId;
      if (tx.description) data.description = tx.description;
      if (tx.accountingAmt !== undefined) data.accountingAmt = tx.accountingAmt;
      if (tx.amountFcy !== undefined) data.amountFcy = tx.amountFcy;
      if (tx.delete) {
        await db.delete(transactions).where(eq(transactions.id, tx.id));
        continue;
      }
      await db
        .update(transactions)
        .set(data)
        .where(eq(transactions.id, tx.id));
    }
  } else {
    // Confirm all transactions for this upload
    await db
      .update(transactions)
      .set({ isConfirmed: true })
      .where(eq(transactions.statementUploadId, uploadId));
  }

  // Update upload status
  await db
    .update(statementUploads)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(statementUploads.id, uploadId));

  return NextResponse.json({ success: true });
}
