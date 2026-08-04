/*
  Warnings:

  - You are about to drop the column `confirmedAt` on the `Settlement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Settlement" DROP COLUMN "confirmedAt",
ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "payeeConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "payerConfirmedAt" TIMESTAMP(3);
