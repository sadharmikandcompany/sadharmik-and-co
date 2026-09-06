"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeOrderTotals, type BillLine } from "@/lib/money";
import { createOrder } from "@/lib/orders";

const VALID_STATUSES = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "FAILED", "RESCHEDULED", "CANCELLED"] as const;
const VALID_PAYMENT_METHODS = ["CASH", "UPI", "CARD", "CHEQUE", "PENDING"] as const;

export async function updateOrderStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id) throw new Error("Missing order id.");
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    throw new Error("Invalid status.");
  }

  await prisma.order.update({ where: { id }, data: { status: status as (typeof VALID_STATUSES)[number] } });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/dashboard");
}

export async function updateOrderPaymentMethod(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const paymentMethod = String(formData.get("paymentMethod") ?? "");

  if (!id) throw new Error("Missing order id.");
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod as (typeof VALID_PAYMENT_METHODS)[number])) {
    throw new Error("Invalid payment method.");
  }

  await prisma.order.update({
    where: { id },
    data: { paymentMethod: paymentMethod as (typeof VALID_PAYMENT_METHODS)[number] },
  });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
}

export async function assignDeliveryPartner(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const deliveryPartnerId = String(formData.get("deliveryPartnerId") ?? "");
  if (!id) throw new Error("Missing order id.");

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error("Order not found.");

  const shouldUpdateStatus = deliveryPartnerId && ["NEW", "ROASTING"].includes(order.status);

  await prisma.order.update({
    where: { id },
    data: { 
      deliveryPartnerId: deliveryPartnerId || null,
      ...(shouldUpdateStatus ? { status: "OUT_FOR_DELIVERY" } : {})
    },
  });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/delivery-partners");
}

export async function settleOrder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing order id.");

  await prisma.order.update({ where: { id }, data: { settledAt: new Date() } });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
}

export async function toggleOrderPriority(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing order id.");
  const isPriority = formData.get("isPriority") === "true";

  await prisma.order.update({ where: { id }, data: { isPriority: !isPriority } });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
}

export async function deleteOrder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing order id.");

  await prisma.$transaction(async (tx) => {
    // 1. Get the order with items to restore stock
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new Error("Order not found.");

    // 2. Restore stock for each item
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    // 3. Delete order items
    await tx.orderItem.deleteMany({ where: { orderId: id } });

    // 4. Delete order
    await tx.order.delete({ where: { id } });
  });

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/pos");
}

export interface EditOrderLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
}

export interface UpdateOrderResult {
  ok: boolean;
  error?: string;
}

/**
 * Full "Edit Order" save: replaces the order's line items (restoring stock
 * for the old lines and decrementing it for the new ones, so quantity
 * changes/add/remove all just fall out of the same transaction) and updates
 * the order-level fields shown in the editor's Details tabs.
 */
export async function updateOrder(
  orderId: string,
  lines: EditOrderLineInput[],
  fields: {
    status: string;
    paymentMethod: string;
    amountPaid: number;
    deliveryPartnerId: string;
    notes: string;
    deliveryNotes: string;
    isPriority: boolean;
  }
): Promise<UpdateOrderResult> {
  if (!orderId) return { ok: false, error: "Missing order id." };

  const activeLines = lines.filter((l) => l.quantity > 0);
  if (activeLines.length === 0) return { ok: false, error: "Add at least one item." };
  if (!VALID_STATUSES.includes(fields.status as (typeof VALID_STATUSES)[number])) {
    return { ok: false, error: "Invalid status." };
  }
  if (!VALID_PAYMENT_METHODS.includes(fields.paymentMethod as (typeof VALID_PAYMENT_METHODS)[number])) {
    return { ok: false, error: "Invalid payment method." };
  }

  try {
    let customerId = "";

    await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!existing) throw new Error("Order not found.");
      customerId = existing.customerId;

      // Restore stock for the order's current lines before applying the new ones.
      for (const item of existing.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      await tx.orderItem.deleteMany({ where: { orderId } });

      const products = await tx.product.findMany({ where: { id: { in: activeLines.map((l) => l.productId) } } });

      const billLines: BillLine[] = activeLines.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        if (!product) throw new Error("Unknown product in order.");
        return {
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          gstPercentage: product.gstPercentage,
          discountPercentage: line.discountPercentage,
        };
      });
      const totals = computeOrderTotals(billLines);

      for (const line of activeLines) {
        const result = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (result.count === 0) {
          const product = products.find((p) => p.id === line.productId);
          throw new Error(`Only ${product?.stock ?? 0} left of ${product?.name ?? "an item"}.`);
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: fields.status as (typeof VALID_STATUSES)[number],
          paymentMethod: fields.paymentMethod as (typeof VALID_PAYMENT_METHODS)[number],
          // Never let a stale higher amountPaid outlive a total that shrank.
          amountPaid: Math.max(0, Math.min(fields.amountPaid, totals.total)),
          deliveryPartnerId: fields.deliveryPartnerId || null,
          notes: fields.notes.trim() || null,
          deliveryNotes: fields.deliveryNotes.trim() || null,
          isPriority: fields.isPriority,
          subtotal: totals.subtotal,
          gstAmount: totals.gst,
          deliveryCharge: totals.delivery,
          total: totals.total,
          items: {
            create: activeLines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountPercentage: line.discountPercentage,
            })),
          },
        },
      });
    });

    revalidatePath("/sales");
    revalidatePath(`/sales/${orderId}`);
    revalidatePath(`/sales/${orderId}/edit`);
    revalidatePath("/dashboard");
    revalidatePath("/pos");
    if (customerId) revalidatePath(`/customers/${customerId}`);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the order." };
  }
}

export interface CancelOrderResult {
  ok: boolean;
  error?: string;
}

/**
 * "Cancel Order" from the Orders list actions menu — distinct from Delete:
 * the order stays in the list (as CANCELLED) instead of being removed, but
 * like Delete it returns the stock it was holding.
 */
export async function cancelOrder(formData: FormData): Promise<CancelOrderResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing order id." };

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new Error("Order not found.");
      if (order.status === "CANCELLED") return; // already cancelled, nothing to do
      if (order.status === "DELIVERED") throw new Error("Can't cancel an order that's already delivered.");

      for (const item of order.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });
    });

    revalidatePath("/sales");
    revalidatePath(`/sales/${id}`);
    revalidatePath(`/sales/${id}/edit`);
    revalidatePath("/dashboard");
    revalidatePath("/pos");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not cancel the order." };
  }
}

export interface ReorderResult {
  ok: boolean;
  error?: string;
  orderId?: string;
}

/**
 * "Reorder" from the Orders list actions menu: places a brand-new order for
 * the same customer and items (at today's prices/stock). Never touches the
 * original order.
 */
export async function reorderOrder(sourceOrderId: string): Promise<ReorderResult> {
  if (!sourceOrderId) return { ok: false, error: "Missing order id." };

  const source = await prisma.order.findUnique({ where: { id: sourceOrderId }, include: { items: true } });
  if (!source) return { ok: false, error: "Order not found." };
  if (source.items.length === 0) return { ok: false, error: "That order has no items to reorder." };

  const result = await createOrder(
    source.customerId,
    source.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    source.source,
    source.paymentMethod,
    source.notes ?? undefined
  );

  if (result.ok) revalidatePath("/sales");
  return { ok: result.ok, error: result.error, orderId: result.orderId };
}
