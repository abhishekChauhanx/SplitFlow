-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mentionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
