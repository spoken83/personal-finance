import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding master categories...");

  const masterCategories = [
    { name: "Expense", isExcluded: false, displayOrder: 1 },
    { name: "Business Expense", isExcluded: false, displayOrder: 2 },
    { name: "Fixed Payment", isExcluded: false, displayOrder: 3 },
    { name: "Rental", isExcluded: false, displayOrder: 4 },
    { name: "Adhoc", isExcluded: false, displayOrder: 5 },
    { name: "Investment", isExcluded: false, displayOrder: 6 },
    { name: "Money In", isExcluded: false, displayOrder: 7 },
    { name: "Repayment(exclude)", isExcluded: true, displayOrder: 8 },
    { name: "Internal Trf(exclude)", isExcluded: true, displayOrder: 9 },
    { name: "Final loan Payment(exclude)", isExcluded: true, displayOrder: 10 },
  ];

  const mcMap: Record<string, number> = {};
  for (const mc of masterCategories) {
    const created = await prisma.masterCategory.upsert({
      where: { name: mc.name },
      update: { isExcluded: mc.isExcluded, displayOrder: mc.displayOrder },
      create: mc,
    });
    mcMap[mc.name] = created.id;
  }

  console.log("Seeding spend categories...");

  // Spend category -> Master category mapping from actual data
  const spendCategoryMap: Record<string, string> = {
    // Expense
    "Food & Dining": "Expense",
    "Food & Dining(MY)": "Expense",
    Shopping: "Expense",
    "Shopping(MY)": "Expense",
    Transport: "Expense",
    "Transport(MY)": "Expense",
    Groceries: "Expense",
    "Groceries(MY)": "Expense",
    Healthcare: "Expense",
    "Healthcare(MY)": "Expense",
    Petrol: "Expense",
    Subscriptions: "Expense",
    Entertainment: "Expense",
    "Entertainment(MY)": "Expense",
    Others: "Expense",
    "Fees & Charges": "Expense",
    "Sports/Leisure": "Expense",
    "Cash Withdrawal": "Expense",
    "Charity & Donations": "Expense",
    "Urban Company Cleaning": "Expense",

    // Business Expense
    Replit: "Business Expense",
    OpenAI: "Business Expense",
    Cursor: "Business Expense",
    GoDaddy: "Business Expense",
    Google: "Business Expense",
    LinkedIn: "Business Expense",
    Zoho: "Business Expense",
    JohnLee: "Business Expense",
    Windsurf: "Business Expense",
    "AI (Elevenlabs)": "Business Expense",
    "AI Vid (Opus)": "Business Expense",
    "Polygon Marketdata": "Business Expense",
    "ZenOptions subscription": "Business Expense",
    "????": "Business Expense",

    // Fixed Payment
    Insurance: "Fixed Payment",
    "Car Loan": "Fixed Payment",
    Tax: "Fixed Payment",
    "Parents  Allowance": "Fixed Payment",
    MCST: "Fixed Payment",
    "Education/Children": "Fixed Payment",
    Education: "Fixed Payment",
    Utilities: "Fixed Payment",
    "Loan Repayment": "Fixed Payment",
    "Study loan Repayment": "Fixed Payment",
    Roadtax: "Fixed Payment",

    // Rental
    Rental: "Rental",

    // Adhoc
    "ChiangMai Trip": "Adhoc",
    "Harbin Travel": "Adhoc",
    "Moving/Relocation": "Adhoc",
    "Relocation/Moving": "Adhoc",
    "Cleaning(Ricky)": "Adhoc",
    "Annabel's Present": "Adhoc",
    "Annabel Repayment": "Adhoc",

    // Investment
    Investment: "Investment",
    "Investment (SRS)": "Investment",
    "Investment Redemption": "Investment",

    // Money In
    "Salary Income": "Money In",
    "Sales Proceeds": "Money In",
    "Income/Dividend": "Money In",
    "Interest Income": "Money In",
    Income: "Money In",
    "Insurance Payout": "Money In",
    "Investment Income": "Money In",
    Cashback: "Money In",
    "Transfer In": "Money In",
    "Income/Transfer": "Money In",

    // Repayment(exclude)
    "Repayment(exclude)": "Repayment(exclude)",
    "Repayment-Exclude": "Repayment(exclude)",
    "Credit Card Payment": "Repayment(exclude)",
    "Credit Payment": "Repayment(exclude)",
    "Citi CC Repayment": "Repayment(exclude)",
    "Trust Credit Payment": "Repayment(exclude)",

    // Internal Trf(exclude)
    "Internal Transfer": "Internal Trf(exclude)",
    "Salary Transfer": "Internal Trf(exclude)",
    "Family Transfer": "Internal Trf(exclude)",
    Transfer: "Internal Trf(exclude)",

    // Final loan Payment(exclude)
    "Butler Loan Repayment": "Final loan Payment(exclude)",
    "Debt repayment": "Final loan Payment(exclude)",
  };

  for (const [name, masterName] of Object.entries(spendCategoryMap)) {
    await prisma.spendCategory.upsert({
      where: { name },
      update: { masterCategoryId: mcMap[masterName] },
      create: { name, masterCategoryId: mcMap[masterName] },
    });
  }

  console.log("Seeding bank accounts...");

  const bankAccounts = [
    { source: "Citibank", accountName: "Citi Rewards", accountType: "credit_card" },
    { source: "Citibank", accountName: "Citi PremierMiles", accountType: "credit_card" },
    { source: "OCBC", accountName: "OCBC 360 Account", accountType: "savings" },
    { source: "OCBC", accountName: "OCBC Statement Savings", accountType: "savings" },
    { source: "Trust Bank", accountName: "Trust Card", accountType: "debit_card" },
    { source: "DBS", accountName: "DBS Account", accountType: "savings" },
  ];

  for (const ba of bankAccounts) {
    await prisma.bankAccount.upsert({
      where: { id: bankAccounts.indexOf(ba) + 1 },
      update: ba,
      create: ba,
    });
  }

  console.log("Seeding investment accounts...");

  const investmentAccounts = [
    { name: "SYFE Brokerage", provider: "SYFE", accountType: "brokerage" },
    { name: "SYFE Cash Management", provider: "SYFE", accountType: "cash_management" },
    { name: "SYFE Managed Portfolio", provider: "SYFE", accountType: "managed_portfolio" },
    { name: "Tiger Brokers", provider: "Tiger", accountType: "brokerage" },
    { name: "FSM Account", provider: "FSM", accountType: "brokerage" },
    { name: "Moomoo", provider: "Moomoo", accountType: "brokerage" },
    { name: "CMC Invest", provider: "CMC", accountType: "brokerage" },
    { name: "IBKR", provider: "IBKR", accountType: "brokerage" },
    { name: "Stashaway SRS", provider: "Stashaway", accountType: "SRS" },
    { name: "Synergy", provider: "Synergy", accountType: "endowment" },
    { name: "Pru Endowment", provider: "Prudential", accountType: "endowment" },
  ];

  for (const ia of investmentAccounts) {
    await prisma.investmentAccount.upsert({
      where: { id: investmentAccounts.indexOf(ia) + 1 },
      update: ia,
      create: ia,
    });
  }

  // Seed runway config
  await prisma.runwayConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      totalProceeds: 522782.06,
      monthlyInvestmentTarget: 15000,
      expectedReturnRate: 0.06,
      projectionYears: 10,
    },
  });

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
