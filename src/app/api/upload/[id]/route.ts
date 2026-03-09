import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uploadId = parseInt(id);

  const upload = await prisma.statementUpload.findUnique({
    where: { id: uploadId },
    include: { bankAccount: true },
  });

  if (!upload) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const transactions = await prisma.transaction.findMany({
    where: { statementUploadId: uploadId },
    include: {
      bankAccount: true,
      spendCategory: true,
      masterCategory: true,
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({
    upload,
    transactions,
  });
}
