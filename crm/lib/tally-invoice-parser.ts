// Parses text extracted from a Tally-generated "TAX INVOICE" PDF (Kalapurna's
// sales invoice template) into structured fields for the Order from Factory
// auto-fill feature. Built against a real sample invoice (KP-190/2026-27);
// designed to degrade gracefully (return null/empty rather than throw) since
// Tally's exact layout can vary — the caller must always let the user review
// before saving, never trust this blindly.

export type ParsedInvoiceItem = {
  description: string
  hsnCode: string
  quantity: number
  unit: string
  ratePerUnitInclTax: number
  amount: number
}

export type ParsedTaxLine = {
  type: "IGST" | "CGST" | "SGST"
  ratePercent: number
  amount: number
}

export type ParsedTallyInvoice = {
  invoiceNumber: string | null
  invoiceDate: string | null // ISO yyyy-mm-dd, or null if unparseable
  buyerName: string | null
  buyerGstin: string | null
  buyerState: string | null
  items: ParsedInvoiceItem[]
  taxLines: ParsedTaxLine[]
  roundOff: number
  totalAmount: number | null
  rawText: string
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
}

function parseTallyDate(text: string): string | null {
  // "26-Jul-26" -> 2026-07-26. Tally uses 2-digit years; assume 2000s.
  const m = text.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/)
  if (!m) return null
  const day = m[1].padStart(2, "0")
  const mon = MONTHS[m[2].toLowerCase()]
  if (!mon) return null
  let year = m[3]
  if (year.length === 2) year = `20${year}`
  return `${year}-${mon}-${day}`
}

function parseAmount(text: string): number {
  return parseFloat(text.replace(/,/g, "")) || 0
}

export function parseTallyInvoiceText(rawText: string): ParsedTallyInvoice {
  const text = rawText.replace(/\r\n/g, "\n")

  // ---- Invoice number ----
  // "Invoice No.\nKP-190/2026-27" (label then value on next non-empty line)
  let invoiceNumber: string | null = null
  const invNoMatch = text.match(/Invoice No\.?\s*\n+\s*([A-Za-z0-9\-\/]+)/)
  if (invNoMatch) invoiceNumber = invNoMatch[1].trim()

  // ---- Invoice date ----
  // The "Dated" line immediately preceding the item table (right after
  // "Dispatched through") is the invoice date in this template.
  let invoiceDate: string | null = null
  const datedBlockMatch = text.match(/Dispatched through\s*\n+Dated\s*\n+([^\n]+)/)
  if (datedBlockMatch) invoiceDate = parseTallyDate(datedBlockMatch[1])
  if (!invoiceDate) {
    // Fallback: first "Dated" anywhere followed by a DD-Mon-YY value.
    const anyDated = text.match(/Dated\s*\n+(\d{1,2}-[A-Za-z]{3}-\d{2,4})/)
    if (anyDated) invoiceDate = parseTallyDate(anyDated[1])
  }

  // ---- Buyer (Bill to) block ----
  let buyerName: string | null = null
  let buyerGstin: string | null = null
  let buyerState: string | null = null
  const buyerBlockMatch = text.match(/Buyer \(Bill to\)\s*\n([\s\S]*?)(?:\nInvoice No\.|\nSl\s)/)
  if (buyerBlockMatch) {
    const block = buyerBlockMatch[1]
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
    if (lines.length > 0) buyerName = lines[0]
    const gstinMatch = block.match(/GSTIN\/UIN\s*:?\s*([0-9A-Z]{15})/i)
    if (gstinMatch) buyerGstin = gstinMatch[1].toUpperCase()
    const stateMatch = block.match(/State Name\s*:?\s*([A-Za-z ]+?)\s*,\s*Code/i)
    if (stateMatch) buyerState = stateMatch[1].trim()
  }

  // ---- Line items ----
  // Column order in the actual PDF text (verified against a real sample):
  // Sl No | Description | Amount | per-unit | Rate (excl. tax) | Rate (Incl. of Tax) | Quantity unit | HSN/SAC
  // e.g. "1 08 COW GHEE 15 LTR BUK 1,87,057.20 PICES 6,235.24 6,547.00 30 PICES 04059020"
  const items: ParsedInvoiceItem[] = []
  const itemRe =
    /^(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+(\S+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(\d+(?:\.\d+)?)\s+(\S+)\s+(\d{6,8})\s*$/gm
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(text)) !== null) {
    items.push({
      description: m[2].trim(),
      hsnCode: m[9],
      quantity: parseFloat(m[7]),
      unit: m[8],
      ratePerUnitInclTax: parseAmount(m[6]),
      amount: parseAmount(m[3]),
    })
  }

  // ---- Tax lines (IGST / CGST / SGST) ----
  // e.g. "IGST 5% 13,596.66 % 5" — rate is glued to the type ("5%"), followed
  // by the tax amount; ignore whatever trailing columns come after it.
  const taxLines: ParsedTaxLine[] = []
  const taxRe = /(IGST|CGST|SGST)\s+([\d.]+)%\s*([\d,]+\.\d{2})/g
  while ((m = taxRe.exec(text)) !== null) {
    taxLines.push({
      type: m[1] as "IGST" | "CGST" | "SGST",
      ratePercent: parseFloat(m[2]),
      amount: parseAmount(m[3]),
    })
  }

  // ---- Round off ----
  let roundOff = 0
  const roundOffMatch = text.match(/ROUND OFF\s+(-?[\d,]+\.\d{2})/i)
  if (roundOffMatch) roundOff = parseAmount(roundOffMatch[1])

  // ---- Total ----
  // e.g. "Total  ₹ 2,85,530.00  70 PICES" — grand total, first occurrence
  // (a second "Total" row appears later in the HSN tax-summary table).
  let totalAmount: number | null = null
  const totalMatch = text.match(/Total\s+₹\s*([\d,]+\.\d{2})/)
  if (totalMatch) totalAmount = parseAmount(totalMatch[1])

  return {
    invoiceNumber,
    invoiceDate,
    buyerName,
    buyerGstin,
    buyerState,
    items,
    taxLines,
    roundOff,
    totalAmount,
    rawText,
  }
}
