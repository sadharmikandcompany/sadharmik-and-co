"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "FAILED", "RESCHEDULED"] as const;
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

  await prisma.order.update({
    where: { id },
    data: { deliveryPartnerId: deliveryPartnerId || null },
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
