import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  numeric,
  date,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Master Categories ───────────────────────────────────────────────────────

export const masterCategories = pgTable("master_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isExcluded: boolean("is_excluded").default(false).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const masterCategoriesRelations = relations(masterCategories, ({ many }) => ({
  spendCategories: many(spendCategories),
  transactions: many(transactions),
  budgets: many(budgets),
}));

// ─── Spend Categories ────────────────────────────────────────────────────────

export const spendCategories = pgTable("spend_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  masterCategoryId: integer("master_category_id").notNull().references(() => masterCategories.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const spendCategoriesRelations = relations(spendCategories, ({ one, many }) => ({
  masterCategory: one(masterCategories, {
    fields: [spendCategories.masterCategoryId],
    references: [masterCategories.id],
  }),
  transactions: many(transactions),
  rules: many(categorizationRules),
  budgets: many(budgets),
}));

// ─── Bank Accounts ───────────────────────────────────────────────────────────

export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").default("credit_card").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bankAccountsRelations = relations(bankAccounts, ({ many }) => ({
  transactions: many(transactions),
  uploads: many(statementUploads),
  balances: many(accountBalances),
}));

// ─── Transactions ────────────────────────────────────────────────────────────

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    bankAccountId: integer("bank_account_id").notNull().references(() => bankAccounts.id),
    date: date("date", { mode: "date" }).notNull(),
    description: text("description").notNull(),
    amountFcy: numeric("amount_fcy", { precision: 12, scale: 2 }),
    fcyCurrency: varchar("fcy_currency", { length: 3 }),
    accountingAmt: numeric("accounting_amt", { precision: 12, scale: 2 }).notNull(),
    spendCategoryId: integer("spend_category_id").notNull().references(() => spendCategories.id),
    masterCategoryId: integer("master_category_id").notNull().references(() => masterCategories.id),
    notes: text("notes"),
    statementUploadId: integer("statement_upload_id").references(() => statementUploads.id),
    isConfirmed: boolean("is_confirmed").default(false).notNull(),
    isAmortized: boolean("is_amortized").default(false).notNull(),
    parentTransactionId: integer("parent_transaction_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index("transactions_date_idx").on(table.date),
    index("transactions_bank_date_idx").on(table.bankAccountId, table.date),
    index("transactions_master_date_idx").on(table.masterCategoryId, table.date),
    index("transactions_spend_idx").on(table.spendCategoryId),
    index("transactions_parent_idx").on(table.parentTransactionId),
  ]
);

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  bankAccount: one(bankAccounts, {
    fields: [transactions.bankAccountId],
    references: [bankAccounts.id],
  }),
  spendCategory: one(spendCategories, {
    fields: [transactions.spendCategoryId],
    references: [spendCategories.id],
  }),
  masterCategory: one(masterCategories, {
    fields: [transactions.masterCategoryId],
    references: [masterCategories.id],
  }),
  statementUpload: one(statementUploads, {
    fields: [transactions.statementUploadId],
    references: [statementUploads.id],
  }),
  parentTransaction: one(transactions, {
    fields: [transactions.parentTransactionId],
    references: [transactions.id],
    relationName: "amortizationSplit",
  }),
  childTransactions: many(transactions, { relationName: "amortizationSplit" }),
}));

// ─── Statement Uploads ───────────────────────────────────────────────────────

export const statementUploads = pgTable("statement_uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  fileType: varchar("file_type", { length: 10 }).notNull(),
  bankAccountId: integer("bank_account_id").references(() => bankAccounts.id),
  status: varchar("status", { length: 20 }).default("processing").notNull(),
  rawText: text("raw_text"),
  transactionCount: integer("transaction_count"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
});

export const statementUploadsRelations = relations(statementUploads, ({ one, many }) => ({
  bankAccount: one(bankAccounts, {
    fields: [statementUploads.bankAccountId],
    references: [bankAccounts.id],
  }),
  transactions: many(transactions),
}));

// ─── Categorization Rules ────────────────────────────────────────────────────

export const categorizationRules = pgTable("categorization_rules", {
  id: serial("id").primaryKey(),
  pattern: text("pattern").notNull(),
  spendCategoryId: integer("spend_category_id").notNull().references(() => spendCategories.id),
  masterCategoryId: integer("master_category_id"),
  priority: integer("priority").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categorizationRulesRelations = relations(categorizationRules, ({ one }) => ({
  spendCategory: one(spendCategories, {
    fields: [categorizationRules.spendCategoryId],
    references: [spendCategories.id],
  }),
}));

// ─── Account Balances ────────────────────────────────────────────────────────

export const accountBalances = pgTable(
  "account_balances",
  {
    id: serial("id").primaryKey(),
    bankAccountId: integer("bank_account_id").notNull().references(() => bankAccounts.id),
    month: date("month", { mode: "date" }).notNull(),
    actualBalance: numeric("actual_balance", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    unique("account_balances_bank_month_unique").on(table.bankAccountId, table.month),
  ]
);

export const accountBalancesRelations = relations(accountBalances, ({ one }) => ({
  bankAccount: one(bankAccounts, {
    fields: [accountBalances.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

// ─── Investment Accounts ─────────────────────────────────────────────────────

export const investmentAccounts = pgTable("investment_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  accountType: text("account_type"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const investmentAccountsRelations = relations(investmentAccounts, ({ many }) => ({
  snapshots: many(investmentSnapshots),
}));

// ─── Investment Snapshots ────────────────────────────────────────────────────

export const investmentSnapshots = pgTable(
  "investment_snapshots",
  {
    id: serial("id").primaryKey(),
    investmentAccountId: integer("investment_account_id").notNull().references(() => investmentAccounts.id),
    month: date("month", { mode: "date" }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    contributions: numeric("contributions", { precision: 14, scale: 2 }).default("0").notNull(),
    withdrawals: numeric("withdrawals", { precision: 14, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    unique("investment_snapshots_account_month_unique").on(table.investmentAccountId, table.month),
  ]
);

export const investmentSnapshotsRelations = relations(investmentSnapshots, ({ one }) => ({
  investmentAccount: one(investmentAccounts, {
    fields: [investmentSnapshots.investmentAccountId],
    references: [investmentAccounts.id],
  }),
}));

// ─── Budgets ─────────────────────────────────────────────────────────────────

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  masterCategoryId: integer("master_category_id").references(() => masterCategories.id),
  spendCategoryId: integer("spend_category_id").references(() => spendCategories.id),
  monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from", { mode: "date" }).notNull(),
  effectiveTo: date("effective_to", { mode: "date" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgetsRelations = relations(budgets, ({ one }) => ({
  masterCategory: one(masterCategories, {
    fields: [budgets.masterCategoryId],
    references: [masterCategories.id],
  }),
  spendCategory: one(spendCategories, {
    fields: [budgets.spendCategoryId],
    references: [spendCategories.id],
  }),
}));

// ─── Runway Config ───────────────────────────────────────────────────────────

export const runwayConfig = pgTable("runway_config", {
  id: serial("id").primaryKey(),
  totalProceeds: numeric("total_proceeds", { precision: 14, scale: 2 }).notNull(),
  monthlyInvestmentTarget: numeric("monthly_investment_target", { precision: 12, scale: 2 }).notNull(),
  expectedReturnRate: numeric("expected_return_rate", { precision: 5, scale: 4 }).notNull(),
  projectionYears: integer("projection_years").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});
