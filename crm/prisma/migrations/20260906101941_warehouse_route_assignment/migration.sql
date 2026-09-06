-- CreateEnum
CREATE TYPE "RouteAssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "routeAssignmentId" TEXT;

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteAssignment" (
    "id" TEXT NOT NULL,
    "routeNumber" SERIAL NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "deliveryPartnerId" TEXT,
    "status" "RouteAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteAssignment_routeNumber_key" ON "RouteAssignment"("routeNumber");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_routeAssignmentId_fkey" FOREIGN KEY ("routeAssignmentId") REFERENCES "RouteAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteAssignment" ADD CONSTRAINT "RouteAssignment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteAssignment" ADD CONSTRAINT "RouteAssignment_deliveryPartnerId_fkey" FOREIGN KEY ("deliveryPartnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
