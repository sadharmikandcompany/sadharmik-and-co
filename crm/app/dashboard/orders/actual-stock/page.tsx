"use client"

import { useEffect, useState, useMemo } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Package, Search, RefreshCw, Boxes, TrendingUp, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { ExportButtons } from "@/components/export-buttons"

type ActualStockRow = {
  id: string
  name: string
  brand: string | null
  hsn_code: string | null
  current_stock: number // total across all godowns (post-deduction)
  reserved_quantity: number // sum of undelivered customer order item qty
  actual_stock: number // current_stock + reserved_quantity
  customer_price: number
  pending_orders_count: number
}

const PENDING_STATUSES = ["pending", "confirmed", "processing", "shipped"]

export default function ActualStockPage() {
  const [rows, setRows] = useState<ActualStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showOnlyWithReserved, setShowOnlyWithReserved] = useState(false)

  useEffect(() => {
    fetchActualStock()
  }, [])

  const fetchActualStock = async () => {
    setLoading(true)
    try {
      // 1. Fetch active products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, brand, hsn_code, customer_price, is_active")
        .eq("is_active", true)
        .order("name")

      if (productsError) throw productsError

      // 2. Fetch godown_stock aggregated per product across all godowns
      // (source of truth for current physical stock after order deductions)
      const { data: stockData, error: stockError } = await supabase
        .from("godown_stock")
        .select(`
          quantity,
          stock_inventory!inner (
            product_id
          )
        `)

      if (stockError) throw stockError

      const stockMap = new Map<string, number>()
      ;((stockData as any[]) || []).forEach((row: any) => {
        const pid = row.stock_inventory?.product_id
        if (!pid) return
        stockMap.set(pid, (stockMap.get(pid) || 0) + (row.quantity || 0))
      })

      // 3. Fetch pending customer order items.
      // Only customer orders deduct from the total — distributor/retailer orders
      // move stock between godowns (net zero on the aggregate).
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          product_id,
          order_id,
          quantity,
          orders!inner (
            order_status,
            distributor_id,
            retailer_id,
            customer_id
          )
        `)
        .in("orders.order_status", PENDING_STATUSES)
        .is("orders.distributor_id", null)
        .is("orders.retailer_id", null)
        .not("orders.customer_id", "is", null)

      if (itemsError) throw itemsError

      const reservedMap = new Map<string, number>()
      const ordersCountMap = new Map<string, Set<string>>()

      ;((itemsData as any[]) || []).forEach((item: any) => {
        if (!item.product_id) return
        reservedMap.set(
          item.product_id,
          (reservedMap.get(item.product_id) || 0) + (item.quantity || 0)
        )
        if (item.order_id) {
          if (!ordersCountMap.has(item.product_id)) {
            ordersCountMap.set(item.product_id, new Set())
          }
          ordersCountMap.get(item.product_id)!.add(item.order_id)
        }
      })

      const mapped: ActualStockRow[] = (productsData || []).map((p: any) => {
        const current = stockMap.get(p.id) || 0
        const reserved = reservedMap.get(p.id) || 0
        return {
          id: p.id,
          name: p.name,
          brand: p.brand,
          hsn_code: p.hsn_code,
          current_stock: current,
          reserved_quantity: reserved,
          actual_stock: current + reserved,
          customer_price: p.customer_price || 0,
          pending_orders_count: ordersCountMap.get(p.id)?.size || 0,
        }
      })

      setRows(mapped)
    } catch (error: any) {
      console.error("Error fetching actual stock:", error)
      toast.error(error?.message || "Failed to fetch actual stock")
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        searchTerm === "" ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.brand && r.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.hsn_code && r.hsn_code.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesReserved = !showOnlyWithReserved || r.reserved_quantity > 0
      return matchesSearch && matchesReserved
    })
  }, [rows, searchTerm, showOnlyWithReserved])

  const totalProducts = filteredRows.length
  const totalCurrentStock = filteredRows.reduce((sum, r) => sum + r.current_stock, 0)
  const totalReserved = filteredRows.reduce((sum, r) => sum + r.reserved_quantity, 0)
  const totalActualStock = filteredRows.reduce((sum, r) => sum + r.actual_stock, 0)
  const totalActualValue = filteredRows.reduce(
    (sum, r) => sum + r.actual_stock * r.customer_price,
    0
  )
  const productsWithReservations = filteredRows.filter((r) => r.reserved_quantity > 0).length

  const exportData = filteredRows.map((r) => ({
    "Product Name": r.name,
    Brand: r.brand || "",
    "HSN Code": r.hsn_code || "",
    "Current Stock (All Godowns)": r.current_stock,
    "Reserved in Pending Customer Orders": r.reserved_quantity,
    "Pending Orders Count": r.pending_orders_count,
    "Actual Physical Stock": r.actual_stock,
    "Unit Price": r.customer_price,
    "Actual Stock Value": r.actual_stock * r.customer_price,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Package className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Actual Physical Stock</h1>
            <p className="text-sm text-muted-foreground">
              Physical stock currently in hand, including items already deducted for pending
              (undelivered) customer orders. Aggregated across all godowns from{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">godown_stock</code>.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchActualStock} disabled={loading} className="ml-auto shrink-0">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Products */}
        <Card>
          <CardHeader>
            <CardDescription>Products</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {totalProducts.toLocaleString("en-IN")}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Package className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <span className="tabular-nums">{productsWithReservations}</span> with pending orders
          </CardContent>
        </Card>

        {/* Current Stock */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader>
            <CardDescription>Current Stock</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {totalCurrentStock.toLocaleString("en-IN")}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Boxes className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            After order deductions
          </CardContent>
        </Card>

        {/* Reserved */}
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader>
            <CardDescription>Reserved (Pending)</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
              {totalReserved.toLocaleString("en-IN")}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Deducted but not delivered
          </CardContent>
        </Card>

        {/* Actual Physical Stock */}
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardHeader>
            <CardDescription>Actual Physical Stock</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalActualStock.toLocaleString("en-IN")}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            ₹<span className="tabular-nums">{totalActualValue.toLocaleString("en-IN")}</span> value
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 max-w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-base">Stock Breakdown</CardTitle>
              <CardDescription className="text-sm">
                Actual stock = current godown stock + quantities locked in undelivered customer
                orders ({PENDING_STATUSES.join(", ")}). Distributor/retailer orders are excluded
                as they move stock between godowns (net zero on total).
              </CardDescription>
            </div>
            <ExportButtons
              data={exportData}
              filename="actual-physical-stock"
              pdfTitle="Actual Physical Stock Report"
            />
          </div>
          <div className="flex items-center gap-3 pt-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, brand, HSN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={showOnlyWithReserved ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyWithReserved((v) => !v)}
            >
              {showOnlyWithReserved ? "Showing only reserved" : "Show only with pending orders"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          <div className="w-0 min-w-full max-w-full overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
                <p className="mt-3 text-sm text-muted-foreground">Calculating actual stock…</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reserved (Pending)</TableHead>
                    <TableHead className="text-right">Pending Orders</TableHead>
                    <TableHead className="text-right">Actual Physical Stock</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Actual Stock Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          {r.brand || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.hsn_code || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              r.current_stock < 0
                                ? "text-red-600 font-medium"
                                : r.current_stock < 10 && r.current_stock > 0
                                ? "text-orange-600 font-medium"
                                : ""
                            }
                          >
                            {r.current_stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.reserved_quantity > 0 ? (
                            <Badge variant="secondary">{r.reserved_quantity}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.pending_orders_count > 0 ? (
                            <Badge variant="outline">{r.pending_orders_count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {r.actual_stock}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{r.customer_price.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{(r.actual_stock * r.customer_price).toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
