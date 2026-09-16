"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { QuickActions } from "@/components/panel/quick-actions"
import { RecentActivity } from "@/components/panel/recent-activity"
import { AnnouncementsBanner } from "@/components/distributor/announcements-banner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Package,
  Users,
  ShoppingBag,
  IndianRupee,
  Route,
  PackagePlus,
  AlertCircle,
  Clock,
  Truck,
  CheckCircle,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

type DatePreset =
  | "today"
  | "thisWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisFY"
  | "lastFY"
  | "allTime"

interface TrendPoint {
  month: string
  orders: number
  revenue: number
}

interface MonthlyPoint {
  month: string
  key: string
  orders: number
  sales: number
  purchases: number
}

// Indian Fiscal Year runs April 1 -> March 31.
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

export default function DistributorPanel() {
  const router = useRouter()
  const { role, userProfile, loading: roleLoading } = useUserRole()
  const {
    entityId,
    entityName,
    loading: entityLoading,
    error: entityError,
  } = useEntityData()

  const [datePreset, setDatePreset] = useState<DatePreset>("thisFY")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [stats, setStats] = useState({
    salesTotal: 0,
    salesToday: 0,
    purchaseTotal: 0,
    purchaseToday: 0,
    stockValue: 0,
    stockSKUs: 0,
    lowStockItems: 0,
    ordersTotal: 0,
    ordersPending: 0,
    ordersToday: 0,
    retailersTotal: 0,
    retailersActive: 0,
    myCustomers: 0,
    productsCount: 0,
    vendorsCount: 0,
    pendingFulfillment: 0,
    pendingFulfillmentAmount: 0,
    activeRoutes: 0,
    monthlyGrowth: 0,
  })

  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [monthlyFY, setMonthlyFY] = useState<MonthlyPoint[]>([])
  const [monthlyFYLabel, setMonthlyFYLabel] = useState("")
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [orderStats, setOrderStats] = useState({
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
  })

  // Check if user has distributor role
  useEffect(() => {
    if (
      !roleLoading &&
      role !== "main_distributor" &&
      role !== "sub_distributor"
    ) {
      router.push("/dashboard")
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
          start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
          start.setHours(0, 0, 0, 0)
          return { from: start, to: endOfToday }
        }
        case "thisMonth":
          return {
            from: new Date(now.getFullYear(), now.getMonth(), 1),
            to: endOfToday,
          }
        case "lastMonth": {
          const end = new Date(now.getFullYear(), now.getMonth(), 0)
          end.setHours(23, 59, 59, 999)
          return {
            from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            to: end,
          }
        }
        case "thisFY":
          return { from: getFiscalYearRange(0).start, to: endOfToday }
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

  const todayRange = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return { startIso: start.toISOString(), endIso: end.toISOString() }
  }, [])

  // Fetch all dashboard data
  useEffect(() => {
    if (!entityId || entityLoading || roleLoading) return
    if (role !== "main_distributor" && role !== "sub_distributor") return

    const load = async () => {
      setLoading(true)
      setLoadError(null)
      const { from, to } = getDateRange(datePreset)
      const fromIso = from ? from.toISOString() : null
      const toIso = to.toISOString()

      try {
        // ---- ORDERS (via retailers linked to this distributor) ----
        let ordersQuery = supabase
          .from("orders")
          .select(
            "id, order_number, total_amount, order_status, created_at, order_date, retailers!inner(name, distributor_id)"
          )
          .eq("retailers.distributor_id", entityId)
        if (fromIso) ordersQuery = ordersQuery.gte("order_date", fromIso)
        ordersQuery = ordersQuery
          .lte("order_date", toIso)
          .order("created_at", { ascending: false })
        const { data: allOrdersData, error: ordersErr } = await ordersQuery
        if (ordersErr) throw ordersErr

        const allOrders = (allOrdersData || []).map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          retailer_name: o.retailers?.name || "Unknown",
          total_amount: o.total_amount,
          status: o.order_status,
          created_at: o.created_at,
          order_date: o.order_date,
        }))

        // Today's orders
        const { data: todayOrdersData } = await supabase
          .from("orders")
          .select(
            "id, total_amount, retailers!inner(distributor_id)"
          )
          .eq("retailers.distributor_id", entityId)
          .gte("order_date", todayRange.startIso)
          .lte("order_date", todayRange.endIso)

        const salesTotal = allOrders.reduce(
          (s: number, o: any) =>
            s + (parseFloat(String(o.total_amount)) || 0),
          0
        )
        const salesToday = (todayOrdersData || []).reduce(
          (s: number, o: any) =>
            s + (parseFloat(String(o.total_amount)) || 0),
          0
        )
        const ordersTotal = allOrders.length
        const ordersToday = todayOrdersData?.length || 0
        const ordersPending = allOrders.filter(
          (o: any) => o.status === "pending"
        ).length

        setOrderStats({
          pending: ordersPending,
          processing: allOrders.filter(
            (o: any) => o.status === "processing"
          ).length,
          shipped: allOrders.filter(
            (o: any) => o.status === "shipped"
          ).length,
          delivered: allOrders.filter(
            (o: any) => o.status === "delivered"
          ).length,
        })
        setRecentOrders(allOrders.slice(0, 5))

        // Monthly growth
        const now = new Date()
        const currentMonthStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        )
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        )
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        const currentMonthRevenue = allOrders
          .filter(
            (o: any) => new Date(o.created_at) >= currentMonthStart
          )
          .reduce(
            (s: number, o: any) =>
              s + (parseFloat(String(o.total_amount)) || 0),
            0
          )
        const lastMonthRevenue = allOrders
          .filter((o: any) => {
            const d = new Date(o.created_at)
            return d >= lastMonthStart && d <= lastMonthEnd
          })
          .reduce(
            (s: number, o: any) =>
              s + (parseFloat(String(o.total_amount)) || 0),
            0
          )
        const monthlyGrowth =
          lastMonthRevenue > 0
            ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) *
              100
            : 0

        // ---- PURCHASES ----
        let purchQuery = supabase
          .from("purchases")
          .select("total_amount, purchase_date")
          .eq("distributor_id", entityId)
        if (fromIso) purchQuery = purchQuery.gte("purchase_date", fromIso)
        purchQuery = purchQuery.lte("purchase_date", toIso)
        const { data: purchData, error: purchErr } = await purchQuery
        if (purchErr) throw purchErr
        const purchaseTotal = (purchData || []).reduce(
          (s: number, p: any) =>
            s + (parseFloat(String(p.total_amount)) || 0),
          0
        )

        const { data: todayPurch } = await supabase
          .from("purchases")
          .select("total_amount")
          .eq("distributor_id", entityId)
          .gte("purchase_date", todayRange.startIso)
          .lte("purchase_date", todayRange.endIso)
        const purchaseToday = (todayPurch || []).reduce(
          (s: number, p: any) =>
            s + (parseFloat(String(p.total_amount)) || 0),
          0
        )

        // ---- STOCK ----
        const { data: godownsData } = await supabase
          .from("godowns")
          .select("id")
          .eq("distributor_id", entityId)
          .eq("is_active", true)
        let stockValue = 0,
          lowStockItems = 0,
          totalSKUs = 0
        if (godownsData && godownsData.length > 0) {
          const godownIds = godownsData.map((g) => g.id)
          const { data: stockData } = await supabase
            .from("godown_stock")
            .select("quantity, stock_inventory!inner(price)")
            .in("godown_id", godownIds)
          totalSKUs = stockData?.length || 0
          stockData?.forEach((item: any) => {
            const q = item.quantity || 0
            const p = parseFloat(item.stock_inventory?.price) || 0
            stockValue += q * p
            if (q > 0 && q < 10) lowStockItems++
          })
        }

        // ---- RETAILERS ----
        const { data: retailersData } = await supabase
          .from("retailers")
          .select("id, name, company_name, is_active, created_at")
          .eq("distributor_id", entityId)
          .order("created_at", { ascending: false })
        const retailersTotal = retailersData?.length || 0
        const retailersActive =
          retailersData?.filter((r) => r.is_active).length || 0

        // ---- PARALLEL COUNTS ----
        const [{ count: productsCount }, { count: vendorsCount }] =
          await Promise.all([
            supabase
              .from("products")
              .select("*", { count: "exact", head: true }),
            supabase
              .from("vendors")
              .select("*", { count: "exact", head: true }),
          ])

        // ---- MY CUSTOMERS ----
        let myCustomers = 0
        try {
          const res = await fetch(
            `/api/distributor-customers?distributor_id=${entityId}&page=1&per_page=1`
          )
          if (res.ok) {
            const data = await res.json()
            myCustomers = data.total || 0
          }
        } catch {
          /* ignore */
        }

        // ---- MAIN DISTRIBUTOR EXTRAS ----
        let pendingFulfillment = 0,
          pendingFulfillmentAmount = 0,
          activeRoutes = 0
        if (role === "main_distributor") {
          const pendingOrders = allOrders.filter(
            (o: any) =>
              o.status !== "delivered" && o.status !== "cancelled"
          )
          pendingFulfillment = pendingOrders.length
          pendingFulfillmentAmount = pendingOrders.reduce(
            (s: number, o: any) =>
              s + (parseFloat(String(o.total_amount)) || 0),
            0
          )
          const { count: routesCount } = await supabase
            .from("routes")
            .select("*", { count: "exact", head: true })
          activeRoutes = routesCount || 0
        }

        // ---- ACTIVITIES ----
        const recentActivities = [
          ...(retailersData || []).slice(0, 3).map((r: any) => ({
            id: `retailer-${r.id}`,
            type: "profile" as const,
            title: `New retailer: ${r.name}`,
            description: r.company_name,
            timestamp: r.created_at,
            status: "success" as const,
          })),
          ...allOrders.slice(0, 3).map((o: any) => ({
            id: `order-${o.id}`,
            type: "order" as const,
            title: `Order #${o.order_number}`,
            description: `${o.retailer_name} - ₹${o.total_amount}`,
            timestamp: o.created_at,
            status:
              o.status === "delivered"
                ? ("success" as const)
                : ("info" as const),
          })),
        ]
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime()
          )
          .slice(0, 5)
        setActivities(recentActivities)

        setStats({
          salesTotal,
          salesToday,
          purchaseTotal,
          purchaseToday,
          stockValue: Math.round(stockValue),
          stockSKUs: totalSKUs,
          lowStockItems,
          ordersTotal,
          ordersPending,
          ordersToday,
          retailersTotal,
          retailersActive,
          myCustomers,
          productsCount: productsCount || 0,
          vendorsCount: vendorsCount || 0,
          pendingFulfillment,
          pendingFulfillmentAmount,
          activeRoutes,
          monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
        })

        // ---- FY MONTHLY BREAKDOWN ----
        const breakdownFY =
          datePreset === "lastFY"
            ? getFiscalYearRange(-1)
            : getFiscalYearRange(0)
        setMonthlyFYLabel(breakdownFY.label)

        const { data: fyOrdersData } = await supabase
          .from("orders")
          .select(
            "id, total_amount, order_date, retailers!inner(distributor_id)"
          )
          .eq("retailers.distributor_id", entityId)
          .gte("order_date", breakdownFY.start.toISOString())
          .lte("order_date", breakdownFY.end.toISOString())

        const { data: fyPurchData } = await supabase
          .from("purchases")
          .select("total_amount, purchase_date")
          .eq("distributor_id", entityId)
          .gte("purchase_date", breakdownFY.start.toISOString())
          .lte("purchase_date", breakdownFY.end.toISOString())

        // Seed 12 FY months (Apr -> Mar)
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
          })
        }

        ;(fyOrdersData || []).forEach((o: any) => {
          const d = new Date(o.order_date)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          const bucket = fyMap.get(key)
          if (bucket) {
            bucket.orders += 1
            bucket.sales += parseFloat(String(o.total_amount)) || 0
          }
        })

        ;(fyPurchData || []).forEach((p: any) => {
          const d = new Date(p.purchase_date)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          const bucket = fyMap.get(key)
          if (bucket) {
            bucket.purchases += parseFloat(String(p.total_amount)) || 0
          }
        })

        const monthly = Array.from(fyMap.values())
        setMonthlyFY(monthly)
        setTrend(
          monthly.map((m) => ({
            month: m.month,
            orders: m.orders,
            revenue: Math.round(m.sales),
          }))
        )

        setLoading(false)
      } catch (err: any) {
        console.error("Distributor dashboard load error:", err)
        setLoadError(
          err?.message || String(err) || "Failed to load dashboard"
        )
        setLoading(false)
      }
    }

    load()
  }, [entityId, entityLoading, roleLoading, role, datePreset, getDateRange, todayRange])

  const quickActions = [
    {
      title: "Create Order",
      description: "Place a new order",
      icon: PackagePlus,
      href: "/dashboard/orders/new",
    },
    {
      title: "View My Stock",
      description: "Check inventory levels",
      icon: Package,
      href: "/dashboard/my-stock",
    },
    {
      title: "My Customers",
      description: "View customer list",
      icon: Users,
      href: "/dashboard/my-customers",
    },
    {
      title: "New Purchase",
      description: "Create purchase order",
      icon: ShoppingBag,
      href: "/dashboard/purchases/new",
    },
    ...(role === "main_distributor"
      ? [
          {
            title: "Payment Collection",
            description: "Collect pending payments",
            icon: IndianRupee,
            href: "/dashboard/payment-collection",
          },
          {
            title: "Route Assignments",
            description: "Manage delivery routes",
            icon: Route,
            href: "/dashboard/route-assignments",
          },
        ]
      : []),
  ]

  const formatINR = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`
    return `₹${Math.round(amount)}`
  }

  const formatNumber = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0)

  // Loading state
  if (roleLoading || entityLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Entity error
  if (entityError) {
    return (
      <div>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Account Setup Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {entityError}. Your user account is not linked to a distributor
              profile. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {entityName}</h1>
          <p className="text-sm text-muted-foreground">
            Distributor Dashboard — Real-time overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={datePreset}
            onValueChange={(v) => setDatePreset(v as DatePreset)}
          >
            <SelectTrigger className="w-[160px] h-9 rounded-full">
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
          <Badge
            variant="outline"
            className="text-xs font-medium px-3 py-1"
          >
            {role === "main_distributor"
              ? "Main Distributor"
              : "Sub Distributor"}
          </Badge>
        </div>
      </div>

      {/* Announcements */}
      <AnnouncementsBanner userId={userProfile?.id} />

      {loading && (
        <div className="text-sm text-muted-foreground">
          Loading metrics...
        </div>
      )}
      {loadError && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          Failed to load dashboard data: {loadError}
        </div>
      )}

      {/* Row 1 — Sales / Purchases / Stock / Orders (dual-tile cards) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DualTileCard
          label="SALES"
          leftLabel="Total"
          leftValue={formatINR(stats.salesTotal)}
          rightLabel="Today"
          rightValue={formatINR(stats.salesToday)}
          rightHint="Current day"
        />
        <DualTileCard
          label="PURCHASES"
          leftLabel="Total"
          leftValue={formatINR(stats.purchaseTotal)}
          rightLabel="Today"
          rightValue={formatINR(stats.purchaseToday)}
          rightHint="Current day"
        />
        <DualTileCard
          label="STOCK"
          leftLabel="Value"
          leftValue={formatINR(stats.stockValue)}
          rightLabel="SKUs"
          rightValue={formatNumber(stats.stockSKUs)}
          rightHint={`${stats.lowStockItems} low stock`}
        />
        <DualTileCard
          label="ORDERS"
          leftLabel="Total"
          leftValue={formatNumber(stats.ordersTotal)}
          rightLabel="Pending"
          rightValue={formatNumber(stats.ordersPending)}
          rightHint={`${stats.ordersToday} today`}
        />
      </div>

      {/* Row 2 — Retailers / Customers + main_distributor extras */}
      <div
        className={`grid gap-4 ${role === "main_distributor" ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2"}`}
      >
        <DualTileCard
          label="RETAILERS"
          leftLabel="Total"
          leftValue={formatNumber(stats.retailersTotal)}
          rightLabel="Active"
          rightValue={formatNumber(stats.retailersActive)}
        />
        <DualTileCard
          label="MY NETWORK"
          leftLabel="Customers"
          leftValue={formatNumber(stats.myCustomers)}
          rightLabel="Growth"
          rightValue={`${stats.monthlyGrowth >= 0 ? "+" : ""}${stats.monthlyGrowth}%`}
          rightHint="vs last month"
        />
        {role === "main_distributor" && (
          <>
            <DualTileCard
              label="PENDING FULFILLMENT"
              leftLabel="Orders"
              leftValue={formatNumber(stats.pendingFulfillment)}
              rightLabel="Value"
              rightValue={formatINR(stats.pendingFulfillmentAmount)}
            />
            <DualTileCard
              label="ROUTES & COLLECTIONS"
              leftLabel="Routes"
              leftValue={formatNumber(stats.activeRoutes)}
              rightLabel="Pending"
              rightValue={formatNumber(stats.ordersPending)}
              rightHint="Collections due"
            />
          </>
        )}
      </div>

      {/* Row 3 — Plain stats: Products / Vendors / Low Stock Items */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <PlainStat
          label="PRODUCTS"
          value={formatNumber(stats.productsCount)}
          hint="Available catalog"
        />
        <PlainStat
          label="VENDORS"
          value={formatNumber(stats.vendorsCount)}
          hint="Supply vendors"
        />
        <PlainStat
          label="LOW STOCK"
          value={formatNumber(stats.lowStockItems)}
          hint="Items need reordering"
          valueClass={stats.lowStockItems > 0 ? "text-orange-600" : ""}
        />
        <PlainStat
          label="MONTHLY GROWTH"
          value={`${stats.monthlyGrowth >= 0 ? "+" : ""}${stats.monthlyGrowth}%`}
          hint="Revenue vs last month"
          valueClass={stats.monthlyGrowth < 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      {/* Order Status Breakdown */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground">
            ORDER STATUS BREAKDOWN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-yellow-50 dark:bg-yellow-950/30 p-3 text-center">
              <Clock className="h-4 w-4 text-yellow-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">
                {orderStats.pending}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Pending
              </div>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
              <Package className="h-4 w-4 text-blue-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {orderStats.processing}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Processing
              </div>
            </div>
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 p-3 text-center">
              <Truck className="h-4 w-4 text-purple-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-purple-700 dark:text-purple-400">
                {orderStats.shipped}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Shipped
              </div>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-3 text-center">
              <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-green-700 dark:text-green-400">
                {orderStats.delivered}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Delivered
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend chart — monthly trend across the fiscal year */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            Orders vs Revenue — monthly trend
            {monthlyFYLabel && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({monthlyFYLabel})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={trend}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="opacity-30"
                />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Orders",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11 },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) =>
                    v >= 100000
                      ? `₹${(v / 100000).toFixed(0)}L`
                      : v >= 1000
                        ? `₹${(v / 1000).toFixed(0)}K`
                        : `₹${v}`
                  }
                />
                <Tooltip
                  formatter={(value?: number, name?: string) => [
                    name === "Revenue" ? formatINR(value ?? 0) : (value ?? 0),
                    name === "Revenue" ? "Revenue" : "Orders",
                  ]}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Loading chart data..." : "No data available"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Monthly breakdown — annual report per FY month */}
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
        </CardHeader>
        <CardContent>
          {monthlyFY.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Month</th>
                    <th className="py-2 pr-4 font-medium text-right">
                      Orders
                    </th>
                    <th className="py-2 pr-4 font-medium text-right">
                      Sales
                    </th>
                    <th className="py-2 pr-4 font-medium text-right">
                      Purchases
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyFY.map((m) => (
                    <tr key={m.key} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{m.month}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {m.orders.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatINR(m.sales)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatINR(m.purchases)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="pt-3 pr-4">Total</td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      {monthlyFY
                        .reduce((s, m) => s + m.orders, 0)
                        .toLocaleString()}
                    </td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      {formatINR(
                        monthlyFY.reduce((s, m) => s + m.sales, 0)
                      )}
                    </td>
                    <td className="pt-3 pr-4 text-right tabular-nums">
                      {formatINR(
                        monthlyFY.reduce((s, m) => s + m.purchases, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Loading monthly data..." : "No data available"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground">
            RECENT ORDERS
          </CardTitle>
          <Link
            href="/dashboard/orders"
            className="text-xs text-primary hover:underline"
          >
            View All
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent orders
            </p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="flex items-center justify-between rounded-xl bg-muted/60 p-3 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {order.order_number}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.retailer_name} &middot;{" "}
                      {format(new Date(order.created_at), "dd MMM yyyy")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-sm font-bold">
                      {formatCurrency(Number(order.total_amount))}
                    </span>
                    <Badge
                      variant={
                        order.status === "delivered"
                          ? "default"
                          : order.status === "pending"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {order.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions + Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <QuickActions actions={quickActions} />
        </div>
        <div className="lg:col-span-3">
          <RecentActivity activities={activities} />
        </div>
      </div>
    </div>
  )
}

// ----- Reusable sub-components (matching dashboard-v2 style) -----

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
          <div className="text-lg font-bold">{leftValue}</div>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <div className="text-[11px] text-muted-foreground">
            {rightLabel}
          </div>
          <div className="text-lg font-bold">{rightValue}</div>
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
    <div className="p-1">
      <div className="text-xs font-semibold tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-3xl font-bold mt-2 ${valueClass || ""}`}>
        {value}
      </div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      )}
    </div>
  )
}
