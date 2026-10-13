import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseServer } from "@/lib/supabase-server"
import { buildOrdersV2Query, parseOrdersV2Filters } from "@/lib/orders-v2-query"

// Every order matching the current filters, not just the current page —
// the Orders V2 export used to only ever see initialOrders (one page's
// worth), so exporting with a filter that matched more rows than the page
// size silently dropped the rest. Same role scoping and filters as the
// page itself (see lib/orders-v2-query.ts), just unpaginated up to a safety
// cap, plus every matching order's line items for the Items/Party sheets.
const EXPORT_ROW_CAP = 5000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params: { [key: string]: string | undefined } = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  const cookieStore = await cookies()
  const userRole = cookieStore.get("user_role")?.value ?? ""
  const entityId = cookieStore.get("user_entity_id")?.value ?? ""

  const filters = parseOrdersV2Filters(params)
  const { query } = await buildOrdersV2Query(filters, { userRole, entityId })
  const { data: orders, error } = await query.range(0, EXPORT_ROW_CAP - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const orderIds = (orders || []).map((o: any) => o.id)
  let items: any[] = []
  if (orderIds.length > 0) {
    const { data: itemsData, error: itemsError } = await supabaseServer
      .from("order_items")
      .select("order_id, product_name, quantity, subtotal, unit_price, hsn_code, discount_percent, discount_amount, gst_percentage, gst_amount, total")
      .in("order_id", orderIds)
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }
    items = itemsData || []
  }

  return NextResponse.json({ orders: orders || [], items, truncated: (orders || []).length >= EXPORT_ROW_CAP })
}
