import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const month = searchParams.get("month"); // YYYY-MM format

  const where: Record<string, unknown> = {};
  if (month) {
    where.month = new Date(month + "-01");
  }

  const balances = await prisma.accountBalance.findMany({
    where,
    include: { bankAccount: true },
    orderBy: [{ month: "desc" }, { bankAccountId: "asc" }],
  });

  // Also get all bank accounts for the form
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { isActive: true },
    orderBy: { source: "asc" },
  });

  // Get distinct months that have balance entries
  const monthsRaw = await prisma.accountBalance.findMany({
    select: { month: true },
    distinct: ["month"],
    orderBy: { month: "desc" },
  });
  const months = monthsRaw.map((m) => m.month.toISOString().slice(0, 7));

  return NextResponse.json({ balances, bankAccounts, months });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bankAccountId, month, actualBalance } = body;

  const monthDate = new Date(month + "-01");

  const balance = await prisma.accountBalance.upsert({
    where: {
      bankAccountId_month: {
        bankAccountId: parseInt(bankAccountId),
        month: monthDate,
      },
    },
    update: { actualBalance: parseFloat(actualBalance) },
    create: {
      bankAccountId: parseInt(bankAccountId),
      month: monthDate,
      actualBalance: parseFloat(actualBalance),
    },
    include: { bankAccount: true },
  });

  return NextResponse.json(balance);
}
