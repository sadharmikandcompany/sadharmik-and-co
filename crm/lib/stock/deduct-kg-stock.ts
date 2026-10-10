import type { SupabaseClient } from "@supabase/supabase-js"
import { kgForItem } from "@/lib/product-weight"

type OrderItemForStock = {
  product_id: string | null
  quantity: number
  weight_grams?: number | null
}

/**
 * Deducts kg stock from a warehouse's godown_kg_stock for each item sold —
 * selling a 500g pack takes 0.5kg off, a 1kg pack takes 1kg off, etc. Stock
 * is tracked per product category (one row per flavour/product per
 * warehouse), so this groups line items by their product's category first.
 * Products that aren't linked to a category yet (raw ingredients, anything
 * not onboarded into the kg-stock system) are silently skipped — there's
 * nothing to deduct from for them. Allowed to go negative, same as manual
 * edits — that's the signal a warehouse oversold what it had on hand.
 */
export async function deductKgStockForOrder(
  supabase: SupabaseClient,
  godownId: string | null | undefined,
  items: OrderItemForStock[]
): Promise<void> {
  if (!godownId) return
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[]
  if (productIds.length === 0) return

  const { data: variants } = await supabase
    .from("product_variants")
    .select("product_id, category_id")
    .in("product_id", productIds)

  const categoryByProduct = new Map<string, string>()
  ;(variants || []).forEach((v: { product_id: string | null; category_id: string | null }) => {
    if (v.product_id && v.category_id) categoryByProduct.set(v.product_id, v.category_id)
  })

  const kgByCategory = new Map<string, number>()
  for (const item of items) {
    if (!item.product_id) continue
    const categoryId = categoryByProduct.get(item.product_id)
    if (!categoryId) continue
    const kg = kgForItem(item.weight_grams ?? null, item.quantity)
    if (kg <= 0) continue
    kgByCategory.set(categoryId, (kgByCategory.get(categoryId) || 0) + kg)
  }

  for (const [categoryId, kgToDeduct] of kgByCategory) {
    const { data: existing } = await supabase
      .from("godown_kg_stock")
      .select("quantity_kg")
      .eq("godown_id", godownId)
      .eq("category_id", categoryId)
      .maybeSingle()

    const current = Number(existing?.quantity_kg) || 0
    await supabase.from("godown_kg_stock").upsert(
      {
        godown_id: godownId,
        category_id: categoryId,
        quantity_kg: Number((current - kgToDeduct).toFixed(3)),
      },
      { onConflict: "godown_id,category_id" }
    )
  }
}
