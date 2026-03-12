import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { investmentSnapshots } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { investmentAccountId, month, balance, contributions, withdrawals } = body;

  const monthDate = new Date(month + "-01");
  const invAcctId = parseInt(investmentAccountId);

  const values = {
    investmentAccountId: invAcctId,
    month: monthDate,
    balance: parseFloat(balance).toString(),
    contributions: parseFloat(contributions || "0").toString(),
    withdrawals: parseFloat(withdrawals || "0").toString(),
  };

  const [snapshot] = await db
    .insert(investmentSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: [investmentSnapshots.investmentAccountId, investmentSnapshots.month],
      set: {
        balance: values.balance,
        contributions: values.contributions,
        withdrawals: values.withdrawals,
      },
    })
    .returning();

  const snapshotWithRelation = await db.query.investmentSnapshots.findFirst({
    where: eq(investmentSnapshots.id, snapshot.id),
    with: { investmentAccount: true },
  });

  return NextResponse.json(snapshotWithRelation);
}
