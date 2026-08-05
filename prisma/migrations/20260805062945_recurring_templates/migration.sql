-- AlterEnum
ALTER TYPE "SplitType" ADD VALUE 'SHARES';

-- CreateTable
CREATE TABLE "RecurringTemplate" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "splitType" "SplitType" NOT NULL,
    "shareUnits" JSONB,
    "frequencyDays" INTEGER NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringTemplate_pkey" PRIMARY KEY ("id")
);
