import { NextResponse } from "next/server"
import { getSupabaseAdmin, getRiderIdFromRequest, CORS_HEADERS } from "@/lib/rider-auth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const riderId = getRiderIdFromRequest(request)
  if (!riderId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }

  const supabase = getSupabaseAdmin()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayStartIso = todayStart.toISOString()

  const [
    { count: totalAssigned },
    { count: pickedUp },
    { data: deliveredToday },
    { count: failedToday },
    { data: rider },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_partner_id", riderId).eq("order_status", "out_for_delivery"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_partner_id", riderId).eq("order_status", "out_for_delivery").eq("delivery_status", "picked_up"),
    supabase.from("orders").select("total_amount, payment_method").eq("delivery_partner_id", riderId).eq("order_status", "delivered").gte("delivered_date", todayStartIso),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_partner_id", riderId).eq("order_status", "failed").gte("failed_at", todayStartIso),
    supabase.from("delivery_partners").select("total_deliveries, average_rating").eq("id", riderId).single(),
  ])

  const todaysCollectionsTotal = (deliveredToday || []).reduce(
    (sum, o) => (o.payment_method === "cash" || o.payment_method === "cod" ? sum + (o.total_amount || 0) : sum),
    0
  )

  return NextResponse.json(
    {
      ok: true,
      summary: {
        totalAssigned: totalAssigned || 0,
        pickedUp: pickedUp || 0,
        delivered: (deliveredToday || []).length,
        failed: failedToday || 0,
        todaysCollectionsTotal,
        totalDeliveries: rider?.total_deliveries || 0,
        rating: rider?.average_rating ?? null,
      },
    },
    { headers: CORS_HEADERS }
  )
}
