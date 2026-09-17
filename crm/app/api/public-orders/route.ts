import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    const supabaseAdmin = getSupabaseAdmin()

    // Match each cart line to a real product record by name (case-insensitive)
    const productNames = items.map((i) => i.productName)
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, name, hsn_code, gst_percentage, customer_price, customer_sale_price")
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
      }
    })

    const subtotal = orderItemsData.reduce((sum, i) => sum + i.subtotal, 0)
    const gstAmount = orderItemsData.reduce((sum, i) => sum + i.gst_amount, 0)
    // Free delivery above 1kg (two 500g packs), ₹70 below — same rule shown on the website.
    const totalQuantity = orderItemsData.reduce((sum, i) => sum + i.quantity, 0)
    const shippingCharges = totalQuantity >= 2 ? 0 : 70
    const totalAmount = subtotal + shippingCharges

    const pincodeMatch = address.match(/\b\d{6}\b/)
    const [firstName, ...restName] = name.split(/\s+/)
    const orderNumber = `ORD-${Date.now()}`

    const orderData = {
      order_number: orderNumber,
      customer_id: null,
      customer_first_name: firstName || name,
      customer_last_name: restName.join(" ") || null,
      customer_full_name: name,
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

    // Auto-generate invoice number
    const { data: nextInvoiceNumber, error: invoiceError } = await supabaseAdmin.rpc('get_next_invoice_number', {
      is_gst: false,
      dist_code: null,
      force_kp: false,
      p_is_mandir: false
    })
    
    if (!invoiceError && nextInvoiceNumber) {
      await supabaseAdmin.from("orders").update({ invoice_number_non_gst: nextInvoiceNumber }).eq("id", order.id)
    }

    return NextResponse.json({ ok: true, orderNumber: order.order_number }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error("Error in public-orders route:", error)
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500, headers: CORS_HEADERS })
  }
}
