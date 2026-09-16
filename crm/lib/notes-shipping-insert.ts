import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Debit/credit note saves are defensive about `shipping_charges` possibly
 * not existing yet (migrations/add_note_shipping_charges.sql not run) —
 * same PGRST204-retry pattern as insertPurchaseItems, so a note still saves
 * correctly (just without the shipping amount) instead of failing outright
 * or, worse, leaving a parent row with no items behind it.
 */
const isMissingShippingColumn = (error: { code?: string; message?: string } | null) =>
  !!error &&
  (error.code === "PGRST204" || error.code === "42703") &&
  /shipping_charges/i.test(error.message || "")

export async function insertNoteWithShippingFallback(
  supabase: SupabaseClient,
  table: "debit_notes" | "credit_notes",
  noteData: Record<string, unknown>
): Promise<{ data: any; shippingSaveSkipped: boolean }> {
  const { data, error } = await supabase.from(table).insert([noteData]).select().single()
  if (!error) return { data, shippingSaveSkipped: false }
  if (!isMissingShippingColumn(error)) throw error

  console.warn(
    `${table}.shipping_charges column doesn't exist yet (run migrations/add_note_shipping_charges.sql) — saving without it for now.`
  )
  const { shipping_charges, ...rest } = noteData as { shipping_charges?: unknown }
  const { data: retryData, error: retryError } = await supabase.from(table).insert([rest]).select().single()
  if (retryError) throw retryError
  return { data: retryData, shippingSaveSkipped: true }
}

export async function updateNoteWithShippingFallback(
  supabase: SupabaseClient,
  table: "debit_notes" | "credit_notes",
  id: string,
  noteData: Record<string, unknown>
): Promise<{ shippingSaveSkipped: boolean }> {
  const { error } = await supabase.from(table).update(noteData).eq("id", id)
  if (!error) return { shippingSaveSkipped: false }
  if (!isMissingShippingColumn(error)) throw error

  console.warn(
    `${table}.shipping_charges column doesn't exist yet (run migrations/add_note_shipping_charges.sql) — saving without it for now.`
  )
  const { shipping_charges, ...rest } = noteData as { shipping_charges?: unknown }
  const { error: retryError } = await supabase.from(table).update(rest).eq("id", id)
  if (retryError) throw retryError
  return { shippingSaveSkipped: true }
}
