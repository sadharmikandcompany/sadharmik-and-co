"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface CreateCustomerResult {
  ok: boolean;
  error?: string;
  customer?: any;
}

// /pos and /sales/new both read the customer list in their (statically
// rendered) server component, so a create/update/delete here has to
// revalidate them too, not just /customers — otherwise the customer list
// they show goes stale until something else happens to bust it, even
// though the row is already in the database and visible on /customers.
function revalidateCustomerPages() {
  revalidatePath("/customers");
  revalidatePath("/pos");
  revalidatePath("/sales/new");
}

export async function createCustomer(formData: FormData): Promise<CreateCustomerResult> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const mobilePrimary = String(formData.get("mobilePrimary") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const mobileSecondary1 = String(formData.get("mobileSecondary1") ?? "").trim() || null;
  const mobileSecondary2 = String(formData.get("mobileSecondary2") ?? "").trim() || null;
  const companyName = String(formData.get("companyName") ?? "").trim() || null;
  const gstNumber = String(formData.get("gstNumber") ?? "").trim() || null;
  const panNumber = String(formData.get("panNumber") ?? "").trim() || null;
  const shippingAddress = String(formData.get("shippingAddress") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;
  
  const isVip = formData.get("isVip") === "on";
  const isMandir = formData.get("isMandir") === "on";
  const isShop = formData.get("isShop") === "on";
  const isDefaulter = formData.get("isDefaulter") === "on";
  const isActive = formData.get("isActive") !== "false"; // default to true
  const vipNumberStr = formData.get("vipNumber")?.toString().trim();
  const vipNumber = vipNumberStr ? parseInt(vipNumberStr, 10) : undefined;
  const mandirNumberStr = formData.get("mandirNumber")?.toString().trim();
  const mandirNumber = mandirNumberStr ? parseInt(mandirNumberStr, 10) : undefined;
  const shopNumberStr = formData.get("shopNumber")?.toString().trim();
  const shopNumber = shopNumberStr ? parseInt(shopNumberStr, 10) : undefined;

  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName || !lastName || !mobilePrimary || !shippingAddress) {
    return { ok: false, error: "First Name, Last Name, Primary Mobile, and Shipping Address are required." };
  }

  let createdCustomer;
  try {
    createdCustomer = await prisma.customer.create({
      data: {
        firstName, lastName, email, mobilePrimary, whatsapp,
        mobileSecondary1, mobileSecondary2, companyName, gstNumber, panNumber,
        shippingAddress, billingAddress, isVip, isMandir, isShop, isDefaulter, isActive,
        ...(vipNumber && !isNaN(vipNumber) && isVip ? { vipNumber } : {}),
        ...(mandirNumber && !isNaN(mandirNumber) && isMandir ? { mandirNumber } : {}),
        ...(shopNumber && !isNaN(shopNumber) && isShop ? { shopNumber } : {}),
        notes: notes || null
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add customer." };
  }

  revalidateCustomerPages();
  return {
    ok: true,
    customer: {
      id: createdCustomer.id,
      name: `${createdCustomer.firstName} ${createdCustomer.lastName}`.trim(),
      phone: createdCustomer.mobilePrimary,
      vipNumber: createdCustomer.vipNumber,
      isMandir: createdCustomer.isMandir,
      mandirNumber: createdCustomer.mandirNumber,
      isShop: createdCustomer.isShop,
      shopNumber: createdCustomer.shopNumber
    }
  };
}

export async function updateCustomer(id: string, formData: FormData): Promise<CreateCustomerResult> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const mobilePrimary = String(formData.get("mobilePrimary") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const mobileSecondary1 = String(formData.get("mobileSecondary1") ?? "").trim() || null;
  const mobileSecondary2 = String(formData.get("mobileSecondary2") ?? "").trim() || null;
  const companyName = String(formData.get("companyName") ?? "").trim() || null;
  const gstNumber = String(formData.get("gstNumber") ?? "").trim() || null;
  const panNumber = String(formData.get("panNumber") ?? "").trim() || null;
  const shippingAddress = String(formData.get("shippingAddress") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;
  
  const isVip = formData.get("isVip") === "on";
  const isMandir = formData.get("isMandir") === "on";
  const isShop = formData.get("isShop") === "on";
  const isDefaulter = formData.get("isDefaulter") === "on";
  const isActive = formData.get("isActive") !== "false";
  const vipNumberStr = formData.get("vipNumber")?.toString().trim();
  const vipNumber = vipNumberStr ? parseInt(vipNumberStr, 10) : undefined;
  const mandirNumberStr = formData.get("mandirNumber")?.toString().trim();
  const mandirNumber = mandirNumberStr ? parseInt(mandirNumberStr, 10) : undefined;
  const shopNumberStr = formData.get("shopNumber")?.toString().trim();
  const shopNumber = shopNumberStr ? parseInt(shopNumberStr, 10) : undefined;

  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName || !lastName || !mobilePrimary || !shippingAddress) {
    return { ok: false, error: "First Name, Last Name, Primary Mobile, and Shipping Address are required." };
  }

  try {
    await prisma.customer.update({
      where: { id },
      data: {
        firstName, lastName, email, mobilePrimary, whatsapp,
        mobileSecondary1, mobileSecondary2, companyName, gstNumber, panNumber,
        shippingAddress, billingAddress, isVip, isMandir, isShop, isDefaulter, isActive,
        ...(vipNumber && !isNaN(vipNumber) && isVip ? { vipNumber } : {}),
        ...(mandirNumber && !isNaN(mandirNumber) && isMandir ? { mandirNumber } : {}),
        ...(shopNumber && !isNaN(shopNumber) && isShop ? { shopNumber } : {}),
        notes: notes || null
      },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update customer." };
  }

  revalidateCustomerPages();
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<CreateCustomerResult> {
  try {
    await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not delete customer." };
  }

  revalidateCustomerPages();
  return { ok: true };
}
