import { NextResponse } from "next/server"
import { getSupabaseAdmin, getRiderIdFromRequest, CORS_HEADERS } from "@/lib/rider-auth"
import { toRiderOrder, riderStatusFor } from "@/lib/rider-orders"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const ORDER_SELECT =
  "id, order_number, order_status, delivery_status, payment_method, total_amount, order_notes, is_priority, next_delivery_at, reschedule_reason, customer_id, customer_full_name, shipping_full_address, shipping_building_name, shipping_street_area, shipping_city, shipping_state, shipping_pincode"

export async function GET(request: Request) {
  const riderId = getRiderIdFromRequest(request)
  if (!riderId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") || "pending"

  const supabase = getSupabaseAdmin()

  // Active orders (not yet delivered/failed) cover pending/in_progress/
  // rescheduled — the exact split between those three happens client-side
  // below via riderStatusFor, since it depends on delivery_status and
  // next_delivery_at together, not a single column a .eq() can target.
  let query = supabase.from("orders").select(ORDER_SELECT).eq("delivery_partner_id", riderId)

  if (status === "complete") {
    query = query.eq("order_status", "delivered")
  } else if (status === "failed") {
    query = query.eq("order_status", "failed")
  } else {
    query = query.eq("order_status", "out_for_delivery")
  }

  const { data: orders, error } = await query.order("order_date", { ascending: false })

  if (error) {
    console.error("Error fetching rider orders:", error)
    return NextResponse.json({ ok: false, error: "Could not load orders." }, { status: 500, headers: CORS_HEADERS })
  }

  const filtered = (orders || []).filter((o) => {
    if (status === "complete" || status === "failed") return true
    return riderStatusFor(o) === status
  })

  const riderOrders = await Promise.all(filtered.map((o) => toRiderOrder(supabase, o)))
  return NextResponse.json({ ok: true, orders: riderOrders }, { headers: CORS_HEADERS })
}
