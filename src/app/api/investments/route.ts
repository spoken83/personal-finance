import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { investmentAccounts, investmentSnapshots } from "@/lib/schema";
import { eq, asc, desc } from "drizzle-orm";

export async function GET() {
  const accounts = await db.query.investmentAccounts.findMany({
    where: eq(investmentAccounts.isActive, true),
    with: {
      snapshots: {
        orderBy: [desc(investmentSnapshots.month)],
      },
    },
    orderBy: [asc(investmentAccounts.name)],
  });

  // Get distinct months
  const monthsRaw = await db
    .selectDistinct({ month: investmentSnapshots.month })
    .from(investmentSnapshots)
    .orderBy(desc(investmentSnapshots.month));
  const months = monthsRaw.map((m) => m.month.toISOString().slice(0, 7));

  return NextResponse.json({ accounts, months });
}
