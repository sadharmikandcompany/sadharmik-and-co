"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  IndianRupee,
  ShoppingCart,
  Package,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Percent,
  TrendingUp,
  TrendingDown,
  Users,
  Droplet,
  LifeBuoy,
  Building2,
  Store,
  Truck,
  ArrowUpRight,
  Calendar,
  Filter,
  Sparkles,
  LayoutDashboard,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useUserRole } from "@/hooks/use-user-role"

type DatePreset = "today" | "thisWeek" | "thisMonth" | "lastMonth" | "thisFY" | "lastFY" | "allTime"

interface Distributor {
  id: string
  name: string
}

interface Retailer {
  id: string
  name: string
  distributor_id: string | null
}

interface TrendPoint {
  month: string
  orders: number
  litres: number
}

interface MonthlyPoint {
  month: string
  key: string
  orders: number
  sales: number
  purchases: number
  litres: number
}

// Indian Fiscal Year runs April 1 → March 31.
// offset 0 = current FY, -1 = previous FY.
function getFiscalYearRange(offset: number = 0) {
  const now = new Date()
  const currentFYStartYear =
    now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const startYear = currentFYStartYear + offset
  const start = new Date(startYear, 3, 1, 0, 0, 0, 0) // April 1, 00:00:00
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59, 999) // March 31, 23:59:59
  return {
    start,
    end,
    label: `FY ${startYear}-${String(startYear + 1).slice(-2)}`,
  }
}

