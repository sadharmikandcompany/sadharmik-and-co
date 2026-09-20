// Shared kg calculation for order line items. Replaces the old Kalapurna
// liters-from-product-name parsing (product-litres.ts) — that relied on a
// naming convention like "... Bottle - 5 LTR" which Sadharmik's khakhra
// products don't follow. Each order_items row snapshots the weight actually
// sold on that line (a product can have several pack sizes, e.g. 250g/500g,
// picked per line at order time) — that snapshot is used when present,
// falling back to the product's own net_weight_grams for older rows saved
// before weight was recorded per line.
export type ItemForWeight = { product_id: string | null; quantity: number; weight_grams?: number | null }

/** Total kg for a set of order line items, given a product_id -> net_weight_grams fallback map. */
export function totalKgForItems(
  items: ItemForWeight[],
  weightByProductId: Record<string, number | null | undefined>
): number {
  return items.reduce((sum, item) => {
    const grams = item.weight_grams ?? (item.product_id ? weightByProductId[item.product_id] : null)
    if (!grams || grams <= 0) return sum
    return sum + (grams / 1000) * (Number(item.quantity) || 0)
  }, 0)
}

/** Kg for a single line item, given its weight in grams (line snapshot or product default). */
export function kgForItem(weightGrams: number | null | undefined, quantity: number): number {
  if (!weightGrams || weightGrams <= 0) return 0
  return (weightGrams / 1000) * (Number(quantity) || 0)
}
