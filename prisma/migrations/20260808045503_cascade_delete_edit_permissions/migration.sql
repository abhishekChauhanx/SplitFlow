-- DropForeignKey
ALTER TABLE "EditPermission" DROP CONSTRAINT "EditPermission_expenseId_fkey";

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'upi',
ADD COLUMN     "utrNumber" TEXT;

-- AddForeignKey
ALTER TABLE "EditPermission" ADD CONSTRAINT "EditPermission_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
