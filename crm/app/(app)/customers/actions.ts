"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !phone || !address) {
    throw new Error("Name, phone and address are required.");
  }

  await prisma.customer.create({
    data: { name, phone, whatsapp: phone, address, notes: notes || null },
  });
  revalidatePath("/customers");
}
