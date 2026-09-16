"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Save,
  ArrowLeft,
  Factory,
  Building2,
  Store,
  Warehouse,
  Package,
  Boxes,
  ClipboardList,
  CalendarCheck,
  Layers,
  Pencil,
  Trash2,
  IndianRupee,
  Plus,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useUserRole } from "@/hooks/use-user-role"

export type OpeningStockType = "warehouse" | "distributor" | "retailer" | "manufacturing"

type Product = {
  id: string
  name: string
  sku: string | null
  parent_category_id: string | null
  sub_category_id: string | null
}

// Same Category → Sub-Category → Product cascading pattern as the New Order
// page (app/dashboard/orders/new) — categories are self-referential via
// parent_category_id (null = a top-level category, set = a sub-category
// under that parent).
type Category = {
  id: string
  category_name: string
  parent_category_id: string | null
}

type Godown = {
  id: string
  name: string
  godown_code: string | null
}

type Counterparty = {
  id: string
  name: string
  company_name: string | null
}

// Mirrors the role-based user lookup pattern used elsewhere
// (e.g. app/dashboard/vendors/page.tsx :: fetch users with role=vendor).
type Factory = {
  id: string
  full_name: string | null
  email: string | null
}

type RecentEntry = {
  id: string
  opening_date: string
  quantity: number
  unit_price: number
  amount: number
  product_name: string | null
  sku: string | null
  location_name: string | null
  notes: string | null
}

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n)

const CONFIG: Record<
  OpeningStockType,
  {
    title: string
    description: string
    locationColumnLabel: string
    listHref: string
    Icon: typeof Package
  }
> = {
  warehouse: {
    title: "Warehouse Opening Stock",
    description: "Record opening stock balance for a warehouse",
    locationColumnLabel: "Warehouse",
    listHref: "/dashboard/warehouse-stock",
    Icon: Warehouse,
  },
  distributor: {
    title: "Distributor Opening Stock",
    description: "Record opening stock balance for a distributor",
    locationColumnLabel: "Distributor",
    listHref: "/dashboard/distributor-stock",
    Icon: Building2,
  },
  retailer: {
    title: "Retailer Opening Stock",
    description: "Record opening stock balance for a retailer",
    locationColumnLabel: "Retailer",
    listHref: "/dashboard/retailer-stock",
    Icon: Store,
  },
  manufacturing: {
    title: "Manufacturing Opening Stock",
    description: "Record opening finished-product stock at manufacturing",
    locationColumnLabel: "Factory Warehouse",
    listHref: "/dashboard/factory-dashboard",
    Icon: Factory,
  },
}

