-- CreateTable
CREATE TABLE "RentReceipt" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
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
CREATE UNIQUE INDEX "RentReceipt_settlementId_key" ON "RentReceipt"("settlementId");

-- AddForeignKey
ALTER TABLE "RentReceipt" ADD CONSTRAINT "RentReceipt_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentReceipt" ADD CONSTRAINT "RentReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentReceipt" ADD CONSTRAINT "RentReceipt_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
