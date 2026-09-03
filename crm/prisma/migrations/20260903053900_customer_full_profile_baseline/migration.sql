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

