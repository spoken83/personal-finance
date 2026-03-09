-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "is_amortized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_transaction_id" INTEGER;

-- CreateIndex
CREATE INDEX "transactions_parent_transaction_id_idx" ON "transactions"("parent_transaction_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_transaction_id_fkey" FOREIGN KEY ("parent_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
