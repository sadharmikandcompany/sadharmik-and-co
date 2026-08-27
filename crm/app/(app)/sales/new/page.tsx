import { prisma } from "@/lib/prisma";
import { NewOrderForm } from "./NewOrderForm";

export default async function NewOrderPage() {
  const [products, customers] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">New Order</h1>
      <p className="mt-1 text-sm text-royal-soft">
        Manually record an order — e.g. one taken over phone or WhatsApp — without an immediate checkout step.
      </p>
      <div className="mt-6">
        <NewOrderForm
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            packSize: p.packSize,
            price: p.price,
            gstPercentage: p.gstPercentage,
            stock: p.stock,
          }))}
          customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
        />
      </div>
    </div>
  );
}
