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

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get("filter") || "today"

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("orders")
    .select("id, order_number, payment_method, total_amount, customer_id, customer_full_name, shipping_full_address, shipping_building_name, shipping_street_area, shipping_city, shipping_state, shipping_pincode, order_date")
    .eq("delivery_partner_id", riderId)
    .eq("order_status", "out_for_delivery")

  if (filter === "today") {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    query = query.gte("order_date", todayStart.toISOString())
  }

  const { data: orders, error } = await query.order("order_date", { ascending: true })

  if (error) {
    console.error("Error fetching delivery sheet:", error)
    return NextResponse.json({ ok: false, error: "Could not load the delivery sheet." }, { status: 500, headers: CORS_HEADERS })
  }

  const orderIds = (orders || []).map((o) => o.id)
  const customerIds = (orders || []).map((o) => o.customer_id).filter(Boolean)

  const [{ data: items }, { data: customers }] = await Promise.all([
    orderIds.length
      ? supabase.from("order_items").select("order_id, product_name, quantity").in("order_id", orderIds)
      : Promise.resolve({ data: [] as any[] }),
    customerIds.length
      ? supabase.from("customers").select("id, first_name, last_name, mobile_primary, full_address").in("id", customerIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const customerById = new Map((customers || []).map((c) => [c.id, c]))
  const itemsByOrder = new Map<string, { productName: string; quantity: number }[]>()
  ;(items || []).forEach((i: any) => {
    if (!itemsByOrder.has(i.order_id)) itemsByOrder.set(i.order_id, [])
    itemsByOrder.get(i.order_id)!.push({ productName: i.product_name, quantity: i.quantity })
  })

  const sheetOrders = (orders || []).map((o) => {
    const customer = o.customer_id ? customerById.get(o.customer_id) : null
    const address =
      o.shipping_full_address ||
      customer?.full_address ||
      [o.shipping_building_name, o.shipping_street_area, o.shipping_city, o.shipping_state, o.shipping_pincode].filter(Boolean).join(", ")

    return {
      id: o.id,
      orderNumber: o.order_number,
      customerName: customer ? `${customer.first_name} ${customer.last_name}`.trim() : o.customer_full_name || "Customer",
      customerPhone: customer?.mobile_primary || "",
      customerAddress: address,
      paymentMethod: o.payment_method || "",
      total: o.total_amount,
      items: itemsByOrder.get(o.id) || [],
    }
  })

  const totalItems = sheetOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
  const totalAmount = sheetOrders.reduce((sum, o) => sum + o.total, 0)
  const totalCod = sheetOrders.reduce((sum, o) => (o.paymentMethod === "cash" || o.paymentMethod === "cod" ? sum + o.total : sum), 0)

  return NextResponse.json(
    {
      ok: true,
      sheet: {
        orders: sheetOrders,
        totalOrders: sheetOrders.length,
        totalItems,
        totalAmount,
        totalCod,
      },
    },
    { headers: CORS_HEADERS }
  )
}
