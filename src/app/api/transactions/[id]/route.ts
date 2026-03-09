import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

  const transaction = await prisma.transaction.update({
    where: { id: parseInt(id) },
    data,
    include: {
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
  await prisma.transaction.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
