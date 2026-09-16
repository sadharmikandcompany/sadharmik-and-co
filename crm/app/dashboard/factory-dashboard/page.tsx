"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUserRole } from "@/hooks/use-user-role"
import { isOldGstConvention, splitItemGst } from "@/lib/purchase-item-gst"

type DatePreset = "today" | "thisWeek" | "thisMonth" | "lastMonth" | "thisFY" | "lastFY" | "allTime"

interface MonthlyPoint {
  month: string
  key: string
  kpOrders: number
  // KP sales, net of credit notes raised for customers that month (sales
  // returns) — mirrors the period-level Net Sales math (see
  // stats.salesReturnsAmount).
  kpSales: number
  salesReturns: number
  // Litres sold, net of litres returned via credit note that month — same
  // reasoning as kpSales above, applied to quantity instead of ₹.
  kpLitres: number
  salesReturnLitres: number
  // Output GST on KP sales for the month.
  gst: number
  // Purchase, net of debit notes raised against vendors that month (purchase
  // returns) — mirrors the period-level Net Purchase math (see
  // stats.purchaseReturnsAmount).
  purchases: number
  purchaseReturns: number
  // Litres purchased (bottle purchase_items + loose-stock litres).
  purchaseLitres: number
  // Total expense for the month (direct + indirect).
  expense: number
  // Net profit = KP sales − purchase − expense.
  netProfit: number
  // Stock (litres) at month start/end — running balance seeded from the
  // declared manufacturing opening stock, +purchase litres −KP sale litres.
  openingLitres: number
  closingLitres: number
  // Stock (₹) at month start/end — openingLitres/closingLitres valued at
  // the average rate of the declared opening stock (openingStockAmount /
  // openingStockQty). An approximation, not true month-by-month costing —
  // there's no batch-level cost history to value stock precisely at each
  // month boundary, so this holds the rate constant across the year.
  openingStockAmount: number
  closingStockAmount: number
  // Input GST (ITC) on that month's material purchases — mirrors `gst`
  // (output GST) above so "GST (Input − Output)" can be shown per month.
  inputGst: number
}

interface StatusBucket {
  status: string
  count: number
  amount: number
}

interface TopDistributor {
  id: string | null
  name: string
  orders: number
  amount: number
}

interface TopVendor {
  id: string | null
  name: string
  purchases: number
  amount: number
}

interface RecentRow {
  id: string
  number: string
  date: string
  amount: number
  status: string
  payment_status: string
}

// Factory dashboard is gated to invoices issued from this fiscal year onwards,
// matching the rule used in /dashboard/orders-v2 (KP prefix + on/after Apr 2026).
const FACTORY_EPOCH = "2026-04-01"

// Indian Fiscal Year runs April 1 → March 31. offset 0 = current FY, -1 = previous.
function getFiscalYearRange(offset: number = 0) {
  const now = new Date()
  const currentFYStartYear =
    now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const startYear = currentFYStartYear + offset
  const start = new Date(startYear, 3, 1, 0, 0, 0, 0)
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59, 999)
  return {
    start,
    end,
    label: `FY ${startYear}-${String(startYear + 1).slice(-2)}`,
  }
}

// Builds the ?from=&to= query string for a monthly-summary row's "key"
// (YYYY-MM), so table cells can deep-link into the relevant list page
// pre-filtered to that month.
function monthDateParams(key: string) {
  const [y, m] = key.split("-").map(Number)
  const from = new Date(y, m - 1, 1, 0, 0, 0, 0)
  const to = new Date(y, m, 0, 23, 59, 59, 999)
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
}

// Orders V2 is URL-filter-driven with its own param names (dateFrom/dateTo
// as plain yyyy-MM-dd, search instead of q) — see orders-v2/page.tsx.
function monthOrdersV2Params(key: string) {
  const [y, m] = key.split("-").map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const dateFrom = `${y}-${String(m).padStart(2, "0")}-01`
  const dateTo = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return `dateFrom=${dateFrom}&dateTo=${dateTo}&search=KP`
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#6366f1",
  processing: "#3b82f6",
  packed: "#8b5cf6",
  shipped: "#06b6d4",
  delivered: "#10b981",
  cancelled: "#ef4444",
  partial: "#f97316",
  paid: "#10b981",
  received: "#10b981",
  completed: "#10b981",
  unknown: "#9ca3af",
}

// Indian-style integer grouping (1,23,45,678).
const inrFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
})
// Always render litres with two decimals so 0.5 L doesn't appear as "1 L"
// rounding artefacts. Suffix uses "Ltr" instead of "L" to avoid colliding
// visually with the Indian "L" (lakh) abbreviation we deliberately removed
// from currency values.
const litreFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const countFormatter = new Intl.NumberFormat("en-IN")

