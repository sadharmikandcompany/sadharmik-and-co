-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isShop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mandirNumber" INTEGER,
ADD COLUMN     "shopNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mandirNumber_key" ON "Customer"("mandirNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shopNumber_key" ON "Customer"("shopNumber");
