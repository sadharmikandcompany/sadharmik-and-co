"use client"

import { useEffect, useState } from "react"
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
import { X, Receipt, Loader2, Building2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShoppingCart, IndianRupee, FileText, Search, Filter as FilterIcon } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"

type GSTOrder = {
  id: string
  order_number: string
  invoice_number_gst: string | null
  customer_name: string
  customer_gst_number: string | null
  customer_city: string | null
  customer_state: string | null
  order_status: string
  payment_status: string
  subtotal: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_gst: number
  total_amount: number
  discount_percent: number
  order_date: string
  created_at: string
  is_interstate: boolean
}

export default function GSTOrdersReportPage() {
  const [orders, setOrders] = useState<GSTOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [gstTypeFilter, setGstTypeFilter] = useState<string>("all")
  const [stateFilter, setStateFilter] = useState<string>("all")
  const [hasGstFilter, setHasGstFilter] = useState<string>("all")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    fetchGSTOrders()
  }, [])

  const fetchGSTOrders = async () => {
    setLoading(true)

    try {
      // Fetch all orders by paginating through batches (Supabase default limit is 1000)
      const batchSize = 1000
      let allOrdersData: any[] = []
      let from = 0
      let hasMore = true

      while (hasMore) {
        const { data: batchData, error: batchError } = await supabase
          .from("orders")
          .select(`
            id,
            order_number,
            customer_full_name,
            customer_id,
            shipping_city,
            shipping_state,
            order_status,
            payment_status,
            total_amount,
            cgst_amount,
            sgst_amount,
            igst_amount,
            discount_amount,
            order_date,
            created_at,
            customer_gst_number,
            invoice_number_gst
          `)
          .eq("is_gst_invoice", true)
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1)

        if (batchError) throw batchError

        if (batchData && batchData.length > 0) {
          allOrdersData = [...allOrdersData, ...batchData]
          from += batchSize
          hasMore = batchData.length === batchSize
        } else {
          hasMore = false
        }
      }

      const ordersData = allOrdersData

      // Fetch customers with GST numbers for fallback (batch to handle large datasets)
      const customerIds = [...new Set(ordersData?.map((o: any) => o.customer_id).filter(Boolean))]
      let customersMap: Record<string, string | null> = {}

      if (customerIds.length > 0) {
        // Batch customer IDs in chunks of 500 (Supabase .in() limit)
        const customerBatchSize = 500
        for (let i = 0; i < customerIds.length; i += customerBatchSize) {
          const batchIds = customerIds.slice(i, i + customerBatchSize)
          const { data: customersData } = await supabase
            .from("customers")
            .select("id, gst_number")
            .in("id", batchIds)

          if (customersData) {
            customersData.forEach((c: any) => {
              customersMap[c.id] = c.gst_number
            })
          }
        }
      }

      // Process orders to calculate GST details
      const processedOrders: GSTOrder[] = ordersData?.map((order: any) => {
        const cgst = Number(order.cgst_amount || 0)
        const sgst = Number(order.sgst_amount || 0)
        const igst = Number(order.igst_amount || 0)
        const totalGst = cgst + sgst + igst
        const totalAmount = Number(order.total_amount || 0)
        const subtotal = totalAmount - totalGst

        // Use order's GST number first, fallback to customer's GST number
        const gstNumber = order.customer_gst_number || customersMap[order.customer_id] || null

        return {
          id: order.id,
          order_number: order.order_number,
          invoice_number_gst: order.invoice_number_gst || null,
          customer_name: order.customer_full_name,
          customer_gst_number: gstNumber,
          customer_city: order.shipping_city,
          customer_state: order.shipping_state,
          order_status: order.order_status,
          payment_status: order.payment_status,
          subtotal,
          cgst_amount: cgst,
          sgst_amount: sgst,
          igst_amount: igst,
          total_gst: totalGst,
          total_amount: totalAmount,
          discount_percent: order.discount_amount || 0,
          order_date: order.order_date,
          created_at: order.created_at,
          is_interstate: igst > 0, // Interstate if IGST is charged
        }
      }) || []

      setOrders(processedOrders)
    } catch (error) {
      console.error("Error fetching GST orders:", error)
      toast.error("Failed to fetch GST orders")
    } finally {
      setLoading(false)
    }
  }

  // Get unique states for filter
  const uniqueStates = Array.from(
    new Set(orders.map(o => o.customer_state).filter(Boolean))
  ).sort()

  const filteredOrders = orders.filter((order) => {
    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_gst_number?.toLowerCase().includes(searchTerm.toLowerCase())

    // Date range filter
    const orderDate = new Date(order.order_date || order.created_at)
    const matchesDateFrom = !dateFrom || orderDate >= dateFrom
    const matchesDateTo = !dateTo || orderDate <= dateTo

    // GST Type filter
    const matchesGstType =
      gstTypeFilter === "all" ||
      (gstTypeFilter === "intrastate" && !order.is_interstate) ||
      (gstTypeFilter === "interstate" && order.is_interstate)

    // State filter
    const matchesState =
      stateFilter === "all" ||
      order.customer_state === stateFilter

    // Has GST Number filter
    const matchesHasGst =
      hasGstFilter === "all" ||
      (hasGstFilter === "with_gst" && order.customer_gst_number) ||
      (hasGstFilter === "without_gst" && !order.customer_gst_number)

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesGstType &&
      matchesState &&
      matchesHasGst
    )
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, dateFrom, dateTo, gstTypeFilter, stateFilter, hasGstFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex)

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setGstTypeFilter("all")
    setStateFilter("all")
    setHasGstFilter("all")
    setSearchTerm("")
  }

  const hasActiveFilters =
    dateFrom ||
    dateTo ||
    gstTypeFilter !== "all" ||
    stateFilter !== "all" ||
    hasGstFilter !== "all" ||
    searchTerm !== ""

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || ""
    if (statusLower.includes("delivered") || statusLower.includes("completed")) {
      return "bg-green-100 text-green-800 border-green-200"
    }
    if (statusLower.includes("shipped") || statusLower.includes("dispatched")) {
      return "bg-blue-100 text-blue-800 border-blue-200"
    }
    if (statusLower.includes("processing") || statusLower.includes("confirmed")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    }
    if (statusLower.includes("pending") || statusLower.includes("new")) {
      return "bg-orange-100 text-orange-800 border-orange-200"
    }
    if (statusLower.includes("cancel") || statusLower.includes("failed") || statusLower.includes("rejected")) {
      return "bg-red-100 text-red-800 border-red-200"
    }
    if (statusLower.includes("return") || statusLower.includes("refund")) {
      return "bg-purple-100 text-purple-800 border-purple-200"
    }
    return "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getPaymentStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || ""
    if (statusLower.includes("paid") || statusLower.includes("completed") || statusLower.includes("success")) {
      return "bg-green-100 text-green-800 border-green-200"
    }
    if (statusLower.includes("pending") || statusLower.includes("awaiting")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    }
    if (statusLower.includes("failed") || statusLower.includes("cancelled") || statusLower.includes("refund")) {
      return "bg-red-100 text-red-800 border-red-200"
    }
    if (statusLower.includes("partial")) {
      return "bg-orange-100 text-orange-800 border-orange-200"
    }
    if (statusLower.includes("cod")) {
      return "bg-blue-100 text-blue-800 border-blue-200"
    }
    return "bg-gray-100 text-gray-800 border-gray-200"
  }

  // Calculate summary stats
  const totalSubtotal = filteredOrders.reduce((sum, o) => sum + o.subtotal, 0)
  const totalCGST = filteredOrders.reduce((sum, o) => sum + o.cgst_amount, 0)
  const totalSGST = filteredOrders.reduce((sum, o) => sum + o.sgst_amount, 0)
  const totalIGST = filteredOrders.reduce((sum, o) => sum + o.igst_amount, 0)
  const totalGST = totalCGST + totalSGST + totalIGST
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0)
  const intrastateOrders = filteredOrders.filter(o => !o.is_interstate).length
  const interstateOrders = filteredOrders.filter(o => o.is_interstate).length

  // Prepare export data
  const exportData = filteredOrders.map(order => ({
    'Invoice Number': order.invoice_number_gst || 'N/A',
    'Order Number': order.order_number,
    'Customer': order.customer_name,
    'GST Number': order.customer_gst_number || 'N/A',
    'State': order.customer_state || 'N/A',
    'Type': order.is_interstate ? 'Interstate' : 'Intrastate',
    'Subtotal': `₹${order.subtotal.toFixed(2)}`,
    'CGST': `₹${order.cgst_amount.toFixed(2)}`,
    'SGST': `₹${order.sgst_amount.toFixed(2)}`,
    'IGST': `₹${order.igst_amount.toFixed(2)}`,
    'Total GST': `₹${order.total_gst.toFixed(2)}`,
    'Total Amount': `₹${order.total_amount.toFixed(2)}`,
    'Status': order.order_status,
    'Payment': order.payment_status,
    'Order Date': format(new Date(order.order_date || order.created_at), 'PPP')
  }))

  const exportColumns = [
    { header: 'Invoice #', dataKey: 'Invoice Number' },
    { header: 'Order #', dataKey: 'Order Number' },
    { header: 'Customer', dataKey: 'Customer' },
    { header: 'GST #', dataKey: 'GST Number' },
    { header: 'Type', dataKey: 'Type' },
    { header: 'Subtotal', dataKey: 'Subtotal' },
    { header: 'CGST', dataKey: 'CGST' },
    { header: 'SGST', dataKey: 'SGST' },
    { header: 'IGST', dataKey: 'IGST' },
    { header: 'Total GST', dataKey: 'Total GST' },
    { header: 'Total', dataKey: 'Total Amount' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Receipt className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">GST Orders Report</h1>
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
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">GST Orders Report</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive GST-based order report with tax breakdowns
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <ExportButtons
          data={exportData}
          filename="gst-orders-report"
          columns={exportColumns}
          pdfTitle="GST Orders Report"
        />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {filteredOrders.length.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            GST invoices
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardDescription>Subtotal</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {formatCurrency(totalSubtotal)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pre-tax total
          </CardContent>
        </Card>

        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Total GST</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">
              {formatCurrency(totalGST)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Receipt className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            C: {formatCurrency(totalCGST)} | S: {formatCurrency(totalSGST)} | I: {formatCurrency(totalIGST)}
          </CardContent>
        </Card>

        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
              {formatCurrency(totalRevenue)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Including taxes
          </CardContent>
        </Card>

        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Intrastate</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
              {intrastateOrders.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Building2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            CGST + SGST
          </CardContent>
        </Card>

        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Interstate</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">
              {interstateOrders.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <Building2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            IGST
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">GST Order Details</CardTitle>
                <CardDescription className="mt-0.5">
                  Filter and view detailed GST information for orders
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredOrders.length} {filteredOrders.length === 1 ? "result" : "results"}
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

              {/* GST Type */}
              <Select value={gstTypeFilter} onValueChange={setGstTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="GST Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="intrastate">Intrastate (CGST+SGST)</SelectItem>
                  <SelectItem value="interstate">Interstate (IGST)</SelectItem>
                </SelectContent>
              </Select>

              {/* Has GST Number */}
              <Select value={hasGstFilter} onValueChange={setHasGstFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="GST Number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="with_gst">With GST Number</SelectItem>
                  <SelectItem value="without_gst">Without GST Number</SelectItem>
                </SelectContent>
              </Select>

              {/* State Filter */}
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {uniqueStates.map((state) => (
                    <SelectItem key={state} value={state!}>
                      {state}
                    </SelectItem>
                  ))}
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
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Invoice #</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Order #</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Customer</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">GST Number</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">State</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Subtotal</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">CGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">SGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">IGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total GST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => (
                    <TableRow key={order.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {order.invoice_number_gst || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.customer_name}</div>
                          {order.customer_city && (
                            <div className="text-xs text-muted-foreground">
                              {order.customer_city}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.customer_gst_number ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-green-600" />
                            <span className="text-sm font-mono">{order.customer_gst_number}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.customer_state || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`rounded-full ${
                            order.is_interstate
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          }`}
                        >
                          {order.is_interstate ? "Interstate" : "Intrastate"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(order.subtotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {order.cgst_amount > 0 ? formatCurrency(order.cgst_amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {order.sgst_amount > 0 ? formatCurrency(order.sgst_amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {order.igst_amount > 0 ? formatCurrency(order.igst_amount) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(order.total_gst)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-bold">
                        {formatCurrency(order.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border", getStatusColor(order.order_status))}>
                          {order.order_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {filteredOrders.length === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
              </span>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
