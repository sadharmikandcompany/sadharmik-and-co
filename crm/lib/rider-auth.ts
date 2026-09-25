import jwt from "jsonwebtoken"
import { createClient } from "@supabase/supabase-js"

// Auth for the Sadharmik Delivery rider app — deliberately separate from the
// CRM's own Supabase Auth login, since riders log in with mobile + a PIN set
// by an admin, not an email/password account. The token is a plain signed
// JWT (not a Supabase session token); every /api/rider/* route other than
// login verifies it with getRiderIdFromRequest below.
const RIDER_JWT_SECRET = process.env.RIDER_JWT_SECRET

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables")
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function signRiderToken(riderId: string): string {
  if (!RIDER_JWT_SECRET) throw new Error("Missing RIDER_JWT_SECRET environment variable")
  return jwt.sign({ riderId }, RIDER_JWT_SECRET, { expiresIn: "90d" })
}

/** Returns the authenticated rider's delivery_partners.id, or null if the Bearer token is missing/invalid. */
export function getRiderIdFromRequest(request: Request): string | null {
  if (!RIDER_JWT_SECRET) return null
  const authHeader = request.headers.get("authorization") || ""
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) return null

  try {
    const payload = jwt.verify(match[1], RIDER_JWT_SECRET) as { riderId?: string }
    return payload.riderId || null
  } catch {
    return null
  }
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
