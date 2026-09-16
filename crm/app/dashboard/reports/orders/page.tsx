"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, FileText, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShoppingCart, IndianRupee, Receipt, CheckCircle2, Clock, Search, Filter as FilterIcon } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"

type Order = {
  id: string
  order_number: string
  customer_name: string
  customer_city: string | null
  customer_state: string | null
  order_status: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  discount_percent: number
  order_date: string
  created_at: string
  order_type: string | null
}

type SummaryStats = {
  totalOrders: number
  totalRevenue: number
  totalCGST: number
  totalSGST: number
  totalIGST: number
  completedCount: number
  pendingCount: number
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

export default function OrdersReportPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)

  // Summary stats (calculated server-side)
  const [stats, setStats] = useState<SummaryStats>({
    totalOrders: 0,
    totalRevenue: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    completedCount: 0,
    pendingCount: 0,
  })

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all")
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("all")

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [orderStatusFilter, paymentStatusFilter, orderTypeFilter, dateFrom, dateTo])

  const fetchOrders = useCallback(async () => {
    setLoading(true)

    // Build the query with filters
    let query = supabase
      .from("orders")
      .select("*", { count: "exact" })

    // Apply search filter (order_number or customer_name)
    if (debouncedSearch) {
      query = query.or(`order_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`)
    }

    // Apply order status filter
    if (orderStatusFilter !== "all") {
      query = query.eq("order_status", orderStatusFilter)
    }

    // Apply payment status filter
    if (paymentStatusFilter !== "all") {
      query = query.eq("payment_status", paymentStatusFilter)
    }

    // Apply order type filter
    if (orderTypeFilter !== "all") {
      if (orderTypeFilter === "regular") {
        query = query.or("order_type.is.null,order_type.eq.regular")
      } else {
        query = query.eq("order_type", orderTypeFilter)
      }
    }

    // Apply date range filters
    if (dateFrom) {
      const fromStr = format(dateFrom, "yyyy-MM-dd")
      query = query.gte("order_date", fromStr)
    }
    if (dateTo) {
      const toStr = format(dateTo, "yyyy-MM-dd")
      query = query.lte("order_date", toStr)
    }

    // Apply pagination
    const from = (currentPage - 1) * pageSize
    const to = from + pageSize - 1

    query = query
      .order("created_at", { ascending: false })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching orders:", error)
      toast.error("Failed to fetch orders")
      setLoading(false)
      return
    }

    setOrders(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }, [currentPage, pageSize, debouncedSearch, orderStatusFilter, paymentStatusFilter, orderTypeFilter, dateFrom, dateTo])

  // Fetch summary stats separately (aggregated from all filtered data)
  const fetchStats = useCallback(async () => {
    // Build base query for stats
    let query = supabase
      .from("orders")
      .select("total_amount, cgst_amount, sgst_amount, igst_amount, order_status")

    // Apply same filters as main query
    if (debouncedSearch) {
      query = query.or(`order_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`)
    }
    if (orderStatusFilter !== "all") {
      query = query.eq("order_status", orderStatusFilter)
    }
    if (paymentStatusFilter !== "all") {
      query = query.eq("payment_status", paymentStatusFilter)
    }
    if (orderTypeFilter !== "all") {
      if (orderTypeFilter === "regular") {
        query = query.or("order_type.is.null,order_type.eq.regular")
      } else {
        query = query.eq("order_type", orderTypeFilter)
      }
    }
    if (dateFrom) {
      const fromStr = format(dateFrom, "yyyy-MM-dd")
      query = query.gte("order_date", fromStr)
    }
    if (dateTo) {
      const toStr = format(dateTo, "yyyy-MM-dd")
      query = query.lte("order_date", toStr)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching stats:", error)
      return
    }

    if (data) {
      const totalRevenue = data.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
      const totalCGST = data.reduce((sum, o) => sum + Number(o.cgst_amount || 0), 0)
      const totalSGST = data.reduce((sum, o) => sum + Number(o.sgst_amount || 0), 0)
      const totalIGST = data.reduce((sum, o) => sum + Number(o.igst_amount || 0), 0)
      const completedCount = data.filter(o => o.order_status === "completed" || o.order_status === "delivered").length
      const pendingCount = data.filter(o => o.order_status === "pending" || o.order_status === "processing").length

      setStats({
        totalOrders: data.length,
        totalRevenue,
        totalCGST,
        totalSGST,
        totalIGST,
        completedCount,
        pendingCount,
      })
    }
  }, [debouncedSearch, orderStatusFilter, paymentStatusFilter, orderTypeFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setOrderStatusFilter("all")
    setPaymentStatusFilter("all")
    setOrderTypeFilter("all")
    setSearchTerm("")
    setDebouncedSearch("")
    setCurrentPage(1)
  }

  const hasActiveFilters =
    dateFrom ||
    dateTo ||
    orderStatusFilter !== "all" ||
    paymentStatusFilter !== "all" ||
    orderTypeFilter !== "all" ||
    searchTerm !== ""

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "completed" || lowerStatus === "delivered" || lowerStatus === "paid") {
      return "default"
    }
    if (lowerStatus === "pending" || lowerStatus === "processing" || lowerStatus === "shipped") {
      return "outline"
    }
    if (lowerStatus === "cancelled" || lowerStatus === "failed") {
      return "destructive"
    }
    if (lowerStatus === "partial") {
      return "secondary"
    }
    return "secondary"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / pageSize)
  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalCount)

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize))
    setCurrentPage(1)
  }

  // Prepare export data (current page only for performance)
  const exportData = orders.map(order => ({
    'Order Number': order.order_number,
    'Customer': order.customer_name,
    'Location': order.customer_city && order.customer_state
      ? `${order.customer_city}, ${order.customer_state}`
      : order.customer_city || order.customer_state || 'N/A',
    'Order Type': order.order_type || 'Regular',
    'Status': order.order_status,
    'Payment Status': order.payment_status,
    'Payment Method': order.payment_method || 'N/A',
    'Subtotal': `₹${(order.total_amount - order.cgst_amount - order.sgst_amount - order.igst_amount).toFixed(2)}`,
    'CGST': `₹${order.cgst_amount.toFixed(2)}`,
    'SGST': `₹${order.sgst_amount.toFixed(2)}`,
    'IGST': `₹${order.igst_amount.toFixed(2)}`,
    'Total': `₹${order.total_amount.toFixed(2)}`,
    'Discount %': `${order.discount_percent}%`,
    'Order Date': format(new Date(order.order_date || order.created_at), 'PPP')
  }))

  const exportColumns = [
    { header: 'Order #', dataKey: 'Order Number' },
    { header: 'Customer', dataKey: 'Customer' },
    { header: 'Type', dataKey: 'Order Type' },
    { header: 'Status', dataKey: 'Status' },
    { header: 'Payment', dataKey: 'Payment Status' },
    { header: 'Total', dataKey: 'Total' },
    { header: 'Date', dataKey: 'Order Date' }
  ]

  const totalTax = stats.totalCGST + stats.totalSGST + stats.totalIGST

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <FileText className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Orders Report</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Orders Report</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive report of all orders with export options
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <ExportButtons
          data={exportData}
          filename="orders-report"
          columns={exportColumns}
          pdfTitle="Orders Report"
        />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {stats.totalOrders.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across current filters
          </CardContent>
        </Card>

        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
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
            Sum of order totals
          </CardContent>
        </Card>

        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Total Tax</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">
              {formatCurrency(totalTax)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Receipt className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            CGST + SGST + IGST
          </CardContent>
        </Card>

        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
              {stats.completedCount.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Delivered or completed
          </CardContent>
        </Card>

        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">
              {stats.pendingCount.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <Clock className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pending or processing
          </CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900/50">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Order Details</CardTitle>
                <CardDescription className="mt-0.5">
                  Filter and view detailed order information
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {totalCount.toLocaleString()} {totalCount === 1 ? "order" : "orders"}
              </Badge>
              {hasActiveFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  Filters active
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>

              {/* Order Status */}
              <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Order Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Payment Status */}
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Payment Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              {/* Order Type */}
              <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Order Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                </SelectContent>
              </Select>

              {/* Date range */}
              <DateRangePresetFilter
                preset={datePreset}
                onPresetChange={(p, range) => {
                  setDatePreset(p)
                  setDateFrom(range.from)
                  setDateTo(range.to)
                }}
                customFrom={dateFrom}
                customTo={dateTo}
                onCustomRangeChange={(from, to) => {
                  setDatePreset("custom")
                  setDateFrom(from)
                  setDateTo(to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999) : undefined)
                }}
              />

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1200px] w-max">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Order #</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Customer</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Location</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Subtotal</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">CGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">SGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">IGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Order Status</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Payment</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const subtotal = order.total_amount - order.cgst_amount - order.sgst_amount - order.igst_amount
                    return (
                      <TableRow key={order.id} className="transition-colors hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="text-primary hover:underline"
                          >
                            {order.order_number}
                          </Link>
                        </TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>
                          {order.customer_city && order.customer_state
                            ? `${order.customer_city}, ${order.customer_state}`
                            : order.customer_city || order.customer_state || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full capitalize">
                            {order.order_type || "Regular"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(subtotal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(order.cgst_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(order.sgst_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(order.igst_amount)}
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(order.total_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(order.order_status)} className="rounded-full capitalize">
                            {order.order_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(order.payment_status)} className="rounded-full capitalize">
                            {order.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(order.order_date || order.created_at), 'PP')}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 rounded-lg border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page:</span>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="ml-4">
                Showing {startRecord.toLocaleString()} - {endRecord.toLocaleString()} of {totalCount.toLocaleString()} orders
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1 || loading}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 mx-2">
                <span className="text-sm">Page</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value)
                    if (!isNaN(page)) goToPage(page)
                  }}
                  className="w-16 h-8 text-center"
                />
                <span className="text-sm">of {totalPages.toLocaleString()}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages || loading}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
