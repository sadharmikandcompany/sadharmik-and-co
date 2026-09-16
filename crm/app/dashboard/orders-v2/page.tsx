import { cookies } from "next/headers"
import { supabaseServer } from "@/lib/supabase-server"
import { OrdersTable } from "./orders-table"

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function OrdersV2Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  // Role is mirrored to a cookie by useUserRole(); entity id by useEntityData().
  // Both are used to apply role-specific server-side filters (e.g. factory users
  // see only KP-prefixed invoices; distributors see only orders in their scope).
  const cookieStore = await cookies()
  const userRole = cookieStore.get("user_role")?.value ?? ""
  const entityId = cookieStore.get("user_entity_id")?.value ?? ""
  const isFactory = userRole === "factories"
  const isMainDistributor = userRole === "main_distributor"
  const isSubDistributor = userRole === "sub_distributor"
  const isDistributor = isMainDistributor || isSubDistributor
  const isRetailer = userRole === "retailer"
  // Distributors and retailers must not see factory-issued ("KP") invoices.
  const hidesKpInvoices = isDistributor || isRetailer

  // Parse filter params from URL
  const page = Math.max(1, parseInt(String(params.page || "1")))
  const pageSize = Math.max(1, Math.min(100, parseInt(String(params.pageSize || "15"))))
  const search = String(params.search || "").trim()
  const orderStatus = String(params.orderStatus || "all")
  const deliveryStatus = String(params.deliveryStatus || "all")
  const paymentMethod = String(params.paymentMethod || "all")
  const distributorId = String(params.distributorId || "all")
  const deliveryPartnerId = String(params.deliveryPartnerId || "all")
  const dateFrom = String(params.dateFrom || "")
  const dateTo = String(params.dateTo || "")
  const amountFrom = String(params.amountFrom || "")
  const amountTo = String(params.amountTo || "")
  // Visibility toggles: hide retailer orders / show only website orders
  const hideRetailer = String(params.hideRetailer || "") === "1"
  const websiteOnly = String(params.websiteOnly || "") === "1"

  // Build query on enriched view
  let query = supabaseServer
    .from("orders_v")
    .select("*", { count: "exact" })

  if (isDistributor && entityId) {
    // Resolve the distributor's serviceable pincodes, their retailers, and (for
    // main distributors) their sub-distributors so we can scope the query the same
    // way /dashboard/orders does.
    const [distRes, retailersRes, subDistRes] = await Promise.all([
      supabaseServer
        .from("distributors")
        .select("serviceable_pincodes")
        .eq("id", entityId)
        .maybeSingle(),
      supabaseServer.from("retailers").select("id").eq("distributor_id", entityId),
      isMainDistributor
        ? supabaseServer.from("distributors").select("id").eq("parent_id", entityId)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ])

    const pincodes: string[] = (distRes.data?.serviceable_pincodes as string[] | null) ?? []
    const retailerIds: string[] = (retailersRes.data ?? []).map((r) => r.id)
    const subDistributorIds: string[] = (subDistRes.data ?? []).map((d) => d.id)

    if (isSubDistributor) {
      // Sub-distributors: customer/retailer orders in their pincodes only,
      // explicitly excluding any distributor-level orders.
      const parts: string[] = []
      if (pincodes.length) parts.push(`shipping_pincode.in.(${pincodes.join(",")})`)
      if (retailerIds.length) parts.push(`retailer_id.in.(${retailerIds.join(",")})`)
      if (parts.length) {
        query = query.or(parts.join(","))
      } else {
        // No scope at all → show nothing rather than the global feed.
        query = query.eq("id", "00000000-0000-0000-0000-000000000000")
      }
      query = query.is("distributor_id", null)
    } else {
      // Main distributors: pincode matches, their retailers, their own orders,
      // and orders for any of their sub-distributors.
      const parts: string[] = [`distributor_id.eq.${entityId}`]
      if (pincodes.length) parts.push(`shipping_pincode.in.(${pincodes.join(",")})`)
      if (retailerIds.length) parts.push(`retailer_id.in.(${retailerIds.join(",")})`)
      if (subDistributorIds.length) {
        parts.push(`distributor_id.in.(${subDistributorIds.join(",")})`)
      }
      query = query.or(parts.join(","))
    }
  } else if (isRetailer && entityId) {
    // Retailers: only their own orders.
    query = query.eq("retailer_id", entityId)
  } else {
    // Default scope: any order that belongs to a customer, retailer, or distributor.
    query = query.or("customer_id.not.is.null,retailer_id.not.is.null,distributor_id.not.is.null")
  }

  // Factory users: only see invoices with the "KP" prefix issued from April 2026 onwards.
  if (isFactory) {
    query = query
      .or("order_number.ilike.KP%,invoice_number_gst.ilike.KP%,invoice_number_non_gst.ilike.KP%")
      .gte("order_date", "2026-04-01")
  }

  // Distributors and retailers must not see KP-prefixed (factory-issued) invoices.
  // We OR with `is.null` so rows where the invoice column is null aren't excluded —
  // PostgREST treats `null NOT ILIKE 'KP%'` as null (i.e. row excluded), which would
  // otherwise drop every non-GST or non-invoiced order.
  if (hidesKpInvoices) {
    query = query
      .or("invoice_number_gst.is.null,invoice_number_gst.not.ilike.KP%")
      .or("invoice_number_non_gst.is.null,invoice_number_non_gst.not.ilike.KP%")
  }

  // Text search across enriched columns
  if (search) {
    const s = search.replace(/%/g, "\\%").replace(/_/g, "\\_")
    const conditions = [
      `order_number.ilike.%${s}%`,
      `customer_name.ilike.%${s}%`,
      `customer_phone.ilike.%${s}%`,
      `customer_phone_secondary_1.ilike.%${s}%`,
      `customer_phone_secondary_2.ilike.%${s}%`,
      `customer_vip_number.ilike.%${s}%`,
      `customer_full_address.ilike.%${s}%`,
      `shipping_full_address.ilike.%${s}%`,
      `shipping_city.ilike.%${s}%`,
      `shipping_pincode.ilike.%${s}%`,
      `invoice_number_gst.ilike.%${s}%`,
      `invoice_number_non_gst.ilike.%${s}%`,
    ]
    // Phone searches must tolerate spaces/dashes (e.g. "99676 93914"
    // should match "9967693914"), so retry phone columns digits-only
    const sDigits = search.replace(/\D/g, "")
    if (sDigits.length >= 4 && sDigits !== search) {
      conditions.push(
        `customer_phone.ilike.%${sDigits}%`,
        `customer_phone_secondary_1.ilike.%${sDigits}%`,
        `customer_phone_secondary_2.ilike.%${sDigits}%`
      )
    }
    query = query.or(conditions.join(","))
  }

  // Visibility toggles — retailer orders flood the list with daily bills, and
  // website orders sometimes need to be reviewed in isolation (factory request)
  if (hideRetailer) {
    query = query.is("retailer_id", null)
  }
  if (websiteOnly) {
    query = query.eq("source", "website")
  }

  // Order status filter
  if (orderStatus !== "all") {
    query = query.eq("order_status", orderStatus)
  }

  // Delivery status filter (complex logic)
  if (deliveryStatus !== "all") {
    if (deliveryStatus === "not_assigned") {
      query = query.is("route_assignment_status", null).is("delivery_partner_id", null)
    } else if (deliveryStatus === "assigned") {
      query = query.or(
        "route_assignment_status.eq.assigned,and(route_assignment_status.is.null,delivery_partner_id.not.is.null)"
      )
    } else {
      query = query.eq("route_assignment_status", deliveryStatus)
    }
  }

  // Payment method filter
  if (paymentMethod !== "all") {
    query = query.or(
      `collected_payment_method.eq.${paymentMethod},and(collected_payment_method.is.null,payment_method.eq.${paymentMethod})`
    )
  }

  // Distributor filter
  if (distributorId !== "all") {
    query = query.eq("serviceable_distributor_id", distributorId)
  }

  // Delivery partner filter
  if (deliveryPartnerId !== "all") {
    if (deliveryPartnerId === "not_assigned") {
      query = query.is("delivery_partner_id", null)
    } else {
      query = query.eq("delivery_partner_id", deliveryPartnerId)
    }
  }

  // Date range filter
  if (dateFrom) {
    query = query.gte("order_date", dateFrom)
  }
  if (dateTo) {
    query = query.lte("order_date", dateTo + "T23:59:59.999Z")
  }

  // Amount range filter
  if (amountFrom && !isNaN(parseFloat(amountFrom))) {
    query = query.gte("total_amount", parseFloat(amountFrom))
  }
  if (amountTo && !isNaN(parseFloat(amountTo))) {
    query = query.lte("total_amount", parseFloat(amountTo))
  }

  // Sort and paginate — sort by order_date (the date shown in the table),
  // not created_at, so orders appear in the same order as their visible date.
  const { data: orders, count, error } = await query
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  // Fetch dropdown options in parallel
  const [dpRes, distRes] = await Promise.all([
    supabaseServer
      .from("delivery_partners")
      .select(
        "id, name, partner_code, mobile, vehicle_type, vehicle_number, is_active, is_available, serviceable_pincodes, average_rating, total_deliveries, active_orders_count, city, state"
      )
      .eq("is_active", true)
      .order("active_orders_count", { ascending: true }),
    supabaseServer
      .from("distributors")
      .select("id, name")
      .not("serviceable_pincodes", "is", null)
      .order("name", { ascending: true }),
  ])

  return (
    <OrdersTable
      initialOrders={orders || []}
      totalCount={count || 0}
      currentPage={page}
      pageSize={pageSize}
      deliveryPartners={dpRes.data || []}
      distributors={distRes.data || []}
      filters={{
        search,
        orderStatus,
        deliveryStatus,
        paymentMethod,
        distributorId,
        deliveryPartnerId,
        dateFrom,
        dateTo,
        amountFrom,
        amountTo,
        hideRetailer: hideRetailer ? "1" : "",
        websiteOnly: websiteOnly ? "1" : "",
      }}
      error={error?.message}
    />
  )
}
