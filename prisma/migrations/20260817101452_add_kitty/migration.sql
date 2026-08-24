-- CreateTable
CREATE TABLE "Kitty" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetPaise" INTEGER NOT NULL,
    "organizerId" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'collecting',
    "token" TEXT NOT NULL,
    "openEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kitty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KittyContribution" (
    "id" TEXT NOT NULL,
    "kittyId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'upi',
    "utrNumber" TEXT,
    "confirmedByPayerAt" TIMESTAMP(3),
    "confirmedByOrganizerAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "refundDuePaise" INTEGER,
    "refundPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KittyContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KittyExpense" (
    "id" TEXT NOT NULL,
    "kittyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "spentById" TEXT NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KittyExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kitty_token_key" ON "Kitty"("token");

-- CreateIndex
CREATE UNIQUE INDEX "KittyContribution_kittyId_userId_key" ON "KittyContribution"("kittyId", "userId");

-- AddForeignKey
ALTER TABLE "Kitty" ADD CONSTRAINT "Kitty_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KittyContribution" ADD CONSTRAINT "KittyContribution_kittyId_fkey" FOREIGN KEY ("kittyId") REFERENCES "Kitty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KittyContribution" ADD CONSTRAINT "KittyContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KittyExpense" ADD CONSTRAINT "KittyExpense_kittyId_fkey" FOREIGN KEY ("kittyId") REFERENCES "Kitty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KittyExpense" ADD CONSTRAINT "KittyExpense_spentById_fkey" FOREIGN KEY ("spentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
