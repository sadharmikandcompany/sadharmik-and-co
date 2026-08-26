"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const itemsSupplied = String(formData.get("itemsSupplied") ?? "").trim();

  if (!name || !phone) throw new Error("Supplier name and phone are required.");

  await prisma.supplier.create({ data: { name, phone, itemsSupplied: itemsSupplied || null } });
  revalidatePath("/purchases");
}

export interface PurchaseLineInput {
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
}

export async function createPurchase(
  supplierId: string,
  paidStatus: "PAID" | "DUE" | "PARTIAL",
  lines: PurchaseLineInput[]
) {
  if (!supplierId) throw new Error("Select a supplier first.");

  const validLines = lines.filter((l) => l.itemName.trim() && l.quantity > 0 && l.rate > 0);
  if (validLines.length === 0) throw new Error("Add at least one purchase line.");

  const roundedRates = validLines.map((l) => Math.round(l.rate));
  const roundedAmounts = validLines.map((l, i) => Math.round(l.quantity * roundedRates[i]));
  const total = roundedAmounts.reduce((sum, amount) => sum + amount, 0);

  await prisma.purchase.create({
    data: {
      supplierId,
      total,
      paidStatus,
      items: {
        create: validLines.map((l, i) => ({
          itemName: l.itemName.trim(),
          quantity: l.quantity,
          unit: l.unit.trim() || "unit",
          rate: roundedRates[i],
          amount: roundedAmounts[i],
        })),
      },
    },
  });

  revalidatePath("/purchases");
}
