-- AlterTable
ALTER TABLE "RecurringTemplate" ADD COLUMN     "nextCycleOverride" JSONB,
ADD COLUMN     "pausedAt" TIMESTAMP(3);
