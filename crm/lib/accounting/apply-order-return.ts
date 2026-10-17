import type { SupabaseClient } from "@supabase/supabase-js"
import { restoreKgStockForOrder } from "@/lib/stock/deduct-kg-stock"

export type OrderReturnLine = {
  productId: string | null
  weightGrams: number | null
  quantity: number
  amount: number
}

export type OrderForReturn = {
  id: string
  order_number: string
  source_godown_id: string | null
  payment_status: string
  payment_method: string | null
}

/**
 * Applies the real-world effects of a return against an already-billed
 * order: adds the returned kg back to the warehouse that fulfilled it, and
 * — if the order was already marked paid — posts a reversal transaction so
 * Reconciliation doesn't overstate what was actually kept.
 *
 * Deliberately does NOT touch the order's own total_amount/subtotal or its
 * order_items — a bill's own total is fixed once issued (matching Vyapar:
 * a sale's "Total" never changes, only its "Balance" does). The order's
 * linked_order_id on the credit note is what later lets every balance
 * calculation compute "amount still owed" as
 * total_amount - paid_amount - sum(linked credit notes), without ever
 * rewriting the bill itself.
 */
export async function applyOrderReturnEffects(
  supabase: SupabaseClient,
  order: OrderForReturn,
  returns: OrderReturnLine[]
): Promise<number> {
  const lines = returns.filter((r) => r.quantity > 0)
  if (lines.length === 0) return 0

  const totalReturnValue = lines.reduce((sum, l) => sum + l.amount, 0)
  if (totalReturnValue <= 0) return 0

  if (order.source_godown_id) {
    await restoreKgStockForOrder(
      supabase,
      order.source_godown_id,
      lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, weight_grams: l.weightGrams }))
    )
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
