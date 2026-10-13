import { supabaseServer } from "@/lib/supabase-server"

export type OrdersV2Filters = {
  search: string
  orderStatus: string
  deliveryStatus: string
  paymentMethod: string
  paymentStatus: string
  distributorId: string
  deliveryPartnerId: string
  dateFrom: string
  dateTo: string
  amountFrom: string
  amountTo: string
  hideRetailer: boolean
  websiteOnly: boolean
  sortBy: string
  sortOrder: string
}

export type OrdersV2RoleContext = {
  userRole: string
  entityId: string
}

export function parseOrdersV2Filters(params: { [key: string]: string | string[] | undefined }): OrdersV2Filters {
  return {
    search: String(params.search || "").trim(),
    orderStatus: String(params.orderStatus || "all"),
    deliveryStatus: String(params.deliveryStatus || "all"),
    paymentMethod: String(params.paymentMethod || "all"),
    paymentStatus: String(params.paymentStatus || "all"),
    distributorId: String(params.distributorId || "all"),
    deliveryPartnerId: String(params.deliveryPartnerId || "all"),
    dateFrom: String(params.dateFrom || ""),
    dateTo: String(params.dateTo || ""),
    amountFrom: String(params.amountFrom || ""),
    amountTo: String(params.amountTo || ""),
    hideRetailer: String(params.hideRetailer || "") === "1",
    websiteOnly: String(params.websiteOnly || "") === "1",
    sortBy: String(params.sortBy || ""),
    sortOrder: String(params.sortOrder || "desc") === "asc" ? "asc" : "desc",
  }
}

/**
 * Builds the orders_v query shared by the Orders V2 page (paginated) and its
 * "export all matching orders" route (unpaginated) — same role scoping and
 * filters in both places, so an export never diverges from what the page
 * itself is showing. Caller applies .range()/.order() for pagination if
 * needed; sorting is applied here since both callers want it.
 */
export async function buildOrdersV2Query(filters: OrdersV2Filters, role: OrdersV2RoleContext) {
  const { userRole, entityId } = role
  const isMainDistributor = userRole === "main_distributor"
  const isSubDistributor = userRole === "sub_distributor"
  const isDistributor = isMainDistributor || isSubDistributor
  const isRetailer = userRole === "retailer"
  const isFactory = userRole === "factories"
  const hidesKpInvoices = isDistributor || isRetailer

  const {
    search, orderStatus, deliveryStatus, paymentMethod, paymentStatus,
    distributorId, deliveryPartnerId, dateFrom, dateTo, amountFrom, amountTo,
    hideRetailer, websiteOnly, sortBy, sortOrder,
  } = filters

  let query = supabaseServer.from("orders_v").select("*", { count: "exact" })

  if (isDistributor && entityId) {
    const [distRes, retailersRes, subDistRes] = await Promise.all([
      supabaseServer
        .from("distributors")
        .select("serviceable_pincodes, serves_mandir_customers, serves_shop_customers")
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

    const territoryClauses: string[] = []
    if (pincodes.length) {
      const conditions = [
        `shipping_pincode.in.(${pincodes.join(",")})`,
        `or(is_factory_order.is.null,is_factory_order.eq.false)`,
      ]
      if (!distRes.data?.serves_shop_customers) {
        conditions.push(`or(customer_is_shop.is.null,customer_is_shop.eq.false)`)
      }
      if (!distRes.data?.serves_mandir_customers) {
        conditions.push(`or(customer_is_mandir.is.null,customer_is_mandir.eq.false)`)
      }
      territoryClauses.push(`and(${conditions.join(",")})`)
    }

    if (isSubDistributor) {
      const parts: string[] = [...territoryClauses]
      if (retailerIds.length) parts.push(`retailer_id.in.(${retailerIds.join(",")})`)
      if (parts.length) {
        query = query.or(parts.join(","))
      } else {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000")
      }
      query = query.is("distributor_id", null)
    } else {
      const parts: string[] = [`distributor_id.eq.${entityId}`, ...territoryClauses]
      if (retailerIds.length) parts.push(`retailer_id.in.(${retailerIds.join(",")})`)
      if (subDistributorIds.length) {
        parts.push(`distributor_id.in.(${subDistributorIds.join(",")})`)
      }
      query = query.or(parts.join(","))
    }
  } else if (isRetailer && entityId) {
    query = query.eq("retailer_id", entityId)
  } else {
    query = query.or("customer_id.not.is.null,retailer_id.not.is.null,distributor_id.not.is.null,customer_full_name.not.is.null")
  }

  if (isFactory) {
    const { data: distributorCodeRows } = await supabaseServer
      .from("distributors")
      .select("invoice_code")
      .not("invoice_code", "is", null)
    const distributorInvoiceCodes = (distributorCodeRows || [])
      .map((d: any) => (d.invoice_code || "").trim())
      .filter(Boolean)
    for (const code of distributorInvoiceCodes) {
      query = query
        .or(`invoice_number_gst.is.null,invoice_number_gst.not.ilike.${code}%`)
        .or(`invoice_number_non_gst.is.null,invoice_number_non_gst.not.ilike.${code}%`)
    }
  }

  if (hidesKpInvoices) {
    query = query
      .or("invoice_number_gst.is.null,invoice_number_gst.not.ilike.KP%")
      .or("invoice_number_non_gst.is.null,invoice_number_non_gst.not.ilike.KP%")
  }

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

  if (hideRetailer) {
    query = query.is("retailer_id", null)
  }
  if (websiteOnly) {
    query = query.eq("source", "website")
  }

  if (orderStatus !== "all") {
    query = query.eq("order_status", orderStatus)
  }

  if (paymentStatus === "completed") {
    query = query.eq("payment_status", "completed")
  } else if (paymentStatus === "not_completed") {
    query = query.neq("payment_status", "completed")
  }

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

  if (paymentMethod !== "all") {
    query = query.or(
      `collected_payment_method.eq.${paymentMethod},and(collected_payment_method.is.null,payment_method.eq.${paymentMethod})`
    )
  }

  if (distributorId !== "all") {
    query = query.eq("serviceable_distributor_id", distributorId)
  }

  if (deliveryPartnerId !== "all") {
    if (deliveryPartnerId === "not_assigned") {
      query = query.is("delivery_partner_id", null)
    } else {
      query = query.eq("delivery_partner_id", deliveryPartnerId)
    }
  }

  if (dateFrom) {
    query = query.gte("order_date", dateFrom)
  }
  if (dateTo) {
    query = query.lte("order_date", dateTo + "T23:59:59.999Z")
  }

  if (amountFrom && !isNaN(parseFloat(amountFrom))) {
    query = query.gte("total_amount", parseFloat(amountFrom))
  }
  if (amountTo && !isNaN(parseFloat(amountTo))) {
    query = query.lte("total_amount", parseFloat(amountTo))
  }

  const ascending = sortOrder === "asc"
  if (sortBy === "orderNumber") {
    query = query.order("order_number", { ascending })
  } else if (sortBy === "amount") {
    query = query.order("total_amount", { ascending })
  } else {
    query = query.order("order_date", { ascending: false }).order("created_at", { ascending: false })
  }

  // Wrapped in an object rather than returned directly: supabase-js query
  // builders are themselves thenable, so returning one straight out of an
  // async function makes JS auto-resolve it (running the query early and
  // handing the caller a {data,error} response instead of the builder).
  return { query }
}
