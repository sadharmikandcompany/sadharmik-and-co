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
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RefreshCw, Plus, Loader2, AlertTriangle, X, Bell, CheckCircle2, Search, Zap } from "lucide-react"
import { toast } from "sonner"

type ReorderRule = {
  id: string
  product_id: string
  warehouse_id: string | null
  reorder_point: number
  reorder_qty: number
  auto_po: boolean
  is_active: boolean
  product?: { name: string; stock: number } | null
  warehouse?: { name: string } | null
}

type Product = { id: string; name: string; stock: number }
type Warehouse = { id: string; name: string }

export default function ReorderManagementPage() {
  const [rules, setRules] = useState<ReorderRule[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Add rule modal
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newProductId, setNewProductId] = useState("")
  const [newWarehouseId, setNewWarehouseId] = useState("none")
  const [newReorderPoint, setNewReorderPoint] = useState("")
  const [newReorderQty, setNewReorderQty] = useState("")
  const [newAutoPo, setNewAutoPo] = useState("false")

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [rulesRes, productsRes, warehousesRes] = await Promise.all([
      supabase.from("reorder_rules").select(`*, product:products!reorder_rules_product_id_fkey(name, stock), warehouse:godowns!reorder_rules_warehouse_id_fkey(name)`).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, stock").eq("is_active", true).order("name"),
      supabase.from("godowns").select("id, name").eq("is_active", true).order("name"),
    ])

    if (rulesRes.error) {
      const { data: fallback } = await supabase.from("reorder_rules").select("*").order("created_at", { ascending: false })
      setRules(fallback || [])
    } else {
      setRules(rulesRes.data || [])
    }

    setProducts(productsRes.data || [])
    setWarehouses(warehousesRes.data || [])
    setLoading(false)
  }

  const handleAddRule = async () => {
    if (!newProductId || !newReorderPoint || !newReorderQty) {
      toast.error("Product, reorder point, and reorder quantity are required")
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from("reorder_rules").insert([{
        product_id: newProductId,
        warehouse_id: newWarehouseId === "none" ? null : newWarehouseId,
        reorder_point: parseFloat(newReorderPoint),
        reorder_qty: parseFloat(newReorderQty),
        auto_po: newAutoPo === "true",
        is_active: true,
      }])
      if (error) throw error
      toast.success("Reorder rule created")
      setIsAddOpen(false)
      setNewProductId(""); setNewWarehouseId("none"); setNewReorderPoint(""); setNewReorderQty(""); setNewAutoPo("false")
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to create rule")
    } finally { setSubmitting(false) }
  }

  const toggleRule = async (rule: ReorderRule) => {
    const { error } = await supabase.from("reorder_rules")
      .update({ is_active: !rule.is_active, updated_at: new Date().toISOString() })
      .eq("id", rule.id)
    if (error) { toast.error("Failed to update"); return }
    toast.success(rule.is_active ? "Rule deactivated" : "Rule activated")
    fetchData()
  }

  const filtered = rules.filter(r =>
    searchTerm === "" ||
    (r.product?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.warehouse?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const alertCount = rules.filter(r => r.is_active && r.product && Number(r.product.stock) <= Number(r.reorder_point)).length

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Reorder Management</h1>
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
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Reorder Management</h1>
            <p className="text-sm text-muted-foreground">Configure reorder points and automatic purchase alerts</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Rule</Button></DialogTrigger>
          <DialogContent className="p-0">
            <DialogHeader className="border-b bg-muted/30 px-6 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base">Add Reorder Rule</DialogTitle>
                  <DialogDescription className="mt-0.5">Set reorder point for a product</DialogDescription>
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
                <Label>Warehouse (optional)</Label>
                <Select value={newWarehouseId} onValueChange={setNewWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="All warehouses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Warehouses</SelectItem>
                    {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reorder Point *</Label>
                  <Input type="number" min="0" value={newReorderPoint} onChange={e => setNewReorderPoint(e.target.value)} placeholder="Min stock level" />
                </div>
                <div className="space-y-2">
                  <Label>Reorder Quantity *</Label>
                  <Input type="number" min="0" value={newReorderQty} onChange={e => setNewReorderQty(e.target.value)} placeholder="Qty to reorder" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Auto-generate PO</Label>
                <Select value={newAutoPo} onValueChange={setNewAutoPo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">No (Alert only)</SelectItem>
                    <SelectItem value="true">Yes (Auto PO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="border-t bg-muted/30 px-6 py-3">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRule} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : <><Plus className="mr-2 h-4 w-4" />Create Rule</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Total Rules</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{rules.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <RefreshCw className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Configured rules</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Active Rules</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{rules.filter(r => r.is_active).length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Currently enabled</CardContent>
        </Card>
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Reorder Alerts</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500 flex items-center gap-2">{alertCount > 0 && <Bell className="h-5 w-5" />}{alertCount}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Below reorder point</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Auto-PO Rules</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{rules.filter(r => r.auto_po).length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <Zap className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Auto-generate POs</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Reorder Rules</CardTitle>
                <CardDescription className="mt-0.5">Configured reorder points and alerts</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">{filtered.length} rules</Badge>
              {searchTerm && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search product, warehouse..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[220px] pl-8" />
            </div>
            {searchTerm && <Button variant="ghost" onClick={() => setSearchTerm("")}><X className="h-4 w-4 mr-1" />Clear</Button>}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Product</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Warehouse</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Current Stock</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Reorder Point</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Reorder Qty</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Auto PO</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Alert</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8">No reorder rules configured</TableCell></TableRow>
                ) : filtered.map(rule => {
                  const currentStock = Number(rule.product?.stock || 0)
                  const needsReorder = rule.is_active && currentStock <= Number(rule.reorder_point)
                  return (
                    <TableRow key={rule.id} className={`transition-colors hover:bg-muted/30 ${needsReorder ? "bg-red-50/60 dark:bg-rose-950/20" : ""}`}>
                      <TableCell className="font-medium">{rule.product?.name || "Unknown"}</TableCell>
                      <TableCell>{rule.warehouse?.name || "All"}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${needsReorder ? 'text-red-600' : ''}`}>{currentStock}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(rule.reorder_point)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(rule.reorder_qty)}</TableCell>
                      <TableCell>{rule.auto_po ? <Badge className="bg-blue-100 text-blue-800 rounded-full capitalize">Auto</Badge> : <Badge variant="secondary" className="rounded-full capitalize">Manual</Badge>}</TableCell>
                      <TableCell>{rule.is_active ? <Badge className="bg-green-100 text-green-800 rounded-full capitalize">Active</Badge> : <Badge variant="secondary" className="rounded-full capitalize">Inactive</Badge>}</TableCell>
                      <TableCell>
                        {needsReorder && <span className="flex items-center gap-1 text-red-600 text-sm font-medium"><AlertTriangle className="h-4 w-4" />Reorder</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleRule(rule)}>
                          {rule.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">Showing {filtered.length} of {rules.length} rules</div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
