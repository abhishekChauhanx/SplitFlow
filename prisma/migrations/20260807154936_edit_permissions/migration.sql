-- CreateTable
CREATE TABLE "EditPermission" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditPermission_pkey" PRIMARY KEY ("id")
);
