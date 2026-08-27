import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, unauthenticated, read-only — lets the khakhra website pull the
// live product catalogue (name, price, photo, description) straight from
// the CRM, so editing a product here is the only place that needs editing.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { name: true, price: true, packSize: true, description: true, imageUrl: true, stock: true },
  });

  return NextResponse.json({ ok: true, products }, { headers: CORS_HEADERS });
}
