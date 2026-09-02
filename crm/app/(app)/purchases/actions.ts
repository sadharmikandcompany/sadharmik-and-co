"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computePurchaseTotals } from "@/lib/money";

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

export interface CreatePurchaseResult {
  ok: boolean;
  error?: string;
}

export async function createPurchase(
  supplierId: string,
  paidStatus: "PAID" | "DUE" | "PARTIAL",
  purchaseStatus: "PENDING" | "RECEIVED" | "CANCELLED",
  lines: PurchaseLineInput[],
  optionalFields: {
    poNumber?: string;
    invoiceNumber?: string;
    paymentMethod?: string;
    batchNumber?: string;
    notes?: string;
    amountPaid?: number;
    purchaseDate?: string;
  }
): Promise<CreatePurchaseResult> {
  if (!supplierId) return { ok: false, error: "Select a supplier first." };

  const validLines = lines.filter((l) => l.itemName.trim() && l.quantity > 0 && l.rate > 0);
  if (validLines.length === 0) return { ok: false, error: "Add at least one purchase line." };

  const { rates, amounts, total } = computePurchaseTotals(validLines);

  try {
    const purchase = await prisma.purchase.create({
      data: {
        supplierId,
        total,
        paidStatus,
        purchaseStatus,
        poNumber: optionalFields.poNumber || null,
        invoiceNumber: optionalFields.invoiceNumber || null,
        paymentMethod: optionalFields.paymentMethod || null,
        batchNumber: optionalFields.batchNumber || null,
        notes: optionalFields.notes || null,
        amountPaid: optionalFields.amountPaid ?? 0,
        purchaseDate: optionalFields.purchaseDate ? new Date(optionalFields.purchaseDate) : new Date(),
        items: {
          create: validLines.map((l, i) => ({
            itemName: l.itemName.trim(),
            quantity: l.quantity,
            unit: l.unit.trim() || "unit",
            rate: rates[i],
            amount: amounts[i],
          })),
        },
      },
    });
    revalidatePath("/purchases");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the purchase." };
  }
}

export async function updatePurchase(
  id: string,
  supplierId: string,
  paidStatus: "PAID" | "DUE" | "PARTIAL",
  purchaseStatus: "PENDING" | "RECEIVED" | "CANCELLED",
  lines: PurchaseLineInput[],
  optionalFields: {
    poNumber?: string;
    invoiceNumber?: string;
    paymentMethod?: string;
    batchNumber?: string;
    notes?: string;
    amountPaid?: number;
    purchaseDate?: string;
  }
): Promise<CreatePurchaseResult> {
  if (!supplierId) return { ok: false, error: "Select a supplier first." };

  const validLines = lines.filter((l) => l.itemName.trim() && l.quantity > 0 && l.rate > 0);
  if (validLines.length === 0) return { ok: false, error: "Add at least one purchase line." };

  const { rates, amounts, total } = computePurchaseTotals(validLines);

  try {
    // We recreate items on update for simplicity
    await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.purchase.update({
        where: { id },
        data: {
          supplierId,
          total,
          paidStatus,
          purchaseStatus,
          poNumber: optionalFields.poNumber || null,
          invoiceNumber: optionalFields.invoiceNumber || null,
          paymentMethod: optionalFields.paymentMethod || null,
          batchNumber: optionalFields.batchNumber || null,
          notes: optionalFields.notes || null,
          amountPaid: optionalFields.amountPaid ?? 0,
          purchaseDate: optionalFields.purchaseDate ? new Date(optionalFields.purchaseDate) : undefined,
          items: {
            create: validLines.map((l, i) => ({
              itemName: l.itemName.trim(),
              quantity: l.quantity,
              unit: l.unit.trim() || "unit",
              rate: rates[i],
              amount: amounts[i],
            })),
          },
        },
      });
    });
    revalidatePath("/purchases");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update the purchase." };
  }
}

export async function deletePurchase(id: string): Promise<CreatePurchaseResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.purchase.delete({ where: { id } });
    });
    revalidatePath("/purchases");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not delete the purchase." };
  }
}
