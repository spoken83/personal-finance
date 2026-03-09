import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const txId = parseInt(id);
  const body = await request.json();
  const { months, startMonth } = body as { months: number; startMonth: string };

  if (!months || months < 2 || !startMonth) {
    return NextResponse.json(
      { error: "months (>=2) and startMonth (YYYY-MM) are required" },
      { status: 400 }
    );
  }

  const parent = await prisma.transaction.findUnique({
    where: { id: txId },
  });

  if (!parent) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (parent.isAmortized) {
    return NextResponse.json({ error: "Transaction is already amortized" }, { status: 400 });
  }

  if (parent.parentTransactionId) {
    return NextResponse.json({ error: "Cannot amortize a child transaction" }, { status: 400 });
  }

  const totalAmt = Number(parent.accountingAmt);
  const splitAmt = Math.round((totalAmt / months) * 100) / 100;
  // Last split absorbs rounding difference
  const lastAmt = Math.round((totalAmt - splitAmt * (months - 1)) * 100) / 100;

  const totalFcy = parent.amountFcy ? Number(parent.amountFcy) : null;
  const splitFcy = totalFcy !== null ? Math.round((totalFcy / months) * 100) / 100 : null;
  const lastFcy = totalFcy !== null ? Math.round((totalFcy - splitFcy! * (months - 1)) * 100) / 100 : null;

  const [startYear, startMon] = startMonth.split("-").map(Number);

  // Create child transactions + mark parent as amortized in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    // Mark parent as amortized
    await tx.transaction.update({
      where: { id: txId },
      data: { isAmortized: true },
    });

    const children = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(startYear, startMon - 1 + i, 15); // mid-month
      const isLast = i === months - 1;

      const child = await tx.transaction.create({
        data: {
          bankAccountId: parent.bankAccountId,
          date: d,
          description: `${parent.description} (${i + 1}/${months})`,
          accountingAmt: isLast ? lastAmt : splitAmt,
          amountFcy: totalFcy !== null ? (isLast ? lastFcy : splitFcy) : null,
          fcyCurrency: parent.fcyCurrency,
          spendCategoryId: parent.spendCategoryId,
          masterCategoryId: parent.masterCategoryId,
          isConfirmed: true,
          parentTransactionId: txId,
        },
      });
      children.push(child);
    }

    return children;
  });

  return NextResponse.json({ parent: txId, children: result });
}

// DELETE = undo amortization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const txId = parseInt(id);

  const parent = await prisma.transaction.findUnique({
    where: { id: txId },
  });

  if (!parent || !parent.isAmortized) {
    return NextResponse.json({ error: "Transaction is not amortized" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // Delete all children
    await tx.transaction.deleteMany({
      where: { parentTransactionId: txId },
    });

    // Un-amortize the parent
    await tx.transaction.update({
      where: { id: txId },
      data: { isAmortized: false },
    });
  });

  return NextResponse.json({ success: true });
}
