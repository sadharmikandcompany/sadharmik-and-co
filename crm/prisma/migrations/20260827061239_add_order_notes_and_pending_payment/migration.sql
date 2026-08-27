-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "notes" TEXT;
