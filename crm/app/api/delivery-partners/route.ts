import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get("is_active")
    const isAvailable = searchParams.get("is_available")
    const warehouseId = searchParams.get("warehouse_id")

    const supabaseAdmin = getSupabaseAdmin()

    let query = supabaseAdmin
      .from("delivery_partners")
      .select(`
        id,
        name,
        partner_code,
        mobile,
        vehicle_type,
        vehicle_number,
        serviceable_pincodes,
        assigned_godown_ids,
        is_active,
        is_available,
        average_rating,
        total_deliveries,
        city,
        state
      `)
      .order("name", { ascending: true })

    if (isActive === "true") {
      query = query.eq("is_active", true)
    }

    if (isAvailable === "true") {
      query = query.eq("is_available", true)
    }

    // Filter by warehouse if provided
    if (warehouseId) {
      query = query.contains("assigned_godown_ids", [warehouseId])
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching delivery partners:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get active orders count for each delivery partner
    if (data && data.length > 0) {
      const partnerIds = data.map((p) => p.id)

      const { data: ordersCount, error: ordersError } = await supabaseAdmin
        .from("orders")
        .select("delivery_partner_id")
        .in("delivery_partner_id", partnerIds)
        .not("order_status", "in", '("delivered","cancelled","completed")')

      if (!ordersError && ordersCount) {
        // Count orders per partner
        const countMap = ordersCount.reduce((acc: Record<string, number>, order: any) => {
          const partnerId = order.delivery_partner_id
          acc[partnerId] = (acc[partnerId] || 0) + 1
          return acc
        }, {})

        // Add active_orders_count to each partner
        const enrichedData = data.map((partner) => ({
          ...partner,
          active_orders_count: countMap[partner.id] || 0
        }))

        return NextResponse.json(enrichedData, { status: 200 })
      }
    }

    return NextResponse.json(data || [], { status: 200 })
  } catch (error) {
    console.error("Error in delivery partners API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
