import { cookies } from "next/headers"
import { supabaseServer } from "@/lib/supabase-server"
import { OrdersTable } from "./orders-table"
import { buildOrdersV2Query, parseOrdersV2Filters } from "@/lib/orders-v2-query"

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function OrdersV2Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  // Role is mirrored to a cookie by useUserRole(); entity id by useEntityData().
  // Both are used to apply role-specific server-side filters (e.g. distributors
  // and retailers see only orders in their scope).
  const cookieStore = await cookies()
  const userRole = cookieStore.get("user_role")?.value ?? ""
  const entityId = cookieStore.get("user_entity_id")?.value ?? ""

  // Parse filter params from URL
  const page = Math.max(1, parseInt(String(params.page || "1")))
  const pageSize = Math.max(1, Math.min(100, parseInt(String(params.pageSize || "15"))))
  const filters = parseOrdersV2Filters(params)

  const { query } = await buildOrdersV2Query(filters, { userRole, entityId })
  const { data: orders, count, error } = await query
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
        search: filters.search,
        orderStatus: filters.orderStatus,
        deliveryStatus: filters.deliveryStatus,
        paymentMethod: filters.paymentMethod,
        paymentStatus: filters.paymentStatus,
        distributorId: filters.distributorId,
        deliveryPartnerId: filters.deliveryPartnerId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        amountFrom: filters.amountFrom,
        amountTo: filters.amountTo,
        hideRetailer: filters.hideRetailer ? "1" : "",
        websiteOnly: filters.websiteOnly ? "1" : "",
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      }}
      error={error?.message}
    />
  )
}
