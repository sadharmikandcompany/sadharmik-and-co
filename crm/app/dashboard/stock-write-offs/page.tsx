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
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Plus, Loader2, AlertTriangle, Search, IndianRupee, Boxes } from "lucide-react"
import { toast } from "sonner"

type WriteOff = {
  id: string
  product_id: string | null
  warehouse_id: string | null
  txn_type: string
  qty: number
  rate: number
  amount: number
  narration: string | null
  created_at: string
  product?: { name: string } | null
  warehouse?: { name: string } | null
}

type Product = { id: string; name: string; stock: number }
type Warehouse = { id: string; name: string }

export default function StockWriteOffsPage() {
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Add write-off
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newProductId, setNewProductId] = useState("")
  const [newWarehouseId, setNewWarehouseId] = useState("none")
  const [newQty, setNewQty] = useState("")
  const [newRate, setNewRate] = useState("")
  const [newReason, setNewReason] = useState("")
  const [newNarration, setNewNarration] = useState("")

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [writeOffsRes, productsRes, warehousesRes] = await Promise.all([
      supabase.from("stock_ledger").select(`*, product:products!stock_ledger_product_id_fkey(name), warehouse:godowns!stock_ledger_warehouse_id_fkey(name)`)
        .in("txn_type", ["WRITE_OFF", "ADJUSTMENT"]).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, stock").eq("is_active", true).order("name"),
      supabase.from("godowns").select("id, name").eq("is_active", true).order("name"),
    ])

    if (writeOffsRes.error) {
      const { data: fallback } = await supabase.from("stock_ledger").select("*").in("txn_type", ["WRITE_OFF", "ADJUSTMENT"]).order("created_at", { ascending: false })
      setWriteOffs(fallback || [])
    } else {
      setWriteOffs(writeOffsRes.data || [])
    }
    setProducts(productsRes.data || [])
    setWarehouses(warehousesRes.data || [])
    setLoading(false)
  }

  const handleAddWriteOff = async () => {
    if (!newProductId || !newQty || !newReason) {
      toast.error("Product, quantity, and reason are required")
      return
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const qty = parseFloat(newQty)
      const rate = parseFloat(newRate) || 0

      const { error } = await supabase.from("stock_ledger").insert([{
        product_id: newProductId,
        warehouse_id: newWarehouseId === "none" ? null : newWarehouseId,
        txn_type: newReason === "adjustment" ? "ADJUSTMENT" : "WRITE_OFF",
        qty: -Math.abs(qty), // negative for write-offs
        rate: rate,
        amount: -Math.abs(qty * rate),
        narration: `${newReason}: ${newNarration}`,
        created_by: user?.id || null,
      }])
      if (error) throw error
      toast.success("Stock write-off recorded")
      setIsAddOpen(false)
      setNewProductId(""); setNewWarehouseId("none"); setNewQty(""); setNewRate(""); setNewReason(""); setNewNarration("")
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to record write-off")
    } finally { setSubmitting(false) }
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)

  const filtered = writeOffs.filter(w =>
    searchTerm === "" ||
    (w.product?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.narration || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalWriteOffValue = writeOffs.reduce((s, w) => s + Math.abs(Number(w.amount || 0)), 0)
  const totalQty = writeOffs.reduce((s, w) => s + Math.abs(Number(w.qty || 0)), 0)

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Stock Write-offs</h1>
        </div>
      </div>
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Stock Write-offs & Adjustments</h1>
            <p className="text-sm text-muted-foreground">Record damaged, expired, or lost stock</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild><Button variant="destructive"><Plus className="mr-2 h-4 w-4" />Record Write-off</Button></DialogTrigger>
          <DialogContent className="p-0">
            <DialogHeader className="border-b bg-muted/30 px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base">Record Stock Write-off</DialogTitle>
                  <DialogDescription className="mt-0.5">Remove stock due to damage, expiry, or other reasons</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 px-4 pt-2 pb-4">
              <div className="space-y-2">
                <Label>Product *</Label>
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Select value={newWarehouseId} onValueChange={setNewWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Select value={newReason} onValueChange={setNewReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="lost">Lost / Missing</SelectItem>
                    <SelectItem value="quality_reject">Quality Rejected</SelectItem>
                    <SelectItem value="wastage">Wastage</SelectItem>
                    <SelectItem value="adjustment">Stock Adjustment (count correction)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Quantity *</Label><Input type="number" min="0" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="Units" /></div>
                <div className="space-y-2"><Label>Rate (₹)</Label><Input type="number" step="0.01" min="0" value={newRate} onChange={e => setNewRate(e.target.value)} placeholder="Cost per unit" /></div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={newNarration} onChange={e => setNewNarration(e.target.value)} placeholder="Additional details..." rows={2} /></div>
            </div>
            <DialogFooter className="border-t bg-muted/30 px-6 py-3">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleAddWriteOff} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</> : <><Trash2 className="mr-2 h-4 w-4" />Record Write-off</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Total Write-offs</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{writeOffs.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All recorded entries</CardContent>
        </Card>
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Total Value Lost</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{formatCurrency(totalWriteOffValue)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Cumulative value</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Total Qty Written Off</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{totalQty.toLocaleString("en-IN")}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Boxes className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Units removed</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Write-off History</CardTitle>
                <CardDescription className="mt-0.5">Damaged, expired, or lost stock entries</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">{filtered.length} entries</Badge>
              {searchTerm && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search product, notes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[220px] pl-8" />
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Product</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Warehouse</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Qty</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Rate</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Value</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Reason / Notes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">No write-offs recorded</TableCell></TableRow>
                ) : filtered.map(w => (
                  <TableRow key={w.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{w.product?.name || "Unknown"}</TableCell>
                    <TableCell>{w.warehouse?.name || "-"}</TableCell>
                    <TableCell><Badge variant={w.txn_type === "WRITE_OFF" ? "destructive" : "secondary"} className="rounded-full capitalize">{w.txn_type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums text-red-600">{Math.abs(Number(w.qty))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(w.rate))}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-600 font-medium">{formatCurrency(Math.abs(Number(w.amount)))}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{w.narration || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">Showing {filtered.length} of {writeOffs.length} write-off entries</div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
