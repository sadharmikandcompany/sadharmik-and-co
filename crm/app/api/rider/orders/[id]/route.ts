import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { getRiderOrder, toRiderOrderJson } from "@/lib/riderOrders";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const order = await getRiderOrder(rider.id, id);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: toRiderOrderJson(order) });
}
