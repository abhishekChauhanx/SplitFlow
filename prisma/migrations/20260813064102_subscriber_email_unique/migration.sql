/*
  Warnings:

  - A unique constraint covering the columns `[collectionId,email]` on the table `VendorSubscriber` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "VendorSubscriber_collectionId_email_key" ON "VendorSubscriber"("collectionId", "email");
