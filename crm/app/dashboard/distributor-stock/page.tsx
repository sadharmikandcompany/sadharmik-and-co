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
import { Building2, Package, TrendingUp, DollarSign, Eye, Download, Warehouse, Search } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type DistributorWithStats = {
  id: string
  name: string
  company_name: string
  invoice_code: string | null
  is_active: boolean
  is_verified: boolean
  total_orders: number
  total_quantity: number
  total_value: number
  last_order_date: string | null
}

export default function DistributorStockOverviewPage() {
  const [distributors, setDistributors] = useState<DistributorWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchDistributorStock()
  }, [])

  const fetchDistributorStock = async () => {
    setLoading(true)

    // Fetch all distributors
    const { data: distributorData, error: distributorError } = await supabase
      .from("distributors")
      .select("id, name, company_name, invoice_code, is_active, is_verified")
      .order("name")

    if (distributorError) {
      console.error("Error fetching distributors:", distributorError)
      toast.error("Failed to fetch distributors")
      setLoading(false)
      return
    }

    // Fetch ALL orders with items in a single query (optimized - no N+1 problem)
    let ordersQuery = supabase
      .from("orders")
      .select(`
        id,
        distributor_id,
        total_amount,
        order_date,
        order_items (
          quantity
        )
      `)
      .not("distributor_id", "is", null)

    // Apply date filters if set
    if (startDate) {
      ordersQuery = ordersQuery.gte("order_date", startDate)
    }
    if (endDate) {
      ordersQuery = ordersQuery.lte("order_date", endDate)
    }

    const { data: allOrders, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error("Error fetching orders:", ordersError)
      toast.error("Failed to fetch order data")
      setLoading(false)
      return
    }

    // Group orders by distributor_id and calculate stats
    const ordersByDistributor = new Map<string, typeof allOrders>()
    allOrders?.forEach(order => {
      if (order.distributor_id) {
        const existing = ordersByDistributor.get(order.distributor_id) || []
        ordersByDistributor.set(order.distributor_id, [...existing, order])
      }
    })

    // Map distributors with their calculated stats
    const distributorsWithStats: DistributorWithStats[] = (distributorData || []).map(distributor => {
      const orders = ordersByDistributor.get(distributor.id) || []

      const totalOrders = orders.length
      const totalValue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
      const totalQuantity = orders.reduce((sum, order) => {
        const orderItems = Array.isArray(order.order_items) ? order.order_items : []
        return sum + orderItems.reduce((itemSum: number, item: { quantity: number }) => itemSum + (item.quantity || 0), 0)
      }, 0)

      const lastOrderDate = orders.length > 0
        ? orders.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())[0].order_date
        : null

      return {
        ...distributor,
        total_orders: totalOrders,
        total_quantity: totalQuantity,
        total_value: totalValue,
        last_order_date: lastOrderDate
      }
    })

    setDistributors(distributorsWithStats)
    setLoading(false)
  }

  const exportToCSV = () => {
    try {
      // Prepare CSV headers
      const headers = [
        "Distributor Name",
        "Company Name",
        "Invoice Code",
        "Total Orders",
        "Total Quantity",
        "Total Value (₹)",
        "Last Order Date",
        "Status",
        "Verified"
      ]

      // Prepare CSV rows
      const rows = filteredDistributors.map(distributor => [
        distributor.name,
        distributor.company_name,
        distributor.invoice_code || "",
        distributor.total_orders.toString(),
        distributor.total_quantity.toString(),
        distributor.total_value.toFixed(2),
        distributor.last_order_date ? new Date(distributor.last_order_date).toLocaleDateString() : "Never",
        distributor.is_active ? "Active" : "Inactive",
        distributor.is_verified ? "Yes" : "No"
      ])

      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n")

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.setAttribute("href", url)
      link.setAttribute("download", `distributor-stock-${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("Exported successfully")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export data")
    }
  }

  const filteredDistributors = distributors.filter((distributor) =>
    distributor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    distributor.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (distributor.invoice_code && distributor.invoice_code.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Calculate global stats
  const totalDistributors = distributors.length
  const activeDistributors = distributors.filter(d => d.is_active && d.is_verified).length
  const totalStockValue = distributors.reduce((sum, d) => sum + d.total_value, 0)
  const totalQuantitySold = distributors.reduce((sum, d) => sum + d.total_quantity, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Distributor Stock Overview</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Building2 className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Distributor Stock Overview</h1>
            <p className="text-sm text-muted-foreground">Track stock purchases across all distributors</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Distributors</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{totalDistributors}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <Building2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{activeDistributors} active</CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Total Quantity Sold</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{totalQuantitySold.toLocaleString()}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">units to distributors</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Total Stock Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">₹{totalStockValue.toLocaleString()}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All distributors combined</CardContent>
        </Card>
        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Avg per Distributor</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">₹{totalDistributors > 0 ? Math.round(totalStockValue / totalDistributors).toLocaleString() : "0"}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <Package className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Average revenue</CardContent>
        </Card>
      </div>

      {/* Distributors Table */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Distributor Stock Summary</CardTitle>
                <CardDescription className="mt-0.5">Stock purchases by each distributor</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredDistributors.length} {filteredDistributors.length === 1 ? "distributor" : "distributors"}
              </Badge>
              {(searchTerm || startDate || endDate) && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search distributors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-[180px]"
                placeholder="From"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-[180px]"
                placeholder="To"
              />
              <Button onClick={fetchDistributorStock} disabled={loading}>
                Apply
              </Button>
              {(startDate || endDate) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate("")
                    setEndDate("")
                    setTimeout(fetchDistributorStock, 100)
                  }}
                >
                  Clear
                </Button>
              )}
              <Button variant="outline" onClick={exportToCSV} disabled={filteredDistributors.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Distributor</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Invoice Code</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total Orders</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total Quantity</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total Value</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Last Order</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDistributors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No distributors found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDistributors.map((distributor) => (
                    <TableRow key={distributor.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{distributor.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {distributor.company_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {distributor.invoice_code ? (
                          <Badge variant="outline" className="font-mono">
                            {distributor.invoice_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{distributor.total_orders}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {distributor.total_quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        ₹{distributor.total_value.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {distributor.last_order_date ? (
                          <span className="text-sm">
                            {new Date(distributor.last_order_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={distributor.is_active ? "default" : "secondary"} className="rounded-full capitalize">
                            {distributor.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {distributor.is_verified && (
                            <Badge variant="outline" className="text-green-600 rounded-full capitalize">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/warehouse-stock?distributor=${distributor.id}`}>
                            <Button variant="ghost" size="sm">
                              <Warehouse className="mr-2 h-4 w-4" />
                              View Stock
                            </Button>
                          </Link>
                          <Link href={`/dashboard/distributors/${distributor.id}/stock`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="mr-2 h-4 w-4" />
                              Stock Purchases
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredDistributors.length} of {distributors.length} distributors
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