export default function DashboardV2Page() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()

  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [distributorFilter, setDistributorFilter] = useState<string>("all")
  const [retailers, setRetailers] = useState<Retailer[]>([])
  const [retailerFilter, setRetailerFilter] = useState<string>("all")
  // Default to current FY so pre-April data is hidden out of the box
  // (Indian fiscal year: April 1 → March 31).
  const [datePreset, setDatePreset] = useState<DatePreset>("thisFY")

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    // Sales
    salesTotal: 0,
    salesToday: 0,
    // Purchase
    purchaseTotal: 0,
    purchaseToday: 0,
    // Stock
    stockLitres: 0,
    stockAmount: 0,
    // Cash & Bank
    cashBalance: 0,
    bankBalance: 0,
    // Bills Receivable (debtors) — customers owe us
    billsReceivableTotal: 0,
    billsReceivableOverdue: 0,
    billsReceivableCount: 0,
    // Bills Payable (creditors) — we owe vendors
    billsPayableTotal: 0,
    billsPayableOverdue: 0,
    billsPayableCount: 0,
    // Expense / GST / Income / Profit
    expense: 0,
    expenseDirect: 0,
    expenseIndirect: 0,
    gst: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    income: 0,
    profitMargin: 0,
    // Customers
    activeCustomers: 0,
    vipCustomers: 0,
    defaulterCustomers: 0,
    // Orders
    ordersTotal: 0,
    ordersToday: 0,
    ordersTodayRetail: 0,
    ordersTodayRegular: 0,
    // Litres sold
    litresSoldTotal: 0,
    litresSoldToday: 0,
    // Support
    ticketsTotal: 0,
    ticketsToday: 0,
    // Network
    distributorsCount: 0,
    retailersCount: 0,
    vendorsCount: 0,
  })
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [monthlyFY, setMonthlyFY] = useState<MonthlyPoint[]>([])
  // Which FY the breakdown represents. Follows the preset when FY presets are
  // selected, otherwise defaults to the current FY. Declared inside the effect
  // below and stored here so the UI can show it.
  const [monthlyFYLabel, setMonthlyFYLabel] = useState<string>("")

  // Only allow admin role
  useEffect(() => {
    if (!roleLoading && role && role !== "admin") {
      router.replace("/dashboard")
    }
  }, [role, roleLoading, router])

  const getDateRange = useCallback(
    (preset: DatePreset): { from: Date | null; to: Date } => {
      const now = new Date()
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)

      switch (preset) {
        case "today": {
          const start = new Date()
          start.setHours(0, 0, 0, 0)
          return { from: start, to: endOfToday }
        }
        case "thisWeek": {
          const start = new Date(now)
          const day = start.getDay()
          const diff = (day === 0 ? 6 : day - 1) // Monday start
          start.setDate(start.getDate() - diff)
          start.setHours(0, 0, 0, 0)
          return { from: start, to: endOfToday }
        }
        case "thisMonth": {
          const start = new Date(now.getFullYear(), now.getMonth(), 1)
          return { from: start, to: endOfToday }
        }
        case "lastMonth": {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const end = new Date(now.getFullYear(), now.getMonth(), 0)
          end.setHours(23, 59, 59, 999)
          return { from: start, to: end }
        }
        case "thisFY": {
          const { start } = getFiscalYearRange(0)
          return { from: start, to: endOfToday }
        }
        case "lastFY": {
          const fy = getFiscalYearRange(-1)
          return { from: fy.start, to: fy.end }
        }
        case "allTime":
        default:
          return { from: null, to: endOfToday }
      }
    },
    []
  )

  // Helper to convert variant name to litres (mirrors main dashboard logic)
  const convertToLitres = (variantName: string, qty: number): number => {
    if (!variantName) return 0
    const v = variantName.toLowerCase()
    // Look for a "<number>ml" pattern first
    const mlMatch = v.match(/(\d+(?:\.\d+)?)\s*ml\b/)
    if (mlMatch) {
      return (parseFloat(mlMatch[1]) / 1000) * qty
    }
    // Then "<number>l/lt/ltr/liter(s)/litre(s)" pattern (liters).
    // Product names in this DB use "LTR" (e.g. "5 LTR"); plain `l\b` would not
    // match "ltr" because \b is a word boundary, so allow the common suffixes.
    const lMatch = v.match(/(\d+(?:\.\d+)?)\s*l(?:t|tr|iter|itre|iters|itres)?\b/)
    if (lMatch) {
      return parseFloat(lMatch[1]) * qty
    }
    return 0
  }

  const convertStockVariantToLitres = (variantName: string, qty: number): number => {
    if (!variantName) return 0
    const v = variantName.toLowerCase()
    // Prefer regex-based extraction so suffixes don't fall through to the wrong branch.
    const mlMatch = v.match(/(\d+(?:\.\d+)?)\s*ml\b/)
    if (mlMatch) return (parseFloat(mlMatch[1]) / 1000) * qty
    const lMatch = v.match(/(\d+(?:\.\d+)?)\s*l(?:t|tr|iter|itre|iters|itres)?\b/)
    if (lMatch) return parseFloat(lMatch[1]) * qty
    // "m" or "r" suffix in this codebase means milliliters (e.g. "200m", "500r")
    const mrMatch = v.match(/(\d+(?:\.\d+)?)\s*[mr]\b/)
    if (mrMatch) return (parseFloat(mrMatch[1]) / 1000) * qty
    const numeric = parseFloat(v)
    return isNaN(numeric) ? 0 : (numeric / 1000) * qty
  }

  // Load distributors for filter dropdown
  useEffect(() => {
    const loadDistributors = async () => {
      const { data } = await supabase
        .from("distributors")
        .select("id, name")
        .is("parent_id", null)
        .order("name", { ascending: true })
      setDistributors(data || [])
    }
    loadDistributors()
  }, [])

  // Load retailers under the selected distributor. Reset retailer selection
  // whenever the distributor changes so the dropdown can't reference a
  // retailer that doesn't belong to the new distributor.
  useEffect(() => {
    setRetailerFilter("all")
    if (distributorFilter === "all") {
      setRetailers([])
      return
    }
    const loadRetailers = async () => {
      const { data } = await supabase
        .from("retailers")
        .select("id, name, distributor_id")
        .eq("distributor_id", distributorFilter)
        .order("name", { ascending: true })
      setRetailers(data || [])
    }
    loadRetailers()
  }, [distributorFilter])

  // Start and end of today in the *browser's* timezone, serialized as ISO.
  // Using date-only strings against a timestamptz column is a common timezone
  // trap — e.g. in IST it drops midnight–05:30 orders into the previous UTC day.
  const todayRange = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return { startIso: start.toISOString(), endIso: end.toISOString() }
  }, [])

  // Paginated fetch helper. Surfaces errors so a broken column name or RLS
  // failure does not silently show zeros on the dashboard.
  const fetchAllRows = async <T,>(
    build: (from: number, to: number) => any,
    label?: string
  ): Promise<T[]> => {
    const pageSize = 1000
    let page = 0
    const result: T[] = []
    while (true) {
      const from = page * pageSize
      const to = from + pageSize - 1
      const { data, error } = await build(from, to)
      if (error) {
        console.error(`[Dashboard V2] ${label || "fetch"} failed:`, error)
        throw error
      }
      if (!data) break
      result.push(...data)
      if (data.length < pageSize) break
      page++
    }
    return result
  }

  // Fetch all stats
  useEffect(() => {
    if (roleLoading || role !== "admin") return

    const load = async () => {
      setLoading(true)
      setLoadError(null)
      const { from, to } = getDateRange(datePreset)
      const fromIso = from ? from.toISOString() : null
      const toIso = to.toISOString()

      // `orders_v` exposes `serviceable_distributor_id` and `retailer_id`.
      // We need the view whenever either filter is active.
      const hasRetailerFilter = retailerFilter !== "all"
      const useView = distributorFilter !== "all" || hasRetailerFilter
      const ordersSource = useView ? "orders_v" : "orders"

      // FY breakdown range (always Apr→Mar). Reuse period orders/purchases
      // when datePreset === "lastFY" (period === breakdown).
      const breakdownFY =
        datePreset === "lastFY"
          ? getFiscalYearRange(-1)
          : getFiscalYearRange(0)
      const fyStartIso = breakdownFY.start.toISOString()
      const fyEndIso = breakdownFY.end.toISOString()
      const reuseFY = datePreset === "lastFY"
      setMonthlyFYLabel(breakdownFY.label)

      // Today is in period when `to` extends through today (today / thisWeek /
      // thisMonth / thisFY / allTime). Skip the duplicate today fetch and
      // derive today rows from period rows in that case.
      const todayStartMs = new Date(todayRange.startIso).getTime()
      const todayInPeriod = to.getTime() >= todayStartMs

      const periodOrdersCols = useView
        ? "id, total_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, order_date, order_status, payment_status, retailer_id, serviceable_distributor_id"
        : "id, total_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, order_date, order_status, payment_status, retailer_id"
      const compactOrdersCols = useView
        ? "id, total_amount, order_date, retailer_id, serviceable_distributor_id"
        : "id, total_amount, order_date, retailer_id"

      // ---- PHASE 1: all independent base queries run in parallel ----
      const [
        allPeriodOrders,
        todayOrdersRaw,
        purchData,
        todayPurchData,
        expData,
        stockResp,
        looseStockResp,
        cashRows,
        bankRows,
        customerCounts,
        ticketCounts,
        networkCounts,
        unpaidOrderRows,
        unpaidPurchaseRows,
        fyOrdersRaw,
        fyPurchaseRaw,
      ] = await Promise.all([
        // 1. Period orders
        fetchAllRows<any>((f, t) => {
          let q = supabase.from(ordersSource).select(periodOrdersCols)
          if (fromIso) q = q.gte("order_date", fromIso)
          q = q.lte("order_date", toIso)
          if (distributorFilter !== "all") q = q.eq("serviceable_distributor_id", distributorFilter)
              if (hasRetailerFilter) q = q.eq("retailer_id", retailerFilter)
          return q.range(f, t)
        }, `period orders (${ordersSource})`),

        // 2. Today orders (skip when today is in period — derive client-side)
        todayInPeriod
          ? Promise.resolve(null)
          : fetchAllRows<any>((f, t) => {
              let q = supabase
                .from(ordersSource)
                .select(compactOrdersCols)
                .gte("order_date", todayRange.startIso)
                .lte("order_date", todayRange.endIso)
              if (distributorFilter !== "all") q = q.eq("serviceable_distributor_id", distributorFilter)
              if (hasRetailerFilter) q = q.eq("retailer_id", retailerFilter)
              return q.range(f, t)
            }, `today orders (${ordersSource})`),

        // 3. Period purchases — purchases live at distributor/factory level;
        // a retailer has no purchases of its own, so skip the query when a
        // retailer is selected.
        hasRetailerFilter
          ? Promise.resolve([])
          : (async () => {
              let pq = supabase.from("purchases").select("total_amount, purchase_date")
              if (distributorFilter !== "all") pq = pq.eq("distributor_id", distributorFilter)
              if (fromIso) pq = pq.gte("purchase_date", fromIso)
              pq = pq.lte("purchase_date", toIso)
              const { data, error } = await pq
              if (error) throw error
              return data || []
            })(),

        // 4. Today purchases
        hasRetailerFilter
          ? Promise.resolve([])
          : (async () => {
              let pq = supabase
                .from("purchases")
                .select("total_amount, purchase_date")
                .gte("purchase_date", todayRange.startIso)
                .lte("purchase_date", todayRange.endIso)
              if (distributorFilter !== "all") pq = pq.eq("distributor_id", distributorFilter)
              const { data, error } = await pq
              if (error) throw error
              return data || []
            })(),

        // 5. Period expenses
        (async () => {
          let eq = supabase.from("expenses").select("amount, expense_date, expense_category")
          if (fromIso) eq = eq.gte("expense_date", fromIso)
          eq = eq.lte("expense_date", toIso)
          const { data, error } = await eq
          if (error) throw error
          return data || []
        })(),

        // 6. Stock inventory — when a retailer is selected, switch to
        // godown_stock filtered by godowns.retailer_id (retailer-owned
        // warehouses). Otherwise read company-wide stock_inventory.
        hasRetailerFilter
          ? supabase
              .from("godown_stock")
              .select(`
                quantity,
                unit_price,
                stock_inventory!inner (
                  product_variants!inner (variant_name),
                  packaging_materials!inner (material_type)
                ),
                godowns!inner (retailer_id)
              `)
              .eq("godowns.retailer_id", retailerFilter)
          : supabase.from("stock_inventory").select(`
              quantity,
              price,
              product_variants!inner (variant_name),
              packaging_materials!inner (material_type)
            `),

        // 7. Loose stock — no retailer association, skip when retailer is set.
        hasRetailerFilter
          ? Promise.resolve({ data: [] as any[] })
          : supabase.from("loose_stock").select("quantity_liters, price_per_liter"),

        // 8. Cash collections — delivery_reviews has no retailer link.
        hasRetailerFilter
          ? Promise.resolve([] as any[])
          : fetchAllRows<any>((f, t) =>
              supabase
                .from("delivery_reviews")
                .select("total_cash_collected")
                .range(f, t)
            , "cash rows"),

        // 9. Bank (online) payments — filter by distributor/retailer when set.
        fetchAllRows<any>((f, t) => {
          let q = supabase
            .from("orders")
            .select("total_amount")
            .not("easebuzz_txn_id", "is", null)
            .eq("payment_status", "completed")
          if (distributorFilter !== "all") q = q.eq("distributor_id", distributorFilter)
          if (hasRetailerFilter) q = q.eq("retailer_id", retailerFilter)
          return q.range(f, t)
        }, "bank rows"),

        // 10. Customer counts (head: true — no rows transferred)
        Promise.all([
          supabase
            .from("customers")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true),
          supabase
            .from("customers")
            .select("*", { count: "exact", head: true })
            .eq("is_vip", true),
          supabase
            .from("customers")
            .select("*", { count: "exact", head: true })
            .eq("is_defaulter", true),
        ]),

        // 11. Ticket counts
        Promise.all([
          supabase.from("support_tickets").select("*", { count: "exact", head: true }),
          supabase
            .from("support_tickets")
            .select("*", { count: "exact", head: true })
            .gte("created_at", todayRange.startIso)
            .lte("created_at", todayRange.endIso),
        ]),

        // 12. Network counts
        Promise.all([
          supabase
            .from("distributors")
            .select("*", { count: "exact", head: true })
            .is("parent_id", null),
          supabase.from("retailers").select("*", { count: "exact", head: true }),
          supabase.from("vendors").select("*", { count: "exact", head: true }),
        ]),

        // 13. AR — unpaid orders. Excludes cancelled/returned/refunded/failed
        // orders — no payment is actually owed on one of those regardless of
        // what payment_status happens to say.
        fetchAllRows<any>((f, t) =>
          supabase
            .from("orders")
            .select("id, total_amount, order_date, customer_id")
            .in("payment_status", ["pending", "partial", "processing"])
            .not("order_status", "in", "(cancelled,returned,refunded,failed)")
            .range(f, t)
        , "unpaid orders (AR)"),

        // 14. AP — unpaid purchases. Same exclusion as AR above — a
        // cancelled/returned purchase isn't actually money we still owe.
        fetchAllRows<any>((f, t) =>
          supabase
            .from("purchases")
            .select("id, total_amount, purchase_date, supplier_id, supplier_name")
            .in("payment_status", ["pending", "partial", "processing"])
            .not("purchase_status", "in", "(cancelled,returned)")
            .range(f, t)
        , "unpaid purchases (AP)"),

        // 15. FY orders for breakdown (skip when period === FY)
        reuseFY
          ? Promise.resolve(null)
          : fetchAllRows<any>((f, t) => {
              let q = supabase
                .from(ordersSource)
                .select(compactOrdersCols)
                .gte("order_date", fyStartIso)
                .lte("order_date", fyEndIso)
              if (distributorFilter !== "all") q = q.eq("serviceable_distributor_id", distributorFilter)
              if (hasRetailerFilter) q = q.eq("retailer_id", retailerFilter)
              return q.range(f, t)
            }, `FY orders (${ordersSource})`),

        // 16. FY purchases for breakdown (skip when period === FY)
        reuseFY
          ? Promise.resolve(null)
          : (async () => {
              const { data, error } = await supabase
                .from("purchases")
                .select("total_amount, purchase_date")
                .gte("purchase_date", fyStartIso)
                .lte("purchase_date", fyEndIso)
              if (error) throw error
              return data || []
            })(),
      ])

      // Derive today rows from period when today is in range
      const todayOrdersRows: any[] =
        todayOrdersRaw ??
        allPeriodOrders.filter((o: any) => {
          const t = new Date(o.order_date).getTime()
          return t >= todayStartMs
        })

      // Reuse period data for FY breakdown when applicable
      const fyOrders: any[] = (fyOrdersRaw as any[] | null) ?? allPeriodOrders
      const fyPurchaseRows: any[] = (fyPurchaseRaw as any[] | null) ?? purchData

      const stockItems = (stockResp as any).data || []
      const looseStockItems = (looseStockResp as any).data || []
      const [activeRes, vipRes, defaulterRes] = customerCounts
      const [ticketsRes, ticketsTodayRes] = ticketCounts
      const [distributorsRes, retailersRes, vendorsRes] = networkCounts

      // ---- PHASE 2: order_items for union of all order IDs (parallel batches) ----
      // Union ensures each order's items are fetched exactly once even when
      // they appear in both the period set and FY breakdown set.
      const orderIdSet = new Set<string>()
      allPeriodOrders.forEach((o: any) => orderIdSet.add(o.id))
      todayOrdersRows.forEach((o: any) => orderIdSet.add(o.id))
      fyOrders.forEach((o: any) => orderIdSet.add(o.id))
      const allItemOrderIds = Array.from(orderIdSet)

      const litresByOrder = new Map<string, number>()
      if (allItemOrderIds.length > 0) {
        const batchPromises: Promise<any[]>[] = []
        for (let i = 0; i < allItemOrderIds.length; i += 500) {
          const batch = allItemOrderIds.slice(i, i + 500)
          batchPromises.push(
            fetchAllRows<any>((f, t) =>
              supabase
                .from("order_items")
                .select("order_id, quantity, product_name")
                .in("order_id", batch)
                .range(f, t)
            )
          )
        }
        const batches = await Promise.all(batchPromises)
        for (const rows of batches) {
          for (const item of rows) {
            const qty = parseFloat(String(item.quantity)) || 0
            const litres = convertToLitres(item.product_name || "", qty)
            litresByOrder.set(
              item.order_id,
              (litresByOrder.get(item.order_id) || 0) + litres
            )
          }
        }
      }

      // ---- COMPUTE SUMMARY STATS ----
      const salesTotal = allPeriodOrders.reduce(
        (s: number, o: any) => s + (parseFloat(String(o.total_amount)) || 0),
        0
      )
      const salesToday = todayOrdersRows.reduce(
        (s: number, o: any) => s + (parseFloat(String(o.total_amount)) || 0),
        0
      )
      const gst = allPeriodOrders.reduce(
        (s: number, o: any) => s + (parseFloat(String(o.gst_amount)) || 0),
        0
      )
      // GST split (IGST / CGST / SGST). These mirror the GSTR-3B report's source columns.
      const cgst = allPeriodOrders.reduce(
        (s: number, o: any) => s + (parseFloat(String(o.cgst_amount)) || 0),
        0
      )
      const sgst = allPeriodOrders.reduce(
        (s: number, o: any) => s + (parseFloat(String(o.sgst_amount)) || 0),
        0
      )
      const igst = allPeriodOrders.reduce(
        (s: number, o: any) => s + (parseFloat(String(o.igst_amount)) || 0),
        0
      )
      const netRevenue = Math.max(0, salesTotal - gst)
      const ordersTotal = allPeriodOrders.length
      const ordersToday = todayOrdersRows.length
      // Retail (retailer bills) vs regular (phone/normal) split — factory request
      const ordersTodayRetail = todayOrdersRows.filter((o: any) => o.retailer_id).length
      const ordersTodayRegular = ordersToday - ordersTodayRetail

      let litresSoldTotal = 0
      for (const o of allPeriodOrders) {
        litresSoldTotal += litresByOrder.get(o.id) || 0
      }
      let litresSoldToday = 0
      for (const o of todayOrdersRows) {
        litresSoldToday += litresByOrder.get(o.id) || 0
      }

      const purchasesTotal = purchData.reduce(
        (s: number, p: any) => s + (parseFloat(String(p.total_amount)) || 0),
        0
      )
      const purchasesToday = todayPurchData.reduce(
        (s: number, p: any) => s + (parseFloat(String(p.total_amount)) || 0),
        0
      )
      const expenseTotal = expData.reduce(
        (s: number, e: any) => s + (parseFloat(String(e.amount)) || 0),
        0
      )
      // Split expenses by category. Uncategorized (null) rows only count toward the total.
      const expenseDirect = expData.reduce(
        (s: number, e: any) =>
          s + (String(e.expense_category).toLowerCase() === "direct" ? parseFloat(String(e.amount)) || 0 : 0),
        0
      )
      const expenseIndirect = expData.reduce(
        (s: number, e: any) =>
          s + (String(e.expense_category).toLowerCase() === "indirect" ? parseFloat(String(e.amount)) || 0 : 0),
        0
      )
      const income = netRevenue - purchasesTotal - expenseTotal
      const profitMargin = netRevenue > 0 ? (income / netRevenue) * 100 : 0

      let stockLitres = 0
      let stockAmount = 0
      for (const item of stockItems as any[]) {
        const qty = parseFloat(String(item.quantity)) || 0
        // godown_stock uses `unit_price`; stock_inventory uses `price`.
        const price =
          parseFloat(String(item.price ?? item.unit_price)) || 0
        stockAmount += qty * price
        // godown_stock nests product_variants/packaging_materials under
        // stock_inventory; stock_inventory exposes them at the top level.
        const variantName =
          item.product_variants?.variant_name ??
          item.stock_inventory?.product_variants?.variant_name ??
          ""
        const materialType =
          item.packaging_materials?.material_type ??
          item.stock_inventory?.packaging_materials?.material_type
        if (materialType !== "content") {
          stockLitres += convertStockVariantToLitres(variantName, qty)
        }
      }
      for (const item of looseStockItems as any[]) {
        const qty = parseFloat(String(item.quantity_liters)) || 0
        const price = parseFloat(String(item.price_per_liter)) || 0
        stockLitres += qty
        stockAmount += qty * price
      }

      const cashBalance = cashRows.reduce(
        (s: number, r: any) => s + (parseFloat(String(r.total_cash_collected)) || 0),
        0
      )
      const bankBalance = bankRows.reduce(
        (s: number, r: any) => s + (parseFloat(String(r.total_amount)) || 0),
        0
      )

      const nowForAging = Date.now()
      const MS_PER_DAY = 1000 * 60 * 60 * 24
      let billsReceivableTotal = 0
      let billsReceivableOverdue = 0
      const arCustomerIds = new Set<string>()
      for (const o of unpaidOrderRows as any[]) {
        const amt = parseFloat(String(o.total_amount)) || 0
        billsReceivableTotal += amt
        const daysOld = Math.floor(
          (nowForAging - new Date(o.order_date).getTime()) / MS_PER_DAY
        )
        if (daysOld > 15) billsReceivableOverdue += amt
        if (o.customer_id) arCustomerIds.add(o.customer_id)
      }

      let billsPayableTotal = 0
      let billsPayableOverdue = 0
      const apVendorKeys = new Set<string>()
      for (const p of unpaidPurchaseRows as any[]) {
        const amt = parseFloat(String(p.total_amount)) || 0
        billsPayableTotal += amt
        const daysOld = Math.floor(
          (nowForAging - new Date(p.purchase_date).getTime()) / MS_PER_DAY
        )
        if (daysOld > 15) billsPayableOverdue += amt
        const key = p.supplier_id || p.supplier_name
        if (key) apVendorKeys.add(key)
      }

      setStats({
        salesTotal,
        salesToday,
        purchaseTotal: purchasesTotal,
        purchaseToday: purchasesToday,
        stockLitres,
        stockAmount,
        cashBalance,
        bankBalance,
        billsReceivableTotal,
        billsReceivableOverdue,
        billsReceivableCount: arCustomerIds.size,
        billsPayableTotal,
        billsPayableOverdue,
        billsPayableCount: apVendorKeys.size,
        expense: expenseTotal,
        expenseDirect,
        expenseIndirect,
        gst,
        cgst,
        sgst,
        igst,
        income,
        profitMargin,
        activeCustomers: activeRes.count || 0,
        vipCustomers: vipRes.count || 0,
        defaulterCustomers: defaulterRes.count || 0,
        ordersTotal,
        ordersToday,
        ordersTodayRetail,
        ordersTodayRegular,
        litresSoldTotal,
        litresSoldToday,
        ticketsTotal: ticketsRes.count || 0,
        ticketsToday: ticketsTodayRes.count || 0,
        distributorsCount: distributorsRes.count || 0,
        retailersCount: retailersRes.count || 0,
        vendorsCount: vendorsRes.count || 0,
      })

      // ---- FY MONTHLY BREAKDOWN ----
      const fyMap = new Map<string, MonthlyPoint>()
      for (let i = 0; i < 12; i++) {
        const d = new Date(
          breakdownFY.start.getFullYear(),
          breakdownFY.start.getMonth() + i,
          1
        )
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        fyMap.set(key, {
          month: d.toLocaleString("en-US", { month: "short" }),
          key,
          orders: 0,
          sales: 0,
          purchases: 0,
          litres: 0,
        })
      }

      for (const o of fyOrders) {
        const d = new Date(o.order_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) {
          bucket.orders += 1
          bucket.sales += parseFloat(String(o.total_amount)) || 0
          bucket.litres += litresByOrder.get(o.id) || 0
        }
      }
      for (const p of fyPurchaseRows) {
        const d = new Date(p.purchase_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) bucket.purchases += parseFloat(String(p.total_amount)) || 0
      }

      const monthly = Array.from(fyMap.values())
      setMonthlyFY(monthly)
      setTrend(
        monthly.map((m) => ({
          month: m.month,
          orders: m.orders,
          litres: Math.round(m.litres),
        }))
      )

      setLoading(false)
    }

    load().catch((err) => {
      console.error("Dashboard V2 load error:", err)
      setLoadError(err?.message || String(err) || "Failed to load dashboard metrics")
      setLoading(false)
    })
  }, [datePreset, distributorFilter, retailerFilter, role, roleLoading, getDateRange, todayRange])

  // Indian-style integer grouping (e.g. 32,989 — never abbreviated).
  const inrFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
  const countFormatter = new Intl.NumberFormat("en-IN")
  const litresFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 })

  const formatINR = (amount: number) =>
    `₹${inrFormatter.format(Math.round(amount || 0))}`

  // Compact INR using the Indian Cr / Lakh / K scale so large figures fit inside
  // the dashboard tiles instead of overflowing/truncating. Used for the summary
  // tiles only — tables keep the full grouped value via formatINR.
  const formatINRCompact = (amount: number) => {
    const n = Math.round(amount || 0)
    const abs = Math.abs(n)
    const sign = n < 0 ? "-" : ""
    if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`
    if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`
    return `${sign}₹${inrFormatter.format(abs)}`
  }

  const formatLitres = (litres: number) =>
    `${litresFormatter.format(litres || 0)} L`

  const formatNumber = (n: number) => countFormatter.format(n || 0)

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Admin access only</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CRM Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-time overview of sales, stock, and network performance</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={distributorFilter} onValueChange={setDistributorFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <SelectValue placeholder="All Distributors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Distributors</SelectItem>
              {distributors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {distributorFilter !== "all" && (
            <Select value={retailerFilter} onValueChange={setRetailerFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder="All Retailers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Retailers</SelectItem>
                {retailers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={datePreset}
            onValueChange={(v) => setDatePreset(v as DatePreset)}
          >
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisFY">This FY (Apr–Mar)</SelectItem>
              <SelectItem value="lastFY">Last FY</SelectItem>
              <SelectItem value="allTime">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadError && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          Failed to load dashboard data: {loadError}
        </div>
      )}

      {/* Row 1 — Sales / Purchase / Stock / Cash & Bank */}
      <Section step="1" title="Financial Overview">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DualTileCard
          label="SALES"
          leftLabel="Total"
          leftValue={formatINRCompact(stats.salesTotal)}
          rightLabel="Today"
          rightValue={formatINRCompact(stats.salesToday)}
          rightHint="Current day"
          href="/dashboard/orders"
        />
        <DualTileCard
          label="PURCHASE"
          leftLabel="Total"
          leftValue={formatINRCompact(stats.purchaseTotal)}
          leftHint="This period"
          rightLabel="Today"
          rightValue={formatINRCompact(stats.purchaseToday)}
          rightHint="Current day"
          href="/dashboard/purchases"
        />
        <DualTileCard
          label="STOCK"
          leftLabel="Litres"
          leftValue={formatLitres(stats.stockLitres)}
          rightLabel="Amount"
          rightValue={formatINRCompact(stats.stockAmount)}
          href="/dashboard/warehouse-stock"
        />
        <DualTileCard
          label="CASH & BANK"
          leftLabel="Cash"
          leftValue={formatINRCompact(stats.cashBalance)}
          rightLabel="Bank"
          rightValue={formatINRCompact(stats.bankBalance)}
          href="/dashboard/accounting/reconciliation"
        />
      </div>
      </Section>

      {/* Row 1.5 — Bills Receivable (Debtors) / Bills Payable (Creditors) */}
      <Section step="2" title="Outstanding Bills">
      <div className="grid gap-4 md:grid-cols-2">
        <DualTileCard
          label="BILLS RECEIVABLE (DEBTORS)"
          leftLabel="Outstanding"
          leftValue={formatINRCompact(stats.billsReceivableTotal)}
          rightLabel="Overdue 15+"
          rightValue={formatINRCompact(stats.billsReceivableOverdue)}
          rightHint={`${stats.billsReceivableCount} customer${stats.billsReceivableCount === 1 ? "" : "s"}`}
        />
        <DualTileCard
          label="BILLS PAYABLE (CREDITORS)"
          leftLabel="Outstanding"
          leftValue={formatINRCompact(stats.billsPayableTotal)}
          rightLabel="Overdue 15+"
          rightValue={formatINRCompact(stats.billsPayableOverdue)}
          rightHint={`${stats.billsPayableCount} vendor${stats.billsPayableCount === 1 ? "" : "s"}`}
        />
      </div>
      </Section>

      {/* Row 2 — Expense (direct/indirect) / GST split / Income / Profit Margin */}
      <Section step="3" title="Profitability">
      <div className="grid gap-4 md:grid-cols-2">
        <MultiTileCard
          label="EXPENSE"
          tiles={[
            { label: "Direct", value: formatINRCompact(stats.expenseDirect) },
            { label: "Indirect", value: formatINRCompact(stats.expenseIndirect) },
            { label: "Total", value: formatINRCompact(stats.expense), color: "text-rose-600 dark:text-rose-400" },
          ]}
        />
        <MultiTileCard
          label="GST"
          tiles={[
            { label: "IGST", value: formatINRCompact(stats.igst) },
            { label: "CGST", value: formatINRCompact(stats.cgst) },
            { label: "SGST", value: formatINRCompact(stats.sgst) },
            { label: "Total GST", value: formatINRCompact(stats.gst), color: "text-foreground" },
          ]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <PlainStat
          label="INCOME"
          value={formatINRCompact(stats.income)}
          hint="Net income"
          valueClass={stats.income < 0 ? "text-red-600" : ""}
        />
        <PlainStat
          label="PROFIT MARGIN"
          value={`${stats.profitMargin.toFixed(1)}%`}
          hint="Income ÷ revenue ex-GST"
          valueClass={stats.profitMargin < 0 ? "text-red-600" : ""}
        />
      </div>
      </Section>

      {/* Row 3 — Customers / Orders / Litres Sold / Support Tickets */}
      <Section step="4" title="Operations">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TripleTileCard
          label="CUSTOMERS"
          tiles={[
            {
              label: "Active",
              value: formatNumber(stats.activeCustomers),
              color: "text-emerald-600",
            },
            {
              label: "Sd",
              value: formatNumber(stats.vipCustomers),
              color: "text-amber-600",
            },
            {
              label: "Defaulter",
              value: formatNumber(stats.defaulterCustomers),
              color: "text-red-600",
            },
          ]}
        />
        <TripleTileCard
          label="ORDERS"
          tiles={[
            {
              label: "Total",
              value: formatNumber(stats.ordersTotal),
              color: "",
            },
            {
              label: "Today · Retail",
              value: formatNumber(stats.ordersTodayRetail),
              color: "text-blue-600",
            },
            {
              label: "Today · Regular",
              value: formatNumber(stats.ordersTodayRegular),
              color: "text-emerald-600",
            },
          ]}
        />
        <DualTileCard
          label="LITRES SOLD"
          leftLabel="Total"
          leftValue={formatLitres(stats.litresSoldTotal)}
          rightLabel="Today"
          rightValue={formatLitres(stats.litresSoldToday)}
        />
        <DualTileCard
          label="SUPPORT TICKETS"
          leftLabel="Total"
          leftValue={formatNumber(stats.ticketsTotal)}
          rightLabel="Today"
          rightValue={formatNumber(stats.ticketsToday)}
        />
      </div>
      </Section>

      {/* Row 4 — Network */}
      <Section step="5" title="Network" tone="purple">
      <div className="grid gap-4 md:grid-cols-3">
        <NetworkCard
          label="TOTAL DISTRIBUTORS"
          value={stats.distributorsCount}
          badgeColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        <NetworkCard
          label="TOTAL RETAILERS"
          value={stats.retailersCount}
          badgeColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        <NetworkCard
          label="TOTAL VENDORS"
          value={stats.vendorsCount}
          badgeColor="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        />
      </div>
      </Section>

      {/* Trend chart — monthly trend across the fiscal year */}
      <Card className="rounded-lg border-muted/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 ring-1 ring-inset ring-border">
                <TrendingUp className="size-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-base">Orders vs litres sold</CardTitle>
                <CardDescription className="mt-0.5">
                  Monthly trend {monthlyFYLabel && <span>· {monthlyFYLabel}</span>}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4 md:gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/20" />
                <div>
                  <div className="text-muted-foreground">Orders</div>
                  <div className="font-semibold tabular-nums">
                    {trend.reduce((s, t) => s + t.orders, 0).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                <div>
                  <div className="text-muted-foreground">Litres</div>
                  <div className="font-semibold tabular-nums">
                    {formatLitres(trend.reduce((s, t) => s + t.litres, 0))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={trend}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="ordersStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="litresStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted-foreground/20" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "currentColor", className: "text-border" }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}KL` : `${v}L`
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="url(#ordersStroke)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="litres"
                  name="Litres"
                  stroke="url(#litresStroke)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Loading chart data…" : "No data available"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Monthly breakdown — annual report per FY month */}
      <Card className="rounded-lg border-muted/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-inset ring-amber-200 dark:ring-amber-800/40">
                <Receipt className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Monthly breakdown</CardTitle>
                <CardDescription className="mt-0.5">
                  Per-month report {monthlyFYLabel && <span>· {monthlyFYLabel}</span>}
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full self-start">
              {monthlyFY.filter((m) => m.orders > 0).length} active months
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {monthlyFY.length > 0 ? (
            (() => {
              const totals = monthlyFY.reduce(
                (acc, m) => ({
                  orders: acc.orders + m.orders,
                  sales: acc.sales + m.sales,
                  purchases: acc.purchases + m.purchases,
                  litres: acc.litres + m.litres,
                }),
                { orders: 0, sales: 0, purchases: 0, litres: 0 }
              )
              const peakSales = Math.max(...monthlyFY.map((m) => m.sales))
              return (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Month</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Orders</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Sales</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Purchases</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Litres</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyFY.map((m) => {
                      const isPeak = m.sales > 0 && m.sales === peakSales
                      return (
                        <TableRow key={m.key} className="group">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 items-center justify-center rounded-md bg-muted/60 text-[11px] font-semibold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {m.month.slice(0, 1)}
                              </div>
                              <div>
                                <div>{m.month}</div>
                                {isPeak && (
                                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                                    Peak month
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.orders.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatINR(m.sales)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatINR(m.purchases)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <div className="inline-flex items-center gap-1.5">
                              <Droplet className="size-3 text-cyan-500" />
                              {formatLitres(m.litres)}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/60 hover:bg-muted/60 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.orders.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(totals.sales)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(totals.purchases)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatLitres(totals.litres)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )
            })()
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Loading monthly data…" : "No data available"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ----- Reusable sub-components -----

function Section({
  step,
  title,
  tone = "blue",
  children,
}: {
  step: string
  title: string
  tone?: "blue" | "green" | "purple"
  children: React.ReactNode
}) {
  const stepClass =
    tone === "green"
      ? "bg-emerald-600 text-white"
      : tone === "purple"
        ? "bg-violet-600 text-white"
        : "bg-blue-600 text-white"
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${stepClass}`}
        >
          {step}
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </section>
  )
}

function DualTileCard({
  label,
  leftLabel,
  leftValue,
  leftHint,
  leftValueClass,
  rightLabel,
  rightValue,
  rightHint,
  rightValueClass,
  href,
}: {
  label: string
  leftLabel: string
  leftValue: string
  leftHint?: string
  leftValueClass?: string
  rightLabel: string
  rightValue: string
  rightHint?: string
  rightValueClass?: string
  href?: string
}) {
  const router = useRouter()
  return (
    <Card
      onClick={href ? () => router.push(href) : undefined}
      className={`rounded-xl overflow-hidden gap-0 py-0 ${href ? "cursor-pointer" : ""}`}
    >
      <CardHeader className="border-b py-2 px-3">
        <CardTitle className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-0 p-0">
        <div className="px-3 py-2.5 border-r min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 truncate">
            {leftLabel}
          </div>
          <div className={`text-base font-bold mt-0.5 tabular-nums ${leftValueClass || ""}`}>
            {leftValue}
          </div>
          {leftHint && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{leftHint}</div>
          )}
        </div>
        <div className="px-3 py-2.5 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 truncate">
            {rightLabel}
          </div>
          <div className={`text-base font-bold mt-0.5 tabular-nums ${rightValueClass || ""}`}>
            {rightValue}
          </div>
          {rightHint && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{rightHint}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function getIconForLabel(label: string) {
  const l = label.toLowerCase()
  if (l.includes("sales")) return IndianRupee
  if (l.includes("purchase")) return ShoppingCart
  if (l.includes("stock")) return Package
  if (l.includes("cash")) return Wallet
  if (l.includes("receivable")) return ArrowDownToLine
  if (l.includes("payable")) return ArrowUpFromLine
  if (l.includes("orders")) return Receipt
  if (l.includes("litres")) return Droplet
  if (l.includes("support")) return LifeBuoy
  if (l.includes("customer")) return Users
  return TrendingUp
}

const ACCENTS: Record<string, { bg: string; fg: string; ring: string; bar: string; softBg: string }> = {
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    fg: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200 dark:ring-emerald-800/40",
    bar: "bg-gradient-to-r from-emerald-400 to-emerald-600",
    softBg: "bg-emerald-50/40 dark:bg-emerald-950/10",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    fg: "text-blue-700 dark:text-blue-300",
    ring: "ring-blue-200 dark:ring-blue-800/40",
    bar: "bg-gradient-to-r from-blue-400 to-blue-600",
    softBg: "bg-blue-50/40 dark:bg-blue-950/10",
  },
  violet: {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    fg: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-200 dark:ring-violet-800/40",
    bar: "bg-gradient-to-r from-violet-400 to-violet-600",
    softBg: "bg-violet-50/40 dark:bg-violet-950/10",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    fg: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200 dark:ring-amber-800/40",
    bar: "bg-gradient-to-r from-amber-400 to-amber-600",
    softBg: "bg-amber-50/40 dark:bg-amber-950/10",
  },
  rose: {
    bg: "bg-rose-100 dark:bg-rose-900/30",
    fg: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200 dark:ring-rose-800/40",
    bar: "bg-gradient-to-r from-rose-400 to-rose-600",
    softBg: "bg-rose-50/40 dark:bg-rose-950/10",
  },
  indigo: {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    fg: "text-indigo-700 dark:text-indigo-300",
    ring: "ring-indigo-200 dark:ring-indigo-800/40",
    bar: "bg-gradient-to-r from-indigo-400 to-indigo-600",
    softBg: "bg-indigo-50/40 dark:bg-indigo-950/10",
  },
  cyan: {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    fg: "text-cyan-700 dark:text-cyan-300",
    ring: "ring-cyan-200 dark:ring-cyan-800/40",
    bar: "bg-gradient-to-r from-cyan-400 to-cyan-600",
    softBg: "bg-cyan-50/40 dark:bg-cyan-950/10",
  },
  pink: {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    fg: "text-pink-700 dark:text-pink-300",
    ring: "ring-pink-200 dark:ring-pink-800/40",
    bar: "bg-gradient-to-r from-pink-400 to-pink-600",
    softBg: "bg-pink-50/40 dark:bg-pink-950/10",
  },
}

function getAccentForLabel(label: string) {
  const l = label.toLowerCase()
  if (l.includes("sales")) return ACCENTS.emerald
  if (l.includes("purchase")) return ACCENTS.blue
  if (l.includes("stock")) return ACCENTS.violet
  if (l.includes("cash")) return ACCENTS.amber
  if (l.includes("receivable")) return ACCENTS.emerald
  if (l.includes("payable")) return ACCENTS.rose
  if (l.includes("orders")) return ACCENTS.indigo
  if (l.includes("litres")) return ACCENTS.cyan
  if (l.includes("support")) return ACCENTS.pink
  return { bg: "bg-muted", fg: "text-muted-foreground", ring: "ring-border", bar: "bg-muted-foreground/30", softBg: "bg-muted/30" }
}

function TripleTileCard({
  label,
  tiles,
}: {
  label: string
  tiles: { label: string; value: string; color?: string }[]
}) {
  return (
    <Card className="rounded-xl overflow-hidden gap-0 py-0">
      <CardHeader className="border-b py-2 px-3">
        <CardTitle className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-0 p-0">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className={`px-3 py-2.5 min-w-0 ${i < tiles.length - 1 ? "border-r" : ""}`}
          >
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 truncate">{t.label}</div>
            <div className={`text-base font-bold mt-0.5 tabular-nums ${t.color || ""}`}>
              {t.value}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Card with an arbitrary number of value tiles laid out in equal columns.
// Used for the Expense (Direct/Indirect/Total) and GST (IGST/CGST/SGST/Total)
// breakdowns where the tile count varies.
function MultiTileCard({
  label,
  tiles,
}: {
  label: string
  tiles: { label: string; value: string; color?: string }[]
}) {
  return (
    <Card className="rounded-xl overflow-hidden gap-0 py-0">
      <CardHeader className="border-b py-2 px-3">
        <CardTitle className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent
        className="grid gap-0 p-0"
        style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
      >
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className={`px-3 py-2.5 min-w-0 ${i < tiles.length - 1 ? "border-r" : ""}`}
          >
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 truncate">
              {t.label}
            </div>
            <div className={`text-base font-bold mt-0.5 tabular-nums ${t.color || ""}`}>
              {t.value}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PlainStat({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string
  value: string
  hint?: string
  valueClass?: string
}) {
  return (
    <Card className="rounded-xl overflow-hidden gap-0 py-0">
      <CardHeader className="border-b py-2 px-3">
        <CardTitle className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-2.5">
        <div className={`text-base font-bold tabular-nums ${valueClass || ""}`}>
          {value}
        </div>
        {hint && (
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</div>
        )}
      </CardContent>
    </Card>
  )
}

function NetworkCard({
  label,
  value,
  badgeColor,
}: {
  label: string
  value: number
  badgeColor: string
}) {
  return (
    <Card className="rounded-xl overflow-hidden gap-0 py-0">
      <CardHeader className="border-b py-2 px-3">
        <CardTitle className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-2.5">
        <div className="text-base font-bold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Active network</div>
      </CardContent>
    </Card>
  )
}
