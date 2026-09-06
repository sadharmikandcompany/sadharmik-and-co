import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrder, findOrCreateCustomerByPhone } from "@/lib/orders";

// This endpoint is deliberately public/unauthenticated — it's the public
// khakhra website's checkout calling into the CRM to record a real order.
// It never returns anything beyond an order number, and every price/stock
// value it uses comes from the database (via createOrder), never from the
// request body, so a forged request can't misprice an order or oversell
// stock — the same guarantee the authenticated POS/New Order flows have.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface PublicOrderItem {
  productName: string;
  quantity: number;
}

interface PublicOrderRequest {
  name?: string;
  phone?: string;
  address?: string;
  items?: PublicOrderItem[];
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: PublicOrderRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name || !phone || !address) {
    return jsonError("Name, phone and address are required.", 400);
  }
  if (items.length === 0) {
    return jsonError("Add at least one item.", 400);
  }
  for (const item of items) {
    if (!item || typeof item.productName !== "string" || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      return jsonError("Each item needs a productName and a positive quantity.", 400);
    }
  }

  // Resolve product names (as shown on the public site) to internal product
  // ids. Names are matched against active products only — an inactive or
  // unknown flavour name fails the whole order rather than silently
  // dropping a line, since the customer would otherwise be charged less
  // than what they saw on the site.
  const products = await prisma.product.findMany({
    where: { name: { in: items.map((i) => i.productName) }, isActive: true },
  });

  const lines: { productId: string; quantity: number }[] = [];
  for (const item of items) {
    const product = products.find((p) => p.name === item.productName);
    if (!product) {
      return jsonError(`"${item.productName}" is not available right now.`, 400);
    }
    lines.push({ productId: product.id, quantity: Math.round(item.quantity) });
  }

  const nameParts = name.split(" ");
  const firstName = nameParts[0] || "-";
  const lastName = nameParts.slice(1).join(" ") || "-";

  const customerResult = await findOrCreateCustomerByPhone(firstName, lastName, phone, address);
  if (!customerResult.ok || !customerResult.customer) {
    return jsonError(customerResult.error ?? "Could not save your details.", 400);
  }

  const result = await createOrder(customerResult.customer.id, lines, "WEBSITE", "PENDING");

  if (!result.ok) {
    return jsonError(result.error ?? "Could not save the order.", 400);
  }

  return NextResponse.json({ ok: true, orderNumber: result.orderNumber }, { headers: CORS_HEADERS });
}
