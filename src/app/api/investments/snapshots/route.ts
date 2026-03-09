import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { investmentAccountId, month, balance, contributions, withdrawals } = body;

  const monthDate = new Date(month + "-01");

  const snapshot = await prisma.investmentSnapshot.upsert({
    where: {
      investmentAccountId_month: {
        investmentAccountId: parseInt(investmentAccountId),
        month: monthDate,
      },
    },
    update: {
      balance: parseFloat(balance),
      contributions: parseFloat(contributions || "0"),
      withdrawals: parseFloat(withdrawals || "0"),
    },
    create: {
      investmentAccountId: parseInt(investmentAccountId),
      month: monthDate,
      balance: parseFloat(balance),
      contributions: parseFloat(contributions || "0"),
      withdrawals: parseFloat(withdrawals || "0"),
    },
    include: { investmentAccount: true },
  });

  return NextResponse.json(snapshot);
}
