/**
 * The GST pricing model on purchases flipped mid-history: rows saved before
 * the fix store purchase_items.total as GST-INCLUSIVE (with gst_amount
 * EXTRACTED out of it, total*pct/(100+pct)); rows saved after store it as
 * GST-EXCLUSIVE (with gst_amount ADDED on top, total*pct/100). There's no
 * schema flag distinguishing them — this was a known, flagged caveat of that
 * fix, and it surfaced for real on PO-2026-0004 (a July 31 purchase, before
 * the fix): the Expenses page was blindly adding GST on top of an
 * already-inclusive total, inflating ₹33,986 into ₹40,103.
 *
 * Detected per-purchase (all its items were saved together under one
 * convention) by checking which formula reconciles closer to the purchase's
 * own total_amount, which is always correct regardless of vintage:
 *   old convention: subtotal ≈ total_amount           (GST wasn't added on top)
 *   new convention: subtotal + gst_amount ≈ total_amount
 */
export function isOldGstConvention(purchase: { subtotal: number; gst_amount: number; total_amount: number }): boolean {
  const subtotal = Number(purchase.subtotal) || 0
  const gstAmount = Number(purchase.gst_amount) || 0
  const totalAmount = Number(purchase.total_amount) || 0
  const diffIfOld = Math.abs(subtotal - totalAmount)
  const diffIfNew = Math.abs(subtotal + gstAmount - totalAmount)
  return diffIfOld <= diffIfNew
}

/**
 * Splits a purchase_items row into { taxable, gst, grand }, using the item's
 * own STORED gst_amount (computed correctly at save time under whichever
 * convention was active then) rather than recomputing it from
 * gst_percentage — recomputing would silently assume the new convention
 * always, which is exactly the bug this fixes.
 */
export function splitItemGst(
  item: { total: number; gst_amount: number },
  isOldConvention: boolean
): { taxable: number; gst: number; grand: number } {
  const total = Number(item.total) || 0
  const gst = Number(item.gst_amount) || 0
  if (isOldConvention) {
    // total was GST-inclusive; gst_amount was extracted out of it.
    return { taxable: total - gst, gst, grand: total }
  }
  // total is excl-tax; gst_amount is added on top of it.
  return { taxable: total, gst, grand: total + gst }
}
