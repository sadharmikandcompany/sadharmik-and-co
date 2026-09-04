import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    rider: {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      servicePincodes: rider.servicePincodes,
      rating: rider.rating,
    },
  });
}
