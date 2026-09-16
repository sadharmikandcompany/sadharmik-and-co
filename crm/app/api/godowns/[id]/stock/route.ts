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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const productIds = searchParams.get("product_ids")?.split(",") || []

    if (productIds.length === 0) {
      return NextResponse.json([], { status: 200 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get stock inventory IDs for the products
    const { data: inventoryData, error: inventoryError } = await supabaseAdmin
      .from("stock_inventory")
      .select("id, product_id")
      .in("product_id", productIds)

    if (inventoryError) {
      console.error("Error fetching inventory:", inventoryError)
      return NextResponse.json({ error: inventoryError.message }, { status: 400 })
    }

    if (!inventoryData || inventoryData.length === 0) {
      return NextResponse.json([], { status: 200 })
    }

    const inventoryIds = inventoryData.map((inv) => inv.id)

    // Get warehouse stock for these inventory items
    const { data: stockData, error: stockError } = await supabaseAdmin
      .from("godown_stock")
      .select("stock_inventory_id, quantity, available_quantity, reserved_quantity")
      .eq("godown_id", id)
      .in("stock_inventory_id", inventoryIds)

    if (stockError) {
      console.error("Error fetching warehouse stock:", stockError)
      return NextResponse.json({ error: stockError.message }, { status: 400 })
    }

    // Map stock data back to product IDs
    const stockByProduct = (stockData || []).map((stock) => {
      const inventory = inventoryData.find((inv) => inv.id === stock.stock_inventory_id)
      return {
        product_id: inventory?.product_id,
        available_quantity: stock.available_quantity,
        quantity: stock.quantity,
        reserved_quantity: stock.reserved_quantity,
      }
    })

    return NextResponse.json(stockByProduct, { status: 200 })
  } catch (error) {
    console.error("Error in warehouse stock API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
