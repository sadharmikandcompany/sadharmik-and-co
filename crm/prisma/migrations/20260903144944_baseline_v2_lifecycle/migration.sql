-- Baseline migration: records schema objects that already exist on the live
-- database (added out-of-band, e.g. via `prisma db push`, before any
-- migration file was generated for them) but were never captured by a
-- migration. This migration is marked as already-applied via
-- `prisma migrate resolve --applied` and is NOT executed against the real
-- database — it exists only so the migration history matches reality and
-- future `prisma migrate dev` runs (which replay history into a shadow
-- database) produce a correct diff instead of false "drift".
--
-- WARNING: do not run this file's SQL against a database that doesn't
-- already have this exact schema — it would create duplicate objects (or,
-- for a database missing these columns/table, this IS the correct forward
-- migration to actually run). Only mark it applied without running it on a
-- database where `prisma db pull` already shows these fields present.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PICKED_UP';
ALTER TYPE "OrderStatus" ADD VALUE 'RESCHEDULED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "servicePincodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "invoiceNumber" SERIAL NOT NULL,
ADD COLUMN     "isPriority" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rescheduleReason" TEXT,
ADD COLUMN     "rescheduledDate" TIMESTAMP(3),
ADD COLUMN     "settledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
