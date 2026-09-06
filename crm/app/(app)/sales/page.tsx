import { prisma } from "@/lib/prisma";
import { SalesClient } from "./SalesClient";

export default async function SalesPage() {
  const [orders, deliveryPartners, activeCounts, totalCounts] = await Promise.all([
    prisma.order.findMany({
      orderBy: { orderDate: "desc" },
      include: {
        customer: true,
        items: { include: { product: true } },
        deliveryPartner: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "DELIVERY_PARTNER", isActive: true },
      orderBy: { name: "asc" },
    }),
    // "Active" deliveries for a partner = currently out or picked up.
    prisma.order.groupBy({
      by: ["deliveryPartnerId"],
      where: { deliveryPartnerId: { not: null }, status: { in: ["OUT_FOR_DELIVERY", "PICKED_UP"] } },
      _count: { _all: true },
    }),
    // "Total" = every order ever assigned to them.
    prisma.order.groupBy({
      by: ["deliveryPartnerId"],
      where: { deliveryPartnerId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const activeByPartner = new Map(activeCounts.map((c) => [c.deliveryPartnerId as string, c._count._all]));
  const totalByPartner = new Map(totalCounts.map((c) => [c.deliveryPartnerId as string, c._count._all]));

  return (
    <div className="w-full">
      <SalesClient
        orders={orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          invoiceNumber: o.invoiceNumber,
          orderDateLabel: o.orderDate.toLocaleDateString("en-IN"),
          status: o.status,
          source: o.source,
          paymentMethod: o.paymentMethod,
          total: o.total,
          amountPaid: o.amountPaid,
          customerName: `${o.customer.firstName} ${o.customer.lastName}`,
          customerVipNumber: o.customer.vipNumber,
          customerPhone: o.customer.mobilePrimary,
          customerAddress: o.customer.shippingAddress,
          deliveryPartnerName: o.deliveryPartner?.name || null,
          items: o.items.map((item) => ({
            id: item.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }))}
        deliveryPartners={deliveryPartners.map((p) => ({
          id: p.id,
          name: p.name,
          activeOrders: activeByPartner.get(p.id) ?? 0,
          totalOrders: totalByPartner.get(p.id) ?? 0,
        }))}
      />
    </div>
  );
}
