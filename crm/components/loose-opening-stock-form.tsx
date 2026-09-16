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
  Droplet,
  Boxes,
  ClipboardList,
  CalendarCheck,
  Layers,
  Pencil,
  Trash2,
  IndianRupee,
} from "lucide-react"
import { toast } from "sonner"
import { useUserRole } from "@/hooks/use-user-role"

// A loose_stock row is one bulk category (Buffalo Ghee, Cow Ghee, etc.) joined
// with its product_categories.name for display.
type LooseCategory = {
  loose_stock_id: string
  category_id: string
  category_name: string
}

type Factory = {
  id: string
  full_name: string | null
  email: string | null
}

type RecentEntry = {
  id: string
  opening_date: string
  quantity_liters: number
  price_per_liter: number
  amount: number
  category_name: string | null
  factory_label: string | null
  notes: string | null
}

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n)

const formatLitres = (n: number) =>
  `${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)} Ltr`

export function LooseOpeningStockForm() {
  const router = useRouter()
  const { role } = useUserRole()
  const isAdmin = role === "admin"

  const [categories, setCategories] = useState<LooseCategory[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  const [recent, setRecent] = useState<RecentEntry[]>([])
  const [stats, setStats] = useState({
    totalEntries: 0,
    categoriesTracked: 0,
    totalQuantity: 0,
    totalAmount: 0,
    lastEntryDate: null as string | null,
  })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<RecentEntry | null>(null)
  const [editForm, setEditForm] = useState({
    quantity_liters: "",
    price_per_liter: "",
    opening_date: "",
    notes: "",
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState<RecentEntry | null>(null)
  const [deletingInFlight, setDeletingInFlight] = useState(false)

  const [form, setForm] = useState({
    loose_stock_id: "",
    quantity_liters: "",
    price_per_liter: "",
    opening_date: new Date().toISOString().slice(0, 10),
    factory_user_id: "",
    notes: "",
  })

  const fetchRecentAndStats = useCallback(async () => {
    type Row = {
      id: string
      transaction_date: string
      quantity_liters: number
      price_per_liter: number | null
      total_amount: number | null
      transaction_notes: string | null
      user_id: string | null
      user_email: string | null
      loose_stock?:
        | { product_categories?: { name: string } | { name: string }[] | null }
        | { product_categories?: { name: string } | { name: string }[] | null }[]
        | null
    }
    // NOTE: no `users:user_id (...)` embed — there is no FK from
    // loose_stock_transactions.user_id to users.id, so PostgREST would 400 the
    // whole query and the page would silently render empty. The factory label
    // is resolved client-side below from the already-loaded `factories` list,
    // falling back to `user_email`.
    const { data, error } = await supabase
      .from("loose_stock_transactions")
      .select(
        `id, transaction_date, quantity_liters, price_per_liter, total_amount, transaction_notes, user_id, user_email,
         loose_stock!inner ( product_categories!inner ( name ) )`
      )
      .eq("transaction_type", "opening")
      .order("transaction_date", { ascending: false })
      .limit(50)

    if (error || !data) {
      setRecent([])
      setStats({
        totalEntries: 0,
        categoriesTracked: 0,
        totalQuantity: 0,
        totalAmount: 0,
        lastEntryDate: null,
      })
      return
    }

    const pickName = (
      rel: Row["loose_stock"] extends infer T ? T : never
    ): string | null => {
      if (!rel) return null
      const node = Array.isArray(rel) ? rel[0] : rel
      if (!node) return null
      const cat = (node as { product_categories?: { name: string } | { name: string }[] | null })
        .product_categories
      if (!cat) return null
      if (Array.isArray(cat)) return cat[0]?.name ?? null
      return cat.name ?? null
    }
    const factoryById = new Map(factories.map((f) => [f.id, f]))

    const rows = (data as unknown as Row[]).map<RecentEntry>((r) => {
      const qty = Number(r.quantity_liters || 0)
      const price = Number(r.price_per_liter || 0)
      const amt =
        r.total_amount != null
          ? Number(r.total_amount)
          : qty * price
      const f = r.user_id ? factoryById.get(r.user_id) : undefined
      return {
        id: r.id,
        opening_date: r.transaction_date,
        quantity_liters: qty,
        price_per_liter: price,
        amount: amt,
        category_name: pickName(r.loose_stock),
        factory_label: f?.full_name || f?.email || r.user_email,
        notes: r.transaction_notes,
      }
    })

    let totalQty = 0
    let totalAmount = 0
    const cats = new Set<string>()
    rows.forEach((r) => {
      totalQty += r.quantity_liters
      totalAmount += r.amount
      if (r.category_name) cats.add(r.category_name)
    })

    setRecent(rows.slice(0, 10))
    setStats({
      totalEntries: rows.length,
      categoriesTracked: cats.size,
      totalQuantity: totalQty,
      totalAmount,
      lastEntryDate: rows[0]?.opening_date ?? null,
    })
  }, [factories])

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("loose_stock")
        .select(`id, category_id, product_categories!inner ( id, name )`)
        .order("category_id")
      if (error || !data) return
      type RawCat = { name: string } | { name: string }[]
      const rows = data as unknown as Array<{
        id: string
        category_id: string
        product_categories: RawCat
      }>
      const items: LooseCategory[] = rows.map((r) => {
        const cat = Array.isArray(r.product_categories)
          ? r.product_categories[0]
          : r.product_categories
        return {
          loose_stock_id: r.id,
          category_id: r.category_id,
          category_name: cat?.name || "Category",
        }
      })
      items.sort((a, b) => a.category_name.localeCompare(b.category_name))
      setCategories(items)
    })()

    void (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email")
        .eq("role", "factories")
        .order("full_name")
      if (!error && data) setFactories(data)
    })()

    void fetchRecentAndStats()
  }, [fetchRecentAndStats])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.loose_stock_id) {
      toast.error("Please select a loose category")
      return
    }
    const qty = parseFloat(form.quantity_liters)
    if (!form.quantity_liters || Number.isNaN(qty) || qty < 0) {
      toast.error("Please enter a valid quantity in litres")
      return
    }
    const price =
      form.price_per_liter === "" ? 0 : parseFloat(form.price_per_liter)
    if (Number.isNaN(price) || price < 0) {
      toast.error("Please enter a valid price per litre")
      return
    }
    if (!form.opening_date) {
      toast.error("Please pick a date")
      return
    }

    setSaving(true)
    try {
      const selectedFactory = factories.find(
        (f) => f.id === form.factory_user_id
      )
      const payload: Record<string, unknown> = {
        loose_stock_id: form.loose_stock_id,
        transaction_type: "opening",
        quantity_liters: qty,
        price_per_liter: price,
        total_amount: qty * price,
        // transaction_date is timestamptz — append T00:00:00Z so the date the
        // user typed isn't shifted by the local timezone on save.
        transaction_date: `${form.opening_date}T00:00:00Z`,
        user_id: form.factory_user_id || null,
        user_email: selectedFactory?.email || null,
        transaction_notes: form.notes || null,
      }

      const { error } = await supabase
        .from("loose_stock_transactions")
        .insert([payload])
      if (error) throw error

      toast.success("Opening stock saved")
      setForm({
        loose_stock_id: "",
        quantity_liters: "",
        price_per_liter: "",
        opening_date: new Date().toISOString().slice(0, 10),
        factory_user_id: "",
        notes: "",
      })
      void fetchRecentAndStats()
    } catch (err: unknown) {
      console.error("Error saving loose opening stock:", err)
      const msg =
        err instanceof Error ? err.message : "Failed to save opening stock"
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
            <Droplet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Loose Stock Opening Stock
            </h1>
            <p className="text-sm text-muted-foreground">
              Record opening balance for bulk loose stock (Buffalo Ghee, Cow Ghee, etc.)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/loose-stock")}
        >
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
            Loose opening records logged
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Categories Tracked</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {stats.categoriesTracked.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Boxes className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Distinct loose categories
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Litres</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {formatLitres(stats.totalQuantity)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Layers className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across all entries
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
                  <Droplet className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    New Loose Opening Stock Entry
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    Pick a loose category and enter the opening balance in litres
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full self-start sm:self-auto"
              >
                loose
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loose_stock_id">
                  Loose Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.loose_stock_id}
                  onValueChange={(value) =>
                    setForm({ ...form, loose_stock_id: value })
                  }
                >
                  <SelectTrigger id="loose_stock_id" className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem
                        key={c.loose_stock_id}
                        value={c.loose_stock_id}
                      >
                        {c.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity_liters">
                  Quantity (litres) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity_liters"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g., 250"
                  value={form.quantity_liters}
                  onChange={(e) =>
                    setForm({ ...form, quantity_liters: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_per_liter">
                  Price per Litre
                </Label>
                <Input
                  id="price_per_liter"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g., 540"
                  value={form.price_per_liter}
                  onChange={(e) =>
                    setForm({ ...form, price_per_liter: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="opening_date">
                  Opening Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="opening_date"
                  type="date"
                  value={form.opening_date}
                  onChange={(e) =>
                    setForm({ ...form, opening_date: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="factory_user_id">Factory (optional)</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any details about this opening balance..."
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex gap-4 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/loose-stock")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
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
                    Latest loose opening-stock records
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full self-start sm:self-auto"
              >
                {recent.length} {recent.length === 1 ? "entry" : "entries"}
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <div className="w-full max-w-full overflow-x-auto">
              <Table className="min-w-[900px] w-full [&_th:first-child]:pl-6 [&_th:last-child]:pr-6 [&_td:first-child]:pl-6 [&_td:last-child]:pr-6">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">
                      Date
                    </TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">
                      Category
                    </TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">
                      Factory
                    </TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">
                      Quantity
                    </TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">
                      Price/Litre
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
                      <TableCell
                        colSpan={isAdmin ? 7 : 6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No loose opening-stock entries yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    recent.map((r) => (
                      <TableRow
                        key={r.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <TableCell className="text-sm">
                          {new Date(r.opening_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.category_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.factory_label ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatLitres(r.quantity_liters)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(r.price_per_liter)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatINR(r.amount)}
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
                                    quantity_liters: String(r.quantity_liters),
                                    price_per_liter: String(r.price_per_liter),
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
            <DialogTitle>Edit Loose Opening Stock</DialogTitle>
            <DialogDescription>
              {editing?.category_name ?? "Entry"}
              {editing?.factory_label ? ` · ${editing.factory_label}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_qty">
                Quantity (litres) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_qty"
                type="number"
                min="0"
                step="any"
                value={editForm.quantity_liters}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    quantity_liters: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_ppl">Price per Litre</Label>
              <Input
                id="edit_ppl"
                type="number"
                min="0"
                step="any"
                value={editForm.price_per_liter}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    price_per_liter: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_date">
                Opening Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_date"
                type="date"
                value={editForm.opening_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, opening_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                rows={3}
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
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
                const qty = parseFloat(editForm.quantity_liters)
                if (Number.isNaN(qty) || qty < 0) {
                  toast.error("Please enter a valid quantity")
                  return
                }
                const ppl =
                  editForm.price_per_liter === ""
                    ? 0
                    : parseFloat(editForm.price_per_liter)
                if (Number.isNaN(ppl) || ppl < 0) {
                  toast.error("Please enter a valid price per litre")
                  return
                }
                if (!editForm.opening_date) {
                  toast.error("Please pick a date")
                  return
                }
                setSavingEdit(true)
                const { error } = await supabase
                  .from("loose_stock_transactions")
                  .update({
                    quantity_liters: qty,
                    price_per_liter: ppl,
                    total_amount: qty * ppl,
                    transaction_date: `${editForm.opening_date}T00:00:00Z`,
                    transaction_notes: editForm.notes || null,
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
              <span className="font-medium">
                {deleting?.category_name ?? "this category"}
              </span>
              {deleting
                ? ` (${formatLitres(deleting.quantity_liters)} @ ${formatINR(
                    deleting.price_per_liter
                  )}/L)`
                : ""}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInFlight}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingInFlight}
              onClick={async (e) => {
                e.preventDefault()
                if (!deleting) return
                setDeletingInFlight(true)
                const { error } = await supabase
                  .from("loose_stock_transactions")
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
