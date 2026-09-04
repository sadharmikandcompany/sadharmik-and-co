import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface DeliverySheetOrderJson {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  total: number;
  items: { productName: string; quantity: number }[];
}

export interface DeliverySheetSummary {
  totalOrders: number;
  totalItems: number;
  totalAmount: number;
  totalCod: number;
}

export function summarizeDeliverySheet(
  orders: { total: number; paymentMethod: string; items: { quantity: number }[] }[]
): DeliverySheetSummary {
  return {
    totalOrders: orders.length,
    totalItems: orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    totalAmount: orders.reduce((sum, o) => sum + o.total, 0),
    totalCod: orders
      .filter((o) => o.paymentMethod === "CASH" || o.paymentMethod === "PENDING")
      .reduce((sum, o) => sum + o.total, 0),
  };
}

export async function getDeliverySheet(
  riderId: string,
  filter: "today" | "all"
): Promise<DeliverySheetSummary & { orders: DeliverySheetOrderJson[] }> {
  const where: Prisma.OrderWhereInput = {
    deliveryPartnerId: riderId,
    status: { in: ["OUT_FOR_DELIVERY", "PICKED_UP"] },
  };
  if (filter === "today") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    where.orderDate = { gte: startOfToday, lt: endOfToday };
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: { orderDate: "desc" },
    include: { customer: true, items: { include: { product: true } } },
  });

  const orders: DeliverySheetOrderJson[] = rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
    customerPhone: o.customer.mobilePrimary,
    customerAddress: o.customer.shippingAddress,
    paymentMethod: o.paymentMethod,
    total: o.total,
    items: o.items.map((i) => ({ productName: i.product.name, quantity: i.quantity })),
  }));

  return { orders, ...summarizeDeliverySheet(rows.map((o) => ({ total: o.total, paymentMethod: o.paymentMethod, items: o.items }))) };
}
