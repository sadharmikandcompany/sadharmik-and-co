import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

export function mapRiderStatusParam(status: string | null): OrderStatus | null {
  switch (status) {
    case "pending":
      return "OUT_FOR_DELIVERY";
    case "complete":
      return "DELIVERED";
    case "failed":
      return "FAILED";
    default:
      return null;
  }
}

const ORDER_INCLUDE = { customer: true, items: { include: { product: true } } } as const;

export async function listRiderOrders(riderId: string, status: OrderStatus) {
  return prisma.order.findMany({
    where: { deliveryPartnerId: riderId, status },
    orderBy: { orderDate: "desc" },
    include: ORDER_INCLUDE,
  });
}

export async function getRiderOrder(riderId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, deliveryPartnerId: riderId },
    include: ORDER_INCLUDE,
  });
}

export interface TransitionCheck {
  ok: boolean;
  error?: string;
}

export function canTransitionOrder(
  order: { deliveryPartnerId: string | null; status: string } | null,
  riderId: string
): TransitionCheck {
  if (!order) return { ok: false, error: "Order not found." };
  if (order.deliveryPartnerId !== riderId) {
    return { ok: false, error: "This order isn't assigned to you." };
  }
  if (order.status !== "OUT_FOR_DELIVERY") {
    return { ok: false, error: "This order was already updated." };
  }
  return { ok: true };
}

export async function deliverOrder(riderId: string, orderId: string): Promise<TransitionCheck> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const check = canTransitionOrder(order, riderId);
  if (!check.ok) return check;

  await prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
  return { ok: true };
}

export async function failOrder(riderId: string, orderId: string, reason: string): Promise<TransitionCheck> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const check = canTransitionOrder(order, riderId);
  if (!check.ok) return check;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "FAILED", deliveryNotes: reason.trim() || null },
  });
  return { ok: true };
}

type RiderOrderWithRelations = NonNullable<Awaited<ReturnType<typeof getRiderOrder>>>;

export function toRiderOrderJson(order: RiderOrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
    customerVipNumber: order.customer.vipNumber,
    customerPhone: order.customer.mobilePrimary,
    customerAddress: order.customer.shippingAddress,
    paymentMethod: order.paymentMethod,
    total: order.total,
    deliveryNotes: order.deliveryNotes,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}
