import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { getDeliverySheet } from "@/lib/riderDeliverySheet";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const filterParam = request.nextUrl.searchParams.get("filter");
  const filter = filterParam === "all" ? "all" : "today";

  const sheet = await getDeliverySheet(rider.id, filter);
  return NextResponse.json({ ok: true, sheet });
}
