import { prisma } from "@/lib/prisma";
import { PosClient } from "./PosClient";

export default async function PosPage() {
  const [products, customers, maxVipCustomer] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.customer.findFirst({ orderBy: { vipNumber: "desc" }, select: { vipNumber: true } }),
  ]);
  const nextVipNumber = (maxVipCustomer?.vipNumber ?? 0) + 1;

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
            gstPercentage: p.gstPercentage,
            stock: p.stock,
            imageUrl: p.imageUrl,
          }))}
          customers={customers.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), phone: c.mobilePrimary, vipNumber: c.vipNumber }))}
          nextVipNumber={nextVipNumber}
        />
      </div>
    </div>
  );
}
