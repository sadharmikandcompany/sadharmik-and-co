import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { lookupPincodeServer } from "@/lib/pincode-lookup-server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get all serviceable pincodes from distributors, retailers, and delivery partners
    const { data: allServiceablePincodes, error: pincodeError } = await supabase.rpc(
      "get_all_serviceable_pincodes"
    )

    if (pincodeError) {
      console.error("Error fetching serviceable pincodes:", pincodeError)
      return NextResponse.json(
        { error: "Failed to fetch serviceable pincodes" },
        { status: 500 }
      )
    }

    const serviceablePincodes = new Set(
      (allServiceablePincodes || []).map((item: any) => item.pincode)
    )

    // Fetch all orders with complete details
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        order_date,
        order_status,
        payment_status,
        payment_method,
        shipping_pincode,
        shipping_city,
        shipping_state,
        shipping_country,
        shipping_full_address,
        shipping_building_name,
        shipping_street_area,
        shipping_landmark,
        shipping_room_number,
        shipping_floor,
        shipping_wing,
        billing_pincode,
        billing_city,
        billing_state,
        billing_country,
        billing_full_address,
        billing_building_name,
        billing_street_area,
        billing_landmark,
        billing_room_number,
        billing_floor,
        billing_wing,
        total_amount,
        subtotal,
        discount_amount,
        shipping_charges,
        cod_amount,
        customer_id,
        distributor_id,
        retailer_id,
        delivery_partner_id,
        customer_first_name,
        customer_last_name,
        customer_full_name
      `
      )
      .not("shipping_pincode", "is", null)
      .not("order_status", "in", '("cancelled","delivered","returned","refunded")')
      .order("order_date", { ascending: false })

    if (ordersError) {
      console.error("Error fetching orders:", ordersError)
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }

    // Filter orders where shipping_pincode is not in serviceable pincodes
    const unmatchedOrders = (orders || []).filter(
      (order) => !serviceablePincodes.has(order.shipping_pincode)
    )

    // Get unique order IDs for fetching order items
    const orderIds = unmatchedOrders.map((order) => order.id)

    // Get unique customer, distributor, and retailer IDs
    const customerIds = unmatchedOrders
      .filter((order) => order.customer_id)
      .map((order) => order.customer_id)
    const distributorIds = unmatchedOrders
      .filter((order) => order.distributor_id)
      .map((order) => order.distributor_id)
    const retailerIds = unmatchedOrders
      .filter((order) => order.retailer_id)
      .map((order) => order.retailer_id)

    // Fetch related data in parallel
    const [customersResult, distributorsResult, retailersResult, orderItemsResult] = await Promise.all([
      customerIds.length > 0
        ? supabase
            .from("customers")
            .select("id, first_name, last_name, mobile_primary, email, company_name")
            .in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      distributorIds.length > 0
        ? supabase
            .from("distributors")
            .select("id, name, phone_primary, email, company_name")
            .in("id", distributorIds)
        : Promise.resolve({ data: [], error: null }),
      retailerIds.length > 0
        ? supabase
            .from("retailers")
            .select("id, name, phone_primary, email, company_name")
            .in("id", retailerIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length > 0
        ? supabase
            .from("order_items")
            .select("order_id, product_sku, product_name, quantity, unit_price, discount_amount, gst_percentage, hsn_code, total")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    // Create lookup maps
    const customersMap = new Map(
      (customersResult.data || []).map((c: any) => [c.id, c])
    )
    const distributorsMap = new Map(
      (distributorsResult.data || []).map((d: any) => [d.id, d])
    )
    const retailersMap = new Map((retailersResult.data || []).map((r: any) => [r.id, r]))

    // Group order items by order_id
    const orderItemsMap = new Map<string, any[]>()
    ;(orderItemsResult.data || []).forEach((item: any) => {
      if (!orderItemsMap.has(item.order_id)) {
        orderItemsMap.set(item.order_id, [])
      }
      orderItemsMap.get(item.order_id)!.push(item)
    })

    // Enrich orders with customer/distributor/retailer data and lookup missing city/state
    const enrichedOrders = await Promise.all(
      unmatchedOrders.map(async (order) => {
        let customerName = "Unknown"
        let customerPhone = ""
        let customerEmail = ""
        let customerType = "customer"
        let customerCompanyName = ""

        if (order.customer_id) {
          const customer = customersMap.get(order.customer_id)
          if (customer) {
            customerName = `${customer.first_name} ${customer.last_name}`.trim()
            customerPhone = customer.mobile_primary || ""
            customerEmail = customer.email || ""
            customerCompanyName = customer.company_name || ""
          }
        } else if (order.distributor_id) {
          const distributor = distributorsMap.get(order.distributor_id)
          if (distributor) {
            customerName = distributor.name || distributor.company_name || "Unknown"
            customerPhone = distributor.phone_primary || ""
            customerEmail = distributor.email || ""
            customerCompanyName = distributor.company_name || ""
            customerType = "distributor"
          }
        } else if (order.retailer_id) {
          const retailer = retailersMap.get(order.retailer_id)
          if (retailer) {
            customerName = retailer.name || retailer.company_name || "Unknown"
            customerPhone = retailer.phone_primary || ""
            customerEmail = retailer.email || ""
            customerCompanyName = retailer.company_name || ""
            customerType = "retailer"
          }
        }

        // Get order items
        const items = orderItemsMap.get(order.id) || []

        // Auto-lookup city and state from pincode if missing
        let shippingCity = order.shipping_city
        let shippingState = order.shipping_state
        let billingCity = order.billing_city
        let billingState = order.billing_state

        // Lookup shipping city/state if missing
        if (order.shipping_pincode && (!shippingCity || !shippingState)) {
          const pincodeData = await lookupPincodeServer(order.shipping_pincode)
          if (pincodeData) {
            shippingCity = shippingCity || pincodeData.city
            shippingState = shippingState || pincodeData.state
          }
        }

        // Lookup billing city/state if missing
        if (order.billing_pincode && (!billingCity || !billingState)) {
          const pincodeData = await lookupPincodeServer(order.billing_pincode)
          if (pincodeData) {
            billingCity = billingCity || pincodeData.city
            billingState = billingState || pincodeData.state
          }
        }

        return {
          ...order,
          shipping_city: shippingCity,
          shipping_state: shippingState,
          billing_city: billingCity,
          billing_state: billingState,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_company_name: customerCompanyName,
          customer_type: customerType,
          order_items: items,
        }
      })
    )

    return NextResponse.json(enrichedOrders)
  } catch (error) {
    console.error("Error in shiprocket API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
