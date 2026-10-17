import type { SupabaseClient } from "@supabase/supabase-js"

/** Inserts a bank_transactions row, tolerating a not-yet-migrated created_by column. */
export async function insertBankTransaction(
  supabase: SupabaseClient,
  payload: Record<string, any>
): Promise<{ data: { id: string } | null; error: any }> {
  let { data, error } = await supabase.from("bank_transactions").insert([payload]).select("id").single()
  if (error && (error.code === "PGRST204" || error.code === "42703") && /created_by/i.test(error.message || "")) {
    const { created_by, ...rest } = payload
    void created_by
    ;({ data, error } = await supabase.from("bank_transactions").insert([rest]).select("id").single())
  }
  return { data, error }
}

/** Credit adds to the account balance, Debit subtracts. */
export async function adjustAccountBalance(supabase: SupabaseClient, bankAccountId: string, delta: number) {
  const { data: acct, error: fetchErr } = await supabase
    .from("bank_accounts")
    .select("current_balance")
    .eq("id", bankAccountId)
    .single()
  if (fetchErr || !acct) {
    console.error("Failed to read account balance for update:", fetchErr)
    return
  }
  const { error: updateErr } = await supabase
    .from("bank_accounts")
    .update({ current_balance: Number(acct.current_balance || 0) + delta })
    .eq("id", bankAccountId)
  if (updateErr) {
    console.error("Failed to update account balance:", updateErr)
  }
}

/**
 * Applies a payment delta to one order's paid_amount, recomputing
 * payment_status from it. Positive delta = more paid (Payment In),
 * negative = less paid (a reversal or Payment Out against the order).
 * Same logic as Reconciliation's own adjustOrderPayment — kept as a
 * separate copy here (not imported from that page) so this shared helper
 * has no dependency on that large, page-local component.
 */
export async function adjustOrderPayment(supabase: SupabaseClient, orderId: string, delta: number) {
  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("paid_amount, total_amount")
    .eq("id", orderId)
    .single()
  if (fetchErr || !order) {
    console.error("Failed to read order for payment update:", fetchErr)
    return
  }
  const totalAmount = Number(order.total_amount || 0)
  const newPaidAmount = Math.max(0, Number(order.paid_amount || 0) + delta)
  const paymentStatus = newPaidAmount <= 0 ? "pending" : newPaidAmount >= totalAmount ? "completed" : "partial"
  const { error: updateErr } = await supabase
    .from("orders")
    .update({ paid_amount: newPaidAmount, payment_status: paymentStatus })
    .eq("id", orderId)
  if (updateErr) {
    console.error("Failed to update order payment:", updateErr)
  }
}

const isMissingAllocationsTable = (error: any) =>
  !!error && (error.code === "PGRST205" || error.code === "PGRST204" || error.code === "42P01" || /payment_allocations/i.test(error.message || ""))

export type PayableOrder = {
  id: string
  total_amount: number
  paid_amount?: number | null
  linked_credit_notes?: number | null
}

/** A bill's own fixed total never changes — this is what's still owed on it. */
export function orderOwed(order: PayableOrder): number {
  return Math.max(0, Number(order.total_amount || 0) - Number(order.paid_amount || 0) - Number(order.linked_credit_notes || 0))
}

/**
 * Splits one transaction's amount across several bills, in the order
 * given — each bill's own remaining balance first, any leftover rolling
 * to the next. Writes a payment_allocations row per bill touched (same
 * table Reconciliation's vendor/FIFO paths use) so the split can be read
 * back or reversed correctly later.
 */
export async function allocateToOrders(
  supabase: SupabaseClient,
  bankTransactionId: string,
  orders: PayableOrder[],
  totalAmount: number,
  type: "Cr" | "Dr"
) {
  let remaining = totalAmount
  const sign = type === "Cr" ? 1 : -1
  for (const order of orders) {
    if (remaining <= 0) break
    const owed = orderOwed(order)
    if (owed <= 0) continue
    const applied = Math.min(owed, remaining)
    await adjustOrderPayment(supabase, order.id, sign * applied)
    const { error } = await supabase
      .from("payment_allocations")
      .insert([{ bank_transaction_id: bankTransactionId, order_id: order.id, amount_applied: applied }])
    if (error && !isMissingAllocationsTable(error)) {
      console.error("Failed to record payment allocation:", error)
    }
    remaining -= applied
  }
}
