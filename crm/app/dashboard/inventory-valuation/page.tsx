"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { BarChart3, X, Search, IndianRupee, Package, Layers, Percent } from "lucide-react"
import { toast } from "sonner"

type ValuationRow = {
  product_id: string
  product_name: string
  brand: string | null
  hsn_code: string | null
  total_qty: number
  avg_cost: number
  total_value: number
  selling_price: number
  margin_pct: number
}

export default function InventoryValuationPage() {
  const [rows, setRows] = useState<ValuationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<string>("value_desc")

  useEffect(() => {
    fetchValuation()
  }, [])

  const fetchValuation = async () => {
    setLoading(true)
    try {
      // Get stock inventory with product info
      const { data: stockData, error: stockError } = await supabase
        .from("stock_inventory")
        .select(`
          id, quantity, price,
          product:products!stock_inventory_product_id_fkey(id, name, brand, hsn_code, customer_price)
        `)
        .gt("quantity", 0)

      if (stockError) {
        // Fallback: try without foreign key name
        const { data: fallback } = await supabase
          .from("stock_inventory")
          .select("id, quantity, price, product_id")
          .gt("quantity", 0)

        if (fallback) {
          const productIds = [...new Set(fallback.map(s => s.product_id).filter(Boolean))]
          const { data: products } = await supabase.from("products").select("id, name, brand, hsn_code, customer_price").in("id", productIds)

          const productMap = new Map((products || []).map(p => [p.id, p]))
          const grouped = new Map<string, { qty: number; totalCost: number; product: any }>()

          fallback.forEach(s => {
            if (!s.product_id) return
            const existing = grouped.get(s.product_id) || { qty: 0, totalCost: 0, product: productMap.get(s.product_id) }
            existing.qty += Number(s.quantity || 0)
            existing.totalCost += Number(s.quantity || 0) * Number(s.price || 0)
            grouped.set(s.product_id, existing)
          })

          const result: ValuationRow[] = Array.from(grouped.entries()).map(([pid, data]) => {
            const avgCost = data.qty > 0 ? data.totalCost / data.qty : 0
            const sellingPrice = Number(data.product?.customer_price || 0)
            const marginPct = sellingPrice > 0 ? ((sellingPrice - avgCost) / sellingPrice) * 100 : 0
            return {
              product_id: pid,
              product_name: data.product?.name || "Unknown",
              brand: data.product?.brand || null,
              hsn_code: data.product?.hsn_code || null,
              total_qty: data.qty,
              avg_cost: avgCost,
              total_value: data.totalCost,
              selling_price: sellingPrice,
              margin_pct: marginPct,
            }
          })
          setRows(result)
          setLoading(false)
          return
        }
      }

      // Process with joins
      const grouped = new Map<string, { qty: number; totalCost: number; product: any }>()
      ;(stockData || []).forEach((s: any) => {
        const pid = s.product?.id
        if (!pid) return
        const existing = grouped.get(pid) || { qty: 0, totalCost: 0, product: s.product }
        existing.qty += Number(s.quantity || 0)
        existing.totalCost += Number(s.quantity || 0) * Number(s.price || 0)
        grouped.set(pid, existing)
      })

      const result: ValuationRow[] = Array.from(grouped.entries()).map(([pid, data]) => {
        const avgCost = data.qty > 0 ? data.totalCost / data.qty : 0
        const sellingPrice = Number(data.product?.customer_price || 0)
        const marginPct = sellingPrice > 0 ? ((sellingPrice - avgCost) / sellingPrice) * 100 : 0
        return {
          product_id: pid,
          product_name: data.product?.name || "Unknown",
          brand: data.product?.brand || null,
          hsn_code: data.product?.hsn_code || null,
          total_qty: data.qty,
          avg_cost: avgCost,
          total_value: data.totalCost,
          selling_price: sellingPrice,
          margin_pct: marginPct,
        }
      })

      setRows(result)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load inventory valuation")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)

  const filtered = rows.filter(r => {
    return searchTerm === "" ||
      r.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.brand || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.hsn_code || "").toLowerCase().includes(searchTerm.toLowerCase())
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "value_desc": return b.total_value - a.total_value
      case "value_asc": return a.total_value - b.total_value
      case "qty_desc": return b.total_qty - a.total_qty
      case "margin_desc": return b.margin_pct - a.margin_pct
      case "margin_asc": return a.margin_pct - b.margin_pct
      case "name_asc": return a.product_name.localeCompare(b.product_name)
      default: return b.total_value - a.total_value
    }
  })

  const totalStockValue = rows.reduce((s, r) => s + r.total_value, 0)
  const totalItems = rows.reduce((s, r) => s + r.total_qty, 0)
  const avgMargin = rows.length > 0 ? rows.reduce((s, r) => s + r.margin_pct, 0) / rows.length : 0

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Inventory Valuation</h1>
        </div>
      </div>
      <div className="flex items-center justify-center py-16">
        <BarChart3 className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Inventory Valuation</h1>
            <p className="text-sm text-muted-foreground">Weighted Average Cost (WAC) valuation of current stock</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Stock Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{formatCurrency(totalStockValue)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">WAC valuation</CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Total Products</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{rows.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Layers className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Distinct SKUs</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Total Units</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{totalItems.toLocaleString("en-IN")}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <Package className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across all products</CardContent>
        </Card>
        <Card className={`h-full ${avgMargin >= 0 ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40' : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40'}`}>
          <CardHeader>
            <CardDescription>Avg Margin</CardDescription>
            <CardTitle className={`text-2xl font-bold tabular-nums ${avgMargin >= 0 ? 'text-amber-600 dark:text-amber-500' : 'text-rose-600 dark:text-rose-500'}`}>{avgMargin.toFixed(1)}%</CardTitle>
            <CardAction>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${avgMargin >= 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500'}`}>
                <Percent className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Cost vs selling price</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/50">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Product-wise Valuation</CardTitle>
                <CardDescription className="mt-0.5">Current inventory value using Weighted Average Cost</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">{sorted.length} products</Badge>
              {searchTerm && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search product, brand, HSN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[220px] pl-8" />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="value_desc">Value (High to Low)</SelectItem>
                <SelectItem value="value_asc">Value (Low to High)</SelectItem>
                <SelectItem value="qty_desc">Quantity (High to Low)</SelectItem>
                <SelectItem value="margin_desc">Margin (High to Low)</SelectItem>
                <SelectItem value="margin_asc">Margin (Low to High)</SelectItem>
                <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
            {searchTerm && <Button variant="ghost" onClick={() => setSearchTerm("")}><X className="h-4 w-4 mr-1" />Clear</Button>}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Product</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Brand</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">HSN</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Qty</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Avg Cost</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Stock Value</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Selling Price</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">No inventory data</TableCell></TableRow>
                ) : sorted.map(row => (
                  <TableRow key={row.product_id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">{row.product_name}</TableCell>
                    <TableCell>{row.brand || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{row.hsn_code || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.total_qty.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.avg_cost)}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">{formatCurrency(row.total_value)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.selling_price > 0 ? formatCurrency(row.selling_price) : "-"}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${row.margin_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.selling_price > 0 ? `${row.margin_pct.toFixed(1)}%` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3} className="text-right">Grand Total</TableCell>
                  <TableCell className="text-right tabular-nums">{filtered.reduce((s, r) => s + r.total_qty, 0).toLocaleString("en-IN")}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatCurrency(filtered.reduce((s, r) => s + r.total_value, 0))}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">Showing {sorted.length} of {rows.length} products</div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
