import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { statementUploads, transactions } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uploadId = parseInt(id);

  const upload = await db.query.statementUploads.findFirst({
    where: eq(statementUploads.id, uploadId),
    with: { bankAccount: true },
  });

  if (!upload) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const txList = await db.query.transactions.findMany({
    where: eq(transactions.statementUploadId, uploadId),
    with: {
      bankAccount: true,
      spendCategory: true,
      masterCategory: true,
    },
    orderBy: [asc(transactions.date)],
  });

  return NextResponse.json({
    upload,
    transactions: txList,
  });
}
