"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const packSize = String(formData.get("packSize") ?? "").trim();
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock"));
  const gstRaw = String(formData.get("gstPercentage") ?? "").trim();
  const gstPercentage = gstRaw ? Number(gstRaw) : 0;

  if (
    !name ||
    !packSize ||
    !Number.isFinite(price) ||
    !Number.isFinite(stock) ||
    !Number.isFinite(gstPercentage) ||
    gstPercentage < 0
  ) {
    throw new Error("All product fields are required.");
  }

  await prisma.product.create({ data: { name, packSize, price, stock, gstPercentage } });
  revalidatePath("/products");
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const gstRaw = String(formData.get("gstPercentage") ?? "").trim();
  const price = Number(priceRaw);
  const stock = Number(stockRaw);
  const gstPercentage = gstRaw ? Number(gstRaw) : 0;
  const isActive = formData.get("isActive") === "on";

  if (!id) throw new Error("Missing product id.");
  if (
    !priceRaw ||
    !stockRaw ||
    !Number.isFinite(price) ||
    !Number.isFinite(stock) ||
    !Number.isFinite(gstPercentage) ||
    price < 0 ||
    stock < 0 ||
    gstPercentage < 0
  ) {
    throw new Error("Price, stock and GST% must be valid, non-negative numbers.");
  }

  await prisma.product.update({ where: { id }, data: { price, stock, gstPercentage, isActive } });
  revalidatePath("/products");
}
