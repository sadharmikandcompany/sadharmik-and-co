import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Posts a real bank_transactions row for an order's payment the moment it's
 * marked completed — nothing did this before for plain cash/UPI/bank
 * transfer/cheque payments (only the Easebuzz gateway and rider-verified
 * cash collections got one), so the Reconciliation page's account balances
 * never moved for most real sales. Cash goes to the cash account; every
 * other method goes to the real bank account (matched by account_type, not
 * a specific bank name — see the Fedral Bank account-number mismatch this
 * replaced). Guards against double-posting if called more than once for the
 * same order (e.g. re-saving an already-completed order).
 */
export async function postOrderPaymentTransaction(
  supabase: SupabaseClient,
  params: {
    orderNumber: string
    amount: number
    paymentMethod: string | null
    orderDate: string
    createdBy?: string | null
  }
): Promise<void> {
  const { orderNumber, amount, paymentMethod, orderDate, createdBy } = params
  if (!amount || amount <= 0) return

  const { data: existing } = await supabase
    .from("bank_transactions")
    .select("id")
    .eq("reference", orderNumber)
    .limit(1)
  if (existing && existing.length > 0) return

  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("id, account_type")
  if (!accounts || accounts.length === 0) return

  const isCash = paymentMethod === "cash"
  const account = accounts.find((a) => (isCash ? a.account_type === "cash" : a.account_type !== "cash"))
  if (!account) return

  await supabase.from("bank_transactions").insert({
    bank_account_id: account.id,
    txn_date: orderDate,
    value_date: orderDate,
    amount,
    txn_type: "Cr",
    description: `Payment In - ${orderNumber} (${paymentMethod || "unknown"})`,
    reference: orderNumber,
    status: "matched",
    created_by: createdBy || null,
  })
}
