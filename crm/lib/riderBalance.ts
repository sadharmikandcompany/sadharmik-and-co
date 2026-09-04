import { prisma } from "@/lib/prisma";

export function isUnsettled(order: { status: string; paymentMethod: string; settledAt: Date | null }): boolean {
  return (
    order.status === "DELIVERED" &&
    (order.paymentMethod === "CASH" || order.paymentMethod === "PENDING") &&
    order.settledAt === null
  );
}

export interface BalanceOrderJson {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  paymentMethod: string;
}

export interface BalanceCollectionJson {
  orders: BalanceOrderJson[];
  total: number;
}

export async function getBalanceCollection(riderId: string): Promise<BalanceCollectionJson> {
  const orders = await prisma.order.findMany({
    where: {
      deliveryPartnerId: riderId,
      status: "DELIVERED",
      settledAt: null,
      paymentMethod: { in: ["CASH", "PENDING"] },
    },
    include: { customer: true },
    orderBy: { orderDate: "desc" },
  });

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
      total: o.total,
      paymentMethod: o.paymentMethod,
    })),
    total: orders.reduce((sum, o) => sum + o.total, 0),
  };
}
