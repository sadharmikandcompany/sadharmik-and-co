import { NextResponse } from "next/server"
import { getSupabaseAdmin, getRiderIdFromRequest, CORS_HEADERS } from "@/lib/rider-auth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const riderId = getRiderIdFromRequest(request)
  if (!riderId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }

  const supabase = getSupabaseAdmin()
  const { data: rider, error } = await supabase
    .from("delivery_partners")
    .select("id, name, mobile, serviceable_pincodes, average_rating")
    .eq("id", riderId)
    .single()

  if (error || !rider) {
    return NextResponse.json({ ok: false, error: "Rider not found." }, { status: 404, headers: CORS_HEADERS })
  }

  return NextResponse.json(
    {
      ok: true,
      rider: {
        id: rider.id,
        name: rider.name,
        phone: rider.mobile,
        servicePincodes: rider.serviceable_pincodes || [],
        rating: rider.average_rating ?? null,
      },
    },
    { headers: CORS_HEADERS }
  )
}
