import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { getDashboardSummary } from "@/lib/riderDashboard";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const summary = await getDashboardSummary(rider.id);
  return NextResponse.json({ ok: true, summary });
}
