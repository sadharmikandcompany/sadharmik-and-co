-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'CHEQUE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "gstAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gstPercentage" INTEGER NOT NULL DEFAULT 0;
