"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUserRole } from "@/hooks/use-user-role"
import { getRoleBasedRedirectPath } from "@/lib/utils/role-redirect"
import {
  Users,
  ShoppingCart,
  Package,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  IndianRupee,
  Star,
  Wallet,
  ShoppingBag,
  Store,
  Building2,
  Receipt,
  CalendarIcon,
  Banknote,
  CreditCard,
  LayoutDashboard,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DateRange } from "react-day-picker"

interface Order {
  id: string
  order_number: string
  customer_id: string
  order_status: string
  payment_status: string
  total_amount: number
  order_date: string
}

interface Product {
  id: string
  name: string
  stock: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const [stats, setStats] = useState({
    customers: 0,
    orders: 0,
    products: 0,
    tickets: 0,
    vipCustomers: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    deliveryPartners: 0,
    totalExpenses: 0,
    todayExpenses: 0,
    totalPurchases: 0,
    totalPurchaseValue: 0,
    totalPayable: 0,
    totalStock: 0,
    totalStockValue: 0,
    retailers: 0,
    distributors: 0,
    subdistributors: 0,
    vendors: 0,
    todayCashCollected: 0,
    totalCashCollected: 0,
    easebuzzCompleted: 0,
  })

  const [orderStats, setOrderStats] = useState({
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
  })

