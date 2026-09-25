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
    .select("id, order_status, payment_method, payment_status, total_amount")
    .eq("id", id)
    .eq("delivery_partner_id", riderId)
    .single()

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404, headers: CORS_HEADERS })
  }
  if (order.order_status === "delivered") {
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  }

  const updateData: Record<string, unknown> = {
    order_status: "delivered",
    delivery_status: "delivered",
    delivered_date: new Date().toISOString(),
  }

  // Cash collected in person at the door — mark it paid and record the
  // amount the rider is now holding (cod_settled stays false: it's still in
  // the rider's hand, not yet handed in to the office).
  const isCashLike = order.payment_method === "cash" || order.payment_method === "cod"
  if (isCashLike && order.payment_status !== "completed") {
    updateData.payment_status = "completed"
    updateData.cod_collected_amount = String(order.total_amount)
  }

  const { error } = await supabase.from("orders").update(updateData).eq("id", id)
  if (error) {
    console.error("Error marking order delivered:", error)
    return NextResponse.json({ ok: false, error: "Could not update the order." }, { status: 500, headers: CORS_HEADERS })
  }

  // Best-effort delivery count — not critical if this one update fails.
  const { data: rider } = await supabase.from("delivery_partners").select("total_deliveries").eq("id", riderId).single()
  if (rider) {
    await supabase.from("delivery_partners").update({ total_deliveries: (rider.total_deliveries || 0) + 1 }).eq("id", riderId)
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
}
