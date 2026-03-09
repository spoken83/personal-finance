import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const accounts = await prisma.investmentAccount.findMany({
    where: { isActive: true },
    include: {
      snapshots: {
        orderBy: { month: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get distinct months
  const monthsRaw = await prisma.investmentSnapshot.findMany({
    select: { month: true },
    distinct: ["month"],
    orderBy: { month: "desc" },
  });
  const months = monthsRaw.map((m) => m.month.toISOString().slice(0, 7));

  return NextResponse.json({ accounts, months });
}
