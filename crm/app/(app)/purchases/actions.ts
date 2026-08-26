"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computePurchaseTotal } from "@/lib/money";

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

  const total = Math.round(computePurchaseTotal(validLines));

  await prisma.purchase.create({
    data: {
      supplierId,
      total,
      paidStatus,
      items: {
        create: validLines.map((l) => ({
          itemName: l.itemName.trim(),
          quantity: l.quantity,
          unit: l.unit.trim() || "unit",
          rate: l.rate,
          amount: Math.round(l.quantity * l.rate),
        })),
      },
    },
  });

  revalidatePath("/purchases");
}
