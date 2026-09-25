import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSupabaseAdmin, signRiderToken, CORS_HEADERS } from "@/lib/rider-auth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json()
    if (!phone || !password) {
      return NextResponse.json({ ok: false, error: "Phone and password are required." }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = getSupabaseAdmin()
    const { data: rider, error } = await supabase
      .from("delivery_partners")
      .select("id, password_hash, is_active")
      .eq("mobile", String(phone).trim())
      .maybeSingle()

    if (error) {
      console.error("Error looking up rider:", error)
      return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500, headers: CORS_HEADERS })
    }

    if (!rider || !rider.password_hash) {
      return NextResponse.json({ ok: false, error: "Invalid phone or password." }, { status: 401, headers: CORS_HEADERS })
    }
    if (!rider.is_active) {
      return NextResponse.json({ ok: false, error: "This account has been deactivated." }, { status: 403, headers: CORS_HEADERS })
    }

    const passwordMatches = await bcrypt.compare(String(password), rider.password_hash)
    if (!passwordMatches) {
      return NextResponse.json({ ok: false, error: "Invalid phone or password." }, { status: 401, headers: CORS_HEADERS })
    }

    const token = signRiderToken(rider.id)
    return NextResponse.json({ ok: true, token }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error("Error in rider login:", error)
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500, headers: CORS_HEADERS })
  }
}
