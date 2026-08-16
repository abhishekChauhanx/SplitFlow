/*
  Warnings:

  - You are about to drop the column `email` on the `VendorSubscriber` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `VendorSubscriber` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[collectionId,userId]` on the table `VendorSubscriber` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `VendorSubscriber` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "VendorSubscriber_collectionId_email_key";

-- AlterTable
ALTER TABLE "VendorSubscriber" DROP COLUMN "email",
DROP COLUMN "phone",
ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VendorSubscriber_collectionId_userId_key" ON "VendorSubscriber"("collectionId", "userId");

-- AddForeignKey
ALTER TABLE "VendorSubscriber" ADD CONSTRAINT "VendorSubscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
