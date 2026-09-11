import { prisma } from "@/lib/prisma";
import { PosClient } from "./PosClient";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const [products, customers, maxVipCustomer, maxMandirCustomer] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.customer.findFirst({ orderBy: { vipNumber: "desc" }, select: { vipNumber: true } }),
    prisma.customer.findFirst({ orderBy: { mandirNumber: "desc" }, select: { mandirNumber: true } }),
  ]);
  const nextVipNumber = (maxVipCustomer?.vipNumber ?? 0) + 1;
  const nextMandirNumber = (maxMandirCustomer?.mandirNumber ?? 0) + 1;

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">POS · New order</h1>
      <p className="mt-1 text-sm text-royal-soft">Build a bill and save it as an order.</p>
      <div className="mt-6">
        <PosClient
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            packSize: p.packSize,
            price: p.price,
            mandirPrice: p.mandirPrice,
            shopPrice: p.shopPrice,
            gstPercentage: p.gstPercentage,
            stock: p.stock,
            imageUrl: p.imageUrl,
          }))}
          customers={customers.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`.trim(),
            phone: c.mobilePrimary,
            vipNumber: c.vipNumber,
            isMandir: c.isMandir,
            isShop: c.isShop,
          }))}
          nextVipNumber={nextVipNumber}
          nextMandirNumber={nextMandirNumber}
        />
      </div>
    </div>
  );
}
