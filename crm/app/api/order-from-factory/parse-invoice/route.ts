import { NextResponse } from "next/server"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { parseTallyInvoiceText } from "@/lib/tally-invoice-parser"
import { GEMINI_KEY_POOL, callGeminiWithPool } from "@/lib/gemini-keys"

// Kalapurna's own sales invoice always prints from the same fixed Tally
// template, so a PDF (extractable text) is parsed with the exact regex
// parser tuned to that layout — precise, and free. A screenshot has no
// extractable text, so it falls back to Gemini vision instead, producing
// the same shape the regex parser does so the client-side buyer/product
// matching logic needs no changes for either source.
const VISION_MODEL = "gemini-2.5-flash"

const VISION_PROMPT = `You are reading a screenshot of Kalapurna's own Tally-generated "TAX INVOICE" (a sales invoice this company issued to a buyer). Extract the following. If a field isn't clearly visible or you're not confident, leave it as an empty string / 0 — NEVER guess or invent a number.

- invoiceNumber: the "Invoice No." value (e.g. "KP-190/2026-27").
- invoiceDate: the "Dated" value near dispatch details, converted to ISO "YYYY-MM-DD" (e.g. "26-Jul-26" -> "2026-07-26"; assume 20xx for 2-digit years).
- buyerName, buyerGstin, buyerState: from the "Buyer (Bill to)" block.
- items: each row of the line-item table — description, hsnCode (HSN/SAC code), quantity, unit (e.g. PICES/NOS/LTR), ratePerUnitInclTax (the GST-inclusive rate per unit shown), amount (that line's total).`

const VISION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    invoiceNumber: { type: "STRING" },
    invoiceDate: { type: "STRING" },
    buyerName: { type: "STRING" },
    buyerGstin: { type: "STRING" },
    buyerState: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          hsnCode: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unit: { type: "STRING" },
          ratePerUnitInclTax: { type: "NUMBER" },
          amount: { type: "NUMBER" },
        },
        required: ["description", "quantity"],
      },
    },
  },
  required: ["items"],
}

async function parseViaVision(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  const model = process.env.GEMINI_VISION_MODEL || VISION_MODEL
  const geminiBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: VISION_PROMPT },
          { inlineData: { mimeType: file.type, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: VISION_RESPONSE_SCHEMA,
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
    throw new Error(call.finalError || `Gemini error (${call.status})`)
  }

  const geminiJson = JSON.parse(call.bodyText)
  const candidate = geminiJson?.candidates?.[0]
  const parts: any[] = candidate?.content?.parts || []
  const text: string = parts.map((p) => p?.text || "").join("").trim()
  if (!text) {
    throw new Error(`Could not read the screenshot (finishReason: ${candidate?.finishReason || "unknown"})`)
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
  if (!parsed) throw new Error("Could not parse the extracted data")

  return {
    invoiceNumber: String(parsed.invoiceNumber || "") || null,
    invoiceDate: String(parsed.invoiceDate || "") || null,
    buyerName: String(parsed.buyerName || "") || null,
    buyerGstin: String(parsed.buyerGstin || "").toUpperCase() || null,
    buyerState: String(parsed.buyerState || "") || null,
    items: Array.isArray(parsed.items)
      ? parsed.items
          .map((it: any) => ({
            description: String(it?.description || "").trim(),
            hsnCode: String(it?.hsnCode || ""),
            // A lump-sum line (e.g. "Packing Charges", "Delivery Fee") may
            // show no quantity at all — treat 0/missing as qty 1 rather than
            // dropping the line entirely (same fix as the purchases
            // screenshot parser — see app/api/purchases/parse-screenshot/route.ts).
            quantity: Number(it?.quantity) || 1,
            unit: String(it?.unit || ""),
            ratePerUnitInclTax: Number(it?.ratePerUnitInclTax) || 0,
            amount: Number(it?.amount) || 0,
          }))
          .filter((it: any) => it.description && (it.amount > 0 || it.ratePerUnitInclTax > 0))
      : [],
    taxLines: [],
    roundOff: 0,
    totalAmount: null,
    rawText: "",
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (file.type.startsWith("image/")) {
      const invoice = await parseViaVision(file)
      return NextResponse.json({ success: true, invoice })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF or an image (screenshot)" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { PDFParse } = await import("pdf-parse")
    // Turbopack's server bundling breaks pdfjs-dist's default relative
    // worker-file lookup, so point it at the on-disk file explicitly.
    const workerPath = path.join(
      process.cwd(),
      "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs"
    )
    PDFParse.setWorker(pathToFileURL(workerPath).href)
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()

    const invoice = parseTallyInvoiceText(result.text)

    return NextResponse.json({ success: true, invoice })
  } catch (error) {
    console.error("Error parsing Tally invoice:", error)
    const message = error instanceof Error ? error.message : "Failed to parse the file. Please check it and try again."
    return NextResponse.json({ error: message, keyPoolSize: GEMINI_KEY_POOL.length }, { status: 500 })
  }
}
