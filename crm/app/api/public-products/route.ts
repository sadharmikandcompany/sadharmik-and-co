import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Public, unauthenticated endpoint consumed by the marketing website
// (sadharmikandcompany.com) to render its live product grid. Only
// products explicitly marked is_active + show_on_website are exposed here;
// everything else in the CRM's product catalog stays internal.
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

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from("products")
      .select("name, short_description, long_description, customer_price, customer_sale_price, images")
      .eq("is_active", true)
      .eq("show_on_website", true)
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching public products:", error)
      return NextResponse.json({ ok: false, products: [] }, { status: 500 })
    }

    const products = (data || []).map((p) => ({
      name: p.name,
      description: p.short_description || p.long_description || "",
      price: p.customer_sale_price || p.customer_price,
      packSize: "",
      imageUrl: p.images && p.images.length > 0 ? p.images[0] : null,
    }))

    return NextResponse.json(
      { ok: true, products },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("Error in public-products route:", error)
    return NextResponse.json({ ok: false, products: [] }, { status: 500 })
  }
}
