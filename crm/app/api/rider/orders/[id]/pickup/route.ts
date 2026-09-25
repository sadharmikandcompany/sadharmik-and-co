import { NextResponse } from "next/server"
import { getSupabaseAdmin, getRiderIdFromRequest, CORS_HEADERS } from "@/lib/rider-auth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const riderId = getRiderIdFromRequest(request)
  if (!riderId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }

  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status")
    .eq("id", id)
    .eq("delivery_partner_id", riderId)
    .single()

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404, headers: CORS_HEADERS })
  }
  if (order.order_status !== "out_for_delivery") {
    return NextResponse.json({ ok: false, error: "This order is not out for delivery." }, { status: 400, headers: CORS_HEADERS })
  }

  const { error } = await supabase.from("orders").update({ delivery_status: "picked_up" }).eq("id", id)
  if (error) {
    console.error("Error marking order picked up:", error)
    return NextResponse.json({ ok: false, error: "Could not update the order." }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
}
