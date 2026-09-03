-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryNotes" TEXT;
