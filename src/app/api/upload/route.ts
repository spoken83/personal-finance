import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  statementUploads,
  transactions,
  bankAccounts,
  spendCategories,
  categorizationRules,
} from "@/lib/schema";
import { eq, and, ilike, not, desc, sql } from "drizzle-orm";
import { extractTextFromPDF, detectBank } from "@/lib/pdf-parser";
import { parseCSV } from "@/lib/csv-parser";
import {
  extractTransactionsFromText,
  categorizeTransactions,
  type CategorizedTransaction,
} from "@/lib/claude";
import { resolveSpendCategory } from "@/lib/categorizer";

export async function GET() {
  const uploads = await db.query.statementUploads.findMany({
    orderBy: [desc(statementUploads.uploadedAt)],
    limit: 20,
    with: {
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
  const [upload] = await db
    .insert(statementUploads)
    .values({
      filename,
      fileType,
      bankAccountId: bankAccountIdStr ? parseInt(bankAccountIdStr) : null,
      status: "processing",
    })
    .returning();

  try {
    let categorizedTransactions: CategorizedTransaction[];
    let detectedBank: { source: string; accountName: string } | null = null;

    if (fileType === "csv") {
      // CSV path: parse directly
      const text = await file.text();
      const csvTransactions = parseCSV(text);

      if (csvTransactions.length === 0) {
        await db
          .update(statementUploads)
          .set({ status: "failed" })
          .where(eq(statementUploads.id, upload.id));
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
        await db
          .update(statementUploads)
          .set({ status: "failed" })
          .where(eq(statementUploads.id, upload.id));
        return NextResponse.json(
          { error: "OPENAI_API_KEY not configured. Please set it in .env" },
          { status: 500 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfText = await extractTextFromPDF(buffer);

      // Save raw text for debugging
      await db
        .update(statementUploads)
        .set({ rawText: pdfText })
        .where(eq(statementUploads.id, upload.id));

      // Detect bank from PDF content + filename
      detectedBank = detectBank(pdfText, filename);

      // Determine bank account
      let bankSource = detectedBank?.source || "Unknown";
      let accountName = detectedBank?.accountName || "Unknown";

      if (bankAccountIdStr) {
        const ba = await db.query.bankAccounts.findFirst({
          where: eq(bankAccounts.id, parseInt(bankAccountIdStr)),
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
      const spendCats = await db.query.spendCategories.findMany({
        with: { masterCategory: true },
      });
      const rules = await db.query.categorizationRules.findMany({
        where: eq(categorizationRules.isActive, true),
        with: { spendCategory: true },
        orderBy: [desc(categorizationRules.priority)],
      });

      const categoryList = spendCats.map((sc) => ({
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
      let ba = await db.query.bankAccounts.findFirst({
        where: and(
          eq(bankAccounts.source, detectedBank.source),
          eq(bankAccounts.accountName, detectedBank.accountName)
        ),
      });
      if (!ba) {
        // Fuzzy: match account name containing the detected name, or source containing
        ba = await db.query.bankAccounts.findFirst({
          where: ilike(bankAccounts.accountName, `%${detectedBank.accountName}%`),
        });
      }
      if (!ba) {
        // Try matching by source name (e.g., "Citi" -> "Citibank")
        ba = await db.query.bankAccounts.findFirst({
          where: ilike(bankAccounts.source, `%${detectedBank.source}%`),
        });
      }
      bankAccountId = ba?.id || null;
    }

    // Update upload with bank account and transaction count
    await db
      .update(statementUploads)
      .set({
        bankAccountId,
        status: "pending_review",
        transactionCount: categorizedTransactions.length,
      })
      .where(eq(statementUploads.id, upload.id));

    // Resolve categories and create pending transactions
    const pendingTransactions = [];
    for (const tx of categorizedTransactions) {
      const resolved = await resolveSpendCategory(
        tx.spend_category,
        tx.master_category
      );

      if (!resolved) {
        // Fallback: use "Others" category
        const others = await db.query.spendCategories.findFirst({
          where: eq(spendCategories.name, "Others"),
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
    const txBankId = bankAccountId || 1;
    const cleanedUp = await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.bankAccountId, txBankId),
          eq(transactions.isConfirmed, false)
        )
      );
    if (cleanedUp.rowCount && cleanedUp.rowCount > 0) {
      console.log(`[Upload] Cleaned up ${cleanedUp.rowCount} unconfirmed transactions for bank account ${txBankId}`);
    }

    // Also mark any previous pending_review uploads for this bank as superseded
    if (bankAccountId) {
      await db
        .update(statementUploads)
        .set({ status: "superseded" })
        .where(
          and(
            eq(statementUploads.bankAccountId, bankAccountId),
            eq(statementUploads.status, "pending_review"),
            not(eq(statementUploads.id, upload.id))
          )
        );
    }

    // Save as unconfirmed transactions (skip duplicates against CONFIRMED transactions only)
    const created = [];
    const skipped = [];
    for (const tx of pendingTransactions) {
      const txDate = new Date(tx.date);

      // Only skip if a CONFIRMED transaction with same details already exists
      // Compare date as ISO string (YYYY-MM-DD) to avoid timezone mismatch
      const txDateStr = txDate.toISOString().split("T")[0];
      const existing = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.bankAccountId, txBankId),
          sql`${transactions.date} = ${txDateStr}::date`,
          eq(transactions.description, tx.description),
          eq(transactions.accountingAmt, String(tx.accounting_amt)),
          eq(transactions.isConfirmed, true)
        ),
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

      const amountFcy = (tx.amount_fcy != null && tx.amount_fcy !== "" && tx.amount_fcy !== undefined) ? String(tx.amount_fcy) : null;
      const fcyCurrency = (tx.fcy_currency && tx.fcy_currency.trim() !== "") ? tx.fcy_currency : null;
      const [transaction] = await db
        .insert(transactions)
        .values({
          bankAccountId: txBankId,
          date: txDate,
          description: tx.description,
          amountFcy,
          fcyCurrency,
          accountingAmt: String(tx.accounting_amt),
          spendCategoryId: tx.spendCategoryId,
          masterCategoryId: tx.masterCategoryId,
          statementUploadId: upload.id,
          isConfirmed: false,
        })
        .returning();

      const transactionWithRelations = await db.query.transactions.findFirst({
        where: eq(transactions.id, transaction.id),
        with: {
          bankAccount: true,
          spendCategory: true,
          masterCategory: true,
        },
      });

      created.push({
        ...transactionWithRelations,
        confidence: tx.confidence || "high",
      });
    }

    // Update upload with actual created count
    await db
      .update(statementUploads)
      .set({ transactionCount: created.length })
      .where(eq(statementUploads.id, upload.id));

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
    await db
      .update(statementUploads)
      .set({ status: "failed" })
      .where(eq(statementUploads.id, upload.id));
    return NextResponse.json(
      {
        error: "Failed to process statement",
        details: errMsg,
      },
      { status: 500 }
    );
  }
}
