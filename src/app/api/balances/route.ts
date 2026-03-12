import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accountBalances, bankAccounts } from "@/lib/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const month = searchParams.get("month"); // YYYY-MM format

  const conditions = [];
  if (month) {
    conditions.push(eq(accountBalances.month, new Date(month + "-01")));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const balances = await db.query.accountBalances.findMany({
    where,
    with: { bankAccount: true },
    orderBy: [desc(accountBalances.month), asc(accountBalances.bankAccountId)],
  });

  // Also get all bank accounts for the form
  const bankAccountList = await db.query.bankAccounts.findMany({
    where: eq(bankAccounts.isActive, true),
    orderBy: [asc(bankAccounts.source)],
  });

  // Get distinct months that have balance entries
  const monthsRaw = await db
    .selectDistinct({ month: accountBalances.month })
    .from(accountBalances)
    .orderBy(desc(accountBalances.month));
  const months = monthsRaw.map((m) => m.month.toISOString().slice(0, 7));

  return NextResponse.json({ balances, bankAccounts: bankAccountList, months });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bankAccountId, month, actualBalance } = body;

  const monthDate = new Date(month + "-01");
  const bankAcctId = parseInt(bankAccountId);
  const balanceStr = parseFloat(actualBalance).toString();

  const [balance] = await db
    .insert(accountBalances)
    .values({
      bankAccountId: bankAcctId,
      month: monthDate,
      actualBalance: balanceStr,
    })
    .onConflictDoUpdate({
      target: [accountBalances.bankAccountId, accountBalances.month],
      set: { actualBalance: balanceStr },
    })
    .returning();

  const balanceWithRelation = await db.query.accountBalances.findFirst({
    where: eq(accountBalances.id, balance.id),
    with: { bankAccount: true },
  });

  return NextResponse.json(balanceWithRelation);
}