  const [paymentStats, setPaymentStats] = useState({
    pending: 0,
    completed: 0,
    failed: 0,
  })

  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [todayOrders, setTodayOrders] = useState<Order[]>([])
  const [todayOrdersCount, setTodayOrdersCount] = useState(0)
  const [todayRetailOrdersCount, setTodayRetailOrdersCount] = useState(0)
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<
    { month: string; revenue: number; orders: number }[]
  >([])
  const [chartPeriod, setChartPeriod] = useState<"monthly" | "weekly" | "daily">("weekly")
  const [gstData, setGstData] = useState({
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0,
  })
  const [gstDatePreset, setGstDatePreset] = useState("today")
  const [gstDateRange, setGstDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  })

  // Helper function to get date range from preset
  const getDateRangeFromPreset = (preset: string): { from: Date; to: Date } => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    switch (preset) {
      case "today":
        return { from: today, to: endOfToday }
      case "yesterday": {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const endYesterday = new Date(yesterday)
        endYesterday.setHours(23, 59, 59, 999)
        return { from: yesterday, to: endYesterday }
      }
      case "last7days": {
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 6)
        return { from: last7, to: endOfToday }
      }
      case "last30days": {
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        return { from: last30, to: endOfToday }
      }
      case "thisMonth": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
        return { from: firstDay, to: endOfToday }
      }
      case "lastMonth": {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
        lastDayLastMonth.setHours(23, 59, 59, 999)
        return { from: firstDayLastMonth, to: lastDayLastMonth }
      }
      default:
        return { from: today, to: endOfToday }
    }
  }

  // Check if a pincode is in Maharashtra (pincodes 400xxx to 445xxx)
  const isMaharashtraPincode = (pincode: string | null): boolean => {
    if (!pincode || pincode.length < 2) return true // Default to intra-state if unknown
    const prefix = pincode.substring(0, 2)
    return ['40', '41', '42', '43', '44'].includes(prefix)
  }

  // Fetch GST data based on date range with proper IGST calculation
  const fetchGstData = useCallback(async (fromDate: Date, toDate: Date) => {
    const fromStr = fromDate.toISOString().split('T')[0]
    const toStr = toDate.toISOString().split('T')[0]

    const { data: gstOrders } = await supabase
      .from("orders")
      .select("cgst_amount, sgst_amount, igst_amount, gst_amount, shipping_pincode, shipping_state")
      .gte("order_date", fromStr)
      .lte("order_date", toStr + "T23:59:59.999Z")

    if (gstOrders) {
      let cgst = 0
      let sgst = 0
      let igst = 0

      gstOrders.forEach((order) => {
        // Determine if this is an inter-state order (outside Maharashtra)
        const isOutsideMH = order.shipping_state
          ? order.shipping_state.toLowerCase() !== 'maharashtra'
          : !isMaharashtraPincode(order.shipping_pincode)

        if (isOutsideMH) {
          // Inter-state: all GST goes to IGST
          const orderIgst = parseFloat(String(order.igst_amount || 0)) ||
            (parseFloat(String(order.cgst_amount || 0)) + parseFloat(String(order.sgst_amount || 0))) ||
            parseFloat(String(order.gst_amount || 0)) || 0
          igst += orderIgst
        } else {
          // Intra-state: split as CGST + SGST
          const orderCgst = parseFloat(String(order.cgst_amount || 0))
          const orderSgst = parseFloat(String(order.sgst_amount || 0))

          if (orderCgst > 0 || orderSgst > 0) {
            cgst += orderCgst
            sgst += orderSgst
          } else {
            // If CGST/SGST not set but total GST is available, split 50-50
            const totalGst = parseFloat(String(order.gst_amount || 0))
            if (totalGst > 0) {
              cgst += totalGst / 2
              sgst += totalGst / 2
            }
          }
        }
      })

      setGstData({
        cgst,
        sgst,
        igst,
        total: cgst + sgst + igst,
      })
    }
  }, [])

  // Handle date preset change
  const handleDatePresetChange = (preset: string) => {
    setGstDatePreset(preset)
    if (preset !== "custom") {
      const range = getDateRangeFromPreset(preset)
      setGstDateRange({ from: range.from, to: range.to })
      fetchGstData(range.from, range.to)
    }
  }

  // Handle custom date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setGstDateRange(range)
    if (range?.from && range?.to) {
      setGstDatePreset("custom")
      fetchGstData(range.from, range.to)
    }
  }

  // Fetch GST data on mount and when date range changes
  useEffect(() => {
    const range = getDateRangeFromPreset(gstDatePreset)
    fetchGstData(range.from, range.to)
  }, [fetchGstData, gstDatePreset])

  // Redirect role-specific users to their panels
  useEffect(() => {
    if (!roleLoading && role) {
      // Only redirect if the user has a specific role panel
      if (role === 'main_distributor' || role === 'sub_distributor' ||
          role === 'retailer' || role === 'vendors' ||
          role === 'customer_support' || role === 'factories') {
        const redirectPath = getRoleBasedRedirectPath(role)
        if (redirectPath !== '/dashboard') {
          router.push(redirectPath)
        }
      }
    }
  }, [role, roleLoading, router])

  // Fetch chart data from API route (server-side aggregation, no row limit)
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const res = await fetch(`/api/chart-data?period=${chartPeriod}`)
        if (res.ok) {
          const data = await res.json()
          setMonthlyRevenueData(data)
        }
      } catch (err) {
        console.error("Failed to fetch chart data:", err)
      }
    }
    fetchChartData()
  }, [chartPeriod])

  useEffect(() => {
    const fetchStats = async () => {
      // Basic counts
      const [
        { count: customersCount },
        { count: ordersCount },
        { count: productsCount },
        { count: ticketsCount },
        { count: vipCount },
        { count: deliveryPartnersCount },
        { count: retailersCount },
        { count: vendorsCount },
      ] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("support_tickets").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }).eq("is_vip", true),
        supabase.from("delivery_partners").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("retailers").select("*", { count: "exact", head: true }),
        supabase.from("vendors").select("*", { count: "exact", head: true }),
      ])

      // Get distributor counts (separate query for parent_id filter)
      const { data: distributorsData } = await supabase
        .from("distributors")
        .select("id, parent_id")

      const distributorsCount = distributorsData?.filter(d => !d.parent_id).length || 0
      const subdistributorsCount = distributorsData?.filter(d => d.parent_id).length || 0

      setStats(prev => ({
        ...prev,
        customers: customersCount || 0,
        orders: ordersCount || 0,
        products: productsCount || 0,
        tickets: ticketsCount || 0,
        vipCustomers: vipCount || 0,
        deliveryPartners: deliveryPartnersCount || 0,
        retailers: retailersCount || 0,
        vendors: vendorsCount || 0,
        distributors: distributorsCount,
        subdistributors: subdistributorsCount,
      }))

      // Revenue calculation
      // Use local date for today (IST)
      const now = new Date()
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      // Fetch total revenue and today's revenue with separate server-side queries
      // (Supabase defaults to 1000 rows, so client-side filtering from all orders misses recent data)
      const [{ data: allRevenueData }, { data: todayRevenueData }] = await Promise.all([
        supabase.from("orders").select("total_amount"),
        supabase.from("orders").select("total_amount")
          .gte("order_date", todayLocal)
          .lt("order_date", todayLocal + "T23:59:59.999Z"),
      ])

      // For total revenue, paginate to get all orders
      let totalRevenue = (allRevenueData || []).reduce((sum, order) => sum + (parseFloat(String(order.total_amount)) || 0), 0)
      // If we got exactly 1000 rows, there are likely more - fetch remaining
      if (allRevenueData && allRevenueData.length === 1000) {
        let offset = 1000
        let hasMore = true
        while (hasMore) {
          const { data: moreOrders } = await supabase
            .from("orders")
            .select("total_amount")
            .range(offset, offset + 999)
          if (moreOrders && moreOrders.length > 0) {
            totalRevenue += moreOrders.reduce((sum, order) => sum + (parseFloat(String(order.total_amount)) || 0), 0)
            offset += moreOrders.length
            hasMore = moreOrders.length === 1000
          } else {
            hasMore = false
          }
        }
      }

      const todayRevenue = (todayRevenueData || []).reduce(
        (sum, order) => sum + (parseFloat(String(order.total_amount)) || 0), 0
      )

      setStats(prev => ({
        ...prev,
        totalRevenue,
        todayRevenue,
      }))

      // Order status breakdown
      const [
        { count: pendingOrders },
        { count: processingOrders },
        { count: shippedOrders },
        { count: deliveredOrders },
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("order_status", "pending"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("order_status", "processing"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("order_status", "shipped"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("order_status", "delivered"),
      ])

      setOrderStats({
        pending: pendingOrders || 0,
        processing: processingOrders || 0,
        shipped: shippedOrders || 0,
        delivered: deliveredOrders || 0,
      })

      // Payment status breakdown
      const [
        { count: pendingPayments },
        { count: completedPayments },
        { count: failedPayments },
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("payment_status", "pending"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("payment_status", "completed"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("payment_status", "failed"),
      ])

      setPaymentStats({
        pending: pendingPayments || 0,
        completed: completedPayments || 0,
        failed: failedPayments || 0,
      })

      // Low stock products (stock < 10)
      const { data: lowStock } = await supabase
        .from("products")
        .select("id, name, stock")
        .lt("stock", 10)
        .order("stock", { ascending: true })
        .limit(5)

      setLowStockProducts(lowStock || [])

      // Recent orders
      const { data: recent } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, order_status, payment_status, total_amount, order_date")
        .order("order_date", { ascending: false })
        .limit(5)

      setRecentOrders(recent || [])

      // Today's orders - use local date
      const nowLocal = new Date()
      const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`
      const { data: todayOrdersData, count: todayCount } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, order_status, payment_status, total_amount, order_date", { count: "exact" })
        .gte("order_date", today)
        .lt("order_date", today + "T23:59:59.999Z")
        .order("order_date", { ascending: false })
        .limit(10)

      setTodayOrders(todayOrdersData || [])
      setTodayOrdersCount(todayCount || 0)

      // Split today's orders: retail (retailer bills) vs regular (phone/normal)
      const { count: todayRetailCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("order_date", today)
        .lt("order_date", today + "T23:59:59.999Z")
        .not("retailer_id", "is", null)
      setTodayRetailOrdersCount(todayRetailCount || 0)

      // Total expenses calculation
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount")

      // Today's expenses calculation
      const todayStr = today
      const { data: todayExpensesData } = await supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", todayStr)
        .lt("expense_date", todayStr + "T23:59:59.999Z")

      if (expenses) {
        const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
        const todayExpenses = (todayExpensesData || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
        setStats(prev => ({
          ...prev,
          totalExpenses,
          todayExpenses,
        }))
      }

      // Total purchases calculation
      const { data: purchases } = await supabase
        .from("purchases")
        .select("total_amount, remaining_amount, payment_status")

      if (purchases) {
        const totalPurchases = purchases.length
        const totalPurchaseValue = purchases.reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0)
        const totalPayable = purchases
          .filter(p => p.payment_status !== 'completed')
          .reduce((sum, purchase) => sum + Number(purchase.remaining_amount || 0), 0)
        setStats(prev => ({
          ...prev,
          totalPurchases,
          totalPurchaseValue,
          totalPayable,
        }))
      }

      // Total stock calculation - same data source as /dashboard/stock
      const [{ data: stockItems }, { data: looseStockItems }] = await Promise.all([
        supabase
          .from("stock_inventory")
          .select(`
            quantity,
            price,
            product_variants!inner (
              variant_name
            ),
            packaging_materials!inner (
              material_type
            )
          `),
        supabase
          .from("loose_stock")
          .select("quantity_liters, price_per_liter")
      ])

      if (stockItems || looseStockItems) {
        // Convert packaging stock to liters using variant name
        const convertToLiters = (variantName: string, qty: number): number => {
          const v = variantName.toLowerCase()
          if (v.includes('ml')) {
            const ml = parseFloat(v.replace('ml', ''))
            return (ml / 1000) * qty
          } else if (v.includes('l') && !v.includes('m') && !v.includes('r')) {
            const liters = parseFloat(v.replace('l', '').replace('pouch', '').trim())
            return liters * qty
          } else if (v.includes('m') || v.includes('r')) {
            const value = parseFloat(v.replace('m', '').replace('r', ''))
            return value * qty
          } else if (!isNaN(parseFloat(v))) {
            const ml = parseFloat(v)
            return (ml / 1000) * qty
          }
          return 0
        }

        // Packaging stock (exclude content materials - tracked in loose_stock)
        let packagingLiters = 0
        let totalStockValue = 0
        ;(stockItems || []).forEach((item: any) => {
          const qty = parseFloat(String(item.quantity)) || 0
          const price = parseFloat(String(item.price)) || 0
          totalStockValue += qty * price
          if (item.packaging_materials?.material_type !== 'content') {
            packagingLiters += convertToLiters(item.product_variants?.variant_name || '', qty)
          }
        })

        // Loose stock (content in liters)
        let looseLiters = 0
        ;(looseStockItems || []).forEach((item: any) => {
          const qty = parseFloat(String(item.quantity_liters)) || 0
          const price = parseFloat(String(item.price_per_liter)) || 0
          looseLiters += qty
          totalStockValue += qty * price
        })

        setStats(prev => ({
          ...prev,
          totalStock: Math.round((packagingLiters + looseLiters) * 100) / 100,
          totalStockValue,
        }))
      }

      // Cash collected from delivery reviews
      const [{ data: todayCashData }, { data: allCashData }] = await Promise.all([
        supabase
          .from("delivery_reviews")
          .select("total_cash_collected")
          .eq("review_date", today),
        supabase
          .from("delivery_reviews")
          .select("total_cash_collected"),
      ])

      const todayCashCollected = (todayCashData || []).reduce(
        (sum, r) => sum + (parseFloat(String(r.total_cash_collected)) || 0), 0
      )
      let totalCashCollected = (allCashData || []).reduce(
        (sum, r) => sum + (parseFloat(String(r.total_cash_collected)) || 0), 0
      )
      // Paginate if needed
      if (allCashData && allCashData.length === 1000) {
        let offset = 1000
        let hasMore = true
        while (hasMore) {
          const { data: more } = await supabase
            .from("delivery_reviews")
            .select("total_cash_collected")
            .range(offset, offset + 999)
          if (more && more.length > 0) {
            totalCashCollected += more.reduce(
              (sum, r) => sum + (parseFloat(String(r.total_cash_collected)) || 0), 0
            )
            offset += more.length
            hasMore = more.length === 1000
          } else {
            hasMore = false
          }
        }
      }

      setStats(prev => ({
        ...prev,
        todayCashCollected,
        totalCashCollected,
      }))

      // Easebuzz completed amount (online payments)
      const { data: easebuzzData } = await supabase
        .from("orders")
        .select("total_amount")
        .not("easebuzz_txn_id", "is", null)
        .eq("payment_status", "completed")

      let easebuzzCompleted = (easebuzzData || []).reduce(
        (sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0
      )
      if (easebuzzData && easebuzzData.length === 1000) {
        let offset = 1000
        let hasMore = true
        while (hasMore) {
          const { data: more } = await supabase
            .from("orders")
            .select("total_amount")
            .not("easebuzz_txn_id", "is", null)
            .eq("payment_status", "completed")
            .range(offset, offset + 999)
          if (more && more.length > 0) {
            easebuzzCompleted += more.reduce(
              (sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0
            )
            offset += more.length
            hasMore = more.length === 1000
          } else {
            hasMore = false
          }
        }
      }

      setStats(prev => ({
        ...prev,
        easebuzzCompleted,
      }))
    }

    fetchStats()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      shipped: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    }
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome to your supply chain portal</p>
        </div>
      </div>

      {/* Today's Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Today&apos;s Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/orders" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
              <CardHeader>
                <CardDescription>Today&apos;s Revenue</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
                  {formatCurrency(stats.todayRevenue)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Revenue today
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/orders" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Today&apos;s Orders</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {todayOrdersCount}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{todayRetailOrdersCount}</span> retail ·{" "}
                <span className="font-medium text-foreground">{Math.max(0, todayOrdersCount - todayRetailOrdersCount)}</span> regular
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/delivery-reviewer" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
              <CardHeader>
                <CardDescription>Today&apos;s Cash Collected</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
                  {formatCurrency(stats.todayCashCollected)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                    <Banknote className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Cash from deliveries today
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/expenses" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
              <CardHeader>
                <CardDescription>Today&apos;s Expenses</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">
                  {formatCurrency(stats.todayExpenses)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                    <Receipt className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Expenses today
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Total Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Overall Summary</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/orders" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Total Revenue</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
                  {formatCurrency(stats.totalRevenue)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                All time revenue
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/purchases" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Purchase Value</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {formatCurrency(stats.totalPurchaseValue)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Total purchase amount
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/easebuzz-transactions" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
              <CardHeader>
                <CardDescription>Online Payments</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
                  {formatCurrency(stats.easebuzzCompleted)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Easebuzz completed amount
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/delivery-reviewer" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
              <CardHeader>
                <CardDescription>Total Cash Collected</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
                  {formatCurrency(stats.totalCashCollected)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                    <Banknote className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                All time cash from deliveries
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/expenses" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
              <CardHeader>
                <CardDescription>Total Expenses</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">
                  {formatCurrency(stats.totalExpenses)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                    <Wallet className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                All business expenses
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/purchases" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full bg-red-50/60 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/40">
              <CardHeader>
                <CardDescription>Total Payable</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-500">
                  {formatCurrency(stats.totalPayable)}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-500">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Outstanding purchase payments
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/stock" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Total Stock</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.totalStock.toLocaleString()} Ltrs
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Package className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Value: {formatCurrency(stats.totalStockValue)}
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/orders" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Total Orders</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.orders}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {orderStats.pending} pending orders
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/customers" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Total Customers</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.customers}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Users className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {stats.vipCustomers} VIP customers
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/products" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Total Products</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.products}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Package className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {lowStockProducts.length} low stock items
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/tickets" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Support Tickets</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.tickets}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Total tickets
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/delivery-partners" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Delivery Partners</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.deliveryPartners}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Truck className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Active partners
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/retailers" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Total Retailers</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.retailers}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Store className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Registered retailers
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/distributors" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Distributors</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.distributors}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {stats.subdistributors} subdistributors
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/vendors" className="transition-transform hover:scale-[1.02]">
            <Card className="cursor-pointer h-full">
              <CardHeader>
                <CardDescription>Total Vendors</CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {stats.vendors}
                </CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Supply vendors
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Revenue & Orders Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Revenue & Orders
          </CardTitle>
          <CardAction>
            <Select value={chartPeriod} onValueChange={(v: "monthly" | "weekly" | "daily") => setChartPeriod(v)}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          {monthlyRevenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthlyRevenueData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    value >= 100000
                      ? `₹${(value / 100000).toFixed(1)}L`
                      : value >= 1000
                      ? `₹${(value / 1000).toFixed(0)}K`
                      : `₹${value}`
                  }
                />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value?: number, name?: string) => [
                    name === "revenue"
                      ? new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(value ?? 0)
                      : (value ?? 0),
                    name === "revenue" ? "Revenue" : "Orders",
                  ]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="orders" name="Orders" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Loading chart data...</p>
          )}
        </CardContent>
      </Card>

      {/* GST Summary with Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            GST Summary
          </CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <Select value={gstDatePreset} onValueChange={handleDatePresetChange}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 justify-start text-left font-normal",
                      !gstDateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {gstDateRange?.from ? (
                      gstDateRange.to ? (
                        <>
                          {format(gstDateRange.from, "dd MMM")} - {format(gstDateRange.to, "dd MMM yyyy")}
                        </>
                      ) : (
                        format(gstDateRange.from, "dd MMM yyyy")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    defaultMonth={gstDateRange?.from}
                    selected={gstDateRange}
                    onSelect={handleDateRangeChange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  CGST
                </span>
              </div>
              <p className="text-2xl font-bold leading-none tabular-nums">{formatCurrency(gstData.cgst)}</p>
              <p className="text-xs text-muted-foreground mt-2">Central GST</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  SGST
                </span>
              </div>
              <p className="text-2xl font-bold leading-none tabular-nums">{formatCurrency(gstData.sgst)}</p>
              <p className="text-xs text-muted-foreground mt-2">State GST</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  IGST
                </span>
              </div>
              <p className="text-2xl font-bold leading-none tabular-nums">{formatCurrency(gstData.igst)}</p>
              <p className="text-xs text-muted-foreground mt-2">Integrated GST</p>
            </div>

            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/80">
                  Total
                </span>
              </div>
              <p className="text-2xl font-bold leading-none tabular-nums text-primary">{formatCurrency(gstData.total)}</p>
              <p className="text-xs text-primary/70 mt-2">CGST + SGST + IGST</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order & Payment Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/orders" className="transition-transform hover:scale-[1.01]">
          <Card className="cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                Order Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{orderStats.pending}</span>
              </div>
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium">Processing</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{orderStats.processing}</span>
              </div>
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-500">
                    <Truck className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium">Shipped</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{orderStats.shipped}</span>
              </div>
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium">Delivered</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{orderStats.delivered}</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/orders" className="transition-transform hover:scale-[1.01]">
          <Card className="cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{paymentStats.pending}</span>
              </div>
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium">Completed</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{paymentStats.completed}</span>
              </div>
              <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-500">
                    <XCircle className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium">Failed</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{paymentStats.failed}</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            Today&apos;s Orders
            <Badge variant="secondary" className="tabular-nums">{todayOrdersCount}</Badge>
          </CardTitle>
          <CardAction>
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View All
              <span aria-hidden="true">→</span>
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {todayOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
                <ShoppingCart className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-sm font-medium">No orders placed today</p>
              <p className="text-xs">New orders will appear here</p>
            </div>
          ) : (
            <div className="space-y-1">
              {todayOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium font-mono truncate">{order.order_number}</div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(order.order_date).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(Number(order.total_amount))}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                      {order.order_status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                      {order.payment_status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alerts & Recent Orders */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/products" className="transition-transform hover:scale-[1.01]">
          <Card className="cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Low Stock Alert
                {lowStockProducts.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1.5 tabular-nums">
                    {lowStockProducts.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-500 mb-2">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">All stock healthy</p>
                  <p className="text-xs">No low stock items</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {lowStockProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
                          product.stock === 0
                            ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-500"
                            : "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500"
                        )}>
                          <Package className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm truncate">{product.name}</span>
                      </div>
                      <Badge
                        variant={product.stock === 0 ? "destructive" : "secondary"}
                        className="text-[10px] h-5 px-2 shrink-0 tabular-nums"
                      >
                        {product.stock} left
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/orders" className="transition-transform hover:scale-[1.01]">
          <Card className="cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
                    <ShoppingCart className="h-5 w-5 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">No recent orders</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium font-mono truncate">{order.order_number}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(Number(order.total_amount))}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize shrink-0">
                        {order.order_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
