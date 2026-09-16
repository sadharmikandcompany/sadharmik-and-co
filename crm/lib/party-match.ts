import { supabase } from "@/lib/supabase"
import type { Party } from "@/components/ui/party-combobox"

// Same directional word-overlap fuzzy matcher used for vendor-name matching
// on the Purchases Tally-screenshot parser (app/dashboard/purchases/new) —
// tolerant of minor differences (singular/plural, spacing, punctuation)
// between what's on a scanned voucher and what's saved in the CRM.
const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase()
const nameTokens = (s: string) =>
  normalizeName(s)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("S") ? w.slice(0, -1) : w))

export function nameSimilarity(a: string, b: string): number {
  const tokensA = nameTokens(a)
  const tokensB = nameTokens(b)
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const setB = new Set(tokensB)
  const overlap = tokensA.filter((t) => setB.has(t)).length
  return overlap / Math.max(tokensA.length, tokensB.length)
}

/**
 * Fetches every active customer/vendor/distributor/retailer, mapped into the
 * shared Party shape used by <PartyCombobox>. Mirrors that component's own
 * fetchSelectedParty/searchParties queries so a screenshot-matched party
 * looks and behaves identically to one picked by hand.
 */
export async function fetchAllParties(): Promise<Party[]> {
  const [customersRes, vendorsRes, distributorsRes, retailersRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name, mobile_primary, email, company_name, gst_number")
      .eq("is_active", true),
    supabase
      .from("vendors")
      .select("id, vendor_name, mobile_primary, email, company_name, gst_number")
      .eq("is_active", true),
    supabase
      .from("distributors")
      .select("id, name, phone_primary, email, company_name, gst_number")
      .eq("is_active", true),
    supabase
      .from("retailers")
      .select("id, name, phone_primary, email, company_name, gst_number")
      .eq("is_active", true),
  ])

  const customers: Party[] = (customersRes.data || []).map((c: any) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`.trim(),
    phone: c.mobile_primary,
    email: c.email,
    company_name: c.company_name,
    gst_number: c.gst_number,
    type: "customer",
  }))
  const vendors: Party[] = (vendorsRes.data || []).map((v: any) => ({
    id: v.id,
    name: v.vendor_name,
    phone: v.mobile_primary,
    email: v.email,
    company_name: v.company_name,
    gst_number: v.gst_number,
    type: "vendor",
  }))
  const distributors: Party[] = (distributorsRes.data || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    phone: d.phone_primary,
    email: d.email,
    company_name: d.company_name,
    gst_number: d.gst_number,
    type: "distributor",
  }))
  const retailers: Party[] = (retailersRes.data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    phone: r.phone_primary,
    email: r.email,
    company_name: r.company_name,
    gst_number: r.gst_number,
    type: "retailer",
  }))

  return [...customers, ...vendors, ...distributors, ...retailers]
}

/**
 * Loads a single party's full details by id for pre-populating an Edit page.
 * If partyType is known (e.g. stored on the record being edited) it's tried
 * first; otherwise falls back through all four tables in turn, mirroring
 * <PartyCombobox>'s own fetchSelectedParty order.
 */
export async function fetchPartyById(partyId: string, partyType?: string): Promise<Party | null> {
  const tryCustomer = async (): Promise<Party | null> => {
    const { data } = await supabase
      .from("customers")
      .select("id, first_name, last_name, mobile_primary, email, company_name, gst_number")
      .eq("id", partyId)
      .single()
    if (!data) return null
    return {
      id: data.id,
      name: `${data.first_name} ${data.last_name}`.trim(),
      phone: data.mobile_primary,
      email: data.email,
      company_name: data.company_name,
      gst_number: data.gst_number,
      type: "customer",
    }
  }
  const tryVendor = async (): Promise<Party | null> => {
    const { data } = await supabase
      .from("vendors")
      .select("id, vendor_name, mobile_primary, email, company_name, gst_number")
      .eq("id", partyId)
      .single()
    if (!data) return null
    return {
      id: data.id,
      name: data.vendor_name,
      phone: data.mobile_primary,
      email: data.email,
      company_name: data.company_name,
      gst_number: data.gst_number,
      type: "vendor",
    }
  }
  const tryDistributor = async (): Promise<Party | null> => {
    const { data } = await supabase
      .from("distributors")
      .select("id, name, phone_primary, email, company_name, gst_number")
      .eq("id", partyId)
      .single()
    if (!data) return null
    return {
      id: data.id,
      name: data.name,
      phone: data.phone_primary,
      email: data.email,
      company_name: data.company_name,
      gst_number: data.gst_number,
      type: "distributor",
    }
  }
  const tryRetailer = async (): Promise<Party | null> => {
    const { data } = await supabase
      .from("retailers")
      .select("id, name, phone_primary, email, company_name, gst_number")
      .eq("id", partyId)
      .single()
    if (!data) return null
    return {
      id: data.id,
      name: data.name,
      phone: data.phone_primary,
      email: data.email,
      company_name: data.company_name,
      gst_number: data.gst_number,
      type: "retailer",
    }
  }

  const byType: Record<string, () => Promise<Party | null>> = {
    customer: tryCustomer,
    vendor: tryVendor,
    distributor: tryDistributor,
    retailer: tryRetailer,
  }
  if (partyType && byType[partyType]) {
    const direct = await byType[partyType]()
    if (direct) return direct
  }
  for (const fn of [tryCustomer, tryVendor, tryDistributor, tryRetailer]) {
    const result = await fn()
    if (result) return result
  }
  return null
}

/**
 * GSTIN match first (authoritative, exact), then fuzzy name — only accepted
 * if there's a single clear best match above threshold, never guessing
 * between two similarly-scored candidates.
 */
export function matchParty(partyName: string, partyGstin: string, candidates: Party[]): Party | null {
  if (partyGstin) {
    const gstMatch = candidates.find((c) => (c.gst_number || "").toUpperCase() === partyGstin.toUpperCase())
    if (gstMatch) return gstMatch
  }
  if (!partyName) return null
  const scored = candidates
    .map((c) => ({ c, score: nameSimilarity(partyName, c.company_name || c.name) }))
    .filter((x) => x.score >= 0.6)
    .sort((a, b) => b.score - a.score)
  if (scored.length === 0) return null
  if (scored.length > 1 && scored[0].score === scored[1].score) return null
  return scored[0].c
}
