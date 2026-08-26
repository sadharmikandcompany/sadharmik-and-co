"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const packSize = String(formData.get("packSize") ?? "").trim();
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock"));

  if (!name || !packSize || !Number.isFinite(price) || !Number.isFinite(stock)) {
    throw new Error("All product fields are required.");
  }

  await prisma.product.create({ data: { name, packSize, price, stock } });
  revalidatePath("/products");
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const price = Number(priceRaw);
  const stock = Number(stockRaw);
  const isActive = formData.get("isActive") === "on";

  if (!id) throw new Error("Missing product id.");
  if (!priceRaw || !stockRaw || !Number.isFinite(price) || !Number.isFinite(stock) || price < 0 || stock < 0) {
    throw new Error("Price and stock must be valid, non-negative numbers.");
  }

  await prisma.product.update({ where: { id }, data: { price, stock, isActive } });
  revalidatePath("/products");
}
