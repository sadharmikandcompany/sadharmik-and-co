"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { Role } from "@prisma/client";

export interface CreateUserResult {
  ok: boolean;
  error?: string;
}

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "STAFF") as Role;
  const password = String(formData.get("password") ?? "").trim();
  const servicePincodesRaw = String(formData.get("servicePincodes") ?? "").trim();
  const servicePincodes = servicePincodesRaw
    ? servicePincodesRaw.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  const ratingRaw = String(formData.get("rating") ?? "").trim();
  const rating = ratingRaw ? Number(ratingRaw) : null;

  if (!name || !phone || !password) {
    return { ok: false, error: "Name, phone, and password are required." };
  }

  try {
    await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        role,
        passwordHash: await hashPassword(password),
        servicePincodes,
        rating,
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create user." };
  }

  revalidatePath("/users");
  revalidatePath("/delivery-partners");
  return { ok: true };
}
