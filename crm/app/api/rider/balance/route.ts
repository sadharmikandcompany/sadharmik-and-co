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

  // Cash/COD the rider has collected but the office hasn't marked settled
  // yet (cod_settled — there's no "mark settled" UI as of this writing, so
  // this is effectively everything the rider has ever collected).
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, customer_id, customer_full_name")
    .eq("delivery_partner_id", riderId)
    .eq("order_status", "delivered")
    .in("payment_method", ["cash", "cod"])
    .eq("cod_settled", false)
    .order("delivered_date", { ascending: false })

  if (error) {
    console.error("Error fetching rider balance:", error)
    return NextResponse.json({ ok: false, error: "Could not load balance." }, { status: 500, headers: CORS_HEADERS })
  }

  const customerIds = (orders || []).map((o) => o.customer_id).filter(Boolean)
  const { data: customers } = customerIds.length
    ? await supabase.from("customers").select("id, first_name, last_name").in("id", customerIds)
    : { data: [] as any[] }
  const nameById = new Map((customers || []).map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]))

  const balanceOrders = (orders || []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    customerName: (o.customer_id && nameById.get(o.customer_id)) || o.customer_full_name || "Customer",
    total: o.total_amount,
    paymentMethod: "cod",
  }))

  const total = balanceOrders.reduce((sum, o) => sum + o.total, 0)

  return NextResponse.json({ ok: true, balance: { orders: balanceOrders, total } }, { headers: CORS_HEADERS })
}
