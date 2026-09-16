import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Inserts purchase_items rows, tolerating a `purchase_category` column that
 * may not exist yet (migrations/add_purchase_item_category.sql not run).
 *
 * Without this, a row carrying `purchase_category` fails with a hard 42703
 * the moment the column is missing — and because the parent `purchases` row
 * is always inserted first and doesn't get rolled back, that leaves an
 * orphaned purchase with a real total but ZERO items. This happened for
 * real (PO-2026-0034 through 0040) when the client started sending
 * purchase_category before the migration had been run.
 *
 * On that specific failure, retries once with the field stripped so the
 * purchase itself still saves correctly — the per-item category is just
 * silently unset until the migration runs, rather than blocking the save.
 */
export async function insertPurchaseItems(
  supabase: SupabaseClient,
  rows: Record<string, any>[]
): Promise<{ categorySaveSkipped: boolean }> {
  if (rows.length === 0) return { categorySaveSkipped: false }

  const { error } = await supabase.from("purchase_items").insert(rows)
  if (!error) return { categorySaveSkipped: false }

  // PostgREST validates against its cached schema before the query ever
  // reaches Postgres, so a genuinely missing column surfaces as its own
  // PGRST204 ("Could not find the column... in the schema cache"), not the
  // raw Postgres 42703 undefined-column error — confirmed against the live
  // (unmigrated) database, not assumed.
  const missingCategoryColumn =
    (error.code === "PGRST204" || error.code === "42703") && /purchase_category/i.test(error.message || "")
  if (!missingCategoryColumn) throw error

  console.warn(
    "purchase_items.purchase_category column doesn't exist yet (run migrations/add_purchase_item_category.sql) — saving items without per-item categories for now."
  )
  const strippedRows = rows.map(({ purchase_category, ...rest }) => rest)
  const { error: retryError } = await supabase.from("purchase_items").insert(strippedRows)
  if (retryError) throw retryError

  return { categorySaveSkipped: true }
}
