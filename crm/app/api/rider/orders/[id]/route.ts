import { NextResponse } from "next/server"
import { getSupabaseAdmin, getRiderIdFromRequest, CORS_HEADERS } from "@/lib/rider-auth"
import { fetchRiderOrderRow, toRiderOrder } from "@/lib/rider-orders"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const riderId = getRiderIdFromRequest(request)
  if (!riderId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }

  const { id } = await params
  const supabase = getSupabaseAdmin()
  const order = await fetchRiderOrderRow(supabase, id, riderId)

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404, headers: CORS_HEADERS })
  }

  const riderOrder = await toRiderOrder(supabase, order)
  return NextResponse.json({ ok: true, order: riderOrder }, { headers: CORS_HEADERS })
}
