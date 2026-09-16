/**
 * Shared Gemini API key pool.
 *
 * Add new keys to HARDCODED_KEY_POOL or set GEMINI_API_KEYS (comma-separated)
 * in env. Env keys are tried first; the merged list is deduped.
 *
 * The currentKeyIndex is a module-level cursor that persists for the life of
 * a Node worker, so a key that just hit a quota error isn't retried first by
 * the next request.
 */

// Sadharmik & Co's own keys go in the GEMINI_API_KEYS env var (comma-separated)
// — this pool was Kalapurna's own hardcoded keys and has been cleared out
// rather than carried over into a different business's deployment.
const HARDCODED_KEY_POOL: string[] = []

export const GEMINI_KEY_POOL: string[] = (() => {
  const envKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
  return Array.from(new Set([...envKeys, ...HARDCODED_KEY_POOL]))
})()

let currentKeyIndex = 0

export function getCurrentKey(): string | null {
  if (GEMINI_KEY_POOL.length === 0) return null
  return GEMINI_KEY_POOL[currentKeyIndex % GEMINI_KEY_POOL.length]
}

export function isQuotaOrAuthError(status: number, body: string): boolean {
  if (status === 429 || status === 403) return true
  if (status === 400 && /quota|api key|API_KEY/i.test(body)) return true
  return false
}

/**
 * Transient server-side errors (model overloaded, upstream hiccup, etc.) —
 * not tied to which key you used, so retrying (ideally with another key, in
 * case load-balances differently) is the right move rather than failing
 * fast. Matches Google's own guidance for 503 UNAVAILABLE / 500 / 502 / 504.
 */
export function isRetryableServerError(status: number): boolean {
  return status === 503 || status === 500 || status === 502 || status === 504
}

const RETRY_BACKOFF_MS = 600

export interface PoolCallResult {
  ok: boolean
  status: number
  bodyText: string
  keyUsed: string | null
  attempts: number
  finalError?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Round-robin REST call with quota/auth fallback.
 * On 429/403/quota errors → advance to next key and retry immediately.
 * On 500/502/503/504 (transient, model-overloaded-style errors) → advance to
 * next key and retry too; if the whole pool comes back overloaded, wait a
 * moment and run one more full pass before giving up (these errors clear up
 * fast and aren't specific to any one key).
 * On any other error → fail fast (don't burn the rest of the pool).
 */
export async function callGeminiWithPool(
  buildUrl: (key: string) => string,
  init: Omit<RequestInit, "body"> & { body: BodyInit }
): Promise<PoolCallResult> {
  if (GEMINI_KEY_POOL.length === 0) {
    return {
      ok: false,
      status: 500,
      bodyText: "",
      keyUsed: null,
      attempts: 0,
      finalError: "No Gemini API keys configured",
    }
  }

  let lastStatus = 0
  let lastBody = ""
  let lastKey: string | null = null
  let attempts = 0

  const maxPasses = 2 // initial pass + one backoff retry pass if everything was transiently overloaded
  for (let pass = 0; pass < maxPasses; pass++) {
    if (pass > 0) await sleep(RETRY_BACKOFF_MS)

    for (let i = 0; i < GEMINI_KEY_POOL.length; i++) {
      const idx = (currentKeyIndex + i) % GEMINI_KEY_POOL.length
      const key = GEMINI_KEY_POOL[idx]
      attempts += 1
      lastKey = key

      let res: Response
      try {
        res = await fetch(buildUrl(key), init)
      } catch (err: any) {
        lastStatus = 0
        lastBody = err?.message || "network error"
        currentKeyIndex = (idx + 1) % GEMINI_KEY_POOL.length
        continue
      }

      const text = await res.text()
      lastStatus = res.status
      lastBody = text

      if (res.ok) {
        currentKeyIndex = idx
        return { ok: true, status: res.status, bodyText: text, keyUsed: key, attempts }
      }

      if (isQuotaOrAuthError(res.status, text) || isRetryableServerError(res.status)) {
        console.warn(
          `Gemini key ${idx + 1}/${GEMINI_KEY_POOL.length} failed (${res.status}); trying next.`
        )
        currentKeyIndex = (idx + 1) % GEMINI_KEY_POOL.length
        continue
      }

      return {
        ok: false,
        status: res.status,
        bodyText: text,
        keyUsed: key,
        attempts,
        finalError: `Gemini error (${res.status})`,
      }
    }

    // If the whole pass failed for a reason other than transient overload,
    // no point burning a second pass with a backoff wait — bail now.
    if (!isRetryableServerError(lastStatus)) break
  }

  return {
    ok: false,
    status: lastStatus,
    bodyText: lastBody,
    keyUsed: lastKey,
    attempts,
    finalError:
      lastStatus === 503 || isRetryableServerError(lastStatus)
        ? "Gemini's vision model is temporarily overloaded — please try again in a few seconds."
        : `All ${GEMINI_KEY_POOL.length} Gemini keys failed (last status ${lastStatus})`,
  }
}
