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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, CalendarIcon, X, Wallet, Loader2, MoreHorizontal, Edit, Trash2, Search, IndianRupee, Home, Users, ListChecks, Eye, ShoppingBag } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import Link from "next/link"
import { isOldGstConvention, splitItemGst } from "@/lib/purchase-item-gst"

type Expense = {
  id: string
  expense_type: string
  expense_category: string | null
  amount: number
  description: string | null
  expense_date: string
  payment_method: string
  created_at: string
  added_by: string | null
  user?: {
    full_name: string | null
    role: string
  }
}

// Purchases tagged as an expense category (direct_expense/indirect_expense/
// other) never get a mirrored row in the `expenses` table — that was
// deliberately removed (see migrations/add_purchase_category.sql) because it
// double-counted the amount in the P&L. So they need to be pulled in here for
// display, read-only (editing happens on the purchase itself, not here), or
// this page silently misses every purchase-sourced expense. fixed_asset is
// excluded — it's capitalized, not an expense.
//
// One row per LINE ITEM, not per purchase — a single invoice can mix
// categories across its lines (e.g. a "RO Material Purchase" line as Direct
// Expense and a "Transportation" line as Indirect Expense on the same Tally
// voucher, via purchase_items.purchase_category — see
// add_purchase_item_category.sql). Showing one combined row per purchase
// would blur that split back together.
type PurchaseExpenseRow = {
  id: string // purchase_items.id — unique per row
  purchase_id: string
  purchase_number: string
  supplier_name: string
  item_name: string
  // Pre-split at fetch time via splitItemGst() using the item's own STORED
  // gst_amount, not recomputed from gst_percentage — some purchases predate
  // the GST-inclusive→exclusive rate fix, and item.total means something
  // different on those (see lib/purchase-item-gst.ts). Getting this wrong
  // double-counted GST on old rows (₹33,986 → ₹40,103 on PO-2026-0004).
  taxableValue: number
  gstAmount: number
  grandAmount: number
  category: "direct_expense" | "indirect_expense" | "other"
  purchase_date: string
  payment_method: string | null
  created_at: string
  created_by_user_id: string | null
  user?: {
    full_name: string | null
    role: string
  }
}

type CombinedRow =
  | { kind: "expense"; data: Expense }
  | { kind: "purchase"; data: PurchaseExpenseRow }

const rowDate = (r: CombinedRow) => (r.kind === "expense" ? r.data.expense_date : r.data.purchase_date)
const rowGst = (r: CombinedRow) => (r.kind === "expense" ? 0 : r.data.gstAmount)
// Taxable value = the amount before GST, same figure Tally shows on the
// purchase voucher. Plain `expenses` rows don't track GST at all, so their
// taxable value is just their amount.
const rowTaxableValue = (r: CombinedRow) => (r.kind === "expense" ? Number(r.data.amount) : r.data.taxableValue)
const rowAmount = (r: CombinedRow) => (r.kind === "expense" ? Number(r.data.amount) : r.data.grandAmount)
// "other" purchases are folded into "indirect" here — same bucketing the P&L
// report uses, so this page's totals and its category filter stay consistent
// with the P&L instead of introducing a third, disconnected concept of "other".
const rowCategory = (r: CombinedRow): string | null =>
  r.kind === "expense" ? r.data.expense_category : r.data.category === "direct_expense" ? "direct" : "indirect"
