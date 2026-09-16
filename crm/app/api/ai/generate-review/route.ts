import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { GEMINI_KEY_POOL, callGeminiWithPool } from "@/lib/gemini-keys"

export const runtime = "nodejs"

interface GenerateBody {
  productId?: string
  productName?: string
  rating?: number
  reviewerName?: string
  tone?: string
  extra?: string
}

interface GeneratedReview {
  title: string
  body: string
  reviewer_name: string
}

const DEFAULT_MODEL = "gemini-2.5-flash-lite"

export async function POST(req: Request) {
  let payload: GenerateBody
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  let productId = (payload.productId || "").trim() || null
  let productName = (payload.productName || "").trim()
  const rating = Math.min(5, Math.max(1, Number(payload.rating) || 5))
  const reviewerName = (payload.reviewerName || "").trim()
  const tone = (payload.tone || "warm, authentic, conversational").trim()
  const extra = (payload.extra || "").trim()

  if (!productName) {
    try {
      const { data, error } = await supabaseServer
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .not("name", "is", null)
      if (error) throw error
      const list = (data || []).filter((p) => p?.name)
      if (list.length === 0) {
        return NextResponse.json(
          { error: "No active products found to pick from" },
          { status: 404 }
        )
      }
      const pick = list[Math.floor(Math.random() * list.length)]
      productId = pick.id
      productName = pick.name
    } catch (err: any) {
      console.error("Failed to pick random product:", err)
      return NextResponse.json(
        { error: `Failed to pick random product: ${err?.message || "db error"}` },
        { status: 500 }
      )
    }
  }

  const prompt = `You are writing a single realistic product review for an Indian D2C food brand (Kalapurna — cold-pressed oils, organic foods).

Product: ${productName}
Star rating to match in tone: ${rating}/5
${reviewerName ? `Reviewer name (use this verbatim): ${reviewerName}` : "Reviewer name: invent a plausible Indian customer name (first name + last initial, e.g. \"Priya S.\" or \"Rahul M.\"). Vary across genders and regions."}
Desired tone: ${tone}
${extra ? `Extra context from the admin: ${extra}` : ""}

Write a short product review.

Strict requirements:
- Output ONLY valid minified JSON, no markdown, no code fences, no commentary.
- Schema: {"title": string, "body": string, "reviewer_name": string}
- "title": 4–8 words, no quotes, no trailing punctuation other than "!" or "."
- "body": 2–4 sentences, 35–80 words, first-person, plausible and specific (mention taste/freshness/packaging/usage as fits the product). Do NOT invent the brand name unless natural. Do NOT use the word "review" inside the text.
- "reviewer_name": ${reviewerName ? `"${reviewerName}"` : "a realistic Indian customer name as described above"}
- Match the sentiment to the rating (1=disappointed, 3=mixed, 5=delighted).
- Use natural Indian English; do NOT use emojis or hashtags.`

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  const geminiBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          body: { type: "STRING" },
          reviewer_name: { type: "STRING" },
        },
        required: ["title", "body", "reviewer_name"],
      },
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
    const snippet = (call.bodyText || "").slice(0, 500)
    return NextResponse.json(
      {
        error: call.finalError || `Gemini error (${call.status})`,
        details: snippet,
        attempts: call.attempts,
        keyPoolSize: GEMINI_KEY_POOL.length,
      },
      { status: 502 }
    )
  }

  let geminiJson: any
  try {
    geminiJson = JSON.parse(call.bodyText)
  } catch {
    return NextResponse.json(
      { error: "Gemini returned non-JSON response" },
      { status: 502 }
    )
  }

  const candidate = geminiJson?.candidates?.[0]
  const parts: any[] = candidate?.content?.parts || []
  const text: string = parts.map((p) => p?.text || "").join("").trim()

  if (!text) {
    const finishReason = candidate?.finishReason || "unknown"
    const safety = candidate?.safetyRatings
    console.error("Gemini empty response:", { finishReason, safety, raw: geminiJson })
    return NextResponse.json(
      {
        error: `Gemini returned an empty response (finishReason: ${finishReason})`,
        finishReason,
      },
      { status: 502 }
    )
  }

  let parsed: GeneratedReview | null = null
  const candidates: string[] = []
  candidates.push(text)
  candidates.push(
    text
      .replace(/^```(?:json)?/i, "")
      .replace(/```\s*$/i, "")
      .trim()
  )
  const match = text.match(/\{[\s\S]*\}/)
  if (match) candidates.push(match[0])

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c)
      if (obj && typeof obj.body === "string") {
        parsed = {
          title: String(obj.title || ""),
          body: String(obj.body),
          reviewer_name: String(obj.reviewer_name || ""),
        }
        break
      }
    } catch {
      // try next
    }
  }

  if (!parsed) {
    console.error("Gemini parse failed. Raw text:", text)
    return NextResponse.json(
      { error: "Could not parse Gemini output as JSON", raw: text },
      { status: 502 }
    )
  }

  return NextResponse.json({
    title: parsed.title.trim(),
    body: parsed.body.trim(),
    reviewerName: (reviewerName || parsed.reviewer_name).trim(),
    productId,
    productName,
    model,
    keyAttempts: call.attempts,
  })
}
