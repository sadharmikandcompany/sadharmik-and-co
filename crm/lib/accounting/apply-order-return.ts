import type { SupabaseClient } from "@supabase/supabase-js"
import { restoreKgStockForOrder } from "@/lib/stock/deduct-kg-stock"

export type OrderReturnLine = {
  orderItemId: string
  productId: string | null
  weightGrams: number | null
  returnQty: number
}

export type OrderForReturn = {
  id: string
  order_number: string
  total_amount: number
  subtotal: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  source_godown_id: string | null
  payment_status: string
  payment_method: string | null
}

/**
 * Applies the real-world effects of a return against an already-billed
 * order: shrinks the returned line items and the order's totals
 * proportionally, adds the returned kg back to the warehouse that
 * fulfilled it, and — if the order was already marked paid — posts a
 * reversal transaction so Reconciliation doesn't overstate what was
 * actually kept. Used when a Debit Note is created against one of our own
 * sales (see the ?orderId= pre-fill on app/dashboard/debit-notes/new).
 * Returns the total value returned.
 */
export async function applyOrderReturnEffects(
  supabase: SupabaseClient,
  order: OrderForReturn,
  returns: OrderReturnLine[]
): Promise<number> {
  const lines = returns.filter((r) => r.returnQty > 0)
  if (lines.length === 0) return 0

  let totalReturnValue = 0
  let deltaSubtotalTotal = 0
  let deltaGstTotal = 0
  let deltaCgstTotal = 0
  let deltaSgstTotal = 0
  const restockLines: { product_id: string | null; quantity: number; weight_grams: number | null }[] = []

  for (const line of lines) {
    const { data: fresh } = await supabase
      .from("order_items")
      .select("quantity, subtotal, discount_amount, gst_amount, cgst_amount, sgst_amount, total")
      .eq("id", line.orderItemId)
      .single()
    if (!fresh || Number(fresh.quantity) <= 0) continue

    const qty = Math.min(line.returnQty, Number(fresh.quantity))
    const ratio = qty / Number(fresh.quantity)
    const deltaSubtotal = Number(fresh.subtotal) * ratio
    const deltaDiscount = Number(fresh.discount_amount) * ratio
    const deltaGst = Number(fresh.gst_amount) * ratio
    const deltaCgst = Number(fresh.cgst_amount) * ratio
    const deltaSgst = Number(fresh.sgst_amount) * ratio
    const deltaTotal = Number(fresh.total) * ratio

    const remainingQty = Number(fresh.quantity) - qty
    if (remainingQty <= 0) {
      // order_items.quantity/subtotal/total all have a > 0 CHECK constraint
      // — a full return of this line can't be expressed as an update to 0,
      // so the line is removed instead of left behind at a quantity the
      // return already fully consumed.
      await supabase.from("order_items").delete().eq("id", line.orderItemId)
    } else {
      await supabase
        .from("order_items")
        .update({
          quantity: remainingQty,
          subtotal: Math.max(0, Number(fresh.subtotal) - deltaSubtotal),
          discount_amount: Math.max(0, Number(fresh.discount_amount) - deltaDiscount),
          gst_amount: Math.max(0, Number(fresh.gst_amount) - deltaGst),
          cgst_amount: Math.max(0, Number(fresh.cgst_amount) - deltaCgst),
          sgst_amount: Math.max(0, Number(fresh.sgst_amount) - deltaSgst),
          total: Math.max(0, Number(fresh.total) - deltaTotal),
        })
        .eq("id", line.orderItemId)
    }

    totalReturnValue += deltaTotal
    deltaSubtotalTotal += deltaSubtotal
    deltaGstTotal += deltaGst
    deltaCgstTotal += deltaCgst
    deltaSgstTotal += deltaSgst
    restockLines.push({ product_id: line.productId, quantity: qty, weight_grams: line.weightGrams })
  }

  if (totalReturnValue <= 0) return 0

  await supabase
    .from("orders")
    .update({
      subtotal: Math.max(0, Number(order.subtotal) - deltaSubtotalTotal),
      gst_amount: Math.max(0, Number(order.gst_amount) - deltaGstTotal),
      cgst_amount: Math.max(0, Number(order.cgst_amount) - deltaCgstTotal),
      sgst_amount: Math.max(0, Number(order.sgst_amount) - deltaSgstTotal),
      total_amount: Math.max(0, Number(order.total_amount) - totalReturnValue),
    })
    .eq("id", order.id)

  if (order.source_godown_id) {
    await restoreKgStockForOrder(supabase, order.source_godown_id, restockLines)
  }

  if (order.payment_status === "completed") {
    const { data: accounts } = await supabase.from("bank_accounts").select("id, account_type")
    const isCash = order.payment_method === "cash"
    const account = (accounts || []).find((a) => (isCash ? a.account_type === "cash" : a.account_type !== "cash"))
    if (account) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from("bank_transactions").insert({
        bank_account_id: account.id,
        txn_date: new Date().toISOString(),
        value_date: new Date().toISOString(),
        amount: totalReturnValue,
        txn_type: "Dr",
        description: `Return - ${order.order_number} (₹${totalReturnValue.toFixed(2)} returned)`,
        reference: `${order.order_number}-RETURN-${Date.now()}`,
        status: "matched",
        created_by: user?.id || null,
      })
    }
  }

  return totalReturnValue
}
