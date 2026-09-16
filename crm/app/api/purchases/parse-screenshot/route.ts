import { NextResponse } from "next/server"
import { GEMINI_KEY_POOL, callGeminiWithPool } from "@/lib/gemini-keys"

export const runtime = "nodejs"

// Unlike the Order-from-Factory Tally PDF parser (a regex parser tuned to
// Kalapurna's own fixed sales-invoice template), purchase bills come from
// many different vendors, each with their own Tally layout, and arrive as a
// screenshot (image) rather than extractable PDF text. A vision model is the
// only approach flexible enough to handle that — a rigid regex parser would
// break on the first vendor with a different column order.
const DEFAULT_MODEL = "gemini-2.5-flash"

const PROMPT = `You are reading a screenshot of a purchase bill / vendor invoice / Tally purchase voucher (India, GST). Extract the following as accurately as possible. If a field isn't clearly visible or you're not confident, leave it as an empty string / 0 — NEVER guess or invent a number.

Return ONLY the structured data via the schema provided. Rules:
- "vendorName" is the SUPPLIER we are buying from — in Tally this is the
  "Party A/c name" field. Do NOT confuse this with the company name shown in
  the title bar / header of the Tally window (e.g. "KALAPURNA PRIVATE
  LIMITED") — that is OUR OWN company whose books are open, not the vendor,
  even though it's often shown larger/more prominently at the top of the
  screen. If you see two different company-looking names on screen, the one
  next to "Party A/c name" (or "Party's A/c Name") is always the vendor.
- "invoiceNumber" is the VENDOR's own invoice/bill number — in Tally this is
  usually labeled "Supplier Invoice No." (or "Bill No.", "Vendor Invoice No.").
  Do NOT use Tally's own internal voucher/entry number (the plain "No." field
  next to "Purchase" at the top of a Tally voucher screen) — that is Tally's
  own sequence number, not the vendor's invoice number, even though it's
  usually the more visually prominent number on screen.
- invoiceDate must be ISO format "YYYY-MM-DD" (convert from whatever format is shown, e.g. "26-Jul-26" -> "2026-07-26"; assume 20xx for 2-digit years).
- Each line item's "ratePerUnitExclTax" is the rate per unit BEFORE tax — this
  is the plain "Rate" column on most Indian purchase bills / Tally purchase
  vouchers, where GST is calculated and added separately as CGST/SGST/IGST
  lines below the item table (it is NOT baked into the per-line rate or
  amount). If the bill genuinely only shows a tax-inclusive rate with no
  separate tax lines, back-calculate the excl.-tax rate: inclRate / (1 + gstPercent/100).
- "gstPercent" is that line's GST rate (5, 12, 18, etc.) if shown or derivable from a tax breakup table; otherwise 0.
- "amount" is that line's excl.-tax total (quantity × ratePerUnitExclTax), if shown — the "Amount" column on the bill before any tax lines are added.
- cgstAmount/sgstAmount/igstAmount are from the tax summary at the bottom, if present. Only one of (cgst+sgst) or igst should be non-zero, matching intra-state vs inter-state supply.
- roundOff can be negative.
- totalAmount is the final grand total of the bill (after tax and round off).`

type ParsedItem = {
  description: string
  hsnCode: string
  quantity: number
  unit: string
  ratePerUnitExclTax: number
  gstPercent: number
  amount: number
}

