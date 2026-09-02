"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const contactPerson = String(formData.get("contactPerson") ?? "").trim();
  const itemsSupplied = String(formData.get("itemsSupplied") ?? "").trim();

  if (!name || !phone) throw new Error("Supplier name and phone are required.");

  await prisma.supplier.create({ 
    data: { 
      name, 
      phone, 
      itemsSupplied: itemsSupplied || null,
      notes: email ? `Email: ${email}, Contact: ${contactPerson}` : null
    } 
  });
  revalidatePath("/vendors");
}

export async function deleteSupplier(id: string) {
  try {
    await prisma.supplier.delete({ where: { id } });
    revalidatePath("/vendors");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "Cannot delete vendor. They might have existing purchases." };
  }
}
