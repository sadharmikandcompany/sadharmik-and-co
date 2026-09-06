import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EditOrderForm } from "./EditOrderForm";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, products, deliveryPartners] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: true } } },
    }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "DELIVERY_PARTNER", isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!order) notFound();

  return (
    <div>
      <Link href={`/sales/${order.id}`} className="text-sm text-royal-soft hover:text-gold-soft">
        ← Back to order
      </Link>
      <h1 className="mt-2 font-serif text-3xl text-royal">Edit Order · {order.orderNumber}</h1>
      <p className="mt-1 text-sm text-royal-soft">
        {order.customer.firstName} {order.customer.lastName} · Sd {String(order.customer.vipNumber).padStart(4, "0")} ·{" "}
        {order.customer.mobilePrimary}
      </p>

      <div className="mt-6">
        <EditOrderForm
          order={{
            id: order.id,
            status: order.status,
            paymentMethod: order.paymentMethod,
            amountPaid: order.amountPaid,
            deliveryPartnerId: order.deliveryPartnerId,
            notes: order.notes ?? "",
            deliveryNotes: order.deliveryNotes ?? "",
            isPriority: order.isPriority,
            customer: {
              name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
              phone: order.customer.mobilePrimary,
              address: order.customer.shippingAddress,
            },
            items: order.items.map((item) => ({
              lineId: item.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercentage: item.discountPercentage,
              gstPercentage: item.product.gstPercentage,
            })),
          }}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            packSize: p.packSize,
            price: p.price,
            gstPercentage: p.gstPercentage,
            stock: p.stock,
          }))}
          deliveryPartners={deliveryPartners.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </div>
  );
}
