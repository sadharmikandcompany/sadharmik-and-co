"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ProductActionResult {
  ok: boolean;
  error?: string;
}

// Product photos are uploaded as data: URIs (resized/compressed to JPEG in
// the browser before submit — see ProductForm.tsx) and stored straight in
// the imageUrl column. This cap keeps a single row from ballooning the
// database; the client-side resize already keeps well under it in practice.
const MAX_IMAGE_DATA_URI_LENGTH = 2_000_000;
const MAX_DESCRIPTION_LENGTH = 500;

function parseImageUrl(formData: FormData): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = String(formData.get("imageUrl") ?? "").trim();
  if (!raw) return { ok: true, value: null };
  if (!raw.startsWith("data:image/")) return { ok: false, error: "Photo must be an image file." };
  if (raw.length > MAX_IMAGE_DATA_URI_LENGTH) return { ok: false, error: "Photo is too large — try a smaller image." };
  return { ok: true, value: raw };
}

function parseDescription(formData: FormData): string | null {
  const raw = String(formData.get("description") ?? "").trim();
  if (!raw) return null;
  return raw.slice(0, MAX_DESCRIPTION_LENGTH);
}

function parseOptionalPrice(formData: FormData, field: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: `${field === "mandirPrice" ? "Mandir price" : "Shop price"} must be a non-negative number.` };
  }
  return { ok: true, value };
}

export async function createProduct(formData: FormData): Promise<ProductActionResult> {
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
    return { ok: false, error: "All product fields are required." };
  }

  const image = parseImageUrl(formData);
  if (!image.ok) return { ok: false, error: image.error };
  const description = parseDescription(formData);
  // Absent checkbox (unchecked) still means "show it" for a brand-new
  // product unless the form explicitly says otherwise.
  const showOnWebsite = formData.get("showOnWebsite") !== "off";
  const mandirPrice = parseOptionalPrice(formData, "mandirPrice");
  if (!mandirPrice.ok) return { ok: false, error: mandirPrice.error };
  const shopPrice = parseOptionalPrice(formData, "shopPrice");
  if (!shopPrice.ok) return { ok: false, error: shopPrice.error };

  try {
    await prisma.product.create({
      data: {
        name,
        packSize,
        price,
        stock,
        gstPercentage,
        imageUrl: image.value,
        description,
        showOnWebsite,
        mandirPrice: mandirPrice.value,
        shopPrice: shopPrice.value,
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add product." };
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/sales/new");
  return { ok: true };
}

export async function updateProduct(formData: FormData): Promise<ProductActionResult> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const packSize = String(formData.get("packSize") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const gstRaw = String(formData.get("gstPercentage") ?? "").trim();
  const price = Number(priceRaw);
  const stock = Number(stockRaw);
  const gstPercentage = gstRaw ? Number(gstRaw) : 0;
  const isActive = formData.get("isActive") === "on";
  const showOnWebsite = formData.get("showOnWebsite") === "on";

  if (!id) return { ok: false, error: "Missing product id." };
  if (
    !name ||
    !packSize ||
    !priceRaw ||
    !stockRaw ||
    !Number.isFinite(price) ||
    !Number.isFinite(stock) ||
    !Number.isFinite(gstPercentage) ||
    price < 0 ||
    stock < 0 ||
    gstPercentage < 0
  ) {
    return { ok: false, error: "Name, pack size, price, stock and GST% must all be filled in (price/stock/GST% non-negative)." };
  }

  const image = parseImageUrl(formData);
  if (!image.ok) return { ok: false, error: image.error };
  const description = parseDescription(formData);
  const mandirPrice = parseOptionalPrice(formData, "mandirPrice");
  if (!mandirPrice.ok) return { ok: false, error: mandirPrice.error };
  const shopPrice = parseOptionalPrice(formData, "shopPrice");
  if (!shopPrice.ok) return { ok: false, error: shopPrice.error };

  try {
    await prisma.product.update({
      where: { id },
      data: {
        name,
        packSize,
        price,
        stock,
        gstPercentage,
        isActive,
        showOnWebsite,
        imageUrl: image.value,
        description,
        mandirPrice: mandirPrice.value,
        shopPrice: shopPrice.value,
      },
    });
  } catch (err) {
    // Product.name is unique — surface that collision clearly instead of a raw Prisma error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: `A product named "${name}" already exists.` };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Could not update product." };
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/sales/new");
  return { ok: true };
}

export async function deleteProduct(formData: FormData): Promise<ProductActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing product id." };

  const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderItemCount > 0) {
    return {
      ok: false,
      error: `This product is on ${orderItemCount} existing order${orderItemCount === 1 ? "" : "s"} and can't be deleted — deactivate it instead.`,
    };
  }

  try {
    await prisma.product.delete({ where: { id } });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not delete product." };
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/sales/new");
  return { ok: true };
}