export function OpeningStockForm({ stockType }: { stockType: OpeningStockType }) {
  const router = useRouter()
  const cfg = CONFIG[stockType]
  const Icon = cfg.Icon
  const { role } = useUserRole()
  const isAdmin = role === "admin"

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [godowns, setGodowns] = useState<Godown[]>([])
  const [distributors, setDistributors] = useState<Counterparty[]>([])
  const [retailers, setRetailers] = useState<Counterparty[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  const [recent, setRecent] = useState<RecentEntry[]>([])
  const [stats, setStats] = useState({
    totalEntries: 0,
    productsTracked: 0,
    totalQuantity: 0,
    totalAmount: 0,
    lastEntryDate: null as string | null,
  })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<RecentEntry | null>(null)
  const [editForm, setEditForm] = useState({ quantity: "", unit_price: "", opening_date: "", notes: "" })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState<RecentEntry | null>(null)
  const [deletingInFlight, setDeletingInFlight] = useState(false)

  // Shared across the whole batch — you're recording one location's stock as
  // of one date, just for several products at once, so these don't repeat
  // per row like product/quantity/price do.
  const [form, setForm] = useState({
    opening_date: new Date().toISOString().slice(0, 10),
    godown_id: "",
    distributor_id: "",
    retailer_id: "",
    // For stockType === "manufacturing": id of the user with role='factories'.
    // Persisted into opening_stock_entries.created_by (FK → users.id) since
    // godown_id is FK'd to godowns and cannot hold a user id.
    factory_user_id: "",
    notes: "",
  })

  // One row per product — this is what makes the form reusable for entering
  // a whole opening stock count in one sitting instead of one product, save,
  // repeat. Each row keeps its own client-side key so React can track it
  // correctly as rows are added/removed out of order. category_id/
  // sub_category_id are just per-row narrowing filters for the product
  // picker (mirrors the New Order page) — only product_id actually gets
  // saved.
  type ProductRow = {
    key: string
    category_id: string
    sub_category_id: string
    product_id: string
    quantity: string
    unit_price: string
  }
  const newRow = (): ProductRow => ({
    key: Math.random().toString(36).slice(2),
    category_id: "",
    sub_category_id: "",
    product_id: "",
    quantity: "",
    unit_price: "",
  })
  const [rows, setRows] = useState<ProductRow[]>([newRow()])

  const updateRow = (key: string, patch: Partial<ProductRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const addRow = () => setRows((prev) => [...prev, newRow()])
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev))

  const parentCategories = categories.filter((c) => c.parent_category_id === null)
  const subCategoriesFor = (parentId: string) =>
    parentId ? categories.filter((c) => c.parent_category_id === parentId) : []
  const productsFor = (row: ProductRow) =>
    products.filter((p) => {
      if (row.category_id && p.parent_category_id !== row.category_id) return false
      if (row.sub_category_id && p.sub_category_id !== row.sub_category_id) return false
      return true
    })

  const rowsTotal = rows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity) || 0
    const price = parseFloat(r.unit_price) || 0
    return sum + qty * price
  }, 0)

  const fetchRecentAndStats = useCallback(async () => {
    const { data, error } = await supabase
      .from("opening_stock_entries")
      .select(
        `id, opening_date, quantity, unit_price, sku, notes, product_id, godown_id, distributor_id, retailer_id, created_by,
         products ( name ),
         godowns ( name ),
         distributors ( name ),
         retailers ( name ),
         users:created_by ( full_name, email )`
      )
      .eq("stock_type", stockType)
      .order("opening_date", { ascending: false })
      .limit(50)

    if (error || !data) {
      setRecent([])
      setStats({ totalEntries: 0, productsTracked: 0, totalQuantity: 0, totalAmount: 0, lastEntryDate: null })
      return
    }

    type UserRel = { full_name: string | null; email: string | null }
    type Row = {
      id: string
      opening_date: string
      quantity: number
      unit_price: number | null
      sku: string | null
      notes: string | null
      product_id: string | null
      godown_id: string | null
      distributor_id: string | null
      retailer_id: string | null
      created_by: string | null
      products?: { name: string } | { name: string }[] | null
      godowns?: { name: string } | { name: string }[] | null
      distributors?: { name: string } | { name: string }[] | null
      retailers?: { name: string } | { name: string }[] | null
      users?: UserRel | UserRel[] | null
    }
    const pickName = (rel: Row["products"]): string | null => {
      if (!rel) return null
      if (Array.isArray(rel)) return rel[0]?.name ?? null
      return rel.name ?? null
    }
    const pickUserLabel = (rel: Row["users"]): string | null => {
      if (!rel) return null
      const u = Array.isArray(rel) ? rel[0] : rel
      if (!u) return null
      return u.full_name || u.email || null
    }
    const rows = (data as unknown as Row[]).map<RecentEntry>((r) => {
      const qty = Number(r.quantity || 0)
      const price = Number(r.unit_price || 0)
      return {
        id: r.id,
        opening_date: r.opening_date,
        quantity: qty,
        unit_price: price,
        amount: qty * price,
        sku: r.sku,
        notes: r.notes,
        product_name: pickName(r.products),
        location_name:
          stockType === "warehouse"
            ? pickName(r.godowns)
            : stockType === "manufacturing"
            ? pickUserLabel(r.users)
            : stockType === "distributor"
            ? pickName(r.distributors)
            : pickName(r.retailers),
      }
    })

    const productIds = new Set<string>()
    let totalQty = 0
    let totalAmount = 0
    ;(data as unknown as Row[]).forEach((r) => {
      if (r.product_id) productIds.add(r.product_id)
      const qty = Number(r.quantity || 0)
      totalQty += qty
      totalAmount += qty * Number(r.unit_price || 0)
    })

    setRecent(rows.slice(0, 10))
    setStats({
      totalEntries: rows.length,
      productsTracked: productIds.size,
      totalQuantity: totalQty,
      totalAmount,
      lastEntryDate: rows[0]?.opening_date ?? null,
    })
  }, [stockType])

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, parent_category_id, sub_category_id")
        .eq("is_active", true)
        .order("name")
      if (!error && data) setProducts(data)
    })()

    void (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, category_name, parent_category_id")
        .eq("is_active", true)
        .order("category_name")
      if (!error && data) setCategories(data)
    })()

    if (stockType === "warehouse") {
      void (async () => {
        const { data, error } = await supabase
          .from("godowns")
          .select("id, name, godown_code")
          .eq("is_active", true)
          .order("name")
        if (!error && data) setGodowns(data)
      })()
    }
    if (stockType === "manufacturing") {
      // Manufacturing opening stock belongs to a factory user, not a godown.
      // Same pattern as app/dashboard/vendors/page.tsx for role-filtered users.
      void (async () => {
        const { data, error } = await supabase
          .from("users")
          .select("id, full_name, email")
          .eq("role", "factories")
          .order("full_name")
        if (!error && data) setFactories(data)
      })()
    }
    if (stockType === "distributor") {
      void (async () => {
        const { data, error } = await supabase
          .from("distributors")
          .select("id, name, company_name")
          .eq("is_active", true)
          .order("name")
        if (!error && data) setDistributors(data)
      })()
    }
    if (stockType === "retailer") {
      void (async () => {
        const { data, error } = await supabase
          .from("retailers")
          .select("id, name, company_name")
          .eq("is_active", true)
          .order("name")
        if (!error && data) setRetailers(data)
      })()
    }

    void fetchRecentAndStats()
  }, [stockType, fetchRecentAndStats])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Rows left completely blank (an extra "+ Add Product" the user didn't
    // end up using) are silently dropped rather than treated as errors —
    // only rows with a product actually selected have to be complete.
    const candidateRows = rows.filter((r) => r.product_id || r.quantity || r.unit_price)
    if (candidateRows.length === 0) {
      toast.error("Please add at least one product")
      return
    }
    for (const r of candidateRows) {
      if (!r.product_id) {
        toast.error("Every row needs a product selected")
        return
      }
      const qty = parseFloat(r.quantity)
      if (!r.quantity || Number.isNaN(qty) || qty < 0) {
        toast.error("Please enter a valid quantity for every product")
        return
      }
      const price = r.unit_price === "" ? 0 : parseFloat(r.unit_price)
      if (Number.isNaN(price) || price < 0) {
        toast.error("Please enter a valid unit price for every product")
        return
      }
    }
    const duplicateProductIds = candidateRows
      .map((r) => r.product_id)
      .filter((id, i, arr) => arr.indexOf(id) !== i)
    if (duplicateProductIds.length > 0) {
      toast.error("The same product is selected in more than one row — combine them into a single row instead")
      return
    }
    if (!form.opening_date) {
      toast.error("Please pick a date")
      return
    }
    if (stockType === "warehouse" && !form.godown_id) {
      toast.error("Please select a warehouse")
      return
    }
    if (stockType === "distributor" && !form.distributor_id) {
      toast.error("Please select a distributor")
      return
    }
    if (stockType === "retailer" && !form.retailer_id) {
      toast.error("Please select a retailer")
      return
    }

    setSaving(true)
    try {
      const payloads = candidateRows.map((r) => {
        const selectedProduct = products.find((p) => p.id === r.product_id)
        const qty = parseFloat(r.quantity)
        const price = r.unit_price === "" ? 0 : parseFloat(r.unit_price)
        const payload: Record<string, unknown> = {
          stock_type: stockType,
          product_id: r.product_id,
          sku: selectedProduct?.sku ?? null,
          quantity: qty,
          unit_price: price,
          opening_date: form.opening_date,
          godown_id: stockType === "warehouse" ? form.godown_id : null,
          distributor_id: stockType === "distributor" ? form.distributor_id : null,
          retailer_id: stockType === "retailer" ? form.retailer_id : null,
          // Manufacturing: tag the entry with the selected factory user so the
          // factory dashboard can attribute the opening balance correctly.
          created_by:
            stockType === "manufacturing" && form.factory_user_id
              ? form.factory_user_id
              : null,
          notes: form.notes || null,
        }
        return payload
      })

      const { error } = await supabase.from("opening_stock_entries").insert(payloads)
      if (error) throw error

      toast.success(
        payloads.length === 1 ? "Opening stock saved" : `${payloads.length} opening stock entries saved`
      )
      setForm({
        opening_date: new Date().toISOString().slice(0, 10),
        godown_id: "",
        distributor_id: "",
        retailer_id: "",
        factory_user_id: "",
        notes: "",
      })
      setRows([newRow()])
      void fetchRecentAndStats()
    } catch (err: unknown) {
      console.error("Error saving opening stock:", err)
      const msg = err instanceof Error ? err.message : "Failed to save opening stock"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{cfg.title}</h1>
            <p className="text-sm text-muted-foreground">{cfg.description}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push(cfg.listHref)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardDescription>Total Entries</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {stats.totalEntries.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ClipboardList className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Opening-stock records logged
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Products Tracked</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {stats.productsTracked.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Boxes className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Distinct products with openings
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Quantity</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {stats.totalQuantity.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Layers className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Units across all entries
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader>
            <CardDescription>Total Amount</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
              {formatINR(stats.totalAmount)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Value across all entries
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardHeader>
            <CardDescription>Last Entry</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {stats.lastEntryDate
                ? new Date(stats.lastEntryDate).toLocaleDateString()
                : "—"}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60">
                <CalendarCheck className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Most recent opening date
          </CardContent>
        </Card>
      </div>

      {/* Entry Form Card */}
      <form onSubmit={handleSubmit}>
        <Card className="w-full max-w-full overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">New Opening Stock Entry</CardTitle>
                  <CardDescription className="mt-0.5">
                    One date and location for the batch — add as many products below as you need, then save them all together
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
                {stockType}
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-5 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opening_date">
                  Opening Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="opening_date"
                  type="date"
                  value={form.opening_date}
                  onChange={(e) => setForm({ ...form, opening_date: e.target.value })}
                  required
                />
              </div>

              {stockType === "warehouse" && (
                <div className="space-y-2">
                  <Label htmlFor="godown_id">
                    Warehouse <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.godown_id}
                    onValueChange={(value) => setForm({ ...form, godown_id: value })}
                  >
                    <SelectTrigger id="godown_id">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {godowns.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                          {g.godown_code ? ` (${g.godown_code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {stockType === "distributor" && (
                <div className="space-y-2">
                  <Label htmlFor="distributor_id">
                    Distributor <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.distributor_id}
                    onValueChange={(value) => setForm({ ...form, distributor_id: value })}
                  >
                    <SelectTrigger id="distributor_id">
                      <SelectValue placeholder="Select distributor" />
                    </SelectTrigger>
                    <SelectContent>
                      {distributors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                          {d.company_name ? ` (${d.company_name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {stockType === "retailer" && (
                <div className="space-y-2">
                  <Label htmlFor="retailer_id">
                    Retailer <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.retailer_id}
                    onValueChange={(value) => setForm({ ...form, retailer_id: value })}
                  >
                    <SelectTrigger id="retailer_id">
                      <SelectValue placeholder="Select retailer" />
                    </SelectTrigger>
                    <SelectContent>
                      {retailers.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                          {r.company_name ? ` (${r.company_name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {stockType === "manufacturing" && (
                <div className="space-y-2">
                  <Label htmlFor="factory_user_id">Factory Warehouse (optional)</Label>
                  <Select
                    value={form.factory_user_id}
                    onValueChange={(value) =>
                      setForm({ ...form, factory_user_id: value })
                    }
                  >
                    <SelectTrigger id="factory_user_id">
                      <SelectValue placeholder="Select factory" />
                    </SelectTrigger>
                    <SelectContent>
                      {factories.map((f) => {
                        const label = f.full_name || f.email || "Factory user"
                        return (
                          <SelectItem key={f.id} value={f.id}>
                            {label}
                            {f.email && f.email !== label ? ` (${f.email})` : ""}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Products <span className="text-red-500">*</span>
              </Label>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">
                        Category / Product
                      </TableHead>
                      <TableHead className="w-[140px] font-semibold uppercase tracking-wider text-[11px]">
                        Quantity
                      </TableHead>
                      <TableHead className="w-[160px] font-semibold uppercase tracking-wider text-[11px]">
                        Unit Price (₹)
                      </TableHead>
                      <TableHead className="w-[160px] text-right font-semibold uppercase tracking-wider text-[11px]">
                        Amount
                      </TableHead>
                      <TableHead className="w-[48px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const qty = parseFloat(r.quantity) || 0
                      const price = parseFloat(r.unit_price) || 0
                      return (
                        <TableRow key={r.key}>
                          <TableCell className="min-w-[320px]">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex gap-1.5">
                                <Select
                                  value={r.category_id || "all"}
                                  onValueChange={(value) =>
                                    updateRow(r.key, {
                                      category_id: value === "all" ? "" : value,
                                      sub_category_id: "",
                                      product_id: "",
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue placeholder="Category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {parentCategories.map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.category_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={r.sub_category_id || "all"}
                                  onValueChange={(value) =>
                                    updateRow(r.key, {
                                      sub_category_id: value === "all" ? "" : value,
                                      product_id: "",
                                    })
                                  }
                                  disabled={!r.category_id || subCategoriesFor(r.category_id).length === 0}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue placeholder="Sub-category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Sub-Categories</SelectItem>
                                    {subCategoriesFor(r.category_id).map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.category_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Select
                                value={r.product_id}
                                onValueChange={(value) => updateRow(r.key, { product_id: value })}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {productsFor(r).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
                                      {p.sku ? ` — ${p.sku}` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="e.g., 120"
                              value={r.quantity}
                              onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="e.g., 450"
                              value={r.unit_price}
                              onChange={(e) => updateRow(r.key, { unit_price: e.target.value })}
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                            {qty && price ? formatINR(qty * price) : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(r.key)}
                              disabled={rows.length === 1}
                              title="Remove this product"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
                {rowsTotal > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Batch total:{" "}
                    <span className="font-medium text-foreground">{formatINR(rowsTotal)}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any details about this opening balance..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-4 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(cfg.listHref)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : rows.length > 1 ? `Save ${rows.filter(r => r.product_id).length || rows.length} Entries` : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Recent Entries */}
      <div className="w-full min-w-0 max-w-full">
        <Card className="w-full max-w-full overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Recent Entries</CardTitle>
                  <CardDescription className="mt-0.5">
                    Latest opening-stock records for {cfg.locationColumnLabel.toLowerCase()}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
                {recent.length} {recent.length === 1 ? "entry" : "entries"}
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <div className="w-full max-w-full overflow-x-auto">
              <Table className="min-w-[960px] w-full [&_th:first-child]:pl-6 [&_th:last-child]:pr-6 [&_td:first-child]:pl-6 [&_td:last-child]:pr-6">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">
                      Date
                    </TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">
                      Product
                    </TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">
                      SKU
                    </TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">
                      {cfg.locationColumnLabel}
                    </TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">
                      Quantity
                    </TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">
                      Unit Price
                    </TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">
                      Amount
                    </TableHead>
                    {isAdmin && (
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        No opening-stock entries yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    recent.map((r) => (
                      <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                        <TableCell className="text-sm">
                          {new Date(r.opening_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.product_name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {r.sku ? (
                            <Badge variant="outline" className="font-mono">
                              {r.sku}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.location_name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {r.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.unit_price > 0 ? (
                            formatINR(r.unit_price)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {r.amount > 0 ? (
                            formatINR(r.amount)
                          ) : (
                            <span className="text-muted-foreground font-normal">—</span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditing(r)
                                  setEditForm({
                                    quantity: String(r.quantity),
                                    unit_price: r.unit_price ? String(r.unit_price) : "",
                                    opening_date: r.opening_date.slice(0, 10),
                                    notes: r.notes ?? "",
                                  })
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleting(r)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="border-t bg-muted/20 px-6 py-3 text-sm text-muted-foreground">
              Showing {recent.length} most recent entries
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog (admin only) */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Opening Stock Entry</DialogTitle>
            <DialogDescription>
              {editing?.product_name ?? "Entry"}
              {editing?.location_name ? ` · ${editing.location_name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_quantity">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_quantity"
                type="number"
                min="0"
                step="any"
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_unit_price">Unit Price (₹)</Label>
              <Input
                id="edit_unit_price"
                type="number"
                min="0"
                step="any"
                value={editForm.unit_price}
                onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
              />
              {editForm.quantity && editForm.unit_price ? (
                <p className="text-xs text-muted-foreground">
                  Amount:{" "}
                  <span className="font-medium text-foreground">
                    {formatINR(
                      (parseFloat(editForm.quantity) || 0) *
                        (parseFloat(editForm.unit_price) || 0)
                    )}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_date">
                Opening Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_date"
                type="date"
                value={editForm.opening_date}
                onChange={(e) => setEditForm({ ...editForm, opening_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return
                const qty = parseFloat(editForm.quantity)
                if (Number.isNaN(qty) || qty < 0) {
                  toast.error("Please enter a valid quantity")
                  return
                }
                const price =
                  editForm.unit_price === "" ? 0 : parseFloat(editForm.unit_price)
                if (Number.isNaN(price) || price < 0) {
                  toast.error("Please enter a valid unit price")
                  return
                }
                if (!editForm.opening_date) {
                  toast.error("Please pick a date")
                  return
                }
                setSavingEdit(true)
                const { error } = await supabase
                  .from("opening_stock_entries")
                  .update({
                    quantity: qty,
                    unit_price: price,
                    opening_date: editForm.opening_date,
                    notes: editForm.notes || null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", editing.id)
                setSavingEdit(false)
                if (error) {
                  toast.error(error.message)
                  return
                }
                toast.success("Entry updated")
                setEditing(null)
                void fetchRecentAndStats()
              }}
              disabled={savingEdit}
            >
              <Save className="mr-2 h-4 w-4" />
              {savingEdit ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm (admin only) */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this opening-stock entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the record for{" "}
              <span className="font-medium">{deleting?.product_name ?? "this product"}</span>
              {deleting?.location_name ? ` at ${deleting.location_name}` : ""}
              {deleting ? ` (qty ${deleting.quantity.toLocaleString()})` : ""}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInFlight}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingInFlight}
              onClick={async (e) => {
                e.preventDefault()
                if (!deleting) return
                setDeletingInFlight(true)
                const { error } = await supabase
                  .from("opening_stock_entries")
                  .delete()
                  .eq("id", deleting.id)
                setDeletingInFlight(false)
                if (error) {
                  toast.error(error.message)
                  return
                }
                toast.success("Entry deleted")
                setDeleting(null)
                void fetchRecentAndStats()
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deletingInFlight ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
