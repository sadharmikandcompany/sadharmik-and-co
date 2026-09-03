-- Baseline migration: records a Customer schema refactor that was applied
-- out-of-band (e.g. via `prisma db push`) directly against the live
-- database before this migration file existed. It is marked as
-- already-applied via `prisma migrate resolve --applied` and was NEVER
-- actually executed against real data — it exists only so the migration
-- history matches reality and future `prisma migrate dev` runs don't see
-- false "drift".
--
-- DANGER: do NOT run this migration for real (e.g. via `prisma migrate
-- deploy`) against any database whose `Customer` table doesn't already
-- match this exact end state. It DROPs the "address", "name", and "phone"
-- columns (destroying any data in them) and ADDs several columns as
-- NOT NULL with no default (firstName, lastName, mobilePrimary,
-- shippingAddress) — on a fresh or differently-shaped database with
-- existing Customer rows, this will either silently drop data or fail
-- outright on the NOT NULL constraints.

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "address",
DROP COLUMN "name",
DROP COLUMN "phone",
ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "gstNumber" TEXT,
ADD COLUMN     "isDefaulter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMandir" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "mobilePrimary" TEXT NOT NULL,
ADD COLUMN     "mobileSecondary1" TEXT,
ADD COLUMN     "mobileSecondary2" TEXT,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "shippingAddress" TEXT NOT NULL;

