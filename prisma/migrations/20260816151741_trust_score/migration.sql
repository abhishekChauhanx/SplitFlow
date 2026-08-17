-- CreateTable
CREATE TABLE "TrustScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "label" TEXT NOT NULL DEFAULT 'New member',
    "onTimeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disputeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utrSubmissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSettlements" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustScore_userId_key" ON "TrustScore"("userId");

-- AddForeignKey
ALTER TABLE "TrustScore" ADD CONSTRAINT "TrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
