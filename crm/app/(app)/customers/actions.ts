"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
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

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  mandirNumber: "Mandir number",
  shopNumber: "Shop number",
  mobilePrimary: "mobile number",
};

// The Mandir/Shop number inputs are pre-filled with a "next available"
// suggestion computed when the page loaded. If the form is reused for a
// second customer without a page reload (or two people are entering data
// at once), that suggestion can go stale and collide with a number someone
// else already took — surface a clear, actionable message instead of a raw
// Prisma error dump.
function friendlyCustomerError(err: unknown, fallback: string): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = err.meta?.target;
    const fields = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
    const labels = fields.map((f) => UNIQUE_FIELD_LABELS[f] ?? f);
    if (labels.length > 0) {
      return `That ${labels.join(" / ")} is already in use by another customer — please choose a different one.`;
    }
  }
  return err instanceof Error ? err.message : fallback;
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
  // The Active checkbox submits value="true" when checked and is omitted
  // entirely when unchecked (browsers never send "false") — match that
  // directly instead of testing for the string "false", which never occurs.
  const isActive = formData.get("isActive") === "true";
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
        // vipNumber is intentionally never set here — every customer gets one
        // automatically (Customer.vipNumber's database default), regardless
        // of isVip. Letting the form supply one caused duplicate-number
        // crashes (see git history) since the "next" number it showed was
        // just a stale suggestion from whenever the page last loaded.
        ...(mandirNumber && !isNaN(mandirNumber) && isMandir ? { mandirNumber } : {}),
        ...(shopNumber && !isNaN(shopNumber) && isShop ? { shopNumber } : {}),
        notes: notes || null
      },
    });
  } catch (err) {
    return { ok: false, error: friendlyCustomerError(err, "Could not add customer.") };
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
  // Same mismatch as createCustomer: the checkbox sends value="true" when
  // checked, never the string "false" — testing for "false" made this
  // always true, so editing a soft-deleted customer silently reactivated
  // them and unchecking "Active" here did nothing.
  const isActive = formData.get("isActive") === "true";
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
        // vipNumber is never edited — it's assigned once at creation and
        // stays fixed; see the matching comment in createCustomer.
        ...(mandirNumber && !isNaN(mandirNumber) && isMandir ? { mandirNumber } : {}),
        ...(shopNumber && !isNaN(shopNumber) && isShop ? { shopNumber } : {}),
        notes: notes || null
      },
    });
  } catch (err) {
    return { ok: false, error: friendlyCustomerError(err, "Could not update customer.") };
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
