import { SupabaseClient } from "@supabase/supabase-js"

// Shapes here mirror delivery-app/lib/api.ts's RiderOrder/DeliverySheetOrder
// exactly (field names, casing) — that app's code is frozen, this just has
// to match what it already expects.

const ORDER_SELECT =
  "id, order_number, order_status, payment_method, total_amount, order_notes, is_priority, next_delivery_at, reschedule_reason, customer_id, customer_full_name, shipping_full_address, shipping_building_name, shipping_street_area, shipping_city, shipping_state, shipping_pincode"

export async function fetchRiderOrderRow(supabase: SupabaseClient, orderId: string, riderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .eq("delivery_partner_id", riderId)
    .single()

  if (error) {
    // PGRST116 is just "no matching row" (wrong id or not this rider's
    // order) — the normal not-found case, not worth logging as an error.
    if (error.code !== "PGRST116") console.error("Error fetching rider order:", error)
    return null
  }
  return order
}

function buildAddress(order: any, customer: any): string {
  if (order.shipping_full_address) return order.shipping_full_address
  if (customer?.full_address) return customer.full_address
  return [order.shipping_building_name, order.shipping_street_area, order.shipping_city, order.shipping_state, order.shipping_pincode]
    .filter(Boolean)
    .join(", ")
}

/** App-facing status label for one order, from order_status + delivery_status + next_delivery_at. */
export function riderStatusFor(order: any): "pending" | "in_progress" | "complete" | "failed" | "rescheduled" {
  if (order.order_status === "delivered") return "complete"
  if (order.order_status === "failed") return "failed"
  if (order.next_delivery_at) return "rescheduled"
  if (order.delivery_status === "picked_up") return "in_progress"
  return "pending"
}

export async function toRiderOrder(supabase: SupabaseClient, order: any) {
  const [{ data: customer }, { data: items }] = await Promise.all([
    order.customer_id
      ? supabase.from("customers").select("first_name, last_name, mobile_primary, vip_number, full_address").eq("id", order.customer_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("order_items").select("id, product_name, quantity, unit_price").eq("order_id", order.id),
  ])

  const customerName = customer ? `${customer.first_name} ${customer.last_name}`.trim() : order.customer_full_name || "Customer"
  const vipNumber = customer?.vip_number ? parseInt(customer.vip_number, 10) : NaN

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: riderStatusFor(order),
    customerName,
    customerVipNumber: Number.isNaN(vipNumber) ? 0 : vipNumber,
    customerPhone: customer?.mobile_primary || "",
    customerAddress: buildAddress(order, customer),
    paymentMethod: order.payment_method || "",
    total: order.total_amount,
    deliveryNotes: order.order_notes || null,
    isPriority: order.is_priority || false,
    rescheduledDate: order.next_delivery_at || null,
    rescheduleReason: order.reschedule_reason || null,
    items: (items || []).map((i: any) => ({
      id: i.id,
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
    })),
  }
}
