-- CreateTable
CREATE TABLE "master_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_excluded" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spend_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "master_category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spend_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL DEFAULT 'credit_card',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "bank_account_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount_fcy" DECIMAL(12,2),
    "fcy_currency" VARCHAR(3),
    "accounting_amt" DECIMAL(12,2) NOT NULL,
    "spend_category_id" INTEGER NOT NULL,
    "master_category_id" INTEGER NOT NULL,
    "notes" TEXT,
    "statement_upload_id" INTEGER,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_uploads" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "bank_account_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
    "raw_text" TEXT,
    "transaction_count" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "statement_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorization_rules" (
    "id" SERIAL NOT NULL,
    "pattern" TEXT NOT NULL,
    "spend_category_id" INTEGER NOT NULL,
    "master_category_id" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balances" (
    "id" SERIAL NOT NULL,
    "bank_account_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "actual_balance" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_accounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "account_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_snapshots" (
    "id" SERIAL NOT NULL,
    "investment_account_id" INTEGER NOT NULL,
    "month" DATE NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "contributions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "withdrawals" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "master_category_id" INTEGER,
    "spend_category_id" INTEGER,
    "monthly_amount" DECIMAL(12,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runway_config" (
    "id" SERIAL NOT NULL,
    "total_proceeds" DECIMAL(14,2) NOT NULL,
    "monthly_investment_target" DECIMAL(12,2) NOT NULL,
    "expected_return_rate" DECIMAL(5,4) NOT NULL,
    "projection_years" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runway_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_categories_name_key" ON "master_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "spend_categories_name_key" ON "spend_categories"("name");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_bank_account_id_date_idx" ON "transactions"("bank_account_id", "date");

-- CreateIndex
CREATE INDEX "transactions_master_category_id_date_idx" ON "transactions"("master_category_id", "date");

-- CreateIndex
CREATE INDEX "transactions_spend_category_id_idx" ON "transactions"("spend_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_bank_account_id_month_key" ON "account_balances"("bank_account_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "investment_snapshots_investment_account_id_month_key" ON "investment_snapshots"("investment_account_id", "month");

-- AddForeignKey
ALTER TABLE "spend_categories" ADD CONSTRAINT "spend_categories_master_category_id_fkey" FOREIGN KEY ("master_category_id") REFERENCES "master_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_spend_category_id_fkey" FOREIGN KEY ("spend_category_id") REFERENCES "spend_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_master_category_id_fkey" FOREIGN KEY ("master_category_id") REFERENCES "master_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_statement_upload_id_fkey" FOREIGN KEY ("statement_upload_id") REFERENCES "statement_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_uploads" ADD CONSTRAINT "statement_uploads_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_spend_category_id_fkey" FOREIGN KEY ("spend_category_id") REFERENCES "spend_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_snapshots" ADD CONSTRAINT "investment_snapshots_investment_account_id_fkey" FOREIGN KEY ("investment_account_id") REFERENCES "investment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_master_category_id_fkey" FOREIGN KEY ("master_category_id") REFERENCES "master_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_spend_category_id_fkey" FOREIGN KEY ("spend_category_id") REFERENCES "spend_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
