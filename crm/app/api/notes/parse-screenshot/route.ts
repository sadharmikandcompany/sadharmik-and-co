import { NextResponse } from "next/server"
import { GEMINI_KEY_POOL, callGeminiWithPool } from "@/lib/gemini-keys"

export const runtime = "nodejs"

// Shared by both Debit Note and Credit Note creation (app/dashboard/debit-notes/new,
// app/dashboard/credit-notes/new) — a debit note and credit note voucher have the
// identical shape (party, a reference to the original bill/invoice, line items,
// tax breakup, total); which one applies is a client-side decision (which page
// you're on), not something Gemini needs to know.
const DEFAULT_MODEL = "gemini-2.5-flash"

const PROMPT = `You are reading a screenshot of a Debit Note / Credit Note / purchase-return / sales-return voucher (India, GST), e.g. from Tally. Extract the following as accurately as possible. If a field isn't clearly visible or you're not confident, leave it as an empty string / 0 — NEVER guess or invent a number.

Return ONLY the structured data via the schema provided. Rules:
- "partyName" is the customer/vendor/party named on the voucher (the account the note is raised against) — in Tally this is the "Party A/c name" / "Party's A/c Name" field. Do NOT confuse this with the company name shown in the title bar/header of the Tally window (e.g. "KALAPURNA PRIVATE LIMITED") — that is OUR OWN company whose books are open, not the party, even though it's often shown larger/more prominently at the top of the screen.
- "partyGstin" is that party's GSTIN if shown.
- "partyState" is that party's state if shown.
- "referenceNumber" is the ORIGINAL bill/invoice number this note refers to (e.g. "Against Bill No." / "Original Invoice No." on the voucher) — NOT Tally's own internal voucher number for the debit/credit note itself.
- "referenceDate" is that original bill/invoice's date, ISO format "YYYY-MM-DD" (convert from whatever format is shown, e.g. "26-Jul-26" -> "2026-07-26"; assume 20xx for 2-digit years).
- "noteDate" is the debit/credit note's own date, if shown separately from the reference date, ISO format.
- Each line item's "ratePerUnitExclTax" is the rate per unit BEFORE tax — the plain "Rate" column, where GST is calculated and added separately as CGST/SGST/IGST lines below the item table (it is NOT baked into the per-line rate or amount). If the voucher genuinely only shows a tax-inclusive rate with no separate tax lines, back-calculate the excl.-tax rate: inclRate / (1 + gstPercent/100).
- "gstPercent" is that line's GST rate (5, 12, 18, etc.) if shown or derivable from a tax breakup table; otherwise 0.
- "amount" is that line's excl.-tax total (quantity × ratePerUnitExclTax), if shown.
- discountAmount/cgstAmount/sgstAmount/igstAmount are from the summary at the bottom, if present. Only one of (cgst+sgst) or igst should be non-zero, matching intra-state vs inter-state supply.
- roundOff can be negative.
- totalAmount is the final grand total of the voucher.`

type ParsedItem = {
  description: string
  hsnCode: string
  quantity: number
  unit: string
  ratePerUnitExclTax: number
  gstPercent: number
  amount: number
}

export type ParsedNoteScreenshot = {
  partyName: string
  partyGstin: string
  partyState: string
  referenceNumber: string
  referenceDate: string
  noteDate: string
  items: ParsedItem[]
  discountAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  roundOff: number
  totalAmount: number
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    partyName: { type: "STRING" },
    partyGstin: { type: "STRING" },
    partyState: { type: "STRING" },
    referenceNumber: { type: "STRING" },
    referenceDate: { type: "STRING" },
    noteDate: { type: "STRING" },
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
    discountAmount: { type: "NUMBER" },
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
      console.error("Gemini empty response parsing note screenshot:", { finishReason, raw: geminiJson })
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

    const note: ParsedNoteScreenshot = {
      partyName: String(parsed.partyName || ""),
      partyGstin: String(parsed.partyGstin || "").toUpperCase(),
      partyState: String(parsed.partyState || ""),
      referenceNumber: String(parsed.referenceNumber || ""),
      referenceDate: String(parsed.referenceDate || ""),
      noteDate: String(parsed.noteDate || ""),
      items: Array.isArray(parsed.items)
        ? parsed.items
            .map((it: any) => ({
              description: String(it?.description || "").trim(),
              hsnCode: String(it?.hsnCode || ""),
              // A lump-sum line (e.g. a flat adjustment/charge) may show no
              // quantity at all — treat 0/missing as qty 1 rather than
              // dropping the line (same fix as the purchases screenshot
              // parser — see app/api/purchases/parse-screenshot/route.ts).
              quantity: Number(it?.quantity) || 1,
              unit: String(it?.unit || ""),
              ratePerUnitExclTax: Number(it?.ratePerUnitExclTax) || 0,
              gstPercent: Number(it?.gstPercent) || 0,
              amount: Number(it?.amount) || 0,
            }))
            .filter((it: ParsedItem) => it.description && (it.amount > 0 || it.ratePerUnitExclTax > 0))
        : [],
      discountAmount: Number(parsed.discountAmount) || 0,
      cgstAmount: Number(parsed.cgstAmount) || 0,
      sgstAmount: Number(parsed.sgstAmount) || 0,
      igstAmount: Number(parsed.igstAmount) || 0,
      roundOff: Number(parsed.roundOff) || 0,
      totalAmount: Number(parsed.totalAmount) || 0,
    }

    return NextResponse.json({ success: true, note })
  } catch (error) {
    console.error("Error parsing note screenshot:", error)
    return NextResponse.json(
      { error: "Failed to read the screenshot. Please try again or enter details manually." },
      { status: 500 }
    )
  }
}
