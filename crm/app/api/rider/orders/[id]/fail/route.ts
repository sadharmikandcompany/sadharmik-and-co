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
  const { reason } = await request.json().catch(() => ({ reason: null }))

  const supabase = getSupabaseAdmin()
  const { data: order } = await supabase
    .from("orders")
    .select("id, failed_attempts")
    .eq("id", id)
    .eq("delivery_partner_id", riderId)
    .single()

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404, headers: CORS_HEADERS })
  }

  const { error } = await supabase
    .from("orders")
    .update({
      order_status: "failed",
      failure_reason: reason || null,
      failed_at: new Date().toISOString(),
      failed_attempts: (order.failed_attempts || 0) + 1,
    })
    .eq("id", id)

  if (error) {
    console.error("Error marking order failed:", error)
    return NextResponse.json({ ok: false, error: "Could not update the order." }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
}
