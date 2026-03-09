import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
        await prisma.transaction.delete({ where: { id: tx.id } });
        continue;
      }
      await prisma.transaction.update({
        where: { id: tx.id },
        data,
      });
    }
  } else {
    // Confirm all transactions for this upload
    await prisma.transaction.updateMany({
      where: { statementUploadId: uploadId },
      data: { isConfirmed: true },
    });
  }

  // Update upload status
  await prisma.statementUpload.update({
    where: { id: uploadId },
    data: { status: "confirmed", confirmedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
