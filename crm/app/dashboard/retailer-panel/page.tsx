"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { MetricCard } from "@/components/panel/metric-card"
import { QuickActions } from "@/components/panel/quick-actions"
import { RecentActivity } from "@/components/panel/recent-activity"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Plus,
  Eye,
  FileText,
  Download,
  Users,
  CreditCard,
  BarChart3,
  ShoppingBag,
  Receipt,
  Calculator,
  Search,
  Filter,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Boxes,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  IndianRupee
} from "lucide-react"
import { format } from "date-fns"

interface DashboardMetrics {
  totalOrders: number
  pendingOrders: number
  totalSales: number
  todaySales: number
  todayOrderCount: number
  pendingBillCount: number
  monthlyGrowth: number
  totalCustomers: number
  activeCustomers: number
  stockValue: number
  lowStockItems: number
  outstandingPayment: number
  creditLimit: number
  creditUsed: number
}

interface Product {
  id: string
  name: string
  category: string
  price: number
  stock_quantity: number
  unit: string
}

interface Customer {
  id: string
  name: string
  phone: string
  total_purchases: number
  last_order_date: string
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  total_amount: number
  status: string
  payment_status: string
  created_at: string
}

export default function RetailerPanel() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityName, entityDetails, loading: entityLoading, error: entityError } = useEntityData()

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalOrders: 0,
    pendingOrders: 0,
    totalSales: 0,
    todaySales: 0,
    todayOrderCount: 0,
    pendingBillCount: 0,
    monthlyGrowth: 0,
    totalCustomers: 0,
    activeCustomers: 0,
    stockValue: 0,
    lowStockItems: 0,
    outstandingPayment: 0,
    creditLimit: 0,
    creditUsed: 0
  })

  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [todayOrders, setTodayOrders] = useState<Order[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)

  const [orderStatusBreakdown, setOrderStatusBreakdown] = useState({
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
  })
  const [paymentStatusBreakdown, setPaymentStatusBreakdown] = useState({
    pending: 0,
    completed: 0,
    failed: 0,
  })
  const [gstData, setGstData] = useState({ cgst: 0, sgst: 0, igst: 0, total: 0 })
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [chartData, setChartData] = useState<{ label: string; revenue: number; orders: number }[]>([])
  const [allOrdersCache, setAllOrdersCache] = useState<any[]>([])

  // Check if user has retailer role
  useEffect(() => {
    if (!roleLoading && role !== 'retailer') {
      router.push('/dashboard')
    }
  }, [role, roleLoading, router])

  // Compute revenue/orders chart data from cached orders whenever the period changes.
  useEffect(() => {
    if (allOrdersCache.length === 0) {
      setChartData([])
      return
    }

    const buckets = new Map<string, { revenue: number; orders: number; sortKey: string }>()
    const now = new Date()

    if (chartPeriod === 'daily') {
      // Last 14 days
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        d.setHours(0, 0, 0, 0)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        buckets.set(key, { revenue: 0, orders: 0, sortKey: key })
      }
      allOrdersCache.forEach((o: any) => {
        const d = new Date(o.order_date || o.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const b = buckets.get(key)
        if (b) {
          b.revenue += Number(o.total_amount || 0)
          b.orders += 1
        }
      })
    } else if (chartPeriod === 'weekly') {
      // Last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i * 7)
        const day = d.getDay()
        const monday = new Date(d)
        monday.setDate(d.getDate() - ((day + 6) % 7))
        monday.setHours(0, 0, 0, 0)
        const key = `${monday.getFullYear()}-W${String(Math.ceil((((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(monday.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0')}`
        buckets.set(key, { revenue: 0, orders: 0, sortKey: monday.toISOString() })
      }
      allOrdersCache.forEach((o: any) => {
        const d = new Date(o.order_date || o.created_at)
        const day = d.getDay()
        const monday = new Date(d)
        monday.setDate(d.getDate() - ((day + 6) % 7))
        monday.setHours(0, 0, 0, 0)
        const key = `${monday.getFullYear()}-W${String(Math.ceil((((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(monday.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0')}`
        const b = buckets.get(key)
        if (b) {
          b.revenue += Number(o.total_amount || 0)
          b.orders += 1
        }
      })
    } else {
      // Monthly: last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        buckets.set(key, { revenue: 0, orders: 0, sortKey: key })
      }
      allOrdersCache.forEach((o: any) => {
        const d = new Date(o.order_date || o.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const b = buckets.get(key)
        if (b) {
          b.revenue += Number(o.total_amount || 0)
          b.orders += 1
        }
      })
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const data = Array.from(buckets.entries())
      .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
      .map(([key, value]) => {
        let label = key
        if (chartPeriod === 'daily') {
          const [, m, d] = key.split('-')
          label = `${d}/${m}`
        } else if (chartPeriod === 'monthly') {
          const [, m] = key.split('-')
          label = monthNames[parseInt(m, 10) - 1]
        } else {
          // weekly: show as "DD MMM" of the Monday
          const monday = new Date(value.sortKey)
          label = `${String(monday.getDate()).padStart(2, '0')} ${monthNames[monday.getMonth()]}`
        }
        return { label, revenue: value.revenue, orders: value.orders }
      })

    setChartData(data)
  }, [chartPeriod, allOrdersCache])

  // Fetch dashboard data
  useEffect(() => {
    if (!entityId || entityLoading) return

    const fetchDashboardData = async () => {
      try {
        setLoading(true)

        // 1. Product catalog (top 20 by name) — used for the Products tab.
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name, customer_price, stock, parent_category_id')
          .eq('is_active', true)
          .order('name')
          .limit(20)

        if (productsError) {
          console.error('Products error:', productsError)
        }

        // Resolve category names in a single follow-up query.
        const categoryIds = Array.from(
          new Set((productsData || []).map((p: any) => p.parent_category_id).filter(Boolean))
        )
        let categoryMap = new Map<string, string>()
        if (categoryIds.length > 0) {
          const { data: categoriesData } = await supabase
            .from('categories')
            .select('id, category_name')
            .in('id', categoryIds)
          categoryMap = new Map(
            (categoriesData || []).map((c: any) => [c.id, c.category_name])
          )
        }

        const fetchedProducts: Product[] = (productsData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.parent_category_id
            ? categoryMap.get(p.parent_category_id) || 'Uncategorized'
            : 'Uncategorized',
          price: Number(p.customer_price || 0),
          stock_quantity: Number(p.stock || 0),
          unit: 'pcs'
        }))
        setProducts(fetchedProducts)

        // 2. ALL orders for this retailer — used for metrics.
        const { data: allOrdersData, error: allOrdersError } = await supabase
          .from('orders')
          .select('id, order_number, customer_id, total_amount, order_status, payment_status, order_date, created_at, cgst_amount, sgst_amount, igst_amount, gst_amount, shipping_state, shipping_pincode')
          .eq('retailer_id', entityId)
          .order('created_at', { ascending: false })

        if (allOrdersError) {
          console.error('Orders error:', allOrdersError)
        }

        const allOrders = allOrdersData || []
        setAllOrdersCache(allOrders)
        const recentOrdersData = allOrders.slice(0, 10)

        // 3. Resolve customer names for the recent orders + compute the
        //    distinct customer list (those served by this retailer).
        const allCustomerIds = Array.from(
          new Set(allOrders.map((o: any) => o.customer_id).filter(Boolean))
        ) as string[]

        let customerMap = new Map<string, { id: string; first_name: string; last_name: string; mobile_primary: string; created_at: string }>()
        if (allCustomerIds.length > 0) {
          const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('id, first_name, last_name, mobile_primary, created_at')
            .in('id', allCustomerIds)

          if (customersError) {
            console.error('Customers error:', customersError)
          }

          customerMap = new Map(
            (customersData || []).map((c: any) => [c.id, c])
          )
        }

        // Aggregate per-customer stats from this retailer's orders.
        const customerStats = new Map<string, { totalSpent: number; lastOrderDate: string }>()
        allOrders.forEach((o: any) => {
          if (!o.customer_id) return
          const existing = customerStats.get(o.customer_id)
          const orderDate = o.order_date || o.created_at
          if (!existing) {
            customerStats.set(o.customer_id, {
              totalSpent: Number(o.total_amount || 0),
              lastOrderDate: orderDate
            })
          } else {
            existing.totalSpent += Number(o.total_amount || 0)
            if (new Date(orderDate) > new Date(existing.lastOrderDate)) {
              existing.lastOrderDate = orderDate
            }
          }
        })

        const fetchedCustomers: Customer[] = Array.from(customerStats.entries())
          .map(([id, stats]) => {
            const c = customerMap.get(id)
            const fullName = c
              ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown'
              : 'Unknown'
            return {
              id,
              name: fullName,
              phone: c?.mobile_primary || 'N/A',
              total_purchases: stats.totalSpent,
              last_order_date: stats.lastOrderDate
            }
          })
          .sort((a, b) => new Date(b.last_order_date).getTime() - new Date(a.last_order_date).getTime())
        setCustomers(fetchedCustomers.slice(0, 10))

        const orders: Order[] = recentOrdersData.map((order: any) => {
          const c = order.customer_id ? customerMap.get(order.customer_id) : null
          const customerName = c
            ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Walk-in'
            : 'Walk-in'
          return {
            id: order.id,
            order_number: order.order_number || `ORD-${order.id.slice(0, 8)}`,
            customer_name: customerName,
            total_amount: Number(order.total_amount || 0),
            status: order.order_status || 'pending',
            payment_status: order.payment_status || 'pending',
            created_at: order.created_at
          }
        })

        setRecentOrders(orders)

        // 4. Metric calculations across the full order set.
        const totalOrders = allOrders.length
        const pendingOrders = allOrders.filter((o: any) =>
          o.order_status === 'pending' || o.order_status === 'processing'
        ).length
        const totalSales = allOrders.reduce(
          (sum: number, o: any) => sum + Number(o.total_amount || 0),
          0
        )

        // Today's sales window — local midnight to now.
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todaysOrders = allOrders.filter((o: any) => {
          const d = new Date(o.order_date || o.created_at)
          return d >= todayStart
        })
        const todaySales = todaysOrders.reduce(
          (sum: number, o: any) => sum + Number(o.total_amount || 0),
          0
        )
        const todayOrderCount = todaysOrders.length

        // Month-over-month growth based on order_date.
        const now = new Date()
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const thisMonthSales = allOrders
          .filter((o: any) => new Date(o.order_date || o.created_at) >= thisMonthStart)
          .reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)
        const lastMonthSales = allOrders
          .filter((o: any) => {
            const d = new Date(o.order_date || o.created_at)
            return d >= lastMonthStart && d < thisMonthStart
          })
          .reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)
        const monthlyGrowth = lastMonthSales > 0
          ? ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100
          : (thisMonthSales > 0 ? 100 : 0)

        const totalCustomers = fetchedCustomers.length
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const activeCustomers = fetchedCustomers.filter(c =>
          new Date(c.last_order_date) > thirtyDaysAgo
        ).length

        const stockValue = fetchedProducts.reduce(
          (sum, p) => sum + p.price * p.stock_quantity,
          0
        )
        const lowStockItems = fetchedProducts.filter(p => p.stock_quantity < 10).length

        const creditLimit = Number(entityDetails?.credit_limit || 0)
        const unpaidOrders = allOrders.filter((o: any) =>
          o.payment_status !== 'completed' && o.order_status !== 'cancelled'
        )
        const outstandingPayment = unpaidOrders.reduce(
          (sum: number, o: any) => sum + Number(o.total_amount || 0),
          0
        )
        const creditUsed = outstandingPayment
        const pendingBillCount = unpaidOrders.length

        // 5. Activity feed from the most recent orders.
        const recentActivities: any[] = orders.slice(0, 5).map(order => ({
          id: `order-${order.id}`,
          type: 'order' as const,
          title: order.status === 'delivered' ? 'Order delivered' : `Order ${order.status}`,
          description: `${order.order_number} · ${order.customer_name} · ₹${order.total_amount.toLocaleString('en-IN')}`,
          timestamp: order.created_at,
          status: order.status === 'delivered'
            ? 'success' as const
            : order.status === 'cancelled'
              ? 'error' as const
              : 'info' as const
        }))

        recentActivities.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

        setActivities(recentActivities.slice(0, 5))

        setMetrics({
          totalOrders,
          pendingOrders,
          totalSales,
          todaySales,
          todayOrderCount,
          pendingBillCount,
          monthlyGrowth,
          totalCustomers,
          activeCustomers,
          stockValue,
          lowStockItems,
          outstandingPayment,
          creditLimit,
          creditUsed
        })

        // 6. Order status + payment status breakdown across this retailer's orders.
        setOrderStatusBreakdown({
          pending: allOrders.filter((o: any) => o.order_status === 'pending').length,
          processing: allOrders.filter((o: any) => o.order_status === 'processing').length,
          shipped: allOrders.filter((o: any) => o.order_status === 'shipped').length,
          delivered: allOrders.filter((o: any) => o.order_status === 'delivered').length,
        })
        setPaymentStatusBreakdown({
          pending: allOrders.filter((o: any) => o.payment_status === 'pending').length,
          completed: allOrders.filter((o: any) => o.payment_status === 'completed').length,
          failed: allOrders.filter((o: any) => o.payment_status === 'failed').length,
        })

        // 7. Today's orders list (full set today, not just the recent 10).
        const todaysOrdersList: Order[] = todaysOrders.map((order: any) => {
          const c = order.customer_id ? customerMap.get(order.customer_id) : null
          const customerName = c
            ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Walk-in'
            : 'Walk-in'
          return {
            id: order.id,
            order_number: order.order_number || `ORD-${order.id.slice(0, 8)}`,
            customer_name: customerName,
            total_amount: Number(order.total_amount || 0),
            status: order.order_status || 'pending',
            payment_status: order.payment_status || 'pending',
            created_at: order.order_date || order.created_at
          }
        })
        setTodayOrders(todaysOrdersList)

        // 8. GST Summary across the retailer's orders (CGST/SGST/IGST split
        //    based on shipping state — Maharashtra is intra-state).
        const isMaharashtraPincode = (pincode: string | null): boolean => {
          if (!pincode || pincode.length < 2) return true
          const prefix = pincode.substring(0, 2)
          return ['40', '41', '42', '43', '44'].includes(prefix)
        }
        let cgst = 0
        let sgst = 0
        let igst = 0
        allOrders.forEach((order: any) => {
          const isOutsideMH = order.shipping_state
            ? order.shipping_state.toLowerCase() !== 'maharashtra'
            : !isMaharashtraPincode(order.shipping_pincode)
          if (isOutsideMH) {
            const orderIgst = parseFloat(String(order.igst_amount || 0)) ||
              (parseFloat(String(order.cgst_amount || 0)) + parseFloat(String(order.sgst_amount || 0))) ||
              parseFloat(String(order.gst_amount || 0)) || 0
            igst += orderIgst
          } else {
            const orderCgst = parseFloat(String(order.cgst_amount || 0))
            const orderSgst = parseFloat(String(order.sgst_amount || 0))
            if (orderCgst > 0 || orderSgst > 0) {
              cgst += orderCgst
              sgst += orderSgst
            } else {
              const totalGst = parseFloat(String(order.gst_amount || 0))
              if (totalGst > 0) {
                cgst += totalGst / 2
                sgst += totalGst / 2
              }
            }
          }
        })
        setGstData({ cgst, sgst, igst, total: cgst + sgst + igst })

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [entityId, entityDetails, entityLoading])

  const quickActions = [
    {
      title: "New Sale",
      description: "Create POS order",
      icon: ShoppingBag,
      href: "/dashboard/pos"
    },
    {
      title: "Place Order",
      description: "Order from distributor",
      icon: Plus,
      href: "/dashboard/orders/new"
    },
    {
      title: "Add Customer",
      description: "Register new customer",
      icon: Users,
      href: "/dashboard/customers/new"
    },
    {
      title: "View Products",
      description: "Browse catalog",
      icon: Package,
      href: "/dashboard/products"
    }
  ]

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
      cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    }
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  }

  const topCustomers = [...customers]
    .sort((a, b) => b.total_purchases - a.total_purchases)
    .slice(0, 5)

  if (roleLoading || entityLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (entityError) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Account Setup Required
            </CardTitle>
            <CardDescription>
              {entityError}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your user account is not linked to a retailer profile. Please contact your administrator or distributor to complete the setup.
            </p>
            <Button onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Retailer Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {entityName}
        </p>
      </div>

      {/* Credit Info Bar */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CreditCard className="h-6 w-6 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Credit Status</p>
                <p className="text-xs text-blue-700">
                  Used: ₹{metrics.creditUsed.toLocaleString('en-IN')} / Limit: ₹{metrics.creditLimit.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-orange-900">Outstanding</p>
                <p className="text-lg font-bold text-orange-700">
                  ₹{metrics.outstandingPayment.toLocaleString('en-IN')}
                </p>
              </div>
              {metrics.outstandingPayment > 0 && (
                <Button size="sm" variant="outline" className="border-orange-300">
                  Pay Now
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Today&apos;s Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/orders" className="transition-transform hover:scale-105">
            <Card className="cursor-pointer h-full border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(metrics.todaySales)}</div>
                <p className="text-xs text-muted-foreground">Revenue today</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/orders" className="transition-transform hover:scale-105">
            <Card className="cursor-pointer h-full border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{metrics.todayOrderCount}</div>
                <p className="text-xs text-muted-foreground">Orders placed today</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/orders" className="transition-transform hover:scale-105">
            <Card className="cursor-pointer h-full border-orange-500/20 bg-orange-500/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
                <Receipt className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{metrics.pendingBillCount}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(metrics.outstandingPayment)} outstanding</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/customers" className="transition-transform hover:scale-105">
            <Card className="cursor-pointer h-full border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
                <Users className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{metrics.activeCustomers}</div>
                <p className="text-xs text-muted-foreground">In the last 30 days</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Overall Summary */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Overall Summary</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Sales"
            value={formatCurrency(metrics.totalSales)}
            description="All time"
            icon={IndianRupee}
            trend={{
              value: Math.abs(Math.round(metrics.monthlyGrowth * 10) / 10),
              isPositive: metrics.monthlyGrowth >= 0
            }}
          />
          <MetricCard
            title="Orders"
            value={metrics.totalOrders}
            description={`${metrics.pendingOrders} pending`}
            icon={ShoppingCart}
          />
          <MetricCard
            title="Customers"
            value={metrics.totalCustomers}
            description={`${metrics.activeCustomers} active (30d)`}
            icon={Users}
          />
          <MetricCard
            title="Catalog Value"
            value={formatCurrency(metrics.stockValue)}
            description={`${metrics.lowStockItems} items low`}
            icon={Boxes}
          />
        </div>
      </div>

      {/* Revenue & Orders Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue & Orders
          </CardTitle>
          <Select value={chartPeriod} onValueChange={(v: "monthly" | "weekly" | "daily") => setChartPeriod(v)}>
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily (14d)</SelectItem>
              <SelectItem value="weekly">Weekly (8w)</SelectItem>
              <SelectItem value="monthly">Monthly (12m)</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
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
                    name === "Revenue"
                      ? new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(value ?? 0)
                      : (value ?? 0),
                    name,
                  ]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No order data to display</p>
          )}
        </CardContent>
      </Card>

      {/* GST Summary */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            GST Summary (All Time)
          </CardTitle>
          <CardDescription>Tax collected across all your orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-green-200 dark:border-green-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">CGST</span>
                <Receipt className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(gstData.cgst)}</div>
              <p className="text-xs text-muted-foreground mt-1">Central GST</p>
            </div>

            <div className="rounded-lg border border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">SGST</span>
                <Receipt className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(gstData.sgst)}</div>
              <p className="text-xs text-muted-foreground mt-1">State GST</p>
            </div>

            <div className="rounded-lg border border-purple-200 dark:border-purple-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">IGST</span>
                <Receipt className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(gstData.igst)}</div>
              <p className="text-xs text-muted-foreground mt-1">Integrated GST</p>
            </div>

            <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Total GST</span>
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(gstData.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">CGST + SGST + IGST</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order & Payment Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">Pending</span>
              </div>
              <Badge className={getStatusColor("pending")}>{orderStatusBreakdown.pending}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Processing</span>
              </div>
              <Badge className={getStatusColor("processing")}>{orderStatusBreakdown.processing}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-600" />
                <span className="text-sm">Shipped</span>
              </div>
              <Badge className={getStatusColor("shipped")}>{orderStatusBreakdown.shipped}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Delivered</span>
              </div>
              <Badge className={getStatusColor("delivered")}>{orderStatusBreakdown.delivered}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">Pending</span>
              </div>
              <Badge className={getStatusColor("pending")}>{paymentStatusBreakdown.pending}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Completed</span>
              </div>
              <Badge className={getStatusColor("completed")}>{paymentStatusBreakdown.completed}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm">Failed</span>
              </div>
              <Badge className={getStatusColor("failed")}>{paymentStatusBreakdown.failed}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Today&apos;s Orders
            <Badge variant="secondary">{metrics.todayOrderCount}</Badge>
          </CardTitle>
          <Link href="/dashboard/orders" className="text-sm text-primary hover:underline">
            View All
          </Link>
        </CardHeader>
        <CardContent>
          {todayOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No orders placed today</p>
          ) : (
            <div className="space-y-3">
              {todayOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{order.order_number}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {order.customer_name} ·{' '}
                      {new Date(order.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">{formatCurrency(order.total_amount)}</span>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    <Badge className={getStatusColor(order.payment_status)}>{order.payment_status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Customers & Recent Orders */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Top Customers
            </CardTitle>
            <CardDescription>By total purchase value</CardDescription>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customers yet</p>
            ) : (
              <div className="space-y-3">
                {topCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">{customer.phone}</div>
                    </div>
                    <span className="text-sm font-semibold ml-2">{formatCurrency(customer.total_purchases)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <CardDescription>Latest 5 orders</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent orders</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.slice(0, 5).map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0 hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{order.order_number}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatCurrency(order.total_amount)} · {order.customer_name}
                      </div>
                    </div>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActions actions={quickActions} />
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <RecentActivity activities={activities} />
        </div>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="cursor-pointer hover:bg-accent" onClick={() => router.push('/dashboard/pos')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Point of Sale
                </CardTitle>
                <CardDescription>
                  Quick billing for walk-in customers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Open POS</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-5 w-5" />
                  Today's Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{metrics.todaySales.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.todayOrderCount} {metrics.todayOrderCount === 1 ? 'transaction' : 'transactions'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-5 w-5" />
                  Pending Bills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.pendingBillCount}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{metrics.outstandingPayment.toLocaleString('en-IN')} total
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Product Catalog</CardTitle>
                  <CardDescription>
                    Browse and manage your product inventory
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>₹{product.price}</TableCell>
                      <TableCell>
                        <span className={product.stock_quantity < 10 ? 'text-orange-600 font-medium' : ''}>
                          {product.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell>
                        <Badge variant={product.stock_quantity < 10 ? 'destructive' : 'default'}>
                          {product.stock_quantity < 10 ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>My Customers</CardTitle>
                <CardDescription>
                  Manage your customer base and relationships
                </CardDescription>
              </div>
              <Button onClick={() => router.push('/dashboard/customers/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Total Purchases</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>₹{customer.total_purchases.toLocaleString()}</TableCell>
                      <TableCell>
                        {format(new Date(customer.last_order_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Order History</CardTitle>
                <CardDescription>
                  Track your orders from distributors
                </CardDescription>
              </div>
              <Button onClick={() => router.push('/dashboard/orders/new')}>
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell>₹{order.total_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={
                          order.status === 'delivered' ? 'default' :
                          order.status === 'processing' ? 'secondary' : 'outline'
                        }>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          order.payment_status === 'paid' ? 'default' : 'destructive'
                        }>
                          {order.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
              <CardDescription>
                Generate and download business reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="cursor-pointer hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-5 w-5" />
                      Sales Report
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Daily, weekly, and monthly sales
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-5 w-5" />
                      Inventory Report
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Stock levels and movement
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-5 w-5" />
                      Customer Report
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Customer analytics and trends
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Receipt className="h-5 w-5" />
                      GST Report
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Tax summary and filing data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}