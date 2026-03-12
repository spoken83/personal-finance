import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// Data from the Financial Health Check sheet in Excel
const bankBalanceData: Record<string, Record<string, number>> = {
  "2025-07": {
    "OCBC 360 Account": 252105.23,
    "OCBC Statement Savings": 201,
    "Trust Card": 90,
  },
  "2025-08": {
    "OCBC 360 Account": 149454.75,
    "OCBC Statement Savings": 6446.85,
    "Trust Card": 22656,
  },
  "2025-09": {
    "OCBC 360 Account": 173000,
    "OCBC Statement Savings": 839,
    "Trust Card": 405,
  },
  "2025-10": {
    "OCBC 360 Account": 130320,
    "OCBC Statement Savings": 536,
    "Trust Card": 405,
  },
  "2025-11": {
    "OCBC 360 Account": 131275,
    "OCBC Statement Savings": 536,
    "Trust Card": 405,
    "DBS Account": 5000,
  },
  "2025-12": {
    "OCBC 360 Account": 94228,
    "OCBC Statement Savings": 384,
    "Trust Card": 395,
    "DBS Account": 5774.69,
  },
};

const investmentData: Record<string, Record<string, number>> = {
  "2025-07": {
    "SYFE Brokerage": 50000,
    "SYFE Cash Management": 200000,
    "SYFE Managed Portfolio": 1500,
  },
  "2025-08": {
    "SYFE Brokerage": 55000,
    "SYFE Cash Management": 200725,
    "SYFE Managed Portfolio": 1800,
  },
  "2025-09": {
    "SYFE Brokerage": 53816.77,
    "SYFE Cash Management": 418.65,
    "SYFE Managed Portfolio": 2307,
    "Tiger Brokers": 10000,
    "FSM Account": 150000,
  },
  "2025-10": {
    "SYFE Brokerage": 55000,
    "SYFE Cash Management": 219,
    "SYFE Managed Portfolio": 2500,
    "Tiger Brokers": 36643,
    "FSM Account": 150992,
  },
  "2025-11": {
    "SYFE Brokerage": 55000,
    "SYFE Cash Management": 219,
    "SYFE Managed Portfolio": 2500,
    "Tiger Brokers": 36643,
    "FSM Account": 150992,
    "Moomoo": 5102,
    "IBKR": 100,
  },
  "2025-12": {
    "SYFE Brokerage": 48760,
    "SYFE Cash Management": 119,
    "SYFE Managed Portfolio": 2714,
    "Tiger Brokers": 39412,
    "FSM Account": 153730,
    "Moomoo": 5078,
    "CMC Invest": 13051,
    "IBKR": 100,
  },
};

async function main() {
  // Get bank accounts
  const bankAccountsList = await db.query.bankAccounts.findMany();
  const baMap = new Map(bankAccountsList.map((ba) => [ba.accountName, ba.id]));

  // Get investment accounts
  const investmentAccountsList = await db.query.investmentAccounts.findMany();
  const iaMap = new Map(investmentAccountsList.map((ia) => [ia.name, ia.id]));

  console.log("Importing bank balances...");
  for (const [month, accounts] of Object.entries(bankBalanceData)) {
    for (const [accountName, balance] of Object.entries(accounts)) {
      const bankAccountId = baMap.get(accountName);
      if (!bankAccountId) {
        console.warn(`Bank account not found: ${accountName}`);
        continue;
      }
      await db
        .insert(schema.accountBalances)
        .values({
          bankAccountId,
          month: new Date(month + "-01"),
          actualBalance: String(balance),
        })
        .onConflictDoUpdate({
          target: [schema.accountBalances.bankAccountId, schema.accountBalances.month],
          set: { actualBalance: String(balance) },
        });
    }
  }

  console.log("Importing investment snapshots...");
  for (const [month, accounts] of Object.entries(investmentData)) {
    for (const [accountName, balance] of Object.entries(accounts)) {
      const investmentAccountId = iaMap.get(accountName);
      if (!investmentAccountId) {
        console.warn(`Investment account not found: ${accountName}`);
        continue;
      }
      await db
        .insert(schema.investmentSnapshots)
        .values({
          investmentAccountId,
          month: new Date(month + "-01"),
          balance: String(balance),
          contributions: "0",
          withdrawals: "0",
        })
        .onConflictDoUpdate({
          target: [schema.investmentSnapshots.investmentAccountId, schema.investmentSnapshots.month],
          set: { balance: String(balance) },
        });
    }
  }

  console.log("Import complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
