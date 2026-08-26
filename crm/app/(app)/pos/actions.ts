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

export async function createOrder(customerId: string, lines: PosLine[]): Promise<CreateOrderResult> {
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
      return { quantity: line.quantity, unitPrice: product.price };
    });

    const totals = computeOrderTotals(billLines);

    const todayCount = await prisma.order.count({
      where: { orderDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    const orderNumber = generateOrderNumber(new Date(), todayCount + 1);

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          orderNumber,
          customerId,
          subtotal: totals.subtotal,
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
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
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

export async function addCustomerInline(name: string, phone: string, address: string) {
  if (!name.trim() || !phone.trim() || !address.trim()) {
    throw new Error("Name, phone and address are required.");
  }
  const customer = await prisma.customer.create({
    data: { name: name.trim(), phone: phone.trim(), whatsapp: phone.trim(), address: address.trim() },
  });
  revalidatePath("/pos");
  revalidatePath("/customers");
  return customer;
}
