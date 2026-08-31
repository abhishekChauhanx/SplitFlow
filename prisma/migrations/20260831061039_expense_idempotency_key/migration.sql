/*
  Warnings:

  - A unique constraint covering the columns `[clientId]` on the table `Expense` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_clientId_key" ON "Expense"("clientId");
