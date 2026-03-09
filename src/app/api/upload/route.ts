import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractTextFromPDF, detectBank } from "@/lib/pdf-parser";
import { parseCSV } from "@/lib/csv-parser";
import {
  extractTransactionsFromText,
  categorizeTransactions,
  type CategorizedTransaction,
} from "@/lib/claude";
import { resolveSpendCategory } from "@/lib/categorizer";

export async function GET() {
  const uploads = await prisma.statementUpload.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 20,
    include: {
      bankAccount: true,
    },
  });

  return NextResponse.json(uploads);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bankAccountIdStr = formData.get("bankAccountId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const filename = file.name;
  const fileType = filename.endsWith(".pdf") ? "pdf" : "csv";

  // Create upload record
  const upload = await prisma.statementUpload.create({
    data: {
      filename,
      fileType,
      bankAccountId: bankAccountIdStr ? parseInt(bankAccountIdStr) : null,
      status: "processing",
    },
  });

  try {
    let categorizedTransactions: CategorizedTransaction[];
    let detectedBank: { source: string; accountName: string } | null = null;

    if (fileType === "csv") {
      // CSV path: parse directly
      const text = await file.text();
      const csvTransactions = parseCSV(text);

      if (csvTransactions.length === 0) {
        await prisma.statementUpload.update({
          where: { id: upload.id },
          data: { status: "failed" },
        });
        return NextResponse.json(
          { error: "No transactions found in CSV" },
          { status: 400 }
        );
      }

      // CSV already has categories, convert to CategorizedTransaction format
      categorizedTransactions = csvTransactions.map((tx) => ({
        date: tx.date,
        description: tx.description,
        amount_fcy: tx.amount_fcy,
        fcy_currency: tx.fcy_currency,
        accounting_amt: tx.accounting_amt,
        spend_category: tx.spend_category,
        master_category: tx.master_category,
        confidence: "high" as const,
      }));

      detectedBank = {
        source: csvTransactions[0].source,
        accountName: csvTransactions[0].account,
      };
    } else {
      // PDF path: extract text -> Claude extract -> Claude categorize
      if (!process.env.OPENAI_API_KEY) {
        await prisma.statementUpload.update({
          where: { id: upload.id },
          data: { status: "failed" },
        });
        return NextResponse.json(
          { error: "OPENAI_API_KEY not configured. Please set it in .env" },
          { status: 500 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfText = await extractTextFromPDF(buffer);

      // Save raw text for debugging
      await prisma.statementUpload.update({
        where: { id: upload.id },
        data: { rawText: pdfText },
      });

      // Detect bank from PDF content + filename
      detectedBank = detectBank(pdfText, filename);

      // Determine bank account
      let bankSource = detectedBank?.source || "Unknown";
      let accountName = detectedBank?.accountName || "Unknown";

      if (bankAccountIdStr) {
        const ba = await prisma.bankAccount.findUnique({
          where: { id: parseInt(bankAccountIdStr) },
        });
        if (ba) {
          bankSource = ba.source;
          accountName = ba.accountName;
        }
      }

      // Stage 1: Extract transactions via Claude
      const extracted = await extractTransactionsFromText(
        pdfText,
        bankSource,
        accountName,
        filename
      );

      // Stage 2: Categorize via Claude
      // Load categories and rules for the prompt
      const spendCategories = await prisma.spendCategory.findMany({
        include: { masterCategory: true },
      });
      const rules = await prisma.categorizationRule.findMany({
        where: { isActive: true },
        include: { spendCategory: true },
        orderBy: { priority: "desc" },
      });

      const categoryList = spendCategories.map((sc) => ({
        spend: sc.name,
        master: sc.masterCategory.name,
      }));

      const ruleList = rules.map((r) => ({
        pattern: r.pattern,
        spend_category: r.spendCategory.name,
      }));

      categorizedTransactions = await categorizeTransactions(
        extracted,
        categoryList,
        ruleList
      );
    }

    // Resolve bank account ID
    let bankAccountId = bankAccountIdStr ? parseInt(bankAccountIdStr) : null;
    if (!bankAccountId && detectedBank) {
      // Try exact match first, then fuzzy match on account name
      let ba = await prisma.bankAccount.findFirst({
        where: {
          source: detectedBank.source,
          accountName: detectedBank.accountName,
        },
      });
      if (!ba) {
        // Fuzzy: match account name containing the detected name, or source containing
        ba = await prisma.bankAccount.findFirst({
          where: {
            accountName: { contains: detectedBank.accountName, mode: "insensitive" },
          },
        });
      }
      if (!ba) {
        // Try matching by source name (e.g., "Citi" -> "Citibank")
        ba = await prisma.bankAccount.findFirst({
          where: {
            source: { contains: detectedBank.source, mode: "insensitive" },
          },
        });
      }
      bankAccountId = ba?.id || null;
    }

    // Update upload with bank account and transaction count
    await prisma.statementUpload.update({
      where: { id: upload.id },
      data: {
        bankAccountId,
        status: "pending_review",
        transactionCount: categorizedTransactions.length,
      },
    });

    // Resolve categories and create pending transactions
    const pendingTransactions = [];
    for (const tx of categorizedTransactions) {
      const resolved = await resolveSpendCategory(
        tx.spend_category,
        tx.master_category
      );

      if (!resolved) {
        // Fallback: use "Others" category
        const others = await prisma.spendCategory.findFirst({
          where: { name: "Others" },
        });
        if (others) {
          pendingTransactions.push({
            ...tx,
            spendCategoryId: others.id,
            masterCategoryId: others.masterCategoryId,
          });
        }
        continue;
      }

      pendingTransactions.push({
        ...tx,
        spendCategoryId: resolved.spendCategoryId,
        masterCategoryId: resolved.masterCategoryId,
      });
    }

    // Clean up unconfirmed transactions from previous uploads to this bank account
    // This handles the case where user uploaded, didn't confirm, and re-uploads
    const txBankId = bankAccountId || 1;
    const cleanedUp = await prisma.transaction.deleteMany({
      where: {
        bankAccountId: txBankId,
        isConfirmed: false,
      },
    });
    if (cleanedUp.count > 0) {
      console.log(`[Upload] Cleaned up ${cleanedUp.count} unconfirmed transactions for bank account ${txBankId}`);
    }

    // Also mark any previous pending_review uploads for this bank as superseded
    await prisma.statementUpload.updateMany({
      where: {
        bankAccountId,
        status: "pending_review",
        id: { not: upload.id },
      },
      data: { status: "superseded" },
    });

    // Save as unconfirmed transactions (skip duplicates against CONFIRMED transactions only)
    const created = [];
    const skipped = [];
    for (const tx of pendingTransactions) {
      const txDate = new Date(tx.date);

      // Only skip if a CONFIRMED transaction with same details already exists
      const existing = await prisma.transaction.findFirst({
        where: {
          bankAccountId: txBankId,
          date: txDate,
          description: tx.description,
          accountingAmt: tx.accounting_amt,
          isConfirmed: true,
        },
      });

      if (existing) {
        skipped.push({
          date: tx.date,
          description: tx.description,
          amount: tx.accounting_amt,
          reason: "duplicate",
          existingId: existing.id,
        });
        continue;
      }

      const transaction = await prisma.transaction.create({
        data: {
          bankAccountId: txBankId,
          date: txDate,
          description: tx.description,
          amountFcy: tx.amount_fcy,
          fcyCurrency: tx.fcy_currency,
          accountingAmt: tx.accounting_amt,
          spendCategoryId: tx.spendCategoryId,
          masterCategoryId: tx.masterCategoryId,
          statementUploadId: upload.id,
          isConfirmed: false,
        },
        include: {
          bankAccount: true,
          spendCategory: true,
          masterCategory: true,
        },
      });
      created.push({
        ...transaction,
        confidence: tx.confidence || "high",
      });
    }

    // Update upload with actual created count
    await prisma.statementUpload.update({
      where: { id: upload.id },
      data: { transactionCount: created.length },
    });

    console.log(`[Upload] ${filename}: GPT extracted ${categorizedTransactions.length} transactions, resolved ${pendingTransactions.length}, created ${created.length}, skipped ${skipped.length} duplicates`);

    return NextResponse.json({
      uploadId: upload.id,
      filename,
      fileType,
      detectedBank,
      transactionCount: created.length,
      skippedCount: skipped.length,
      skipped: skipped.length > 0 ? skipped : undefined,
      transactions: created,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("Upload processing error:", errMsg);
    if (errStack) console.error(errStack);
    await prisma.statementUpload.update({
      where: { id: upload.id },
      data: { status: "failed" },
    });
    return NextResponse.json(
      {
        error: "Failed to process statement",
        details: errMsg,
      },
      { status: 500 }
    );
  }
}
