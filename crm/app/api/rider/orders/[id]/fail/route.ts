import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { failOrder } from "@/lib/riderOrders";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = String(body.reason ?? "").trim();

  const result = await failOrder(rider.id, id, reason);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
