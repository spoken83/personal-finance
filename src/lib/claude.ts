import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedTransaction {
  date: string;
  description: string;
  amount_fcy: number | null;
  fcy_currency: string | null;
  accounting_amt: number;
}

export interface CategorizedTransaction extends ExtractedTransaction {
  spend_category: string;
  master_category: string;
  confidence: "high" | "medium" | "low";
}

function parseJsonResponse(text: string): unknown {
  let jsonText = text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(jsonText);
}

/**
 * Infer statement period from filename for date hints.
 * e.g., "citiMile_eStatement_Feb2026.pdf" → { month: "February", year: 2026 }
 */
function inferStatementPeriod(filename: string): { month: string; year: number } | null {
  const monthNames: Record<string, string> = {
    jan: "January", feb: "February", mar: "March", apr: "April",
    may: "May", jun: "June", jul: "July", aug: "August",
    sep: "September", oct: "October", nov: "November", dec: "December",
  };

  // Match patterns like "Jan2026", "Feb_2026", "Jan-26", "Jan 2026"
  const match = filename.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[_\-\s]?(\d{4}|\d{2})/i);
  if (!match) return null;

  const month = monthNames[match[1].toLowerCase()];
  let year = parseInt(match[2]);
  if (year < 100) year += 2000;
  return month && year ? { month, year } : null;
}

/**
 * Stage 1: Extract transactions from bank statement text
 */
export async function extractTransactionsFromText(
  text: string,
  bankSource: string,
  accountName: string,
  filename?: string
): Promise<ExtractedTransaction[]> {
  const period = filename ? inferStatementPeriod(filename) : null;
  const periodHint = period
    ? `\n\nIMPORTANT DATE CONTEXT: This is the ${period.month} ${period.year} statement. ` +
      `Transactions will typically fall in ${period.month} ${period.year} or the preceding month. ` +
      `If the statement only shows "dd MMM" without a year, use ${period.year} (or ${period.year - 1} for the previous month if it's a prior-month transaction). ` +
      `Do NOT use any other year.`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0,
    max_tokens: 16384,
    messages: [
      {
        role: "system",
        content: `You are a bank statement parser for Singapore bank statements. Extract every transaction from the provided statement text into structured JSON.

For each transaction, extract:
- date: in YYYY-MM-DD format
- description: merchant/payee name, cleaned up (remove extra spaces, card numbers, reference codes)
- amount_fcy: foreign currency amount if applicable, null otherwise
- fcy_currency: 3-letter currency code if applicable (USD, THB, MYR, AUD, etc.), null otherwise
- accounting_amt: SGD amount. IMPORTANT: Use negative for debits/expenses/payments, positive for credits/income/refunds/payments received.

The statement is from: ${bankSource} - ${accountName}${periodHint}

Bank-specific notes:
- Citibank: May show FCY transactions with conversion rates. "CR" suffix or "PAYMENT" entries are credits (positive). Interest charges are debits (negative). Citibank statements often only show "dd MMM" without the year — you MUST infer the correct year from the statement period.
- OCBC: Consolidated statement may cover multiple accounts (360 Account + Statement Savings). Include all transactions.
- Trust Bank: Single card format. Cashback entries are credits (positive).

IMPORTANT: Only extract actual transactions. Do NOT include:
- Statement summary lines, balance lines, payment due notices
- Minimum payment amounts, credit limit info
- Rewards/points summaries
- Header/footer text

Return ONLY a valid JSON array. No markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Extract all transactions from this ${bankSource} ${accountName} statement:\n\n${text}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const transactions = parseJsonResponse(content) as ExtractedTransaction[];

  // Post-processing: fix obviously wrong years based on statement period
  if (period) {
    const expectedYear = period.year;
    const prevYear = expectedYear - 1;
    for (const tx of transactions) {
      const match = tx.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) continue;
      const txYear = parseInt(match[1]);
      // If the year is off by more than 1 from expected, fix it
      if (txYear !== expectedYear && txYear !== prevYear) {
        const txMonth = parseInt(match[2]);
        // Determine if this should be current year or previous year
        // Statement month index (1-based)
        const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
        const stmtMonthIdx = monthNames.indexOf(period.month.toLowerCase()) + 1;
        // If tx month is after the statement month, it's likely from the previous year
        const correctYear = txMonth > stmtMonthIdx ? prevYear : expectedYear;
        tx.date = `${correctYear}-${match[2]}-${match[3]}`;
        console.log(`[Date Fix] ${txYear}-${match[2]}-${match[3]} → ${tx.date} (statement: ${period.month} ${expectedYear})`);
      }
    }
  }

  return transactions;
}

/**
 * Stage 2: Categorize extracted transactions
 */
export async function categorizeTransactions(
  transactions: ExtractedTransaction[],
  categories: { spend: string; master: string }[],
  rules: { pattern: string; spend_category: string; master_category?: string }[]
): Promise<CategorizedTransaction[]> {
  const categoryList = categories
    .map((c) => `  "${c.spend}" → ${c.master}`)
    .join("\n");

  const ruleList =
    rules.length > 0
      ? rules
          .map(
            (r) =>
              `  Pattern "${r.pattern}" → Spend: "${r.spend_category}"${
                r.master_category ? `, Master: "${r.master_category}"` : ""
              }`
          )
          .join("\n")
      : "  (No custom rules yet)";

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0,
    max_tokens: 16384,
    messages: [
      {
        role: "system",
        content: `You are a personal finance categorizer for a Singapore-based user. Categorize each transaction using ONLY the provided category list.

SPEND CATEGORIES (with their default MASTER CATEGORY):
${categoryList}

USER'S CUSTOM CATEGORIZATION RULES (highest priority):
${ruleList}

For each transaction, return:
- All original fields (date, description, amount_fcy, fcy_currency, accounting_amt)
- spend_category: exact name from the list above
- master_category: exact name from the list above
- confidence: "high", "medium", or "low"

CATEGORIZATION RULES:
1. Apply custom rules first (pattern matching on description)
2. Developer/business tools (Replit, OpenAI, Cursor, GoDaddy, LinkedIn, Google Cloud, Windsurf, ElevenLabs, Zoho) → Business Expense
3. Credit card repayments (FAST INCOMING PAYMENT, FAST PAYMENT to Citi/Trust, Credit Payment) → Repayment(exclude)
4. Transfers between own accounts → Internal Trf(exclude)
5. Recurring monthly bills (insurance, car loan, tax, tuition, allowance to parents) → Fixed Payment
6. Food merchants (restaurants, cafes, food delivery, hawker centres) → Food & Dining → Expense
7. Transport (Grab, TADA, GoJek, Bus/MRT, petrol) → Transport or Petrol → Expense
8. Shopping (Shopee, Amazon, retail stores) → Shopping → Expense
9. Salary/income/dividend → appropriate Money In category
10. Investment transactions (SYFE, Tiger, FSM, fund transfers for investing) → Investment
11. If uncertain, use confidence: "low" and your best guess

Return ONLY a valid JSON array. No markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Categorize these transactions:\n${JSON.stringify(transactions, null, 2)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  return parseJsonResponse(content) as CategorizedTransaction[];
}
