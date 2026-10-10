import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { deductKgStockForOrder } from "@/lib/stock/deduct-kg-stock"

// Public, unauthenticated endpoint the website's checkout posts to
// (sadharmikandcompany.com -> crm.sadharmikandcompany.com) so orders placed
// on the site show up in the CRM's Orders list. No customer login/account
// exists on the website, so these are created as guest orders (no
// customer_id) using the name/phone/address typed into checkout, matching
// the customer_first_name/last_name/full_name columns the orders table
// already has for exactly this case.
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

type CheckoutItem = { productName: string; quantity: number }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body.name || "").trim()
    const phone = String(body.phone || "").trim()
    const address = String(body.address || "").trim()
    const items: CheckoutItem[] = Array.isArray(body.items) ? body.items : []

    if (!name || !phone || !address || items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing name, phone, address, or items." },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // A PIN code is required to auto-assign the order to the right
    // distributor and delivery partner — without one the order can never be
    // routed, so it's rejected here instead of silently creating an order
    // nobody picks up. Accepts an explicit `pincode` field if the checkout
    // sends one, otherwise falls back to pulling a 6-digit PIN code out of
    // the free-text address.
    const explicitPincode = String(body.pincode || "").trim()
    const pincodeMatch = /^\d{6}$/.test(explicitPincode) ? [explicitPincode] : address.match(/\b\d{6}\b/)
    if (!pincodeMatch) {
      return NextResponse.json(
        { ok: false, error: "Please include a 6-digit PIN code in your delivery address." },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Match each cart line to a real product record by name (case-insensitive)
    const productNames = items.map((i) => i.productName)
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, name, hsn_code, gst_percentage, customer_price, customer_sale_price, net_weight_grams")
      .in("name", productNames)
      .eq("is_active", true)

    if (productsError) {
      console.error("Error looking up products for website order:", productsError)
      return NextResponse.json({ ok: false, error: "Could not look up products." }, { status: 500, headers: CORS_HEADERS })
    }

    const productByName = new Map((products || []).map((p) => [p.name.toLowerCase(), p]))
    const missing = items.filter((i) => !productByName.has(i.productName.toLowerCase()))
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Product not found: ${missing.map((m) => m.productName).join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const orderItemsData = items.map((item) => {
      const product = productByName.get(item.productName.toLowerCase())!
      const quantity = Math.max(1, Math.floor(item.quantity) || 1)
      const unitPrice = product.customer_sale_price || product.customer_price
      const gstPercentage = product.gst_percentage || 0
      const subtotal = unitPrice * quantity
      // unit_price is GST-inclusive, so the GST amount is backed out of it
      // rather than added on top (same convention as manual order creation).
      const gstAmount = (subtotal * gstPercentage) / (100 + gstPercentage)

      return {
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        hsn_code: product.hsn_code,
        gst_percentage: gstPercentage,
        gst_amount: gstAmount,
        cgst_amount: gstAmount / 2,
        sgst_amount: gstAmount / 2,
        subtotal,
        total: subtotal,
        weight_grams: product.net_weight_grams || null,
      }
    })

    const subtotal = orderItemsData.reduce((sum, i) => sum + i.subtotal, 0)
    const gstAmount = orderItemsData.reduce((sum, i) => sum + i.gst_amount, 0)
    // Free delivery above 1kg (two 500g packs), ₹70 below — same rule shown on the website.
    const totalQuantity = orderItemsData.reduce((sum, i) => sum + i.quantity, 0)
    const shippingCharges = totalQuantity >= 2 ? 0 : 70
    const totalAmount = subtotal + shippingCharges

    const [firstName, ...restName] = name.split(/\s+/)
    const orderNumber = `ORD-${Date.now()}`

    // Auto-assign a delivery partner whose serviceable pincodes cover this
    // address, same as staff-created orders (see orders/new/page.tsx).
    let autoDeliveryPartnerId: string | null = null
    if (pincodeMatch) {
      const { data: matchedPartners } = await supabaseAdmin
        .from("delivery_partners")
        .select("id")
        .not("serviceable_pincodes", "is", null)
        .contains("serviceable_pincodes", [pincodeMatch[0]])
        .eq("is_active", true)
        .limit(1)
      if (matchedPartners && matchedPartners.length > 0) {
        autoDeliveryPartnerId = matchedPartners[0].id
      }
    }

    // Resolve which warehouse should fulfill this order: the distributor
    // whose serviceable pincodes cover the address (same matching as the
    // delivery partner above), falling back to the factory's own company
    // godown. Warehouse Orders groups orders by source_godown_id, so without
    // this an order never shows up under any warehouse even when a
    // distributor's pincode list clearly covers it.
    let sourceGodownId: string | null = null
    const { data: distributorsForGodown } = await supabaseAdmin
      .from("distributors")
      .select("id, serviceable_pincodes")
      .not("serviceable_pincodes", "is", null)
    const matchedDistributor = (distributorsForGodown || []).find(
      (d: any) => Array.isArray(d.serviceable_pincodes) && d.serviceable_pincodes.includes(pincodeMatch[0])
    )
    if (matchedDistributor) {
      const { data: matchedGodown } = await supabaseAdmin
        .from("godowns")
        .select("id")
        .eq("distributor_id", matchedDistributor.id)
        .eq("is_active", true)
        .maybeSingle()
      if (matchedGodown) sourceGodownId = matchedGodown.id
    }
    if (!sourceGodownId) {
      const { data: companyGodown } = await supabaseAdmin
        .from("godowns")
        .select("id")
        .eq("godown_type", "company")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
      if (companyGodown) sourceGodownId = companyGodown.id
    }

    const orderData = {
      order_number: orderNumber,
      customer_id: null,
      customer_first_name: firstName || name,
      customer_last_name: restName.join(" ") || null,
      customer_full_name: name,
      guest_phone: phone,
      order_status: "pending",
      payment_status: "pending",
      payment_method: "cod",
      source: "website",
      is_gst_invoice: false,
      shipping_full_address: address,
      shipping_pincode: pincodeMatch ? pincodeMatch[0] : null,
      shipping_country: "India",
      shipping_state: "Maharashtra",
      shipping_city: "Mumbai",
      billing_building_name: address,
      billing_street_area: address,
      billing_pincode: pincodeMatch ? pincodeMatch[0] : "",
      billing_state: "Maharashtra",
      billing_city: "Mumbai",
      subtotal,
      discount_amount: 0,
      gst_amount: gstAmount,
      cgst_amount: gstAmount / 2,
      sgst_amount: gstAmount / 2,
      shipping_charges: shippingCharges,
      total_amount: totalAmount,
      order_notes: `Placed via website. Phone: ${phone}`,
      order_date: new Date().toISOString(),
      source_godown_id: sourceGodownId,
      delivery_partner_id: autoDeliveryPartnerId,
      assigned_to_delivery_at: autoDeliveryPartnerId ? new Date().toISOString() : null,
      delivery_status: autoDeliveryPartnerId ? "assigned" : null,
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert([orderData])
      .select("id, order_number")
      .single()

    if (orderError) {
      console.error("Error creating website order:", orderError)
      return NextResponse.json({ ok: false, error: "Could not place the order." }, { status: 500, headers: CORS_HEADERS })
    }

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsData.map((item) => ({ ...item, order_id: order.id })))

    if (itemsError) {
      console.error("Error creating website order items, rolling back order:", itemsError)
      await supabaseAdmin.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ ok: false, error: "Could not place the order." }, { status: 500, headers: CORS_HEADERS })
    }

    // Take the kg sold off the shelf at whichever warehouse is fulfilling
    // this order — selling a 500g pack deducts 0.5kg, a 1kg pack 1kg, etc.
    await deductKgStockForOrder(supabaseAdmin, sourceGodownId, orderItemsData)

    // No invoice number is generated here anymore. Website orders often need
    // corrections (address, items, GST) before a bill should exist, so they
    // land in the "Website Orders — Pending Bill" review page
    // (/dashboard/website-orders) with no invoice number, and staff convert
    // each one to a bill manually after checking it over.

    return NextResponse.json({ ok: true, orderNumber: order.order_number }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error("Error in public-orders route:", error)
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500, headers: CORS_HEADERS })
  }
}
