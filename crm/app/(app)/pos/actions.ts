"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeOrderTotals, type BillLine } from "@/lib/money";
import { generateOrderNumber } from "@/lib/order-number";

export interface PosLine {
  productId: string;
  quantity: number;
}

export interface CreateOrderResult {
  ok: boolean;
  error?: string;
  orderNumber?: string;
}

export type OrderSourceInput = "WEBSITE" | "WHATSAPP" | "PHONE" | "WALK_IN";
export type PaymentMethodInput = "CASH" | "UPI" | "CARD" | "CHEQUE";

export async function createOrder(
  customerId: string,
  lines: PosLine[],
  source: OrderSourceInput = "WALK_IN",
  paymentMethod: PaymentMethodInput = "CASH"
): Promise<CreateOrderResult> {
  if (!customerId) return { ok: false, error: "Select a customer first." };

  const activeLines = lines.filter((l) => l.quantity > 0);
  if (activeLines.length === 0) return { ok: false, error: "Add at least one item." };

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: activeLines.map((l) => l.productId) } },
    });

    const billLines: BillLine[] = activeLines.map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) throw new Error("Unknown product in order.");
      if (line.quantity > product.stock) {
        throw new Error(`Only ${product.stock} left of ${product.name}.`);
      }
      return { quantity: line.quantity, unitPrice: product.price, gstPercentage: product.gstPercentage };
    });

    const totals = computeOrderTotals(billLines);

    const todayPrefix = generateOrderNumber(new Date(), 0).slice(0, -3); // "SDK" + YYMMDD
    const lastToday = await prisma.order.findFirst({
      where: { orderNumber: { startsWith: todayPrefix } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const lastSequence = lastToday ? parseInt(lastToday.orderNumber.slice(-3), 10) : 0;
    const orderNumber = generateOrderNumber(new Date(), lastSequence + 1);

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          orderNumber,
          customerId,
          source,
          paymentMethod,
          subtotal: totals.subtotal,
          gstAmount: totals.gst,
          deliveryCharge: totals.delivery,
          total: totals.total,
          items: {
            create: activeLines.map((line) => {
              const product = products.find((p) => p.id === line.productId)!;
              return { productId: line.productId, quantity: line.quantity, unitPrice: product.price };
            }),
          },
        },
      });

      for (const line of activeLines) {
        const result = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (result.count === 0) {
          const product = products.find((p) => p.id === line.productId);
          throw new Error(`Not enough stock left of ${product?.name ?? "an item"}.`);
        }
      }
    });

    revalidatePath("/pos");
    revalidatePath("/sales");
    revalidatePath("/dashboard");
    revalidatePath(`/customers/${customerId}`);

    return { ok: true, orderNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the order." };
  }
}

export interface AddCustomerResult {
  ok: boolean;
  error?: string;
  customer?: { id: string; name: string; phone: string };
}

export async function addCustomerInline(name: string, phone: string, address: string): Promise<AddCustomerResult> {
  if (!name.trim() || !phone.trim() || !address.trim()) {
    return { ok: false, error: "Name, phone and address are required." };
  }
  try {
    const customer = await prisma.customer.create({
      data: { name: name.trim(), phone: phone.trim(), whatsapp: phone.trim(), address: address.trim() },
    });
    revalidatePath("/pos");
    revalidatePath("/customers");
    return { ok: true, customer: { id: customer.id, name: customer.name, phone: customer.phone } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add customer." };
  }
}
