import { NextResponse } from "next/server"
import { GEMINI_KEY_POOL, callGeminiWithPool } from "@/lib/gemini-keys"
import { buildTextSystemPrompt } from "@/lib/chatbot/system-prompt"

export const runtime = "nodejs"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ChatBody {
  messages: ChatMessage[]
  currentPath?: string
  pageContent?: string
  formFields?: string
}

interface ChatAction {
  type: "navigate" | "fill" | "click" | "reply"
  path?: string
  selector?: string
  value?: string
  text?: string
}

interface ChatResult {
  summary: string
  actions: ChatAction[]
}

const DEFAULT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash"

export async function POST(req: Request) {
  let body: ChatBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 })
  }

  const systemInstruction = buildTextSystemPrompt({
    currentPath: body.currentPath,
    pageContent: body.pageContent,
    formFields: body.formFields,
  })

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  const geminiBody = {
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          actions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                type: { type: "STRING" },
                path: { type: "STRING" },
                selector: { type: "STRING" },
                value: { type: "STRING" },
                text: { type: "STRING" },
              },
              required: ["type"],
            },
          },
        },
        required: ["summary", "actions"],
      },
    },
  }

  const call = await callGeminiWithPool(
    (key) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        DEFAULT_MODEL
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
    return NextResponse.json(
      {
        error: `Gemini returned empty (finishReason: ${candidate?.finishReason || "unknown"})`,
      },
      { status: 502 }
    )
  }

  let parsed: ChatResult | null = null
  const tries: string[] = [
    text,
    text.replace(/^```(?:json)?/i, "").replace(/```\s*$/i, "").trim(),
  ]
  const m = text.match(/\{[\s\S]*\}/)
  if (m) tries.push(m[0])

  for (const t of tries) {
    try {
      const obj = JSON.parse(t)
      if (obj && Array.isArray(obj.actions)) {
        parsed = { summary: String(obj.summary || ""), actions: obj.actions as ChatAction[] }
        break
      }
    } catch {
      // try next
    }
  }

  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse Gemini output as JSON", raw: text.slice(0, 500) },
      { status: 502 }
    )
  }

  return NextResponse.json(parsed)
}
