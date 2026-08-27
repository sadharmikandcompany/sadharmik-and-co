"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface CreateCustomerResult {
  ok: boolean;
  error?: string;
}

export async function createCustomer(formData: FormData): Promise<CreateCustomerResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !phone || !address) {
    return { ok: false, error: "Name, phone and address are required." };
  }

  try {
    await prisma.customer.create({
      data: { name, phone, whatsapp: phone, address, notes: notes || null },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add customer." };
  }

  revalidatePath("/customers");
  revalidatePath("/pos");
  revalidatePath("/sales/new");
  return { ok: true };
}