export type ParsedPurchaseScreenshot = {
  vendorName: string
  vendorGstin: string
  vendorState: string
  invoiceNumber: string
  invoiceDate: string
  items: ParsedItem[]
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  roundOff: number
  totalAmount: number
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    vendorName: { type: "STRING" },
    vendorGstin: { type: "STRING" },
    vendorState: { type: "STRING" },
    invoiceNumber: { type: "STRING" },
    invoiceDate: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          hsnCode: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unit: { type: "STRING" },
          ratePerUnitExclTax: { type: "NUMBER" },
          gstPercent: { type: "NUMBER" },
          amount: { type: "NUMBER" },
        },
        required: ["description", "quantity"],
      },
    },
    cgstAmount: { type: "NUMBER" },
    sgstAmount: { type: "NUMBER" },
    igstAmount: { type: "NUMBER" },
    roundOff: { type: "NUMBER" },
    totalAmount: { type: "NUMBER" },
  },
  required: ["items"],
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 })
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image (screenshot)" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    const model = process.env.GEMINI_VISION_MODEL || DEFAULT_MODEL
    const geminiBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType: file.type, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }

    const call = await callGeminiWithPool(
      (key) =>
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    )

    if (!call.ok) {
      return NextResponse.json(
        {
          error: call.finalError || `Gemini error (${call.status})`,
          details: (call.bodyText || "").slice(0, 500),
          keyPoolSize: GEMINI_KEY_POOL.length,
        },
        { status: 502 }
      )
    }

    let geminiJson: any
    try {
      geminiJson = JSON.parse(call.bodyText)
    } catch {
      return NextResponse.json({ error: "Gemini returned non-JSON response" }, { status: 502 })
    }

    const candidate = geminiJson?.candidates?.[0]
    const parts: any[] = candidate?.content?.parts || []
    const text: string = parts.map((p) => p?.text || "").join("").trim()

    if (!text) {
      const finishReason = candidate?.finishReason || "unknown"
      console.error("Gemini empty response parsing purchase screenshot:", { finishReason, raw: geminiJson })
      return NextResponse.json(
        { error: `Could not read the screenshot (finishReason: ${finishReason})` },
        { status: 502 }
      )
    }

    let parsed: any = null
    for (const candidateText of [text, text.replace(/^```(?:json)?/i, "").replace(/```\s*$/i, "").trim()]) {
      try {
        parsed = JSON.parse(candidateText)
        break
      } catch {
        // try next
      }
    }
    if (!parsed) {
      console.error("Could not parse Gemini output as JSON. Raw:", text)
      return NextResponse.json({ error: "Could not parse the extracted data" }, { status: 502 })
    }

    const invoice: ParsedPurchaseScreenshot = {
      vendorName: String(parsed.vendorName || ""),
      vendorGstin: String(parsed.vendorGstin || "").toUpperCase(),
      vendorState: String(parsed.vendorState || ""),
      invoiceNumber: String(parsed.invoiceNumber || ""),
      invoiceDate: String(parsed.invoiceDate || ""),
      items: Array.isArray(parsed.items)
        ? parsed.items
            .map((it: any) => ({
              description: String(it?.description || "").trim(),
              hsnCode: String(it?.hsnCode || ""),
              // Many expense-style vouchers (e.g. a lump-sum "Transportation"
              // or "RO Material Purchase" line) show no quantity column at
              // all — just a name and an amount. Gemini correctly reports 0
              // for that per the prompt's "leave as 0 if not confident" rule,
              // so treat 0/missing as qty 1 rather than dropping the line —
              // matches how the manual Add Item form already defaults
              // lump-sum lines to qty 1.
              quantity: Number(it?.quantity) || 1,
              unit: String(it?.unit || ""),
              ratePerUnitExclTax: Number(it?.ratePerUnitExclTax) || 0,
              gstPercent: Number(it?.gstPercent) || 0,
              amount: Number(it?.amount) || 0,
            }))
            // Only drop genuinely empty rows now — no name, or no amount/rate
            // at all (nothing worth adding), not ones that just lack a
            // quantity.
            .filter((it: ParsedItem) => it.description && (it.amount > 0 || it.ratePerUnitExclTax > 0))
        : [],
      cgstAmount: Number(parsed.cgstAmount) || 0,
      sgstAmount: Number(parsed.sgstAmount) || 0,
      igstAmount: Number(parsed.igstAmount) || 0,
      roundOff: Number(parsed.roundOff) || 0,
      totalAmount: Number(parsed.totalAmount) || 0,
    }

    // Diagnostic: makes it obvious from server logs alone whether a "no
    // items" report is Gemini genuinely finding nothing vs. something
    // getting filtered out downstream after Gemini found rows fine.
    console.log(
      `parse-screenshot: vendor="${invoice.vendorName}" rawItemCount=${Array.isArray(parsed.items) ? parsed.items.length : 0} keptItemCount=${invoice.items.length}`,
      Array.isArray(parsed.items) && parsed.items.length !== invoice.items.length
        ? { rawItems: parsed.items }
        : ""
    )

    return NextResponse.json({ success: true, invoice })
  } catch (error) {
    console.error("Error parsing purchase screenshot:", error)
    return NextResponse.json(
      { error: "Failed to read the screenshot. Please try again or enter details manually." },
      { status: 500 }
    )
  }
}
