/*
  Warnings:

  - You are about to drop the column `openEnrollment` on the `Kitty` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedByOrganizerAt` on the `KittyContribution` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedByPayerAt` on the `KittyContribution` table. All the data in the column will be lost.
  - You are about to drop the column `invitedEmail` on the `KittyContribution` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `KittyContribution` table. All the data in the column will be lost.
  - You are about to drop the column `refundDuePaise` on the `KittyContribution` table. All the data in the column will be lost.
  - You are about to drop the column `refundPaidAt` on the `KittyContribution` table. All the data in the column will be lost.
  - You are about to drop the column `spentAt` on the `KittyExpense` table. All the data in the column will be lost.
  - Made the column `userId` on table `KittyContribution` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "KittyContribution" DROP CONSTRAINT "KittyContribution_userId_fkey";

-- AlterTable
ALTER TABLE "Kitty" DROP COLUMN "openEnrollment",
ADD COLUMN     "collectorUpiId" TEXT,
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "KittyContribution" DROP COLUMN "confirmedByOrganizerAt",
DROP COLUMN "confirmedByPayerAt",
DROP COLUMN "invitedEmail",
DROP COLUMN "name",
DROP COLUMN "refundDuePaise",
DROP COLUMN "refundPaidAt",
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "paidAmountPaise" INTEGER,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "refundPaise" INTEGER,
ADD COLUMN     "refundStatus" TEXT,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "amountPaise" DROP DEFAULT,
ALTER COLUMN "paymentMethod" DROP NOT NULL,
ALTER COLUMN "paymentMethod" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KittyExpense" DROP COLUMN "spentAt";

-- AddForeignKey
ALTER TABLE "KittyContribution" ADD CONSTRAINT "KittyContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
