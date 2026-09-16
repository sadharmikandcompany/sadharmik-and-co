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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ClipboardList, CalendarIcon, X, Search, ArrowDownCircle, ArrowUpCircle, Package } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type StockLedgerEntry = {
  id: string
  product_id: string | null
  variant_id: string | null
  warehouse_id: string | null
  txn_type: string
  qty: number
  rate: number
  amount: number
  reference_type: string | null
  reference_id: string | null
  balance_qty: number
  balance_value: number
  narration: string | null
  created_at: string
  product?: { name: string } | null
  warehouse?: { name: string } | null
}

export default function StockLedgerPage() {
  const [entries, setEntries] = useState<StockLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [txnTypeFilter, setTxnTypeFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  // Products and warehouses for filter
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [productFilter, setProductFilter] = useState<string>("all")
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    const [entriesRes, productsRes, warehousesRes] = await Promise.all([
      supabase.from("stock_ledger").select(`*, product:products!stock_ledger_product_id_fkey(name), warehouse:godowns!stock_ledger_warehouse_id_fkey(name)`).order("created_at", { ascending: false }).limit(500),
      supabase.from("products").select("id, name").eq("is_active", true).order("name"),
      supabase.from("godowns").select("id, name").eq("is_active", true).order("name"),
    ])

    if (entriesRes.error) {
      // Fallback without joins
      const { data } = await supabase.from("stock_ledger").select("*").order("created_at", { ascending: false }).limit(500)
      setEntries(data || [])
    } else {
      setEntries(entriesRes.data || [])
    }

    setProducts(productsRes.data || [])
    setWarehouses(warehousesRes.data || [])
    setLoading(false)
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
  const formatQty = (qty: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(qty)

  const filtered = entries.filter(e => {
    const matchesSearch = searchTerm === "" ||
      (e.product?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.warehouse?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.narration || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTxn = txnTypeFilter === "all" || e.txn_type === txnTypeFilter
    const matchesProduct = productFilter === "all" || e.product_id === productFilter
    const matchesWarehouse = warehouseFilter === "all" || e.warehouse_id === warehouseFilter
    const d = new Date(e.created_at)
    const matchesFrom = !dateFrom || d >= dateFrom
    const matchesTo = !dateTo || d <= dateTo
    return matchesSearch && matchesTxn && matchesProduct && matchesWarehouse && matchesFrom && matchesTo
  })

  const getTxnBadgeColor = (type: string) => {
    if (type.includes("RECEIPT") || type.includes("IN") || type === "OPENING_BALANCE") return "bg-green-100 text-green-800"
    if (type.includes("ISSUE") || type.includes("OUT") || type === "WRITE_OFF") return "bg-red-100 text-red-800"
    return "bg-blue-100 text-blue-800"
  }

  const clearFilters = () => { setSearchTerm(""); setTxnTypeFilter("all"); setProductFilter("all"); setWarehouseFilter("all"); setDateFrom(undefined); setDateTo(undefined) }
  const hasFilters = searchTerm || txnTypeFilter !== "all" || productFilter !== "all" || warehouseFilter !== "all" || dateFrom || dateTo

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Stock Ledger</h1>
        </div>
      </div>
      <div className="flex items-center justify-center py-16">
        <ClipboardList className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Stock Ledger</h1>
            <p className="text-sm text-muted-foreground">Immutable record of all inventory movements</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Total Entries</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{entries.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <ClipboardList className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All movements</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Receipts</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{entries.filter(e => e.qty > 0).length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <ArrowDownCircle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Stock in</CardContent>
        </Card>
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Issues</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{entries.filter(e => e.qty < 0).length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <ArrowUpCircle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Stock out</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Products Tracked</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{new Set(entries.map(e => e.product_id)).size}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <Package className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Unique SKUs</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Movement History</CardTitle>
                <CardDescription className="mt-0.5">Every stock movement recorded as an immutable entry</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">{filtered.length} entries</Badge>
              {hasFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[220px] pl-8" />
            </div>
            <Select value={txnTypeFilter} onValueChange={setTxnTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Transaction Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PURCHASE_RECEIPT">Purchase Receipt</SelectItem>
                <SelectItem value="SALE_ISSUE">Sale Issue</SelectItem>
                <SelectItem value="TRANSFER_IN">Transfer In</SelectItem>
                <SelectItem value="TRANSFER_OUT">Transfer Out</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                <SelectItem value="WRITE_OFF">Write-off</SelectItem>
                <SelectItem value="OPENING_BALANCE">Opening Balance</SelectItem>
                <SelectItem value="RETURN_IN">Return In</SelectItem>
                <SelectItem value="RETURN_OUT">Return Out</SelectItem>
                <SelectItem value="PRODUCTION_IN">Production In</SelectItem>
                <SelectItem value="PRODUCTION_OUT">Production Out</SelectItem>
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Warehouse" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full sm:w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dateFrom ? format(dateFrom, "dd/MM/yy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full sm:w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dateTo ? format(dateTo, "dd/MM/yy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus /></PopoverContent>
            </Popover>
            {hasFilters && <Button variant="ghost" onClick={clearFilters}><X className="h-4 w-4 mr-1" />Clear</Button>}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Product</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Warehouse</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Qty</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Rate</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Amount</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Bal Qty</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Bal Value</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Narration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8">No stock ledger entries found</TableCell></TableRow>
                ) : filtered.map(e => (
                  <TableRow key={e.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="text-sm whitespace-nowrap">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{e.product?.name || "-"}</TableCell>
                    <TableCell>{e.warehouse?.name || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTxnBadgeColor(e.txn_type)}`}>
                        {e.txn_type.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${Number(e.qty) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatQty(Number(e.qty))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(e.rate))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(e.amount))}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatQty(Number(e.balance_qty))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(e.balance_value))}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm">{e.narration || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">Showing {filtered.length} of {entries.length} entries</div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
