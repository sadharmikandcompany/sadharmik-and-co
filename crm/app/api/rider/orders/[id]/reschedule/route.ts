import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { rescheduleOrder } from "@/lib/riderOrders";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  let body: { date?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const dateValue = new Date(String(body.date ?? ""));
  if (Number.isNaN(dateValue.getTime())) {
    return NextResponse.json({ ok: false, error: "A valid date is required." }, { status: 400 });
  }
  const reason = String(body.reason ?? "").trim();

  const result = await rescheduleOrder(rider.id, id, dateValue, reason);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
