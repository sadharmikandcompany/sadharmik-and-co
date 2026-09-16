// Shared litres parsing for order/purchase line items — mirrors
// app/dashboard/factory-dashboard/page.tsx :: variantToLitres (ml / l / ltr
// suffix in the product name, e.g. "... Bottle - 15 LTR" or "... - 500ML").
export function parseLitresFromName(name: string, qty: number): number {
  if (!name) return 0
  const v = name.toLowerCase()
  const mlMatch = v.match(/(\d+(?:\.\d+)?)\s*ml\b/)
  if (mlMatch) return (parseFloat(mlMatch[1]) / 1000) * qty
  const lMatch = v.match(/(\d+(?:\.\d+)?)\s*(?:ltr|l)\b/)
  if (lMatch) return parseFloat(lMatch[1]) * qty
  return 0
}

export type ProductCategory = "ghee" | "oil" | "other"

// Bifurcates a bill's litres by product family — e.g. "Sadharmik & Company Cold Press
// Ground Nut Oil Bottle - 1 LTR" → oil, "Sadharmik & Company Natural A2 Desi Cow Ghee
// Bottle - 5 LTR" → ghee. Word-boundary match so "boil" etc. never false-hits.
export function categorizeProduct(name: string): ProductCategory {
  if (!name) return "other"
  if (/\boil\b/i.test(name)) return "oil"
  if (/\bghee\b/i.test(name)) return "ghee"
  return "other"
}

export type BillLitres = { ghee: number; oil: number; other: number; total: number }

export function makeEmptyBillLitres(): BillLitres {
  return { ghee: 0, oil: 0, other: 0, total: 0 }
}

/** Buckets a set of {product_name, quantity} line items into per-category litres. */
export function bucketLitresByCategory(
  items: { product_name: string | null; quantity: number }[]
): BillLitres {
  const result = makeEmptyBillLitres()
  for (const item of items) {
    const name = item.product_name || ""
    const qty = Number(item.quantity) || 0
    const litres = parseLitresFromName(name, qty)
    if (litres <= 0) continue
    const category = categorizeProduct(name)
    result[category] += litres
    result.total += litres
  }
  return result
}