const formatINR = (amount: number) => `₹${inrFormatter.format(Math.round(amount || 0))}`
// Compact INR on the Indian Cr / Lakh / K scale so large figures fit inside the
// narrow overview tiles instead of overflowing. Tables/P&L keep full formatINR.
const formatINRCompact = (amount: number) => {
  const n = Math.round(amount || 0)
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`
  return `${sign}₹${inrFormatter.format(abs)}`
}
const formatLitres = (litres: number) => `${litreFormatter.format(litres || 0)} Ltr`
const formatNumber = (n: number) => countFormatter.format(n || 0)
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })

export default function FactoryDashboardPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()

  const [datePreset, setDatePreset] = useState<DatePreset>("thisFY")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [stats, setStats] = useState({
    kpOrdersTotal: 0,
    kpOrdersToday: 0,
    kpSalesTotal: 0,
    kpSalesToday: 0,
    kpGstTotal: 0,
    kpGstToday: 0,
    kpLitresTotal: 0,
    kpLitresToday: 0,
    kpAvgOrderValue: 0,
    kpDistributorsServed: 0,
    // GST split (output tax on KP invoices) — powers the Profitability › GST card.
    kpCgst: 0,
    kpSgst: 0,
    kpIgst: 0,
    // Input GST (ITC available from the factory's own ITC-eligible purchases)
    // and the resulting net payable after set-off — same math as
    // /dashboard/reports/gst-payable's factory view, same period.
    kpItcTotal: 0,
    kpGstPayable: 0,
    // Current stock on hand (finished goods + loose) — Financial Overview › Stock.
    stockLitres: 0,
    stockAmount: 0,
    // Bills receivable — unpaid KP invoices distributors owe the factory.
    arOutstanding: 0,
    arOverdue: 0,
    arCustomerCount: 0,
    // Distinct vendors supplying the factory in-period — Network › Vendors.
    vendorCount: 0,
    myPurchaseTotal: 0,
    myPurchaseToday: 0,
    myPurchaseCount: 0,
    myPurchasePending: 0,
    myPurchaseReceived: 0,
    apOutstanding: 0,
    apOverdue: 0,
    apVendorCount: 0,
    looseLitres: 0,
    looseAmount: 0,
    // Opening stock — manufacturing entries dated on/before the FY start.
    openingStockAmount: 0,
    openingStockQty: 0,
    // Purchase returns — debit notes raised against vendors in the period.
    purchaseReturnsAmount: 0,
    purchaseReturnsCount: 0,
    // Sales returns — credit notes raised for customers in the period.
    salesReturnsAmount: 0,
    salesReturnsCount: 0,
    // Direct expenses — production-linked (wages, daily ops) within the period.
    directExpensesAmount: 0,
    // Indirect expenses — everything else (loan, other) within the period.
    indirectExpensesAmount: 0,
  })

  const [orderStatusBreakdown, setOrderStatusBreakdown] = useState<StatusBucket[]>([])
  const [paymentStatusBreakdown, setPaymentStatusBreakdown] = useState<StatusBucket[]>([])
  const [purchaseStatusBreakdown, setPurchaseStatusBreakdown] = useState<StatusBucket[]>([])
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([])
  const [monthlyFYLabel, setMonthlyFYLabel] = useState<string>("")
  const [topDistributors, setTopDistributors] = useState<TopDistributor[]>([])
  const [topVendors, setTopVendors] = useState<TopVendor[]>([])
  const [recentOrders, setRecentOrders] = useState<RecentRow[]>([])
  const [recentPurchases, setRecentPurchases] = useState<RecentRow[]>([])
  // Litres dispatched grouped by product (period). Powers the new
  // "Top products by litres" horizontal bar chart.
  const [litresByProduct, setLitresByProduct] = useState<
    { product: string; litres: number }[]
  >([])

  // Factory and admin access. Send other roles back to their default dashboard.
  useEffect(() => {
    if (!roleLoading && role && role !== "factories" && role !== "admin") {
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
          const diff = day === 0 ? 6 : day - 1
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
          return { from: new Date(FACTORY_EPOCH), to: endOfToday }
      }
    },
    []
  )

  // Variant string → litres. Product names look like
  // "... - 500 ML" or "... - 1 LTR". The earlier regex used `\bl\b` which never
  // matched "ltr" (the `l` is followed by `t`, no word boundary), so every
  // bottle/tin/pouch in litres was silently dropped. Accept both spellings.
  const variantToLitres = (variantName: string, qty: number): number => {
    if (!variantName) return 0
    const v = variantName.toLowerCase()
    const mlMatch = v.match(/(\d+(?:\.\d+)?)\s*ml\b/)
    if (mlMatch) return (parseFloat(mlMatch[1]) / 1000) * qty
    const lMatch = v.match(/(\d+(?:\.\d+)?)\s*(?:ltr|l)\b/)
    if (lMatch) return parseFloat(lMatch[1]) * qty
    return 0
  }

  // Finished-goods variant string → litres for the current-stock tile. Mirrors
  // /dashboard/dashboard-v2 :: convertStockVariantToLitres (handles ml / l / ltr,
  // and a bare m|r suffix which means millilitres in this dataset).
  const stockVariantToLitres = (variantName: string, qty: number): number => {
    if (!variantName) return 0
    const v = variantName.toLowerCase()
    const mlMatch = v.match(/(\d+(?:\.\d+)?)\s*ml\b/)
    if (mlMatch) return (parseFloat(mlMatch[1]) / 1000) * qty
    const lMatch = v.match(/(\d+(?:\.\d+)?)\s*l(?:t|tr|iter|itre|iters|itres)?\b/)
    if (lMatch) return parseFloat(lMatch[1]) * qty
    const mrMatch = v.match(/(\d+(?:\.\d+)?)\s*[mr]\b/)
    if (mrMatch) return (parseFloat(mrMatch[1]) / 1000) * qty
    const numeric = parseFloat(v)
    return isNaN(numeric) ? 0 : (numeric / 1000) * qty
  }

  const todayRange = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return { startIso: start.toISOString(), endIso: end.toISOString() }
  }, [])

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
        console.error(`[Factory Dashboard] ${label || "fetch"} failed:`, error)
        throw error
      }
      if (!data) break
      result.push(...data)
      if (data.length < pageSize) break
      page++
    }
    return result
  }

  useEffect(() => {
    if (roleLoading || (role !== "factories" && role !== "admin")) return

    const load = async () => {
      setLoading(true)
      setLoadError(null)

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setLoadError("Not signed in")
        setLoading(false)
        return
      }

      const { from, to } = getDateRange(datePreset)
      const epoch = new Date(FACTORY_EPOCH)
      const effectiveFrom = from && from > epoch ? from : epoch
      const fromIso = effectiveFrom.toISOString()
      const toIso = to.toISOString()

      // ===== KP-PREFIXED ORDERS (factory-issued invoices) =====
      // Same filter as /dashboard/orders-v2 for the factories role.
      const kpOrders = await fetchAllRows<any>((f, t) =>
        supabase
          .from("orders_v")
          .select(
            "id, order_number, invoice_number_gst, invoice_number_non_gst, total_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, order_date, order_status, payment_status, distributor_id, customer_name, retailer_id"
          )
          .or(
            "order_number.ilike.KP%,invoice_number_gst.ilike.KP%,invoice_number_non_gst.ilike.KP%"
          )
          .gte("order_date", fromIso)
          .lte("order_date", toIso)
          .range(f, t),
        "KP orders (period)"
      )

      const kpOrdersToday = await fetchAllRows<any>((f, t) =>
        supabase
          .from("orders_v")
          .select("id, total_amount, gst_amount, order_date, order_status")
          .or(
            "order_number.ilike.KP%,invoice_number_gst.ilike.KP%,invoice_number_non_gst.ilike.KP%"
          )
          .gte("order_date", todayRange.startIso)
          .lte("order_date", todayRange.endIso)
          .range(f, t),
        "KP orders (today)"
      )

      // Cancelled orders carry no actual sales/tax liability — excluded from
      // every financial figure below, but kpOrders itself stays unfiltered so
      // the order-status breakdown further down can still show them for
      // visibility (e.g. "1 cancelled, ₹242,410").
      const isCancelled = (o: any) => (o.order_status || "").toLowerCase() === "cancelled"
      const kpOrdersActive = kpOrders.filter((o) => !isCancelled(o))
      const kpOrdersTodayActive = kpOrdersToday.filter((o) => !isCancelled(o))

      const kpSalesTotal = kpOrdersActive.reduce(
        (s, o) => s + (parseFloat(String(o.total_amount)) || 0),
        0
      )
      const kpSalesToday = kpOrdersTodayActive.reduce(
        (s, o) => s + (parseFloat(String(o.total_amount)) || 0),
        0
      )
      const kpGstTotal = kpOrdersActive.reduce(
        (s, o) => s + (parseFloat(String(o.gst_amount)) || 0),
        0
      )
      const kpGstToday = kpOrdersTodayActive.reduce(
        (s, o) => s + (parseFloat(String(o.gst_amount)) || 0),
        0
      )
      // GST split (IGST / CGST / SGST) across the period's KP invoices. Mirrors
      // the GST breakdown shown on /dashboard/dashboard-v2.
      const kpCgst = kpOrdersActive.reduce(
        (s, o) => s + (parseFloat(String(o.cgst_amount)) || 0),
        0
      )
      const kpSgst = kpOrdersActive.reduce(
        (s, o) => s + (parseFloat(String(o.sgst_amount)) || 0),
        0
      )
      const kpIgst = kpOrdersActive.reduce(
        (s, o) => s + (parseFloat(String(o.igst_amount)) || 0),
        0
      )

      // ===== INPUT GST (ITC available) — factory's own ITC-eligible purchases
      // in the same period, same scope as /dashboard/reports/gst-payable's
      // "factory" view (distributor purchases have their own separate ITC). =====
      const itcItems = await fetchAllRows<any>((f, t) =>
        supabase
          .from("purchase_items")
          .select("cgst_amount, sgst_amount, igst_amount, is_itc_eligible, purchases!inner(purchase_date, distributor_id)")
          .gte("purchases.purchase_date", fromIso)
          .lte("purchases.purchase_date", toIso)
          .is("purchases.distributor_id", null)
          .range(f, t),
        "ITC purchase items (period)"
      )

      let kpItcIgst = 0
      let kpItcCgst = 0
      let kpItcSgst = 0
      itcItems.forEach((item: any) => {
        if (item.is_itc_eligible === false) return
        kpItcCgst += parseFloat(String(item.cgst_amount)) || 0
        kpItcSgst += parseFloat(String(item.sgst_amount)) || 0
        kpItcIgst += parseFloat(String(item.igst_amount)) || 0
      })

      // Loose (litre-based) purchases carry their own GST — they never get a
      // purchase_items row, so their ITC is summed separately here (all of
      // them, not just purchase_id-null ones — unlike the Total Purchase
      // figure above, GST is never duplicated in purchase_items for these).
      const itcLooseItems = await fetchAllRows<any>((f, t) =>
        supabase
          .from("loose_stock_transactions")
          .select("cgst_amount, sgst_amount, igst_amount, is_itc_eligible, transaction_date")
          .eq("transaction_type", "purchase")
          .gte("transaction_date", fromIso)
          .lte("transaction_date", toIso)
          .range(f, t),
        "ITC loose-stock transactions (period)"
      )
      itcLooseItems.forEach((txn: any) => {
        if (txn.is_itc_eligible === false) return
        kpItcCgst += parseFloat(String(txn.cgst_amount)) || 0
        kpItcSgst += parseFloat(String(txn.sgst_amount)) || 0
        kpItcIgst += parseFloat(String(txn.igst_amount)) || 0
      })

      const kpItcTotal = kpItcIgst + kpItcCgst + kpItcSgst

      // GST set-off ordering: IGST credit -> IGST, CGST, SGST (in that order);
      // CGST credit -> CGST then IGST only; SGST credit -> SGST then IGST only.
      // Identical rule to reports/gst-payable so the two pages agree.
      const gstAfterSetOff = (() => {
        const remaining = { igst: kpIgst, cgst: kpCgst, sgst: kpSgst }
        let igstCredit = kpItcIgst
        let cgstCredit = kpItcCgst
        let sgstCredit = kpItcSgst

        const useIgstOnIgst = Math.min(igstCredit, remaining.igst)
        remaining.igst -= useIgstOnIgst
        igstCredit -= useIgstOnIgst
        const useIgstOnCgst = Math.min(igstCredit, remaining.cgst)
        remaining.cgst -= useIgstOnCgst
        igstCredit -= useIgstOnCgst
        const useIgstOnSgst = Math.min(igstCredit, remaining.sgst)
        remaining.sgst -= useIgstOnSgst

        const useCgstOnCgst = Math.min(cgstCredit, remaining.cgst)
        remaining.cgst -= useCgstOnCgst
        cgstCredit -= useCgstOnCgst
        const useCgstOnIgst = Math.min(cgstCredit, remaining.igst)
        remaining.igst -= useCgstOnIgst

        const useSgstOnSgst = Math.min(sgstCredit, remaining.sgst)
        remaining.sgst -= useSgstOnSgst
        sgstCredit -= useSgstOnSgst
        const useSgstOnIgst = Math.min(sgstCredit, remaining.igst)
        remaining.igst -= useSgstOnIgst

        return remaining
      })()
      const kpGstPayable = Math.max(0, gstAfterSetOff.igst + gstAfterSetOff.cgst + gstAfterSetOff.sgst)

      const orderStatusMap = new Map<string, { count: number; amount: number }>()
      const paymentStatusMap = new Map<string, { count: number; amount: number }>()
      const distributorMap = new Map<string, { orders: number; amount: number }>()
      kpOrders.forEach((o) => {
        const s = (o.order_status || "unknown").toLowerCase()
        const p = (o.payment_status || "unknown").toLowerCase()
        const amt = parseFloat(String(o.total_amount)) || 0
        const os = orderStatusMap.get(s) || { count: 0, amount: 0 }
        os.count += 1
        os.amount += amt
        orderStatusMap.set(s, os)
        const ps = paymentStatusMap.get(p) || { count: 0, amount: 0 }
        ps.count += 1
        ps.amount += amt
        paymentStatusMap.set(p, ps)
        if (o.distributor_id) {
          const d = distributorMap.get(o.distributor_id) || { orders: 0, amount: 0 }
          d.orders += 1
          d.amount += amt
          distributorMap.set(o.distributor_id, d)
        }
      })

      const orderStatusList: StatusBucket[] = Array.from(orderStatusMap.entries())
        .map(([status, v]) => ({ status, count: v.count, amount: v.amount }))
        .sort((a, b) => b.count - a.count)
      const paymentStatusList: StatusBucket[] = Array.from(paymentStatusMap.entries())
        .map(([status, v]) => ({ status, count: v.count, amount: v.amount }))
        .sort((a, b) => b.amount - a.amount)
      setOrderStatusBreakdown(orderStatusList)
      setPaymentStatusBreakdown(paymentStatusList)

      const topDistIds = Array.from(distributorMap.entries())
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 5)
        .map(([id]) => id)
      const distNameMap = new Map<string, string>()
      if (topDistIds.length) {
        const { data: distRows } = await supabase
          .from("distributors")
          .select("id, name")
          .in("id", topDistIds)
        ;(distRows || []).forEach((d: any) => distNameMap.set(d.id, d.name))
      }
      setTopDistributors(
        topDistIds.map((id) => ({
          id,
          name: distNameMap.get(id) || "Unknown",
          orders: distributorMap.get(id)!.orders,
          amount: distributorMap.get(id)!.amount,
        }))
      )

      let kpLitresTotal = 0
      let kpLitresToday = 0
      const fetchItemsForOrders = async (orderIds: string[]) => {
        const items: any[] = []
        for (let i = 0; i < orderIds.length; i += 500) {
          const batch = orderIds.slice(i, i + 500)
          const rows = await fetchAllRows<any>((f, t) =>
            supabase
              .from("order_items")
              .select("order_id, quantity, product_name")
              .in("order_id", batch)
              .range(f, t)
          )
          items.push(...rows)
        }
        return items
      }
      if (kpOrdersActive.length) {
        const items = await fetchItemsForOrders(kpOrdersActive.map((o) => o.id))
        const byProduct = new Map<string, number>()
        items.forEach((it) => {
          const qty = parseFloat(String(it.quantity)) || 0
          const litres = variantToLitres(it.product_name || "", qty)
          kpLitresTotal += litres
          if (litres > 0 && it.product_name) {
            byProduct.set(it.product_name, (byProduct.get(it.product_name) || 0) + litres)
          }
        })
        // Trim "Sadharmik & Company " brand prefix for chart legibility.
        const cleaned = Array.from(byProduct.entries()).map(([name, litres]) => ({
          product: name.replace(/^Sadharmik & Company\s+/i, ""),
          litres,
        }))
        cleaned.sort((a, b) => b.litres - a.litres)
        setLitresByProduct(cleaned.slice(0, 8))
      } else {
        setLitresByProduct([])
      }
      if (kpOrdersTodayActive.length) {
        const todayItems = await fetchItemsForOrders(kpOrdersTodayActive.map((o) => o.id))
        kpLitresToday = todayItems.reduce(
          (sum, it) =>
            sum + variantToLitres(it.product_name || "", parseFloat(String(it.quantity)) || 0),
          0
        )
      }

      const recentKp: RecentRow[] = [...kpOrders]
        .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())
        .slice(0, 8)
        .map((o) => ({
          id: o.id,
          number:
            o.invoice_number_gst ||
            o.invoice_number_non_gst ||
            o.order_number ||
            "—",
          date: o.order_date,
          amount: parseFloat(String(o.total_amount)) || 0,
          status: (o.order_status || "unknown").toLowerCase(),
          payment_status: (o.payment_status || "unknown").toLowerCase(),
        }))
      setRecentOrders(recentKp)

      // ===== MY PURCHASES (created_by_user_id = me) =====
      // Mirrors the filter applied in /dashboard/purchases for the factories role.
      // `myPurchases` is period-scoped (used by status breakdown + recent list).
      // `factoryPurchasesAll` is all-time (used by the Purchase card so the Total
      // reconciles with /dashboard/purchases :: Total Value, which is unfiltered).
      const myPurchases = await fetchAllRows<any>((f, t) =>
        supabase
          .from("purchases")
          .select(
            "id, purchase_number, invoice_number, supplier_id, supplier_name, total_amount, purchase_date, purchase_status, payment_status, created_at"
          )
          .eq("created_by_user_id", authUser.id)
          .gte("purchase_date", fromIso)
          .lte("purchase_date", toIso)
          .range(f, t),
        "my purchases (period)"
      )

      // "Total Purchase" figures only count material (stock) purchases —
      // direct/indirect expense purchases are excluded here, same as P&L.
      const myPurchasesToday = await fetchAllRows<any>((f, t) =>
        supabase
          .from("purchases")
          .select("id, total_amount")
          .eq("created_by_user_id", authUser.id)
          .eq("purchase_category", "material")
          .gte("purchase_date", todayRange.startIso)
          .lte("purchase_date", todayRange.endIso)
          .range(f, t),
        "my purchases (today)"
      )

      const factoryPurchasesAll = await fetchAllRows<any>((f, t) =>
        supabase
          .from("purchases")
          .select("total_amount")
          .eq("created_by_user_id", authUser.id)
          .eq("purchase_category", "material")
          .range(f, t),
        "my purchases (all time)"
      )

      const factoryPurchasesAllTotal = factoryPurchasesAll.reduce(
        (s, p) => s + (parseFloat(String(p.total_amount)) || 0),
        0
      )
      const factoryPurchasesTodayTotal = myPurchasesToday.reduce(
        (s, p) => s + (parseFloat(String(p.total_amount)) || 0),
        0
      )
      // myPurchaseTotal/Today below absorb loose-stock transactions later so
      // the Purchase card matches the merged totals on /dashboard/purchases.
      // The bottle-only subtotals are kept for the status breakdown + AP cards.
      let myPurchaseTotal = factoryPurchasesAllTotal
      let myPurchaseToday = factoryPurchasesTodayTotal

      const purchaseStatusMap = new Map<string, { count: number; amount: number }>()
      // Vendor leaderboard — mirrors the distributor (sales) leaderboard but on
      // the purchase side. Keyed by supplier_id, falling back to supplier_name.
      const vendorMap = new Map<string, { name: string; purchases: number; amount: number }>()
      let myPurchasePending = 0
      let myPurchaseReceived = 0
      myPurchases.forEach((p) => {
        const s = (p.purchase_status || "unknown").toLowerCase()
        const amt = parseFloat(String(p.total_amount)) || 0
        const cur = purchaseStatusMap.get(s) || { count: 0, amount: 0 }
        cur.count += 1
        cur.amount += amt
        purchaseStatusMap.set(s, cur)
        if (s === "pending") myPurchasePending += 1
        if (s === "received") myPurchaseReceived += 1
        const vkey = p.supplier_id || p.supplier_name
        if (vkey) {
          const v = vendorMap.get(vkey) || {
            name: p.supplier_name || "Unknown vendor",
            purchases: 0,
            amount: 0,
          }
          v.purchases += 1
          v.amount += amt
          vendorMap.set(vkey, v)
        }
      })
      const purchaseStatusList: StatusBucket[] = Array.from(purchaseStatusMap.entries())
        .map(([status, v]) => ({ status, count: v.count, amount: v.amount }))
        .sort((a, b) => b.count - a.count)
      setPurchaseStatusBreakdown(purchaseStatusList)

      setTopVendors(
        Array.from(vendorMap.entries())
          .map(([id, v]) => ({ id, name: v.name, purchases: v.purchases, amount: v.amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
      )

      // ===== AP OUTSTANDING (factory's own unpaid purchases) =====
      // Always reflects the current moment, ignores the date preset, mirrors
      // the AP-aging definition used elsewhere (>30 days = overdue).
      const unpaidPurchases = await fetchAllRows<any>((f, t) =>
        supabase
          .from("purchases")
          .select("id, total_amount, remaining_amount, purchase_date, supplier_id, supplier_name, payment_status")
          .eq("created_by_user_id", authUser.id)
          .in("payment_status", ["pending", "partial", "processing"])
          .range(f, t),
        "unpaid purchases (AP)"
      )
      let apOutstanding = 0
      let apOverdue = 0
      const apVendorKeys = new Set<string>()
      const nowMs = Date.now()
      const MS_PER_DAY = 1000 * 60 * 60 * 24
      unpaidPurchases.forEach((p: any) => {
        // remaining_amount, not total_amount — a partially-paid purchase
        // should only count what's actually still owed, not its full
        // original value (was inflating AP outstanding for any bill that
        // had received a part-payment).
        const amt = parseFloat(String(p.remaining_amount ?? p.total_amount)) || 0
        apOutstanding += amt
        const days = Math.floor(
          (nowMs - new Date(p.purchase_date).getTime()) / MS_PER_DAY
        )
        if (days > 30) apOverdue += amt
        const key = p.supplier_id || p.supplier_name
        if (key) apVendorKeys.add(key)
      })

      const recentP: RecentRow[] = [...myPurchases]
        .sort(
          (a, b) =>
            new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
        )
        .slice(0, 8)
        .map((p) => ({
          id: p.id,
          number: p.invoice_number || p.purchase_number || "—",
          date: p.purchase_date,
          amount: parseFloat(String(p.total_amount)) || 0,
          status: (p.purchase_status || "unknown").toLowerCase(),
          payment_status: (p.payment_status || "unknown").toLowerCase(),
        }))
      setRecentPurchases(recentP)

      // ===== LOOSE-STOCK PURCHASE TRANSACTIONS (visible to factory) =====
      // Match /dashboard/purchases :: fetchPurchases — loose-stock purchases
      // are NOT date-filtered there, so the Purchase totals reconcile across
      // pages we fetch them ungated and split out the in-period subset for
      // the period-bound stats. Only STANDALONE transactions (purchase_id
      // null) are included — ones attached to a purchases order are already
      // inside that order's total_amount, so adding them again here would
      // double-count that portion of the Total Purchase figure.
      const { data: looseTxn, error: looseErr } = await supabase
        .from("loose_stock_transactions")
        .select("quantity_liters, total_amount, transaction_date, transaction_type")
        .eq("transaction_type", "purchase")
        .is("purchase_id", null)
      if (looseErr) {
        console.error("[Factory Dashboard] loose stock fetch failed:", looseErr)
      }

      // Litres need a separate, unfiltered fetch: a loose purchase linked to a
      // real `purchases` row (purchase_id set) never gets its own
      // purchase_items row (confirmed live — those purchases have zero
      // items), so its litres aren't captured by litresByPurchase either.
      // The purchase_id-null filter above exists only to avoid double
      // counting the ₹ amount (that purchase's total_amount already counts
      // it) — litres have no such double-counting risk, so every loose
      // purchase transaction's litres should count here regardless.
      const { data: looseTxnAllForLitres, error: looseAllErr } = await supabase
        .from("loose_stock_transactions")
        .select("quantity_liters, transaction_date, transaction_type")
        .eq("transaction_type", "purchase")
      if (looseAllErr) {
        console.error("[Factory Dashboard] loose stock (all) fetch failed:", looseAllErr)
      }
      const fromMs = effectiveFrom.getTime()
      const toMs = to.getTime()
      const todayStartMs = new Date(todayRange.startIso).getTime()
      const todayEndMs = new Date(todayRange.endIso).getTime()
      let looseLitres = 0
      let looseAmount = 0
      let looseAmountToday = 0
      let looseAmountAll = 0
      ;(looseTxn || []).forEach((r: any) => {
        const amt = parseFloat(String(r.total_amount)) || 0
        const ltr = parseFloat(String(r.quantity_liters)) || 0
        looseAmountAll += amt
        const ts = new Date(r.transaction_date).getTime()
        if (ts >= fromMs && ts <= toMs) {
          looseLitres += ltr
          looseAmount += amt
        }
        if (ts >= todayStartMs && ts <= todayEndMs) {
          looseAmountToday += amt
        }
      })

      // Roll loose-stock purchases into the Purchase card totals so they
      // reconcile with /dashboard/purchases :: Total Value (which merges
      // factory purchases + all loose-stock purchase transactions).
      myPurchaseTotal += looseAmountAll
      myPurchaseToday += looseAmountToday

      // ===== OPENING STOCK (manufacturing, scoped to this factory user) =====
      // Each row in opening_stock_entries is an explicit opening balance the
      // user declared from the /dashboard/manufacturing-opening-stock form,
      // so we sum all of them rather than filtering by FY start. Non-admin
      // factory users only see their own entries; admins see every factory.
      let openingStockAmount = 0
      let openingStockQty = 0
      let openingQuery = supabase
        .from("opening_stock_entries")
        .select("quantity, unit_price, created_by")
        .eq("stock_type", "manufacturing")
      if (role !== "admin") {
        openingQuery = openingQuery.eq("created_by", authUser.id)
      }
      // unit_price may not exist yet in older deployments (see
      // migrations/add_unit_price_to_opening_stock_entries.sql). Try the rich
      // shape first, then fall back to quantity-only if the column is missing.
      const openingRich = await openingQuery
      if (openingRich.error) {
        let fallbackQuery = supabase
          .from("opening_stock_entries")
          .select("quantity, created_by")
          .eq("stock_type", "manufacturing")
        if (role !== "admin") {
          fallbackQuery = fallbackQuery.eq("created_by", authUser.id)
        }
        const fallback = await fallbackQuery
        ;(fallback.data || []).forEach((r: any) => {
          openingStockQty += parseFloat(String(r.quantity)) || 0
        })
      } else {
        ;(openingRich.data || []).forEach((r: any) => {
          const q = parseFloat(String(r.quantity)) || 0
          const p = parseFloat(String(r.unit_price)) || 0
          openingStockQty += q
          openingStockAmount += q * p
        })
      }

      // ===== PURCHASE RETURNS (debit notes against vendors) =====
      const { data: debitNotes, error: debitErr } = await supabase
        .from("debit_notes")
        .select("total_amount, note_date, party_type")
        .neq("party_type", "customer")
        .gte("note_date", fromIso.slice(0, 10))
        .lte("note_date", toIso.slice(0, 10))
      if (debitErr) {
        console.error("[Factory Dashboard] debit notes fetch failed:", debitErr)
      }
      const purchaseReturnsAmount = (debitNotes || []).reduce(
        (s: number, r: any) => s + (parseFloat(String(r.total_amount)) || 0),
        0
      )
      const purchaseReturnsCount = (debitNotes || []).length

      // ===== SALES RETURNS (credit notes raised for customers) =====
      const { data: creditNotes, error: creditErr } = await supabase
        .from("credit_notes")
        .select("total_amount, note_date, party_type")
        .gte("note_date", fromIso.slice(0, 10))
        .lte("note_date", toIso.slice(0, 10))
      if (creditErr) {
        console.error("[Factory Dashboard] credit notes fetch failed:", creditErr)
      }
      const salesReturnsAmount = (creditNotes || []).reduce(
        (s: number, r: any) => s + (parseFloat(String(r.total_amount)) || 0),
        0
      )
      const salesReturnsCount = (creditNotes || []).length

      // ===== EXPENSES split into direct / indirect =====
      // Direct: production-linked spend (wages, daily ops).
      // Indirect: financing & overhead (loan, rent, other).
      const DIRECT_TYPES = new Set(["wages", "daily_expenses", "freight", "transport"])
      const { data: expenseRows, error: expenseErr } = await supabase
        .from("expenses")
        .select("amount, expense_type, expense_date")
        .gte("expense_date", fromIso)
        .lte("expense_date", toIso)
      if (expenseErr) {
        console.error("[Factory Dashboard] expenses fetch failed:", expenseErr)
      }
      let directExpensesAmount = 0
      let indirectExpensesAmount = 0
      ;(expenseRows || []).forEach((e: any) => {
        const amt = parseFloat(String(e.amount)) || 0
        if (DIRECT_TYPES.has(String(e.expense_type || "").toLowerCase())) {
          directExpensesAmount += amt
        } else {
          indirectExpensesAmount += amt
        }
      })

      // Purchases tagged as an expense category (direct_expense/indirect_expense/
      // other/mixed) never get a mirrored row in the `expenses` table above (see
      // migrations/add_purchase_category.sql) — without this, real factory
      // spend bought as a "purchase" (packaging, transport, etc.) is silently
      // missing from Direct/Indirect Expense, Gross Profit, and Net Profit.
      // Booked net of GST (taxable value), matching the P&L report's identical
      // fix — using each item's own STORED gst_amount via splitItemGst(), not
      // gst_percentage, since some purchases predate the GST-inclusive→exclusive
      // rate fix (see lib/purchase-item-gst.ts).
      const expensePurchases = await fetchAllRows<any>((f, t) =>
        supabase
          .from("purchases")
          .select("id, purchase_category, subtotal, gst_amount, total_amount")
          .eq("created_by_user_id", authUser.id)
          .in("purchase_category", ["direct_expense", "indirect_expense", "other", "mixed"])
          .gte("purchase_date", fromIso)
          .lte("purchase_date", toIso)
          .range(f, t),
        "expense-category purchases (period)"
      )
      if (expensePurchases.length > 0) {
        const expensePurchaseById = new Map(expensePurchases.map((p: any) => [p.id, p]))
        const expenseItems = await fetchAllRows<any>((f, t) =>
          supabase
            .from("purchase_items")
            .select("purchase_id, total, gst_amount, purchase_category")
            .in("purchase_id", expensePurchases.map((p: any) => p.id))
            .range(f, t),
          "expense-category purchase items (period)"
        )
        expenseItems.forEach((item: any) => {
          const purchase = expensePurchaseById.get(item.purchase_id)
          if (!purchase) return
          const category = item.purchase_category || purchase.purchase_category
          if (category === "fixed_asset" || category === "material") return
          const { taxable } = splitItemGst(item, isOldGstConvention(purchase))
          if (category === "direct_expense") directExpensesAmount += taxable
          else indirectExpensesAmount += taxable
        })
      }

      // ===== CURRENT STOCK ON HAND (factory warehouse only, finished goods + loose) =====
      // Scoped to the factory's own warehouse (factory_warehouse_stock), not company-wide
      // stock_inventory — most stock has already moved out to distributor/retailer godowns,
      // so this dashboard should only reflect what's physically still at the factory.
      // Valued the same way as /dashboard/stock's "Grand Total" card: packed + loose litres
      // per category, priced at that category's loose_stock purchase rate per litre.
      let stockLitres = 0
      let stockAmount = 0
      const packedLitresByCategory: Record<string, number> = {}
      const { data: factoryStockRows, error: factoryStockErr } = await supabase
        .from("factory_warehouse_stock")
        .select(`
          quantity,
          stock_inventory (
            product_variants (
              variant_name,
              product_categories (name)
            ),
            packaging_materials (material_type)
          )
        `)
      if (factoryStockErr) {
        console.error("[Factory Dashboard] factory warehouse stock fetch failed:", factoryStockErr)
      }
      ;(factoryStockRows || []).forEach((item: any) => {
        const qty = parseFloat(String(item.quantity)) || 0
        const inv = item.stock_inventory
        // "content" packaging is the raw fill, not a sellable bottle — exclude
        // it from the litres tally so we don't double-count against loose stock.
        if (inv?.packaging_materials?.material_type !== "content") {
          const litres = stockVariantToLitres(inv?.product_variants?.variant_name || "", qty)
          stockLitres += litres
          const categoryName = inv?.product_variants?.product_categories?.name
          if (categoryName) {
            packedLitresByCategory[categoryName] = (packedLitresByCategory[categoryName] || 0) + litres
          }
        }
      })
      const { data: looseStockRows, error: looseStockErr } = await supabase
        .from("loose_stock")
        .select("quantity_liters, price_per_liter, product_categories (name)")
      if (looseStockErr) {
        console.error("[Factory Dashboard] loose stock balance fetch failed:", looseStockErr)
      }
      ;(looseStockRows || []).forEach((item: any) => {
        const qty = parseFloat(String(item.quantity_liters)) || 0
        const price = parseFloat(String(item.price_per_liter)) || 0
        const categoryName = item.product_categories?.name
        stockLitres += qty
        stockAmount += (qty + (categoryName ? packedLitresByCategory[categoryName] || 0 : 0)) * price
      })

      // ===== BILLS RECEIVABLE (unpaid KP invoices — distributors owe the factory) =====
      // KP-prefixed unpaid orders, current snapshot (all-time, ignores the date
      // preset like AP above). Overdue at 30+ days to match the AP-aging rule.
      // remaining_amount only exists on orders_v once
      // migrations/add_order_payment_allocations.sql has been run — fall
      // back to the plain (pre-migration) column list and use total_amount
      // as before if it hasn't, rather than breaking the whole dashboard
      // fetch over one missing column.
      let unpaidKpOrders: any[]
      try {
        unpaidKpOrders = await fetchAllRows<any>((f, t) =>
          supabase
            .from("orders_v")
            .select("id, total_amount, remaining_amount, order_date, customer_name, distributor_id, payment_status")
            .or(
              "order_number.ilike.KP%,invoice_number_gst.ilike.KP%,invoice_number_non_gst.ilike.KP%"
            )
            .in("payment_status", ["pending", "partial", "processing"])
            .range(f, t),
          "unpaid KP orders (AR)"
        )
      } catch (err: any) {
        if (err?.code === "PGRST204" || err?.code === "42703") {
          console.warn("orders_v.remaining_amount doesn't exist yet (run migrations/add_order_payment_allocations.sql) — AR outstanding will count full order totals until then.")
          unpaidKpOrders = await fetchAllRows<any>((f, t) =>
            supabase
              .from("orders_v")
              .select("id, total_amount, order_date, customer_name, distributor_id, payment_status")
              .or(
                "order_number.ilike.KP%,invoice_number_gst.ilike.KP%,invoice_number_non_gst.ilike.KP%"
              )
              .in("payment_status", ["pending", "partial", "processing"])
              .range(f, t),
            "unpaid KP orders (AR, no remaining_amount)"
          )
        } else {
          throw err
        }
      }
      let arOutstanding = 0
      let arOverdue = 0
      const arCustomerKeys = new Set<string>()
      unpaidKpOrders.forEach((o: any) => {
        // remaining_amount, not total_amount — same partial-payment fix as
        // AP above, once the column exists.
        const amt = parseFloat(String(o.remaining_amount ?? o.total_amount)) || 0
        arOutstanding += amt
        const days = Math.floor(
          (nowMs - new Date(o.order_date).getTime()) / MS_PER_DAY
        )
        if (days > 30) arOverdue += amt
        const key = o.distributor_id || o.customer_name
        if (key) arCustomerKeys.add(String(key))
      })

      setStats({
        kpOrdersTotal: kpOrdersActive.length,
        kpOrdersToday: kpOrdersTodayActive.length,
        kpSalesTotal,
        kpSalesToday,
        kpGstTotal,
        kpGstToday,
        kpLitresTotal,
        kpLitresToday,
        kpAvgOrderValue: kpOrdersActive.length > 0 ? kpSalesTotal / kpOrdersActive.length : 0,
        kpDistributorsServed: distributorMap.size,
        myPurchaseTotal,
        myPurchaseToday,
        myPurchaseCount: myPurchases.length,
        myPurchasePending,
        myPurchaseReceived,
        apOutstanding,
        apOverdue,
        apVendorCount: apVendorKeys.size,
        looseLitres,
        looseAmount,
        openingStockAmount,
        openingStockQty,
        purchaseReturnsAmount,
        purchaseReturnsCount,
        salesReturnsAmount,
        salesReturnsCount,
        directExpensesAmount,
        indirectExpensesAmount,
        kpCgst,
        kpSgst,
        kpIgst,
        kpItcTotal,
        kpGstPayable,
        stockLitres,
        stockAmount,
        arOutstanding,
        arOverdue,
        arCustomerCount: arCustomerKeys.size,
        vendorCount: vendorMap.size,
      })

      // ===== FY MONTHLY BREAKDOWN (KP orders + my purchases) =====
      const breakdownFY =
        datePreset === "lastFY" ? getFiscalYearRange(-1) : getFiscalYearRange(0)
      setMonthlyFYLabel(breakdownFY.label)

      const fyStart = breakdownFY.start > epoch ? breakdownFY.start : epoch
      const fyStartIso = fyStart.toISOString()
      const fyEndIso = breakdownFY.end.toISOString()

      const fyKpOrders = await fetchAllRows<any>((f, t) =>
        supabase
          .from("orders_v")
          .select("id, total_amount, gst_amount, order_date")
          .or(
            "order_number.ilike.KP%,invoice_number_gst.ilike.KP%,invoice_number_non_gst.ilike.KP%"
          )
          .neq("order_status", "cancelled")
          .gte("order_date", fyStartIso)
          .lte("order_date", fyEndIso)
          .range(f, t),
        "FY KP orders"
      )

      const fyKpOrderIds = fyKpOrders.map((o) => o.id)
      const litresByOrder = new Map<string, number>()
      for (let i = 0; i < fyKpOrderIds.length; i += 500) {
        const batch = fyKpOrderIds.slice(i, i + 500)
        const rows = await fetchAllRows<any>((f, t) =>
          supabase
            .from("order_items")
            .select("order_id, quantity, product_name")
            .in("order_id", batch)
            .range(f, t)
        )
        rows.forEach((it: any) => {
          const q = parseFloat(String(it.quantity)) || 0
          litresByOrder.set(
            it.order_id,
            (litresByOrder.get(it.order_id) || 0) + variantToLitres(it.product_name || "", q)
          )
        })
      }

      // Mirror /dashboard/purchases: no date filter, just created_by_user_id,
      // and pull *all* rows via the paginated helper. The previous single-query
      // version was capped at Supabase's default 1000-row limit, which silently
      // undercounted the "My purchases" column for factories with more rows.
      // Bucketing into FY months happens client-side; out-of-range rows are
      // ignored automatically because their month key is not in fyMap.
      const fyPurchases = await fetchAllRows<any>((f, t) =>
        supabase
          .from("purchases")
          .select("id, total_amount, gst_amount, purchase_date")
          .eq("created_by_user_id", authUser.id)
          .eq("purchase_category", "material")
          .range(f, t),
        "FY purchases"
      )

      // Litres purchased per bottle-purchase, via purchase_items (mirrors the
      // KP-order litres calc above). Loose-stock litres are folded in from
      // looseTxn during bucketing below.
      const fyPurchaseIds = fyPurchases.map((p: any) => p.id).filter(Boolean)
      const litresByPurchase = new Map<string, number>()
      for (let i = 0; i < fyPurchaseIds.length; i += 500) {
        const batch = fyPurchaseIds.slice(i, i + 500)
        const rows = await fetchAllRows<any>((f, t) =>
          supabase
            .from("purchase_items")
            .select("purchase_id, quantity, product_name")
            .in("purchase_id", batch)
            .range(f, t)
        )
        rows.forEach((it: any) => {
          const q = parseFloat(String(it.quantity)) || 0
          litresByPurchase.set(
            it.purchase_id,
            (litresByPurchase.get(it.purchase_id) || 0) + variantToLitres(it.product_name || "", q)
          )
        })
      }

      // FY expenses (direct + indirect = total) bucketed by month.
      const fyExpenses = await fetchAllRows<any>((f, t) =>
        supabase
          .from("expenses")
          .select("amount, expense_date")
          .gte("expense_date", fyStartIso)
          .lte("expense_date", fyEndIso)
          .range(f, t),
        "FY expenses"
      )

      // Same gap as the period-level Direct/Indirect Expense fix above, FY-scoped
      // — expense-category purchases never mirror into the `expenses` table, so
      // without this every month's Expense column (and therefore Net Profit)
      // silently ignores real spend bought as a "purchase".
      const fyExpensePurchases = await fetchAllRows<any>((f, t) =>
        supabase
          .from("purchases")
          .select("id, purchase_date, purchase_category, subtotal, gst_amount, total_amount")
          .eq("created_by_user_id", authUser.id)
          .in("purchase_category", ["direct_expense", "indirect_expense", "other", "mixed"])
          .gte("purchase_date", fyStartIso)
          .lte("purchase_date", fyEndIso)
          .range(f, t),
        "FY expense-category purchases"
      )
      const fyExpensePurchaseById = new Map(fyExpensePurchases.map((p: any) => [p.id, p]))
      const fyExpenseItems =
        fyExpensePurchases.length > 0
          ? await fetchAllRows<any>((f, t) =>
              supabase
                .from("purchase_items")
                .select("purchase_id, total, gst_amount, purchase_category")
                .in("purchase_id", fyExpensePurchases.map((p: any) => p.id))
                .range(f, t),
              "FY expense-category purchase items"
            )
          : []

      // FY purchase returns (debit notes against vendors) / sales returns
      // (credit notes for customers), bucketed by month — mirrors the
      // period-level Net Purchase / Net Sales math above (purchaseReturnsAmount
      // / salesReturnsAmount) so the Monthly Breakdown's Purchase and KP sales
      // columns net out returns instead of showing gross totals.
      const fyDebitNotes = await fetchAllRows<any>((f, t) =>
        supabase
          .from("debit_notes")
          .select("total_amount, note_date, party_type")
          .neq("party_type", "customer")
          .gte("note_date", fyStartIso.slice(0, 10))
          .lte("note_date", fyEndIso.slice(0, 10))
          .range(f, t),
        "FY debit notes"
      )
      const fyCreditNotes = await fetchAllRows<any>((f, t) =>
        supabase
          .from("credit_notes")
          .select("id, total_amount, note_date")
          .gte("note_date", fyStartIso.slice(0, 10))
          .lte("note_date", fyEndIso.slice(0, 10))
          .range(f, t),
        "FY credit notes"
      )

      // Litres returned via credit note, per note — a credit note is stock
      // coming BACK in (a sales return), so it must reduce the litres counted
      // as sold, not just the ₹ amount, or Closing Ltr silently overstates
      // how much stock actually left.
      const fyCreditNoteIds = fyCreditNotes.map((n: any) => n.id).filter(Boolean)
      const litresByCreditNote = new Map<string, number>()
      for (let i = 0; i < fyCreditNoteIds.length; i += 500) {
        const batch = fyCreditNoteIds.slice(i, i + 500)
        const rows = await fetchAllRows<any>((f, t) =>
          supabase
            .from("credit_note_items")
            .select("credit_note_id, quantity, item_name")
            .in("credit_note_id", batch)
            .range(f, t)
        )
        rows.forEach((it: any) => {
          const q = parseFloat(String(it.quantity)) || 0
          litresByCreditNote.set(
            it.credit_note_id,
            (litresByCreditNote.get(it.credit_note_id) || 0) + variantToLitres(it.item_name || "", q)
          )
        })
      }

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
          kpOrders: 0,
          kpSales: 0,
          salesReturns: 0,
          kpLitres: 0,
          salesReturnLitres: 0,
          gst: 0,
          purchases: 0,
          purchaseReturns: 0,
          purchaseLitres: 0,
          expense: 0,
          netProfit: 0,
          openingLitres: 0,
          closingLitres: 0,
          openingStockAmount: 0,
          closingStockAmount: 0,
          inputGst: 0,
        })
      }

      fyKpOrders.forEach((o) => {
        const d = new Date(o.order_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) {
          bucket.kpOrders += 1
          bucket.kpSales += parseFloat(String(o.total_amount)) || 0
          bucket.kpLitres += litresByOrder.get(o.id) || 0
          bucket.gst += parseFloat(String(o.gst_amount)) || 0
        }
      })
      fyPurchases.forEach((p: any) => {
        if (!p.purchase_date) return
        const d = new Date(p.purchase_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) {
          bucket.purchases += parseFloat(String(p.total_amount)) || 0
          bucket.purchaseLitres += litresByPurchase.get(p.id) || 0
          bucket.inputGst += parseFloat(String(p.gst_amount)) || 0
        }
      })
      // Loose-stock purchases add to the ₹ amount only for STANDALONE
      // transactions (purchase_id null) so the monthly Purchase column
      // reconciles with the Purchase card — one linked to a real purchase
      // already has its ₹ counted via that purchase's total_amount above.
      ;(looseTxn || []).forEach((r: any) => {
        if (!r.transaction_date) return
        const d = new Date(r.transaction_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) {
          bucket.purchases += parseFloat(String(r.total_amount)) || 0
        }
      })
      // Litres, by contrast, come from EVERY loose purchase transaction
      // regardless of purchase_id — a loose purchase linked to a real
      // `purchases` row never gets its own purchase_items row, so
      // litresByPurchase is 0 for it and its litres would otherwise vanish
      // entirely instead of just being "already counted elsewhere".
      ;(looseTxnAllForLitres || []).forEach((r: any) => {
        if (!r.transaction_date) return
        const d = new Date(r.transaction_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) {
          bucket.purchaseLitres += parseFloat(String(r.quantity_liters)) || 0
        }
      })
      fyExpenses.forEach((e: any) => {
        if (!e.expense_date) return
        const d = new Date(e.expense_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) bucket.expense += parseFloat(String(e.amount)) || 0
      })
      fyExpenseItems.forEach((item: any) => {
        const purchase = fyExpensePurchaseById.get(item.purchase_id)
        if (!purchase || !purchase.purchase_date) return
        const category = item.purchase_category || purchase.purchase_category
        if (category === "fixed_asset" || category === "material") return
        const d = new Date(purchase.purchase_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) {
          const { taxable } = splitItemGst(item, isOldGstConvention(purchase))
          bucket.expense += taxable
        }
      })
      fyDebitNotes.forEach((n: any) => {
        if (!n.note_date) return
        const d = new Date(n.note_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) bucket.purchaseReturns += parseFloat(String(n.total_amount)) || 0
      })
      fyCreditNotes.forEach((n: any) => {
        if (!n.note_date) return
        const d = new Date(n.note_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const bucket = fyMap.get(key)
        if (bucket) {
          bucket.salesReturns += parseFloat(String(n.total_amount)) || 0
          bucket.salesReturnLitres += litresByCreditNote.get(n.id) || 0
        }
      })
      // Net debit/credit notes into Purchase / KP sales (₹ and litres) so the
      // Monthly Breakdown table (and the Net Profit / Closing Ltr derived
      // from it) matches the top-level Net Purchase / Net Sales figures
      // instead of gross totals — a credit note is stock coming back in, so
      // it must reduce Sale Ltr too, not just KP sales ₹.
      fyMap.forEach((bucket) => {
        bucket.purchases -= bucket.purchaseReturns
        bucket.kpSales -= bucket.salesReturns
        bucket.kpLitres -= bucket.salesReturnLitres
      })
      // Net profit per month = KP sales − purchase − expense (the columns shown).
      fyMap.forEach((bucket) => {
        bucket.netProfit = bucket.kpSales - bucket.purchases - bucket.expense
      })
      // Opening/closing stock (litres) per month — running balance seeded from
      // the declared manufacturing opening stock; each month adds purchase
      // litres and removes KP sale litres. fyMap iterates in FY month order.
      // Stock (₹) uses the same running litres valued at a constant rate —
      // the average of the declared opening stock (₹ ÷ litres at the time
      // it was entered) — since there's no per-batch cost history to value
      // stock precisely at each month's boundary.
      const avgStockRate = openingStockQty > 0 ? openingStockAmount / openingStockQty : 0
      let runningLitres = openingStockQty
      fyMap.forEach((bucket) => {
        bucket.openingLitres = runningLitres
        bucket.openingStockAmount = runningLitres * avgStockRate
        runningLitres += bucket.purchaseLitres - bucket.kpLitres
        bucket.closingLitres = runningLitres
        bucket.closingStockAmount = runningLitres * avgStockRate
      })

      setMonthly(Array.from(fyMap.values()))
      setLoading(false)
    }

    load().catch((err) => {
      console.error("Factory dashboard load error:", err)
      setLoadError(err?.message || String(err) || "Failed to load dashboard metrics")
      setLoading(false)
    })
  }, [datePreset, role, roleLoading, getDateRange, todayRange])

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }
  if (role !== "factories" && role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Factory access only</p>
      </div>
    )
  }

  // Trading-account math:
  //   Gross Profit = Net Sales + Closing Stock − (Opening Stock + Net Purchase + Direct Expenses)
  //   Net Profit   = Gross Profit + Other Income − Indirect Expenses
  // Closing Stock and Other Income aren't tracked yet, so they're treated as 0
  // — wire them up the same way once those datasets land.
  const netSales = stats.kpSalesTotal - stats.salesReturnsAmount
  const netPurchase = stats.myPurchaseTotal - stats.purchaseReturnsAmount
  const closingStockAmount = 0
  const otherIncomeAmount = 0
  const grossProfit =
    netSales + closingStockAmount -
    (stats.openingStockAmount + netPurchase + stats.directExpensesAmount)
  const netProfit = grossProfit + otherIncomeAmount - stats.indirectExpensesAmount

  // Overview › Profitability — reuse the trading-account net profit as "Income"
  // so the summary tile reconciles with the P&L section below it.
  const overviewIncome = netProfit
  const overviewProfitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0
  const totalExpenses = stats.directExpensesAmount + stats.indirectExpensesAmount

  const monthlyTotals = monthly.reduce(
    (acc, m) => ({
      kpOrders: acc.kpOrders + m.kpOrders,
      kpSales: acc.kpSales + m.kpSales,
      kpLitres: acc.kpLitres + m.kpLitres,
      gst: acc.gst + m.gst,
      inputGst: acc.inputGst + m.inputGst,
      purchases: acc.purchases + m.purchases,
      purchaseLitres: acc.purchaseLitres + m.purchaseLitres,
      expense: acc.expense + m.expense,
      netProfit: acc.netProfit + m.netProfit,
    }),
    {
      kpOrders: 0,
      kpSales: 0,
      kpLitres: 0,
      gst: 0,
      inputGst: 0,
      purchases: 0,
      purchaseLitres: 0,
      expense: 0,
      netProfit: 0,
    }
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Factory Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            KP-prefixed invoices and your purchases since {FACTORY_EPOCH}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={datePreset}
            onValueChange={(v) => setDatePreset(v as DatePreset)}
          >
            <SelectTrigger className="w-[180px] h-9 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisFY">This FY (Apr–Mar)</SelectItem>
              <SelectItem value="lastFY">Last FY</SelectItem>
              <SelectItem value="allTime">Since {FACTORY_EPOCH}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">Loading metrics…</div>
      )}
      {loadError && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          Failed to load dashboard data: {loadError}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
            OVERVIEW — factory-scoped port of the five summary sections from
            /dashboard/dashboard-v2 (Financial Overview, Outstanding Bills,
            Profitability, Operations, Network). Every figure is scoped to the
            factory: KP-prefixed sales, the signed-in user's purchases, factory
            expenses, AP/AR and current stock. Tiles that have no factory meaning
            on the admin dashboard (Cash & Bank, company-wide Customers, Support
            Tickets, Retailers) are swapped for factory-relevant metrics.
         ══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            📈
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Overview</h2>
            <p className="text-xs text-muted-foreground">
              Factory financials, operations &amp; network at a glance
            </p>
          </div>
        </div>

        {/* 1 — Financial Overview */}
        <PLSection step="1" title="Financial Overview">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <PLDualCard
              label="SALES"
              accent="emerald"
              icon="💰"
              leftLabel="Total"
              leftValue={formatINRCompact(stats.kpSalesTotal - stats.salesReturnsAmount)}
              leftHint={`${formatINR(stats.kpSalesTotal - stats.salesReturnsAmount)} · Net of credit notes`}
              rightLabel="Today"
              rightValue={formatINRCompact(stats.kpSalesToday)}
              rightHint={formatINR(stats.kpSalesToday)}
              compact
              menuOptions={[
                { label: "Sales", href: "/dashboard/orders" },
                { label: "Credit Note", href: "/dashboard/credit-notes" },
              ]}
            />
            <PLDualCard
              label="PURCHASE"
              accent="amber"
              icon="🛒"
              leftLabel="Total"
              leftValue={formatINRCompact(stats.myPurchaseTotal - stats.purchaseReturnsAmount)}
              leftHint={`${formatINR(stats.myPurchaseTotal - stats.purchaseReturnsAmount)} · Net of debit notes`}
              rightLabel="Today"
              rightValue={formatINRCompact(stats.myPurchaseToday)}
              rightHint={formatINR(stats.myPurchaseToday)}
              compact
              menuOptions={[
                { label: "Purchase", href: "/dashboard/purchases" },
                { label: "Debit Note", href: "/dashboard/debit-notes" },
              ]}
            />
            <PLDualCard
              label="FACTORY WAREHOUSE STOCK"
              accent="violet"
              icon="📦"
              leftLabel="Litres"
              leftValue={formatLitres(stats.stockLitres)}
              leftHint="On hand at factory"
              rightLabel="Amount"
              rightValue={formatINRCompact(stats.stockAmount)}
              rightHint={`${formatINR(stats.stockAmount)} · Inventory value`}
              compact
              href="/dashboard/stock"
            />
            <OverviewMultiCard
              label="GST"
              accent="blue"
              icon="🧾"
              href="/dashboard/reports/gst-payable"
              tiles={[
                { label: "Output GST", value: formatINRCompact(stats.kpGstTotal) },
                { label: "Input GST (ITC)", value: formatINRCompact(stats.kpItcTotal) },
                {
                  label: "GST Payable",
                  value: formatINRCompact(stats.kpGstPayable),
                  color: "text-rose-600 dark:text-rose-400",
                },
              ]}
            />
          </div>
        </PLSection>

        {/* 2 — Outstanding Bills */}
        <PLSection step="2" title="Outstanding Bills">
          <div className="grid gap-4 md:grid-cols-2">
            <PLDualCard
              label="BILLS RECEIVABLE (DEBTORS)"
              accent="sky"
              icon="📥"
              leftLabel="Outstanding"
              leftValue={formatINRCompact(stats.arOutstanding)}
              rightLabel="Overdue 30+"
              rightValue={formatINRCompact(stats.arOverdue)}
              rightHint={`${formatNumber(stats.arCustomerCount)} customer${stats.arCustomerCount === 1 ? "" : "s"}`}
              valueTone="red-right"
              href="/dashboard/orders"
            />
            <PLDualCard
              label="BILLS PAYABLE (CREDITORS)"
              accent="rose"
              icon="📤"
              leftLabel="Outstanding"
              leftValue={formatINRCompact(stats.apOutstanding)}
              rightLabel="Overdue 30+"
              rightValue={formatINRCompact(stats.apOverdue)}
              rightHint={`${formatNumber(stats.apVendorCount)} vendor${stats.apVendorCount === 1 ? "" : "s"}`}
              valueTone="red-right"
              href="/dashboard/purchases"
            />
          </div>
        </PLSection>

        {/* 3 — Profitability */}
        <PLSection step="3" title="Profitability">
          <div className="grid gap-4 md:grid-cols-2">
            <OverviewMultiCard
              label="EXPENSE"
              accent="rose"
              icon="💸"
              tiles={[
                { label: "Direct", value: formatINRCompact(stats.directExpensesAmount), hint: "e.g. product/material cost" },
                { label: "Indirect", value: formatINRCompact(stats.indirectExpensesAmount), hint: "e.g. office expense" },
                {
                  label: "Total",
                  value: formatINRCompact(totalExpenses),
                  color: "text-rose-600 dark:text-rose-400",
                },
              ]}
            />
            <OverviewMultiCard
              label="OUTPUT GST BY TYPE"
              accent="indigo"
              icon="🧮"
              tiles={[
                { label: "IGST", value: formatINRCompact(stats.kpIgst) },
                { label: "CGST", value: formatINRCompact(stats.kpCgst) },
                { label: "SGST", value: formatINRCompact(stats.kpSgst) },
                { label: "Total GST", value: formatINRCompact(stats.kpGstTotal) },
              ]}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <PLSingleCard
              label="INCOME"
              accent="emerald"
              icon="✅"
              valueLabel="Net income"
              value={formatINRCompact(overviewIncome)}
              hint="Net profit (trading account)"
              valueTone={overviewIncome < 0 ? "red" : "green"}
              compact
            />
            <PLSingleCard
              label="PROFIT MARGIN"
              accent="teal"
              icon="📊"
              valueLabel="Margin"
              value={`${overviewProfitMargin.toFixed(1)}%`}
              hint="Net profit ÷ net sales"
              valueTone={overviewProfitMargin < 0 ? "red" : "green"}
              compact
            />
          </div>
        </PLSection>

        {/* 4 — Operations */}
        <PLSection step="4" title="Operations">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <PLDualCard
              label="ORDERS"
              accent="blue"
              icon="🧾"
              leftLabel="Total"
              leftValue={formatNumber(stats.kpOrdersTotal)}
              rightLabel="Today"
              rightValue={formatNumber(stats.kpOrdersToday)}
              compact
              href="/dashboard/orders"
            />
            <PLDualCard
              label="LITRES SOLD"
              accent="cyan"
              icon="🥛"
              leftLabel="Total"
              leftValue={formatLitres(stats.kpLitresTotal)}
              rightLabel="Today"
              rightValue={formatLitres(stats.kpLitresToday)}
              compact
              href="/dashboard/orders"
            />
            <PLDualCard
              label="DISTRIBUTORS"
              accent="fuchsia"
              icon="🤝"
              leftLabel="Served"
              leftValue={formatNumber(stats.kpDistributorsServed)}
              rightLabel="Avg Order"
              rightValue={formatINRCompact(stats.kpAvgOrderValue)}
              compact
            />
            <PLDualCard
              label="PURCHASES"
              accent="amber"
              icon="📋"
              leftLabel="Count"
              leftValue={formatNumber(stats.myPurchaseCount)}
              rightLabel="Pending"
              rightValue={formatNumber(stats.myPurchasePending)}
              compact
              href="/dashboard/purchases"
            />
          </div>
        </PLSection>

        {/* 5 — Network */}
        <PLSection step="5" title="Network" tone="purple">
          <div className="grid gap-4 md:grid-cols-3">
            <PLSingleCard
              label="DISTRIBUTORS SERVED"
              accent="purple"
              icon="🤝"
              valueLabel="Total"
              value={formatNumber(stats.kpDistributorsServed)}
              hint="Via KP invoices"
              compact
            />
            <PLSingleCard
              label="VENDORS"
              accent="violet"
              icon="🏭"
              valueLabel="Total"
              value={formatNumber(stats.vendorCount)}
              hint="Supplying the factory"
              compact
              href="/dashboard/vendors"
            />
            <PLSingleCard
              label="PRODUCTS DISPATCHED"
              accent="fuchsia"
              icon="📦"
              valueLabel="Total SKUs"
              value={formatNumber(litresByProduct.length)}
              hint="Distinct products (period)"
              compact
              href="/dashboard/products"
            />
          </div>
        </PLSection>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
            P&L STATEMENT — mirrors pl_dashboard_v4.html structure.
            Cards are grouped in trading-account order:
              1) Opening Stock → 2) Purchase → 3) Direct Expenses →
              4) Sales → 5) Closing Stock → Gross Profit →
              6) Indirect Expenses → 7) Other Income → Net Profit →
              8) Balance Sheet (Assets / Liabilities + AR/AP detail)
            Bound to existing stats where data is already loaded; remaining
            slots use placeholders until the corresponding query is wired.
         ══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            📊
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">P&amp;L Statement</h2>
            <p className="text-xs text-muted-foreground">
              Trading Account → P&amp;L Account → Balance Sheet
            </p>
          </div>
        </div>

        {/* STEPS 1-3 in a single row */}
        <div className="grid gap-4 md:grid-cols-4 items-start">
          <PLSection step="1" title="Opening Stock">
            <PLDualCard
              label="OPENING STOCK"
              leftLabel="Amount"
              leftValue={formatINR(stats.openingStockAmount)}
              leftHint="Declared opening balance"
              rightLabel="Qty in Hand"
              rightValue={formatNumber(stats.openingStockQty)}
              rightHint="Across all entries"
              compact
            />
          </PLSection>
          <div className="md:col-span-2">
            <PLSection step="2" title="Purchase">
              <div className="grid gap-4 md:grid-cols-2">
                <PLDualCard
                  label="PURCHASE"
                  leftLabel="Total"
                  leftValue={formatINR(stats.myPurchaseTotal)}
                  leftHint="Bottles + loose (all time)"
                  rightLabel="Today"
                  rightValue={formatINR(stats.myPurchaseToday)}
                  rightHint="Current day"
                  compact
                  href="/dashboard/purchases"
                />
                <PLDualCard
                  label="PURCHASE RETURNS"
                  leftLabel="Returns"
                  leftValue={formatINR(stats.purchaseReturnsAmount)}
                  leftHint={`${formatNumber(stats.purchaseReturnsCount)} debit note${stats.purchaseReturnsCount === 1 ? "" : "s"}`}
                  rightLabel="Net Purchase"
                  rightValue={formatINR(
                    stats.myPurchaseTotal - stats.purchaseReturnsAmount
                  )}
                  rightHint="After deduction"
                  valueTone="red-left"
                  compact
                />
              </div>
            </PLSection>
          </div>
          <PLSection step="3" title="Direct Expenses">
            <PLSingleCard
              label="DIRECT EXPENSES"
              valueLabel="Total"
              value={formatINR(stats.directExpensesAmount)}
              hint="Wages + Daily ops"
              compact
              href="/dashboard/expenses"
            />
          </PLSection>
        </div>

        {/* STEPS 4-5 + Gross Profit in a single row */}
        <PLArrow />
        <div className="grid gap-4 md:grid-cols-4 items-start">
          <div className="md:col-span-2">
            <PLSection step="4" title="Sales">
              <div className="grid gap-4 md:grid-cols-2">
                <PLDualCard
                  label="SALES"
                  leftLabel="Total"
                  leftValue={formatINR(stats.kpSalesTotal)}
                  leftHint="Gross revenue"
                  rightLabel="Today"
                  rightValue={formatINR(stats.kpSalesToday)}
                  rightHint="Current day"
                  compact
                  href="/dashboard/orders"
                />
                <PLDualCard
                  label="SALES RETURNS"
                  leftLabel="Returns"
                  leftValue={formatINR(stats.salesReturnsAmount)}
                  leftHint={`${formatNumber(stats.salesReturnsCount)} credit note${stats.salesReturnsCount === 1 ? "" : "s"}`}
                  rightLabel="Net Sales"
                  rightValue={formatINR(
                    stats.kpSalesTotal - stats.salesReturnsAmount
                  )}
                  rightHint="After deduction"
                  valueTone="red-left"
                  compact
                />
              </div>
            </PLSection>
          </div>
          <PLSection step="5" title="Closing Stock">
            <PLDualCard
              label="CLOSING STOCK"
              leftLabel="Amount"
              leftValue={formatINR(0)}
              leftHint="As on period end"
              rightLabel="Qty in Hand"
              rightValue={formatNumber(0)}
              rightHint="Units remaining"
              compact
            />
          </PLSection>
          <PLSection step="✓" title="Gross Profit" tone="green">
            <PLResultCard
              label="GROSS PROFIT"
              amount={formatINR(grossProfit)}
            />
          </PLSection>
        </div>

        {/* STEPS 6-7 + Net Profit in a single row */}
        <PLArrow />
        <div className="grid gap-4 md:grid-cols-3 items-start">
          <PLSection step="6" title="Indirect Expenses">
            <PLSingleCard
              label="INDIRECT EXPENSES"
              valueLabel="Total"
              value={formatINR(stats.indirectExpensesAmount)}
              hint="Loan + Rent + Other"
              valueTone="red"
              compact
              href="/dashboard/expenses"
            />
          </PLSection>
          <PLSection step="7" title="Other Income">
            <PLSingleCard
              label="OTHER INCOME"
              valueLabel="Total"
              value={formatINR(0)}
              hint="Discount + Commission + Interest"
              valueTone="green"
              compact
            />
          </PLSection>
          <PLSection step="✓" title="Net Profit" tone="green">
            <PLResultCard
              label="NET PROFIT"
              amount={formatINR(netProfit)}
            />
          </PLSection>
        </div>

        {/* STEP 8: BALANCE SHEET */}
        <PLArrow />
        <PLSection step="8" title="Balance Sheet" tone="purple">
          <div className="grid gap-4 md:grid-cols-2">
            <BalanceSheetCard
              title="Assets"
              tone="blue"
              rows={[
                { label: "Debtors (Bills Receivable)", value: formatINR(0), tone: "blue" },
                { label: "Closing Stock", value: formatINR(0), tone: "blue" },
                { label: "Cash in Hand", value: formatINR(0), tone: "blue" },
                { label: "Cash at Bank", value: formatINR(0), tone: "blue" },
                { label: "Fixed Assets", value: formatINR(0), tone: "blue" },
              ]}
              totalLabel="Total Assets"
              totalValue={formatINR(0)}
            />
            <BalanceSheetCard
              title="Liabilities & Capital"
              tone="red"
              rows={[
                {
                  label: "Creditors (Bills Payable)",
                  value: formatINR(stats.apOutstanding),
                  tone: "red",
                },
                {
                  label: "Overdue Creditors (30+)",
                  value: formatINR(stats.apOverdue),
                  tone: "red",
                },
                {
                  label: "GST Payable",
                  value: formatINR(stats.kpGstTotal),
                  tone: "red",
                },
                { label: "Capital", value: formatINR(0), tone: "blue" },
                {
                  label: "Net Profit (Added to Capital)",
                  value: formatINR(netProfit),
                  tone: "green",
                },
              ]}
              totalLabel="Total Liabilities"
              totalValue={formatINR(
                stats.apOutstanding + stats.kpGstTotal + netProfit
              )}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <PLDualCard
              label="BILLS RECEIVABLE (DEBTORS)"
              leftLabel="Outstanding"
              leftValue={formatINR(0)}
              rightLabel="Overdue 30+"
              rightValue={formatINR(0)}
              rightHint="0 customers"
              valueTone="red-right"
              href="/dashboard/orders"
            />
            <PLDualCard
              label="BILLS PAYABLE (CREDITORS)"
              leftLabel="Outstanding"
              leftValue={formatINR(stats.apOutstanding)}
              rightLabel="Overdue 30+"
              rightValue={formatINR(stats.apOverdue)}
              rightHint={`${stats.apVendorCount} vendor${stats.apVendorCount === 1 ? "" : "s"}`}
              valueTone="red-right"
              href="/dashboard/purchases"
            />
          </div>
        </PLSection>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            Monthly breakdown
            {monthlyFYLabel && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({monthlyFYLabel})
              </span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            KP sales & Sale Ltr are net of credit notes · Purchase is net of debit notes · Expense = direct + indirect · Net profit = KP sales − purchase − expense · Stock ₹ approximated at the declared opening stock&apos;s average rate (no per-batch cost history), Ltr shown below each ₹ figure
          </p>
        </CardHeader>
        <CardContent>
          {monthly.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Month</th>
                    <th className="py-2 pr-4 font-medium text-right">KP orders</th>
                    <th className="py-2 pr-4 font-medium text-right">Opening Stock</th>
                    <th className="py-2 pr-4 font-medium text-right">Purchase</th>
                    <th className="py-2 pr-4 font-medium text-right">Sales</th>
                    <th className="py-2 pr-4 font-medium text-right">Expense</th>
                    <th className="py-2 pr-4 font-medium text-right">Closing Stock</th>
                    <th className="py-2 pr-4 font-medium text-right">GST (Input − Output)</th>
                    <th className="py-2 pr-4 font-medium text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.key} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{m.month}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        <Link
                          href={`/dashboard/orders-v2?${monthOrdersV2Params(m.key)}`}
                          className="hover:underline text-blue-600 dark:text-blue-400"
                        >
                          {formatNumber(m.kpOrders)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        <div>{formatINR(m.openingStockAmount)}</div>
                        <div className="text-muted-foreground">{formatLitres(m.openingLitres)}</div>
                      </td>
                      <td
                        className="py-2 pr-4 text-right tabular-nums"
                        title={
                          m.purchaseReturns > 0
                            ? `${formatINR(m.purchases + m.purchaseReturns)} gross − ${formatINR(m.purchaseReturns)} debit notes = ${formatINR(m.purchases)} net`
                            : undefined
                        }
                      >
                        <div>
                          <Link
                            href={`/dashboard/purchases?${monthDateParams(m.key)}`}
                            className="hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {formatINR(m.purchases)}
                          </Link>
                        </div>
                        <div className="text-muted-foreground">{formatLitres(m.purchaseLitres)}</div>
                      </td>
                      <td
                        className="py-2 pr-4 text-right tabular-nums"
                        title={
                          m.salesReturns > 0
                            ? `${formatINR(m.kpSales + m.salesReturns)} gross − ${formatINR(m.salesReturns)} credit notes = ${formatINR(m.kpSales)} net`
                            : undefined
                        }
                      >
                        <div>
                          <Link
                            href={`/dashboard/orders-v2?${monthOrdersV2Params(m.key)}`}
                            className="hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {formatINR(m.kpSales)}
                          </Link>
                        </div>
                        <div className="text-muted-foreground">{formatLitres(m.kpLitres)}</div>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        <Link
                          href={`/dashboard/expenses?${monthDateParams(m.key)}`}
                          className="hover:underline text-blue-600 dark:text-blue-400"
                        >
                          {formatINR(m.expense)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        <div>{formatINR(m.closingStockAmount)}</div>
                        <div className="text-muted-foreground">{formatLitres(m.closingLitres)}</div>
                      </td>
                      <td
                        className="py-2 pr-4 text-right tabular-nums text-xs text-muted-foreground"
                        title={`Input ${formatINR(m.inputGst)} − Output ${formatINR(m.gst)} = ${formatINR(m.inputGst - m.gst)}`}
                      >
                        {formatINR(m.inputGst - m.gst)}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right tabular-nums font-medium ${
                          m.netProfit < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {formatINR(m.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="pt-3 pr-4">Total</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      {formatNumber(monthlyTotals.kpOrders)}
                    </td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      <div>{formatINR(monthly[0]?.openingStockAmount ?? 0)}</div>
                      <div className="font-normal text-muted-foreground">{formatLitres(monthly[0]?.openingLitres ?? 0)}</div>
                    </td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      <div>{formatINR(monthlyTotals.purchases)}</div>
                      <div className="font-normal text-muted-foreground">{formatLitres(monthlyTotals.purchaseLitres)}</div>
                    </td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      <div>{formatINR(monthlyTotals.kpSales)}</div>
                      <div className="font-normal text-muted-foreground">{formatLitres(monthlyTotals.kpLitres)}</div>
                    </td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      {formatINR(monthlyTotals.expense)}
                    </td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      <div>{formatINR(monthly[monthly.length - 1]?.closingStockAmount ?? 0)}</div>
                      <div className="font-normal text-muted-foreground">{formatLitres(monthly[monthly.length - 1]?.closingLitres ?? 0)}</div>
                    </td>
                    <td className="pt-3 pr-4 text-right tabular-nums text-xs text-muted-foreground">
                      {formatINR(monthlyTotals.inputGst - monthlyTotals.gst)}
                    </td>
                    <td
                      className={`pt-3 pr-4 text-right tabular-nums ${
                        monthlyTotals.netProfit < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {formatINR(monthlyTotals.netProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Loading monthly data…" : "No data available"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            KP sales vs your purchases — monthly
            {monthlyFYLabel && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({monthlyFYLabel})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthly} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => inrFormatter.format(Number(v))}
                />
                <Tooltip
                  formatter={(v: any) => formatINR(Number(v))}
                  labelClassName="text-xs"
                />
                <Legend />
                <Bar dataKey="kpSales" name="KP sales" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="purchases" name="My purchases" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Loading chart data…" : "No data available"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            Litres dispatched via KP invoices
            {monthlyFYLabel && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({monthlyFYLabel})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthly} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${litreFormatter.format(Number(v))} Ltr`}
                />
                <Tooltip formatter={(v: any) => `${litreFormatter.format(Number(v))} Ltr`} />
                <Line
                  type="monotone"
                  dataKey="kpLitres"
                  name="Litres"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 4 }}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Top products by litres dispatched
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (period)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {litresByProduct.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={Math.max(220, litresByProduct.length * 38)}
            >
              <BarChart
                data={litresByProduct}
                layout="vertical"
                margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${litreFormatter.format(Number(v))} Ltr`}
                />
                <YAxis
                  type="category"
                  dataKey="product"
                  tick={{ fontSize: 11 }}
                  width={260}
                />
                <Tooltip formatter={(v: any) => `${litreFormatter.format(Number(v))} Ltr`} />
                <Bar
                  dataKey="litres"
                  name="Litres"
                  fill="#06b6d4"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Loading product data…" : "No litres data in this range"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sales Leader · Purchase Leader · Net Profit (Sales − Purchase) — per factory request */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LeaderCard
          title="Sales Leader"
          subtitle="Top distributors by KP value"
          accent="blue"
          emptyHint="No distributor sales yet"
          rows={topDistributors.map((d) => ({
            name: d.name,
            sub: `${formatNumber(d.orders)} order${d.orders === 1 ? "" : "s"}`,
            value: formatINR(d.amount),
          }))}
        />
        <LeaderCard
          title="Purchase Leader"
          subtitle="Top vendors by purchase value"
          accent="amber"
          emptyHint="No vendor purchases yet"
          rows={topVendors.map((v) => ({
            name: v.name,
            sub: `${formatNumber(v.purchases)} purchase${v.purchases === 1 ? "" : "s"}`,
            value: formatINR(v.amount),
          }))}
        />
        <NetProfitSimpleCard
          sales={stats.kpSalesTotal}
          purchase={stats.myPurchaseTotal}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentTable
          title="Recent KP invoices"
          rows={recentOrders}
          emptyHint="No KP invoices in this range"
          href="/dashboard/orders-v2"
        />
        <RecentTable
          title="Recent purchases"
          rows={recentPurchases}
          emptyHint="No purchases in this range"
          href="/dashboard/purchases"
        />
      </div>

    </div>
  )
}

