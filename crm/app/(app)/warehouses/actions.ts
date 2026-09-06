"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createWarehouse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) throw new Error("Warehouse name is required.");

  await prisma.warehouse.create({ data: { name, address: address || null } });
  revalidatePath("/warehouses");
  revalidatePath("/route-assignments/new");
}

export async function toggleWarehouseActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) throw new Error("Missing warehouse id.");

  await prisma.warehouse.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/warehouses");
  revalidatePath("/route-assignments/new");
}

export async function deleteWarehouse(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing warehouse id.");

  const inUse = await prisma.routeAssignment.count({ where: { warehouseId: id } });
  if (inUse > 0) throw new Error("This warehouse has route assignments and can't be deleted — deactivate it instead.");

  await prisma.warehouse.delete({ where: { id } });
  revalidatePath("/warehouses");
}
