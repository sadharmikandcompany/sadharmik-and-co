// Shared kg calculation for order line items. Replaces the old Kalapurna
// liters-from-product-name parsing (product-litres.ts) — that relied on a
// naming convention like "... Bottle - 5 LTR" which Sadharmik's khakhra
// products don't follow. Weight instead comes from each product's own
// net_weight_grams field, looked up by product_id.
export type ItemForWeight = { product_id: string | null; quantity: number }

/** Total kg for a set of order line items, given a product_id -> net_weight_grams map. */
export function totalKgForItems(
  items: ItemForWeight[],
  weightByProductId: Record<string, number | null | undefined>
): number {
  return items.reduce((sum, item) => {
    const grams = item.product_id ? weightByProductId[item.product_id] : null
    if (!grams || grams <= 0) return sum
    return sum + (grams / 1000) * (Number(item.quantity) || 0)
  }, 0)
}

/** Kg for a single line item, given its product's net_weight_grams. */
export function kgForItem(netWeightGrams: number | null | undefined, quantity: number): number {
  if (!netWeightGrams || netWeightGrams <= 0) return 0
  return (netWeightGrams / 1000) * (Number(quantity) || 0)
}
