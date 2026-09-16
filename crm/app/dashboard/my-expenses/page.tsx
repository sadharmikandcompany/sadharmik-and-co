"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Plus,
  Wallet,
  Search,
  CalendarIcon,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type Expense = {
  id: string
  expense_type: string
  amount: number
  description: string | null
  expense_date: string
  payment_method: string
  created_at: string
  added_by: string | null
}

const EXPENSE_TYPES = [
  "Rent",
  "Salary",
  "Utilities",
  "Travel",
  "Fuel",
  "Maintenance",
  "Office Supplies",
  "Marketing",
  "Other",
]

const PAYMENT_METHODS = ["Cash", "Cheque", "RTGS", "G Pay", "UPI", "Bank Transfer"]

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n)

export default function MyExpensesPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    expense_type: "",
    amount: "",
    description: "",
    expense_date: new Date() as Date | undefined,
    payment_method: "",
  })

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [selected, setSelected] = useState<Expense | null>(null)
  const [editForm, setEditForm] = useState({
    expense_type: "",
    amount: "",
    description: "",
    expense_date: undefined as Date | undefined,
    payment_method: "",
  })

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toDelete, setToDelete] = useState<Expense | null>(null)

  useEffect(() => {
    if (!roleLoading && role !== "retailer" && role !== "admin") {
      router.push("/dashboard")
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setCurrentUserId(user.id)
    await fetchExpenses(user.id)
  }

  const fetchExpenses = async (userId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("added_by", userId)
      .order("expense_date", { ascending: false })

    if (error) {
      console.error("Error fetching expenses:", error)
      toast.error("Failed to load expenses")
    } else {
      setExpenses(data || [])
    }
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.expense_type) return toast.error("Select an expense type")
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error("Enter a valid amount")
    if (!form.expense_date) return toast.error("Select a date")
    if (!form.payment_method) return toast.error("Select a payment method")
    if (!currentUserId) return toast.error("Not signed in")

    setSubmitting(true)
    const { error } = await supabase.from("expenses").insert([
      {
        expense_type: form.expense_type,
        amount: parseFloat(form.amount),
        description: form.description || null,
        expense_date: form.expense_date.toISOString(),
        payment_method: form.payment_method,
        added_by: currentUserId,
      },
    ])
    setSubmitting(false)

    if (error) {
      console.error(error)
      toast.error("Failed to add expense")
      return
    }
    toast.success("Expense added")
    setAddOpen(false)
    setForm({ expense_type: "", amount: "", description: "", expense_date: new Date(), payment_method: "" })
    if (currentUserId) await fetchExpenses(currentUserId)
  }

  const openEdit = (e: Expense) => {
    setSelected(e)
    setEditForm({
      expense_type: e.expense_type,
      amount: e.amount.toString(),
      description: e.description || "",
      expense_date: new Date(e.expense_date),
      payment_method: e.payment_method,
    })
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!selected) return
    if (!editForm.expense_type) return toast.error("Select an expense type")
    if (!editForm.amount || parseFloat(editForm.amount) <= 0) return toast.error("Enter a valid amount")
    if (!editForm.expense_date) return toast.error("Select a date")
    if (!editForm.payment_method) return toast.error("Select a payment method")

    setUpdating(true)
    const { error } = await supabase
      .from("expenses")
      .update({
        expense_type: editForm.expense_type,
        amount: parseFloat(editForm.amount),
        description: editForm.description || null,
        expense_date: editForm.expense_date.toISOString(),
        payment_method: editForm.payment_method,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id)
    setUpdating(false)

    if (error) {
      console.error(error)
      toast.error("Failed to update")
      return
    }
    toast.success("Expense updated")
    setEditOpen(false)
    setSelected(null)
    if (currentUserId) await fetchExpenses(currentUserId)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    const { error } = await supabase.from("expenses").delete().eq("id", toDelete.id)
    setDeleting(false)
    if (error) {
      console.error(error)
      toast.error("Failed to delete")
      return
    }
    toast.success("Expense deleted")
    setDeleteOpen(false)
    setToDelete(null)
    if (currentUserId) await fetchExpenses(currentUserId)
  }

  const filtered = expenses.filter((e) => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      e.expense_type.toLowerCase().includes(q) ||
      e.payment_method.toLowerCase().includes(q) ||
      (e.description || "").toLowerCase().includes(q)
    )
  })

  const totalAmount = filtered.reduce((s, e) => s + (e.amount || 0), 0)
  const thisMonthAmount = filtered
    .filter((e) => {
      const d = new Date(e.expense_date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">My Expenses</h1>
            <p className="text-sm text-muted-foreground">Track expenses you've recorded</p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Expense
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">{filtered.length} entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            <CalendarIcon className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">{formatCurrency(thisMonthAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Entry</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">
              {filtered.length > 0 ? formatCurrency(totalAmount / filtered.length) : formatCurrency(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by type, method, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expenses</CardTitle>
          <CardDescription className="text-sm">
            {filtered.length} entry{filtered.length !== 1 ? "ies" : ""} recorded by you
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No expenses recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.expense_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.expense_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-sm capitalize">{e.payment_method}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {e.description || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setToDelete(e)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a new expense entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.expense_type} onValueChange={(v) => setForm({ ...form, expense_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.expense_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.expense_date ? format(form.expense_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={form.expense_date} onSelect={(d) => setForm({ ...form, expense_date: d })} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update an expense entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={editForm.expense_type} onValueChange={(v) => setEditForm({ ...editForm, expense_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editForm.expense_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editForm.expense_date ? format(editForm.expense_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={editForm.expense_date} onSelect={(d) => setEditForm({ ...editForm, expense_date: d })} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={editForm.payment_method} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={updating}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && (
                <>This will permanently remove the {toDelete.expense_type} expense of {formatCurrency(toDelete.amount)}.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
