-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "groupType" TEXT NOT NULL DEFAULT 'trip';

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "arbitratedAt" TIMESTAMP(3),
ADD COLUMN     "arbitratedById" TEXT,
ADD COLUMN     "arbitrationDecision" TEXT,
ADD COLUMN     "arbitrationNote" TEXT,
ADD COLUMN     "evidenceUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
