export interface CSVTransaction {
  source: string;
  account: string;
  date: string;
  description: string;
  amount_fcy: number | null;
  fcy_currency: string | null;
  accounting_amt: number;
  spend_category: string;
  master_category: string;
}

/**
 * Parse a CSV file that follows the standard 9-column format:
 * Source, Account, Date, Description, Amount in FCY, FCY Currency, Accounting Amt, Spend Category, Master Category
 */
export function parseCSV(text: string): CSVTransaction[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  // Skip header
  const header = lines[0].toLowerCase();
  const hasHeader =
    header.includes("source") ||
    header.includes("date") ||
    header.includes("description");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const transactions: CSVTransaction[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;

    // Parse CSV respecting quoted fields
    const fields = parseCSVLine(line);
    if (fields.length < 7) continue;

    const source = fields[0]?.trim() || "";
    const account = fields[1]?.trim() || "";
    const date = fields[2]?.trim() || "";
    const description = fields[3]?.trim() || "";
    const amountFcy = fields[4]?.trim() ? parseFloat(fields[4].trim()) : null;
    const fcyCurrency = fields[5]?.trim() || null;
    const accountingAmt = parseFloat(fields[6]?.trim() || "0");
    const spendCategory = fields[7]?.trim() || "";
    const masterCategory = fields[8]?.trim() || "";

    if (!source || !date || !description || isNaN(accountingAmt)) continue;

    transactions.push({
      source,
      account,
      date: normalizeDate(date),
      description,
      amount_fcy: amountFcy && !isNaN(amountFcy) ? amountFcy : null,
      fcy_currency: fcyCurrency || null,
      accounting_amt: accountingAmt,
      spend_category: spendCategory,
      master_category: masterCategory,
    });
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function normalizeDate(dateStr: string): string {
  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Handle DD/MM/YYYY or DD/MM/YY
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    let year = dmyMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}