// ----- Sub-components -----

// Mirrors the DualTileCard layout used in /dashboard/dashboard-v2 — two equal
// muted tiles side by side with a header label.
function DualTileCard({
  label,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  rightHint,
}: {
  label: string
  leftLabel: string
  leftValue: string
  rightLabel: string
  rightValue: string
  rightHint?: string
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/60 p-3">
          <div className="text-[11px] text-muted-foreground">{leftLabel}</div>
          <div className="text-lg font-bold tabular-nums">{leftValue}</div>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <div className="text-[11px] text-muted-foreground">{rightLabel}</div>
          <div className="text-lg font-bold tabular-nums">{rightValue}</div>
          {rightHint && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {rightHint}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function PayableTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "amber" | "red" | "muted"
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground"
  return (
    <div className="rounded-xl bg-muted/60 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}

function StatusBreakdownCard({
  title,
  buckets,
  formatValue,
}: {
  title: string
  buckets: StatusBucket[]
  formatValue: (b: StatusBucket) => string
}) {
  const totalCount = buckets.reduce((s, b) => s + b.count, 0)
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No data</p>
        ) : (
          <div className="space-y-2">
            {buckets.map((b) => {
              const pct = totalCount > 0 ? (b.count / totalCount) * 100 : 0
              const color = STATUS_COLORS[b.status] || STATUS_COLORS.unknown
              return (
                <div key={b.status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <Badge
                      variant="secondary"
                      className="rounded-full font-normal capitalize"
                      style={{ backgroundColor: `${color}1f`, color }}
                    >
                      {b.status}
                    </Badge>
                    <span className="text-muted-foreground tabular-nums">
                      {formatValue(b)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ===== P&L STATEMENT SUB-COMPONENTS =====
// Visual ports of the cards in pl_dashboard_v4.html. They use shadcn primitives
// so they pick up the app's theme (light/dark) instead of the mock's hard-coded
// hex colours.

// Color-coded accents for the Overview cards — gives each metric category its
// own identity (sales vs purchase vs stock etc.) at a glance instead of every
// card looking identical. `border` tints the card's left edge, `badge` styles
// the small emoji icon next to the label.
export type CardAccent =
  | "emerald" | "amber" | "violet" | "blue" | "sky" | "rose"
  | "indigo" | "teal" | "cyan" | "fuchsia" | "purple"

const ACCENT_STYLES: Record<CardAccent, { border: string; badge: string }> = {
  emerald: { border: "border-l-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  amber: { border: "border-l-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  violet: { border: "border-l-violet-500", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  blue: { border: "border-l-blue-500", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  sky: { border: "border-l-sky-500", badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  rose: { border: "border-l-rose-500", badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  indigo: { border: "border-l-indigo-500", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  teal: { border: "border-l-teal-500", badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  cyan: { border: "border-l-cyan-500", badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  fuchsia: { border: "border-l-fuchsia-500", badge: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300" },
  purple: { border: "border-l-purple-500", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
}

function CardIcon({ icon, accent }: { icon: string; accent: CardAccent }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs ${ACCENT_STYLES[accent].badge}`}
    >
      {icon}
    </span>
  )
}

function PLSection({
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

function PLArrow() {
  return (
    <div className="flex justify-center text-muted-foreground/60 -my-2">↓</div>
  )
}

function PLDualCard({
  label,
  leftLabel,
  leftValue,
  leftHint,
  rightLabel,
  rightValue,
  rightHint,
  valueTone,
  compact,
  href,
  menuOptions,
  accent,
  icon,
}: {
  label: string
  leftLabel: string
  leftValue: string
  leftHint?: string
  rightLabel: string
  rightValue: string
  rightHint?: string
  valueTone?: "red-left" | "red-right"
  compact?: boolean
  href?: string
  menuOptions?: { label: string; href: string }[]
  accent?: CardAccent
  icon?: string
}) {
  const router = useRouter()
  const leftValClass =
    valueTone === "red-left" ? "text-red-600 dark:text-red-400" : ""
  const rightValClass =
    valueTone === "red-right" ? "text-red-600 dark:text-red-400" : ""
  const cellPad = compact ? "px-3 py-2.5" : "px-4 py-3"
  const headPad = compact ? "py-2 px-3" : "py-3 px-4"
  const valSize = compact ? "text-base" : "text-xl"
  const isClickable = Boolean(href || menuOptions?.length)
  const cardBody = (
    <Card
      onClick={href ? () => router.push(href) : undefined}
      className={`rounded-xl overflow-hidden gap-0 py-0 ${accent ? `border-l-4 ${ACCENT_STYLES[accent].border}` : ""} ${isClickable ? "cursor-pointer transition-colors hover:bg-muted/40" : ""}`}
    >
      <CardHeader className={`border-b ${headPad}`}>
        <CardTitle className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">
          {accent && icon && <CardIcon icon={icon} accent={accent} />}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-0 p-0">
        <div className={`${cellPad} border-r min-w-0`}>
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 truncate">
            {leftLabel}
          </div>
          <div className={`${valSize} font-bold mt-0.5 tabular-nums ${leftValClass}`}>
            {leftValue}
          </div>
          {leftHint && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{leftHint}</div>
          )}
        </div>
        <div className={`${cellPad} min-w-0`}>
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 truncate">
            {rightLabel}
          </div>
          <div className={`${valSize} font-bold mt-0.5 tabular-nums ${rightValClass}`}>
            {rightValue}
          </div>
          {rightHint && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{rightHint}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (!menuOptions?.length) return cardBody

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{cardBody}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {menuOptions.map((opt) => (
          <DropdownMenuItem key={opt.href} onClick={() => router.push(opt.href)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PLSingleCard({
  label,
  valueLabel,
  value,
  hint,
  valueTone,
  compact,
  href,
  accent,
  icon,
}: {
  label: string
  valueLabel: string
  value: string
  hint?: string
  valueTone?: "red" | "green"
  compact?: boolean
  href?: string
  accent?: CardAccent
  icon?: string
}) {
  const router = useRouter()
  const valClass =
    valueTone === "red"
      ? "text-red-600 dark:text-red-400"
      : valueTone === "green"
        ? "text-emerald-600 dark:text-emerald-400"
        : ""
  const cellPad = compact ? "px-3 py-2.5" : "px-4 py-3"
  const headPad = compact ? "py-2 px-3" : "py-3 px-4"
  const valSize = compact ? "text-base" : "text-xl"
  return (
    <Card
      onClick={href ? () => router.push(href) : undefined}
      className={`rounded-xl overflow-hidden gap-0 py-0 ${accent ? `border-l-4 ${ACCENT_STYLES[accent].border}` : ""} ${href ? "cursor-pointer transition-colors hover:bg-muted/40" : ""}`}
    >
      <CardHeader className={`border-b ${headPad}`}>
        <CardTitle className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">
          {accent && icon && <CardIcon icon={icon} accent={accent} />}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={cellPad}>
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 truncate">
          {valueLabel}
        </div>
        <div className={`${valSize} font-bold mt-0.5 tabular-nums ${valClass}`}>
          {value}
        </div>
        {hint && (
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</div>
        )}
      </CardContent>
    </Card>
  )
}

// Overview card with a variable number of equal-width value tiles. Used for the
// Profitability › Expense (3 tiles) and GST (4 tiles) breakdowns. Ports
// /dashboard/dashboard-v2 :: MultiTileCard so the two dashboards look identical.
function OverviewMultiCard({
  label,
  tiles,
  accent,
  icon,
  href,
}: {
  label: string
  tiles: { label: string; value: string; color?: string; hint?: string }[]
  accent?: CardAccent
  icon?: string
  href?: string
}) {
  const router = useRouter()
  return (
    <Card
      onClick={href ? () => router.push(href) : undefined}
      className={`rounded-xl overflow-hidden gap-0 py-0 ${accent ? `border-l-4 ${ACCENT_STYLES[accent].border}` : ""} ${href ? "cursor-pointer transition-colors hover:bg-muted/40" : ""}`}
    >
      <CardHeader className="border-b py-2 px-3">
        <CardTitle className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-muted-foreground truncate">
          {accent && icon && <CardIcon icon={icon} accent={accent} />}
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
            {t.hint && (
              <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                {t.hint}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PLMultiCard({
  cells,
}: {
  cells: {
    label: string
    valueLabel: string
    value: string
    hint?: string
    valueTone?: "red" | "green"
  }[]
}) {
  return (
    <Card className="rounded-xl overflow-hidden gap-0 py-0">
      <CardContent className="grid grid-cols-3 gap-0 p-0">
        {cells.map((c, i) => {
          const valClass =
            c.valueTone === "red"
              ? "text-red-600 dark:text-red-400"
              : c.valueTone === "green"
                ? "text-emerald-600 dark:text-emerald-400"
                : ""
          return (
            <div
              key={i}
              className={`px-3 py-3 ${i < cells.length - 1 ? "border-r" : ""}`}
            >
              <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80 truncate">
                {c.label}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
                {c.valueLabel}
              </div>
              <div className={`text-lg font-bold mt-0.5 tabular-nums ${valClass}`}>
                {c.value}
              </div>
              {c.hint && (
                <div className="text-[10px] text-muted-foreground mt-1">{c.hint}</div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function PLResultCard({
  label,
  amount,
  rows,
  totalLabel,
  totalValue,
}: {
  label: string
  amount: string
  rows?: { label: string; value: string; tone: "red" | "green" }[]
  totalLabel?: string
  totalValue?: string
}) {
  return (
    <Card className="rounded-xl border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10">
      <CardContent className="px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground truncate">
          {label}
        </div>
        <div className="text-base font-bold mt-0.5 text-emerald-600 dark:text-emerald-400 tabular-nums">
          {amount}
        </div>
        {rows && rows.length > 0 && (
          <div className="mt-3 rounded-lg border overflow-hidden bg-background">
            {rows.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 text-xs border-b last:border-b-0"
              >
                <span className="text-muted-foreground">{r.label}</span>
                <span
                  className={
                    r.tone === "red"
                      ? "font-semibold text-red-600 dark:text-red-400"
                      : "font-semibold text-emerald-600 dark:text-emerald-400"
                  }
                >
                  {r.value}
                </span>
              </div>
            ))}
            {totalLabel && totalValue && (
              <div className="flex items-center justify-between px-3 py-2 text-xs font-bold bg-emerald-100/50 dark:bg-emerald-900/20">
                <span>{totalLabel}</span>
                <span className="text-emerald-700 dark:text-emerald-300 text-sm">
                  {totalValue}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PLMetricsCard({
  label,
  metrics,
}: {
  label: string
  metrics: { label: string; value: string; hint?: string; tone?: "green" | "red" }[]
}) {
  return (
    <Card className="rounded-xl self-start gap-0 py-0">
      <CardHeader className="border-b py-3 px-4">
        <CardTitle className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {metrics.map((m, i) => {
          const valClass =
            m.tone === "red"
              ? "text-red-600 dark:text-red-400"
              : m.tone === "green"
                ? "text-emerald-600 dark:text-emerald-400"
                : ""
          return (
            <div
              key={i}
              className={`px-4 py-3 ${i < metrics.length - 1 ? "border-b" : ""}`}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80">
                {m.label}
              </div>
              <div className={`text-xl font-bold mt-1 tabular-nums ${valClass}`}>
                {m.value}
              </div>
              {m.hint && (
                <div className="text-[10px] text-muted-foreground mt-1">{m.hint}</div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function BalanceSheetCard({
  title,
  tone,
  rows,
  totalLabel,
  totalValue,
}: {
  title: string
  tone: "blue" | "red"
  rows: { label: string; value: string; tone: "blue" | "red" | "green" }[]
  totalLabel: string
  totalValue: string
}) {
  const headColor =
    tone === "red"
      ? "text-red-700 dark:text-red-300"
      : "text-blue-700 dark:text-blue-300"
  const totalBg =
    tone === "red"
      ? "bg-red-50 dark:bg-red-950/30"
      : "bg-blue-50 dark:bg-blue-950/30"
  const totalColor =
    tone === "red"
      ? "text-red-700 dark:text-red-300"
      : "text-blue-700 dark:text-blue-300"
  return (
    <Card className="rounded-xl gap-0 py-0">
      <CardHeader className="border-b py-3 px-4">
        <CardTitle className={`text-[11px] font-bold tracking-wider uppercase ${headColor}`}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.map((r, i) => {
          const valClass =
            r.tone === "red"
              ? "text-red-600 dark:text-red-400"
              : r.tone === "green"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-blue-600 dark:text-blue-400"
          return (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-2.5 border-b text-sm"
            >
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-bold tabular-nums ${valClass}`}>{r.value}</span>
            </div>
          )
        })}
        <div className={`flex items-center justify-between px-4 py-3 ${totalBg}`}>
          <span className="font-bold text-sm">{totalLabel}</span>
          <span className={`font-extrabold tabular-nums text-base ${totalColor}`}>
            {totalValue}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// Ranked leaderboard used for both the Sales Leader (top distributors) and the
// Purchase Leader (top vendors). Generic over the row shape so the same markup
// serves both sides.
function LeaderCard({
  title,
  subtitle,
  accent,
  rows,
  emptyHint,
}: {
  title: string
  subtitle: string
  accent: "blue" | "amber"
  rows: { name: string; sub: string; value: string }[]
  emptyHint: string
}) {
  const badgeClass =
    accent === "amber"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${badgeClass}`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.sub}</div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{r.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyHint}</p>
        )}
      </CardContent>
    </Card>
  )
}

// Simple Sales − Purchase net profit card (distinct from the trading-account
// Net Profit in the P&L section above). This is the plain figure the factory
// asked to see beside the leaders.
function NetProfitSimpleCard({
  sales,
  purchase,
}: {
  sales: number
  purchase: number
}) {
  const net = sales - purchase
  const positive = net >= 0
  const cardTone = positive
    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10"
    : "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10"
  const amountTone = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400"
  return (
    <Card className={`rounded-xl ${cardTone}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Net Profit</CardTitle>
        <p className="text-xs text-muted-foreground">Sales − Purchase</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-3xl font-extrabold tabular-nums ${amountTone}`}>
          {formatINR(net)}
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sales</span>
            <span className="tabular-nums font-medium">{formatINR(sales)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Purchase</span>
            <span className="tabular-nums font-medium text-red-600 dark:text-red-400">
              − {formatINR(purchase)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentTable({
  title,
  rows,
  emptyHint,
  href,
}: {
  title: string
  rows: RecentRow[]
  emptyHint: string
  href: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Link
          href={href}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {emptyHint}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Number</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium text-right">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const color = STATUS_COLORS[r.status] || STATUS_COLORS.unknown
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium truncate max-w-[140px]">
                        {r.number}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {formatDate(r.date)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatINR(r.amount)}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="secondary"
                          className="rounded-full font-normal capitalize"
                          style={{ backgroundColor: `${color}1f`, color }}
                        >
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
