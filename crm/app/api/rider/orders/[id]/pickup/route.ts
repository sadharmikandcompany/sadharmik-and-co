import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { pickupOrder } from "@/lib/riderOrders";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const result = await pickupOrder(rider.id, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
