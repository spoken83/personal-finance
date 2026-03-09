export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Lazy require to avoid pdf-parse v1 loading test PDF at module init
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Detect which bank a statement belongs to based on PDF text content
 */
export function detectBank(
  text: string,
  filename: string
): { source: string; accountName: string } | null {
  const lowerText = text.toLowerCase();
  const lowerFile = filename.toLowerCase();

  // OCBC Consolidated Statement — must check BEFORE Citibank because OCBC
  // consolidated statements contain transaction descriptions mentioning "Citibank"
  // (e.g., "FAST PAYMENT to Citibank miles(n) CCRD-Credit Card Payment")
  if (
    lowerFile.includes("consolidated") ||
    (lowerText.includes("ocbc") && lowerText.includes("consolidated"))
  ) {
    // Detect specific OCBC account type
    if (lowerText.includes("statement savings")) {
      return { source: "OCBC", accountName: "OCBC Statement Savings" };
    }
    return { source: "OCBC", accountName: "OCBC 360 Account" };
  }

  // OCBC (non-consolidated)
  if (lowerFile.includes("ocbc") || lowerText.includes("oversea-chinese banking")) {
    if (lowerText.includes("statement savings")) {
      return { source: "OCBC", accountName: "OCBC Statement Savings" };
    }
    return { source: "OCBC", accountName: "OCBC 360 Account" };
  }

  // Citibank PremierMiles
  if (
    lowerFile.includes("premmiles") ||
    lowerFile.includes("premiermiles") ||
    (lowerText.includes("citibank") && lowerText.includes("premiermiles"))
  ) {
    return { source: "Citibank", accountName: "Citi PremierMiles" };
  }

  // Citibank Rewards
  if (
    lowerFile.includes("citi_rewards") ||
    lowerFile.includes("rewards") ||
    (lowerText.includes("citibank") && lowerText.includes("rewards"))
  ) {
    return { source: "Citibank", accountName: "Citi Rewards" };
  }

  // Generic Citibank (only match filename, not text — text may mention Citi in descriptions)
  if (lowerFile.includes("citi")) {
    return { source: "Citibank", accountName: "Citi Rewards" };
  }

  // Trust Bank
  if (
    lowerText.includes("trust bank") ||
    lowerText.includes("trust card") ||
    lowerFile.includes("trust")
  ) {
    return { source: "Trust Bank", accountName: "Trust Card" };
  }

  // DBS
  if (lowerText.includes("dbs") || lowerFile.includes("dbs")) {
    return { source: "DBS", accountName: "DBS Account" };
  }

  return null;
}
