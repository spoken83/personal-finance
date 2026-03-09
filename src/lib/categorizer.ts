import { prisma } from "@/lib/db";

interface RuleMatch {
  spendCategoryId: number;
  spendCategoryName: string;
  masterCategoryId: number | null;
  masterCategoryName: string | null;
}

/**
 * Try to match a transaction description against saved categorization rules.
 * Returns null if no rule matches.
 */
export async function matchRule(description: string): Promise<RuleMatch | null> {
  const rules = await prisma.categorizationRule.findMany({
    where: { isActive: true },
    include: {
      spendCategory: {
        include: { masterCategory: true },
      },
    },
    orderBy: { priority: "desc" },
  });

  const lowerDesc = description.toLowerCase();

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    if (lowerDesc.includes(pattern)) {
      return {
        spendCategoryId: rule.spendCategoryId,
        spendCategoryName: rule.spendCategory.name,
        masterCategoryId: rule.masterCategoryId || rule.spendCategory.masterCategoryId,
        masterCategoryName: rule.masterCategoryId
          ? null // Would need to look up, but the caller can handle this
          : rule.spendCategory.masterCategory.name,
      };
    }
  }

  return null;
}

/**
 * Resolve a spend category name to its ID, creating if necessary.
 */
export async function resolveSpendCategory(
  name: string,
  masterCategoryName?: string
): Promise<{ spendCategoryId: number; masterCategoryId: number } | null> {
  // Normalize common variations
  const normalizedName = normalizeCategoryName(name);

  // Try exact match
  const existing = await prisma.spendCategory.findUnique({
    where: { name: normalizedName },
    include: { masterCategory: true },
  });

  if (existing) {
    // If a master category override was specified, look it up
    if (masterCategoryName) {
      const mc = await prisma.masterCategory.findUnique({
        where: { name: normalizeCategoryName(masterCategoryName) },
      });
      return {
        spendCategoryId: existing.id,
        masterCategoryId: mc?.id || existing.masterCategoryId,
      };
    }
    return {
      spendCategoryId: existing.id,
      masterCategoryId: existing.masterCategoryId,
    };
  }

  // If not found, try to create it with the given master category
  if (masterCategoryName) {
    const mc = await prisma.masterCategory.findUnique({
      where: { name: normalizeCategoryName(masterCategoryName) },
    });
    if (mc) {
      const created = await prisma.spendCategory.create({
        data: { name: normalizedName, masterCategoryId: mc.id },
      });
      return { spendCategoryId: created.id, masterCategoryId: mc.id };
    }
  }

  return null;
}

function normalizeCategoryName(name: string): string {
  const map: Record<string, string> = {
    "Repayment-Exclude": "Repayment(exclude)",
    "Internal Trf (exclude)": "Internal Trf(exclude)",
    "Final loan Payment (exclude)": "Final loan Payment(exclude)",
    "Food & Beverage": "Food & Dining",
    "Home Services": "Urban Company Cleaning",
    "Bank Fees": "Fees & Charges",
    Donation: "Charity & Donations",
    Government: "Others",
    Cash: "Cash Withdrawal",
    "Bills & Utilities": "Utilities",
    "Health & Wellness": "Healthcare",
    Fees: "Fees & Charges",
    Housing: "MCST",
    "Loan-QuickCash": "Loan Repayment",
    "Loan QuickCash": "Loan Repayment",
    Dining: "Food & Dining",
    Restaurant: "Food & Dining",
    "CC Payment": "Citi CC Repayment",
    "FIXED PAYMENT": "Fixed Payment",
  };
  return map[name.trim()] || name.trim();
}
