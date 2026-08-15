-- DropForeignKey
ALTER TABLE "VendorSubscriber" DROP CONSTRAINT "VendorSubscriber_userId_fkey";

-- AlterTable
ALTER TABLE "VendorSubscriber" ADD COLUMN     "invitedEmail" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "VendorSubscriber" ADD CONSTRAINT "VendorSubscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
