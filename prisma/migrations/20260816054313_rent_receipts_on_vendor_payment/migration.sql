-- AlterTable
ALTER TABLE "VendorCollection" ADD COLUMN     "propertyAddress" TEXT;

-- CreateTable
CREATE TABLE "RentReceipt" (
    "id" TEXT NOT NULL,
    "vendorPaymentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "landlordPan" TEXT,
    "propertyAddress" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paymentPeriodFrom" TIMESTAMP(3) NOT NULL,
    "paymentPeriodTo" TIMESTAMP(3) NOT NULL,
    "utrNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_signature',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentReceipt_vendorPaymentId_key" ON "RentReceipt"("vendorPaymentId");

-- AddForeignKey
ALTER TABLE "RentReceipt" ADD CONSTRAINT "RentReceipt_vendorPaymentId_fkey" FOREIGN KEY ("vendorPaymentId") REFERENCES "VendorPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentReceipt" ADD CONSTRAINT "RentReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentReceipt" ADD CONSTRAINT "RentReceipt_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
