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
  const { date, reason } = await request.json().catch(() => ({ date: null, reason: null }))
  if (!date) {
    return NextResponse.json({ ok: false, error: "A reschedule date is required." }, { status: 400, headers: CORS_HEADERS })
  }

  const supabase = getSupabaseAdmin()
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", id)
    .eq("delivery_partner_id", riderId)
    .single()

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404, headers: CORS_HEADERS })
  }

  // Stays out_for_delivery / not picked_up — the order goes back to
  // needing a fresh pickup on the new date, same as any other pending order.
  const { error } = await supabase
    .from("orders")
    .update({
      order_status: "out_for_delivery",
      delivery_status: "assigned",
      next_delivery_at: new Date(date).toISOString(),
      reschedule_reason: reason || null,
    })
    .eq("id", id)

  if (error) {
    console.error("Error rescheduling order:", error)
    return NextResponse.json({ ok: false, error: "Could not update the order." }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
}
