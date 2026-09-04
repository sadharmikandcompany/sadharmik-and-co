import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { listRiderOrders, mapRiderStatusParam, toRiderOrderJson } from "@/lib/riderOrders";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const status = mapRiderStatusParam(request.nextUrl.searchParams.get("status"));
  if (!status) {
    return NextResponse.json({ ok: false, error: "status must be pending, in_progress, complete, failed, or rescheduled." }, { status: 400 });
  }

  const orders = await listRiderOrders(rider.id, status);
  return NextResponse.json({ ok: true, orders: orders.map(toRiderOrderJson) });
}