const rowPaymentMethod = (r: CombinedRow) => (r.kind === "expense" ? r.data.payment_method : r.data.payment_method || "")
const rowUser = (r: CombinedRow) => r.data.user

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [purchaseExpenses, setPurchaseExpenses] = useState<PurchaseExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>("all")
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  // Current user state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Add Expense Modal States
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [expenseType, setExpenseType] = useState("")
  const [expenseCategory, setExpenseCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [expenseDate, setExpenseDate] = useState<Date | undefined>(new Date())
  const [paymentMethod, setPaymentMethod] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Edit Expense Modal States
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [editExpenseType, setEditExpenseType] = useState("")
  const [editExpenseCategory, setEditExpenseCategory] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editExpenseDate, setEditExpenseDate] = useState<Date | undefined>(undefined)
  const [editPaymentMethod, setEditPaymentMethod] = useState("")
  const [updating, setUpdating] = useState(false)

  // Delete Confirmation Modal States
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Picks up ?from=&to= from links like the Factory Dashboard's Monthly
  // Summary table, so clicking a month's expense figure lands here pre-filtered.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get("from")
    const to = params.get("to")
    if (from) setDateFrom(new Date(from))
    if (to) setDateTo(new Date(to))
  }, [])

  useEffect(() => {
    fetchCurrentUser()
    fetchExpenses()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        console.error("Error fetching user:", error)
        return
      }
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (error) {
      console.error("Error fetching current user:", error)
    }
  }

  const fetchExpenses = async () => {
    setLoading(true)

    const [expensesRes, purchasesRes] = await Promise.all([
      supabase
        .from("expenses")
        .select(`
          *,
          user:users!added_by (
            full_name,
            role
          )
        `)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      // No embedded user:users!created_by_user_id(...) here — unlike
      // expenses.added_by, purchases.created_by_user_id has no FK registered
      // in PostgREST's schema cache, so that embed 400s. Fetch plain and
      // merge the user info in below instead.
      supabase
        .from("purchases")
        .select(`
          id, purchase_number, supplier_name, purchase_date,
          purchase_category, payment_method, created_at, created_by_user_id,
          subtotal, gst_amount, total_amount
        `)
        .in("purchase_category", ["direct_expense", "indirect_expense", "other", "mixed"])
        .order("purchase_date", { ascending: false }),
    ])

    if (expensesRes.error) {
      console.error("Error fetching expenses:", expensesRes.error)
      toast.error("Failed to fetch expenses")
    }
    if (purchasesRes.error) {
      // Non-fatal — still show the real `expenses` rows even if the
      // purchase-sourced merge fails for some reason.
      console.error("Error fetching expense-category purchases:", purchasesRes.error)
    }

    const purchases = purchasesRes.data || []

    // Pull line items for those purchases — a single invoice can mix
    // categories across lines (item.purchase_category overrides the parent
    // purchase's category), so this page shows one row per qualifying item,
    // not one row per purchase.
    let purchaseRows: Omit<PurchaseExpenseRow, "user">[] = []
    if (purchases.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from("purchase_items")
        .select("id, purchase_id, product_name, total, gst_amount, purchase_category")
        .in("purchase_id", purchases.map((p) => p.id))
      if (itemsError) {
        console.error("Error fetching purchase items for expense merge:", itemsError)
      } else {
        const purchaseById = new Map(purchases.map((p) => [p.id, p]))
        purchaseRows = (items || [])
          .map((item: any) => {
            const purchase = purchaseById.get(item.purchase_id)
            if (!purchase) return null
            const category = item.purchase_category || purchase.purchase_category
            // An item can be overridden away from this purchase's default —
            // only direct_expense/indirect_expense/other belong on this page
            // (material → COGS, fixed_asset → capitalized, neither is an expense).
            if (category !== "direct_expense" && category !== "indirect_expense" && category !== "other") return null
            const { taxable, gst, grand } = splitItemGst(item, isOldGstConvention(purchase))
            const row: Omit<PurchaseExpenseRow, "user"> = {
              id: item.id,
              purchase_id: purchase.id,
              purchase_number: purchase.purchase_number,
              supplier_name: purchase.supplier_name,
              item_name: item.product_name,
              taxableValue: taxable,
              gstAmount: gst,
              grandAmount: grand,
              category,
              purchase_date: purchase.purchase_date,
              payment_method: purchase.payment_method,
              created_at: purchase.created_at,
              created_by_user_id: purchase.created_by_user_id,
            }
            return row
          })
          .filter((r): r is Omit<PurchaseExpenseRow, "user"> => r !== null)
      }
    }

    const userIds = Array.from(new Set(purchaseRows.map((p) => p.created_by_user_id).filter((id): id is string => !!id)))
    let usersById: Record<string, { full_name: string | null; role: string }> = {}
    if (userIds.length > 0) {
      const { data: userRows, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, role")
        .in("id", userIds)
      if (usersError) {
        console.error("Error fetching users for purchase-sourced expenses:", usersError)
      } else {
        usersById = Object.fromEntries((userRows || []).map((u) => [u.id, { full_name: u.full_name, role: u.role }]))
      }
    }

    setExpenses(expensesRes.data || [])
    setPurchaseExpenses(
      purchaseRows.map((p) => ({
        ...p,
        user: p.created_by_user_id ? usersById[p.created_by_user_id] : undefined,
      }))
    )
    setLoading(false)
  }

  const combinedRows: CombinedRow[] = [
    ...expenses.map((data): CombinedRow => ({ kind: "expense", data })),
    ...purchaseExpenses.map((data): CombinedRow => ({ kind: "purchase", data })),
  ].sort((a, b) => new Date(rowDate(b)).getTime() - new Date(rowDate(a)).getTime())

  const filteredRows = combinedRows.filter((row) => {
    const description =
      row.kind === "expense"
        ? row.data.description
        : `${row.data.purchase_number} ${row.data.supplier_name} ${row.data.item_name}`
    const type = row.kind === "expense" ? row.data.expense_type : "purchase"
    const paymentMethod = rowPaymentMethod(row)
    const user = rowUser(row)

    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (description && description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user?.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))

    // Date range filter
    const rowDateObj = new Date(rowDate(row))
    const matchesDateFrom = !dateFrom || rowDateObj >= dateFrom
    const matchesDateTo = !dateTo || rowDateObj <= dateTo

    // Expense type filter
    const matchesExpenseType =
      expenseTypeFilter === "all" || type.toLowerCase() === expenseTypeFilter.toLowerCase()

    // Expense category filter (direct / indirect)
    const category = rowCategory(row)
    const matchesExpenseCategory =
      expenseCategoryFilter === "all" ||
      (category && category.toLowerCase() === expenseCategoryFilter.toLowerCase())

    // Role filter
    const matchesRole = roleFilter === "all" || (user?.role && user.role === roleFilter)

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesExpenseType &&
      matchesExpenseCategory &&
      matchesRole
    )
  })

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setExpenseTypeFilter("all")
    setExpenseCategoryFilter("all")
    setRoleFilter("all")
    setSearchTerm("")
  }

  const hasActiveFilters =
    dateFrom ||
    dateTo ||
    expenseTypeFilter !== "all" ||
    expenseCategoryFilter !== "all" ||
    roleFilter !== "all" ||
    searchTerm !== ""

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const handleAddExpenseSubmit = async () => {
    // Validation
    if (!expenseType) {
      toast.error("Please select an expense type")
      return
    }
    if (!expenseCategory) {
      toast.error("Please select an expense category")
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    if (!expenseDate) {
      toast.error("Please select an expense date")
      return
    }
    if (!paymentMethod) {
      toast.error("Please select a payment method")
      return
    }

    setSubmitting(true)

    try {
      const expenseData = {
        expense_type: expenseType,
        expense_category: expenseCategory,
        amount: parseFloat(amount),
        description: description || null,
        expense_date: expenseDate.toISOString(),
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
        added_by: currentUserId,
      }

      const { error } = await supabase
        .from("expenses")
        .insert([expenseData])

      if (error) {
        throw error
      }

      toast.success("Expense added successfully")

      // Reset form
      setExpenseType("")
      setExpenseCategory("")
      setAmount("")
      setDescription("")
      setExpenseDate(new Date())
      setPaymentMethod("")
      setIsAddExpenseOpen(false)

      // Refresh expenses list
      fetchExpenses()

    } catch (error) {
      console.error("Error adding expense:", error)
      toast.error("Failed to add expense")
    } finally {
      setSubmitting(false)
    }
  }

  const openEditExpenseModal = (expense: Expense) => {
    setSelectedExpense(expense)
    setEditExpenseType(expense.expense_type)
    setEditExpenseCategory(expense.expense_category || "")
    setEditAmount(expense.amount.toString())
    setEditDescription(expense.description || "")
    setEditExpenseDate(new Date(expense.expense_date))
    setEditPaymentMethod(expense.payment_method)
    setIsEditExpenseOpen(true)
  }

  const handleUpdateExpense = async () => {
    if (!selectedExpense) return

    // Validation
    if (!editExpenseType) {
      toast.error("Please select an expense type")
      return
    }
    if (!editExpenseCategory) {
      toast.error("Please select an expense category")
      return
    }
    if (!editAmount || parseFloat(editAmount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    if (!editExpenseDate) {
      toast.error("Please select an expense date")
      return
    }
    if (!editPaymentMethod) {
      toast.error("Please select a payment method")
      return
    }

    setUpdating(true)

    try {
      const updateData = {
        expense_type: editExpenseType,
        expense_category: editExpenseCategory,
        amount: parseFloat(editAmount),
        description: editDescription || null,
        expense_date: editExpenseDate.toISOString(),
        payment_method: editPaymentMethod,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("expenses")
        .update(updateData)
        .eq("id", selectedExpense.id)

      if (error) {
        throw error
      }

      toast.success("Expense updated successfully")
      setIsEditExpenseOpen(false)
      setSelectedExpense(null)
      fetchExpenses()

    } catch (error) {
      console.error("Error updating expense:", error)
      toast.error("Failed to update expense")
    } finally {
      setUpdating(false)
    }
  }

  const openDeleteDialog = (expense: Expense) => {
    setExpenseToDelete(expense)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return

    setDeleting(true)

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseToDelete.id)

      if (error) {
        throw error
      }

      toast.success("Expense deleted successfully")
      setIsDeleteDialogOpen(false)
      setExpenseToDelete(null)
      fetchExpenses()

    } catch (error) {
      console.error("Error deleting expense:", error)
      toast.error("Failed to delete expense")
    } finally {
      setDeleting(false)
    }
  }

  const getExpenseTypeVariant = (type: string) => {
    const lowerType = type.toLowerCase()
    if (lowerType === "loan" || lowerType === "rent") {
      return "destructive"
    }
    if (lowerType === "daily_expenses" || lowerType === "utilities") {
      return "secondary"
    }
    if (lowerType === "salary" || lowerType === "wages") {
      return "outline"
    }
    return "default"
  }

  const getTotalExpenses = () => {
    return filteredRows.reduce((sum, row) => sum + rowAmount(row), 0)
  }

  const getTotalTaxableValue = () => {
    return filteredRows.reduce((sum, row) => sum + rowTaxableValue(row), 0)
  }

  const getExpensesByType = (type: string) => {
    return expenses
      .filter((e) => e.expense_type.toLowerCase() === type.toLowerCase())
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  }

  const formatRoleName = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive"
      case "customer_support":
        return "default"
      case "warehouse":
        return "secondary"
      case "delivery_driver":
        return "outline"
      default:
        return "secondary"
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Wallet className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Expenses</h1>
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
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Expenses</h1>
            <p className="text-sm text-muted-foreground">
              Record and track all business expenses
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Add Expense Modal */}
          <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>
                  Record a new business expense
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Expense Type */}
                <div className="space-y-2">
                  <Label htmlFor="expenseType">Expense Type *</Label>
                  <Select value={expenseType} onValueChange={setExpenseType}>
                    <SelectTrigger id="expenseType">
                      <SelectValue placeholder="Select expense type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loan">Loan Payment</SelectItem>
                      <SelectItem value="daily_expenses">Daily Expenses</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                      <SelectItem value="utilities">Utilities (Electricity, Water, etc.)</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                      <SelectItem value="wages">Wages</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                      <SelectItem value="maintenance">Maintenance & Repairs</SelectItem>
                      <SelectItem value="marketing">Marketing & Advertising</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Expense Category */}
                <div className="space-y-2">
                  <Label htmlFor="expenseCategory">Expense Category *</Label>
                  <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                    <SelectTrigger id="expenseCategory">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="indirect">Indirect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                {/* Expense Date */}
                <div className="space-y-2">
                  <Label>Expense Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !expenseDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expenseDate ? format(expenseDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={expenseDate}
                        onSelect={setExpenseDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="balance">Balance</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="net_banking">Net Banking</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter expense description or notes"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddExpenseOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddExpenseSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Expense
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Expense Modal */}
      <Dialog open={isEditExpenseOpen} onOpenChange={setIsEditExpenseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update expense details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Expense Type */}
            <div className="space-y-2">
              <Label htmlFor="editExpenseType">Expense Type *</Label>
              <Select value={editExpenseType} onValueChange={setEditExpenseType}>
                <SelectTrigger id="editExpenseType">
                  <SelectValue placeholder="Select expense type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan">Loan Payment</SelectItem>
                  <SelectItem value="daily_expenses">Daily Expenses</SelectItem>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="utilities">Utilities (Electricity, Water, etc.)</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                  <SelectItem value="wages">Wages</SelectItem>
                  <SelectItem value="transportation">Transportation</SelectItem>
                  <SelectItem value="maintenance">Maintenance & Repairs</SelectItem>
                  <SelectItem value="marketing">Marketing & Advertising</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Expense Category */}
            <div className="space-y-2">
              <Label htmlFor="editExpenseCategory">Expense Category *</Label>
              <Select value={editExpenseCategory} onValueChange={setEditExpenseCategory}>
                <SelectTrigger id="editExpenseCategory">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="indirect">Indirect</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="editAmount">Amount (₹) *</Label>
              <Input
                id="editAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>

            {/* Expense Date */}
            <div className="space-y-2">
              <Label>Expense Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editExpenseDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editExpenseDate ? format(editExpenseDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editExpenseDate}
                    onSelect={setEditExpenseDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="editPaymentMethod">Payment Method *</Label>
              <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                <SelectTrigger id="editPaymentMethod">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="balance">Balance</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="net_banking">Net Banking</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                placeholder="Enter expense description or notes"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditExpenseOpen(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateExpense}
              disabled={updating}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Update Expense
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {expenseToDelete && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Expense Type:</span>
                <Badge variant={getExpenseTypeVariant(expenseToDelete.expense_type)}>
                  {expenseToDelete.expense_type.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Amount:</span>
                <span className="font-bold">
                  {formatCurrency(expenseToDelete.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Date:</span>
                <span>{new Date(expenseToDelete.expense_date).toLocaleDateString()}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteExpense}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Expense
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Total Expenses</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{formatCurrency(getTotalExpenses())}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across current filters</CardContent>
        </Card>
        <Card className="h-full bg-teal-50/60 dark:bg-teal-950/20 border-teal-200/60 dark:border-teal-900/40">
          <CardHeader>
            <CardDescription>Total Taxable Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-teal-600 dark:text-teal-500">{formatCurrency(getTotalTaxableValue())}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Before GST, across current filters</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Loan & Rent</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">
              {formatCurrency(getExpensesByType("loan") + getExpensesByType("rent"))}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Home className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Loan + Rent payments</CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Salary & Wages</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
              {formatCurrency(getExpensesByType("salary") + getExpensesByType("wages"))}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Users className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Payroll spend</CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Records</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{combinedRows.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All expense entries</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Expense Records</CardTitle>
                <CardDescription className="mt-0.5">A list of all recorded expenses with details</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredRows.length} {filteredRows.length === 1 ? "record" : "records"}
              </Badge>
              {hasActiveFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>

              {/* Expense Type Filter */}
              <Select value={expenseTypeFilter} onValueChange={setExpenseTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Expense Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="loan">Loan Payment</SelectItem>
                  <SelectItem value="daily_expenses">Daily Expenses</SelectItem>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="utilities">Utilities</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                  <SelectItem value="wages">Wages</SelectItem>
                  <SelectItem value="transportation">Transportation</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="purchase">Purchase (from Purchases)</SelectItem>
                </SelectContent>
              </Select>

              {/* Expense Category Filter (Direct / Indirect) */}
              <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="indirect">Indirect</SelectItem>
                </SelectContent>
              </Select>

              {/* User Role Filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="User Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="customer_support">Customer Support</SelectItem>
                  <SelectItem value="delivery_driver">Delivery Driver</SelectItem>
                  <SelectItem value="factories">Factories</SelectItem>
                  <SelectItem value="main_distributor">Main Distributor</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                  <SelectItem value="sub_distributor">Sub Distributor</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
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
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Expense Type</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Category</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Description</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Payment Method</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Added By</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Taxable Value</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Amount</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={`${row.kind}-${row.data.id}`} className="transition-colors hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap">
                        {new Date(rowDate(row)).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {row.kind === "purchase" ? (
                          <Badge variant="outline" className="rounded-full gap-1 text-indigo-600 border-indigo-300">
                            <ShoppingBag className="h-3 w-3" />
                            Purchase
                          </Badge>
                        ) : (
                          <Badge variant={getExpenseTypeVariant(row.data.expense_type)} className="rounded-full capitalize">
                            {row.data.expense_type.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {rowCategory(row) ? (
                          <Badge
                            variant={rowCategory(row) === "direct" ? "default" : "secondary"}
                            className="rounded-full capitalize"
                          >
                            {rowCategory(row)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.kind === "purchase" ? (
                          <Link
                            href={`/dashboard/purchases/${row.data.purchase_id}`}
                            className="hover:underline underline-offset-2"
                          >
                            {row.data.purchase_number} — {row.data.supplier_name}: {row.data.item_name}
                            {row.data.category === "other" && (
                              <span className="text-muted-foreground"> (uncategorized)</span>
                            )}
                          </Link>
                        ) : (
                          row.data.description || "-"
                        )}
                      </TableCell>
                      <TableCell className="capitalize">
                        {(rowPaymentMethod(row) || "-").replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        {rowUser(row) ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-sm">
                              {rowUser(row)?.full_name || "Unknown User"}
                            </span>
                            <Badge
                              variant={getRoleBadgeVariant(rowUser(row)!.role) as any}
                              className="w-fit text-xs rounded-full capitalize"
                            >
                              {formatRoleName(rowUser(row)!.role)}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(rowTaxableValue(row))}
                        {row.kind === "purchase" && rowGst(row) > 0 && (
                          <div className="text-[11px]">+GST {formatCurrency(rowGst(row))}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(rowAmount(row))}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.kind === "purchase" ? (
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5" asChild>
                            <Link href={`/dashboard/purchases/${row.data.purchase_id}`}>
                              <Eye className="h-4 w-4" />
                              View Purchase
                            </Link>
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEditExpenseModal(row.data)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Expense
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(row.data)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Expense
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredRows.length} of {combinedRows.length} expense records
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
