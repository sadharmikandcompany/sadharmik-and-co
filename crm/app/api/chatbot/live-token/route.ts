import { NextResponse } from "next/server"
import { getCurrentKey, GEMINI_KEY_POOL } from "@/lib/gemini-keys"

export const runtime = "nodejs"

/**
 * Mints an ephemeral auth token for Gemini Live (browser-direct WebSocket).
 *
 * The Live API supports a 30-minute single-use token via authTokens. If that
 * fails (older key, regional restriction, etc.) we fall back to returning the
 * current pool key directly — less ideal but keeps the chat working.
 */
export async function POST() {
  const apiKey = getCurrentKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Gemini API keys configured", keyPoolSize: GEMINI_KEY_POOL.length },
      { status: 500 }
    )
  }

  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString()

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/authTokens?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            uses: 1,
            expireTime,
            newSessionExpireTime,
          },
        }),
      }
    )
    if (res.ok) {
      const data: any = await res.json()
      const token = data?.name || data?.token
      if (typeof token === "string" && token.length > 0) {
        return NextResponse.json({ token, mode: "ephemeral", expireTime })
      }
    } else {
      const errText = await res.text()
      console.warn(
        `Live ephemeral token mint failed (${res.status}): ${errText.slice(0, 200)}`
      )
    }
  } catch (err: any) {
    console.warn("Live ephemeral token mint threw:", err?.message)
  }

  return NextResponse.json({ token: apiKey, mode: "apikey" })
}
