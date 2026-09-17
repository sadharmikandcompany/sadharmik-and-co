"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Landmark, Plus, Upload, Loader2, X, CheckCircle2, XCircle, Pencil, Trash2, ArrowDownLeft, Search, ArrowUpRight, ArrowDownRight, Wallet, Banknote, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Warehouse, IndianRupee, Link2, Receipt, ArrowLeftRight, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { PartyCombobox, type Party } from "@/components/ui/party-combobox"

type BankAccount = {
  id: string
  bank_name: string
  account_no: string
  ifsc: string | null
  branch: string | null
  account_type: string
  current_balance: number
  opening_balance?: number | null
  last_reconciled_date: string | null
  is_active: boolean
}

type BankTransaction = {
  id: string
  bank_account_id: string
  txn_date: string
  value_date: string | null
  amount: number
  txn_type: string
  description: string | null
  reference: string | null
  status: string
  source?: string
  created_at?: string
}

type SortColumnName = "date" | "account" | "description" | "debit" | "credit" | "status"

// Clickable column header for the Transactions table — click toggles
// ascending/descending on that column, switching to a new column defaults
// to ascending. Shows a neutral icon until this column is the active sort.
function SortableTableHead({
  column, label, sortColumn, sortDirection, onSort, align,
}: {
  column: SortColumnName
  label: string
  sortColumn: SortColumnName
  sortDirection: "asc" | "desc"
  onSort: (column: SortColumnName) => void
  align?: "right"
}) {
  const isActive = sortColumn === column
  const Icon = isActive ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""} ${isActive ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${isActive ? "" : "opacity-40"}`} />
      </button>
    </TableHead>
  )
}

export default function ReconciliationPage() {
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, loading: entityLoading } = useEntityData()
  // Roles that can see all reconciliation data globally — others get filtered
  // to records they actually own (their orders, expenses, retailer payments,
  // delivery review collections, etc.). bank_accounts itself has no ownership
  // column in the schema, so every role sees the same accounts list — only
  // the derived transaction stream is scoped.
  const isAdminLike = role === "admin" || role === "warehouse" || role === "customer_support"
  const isDistributor = role === "main_distributor" || role === "sub_distributor"
  const isRetailer = role === "retailer"
  const isFactory = role === "factories"
  const isDeliveryDriver = role === "delivery_driver"

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBankId, setSelectedBankId] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFromFilter, setDateFromFilter] = useState("")
  const [dateToFilter, setDateToFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  // Lets the user tick off transactions on-screen while cross-checking them
  // one by one against their physical/Tally records — not tied to the
  // "matched" reconciliation status, just a scratch selection for this
  // session (cleared on page reload, not persisted to the DB).
  const [selectedTxnIds, setSelectedTxnIds] = useState<Set<string>>(new Set())
  const [sortColumn, setSortColumn] = useState<SortColumnName>("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const handleSort = (column: SortColumnName) => {
    if (sortColumn === column) {
      setSortDirection(d => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
    setCurrentPage(1)
  }

  // Add Account Modal
  const [isAddBankOpen, setIsAddBankOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newAccountType, setNewAccountType] = useState<string>("current")
  const [newBankName, setNewBankName] = useState("")
  const [newAccountNo, setNewAccountNo] = useState("")
  const [newIfsc, setNewIfsc] = useState("")
  const [newBranch, setNewBranch] = useState("")
  const [newOpeningBalance, setNewOpeningBalance] = useState("")

  // Create Transaction Modal
  const [isCreateTxnOpen, setIsCreateTxnOpen] = useState(false)
  const [txnBankId, setTxnBankId] = useState("")
  const [txnType, setTxnType] = useState<string>("Cr")
  const [txnOrderSearch, setTxnOrderSearch] = useState("")
  const [txnOrderResults, setTxnOrderResults] = useState<any[]>([])
  const [txnSelectedOrder, setTxnSelectedOrder] = useState<any>(null)
  const [txnAmount, setTxnAmount] = useState("")
  const [txnDescription, setTxnDescription] = useState("")
  const [txnReference, setTxnReference] = useState("")
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split("T")[0])
  const [searchingOrders, setSearchingOrders] = useState(false)
  const [txnPaymentStatusFilter, setTxnPaymentStatusFilter] = useState<string>("all")
  const [txnPaymentMethodFilter, setTxnPaymentMethodFilter] = useState<string>("all")
  const [txnDateFrom, setTxnDateFrom] = useState("")
  const [txnDateTo, setTxnDateTo] = useState("")
  const [txnMode, setTxnMode] = useState<string>("order")
  // Warehouse/godown records — a subset of real distributors/retailers that
  // happen to have a registered physical location. Kept separate from the
  // PartyCombobox-driven distributor/customer search below (which covers
  // ALL real distributors/customers, not just the ones with a godown) so the
  // GODOWN: reference linkage Warehouse Orders relies on still works for the
  // ones that do have one.
  const [godowns, setGodowns] = useState<any[]>([])
  const [txnSelectedDistributor, setTxnSelectedDistributor] = useState<string>("")
  const [txnSelectedParty, setTxnSelectedParty] = useState<Party | null>(null)
  const [txnExpenseType, setTxnExpenseType] = useState<string>("daily_expenses")
  const [txnExpenseVendor, setTxnExpenseVendor] = useState<Party | null>(null)
  // Contra Entry — moves money between two of your own accounts (cash
  // withdrawal from bank, cash deposit to bank, bank-to-bank transfer).
  const [txnContraFromAccount, setTxnContraFromAccount] = useState<string>("")
  const [txnContraToAccount, setTxnContraToAccount] = useState<string>("")
  // Vendor's outstanding bills — shown once a Vendor party is picked on the
  // Distributor tab, so a Payment Out can be tied to a specific purchase
  // instead of just the vendor in general.
  const [txnVendorBills, setTxnVendorBills] = useState<any[]>([])
  const [txnSelectedVendorBill, setTxnSelectedVendorBill] = useState<any>(null)
  const [loadingVendorBills, setLoadingVendorBills] = useState(false)

  // Edit Transaction Modal
  const [isEditTxnOpen, setIsEditTxnOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<BankTransaction | null>(null)
  const [editTxnBankId, setEditTxnBankId] = useState("")
  const [editTxnType, setEditTxnType] = useState<string>("Cr")
  const [editTxnDate, setEditTxnDate] = useState("")
  const [editTxnAmount, setEditTxnAmount] = useState("")
  const [editTxnDescription, setEditTxnDescription] = useState("")
  const [editTxnReference, setEditTxnReference] = useState("")
  // Lets a wrong vendor/customer/distributor picked at creation time be
  // properly re-selected afterward (via the same search picker Create uses)
  // instead of being stuck hand-editing an opaque reference string —
  // that gap was the actual cause of "can't change the vendor/customer name".
  const [editTxnSelectedPartyId, setEditTxnSelectedPartyId] = useState("")
  const [editTxnSelectedParty, setEditTxnSelectedParty] = useState<Party | null>(null)
  const [editTxnVendorBills, setEditTxnVendorBills] = useState<any[]>([])
  const [editTxnSelectedVendorBill, setEditTxnSelectedVendorBill] = useState<any>(null)
  const [loadingEditVendorBills, setLoadingEditVendorBills] = useState(false)

  // Delete Transaction — password-gated confirmation
  const [deleteConfirmTxn, setDeleteConfirmTxn] = useState<BankTransaction | null>(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [deletePasswordError, setDeletePasswordError] = useState("")
  const [deletePasswordSubmitting, setDeletePasswordSubmitting] = useState(false)

  // Edit Account Modal
  const [isEditBankOpen, setIsEditBankOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null)
  const [editAccountType, setEditAccountType] = useState<string>("current")
  const [editBankName, setEditBankName] = useState("")
  const [editAccountNo, setEditAccountNo] = useState("")
  const [editIfsc, setEditIfsc] = useState("")
  const [editBranch, setEditBranch] = useState("")
  const [editOpeningBalance, setEditOpeningBalance] = useState("")

  useEffect(() => {
    // Wait until we know the role (and the entityId, where applicable) before
    // loading — otherwise the first fetch runs unscoped and leaks other users'
    // data into the table for a flash before re-fetching.
    if (roleLoading) return
    if ((isDistributor || isRetailer) && entityLoading) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, entityLoading, role, entityId])

  // Alt+I / Alt+O — quick-open Create Transaction pre-set to Payment In
  // (Credit) / Payment Out (Debit), same guarded pattern as the global
  // Alt+P / Alt+S / Alt+D / Alt+C "create new" shortcuts elsewhere in the app.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const key = e.key.toLowerCase()
      if (key !== "i" && key !== "o") return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (target && target.isContentEditable)
      if (isEditable) return

      e.preventDefault()
      resetTxnForm()
      setTxnType(key === "i" ? "Cr" : "Dr")
      setIsCreateTxnOpen(true)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // Resolve scoping inputs once. Roles without an entity (admin / warehouse /
    // customer_support / factories / delivery_driver / vendors) fall through
    // to either "see everything" (admin-like) or auth-user filters where the
    // table has no entity column.
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const authUserId = authUser?.id || null

    // For distributors, also fetch the IDs of retailers under them so we can
    // include retailer-attributed orders/payments in their view.
    let distributorRetailerIds: string[] = []
    if (isDistributor && entityId) {
      const { data: distRetailers } = await supabase
        .from("retailers")
        .select("id")
        .eq("distributor_id", entityId)
      distributorRetailerIds = (distRetailers || []).map((r: any) => r.id)
    }

    // ---- ORDERS (Easebuzz settlements) ----
    let ordersQuery = supabase.from("orders")
      .select("id, order_number, total_amount, payment_status, payment_method, easebuzz_txn_id, order_date")
      .not("easebuzz_txn_id", "is", null)
      .eq("payment_status", "completed")
      .order("order_date", { ascending: false })
    if (isRetailer && entityId) {
      ordersQuery = ordersQuery.eq("retailer_id", entityId)
    } else if (isDistributor && entityId) {
      const parts = [`distributor_id.eq.${entityId}`]
      if (distributorRetailerIds.length > 0) {
        parts.push(`retailer_id.in.(${distributorRetailerIds.join(",")})`)
      }
      ordersQuery = ordersQuery.or(parts.join(","))
    } else if (isFactory && authUserId) {
      ordersQuery = ordersQuery.eq("created_by_user_id", authUserId)
    } else if (!isAdminLike) {
      // Vendors / delivery_driver: no relevant orders — short-circuit.
      ordersQuery = ordersQuery.eq("id", "00000000-0000-0000-0000-000000000000")
    }

    // ---- EXPENSES ----
    let expensesQuery = supabase.from("expenses")
      .select("id, expense_type, amount, description, expense_date, payment_method, added_by")
      .order("expense_date", { ascending: false })
      .limit(500)
    if (!isAdminLike && authUserId) {
      // Distributors / retailers / factories / drivers see only expenses they
      // recorded (`added_by`). Admin / warehouse / customer_support see all.
      expensesQuery = expensesQuery.eq("added_by", authUserId)
    } else if (!isAdminLike) {
      expensesQuery = expensesQuery.eq("id", "00000000-0000-0000-0000-000000000000")
    }

    // ---- DELIVERY REVIEW CASH COLLECTIONS ----
    let deliveryQuery = supabase.from("delivery_review_items")
      .select("id, review_id, order_number, customer_name, verified_payment_method, verified_amount, delivery_status, review:delivery_reviews!review_id(review_date, partner_name, review_status, reviewer_id)")
      .eq("delivery_status", "delivered")
      .eq("verified_payment_method", "cash")
      .gt("verified_amount", 0)
      .order("created_at", { ascending: false })
      .limit(500)
    // delivery_review_items doesn't carry a reviewer column; the parent
    // delivery_reviews row does. Filter via the foreign-table syntax so each
    // role only sees collections they participated in.
    if ((isDistributor || isDeliveryDriver) && authUserId) {
      deliveryQuery = deliveryQuery.eq("review.reviewer_id", authUserId)
    } else if (!isAdminLike) {
      deliveryQuery = deliveryQuery.eq("id", "00000000-0000-0000-0000-000000000000")
    }

    // ---- RETAILER PAYMENTS ----
    let retailerPaymentsQuery = supabase.from("retailer_payments")
      .select("id, retailer_id, payment_date, amount, payment_method, reference, notes, retailer:retailers!retailer_id(name, is_special)")
      .order("payment_date", { ascending: false })
      .limit(500)
    if (isRetailer && entityId) {
      retailerPaymentsQuery = retailerPaymentsQuery.eq("retailer_id", entityId)
    } else if (isDistributor && distributorRetailerIds.length > 0) {
      retailerPaymentsQuery = retailerPaymentsQuery.in("retailer_id", distributorRetailerIds)
    } else if (!isAdminLike) {
      retailerPaymentsQuery = retailerPaymentsQuery.eq("id", "00000000-0000-0000-0000-000000000000")
    }

    // Admin-like roles see the whole shared bank_transactions ledger;
    // everyone else sees only rows they personally created (via the
    // created_by column added by add_bank_transactions_created_by.sql) —
    // otherwise a Factories/Distributor/etc. user could create a transaction
    // here and never see it again. Falls back to the old admin-only
    // behavior if that migration hasn't been run yet, rather than erroring.
    const rawTxnQuery = (async () => {
      if (isAdminLike) {
        return supabase.from("bank_transactions").select("*").order("txn_date", { ascending: false }).limit(500)
      }
      if (!authUserId) return { data: [] as any[], error: null }
      const res = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("created_by", authUserId)
        .order("txn_date", { ascending: false })
        .limit(500)
      const missingCreatedBy =
        res.error &&
        (res.error.code === "PGRST204" || res.error.code === "42703") &&
        /created_by/i.test(res.error.message || "")
      if (missingCreatedBy) {
        console.warn("bank_transactions.created_by column doesn't exist yet (run migrations/add_bank_transactions_created_by.sql) — non-admin roles won't see their own transactions until then.")
        return { data: [] as any[], error: null }
      }
      return res
    })()

    const [banksRes, txnRes, easebuzzRes, expensesRes, deliveryReviewsRes, godownsRes, retailerPaymentsRes] = await Promise.all([
      supabase.from("bank_accounts").select("*").order("bank_name"),
      rawTxnQuery,
      ordersQuery,
      expensesQuery,
      deliveryQuery,
      supabase.from("godowns")
        .select("id, name, godown_code, godown_type, city, manager_name, distributor_id, retailer_id")
        .eq("is_active", true)
        .order("name"),
      retailerPaymentsQuery,
    ])

    const rawBanks = banksRes.data || []
    // Factories role should not see Federal Bank or Saraswat Bank in the
    // accounts list — they only deal with their own scoped transactions.
    const banks = isFactory
      ? rawBanks.filter(b => !/federal\s*bank|saraswat\s*bank/i.test(b.bank_name || ""))
      : rawBanks
    setBankAccounts(banks)
    setGodowns(godownsRes.data || [])

    // Find Federal Bank (Easebuzz settlement account) — use rawBanks so
    // Easebuzz settlement mapping still works even when the bank is hidden
    // from the factories view.
    const federalBank = rawBanks.find(b => b.account_no === "15050200012563")
    const federalBankId = federalBank?.id || ""

    // Find first cash account for expense/delivery cash mapping
    const cashAccount = banks.find(b => b.account_type === "cash")
    const cashAccountId = cashAccount?.id || ""

    // Convert Easebuzz orders to bank transaction format as "Payment In"
    const easebuzzTxns: BankTransaction[] = (easebuzzRes.data || []).map((order: any) => ({
      id: `easebuzz-${order.id}`,
      bank_account_id: federalBankId,
      txn_date: order.order_date,
      value_date: order.order_date,
      amount: parseFloat(String(order.total_amount)) || 0,
      txn_type: "Cr",
      description: `Easebuzz Payment In - ${order.order_number} (${order.payment_method || "online"})`,
      reference: order.easebuzz_txn_id,
      status: "matched",
      source: "easebuzz",
    }))

    // Convert expenses to Payment Out transactions
    // Skip expenses whose description contains "[via <bank>]" — those were created
    // from the reconciliation Expense tab and ALREADY have a real bank_transactions row.
    const expenseTxns: BankTransaction[] = (expensesRes.data || [])
      .filter((exp: any) => !/\[via\s.+\]/i.test(exp.description || ""))
      .map((exp: any) => {
        const isCashExpense = exp.payment_method === "cash"
        return {
          id: `expense-${exp.id}`,
          bank_account_id: isCashExpense ? cashAccountId : federalBankId,
          txn_date: exp.expense_date,
          value_date: exp.expense_date,
          amount: parseFloat(String(exp.amount)) || 0,
          txn_type: "Dr",
          description: `Expense - ${(exp.expense_type || "").replace(/_/g, " ")}${exp.description ? ` (${exp.description})` : ""}`,
          reference: null,
          status: "matched",
          source: "expense",
        }
      })

    // Convert delivery review cash collections to Payment In transactions
    const deliveryCashTxns: BankTransaction[] = (deliveryReviewsRes.data || []).map((item: any) => {
      const review = item.review
      return {
        id: `delivery-${item.id}`,
        bank_account_id: cashAccountId,
        txn_date: review?.review_date || "",
        value_date: review?.review_date || "",
        amount: parseFloat(String(item.verified_amount)) || 0,
        txn_type: "Cr",
        description: `Cash Collection - ${item.customer_name || ""} (${item.order_number}) via ${review?.partner_name || "Delivery"}`,
        reference: item.order_number,
        status: review?.review_status === "completed" ? "matched" : "unmatched",
        source: "delivery",
      }
    })

    // Merge all transactions and sort: latest first (txn_date desc, then created_at desc as tiebreaker)
    const allTxns = [...(txnRes.data || []), ...easebuzzTxns, ...expenseTxns, ...deliveryCashTxns]
      .sort((a: any, b: any) => {
        const dateDiff = new Date(b.txn_date).getTime() - new Date(a.txn_date).getTime()
        if (dateDiff !== 0) return dateDiff
        const ac = a.created_at ? new Date(a.created_at).getTime() : 0
        const bc = b.created_at ? new Date(b.created_at).getTime() : 0
        return bc - ac
      })

    setTransactions(allTxns)
    setLoading(false)
  }

  const isCashType = (type: string) => type === "cash"

  const getOrderTxnStatus = (orderNumber: string, easebuzzTxnId?: string) => {
    const matching = transactions.filter(t =>
      (t.reference && (t.reference === orderNumber || t.reference === easebuzzTxnId)) ||
      (t.description && (t.description.includes(orderNumber)))
    )
    if (matching.length === 0) return null
    const hasCr = matching.some(t => t.txn_type === "Cr")
    const hasDr = matching.some(t => t.txn_type === "Dr")
    if (hasCr && hasDr) return "Payment In & Out"
    if (hasCr) return "Payment In"
    return "Payment Out"
  }

  const handleAddBank = async () => {
    if (!newBankName) { toast.error("Account name is required"); return }
    if (!isCashType(newAccountType) && !newAccountNo) { toast.error("Account number is required for bank accounts"); return }
    // Opening balance is optional — blank/invalid input falls back to 0.
    const openingBalance = parseFloat(newOpeningBalance)
    const seedBalance = Number.isFinite(openingBalance) ? openingBalance : 0
    setSubmitting(true)
    try {
      const { error } = await supabase.from("bank_accounts").insert([{
        bank_name: newBankName,
        account_no: isCashType(newAccountType) ? `CASH-${Date.now()}` : newAccountNo,
        ifsc: isCashType(newAccountType) ? null : (newIfsc || null),
        branch: isCashType(newAccountType) ? null : (newBranch || null),
        account_type: newAccountType,
        current_balance: seedBalance, is_active: true,
      }])
      if (error) throw error
      toast.success(isCashType(newAccountType) ? "Cash account added" : "Bank account added")
      setIsAddBankOpen(false)
      setNewAccountType("current"); setNewBankName(""); setNewAccountNo(""); setNewIfsc(""); setNewBranch(""); setNewOpeningBalance("")
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to add account")
    } finally { setSubmitting(false) }
  }

  const openEditBank = (bank: BankAccount) => {
    setEditingBank(bank)
    setEditAccountType(bank.account_type || "current")
    setEditBankName(bank.bank_name)
    setEditAccountNo(bank.account_no)
    setEditIfsc(bank.ifsc || "")
    setEditBranch(bank.branch || "")
    // Prefer the real opening_balance column once it exists (migrations/
    // add_bank_accounts_opening_balance.sql) — falls back to current_balance
    // for accounts that predate it, same as the migration's own backfill.
    setEditOpeningBalance(String(bank.opening_balance ?? bank.current_balance ?? 0))
    setIsEditBankOpen(true)
  }

  const handleEditBank = async () => {
    if (!editingBank || !editBankName) { toast.error("Account name is required"); return }
    if (!isCashType(editAccountType) && !editAccountNo) { toast.error("Account number is required for bank accounts"); return }
    // Invalid/blank input keeps the account's existing balance rather than
    // silently zeroing it out — unlike Add Account, this field is pre-filled
    // with a real value here, so a blank/garbage edit is more likely a
    // mistake than an intentional "set to zero".
    const parsedBalance = parseFloat(editOpeningBalance)
    const previousOpeningBalance = editingBank.opening_balance ?? editingBank.current_balance ?? 0
    const newOpeningBalance = Number.isFinite(parsedBalance) ? parsedBalance : previousOpeningBalance
    // Only recompute current_balance when this field actually changed —
    // otherwise every metadata-only edit (renaming the account, fixing the
    // IFSC) would re-touch the balance for no reason.
    const openingBalanceChanged = newOpeningBalance !== previousOpeningBalance

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        bank_name: editBankName,
        account_no: editAccountNo,
        ifsc: isCashType(editAccountType) ? null : (editIfsc || null),
        branch: isCashType(editAccountType) ? null : (editBranch || null),
        account_type: editAccountType,
      }

      if (openingBalanceChanged) {
        // Recompute current_balance from scratch — new opening figure plus
        // the net of every transaction on record for this account — instead
        // of the old behavior of just overwriting current_balance outright
        // and silently discarding whatever transaction history had already
        // been logged since account creation.
        const { data: txns, error: txnErr } = await supabase
          .from("bank_transactions")
          .select("amount, txn_type")
          .eq("bank_account_id", editingBank.id)
        if (txnErr) throw txnErr
        const netMovement = (txns || []).reduce(
          (s, t) => s + (t.txn_type === "Cr" ? Number(t.amount) : -Number(t.amount)), 0
        )
        payload.opening_balance = newOpeningBalance
        payload.current_balance = newOpeningBalance + netMovement
      }

      let { error } = await supabase.from("bank_accounts").update(payload).eq("id", editingBank.id)
      if (error && (error.code === "PGRST204" || error.code === "42703") && /opening_balance/i.test(error.message || "")) {
        console.warn("bank_accounts.opening_balance column doesn't exist yet (run migrations/add_bank_accounts_opening_balance.sql) — falling back to a direct current_balance overwrite for now.")
        const { opening_balance, ...rest } = payload
        void opening_balance
        if (openingBalanceChanged) rest.current_balance = newOpeningBalance
        ;({ error } = await supabase.from("bank_accounts").update(rest).eq("id", editingBank.id))
      }
      if (error) throw error
      toast.success("Account updated")
      setIsEditBankOpen(false)
      setEditingBank(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to update account")
    } finally { setSubmitting(false) }
  }

  const handleDeleteBank = async (bank: BankAccount) => {
    if (!confirm(`Are you sure you want to remove "${bank.bank_name}"? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", bank.id)
      if (error) throw error
      toast.success("Bank account removed")
      if (selectedBankId === bank.id) setSelectedBankId("all")
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to remove bank account")
    }
  }

  const searchOrders = async (query?: string, paymentStatus?: string, paymentMethod?: string, dateFrom?: string, dateTo?: string) => {
    setSearchingOrders(true)
    try {
      const searchVal = (query ?? txnOrderSearch).trim()
      const ps = paymentStatus ?? txnPaymentStatusFilter
      const pm = paymentMethod ?? txnPaymentMethodFilter
      const df = dateFrom ?? txnDateFrom
      const dt = dateTo ?? txnDateTo

      // If searching by text, first check if it matches customer name/phone/vip
      let customerIds: string[] = []
      if (searchVal && searchVal.length >= 2) {
        const { data: customers } = await supabase
          .from("customers")
          .select("id")
          .or(`first_name.ilike.%${searchVal}%,last_name.ilike.%${searchVal}%,mobile_primary.ilike.%${searchVal}%,vip_number.ilike.%${searchVal}%`)
          .limit(50)
        customerIds = (customers || []).map(c => c.id)
      }

      let q = supabase
        .from("orders")
        .select("id, order_number, total_amount, payment_status, payment_method, easebuzz_txn_id, order_date, source, customer_id, invoice_number_gst, invoice_number_non_gst")
        .order("order_date", { ascending: false })
        .limit(50)

      if (searchVal && searchVal.length >= 2) {
        const orParts = [
          `order_number.ilike.%${searchVal}%`,
          `easebuzz_txn_id.ilike.%${searchVal}%`,
          `invoice_number_gst.ilike.%${searchVal}%`,
          `invoice_number_non_gst.ilike.%${searchVal}%`,
        ]
        if (customerIds.length > 0) {
          orParts.push(`customer_id.in.(${customerIds.join(",")})`)
        }
        q = q.or(orParts.join(","))
      }

      if (ps && ps !== "all") q = q.eq("payment_status", ps)
      if (pm && pm !== "all") q = q.eq("payment_method", pm)
      if (df) q = q.gte("order_date", df)
      if (dt) q = q.lte("order_date", dt + "T23:59:59.999Z")

      const { data } = await q

      // Fetch customer names for results
      const orderCustomerIds = (data || []).filter(o => o.customer_id).map(o => o.customer_id)
      const customerMap: Record<string, { first_name: string; last_name: string; mobile_primary: string; vip_number: string | null }> = {}
      if (orderCustomerIds.length > 0) {
        const uniqueIds = [...new Set(orderCustomerIds)]
        const { data: custData } = await supabase
          .from("customers")
          .select("id, first_name, last_name, mobile_primary, vip_number")
          .in("id", uniqueIds)
        if (custData) {
          custData.forEach(c => { customerMap[c.id] = c })
        }
      }

      const results = (data || []).map(order => ({
        ...order,
        customer_name: order.customer_id && customerMap[order.customer_id]
          ? `${customerMap[order.customer_id].first_name} ${customerMap[order.customer_id].last_name}`
          : null,
        customer_phone: order.customer_id && customerMap[order.customer_id]
          ? customerMap[order.customer_id].mobile_primary
          : null,
        customer_vip: order.customer_id && customerMap[order.customer_id]
          ? customerMap[order.customer_id].vip_number
          : null,
      }))

      setTxnOrderResults(results)
    } catch {
      setTxnOrderResults([])
    } finally { setSearchingOrders(false) }
  }

  const handleSelectOrder = (order: any) => {
    setTxnSelectedOrder(order)
    setTxnAmount(String(order.total_amount))
    setTxnDescription(`Payment In - ${order.order_number} (${order.payment_method || "online"})`)
    setTxnReference(order.easebuzz_txn_id || order.order_number)
    setTxnDate(new Date().toISOString().split("T")[0])
    setTxnOrderSearch("")
    setTxnOrderResults([])
  }

  // Picks from the FULL real distributors/customers tables (via
  // PartyCombobox), not just the ones with a registered godown — that's the
  // whole fix, since only a handful of distributors have one. When the
  // selected distributor DOES have a linked godown, the reference keeps the
  // GODOWN: prefix so it still shows up in that warehouse's transaction list
  // on /dashboard/warehouse-orders; otherwise it falls back to a direct
  // DISTRIBUTOR:/CUSTOMER: reference.
  const handleSelectDistributorParty = (partyId: string, party: Party | null) => {
    setTxnSelectedDistributor(partyId)
    setTxnSelectedParty(party)
    setTxnSelectedVendorBill(null)
    setTxnVendorBills([])
    if (!party) return
    setTxnDescription(`${txnType === "Cr" ? "Payment In" : "Payment Out"} - ${party.name}`)
    const linkedGodown = party.type === "distributor"
      ? godowns.find(g => g.distributor_id === partyId)
      : party.type === "retailer"
        ? godowns.find(g => g.retailer_id === partyId)
        : null
    setTxnReference(linkedGodown ? `GODOWN:${linkedGodown.id}` : `${party.type.toUpperCase()}:${partyId}`)

    if (party.type === "vendor") {
      fetchVendorBills(party.id)
    }
  }

  // Outstanding/recent bills for the selected vendor, so a Payment Out can be
  // tied to the specific purchase it's settling instead of just the vendor
  // in general — mirrors the Find Order tab, scoped to one vendor's own
  // purchases.
  const fetchVendorBills = async (vendorId: string) => {
    setLoadingVendorBills(true)
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, purchase_number, invoice_number, total_amount, paid_amount, remaining_amount, payment_status, purchase_date")
        .eq("vendor_id", vendorId)
        .order("purchase_date", { ascending: false })
        .limit(50)
      if (error) throw error
      setTxnVendorBills(data || [])
    } catch (err) {
      console.error("Error fetching vendor bills:", err)
      setTxnVendorBills([])
    } finally {
      setLoadingVendorBills(false)
    }
  }

  const handleSelectVendorBill = (bill: any) => {
    setTxnSelectedVendorBill(bill)
    if (!txnSelectedParty) return
    const billLabel = `${bill.purchase_number}${bill.invoice_number ? ` (${bill.invoice_number})` : ""}`
    setTxnDescription(`${txnType === "Cr" ? "Payment In" : "Payment Out"} - ${txnSelectedParty.name} - ${billLabel}`)
    setTxnReference(`PURCHASE:${bill.id}`)
    // Pre-fill with what's still owed on this specific bill, if tracked.
    if (bill.remaining_amount > 0) {
      setTxnAmount(String(bill.remaining_amount))
    }
  }

  // Keeps the auto-filled "Payment In - X" / "Payment Out - X" description in
  // sync if the Type is changed AFTER picking a party/bill — previously the
  // description was only set once at selection time, so toggling Credit/
  // Debit afterward left a stale, contradictory label (found in the wild:
  // several "Payment In" entries that were actually saved as Debit).
  const handleTxnTypeChange = (newType: string) => {
    setTxnType(newType)
    if (txnSelectedParty && txnMode === "distributor") {
      const prefix = newType === "Cr" ? "Payment In" : "Payment Out"
      const billLabel = txnSelectedVendorBill
        ? ` - ${txnSelectedVendorBill.purchase_number}${txnSelectedVendorBill.invoice_number ? ` (${txnSelectedVendorBill.invoice_number})` : ""}`
        : ""
      setTxnDescription(`${prefix} - ${txnSelectedParty.name}${billLabel}`)
    }
  }

  // Vendor picker on the Expense tab — same free-text VENDOR: reference tag
  // as the Distributor tab, just for tagging which vendor an expense (e.g.
  // rent, purchase payment) actually went to.
  const handleSelectExpenseVendor = (vendorId: string, party: Party | null) => {
    setTxnExpenseVendor(party)
    if (!party) { setTxnReference(""); return }
    setTxnReference(`VENDOR:${party.id}`)
    setTxnDescription(`${(txnExpenseType || "").replace(/_/g, " ")} - ${party.name}`)
  }

  // Keeps bank_accounts.current_balance in sync as transactions happen,
  // instead of it being a static number frozen at whatever it was seeded to
  // when the account was created. Read-then-write (no atomic increment
  // available over PostgREST without an RPC) — acceptable here since
  // transactions are created one at a time through this dialog, not at a
  // concurrency level where the read-then-write race actually matters.
  const adjustAccountBalance = async (bankAccountId: string, delta: number) => {
    const { data: acct, error: fetchErr } = await supabase
      .from("bank_accounts")
      .select("current_balance")
      .eq("id", bankAccountId)
      .single()
    if (fetchErr || !acct) {
      console.error("Failed to read account balance for update:", fetchErr)
      return
    }
    const { error: updateErr } = await supabase
      .from("bank_accounts")
      .update({ current_balance: Number(acct.current_balance || 0) + delta })
      .eq("id", bankAccountId)
    if (updateErr) {
      console.error("Failed to update account balance:", updateErr)
    }
  }

  // A payment created against a specific vendor bill (reference
  // "PURCHASE:<id>", set by the vendor-bill-picker in the Distributor tab)
  // otherwise only ever touched bank_transactions — the linked purchase's
  // own paid_amount never moved, so the Vendor panel's "Amount Payable"
  // (a straight sum of purchases.remaining_amount) silently stayed wrong
  // even after the bill was fully paid here. This keeps them in sync:
  // Dr (money going out to the vendor) increases what's been paid;
  // Cr (a refund coming back in) decreases it. remaining_amount is a
  // generated column (total_amount - paid_amount) so only paid_amount is
  // ever written directly.
  const purchaseIdFromReference = (ref: string | null | undefined): string | null =>
    ref?.startsWith("PURCHASE:") ? ref.slice("PURCHASE:".length) : null

  const adjustPurchasePayment = async (purchaseId: string, delta: number) => {
    const { data: purchase, error: fetchErr } = await supabase
      .from("purchases")
      .select("paid_amount, total_amount")
      .eq("id", purchaseId)
      .single()
    if (fetchErr || !purchase) {
      console.error("Failed to read purchase for payment update:", fetchErr)
      return
    }
    const totalAmount = Number(purchase.total_amount || 0)
    const newPaidAmount = Math.max(0, Number(purchase.paid_amount || 0) + delta)
    const paymentStatus = newPaidAmount <= 0 ? "pending" : newPaidAmount >= totalAmount ? "completed" : "partial"
    const { error: updateErr } = await supabase
      .from("purchases")
      .update({ paid_amount: newPaidAmount, payment_status: paymentStatus })
      .eq("id", purchaseId)
    if (updateErr) {
      console.error("Failed to update purchase payment:", updateErr)
    }
  }

  // Mirror of adjustPurchasePayment for the receivable side. orders has no
  // paid_amount/remaining_amount at all until
  // migrations/add_order_payment_allocations.sql runs — degrades to a
  // no-op (logged, not thrown) until then rather than breaking transaction
  // creation over a column that doesn't exist yet.
  const adjustOrderPayment = async (orderId: string, delta: number) => {
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("paid_amount, total_amount")
      .eq("id", orderId)
      .single()
    if (fetchErr || !order) {
      if (!(fetchErr && (fetchErr.code === "PGRST204" || fetchErr.code === "42703") && /paid_amount/i.test(fetchErr.message || ""))) {
        console.error("Failed to read order for payment update:", fetchErr)
      }
      return
    }
    const totalAmount = Number(order.total_amount || 0)
    const newPaidAmount = Math.max(0, Number(order.paid_amount || 0) + delta)
    const paymentStatus = newPaidAmount <= 0 ? "pending" : newPaidAmount >= totalAmount ? "completed" : "partial"
    const { error: updateErr } = await supabase
      .from("orders")
      .update({ paid_amount: newPaidAmount, payment_status: paymentStatus })
      .eq("id", orderId)
    if (updateErr) {
      console.error("Failed to update order payment:", updateErr)
    }
  }

  const isMissingAllocationsTable = (error: any) =>
    !!error && (error.code === "PGRST205" || error.code === "PGRST204" || error.code === "42P01" || /payment_allocations/i.test(error.message || ""))

  // A vendor payment (Payment Out, Dr) auto-allocates against their open
  // bills instead of needing a bill manually picked every time — same
  // default behavior Tally/Vyapar use. A specific bill (from the picker)
  // gets the whole amount even if it overpays it; otherwise it walks the
  // vendor's oldest open bills first (FIFO), splitting across as many as
  // the amount covers. Any leftover past the last open bill is an
  // unallocated advance ("on account") — normal, not an error.
  // Writes one payment_allocations row per bill touched so the exact split
  // can be reversed correctly later; degrades gracefully (still updates
  // purchases.paid_amount, just without a reversal record) if that table
  // doesn't exist yet — run migrations/add_payment_allocations.sql to get
  // full multi-bill edit/delete support.
  const allocatePayment = async (
    bankTransactionId: string,
    vendorId: string,
    amount: number,
    specificBillId?: string
  ) => {
    const recordAllocation = async (purchaseId: string, applied: number) => {
      const { error } = await supabase
        .from("payment_allocations")
        .insert([{ bank_transaction_id: bankTransactionId, purchase_id: purchaseId, amount_applied: applied }])
      if (error && !isMissingAllocationsTable(error)) {
        console.error("Failed to record payment allocation:", error)
      }
    }

    if (specificBillId) {
      await adjustPurchasePayment(specificBillId, amount)
      await recordAllocation(specificBillId, amount)
      return
    }

    const { data: openBills, error: billsErr } = await supabase
      .from("purchases")
      .select("id, total_amount, paid_amount")
      .eq("vendor_id", vendorId)
      .gt("remaining_amount", 0)
      .order("purchase_date", { ascending: true })
    if (billsErr || !openBills) {
      console.error("Failed to fetch open bills for FIFO allocation:", billsErr)
      return
    }

    let remaining = amount
    for (const bill of openBills) {
      if (remaining <= 0) break
      const billOwed = Number(bill.total_amount || 0) - Number(bill.paid_amount || 0)
      if (billOwed <= 0) continue
      const applied = Math.min(billOwed, remaining)
      await adjustPurchasePayment(bill.id, applied)
      await recordAllocation(bill.id, applied)
      remaining -= applied
    }
  }

  // Mirror of allocatePayment for the receivable side — a Payment In from a
  // distributor/customer/retailer auto-allocates against their oldest
  // unpaid KP orders (FIFO), instead of the order sitting "pending"
  // forever on the Bills Receivable card despite the payment being on
  // record. Scoped to KP-prefixed orders only, matching exactly what that
  // card counts, so this never touches other order flows (COD, Easebuzz,
  // etc.) that already track payment their own way.
  const allocateReceivable = async (
    bankTransactionId: string,
    partyType: "distributor" | "customer" | "retailer",
    partyId: string,
    amount: number
  ) => {
    const recordAllocation = async (orderId: string, applied: number) => {
      const { error } = await supabase
        .from("payment_allocations")
        .insert([{ bank_transaction_id: bankTransactionId, order_id: orderId, amount_applied: applied }])
      if (error && !isMissingAllocationsTable(error)) {
        console.error("Failed to record payment allocation:", error)
      }
    }

    const partyColumn = partyType === "distributor" ? "distributor_id" : partyType === "retailer" ? "retailer_id" : "customer_id"
    const { data: openOrders, error: ordersErr } = await supabase
      .from("orders")
      .select("id, total_amount, paid_amount, order_number, invoice_number_gst, invoice_number_non_gst, order_date")
      .eq(partyColumn, partyId)
      .in("payment_status", ["pending", "partial", "processing"])
      .order("order_date", { ascending: true })
    if (ordersErr || !openOrders) {
      console.error("Failed to fetch open orders for FIFO allocation:", ordersErr)
      return
    }
    const kpOrders = openOrders.filter((o: any) =>
      /^KP/i.test(o.order_number || "") || /^KP/i.test(o.invoice_number_gst || "") || /^KP/i.test(o.invoice_number_non_gst || "")
    )

    let remaining = amount
    for (const order of kpOrders) {
      if (remaining <= 0) break
      const owed = Number(order.total_amount || 0) - Number(order.paid_amount || 0)
      if (owed <= 0) continue
      const applied = Math.min(owed, remaining)
      await adjustOrderPayment(order.id, applied)
      await recordAllocation(order.id, applied)
      remaining -= applied
    }
  }

  // Reverses whatever a payment was actually allocated against. Reads
  // payment_allocations (correct for anything allocated via allocatePayment
  // above, including multi-bill FIFO splits) and falls back to the older
  // single PURCHASE:<id> reference-based reversal for transactions created
  // before this table existed, or if it hasn't been migrated in yet.
  const reversePaymentAllocations = async (txn: BankTransaction) => {
    const { data: allocations, error } = await supabase
      .from("payment_allocations")
      .select("id, purchase_id, order_id, amount_applied")
      .eq("bank_transaction_id", txn.id)

    if (!isMissingAllocationsTable(error) && allocations && allocations.length > 0) {
      for (const alloc of allocations) {
        const amt = Number(alloc.amount_applied)
        if (alloc.purchase_id) {
          // Purchases: Dr increased paid_amount, so reverse the opposite way.
          await adjustPurchasePayment(alloc.purchase_id, txn.txn_type === "Dr" ? -amt : amt)
        } else if (alloc.order_id) {
          // Orders: Cr increased paid_amount (opposite convention) — reverse accordingly.
          await adjustOrderPayment(alloc.order_id, txn.txn_type === "Cr" ? -amt : amt)
        }
      }
      await supabase.from("payment_allocations").delete().eq("bank_transaction_id", txn.id)
      return
    }

    const linkedPurchaseId = purchaseIdFromReference(txn.reference)
    if (linkedPurchaseId) {
      await adjustPurchasePayment(linkedPurchaseId, txn.txn_type === "Dr" ? -txn.amount : txn.amount)
    }
  }

  // Inserts one bank_transactions row, tolerating a created_by column that
  // may not exist yet (same PGRST204/42703-retry pattern used elsewhere in
  // the app) — returns the inserted row's id so callers (contra entries)
  // can roll it back if a paired second insert fails.
  const insertBankTransaction = async (
    payload: Record<string, any>
  ): Promise<{ data: { id: string } | null; error: any }> => {
    let { data, error } = await supabase.from("bank_transactions").insert([payload]).select("id").single()
    if (error && (error.code === "PGRST204" || error.code === "42703") && /created_by/i.test(error.message || "")) {
      console.warn("bank_transactions.created_by column doesn't exist yet — saving without it for now.")
      const { created_by, ...rest } = payload
      void created_by
      ;({ data, error } = await supabase.from("bank_transactions").insert([rest]).select("id").single())
    }
    return { data, error }
  }

  const handleCreateTransaction = async () => {
    const isContraMode = txnMode === "contra"

    if (isContraMode) {
      if (!txnContraFromAccount || !txnContraToAccount) { toast.error("Please select both accounts"); return }
      if (txnContraFromAccount === txnContraToAccount) { toast.error("From and To accounts must be different"); return }
    } else if (!txnBankId) {
      toast.error("Please select an account"); return
    }
    if (!txnAmount || parseFloat(txnAmount) <= 0) { toast.error("Please enter a valid amount"); return }

    // Prevent duplicate: same order + same txn type
    if (txnSelectedOrder) {
      const orderRef = txnReference || txnSelectedOrder.order_number
      const duplicate = transactions.find(t =>
        t.txn_type === txnType &&
        ((t.reference && t.reference === orderRef) || (t.description && t.description.includes(txnSelectedOrder.order_number)))
      )
      if (duplicate) {
        const typeLabel = txnType === "Cr" ? "Payment In" : "Payment Out"
        toast.error(`${typeLabel} already exists for order ${txnSelectedOrder.order_number}`)
        return
      }
    }

    const isExpenseMode = txnMode === "expense"
    const effectiveTxnType = isExpenseMode ? "Dr" : txnType

    setSubmitting(true)
    try {
      const amount = parseFloat(txnAmount)
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (isContraMode) {
        const pairId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const contraRef = `CONTRA:${pairId}`
        const baseDescription = txnDescription || "Contra Entry"
        const fromAccount = bankAccounts.find(b => b.id === txnContraFromAccount)
        const toAccount = bankAccounts.find(b => b.id === txnContraToAccount)

        const fromResult = await insertBankTransaction({
          bank_account_id: txnContraFromAccount,
          txn_date: txnDate,
          value_date: txnDate,
          amount,
          txn_type: "Dr",
          description: toAccount ? `${baseDescription} (to ${toAccount.bank_name})` : baseDescription,
          reference: contraRef,
          status: "matched",
          created_by: authUser?.id || null,
        })
        if (fromResult.error) throw fromResult.error

        const toResult = await insertBankTransaction({
          bank_account_id: txnContraToAccount,
          txn_date: txnDate,
          value_date: txnDate,
          amount,
          txn_type: "Cr",
          description: fromAccount ? `${baseDescription} (from ${fromAccount.bank_name})` : baseDescription,
          reference: contraRef,
          status: "matched",
          created_by: authUser?.id || null,
        })
        if (toResult.error) {
          // Never leave a lone half-contra entry behind — undo the first leg.
          if (fromResult.data?.id) {
            await supabase.from("bank_transactions").delete().eq("id", fromResult.data.id)
          }
          throw toResult.error
        }

        await adjustAccountBalance(txnContraFromAccount, -amount)
        await adjustAccountBalance(txnContraToAccount, amount)

        toast.success("Contra entry created")
        setIsCreateTxnOpen(false)
        resetTxnForm()
        fetchData()
        return
      }

      const { data: insertedTxn, error } = await insertBankTransaction({
        bank_account_id: txnBankId,
        txn_date: txnDate,
        value_date: txnDate,
        amount,
        txn_type: effectiveTxnType,
        description: txnDescription || null,
        reference: txnReference || null,
        status: "matched",
        created_by: authUser?.id || null,
      })
      if (error) throw error

      // Credit adds to the account balance, Debit subtracts — applied right
      // as the transaction happens, not left as a static opening-balance
      // number that never moves.
      await adjustAccountBalance(txnBankId, effectiveTxnType === "Cr" ? amount : -amount)

      // Vendor payments (Payment Out) auto-allocate against their bills —
      // the specific one picked in the bill-picker if any, otherwise FIFO
      // across their oldest open bills. This is what actually keeps
      // purchases.paid_amount (and the Vendor panel's payable total) in
      // sync — it previously only happened when a bill was manually
      // picked, which is why unlinked payments left a large stale
      // outstanding balance despite being paid.
      if (insertedTxn?.id && txnMode === "distributor" && txnSelectedParty?.type === "vendor" && effectiveTxnType === "Dr") {
        await allocatePayment(insertedTxn.id, txnSelectedParty.id, amount, txnSelectedVendorBill?.id)
      } else if (
        insertedTxn?.id && txnMode === "distributor" && effectiveTxnType === "Cr" &&
        (txnSelectedParty?.type === "distributor" || txnSelectedParty?.type === "customer" || txnSelectedParty?.type === "retailer")
      ) {
        // Receivable mirror: a Payment In from a distributor/customer/
        // retailer auto-allocates against their oldest unpaid KP orders.
        await allocateReceivable(insertedTxn.id, txnSelectedParty.type, txnSelectedParty.id, amount)
      } else {
        // Legacy path — a reference pointing directly at one purchase that
        // didn't come through the vendor picker (e.g. hand-set via Edit
        // Transaction's Reference field).
        const linkedPurchaseId = purchaseIdFromReference(txnReference)
        if (linkedPurchaseId) {
          await adjustPurchasePayment(linkedPurchaseId, effectiveTxnType === "Dr" ? amount : -amount)
        }
      }

      if (isExpenseMode) {
        const selectedBank = bankAccounts.find(b => b.id === txnBankId)
        const isCashAccount = selectedBank?.account_type === "cash"
        const expenseLabel = txnDescription
          ? `${txnDescription} [via ${selectedBank?.bank_name || "Bank"}]`
          : `${(txnExpenseType || "").replace(/_/g, " ")} [via ${selectedBank?.bank_name || "Bank"}]`
        const { error: expErr } = await supabase.from("expenses").insert([{
          expense_type: txnExpenseType || "daily_expenses",
          amount,
          description: expenseLabel,
          expense_date: txnDate,
          payment_method: isCashAccount ? "cash" : "bank_transfer",
          added_by: authUser?.id || null,
        }])
        if (expErr) {
          toast.warning(`Bank txn saved, but expense entry failed: ${expErr.message}`)
        } else {
          toast.success("Transaction + expense recorded")
        }
      } else {
        toast.success("Transaction created")
      }

      setIsCreateTxnOpen(false)
      resetTxnForm()
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to create transaction")
    } finally { setSubmitting(false) }
  }

  const resetTxnForm = () => {
    setTxnBankId("")
    setTxnType("Cr")
    setTxnOrderSearch("")
    setTxnOrderResults([])
    setTxnSelectedOrder(null)
    setTxnAmount("")
    setTxnDescription("")
    setTxnReference("")
    setTxnDate(new Date().toISOString().split("T")[0])
    setTxnPaymentStatusFilter("all")
    setTxnPaymentMethodFilter("all")
    setTxnDateFrom("")
    setTxnDateTo("")
    setTxnMode("order")
    setTxnSelectedDistributor("")
    setTxnSelectedParty(null)
    setTxnVendorBills([])
    setTxnSelectedVendorBill(null)
    setTxnExpenseType("daily_expenses")
    setTxnExpenseVendor(null)
    setTxnContraFromAccount("")
    setTxnContraToAccount("")
  }

  const handleMatchTransaction = async (txnId: string) => {
    const { error } = await supabase.from("bank_transactions")
      .update({ status: "matched" }).eq("id", txnId)
    if (error) { toast.error("Failed to match"); return }
    toast.success("Transaction matched")
    fetchData()
  }

  const handleIgnoreTransaction = async (txnId: string) => {
    const { error } = await supabase.from("bank_transactions")
      .update({ status: "ignored" }).eq("id", txnId)
    if (error) { toast.error("Failed"); return }
    toast.success("Transaction ignored")
    fetchData()
  }

  // Outstanding/recent bills for a vendor selected while editing an existing
  // transaction — same query as the Create Transaction picker, kept as a
  // separate copy since Create's txnVendorBills/txnSelectedVendorBill are
  // reset by resetTxnForm() and shouldn't be disturbed by editing something
  // else at the same time.
  const fetchEditVendorBills = async (vendorId: string) => {
    setLoadingEditVendorBills(true)
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, purchase_number, invoice_number, total_amount, paid_amount, remaining_amount, payment_status, purchase_date")
        .eq("vendor_id", vendorId)
        .order("purchase_date", { ascending: false })
        .limit(50)
      if (error) throw error
      setEditTxnVendorBills(data || [])
    } catch (err) {
      console.error("Error fetching vendor bills for edit:", err)
      setEditTxnVendorBills([])
    } finally {
      setLoadingEditVendorBills(false)
    }
  }

  const openEditTransaction = async (txn: BankTransaction) => {
    setEditingTxn(txn)
    setEditTxnBankId(txn.bank_account_id)
    setEditTxnType(txn.txn_type)
    setEditTxnDate(txn.txn_date)
    setEditTxnAmount(String(txn.amount))
    setEditTxnDescription(txn.description || "")
    setEditTxnReference(txn.reference || "")
    setEditTxnSelectedPartyId("")
    setEditTxnSelectedParty(null)
    setEditTxnVendorBills([])
    setEditTxnSelectedVendorBill(null)
    setIsEditTxnOpen(true)

    // Best-effort: resolve the existing reference back into a party so the
    // picker opens already showing who this transaction is currently linked
    // to, instead of blank even though a real party is attached. PartyCombobox
    // self-resolves a bare id into a display name, so a raw id is enough here.
    const ref = txn.reference || ""
    const directMatch = ref.match(/^(VENDOR|CUSTOMER|DISTRIBUTOR|RETAILER):(.+)$/)
    if (directMatch) {
      setEditTxnSelectedPartyId(directMatch[2])
      if (directMatch[1] === "VENDOR") fetchEditVendorBills(directMatch[2])
      return
    }
    const godownMatch = ref.match(/^GODOWN:(.+)$/)
    if (godownMatch) {
      const g = godowns.find(g => g.id === godownMatch[1])
      if (g?.distributor_id) setEditTxnSelectedPartyId(g.distributor_id)
      else if (g?.retailer_id) setEditTxnSelectedPartyId(g.retailer_id)
      return
    }
    const purchaseMatch = ref.match(/^PURCHASE:(.+)$/)
    if (purchaseMatch) {
      const { data: purchase } = await supabase
        .from("purchases")
        .select("id, vendor_id, purchase_number, invoice_number, total_amount, paid_amount, remaining_amount, payment_status, purchase_date")
        .eq("id", purchaseMatch[1])
        .maybeSingle()
      if (purchase?.vendor_id) {
        setEditTxnSelectedPartyId(purchase.vendor_id)
        setEditTxnSelectedVendorBill(purchase)
        fetchEditVendorBills(purchase.vendor_id)
      }
    }
  }

  // Re-selecting a party updates BOTH the description and the reference —
  // the reference is what the vendor-bill-picker/payment-sync logic and the
  // Vendor panel's balance actually key off, so just editing the description
  // text alone would leave the record still pointed at the old party.
  const handleEditSelectParty = (partyId: string, party: Party | null) => {
    setEditTxnSelectedPartyId(partyId)
    setEditTxnSelectedParty(party)
    setEditTxnSelectedVendorBill(null)
    setEditTxnVendorBills([])
    if (!party) return
    setEditTxnDescription(`${editTxnType === "Cr" ? "Payment In" : "Payment Out"} - ${party.name}`)
    const linkedGodown = party.type === "distributor"
      ? godowns.find(g => g.distributor_id === partyId)
      : party.type === "retailer"
        ? godowns.find(g => g.retailer_id === partyId)
        : null
    setEditTxnReference(linkedGodown ? `GODOWN:${linkedGodown.id}` : `${party.type.toUpperCase()}:${partyId}`)
    if (party.type === "vendor") {
      fetchEditVendorBills(party.id)
    }
  }

  const handleEditSelectVendorBill = (bill: any) => {
    setEditTxnSelectedVendorBill(bill)
    if (!editTxnSelectedParty) return
    const billLabel = `${bill.purchase_number}${bill.invoice_number ? ` (${bill.invoice_number})` : ""}`
    setEditTxnDescription(`${editTxnType === "Cr" ? "Payment In" : "Payment Out"} - ${editTxnSelectedParty.name} - ${billLabel}`)
    setEditTxnReference(`PURCHASE:${bill.id}`)
  }

  // Same staleness guard as the Create dialog's handleTxnTypeChange — keeps
  // the "Payment In/Out" prefix in sync if the Type is changed after a party
  // is already selected, instead of leaving a description that contradicts
  // the txn_type actually being saved.
  const handleEditTxnTypeChange = (newType: string) => {
    setEditTxnType(newType)
    if (editTxnSelectedParty) {
      const prefix = newType === "Cr" ? "Payment In" : "Payment Out"
      const billLabel = editTxnSelectedVendorBill
        ? ` - ${editTxnSelectedVendorBill.purchase_number}${editTxnSelectedVendorBill.invoice_number ? ` (${editTxnSelectedVendorBill.invoice_number})` : ""}`
        : ""
      setEditTxnDescription(`${prefix} - ${editTxnSelectedParty.name}${billLabel}`)
    }
  }

  const handleUpdateTransaction = async () => {
    if (!editingTxn) return
    if (!editTxnBankId) { toast.error("Please select an account"); return }
    const newAmount = parseFloat(editTxnAmount)
    if (!editTxnAmount || newAmount <= 0) { toast.error("Please enter a valid amount"); return }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from("bank_transactions")
        .update({
          bank_account_id: editTxnBankId,
          txn_date: editTxnDate,
          value_date: editTxnDate,
          amount: newAmount,
          txn_type: editTxnType,
          description: editTxnDescription || null,
          reference: editTxnReference || null,
        })
        .eq("id", editingTxn.id)
      if (error) throw error

      // Reverse the OLD entry's effect, then apply the NEW one — handles
      // amount/type/account all changing at once, and nets out correctly
      // even when the account itself didn't change (two deltas on the same
      // account, applied in sequence).
      await adjustAccountBalance(
        editingTxn.bank_account_id,
        editingTxn.txn_type === "Cr" ? -editingTxn.amount : editingTxn.amount
      )
      await adjustAccountBalance(
        editTxnBankId,
        editTxnType === "Cr" ? newAmount : -newAmount
      )

      // Same reverse-old/apply-new pattern for whatever bill(s) this payment
      // was allocated against — covers the party being re-picked to someone
      // else, the bill link changing, or just the amount/type changing.
      // Reverse first (whether that was a single legacy reference or a
      // multi-bill FIFO split), then re-allocate fresh against the new state.
      await reversePaymentAllocations(editingTxn)
      if (editTxnSelectedParty?.type === "vendor" && editTxnType === "Dr") {
        await allocatePayment(editingTxn.id, editTxnSelectedParty.id, newAmount, editTxnSelectedVendorBill?.id)
      } else if (
        editTxnType === "Cr" &&
        (editTxnSelectedParty?.type === "distributor" || editTxnSelectedParty?.type === "customer" || editTxnSelectedParty?.type === "retailer")
      ) {
        await allocateReceivable(editingTxn.id, editTxnSelectedParty.type, editTxnSelectedParty.id, newAmount)
      } else {
        const newPurchaseId = purchaseIdFromReference(editTxnReference)
        if (newPurchaseId) {
          await adjustPurchasePayment(newPurchaseId, editTxnType === "Dr" ? newAmount : -newAmount)
        }
      }

      toast.success("Transaction updated")
      setIsEditTxnOpen(false)
      setEditingTxn(null)
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to update transaction")
    } finally { setSubmitting(false) }
  }

  // Deleting is password-gated (re-enter your own login password) — this
  // just opens the confirmation dialog; the actual delete runs from
  // confirmDeleteWithPassword() below once the password checks out.
  const handleDeleteTransaction = (txn: BankTransaction) => {
    setDeleteConfirmTxn(txn)
    setDeletePassword("")
    setDeletePasswordError("")
  }

  const performDeleteTransaction = async (txn: BankTransaction) => {
    const isContraLeg = !!txn.reference?.startsWith("CONTRA:")

    // Find the other leg BEFORE deleting this one, while we can still look
    // it up by the shared CONTRA: reference.
    let pairedLeg: BankTransaction | null = null
    if (isContraLeg) {
      const { data } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("reference", txn.reference)
        .neq("id", txn.id)
        .maybeSingle()
      pairedLeg = data
    }

    // Reverse whatever bill(s) this payment was allocated against BEFORE
    // deleting the row — payment_allocations has ON DELETE CASCADE on
    // bank_transaction_id, so deleting the transaction first would wipe out
    // the allocation records before we get a chance to read and reverse them.
    await reversePaymentAllocations(txn)

    const { error } = await supabase.from("bank_transactions").delete().eq("id", txn.id)
    if (error) { toast.error("Failed to delete transaction"); return }
    // Reverse this transaction's effect on the account balance — the exact
    // opposite of what create applied.
    await adjustAccountBalance(txn.bank_account_id, txn.txn_type === "Cr" ? -txn.amount : txn.amount)

    if (pairedLeg) {
      const { error: pairErr } = await supabase.from("bank_transactions").delete().eq("id", pairedLeg.id)
      if (pairErr) {
        toast.warning("Removed this entry, but couldn't remove its linked pair — please remove it manually.")
      } else {
        await adjustAccountBalance(pairedLeg.bank_account_id, pairedLeg.txn_type === "Cr" ? -pairedLeg.amount : pairedLeg.amount)
      }
    }

    toast.success(isContraLeg ? "Contra entry removed" : "Transaction removed")
    fetchData()
  }

  // Re-authenticates with the CURRENTLY logged-in user's own email + the
  // password they just typed — signInWithPassword is the only password-check
  // primitive Supabase auth exposes, and re-signing-in as yourself with your
  // own correct password is a harmless no-op on the session, so it doubles
  // fine as a "verify my password" check here.
  const confirmDeleteWithPassword = async () => {
    if (!deleteConfirmTxn) return
    if (!deletePassword) { setDeletePasswordError("Enter your password to confirm"); return }
    setDeletePasswordSubmitting(true)
    setDeletePasswordError("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setDeletePasswordError("Couldn't verify your account — please re-login and try again.")
        return
      }
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: deletePassword })
      if (authError) {
        setDeletePasswordError("Incorrect password")
        return
      }
      const txn = deleteConfirmTxn
      setDeleteConfirmTxn(null)
      setDeletePassword("")
      await performDeleteTransaction(txn)
    } finally {
      setDeletePasswordSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)

  const filtered = transactions.filter(t => {
    const matchesBank = selectedBankId === "all" || t.bank_account_id === selectedBankId
    const matchesStatus = statusFilter === "all" || t.status === statusFilter
    const matchesType = typeFilter === "all" || t.txn_type === typeFilter
    const matchesDateFrom = !dateFromFilter || t.txn_date >= dateFromFilter
    const matchesDateTo = !dateToFilter || t.txn_date <= dateToFilter
    const matchesSearch = searchTerm === "" ||
      (t.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.reference || "").toLowerCase().includes(searchTerm.toLowerCase())
    return matchesBank && matchesStatus && matchesType && matchesDateFrom && matchesDateTo && matchesSearch
  })

  // Totals reflect every currently-filtered transaction, not just the rows
  // visible on this page — so switching pages/rows-per-page doesn't change
  // the number, but tightening a filter narrows it as expected.
  const filteredDebitTotal = filtered.filter(t => t.txn_type === "Dr").reduce((s, t) => s + Number(t.amount), 0)
  const filteredCreditTotal = filtered.filter(t => t.txn_type === "Cr").reduce((s, t) => s + Number(t.amount), 0)

  const sortValue = (t: BankTransaction, column: SortColumnName): string | number => {
    switch (column) {
      case "date": return new Date(t.txn_date).getTime()
      case "account": return bankAccounts.find(b => b.id === t.bank_account_id)?.bank_name || ""
      case "description": return (t.description || "").toLowerCase()
      case "debit": return t.txn_type === "Dr" ? Number(t.amount) : -1
      case "credit": return t.txn_type === "Cr" ? Number(t.amount) : -1
      case "status": return t.status
    }
  }
  const sorted = [...filtered].sort((a, b) => {
    const va = sortValue(a, sortColumn)
    const vb = sortValue(b, sortColumn)
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))
    return sortDirection === "asc" ? cmp : -cmp
  })

  const totalPages = Math.ceil(sorted.length / pageSize)
  const safeCurrentPage = Math.min(currentPage, totalPages || 1)
  const paginatedTxns = sorted.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)

  // Same math used to track down the HDFC opening-balance error — shown
  // directly on each account card now so a mismatch is visible at a glance
  // instead of needing a manual reconciliation session to find it. Falls
  // back to back-deriving "opening" from current_balance minus net
  // movement for any account that doesn't have opening_balance set yet (older
  // accounts, or before migrations/add_bank_accounts_opening_balance.sql is
  // run) — so the three numbers always sum to the displayed balance exactly,
  // never showing a confusing mismatch of its own.
  const getBalanceBreakdown = (bank: BankAccount) => {
    const acctTxns = transactions.filter(t => t.bank_account_id === bank.id)
    const credit = acctTxns.filter(t => t.txn_type === "Cr").reduce((s, t) => s + Number(t.amount), 0)
    const debit = acctTxns.filter(t => t.txn_type === "Dr").reduce((s, t) => s + Number(t.amount), 0)
    const opening = bank.opening_balance != null
      ? Number(bank.opening_balance)
      : Number(bank.current_balance || 0) - (credit - debit)
    return { opening, credit, debit }
  }

  const toggleTxnSelected = (id: string) => {
    setSelectedTxnIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const pageAllSelected = paginatedTxns.length > 0 && paginatedTxns.every(t => selectedTxnIds.has(t.id))
  const togglePageSelected = () => {
    setSelectedTxnIds(prev => {
      const next = new Set(prev)
      if (pageAllSelected) paginatedTxns.forEach(t => next.delete(t.id))
      else paginatedTxns.forEach(t => next.add(t.id))
      return next
    })
  }
  const selectedTxns = transactions.filter(t => selectedTxnIds.has(t.id))
  const selectedCreditTotal = selectedTxns.filter(t => t.txn_type === "Cr").reduce((s, t) => s + Number(t.amount), 0)
  const selectedDebitTotal = selectedTxns.filter(t => t.txn_type === "Dr").reduce((s, t) => s + Number(t.amount), 0)

  const unmatched = transactions.filter(t => t.status === "unmatched").length
  const matched = transactions.filter(t => t.status === "matched").length
  const bankAccountsList = bankAccounts.filter(b => !isCashType(b.account_type))
  const cashAccountsList = bankAccounts.filter(b => isCashType(b.account_type))

  // Compute balances from all transactions
  const allCredits = transactions.filter(t => t.txn_type === "Cr").reduce((s, t) => s + Number(t.amount), 0)
  const allDebits = transactions.filter(t => t.txn_type === "Dr").reduce((s, t) => s + Number(t.amount), 0)
  const totalBalance = allCredits - allDebits

  // Per-account-type balances from transactions
  const bankAccountIds = new Set(bankAccountsList.map(b => b.id))
  const cashAccountIds = new Set(cashAccountsList.map(b => b.id))
  const bankBalance = transactions.filter(t => bankAccountIds.has(t.bank_account_id)).reduce((s, t) => s + (t.txn_type === "Cr" ? Number(t.amount) : -Number(t.amount)), 0)
  const cashBalance = transactions.filter(t => cashAccountIds.has(t.bank_account_id)).reduce((s, t) => s + (t.txn_type === "Cr" ? Number(t.amount) : -Number(t.amount)), 0)

  // Today's opening and closing balance
  const today = new Date().toISOString().split("T")[0]
  const todayTxns = transactions.filter(t => t.txn_date.startsWith(today))
  const todayCredits = todayTxns.filter(t => t.txn_type === "Cr").reduce((s, t) => s + Number(t.amount), 0)
  const todayDebits = todayTxns.filter(t => t.txn_type === "Dr").reduce((s, t) => s + Number(t.amount), 0)
  const closingBalance = totalBalance
  const openingBalance = totalBalance - todayCredits + todayDebits

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Landmark className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Reconciliation</h1>
        </div>
      </div>
      <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Today's Opening & Closing Balance */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4 text-blue-600" />Today&apos;s Opening Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(openingBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Balance at start of day</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
              <ArrowDownRight className="h-4 w-4 text-green-600" />Today&apos;s Closing Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(closingBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {todayTxns.length > 0
                ? `${todayTxns.length} transaction${todayTxns.length > 1 ? "s" : ""} today (${formatCurrency(todayCredits)} in, ${formatCurrency(todayDebits)} out)`
                : "No transactions today"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Match bank &amp; cash statements against journal entries</p>
          </div>
        </div>
        <Dialog open={isAddBankOpen} onOpenChange={setIsAddBankOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Account</DialogTitle><DialogDescription>Add a new bank or cash account for reconciliation</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select value={newAccountType} onValueChange={v => { setNewAccountType(v); if (isCashType(v)) { setNewAccountNo(""); setNewIfsc(""); setNewBranch("") } }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Bank - Current</SelectItem>
                    <SelectItem value="savings">Bank - Savings</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>{isCashType(newAccountType) ? "Cash Account Name *" : "Bank Name *"}</Label><Input value={newBankName} onChange={e => setNewBankName(e.target.value)} placeholder={isCashType(newAccountType) ? "e.g. Main Cash, Petty Cash" : "e.g. HDFC Bank"} /></div>
              {!isCashType(newAccountType) && (
                <>
                  <div className="space-y-2"><Label>Account Number *</Label><Input value={newAccountNo} onChange={e => setNewAccountNo(e.target.value)} placeholder="Account number" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>IFSC Code</Label><Input value={newIfsc} onChange={e => setNewIfsc(e.target.value)} placeholder="IFSC" /></div>
                    <div className="space-y-2"><Label>Branch</Label><Input value={newBranch} onChange={e => setNewBranch(e.target.value)} placeholder="Branch" /></div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newOpeningBalance}
                  onChange={e => setNewOpeningBalance(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-[11px] text-muted-foreground">
                  Starting balance carried forward from your prior books. Leave blank for zero.
                </p>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsAddBankOpen(false)}>Cancel</Button>
              <Button onClick={handleAddBank} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {submitting ? "Adding..." : "Add Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Accounts Overview */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Balance</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{formatCurrency(totalBalance)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Combined bank + cash</CardContent>
        </Card>

        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Bank</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{formatCurrency(bankBalance)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Landmark className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{bankAccountsList.length} account{bankAccountsList.length !== 1 ? "s" : ""}</CardContent>
        </Card>

        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Cash</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{formatCurrency(cashBalance)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Wallet className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{cashAccountsList.length} account{cashAccountsList.length !== 1 ? "s" : ""}</CardContent>
        </Card>

        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Unmatched</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{unmatched}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Pending reconciliation</CardContent>
        </Card>

        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Matched</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{matched}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Successfully reconciled</CardContent>
        </Card>
      </div>

      {/* Bank Accounts List */}
      {bankAccountsList.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Bank Accounts</CardTitle>
                  <CardDescription className="mt-0.5">All linked bank accounts</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
                {bankAccountsList.length} {bankAccountsList.length === 1 ? "account" : "accounts"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {bankAccountsList.map(bank => {
                const breakdown = getBalanceBreakdown(bank)
                return (
                <div key={bank.id} className="group relative overflow-hidden rounded-lg border bg-gradient-to-br from-card to-blue-50/30 dark:to-blue-950/10 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBank(bank)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteBank(bank)} title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 pr-12">
                      <div className="font-semibold truncate">{bank.bank_name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">A/C {bank.account_no}</div>
                      {bank.ifsc && <div className="text-[11px] text-muted-foreground font-mono uppercase">IFSC {bank.ifsc}</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between border-t pt-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</span>
                    <span className="text-lg font-bold tabular-nums">{formatCurrency(Number(bank.current_balance))}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground font-mono tabular-nums break-words">
                    {formatCurrency(breakdown.opening)} + {formatCurrency(breakdown.credit)} − {formatCurrency(breakdown.debit)}
                  </div>
                  {bank.last_reconciled_date && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Reconciled {new Date(bank.last_reconciled_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Accounts List */}
      {cashAccountsList.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Cash Accounts</CardTitle>
                  <CardDescription className="mt-0.5">Cash registers and tills</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
                {cashAccountsList.length} {cashAccountsList.length === 1 ? "account" : "accounts"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {cashAccountsList.map(bank => {
                const breakdown = getBalanceBreakdown(bank)
                return (
                <div key={bank.id} className="group relative overflow-hidden rounded-lg border bg-gradient-to-br from-card to-amber-50/40 dark:to-amber-950/15 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBank(bank)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteBank(bank)} title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 pr-12">
                      <div className="font-semibold truncate">{bank.bank_name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Cash account</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between border-t pt-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</span>
                    <span className="text-lg font-bold tabular-nums">{formatCurrency(Number(bank.current_balance))}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground font-mono tabular-nums break-words">
                    {formatCurrency(breakdown.opening)} + {formatCurrency(breakdown.credit)} − {formatCurrency(breakdown.debit)}
                  </div>
                  {bank.last_reconciled_date && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Reconciled {new Date(bank.last_reconciled_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>Record and match bank & cash transactions against journal entries</CardDescription>
            </div>
            <Button onClick={() => { resetTxnForm(); setIsCreateTxnOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />Create Transaction
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input placeholder="Search description, reference..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }} className="w-[250px]" />
            <Select value={selectedBankId} onValueChange={v => { setSelectedBankId(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="All Accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {bankAccountsList.length > 0 && <SelectItem value="__bank__" disabled className="text-xs font-semibold text-muted-foreground">--- Bank ---</SelectItem>}
                {bankAccountsList.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} - {b.account_no}</SelectItem>)}
                {cashAccountsList.length > 0 && <SelectItem value="__cash__" disabled className="text-xs font-semibold text-muted-foreground">--- Cash ---</SelectItem>}
                {cashAccountsList.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Dr">Debit</SelectItem>
                <SelectItem value="Cr">Credit</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="txn-date-from" className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
              <Input id="txn-date-from" type="date" value={dateFromFilter} onChange={e => { setDateFromFilter(e.target.value); setCurrentPage(1) }} className="w-[150px]" />
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="txn-date-to" className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
              <Input id="txn-date-to" type="date" value={dateToFilter} onChange={e => { setDateToFilter(e.target.value); setCurrentPage(1) }} className="w-[150px]" />
            </div>
            {(searchTerm || selectedBankId !== "all" || statusFilter !== "all" || typeFilter !== "all" || dateFromFilter || dateToFilter) && (
              <Button variant="ghost" onClick={() => { setSearchTerm(""); setSelectedBankId("all"); setStatusFilter("all"); setTypeFilter("all"); setDateFromFilter(""); setDateToFilter(""); setCurrentPage(1) }}><X className="h-4 w-4 mr-1" />Clear</Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">Total Debit: <span className="font-mono font-medium text-red-600">{formatCurrency(filteredDebitTotal)}</span></span>
            <span className="text-muted-foreground">Total Credit: <span className="font-mono font-medium text-green-600">{formatCurrency(filteredCreditTotal)}</span></span>
            <span className="text-muted-foreground">Net: <span className="font-mono font-medium">{formatCurrency(filteredCreditTotal - filteredDebitTotal)}</span></span>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No transactions found</p>
              <p className="text-sm mt-2">Create a transaction or import a statement to begin reconciliation</p>
            </div>
          ) : (
          <>
            {selectedTxnIds.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-muted/40 px-4 py-2.5 text-sm">
                <span className="font-medium">{selectedTxnIds.size} selected</span>
                <span className="text-muted-foreground">Debit total: <span className="font-mono text-red-600">{formatCurrency(selectedDebitTotal)}</span></span>
                <span className="text-muted-foreground">Credit total: <span className="font-mono text-green-600">{formatCurrency(selectedCreditTotal)}</span></span>
                <span className="text-muted-foreground">Net: <span className="font-mono">{formatCurrency(selectedCreditTotal - selectedDebitTotal)}</span></span>
                <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setSelectedTxnIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1" />Clear selection
                </Button>
              </div>
            )}
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-[36px]"><Checkbox checked={pageAllSelected} onCheckedChange={togglePageSelected} aria-label="Select all on this page" /></TableHead>
                  <SortableTableHead column="date" label="Date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="account" label="Account" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <SortableTableHead column="description" label="Description" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <TableHead>Reference</TableHead>
                  <SortableTableHead column="debit" label="Debit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <SortableTableHead column="credit" label="Credit" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="right" />
                  <SortableTableHead column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {paginatedTxns.map(txn => {
                    const bank = bankAccounts.find(b => b.id === txn.bank_account_id)
                    return (
                      <TableRow key={txn.id} data-state={selectedTxnIds.has(txn.id) ? "selected" : undefined} className={selectedTxnIds.has(txn.id) ? "bg-muted/50" : undefined}>
                        <TableCell><Checkbox checked={selectedTxnIds.has(txn.id)} onCheckedChange={() => toggleTxnSelected(txn.id)} aria-label="Select transaction" /></TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(txn.txn_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            {bank && isCashType(bank.account_type) ? <Banknote className="h-3.5 w-3.5 text-amber-600 shrink-0" /> : <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            {bank?.bank_name || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <div className="flex items-center gap-2">
                            {txn.source === "easebuzz" && <Badge variant="outline" className="text-blue-600 border-blue-300 shrink-0">Easebuzz</Badge>}
                            {txn.source === "expense" && <Badge variant="outline" className="text-red-600 border-red-300 shrink-0">Expense</Badge>}
                            {txn.source === "delivery" && <Badge variant="outline" className="text-emerald-600 border-emerald-300 shrink-0">Delivery Cash</Badge>}
                            {txn.source === "retailer_payment" && <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">Retailer Payment</Badge>}
                            <span className="truncate">{txn.description || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{txn.reference || "-"}</TableCell>
                        <TableCell className="text-right text-red-600">{txn.txn_type === "Dr" ? formatCurrency(Number(txn.amount)) : "-"}</TableCell>
                        <TableCell className="text-right text-green-600">{txn.txn_type === "Cr" ? formatCurrency(Number(txn.amount)) : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={txn.status === "matched" ? "default" : txn.status === "ignored" ? "secondary" : "outline"}>
                            {txn.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {txn.status === "unmatched" && !txn.source && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => handleMatchTransaction(txn.id)} title="Mark as matched"><CheckCircle2 className="h-4 w-4 text-green-600" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleIgnoreTransaction(txn.id)} title="Ignore"><XCircle className="h-4 w-4 text-muted-foreground" /></Button>
                              </>
                            )}
                            {/* Available to every role that can reach this page — not
                                gated by who created the row or when, only real (non-source)
                                transactions can be edited/deleted; delete is separately
                                password-protected via the confirm dialog below. */}
                            {!txn.source && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openEditTransaction(txn)} title="Edit transaction"><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(txn)} title="Remove transaction"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Showing {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, filtered.length)} of {filtered.length} transactions
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1) }}>
                    <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="250">250</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(1)} title="First page">
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} title="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-3">Page {safeCurrentPage} of {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} title="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} title="Last page">
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
          )}
        </CardContent>
      </Card>
      {/* Edit Account Dialog */}
      <Dialog open={isEditBankOpen} onOpenChange={setIsEditBankOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle><DialogDescription>Update account details</DialogDescription></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Account Type *</Label>
              <Select value={editAccountType} onValueChange={setEditAccountType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Bank - Current</SelectItem>
                  <SelectItem value="savings">Bank - Savings</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{isCashType(editAccountType) ? "Cash Account Name *" : "Bank Name *"}</Label><Input value={editBankName} onChange={e => setEditBankName(e.target.value)} placeholder={isCashType(editAccountType) ? "e.g. Main Cash, Petty Cash" : "e.g. HDFC Bank"} /></div>
            {!isCashType(editAccountType) && (
              <>
                <div className="space-y-2"><Label>Account Number *</Label><Input value={editAccountNo} onChange={e => setEditAccountNo(e.target.value)} placeholder="Account number" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>IFSC Code</Label><Input value={editIfsc} onChange={e => setEditIfsc(e.target.value)} placeholder="IFSC" /></div>
                  <div className="space-y-2"><Label>Branch</Label><Input value={editBranch} onChange={e => setEditBranch(e.target.value)} placeholder="Branch" /></div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Opening Balance</Label>
              <Input
                type="number"
                step="0.01"
                value={editOpeningBalance}
                onChange={e => setEditOpeningBalance(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">
                Starting balance carried forward from your prior books. Changing this recalculates the account&apos;s current balance as this figure plus every transaction on record — it no longer overwrites the current balance outright.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditBankOpen(false)}>Cancel</Button>
            <Button onClick={handleEditBank} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Transaction Dialog */}
      <Dialog open={isCreateTxnOpen} onOpenChange={setIsCreateTxnOpen}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Transaction</DialogTitle>
            <DialogDescription>Record a new bank or cash transaction. Link an order or select a distributor.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Left: Source Selection */}
            <div className="space-y-4">
              <Tabs value={txnMode} onValueChange={(v) => {
                setTxnMode(v); setTxnSelectedOrder(null); setTxnSelectedDistributor(""); setTxnSelectedParty(null); setTxnOrderResults([])
                setTxnVendorBills([]); setTxnSelectedVendorBill(null)
                setTxnContraFromAccount(""); setTxnContraToAccount("")
                if (v === "expense") {
                  setTxnType("Dr")
                  setTxnDescription("")
                  setTxnReference("")
                }
                if (v === "contra") {
                  setTxnDescription("")
                  setTxnReference("")
                }
              }}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="order" className="flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Find Order
                  </TabsTrigger>
                  <TabsTrigger value="distributor" className="flex items-center gap-1.5">
                    <Warehouse className="h-3.5 w-3.5" />
                    Distributor
                  </TabsTrigger>
                  <TabsTrigger value="expense" className="flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5" />
                    Expense
                  </TabsTrigger>
                  <TabsTrigger value="contra" className="flex items-center gap-1.5">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Contra
                  </TabsTrigger>
                </TabsList>

                {/* Order Search Tab */}
                <TabsContent value="order" className="space-y-4 mt-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Order, invoice, name, phone, Sd..."
                      value={txnOrderSearch}
                      onChange={e => { setTxnOrderSearch(e.target.value); searchOrders(e.target.value) }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select value={txnPaymentStatusFilter} onValueChange={v => { setTxnPaymentStatusFilter(v); searchOrders(undefined, v) }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Payment Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={txnPaymentMethodFilter} onValueChange={v => { setTxnPaymentMethodFilter(v); searchOrders(undefined, undefined, v) }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Payment Method" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Methods</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="netbanking">Netbanking</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cod">COD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Input type="date" className="h-8 text-xs" value={txnDateFrom} onChange={e => { setTxnDateFrom(e.target.value); searchOrders(undefined, undefined, undefined, e.target.value) }} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <Input type="date" className="h-8 text-xs" value={txnDateTo} onChange={e => { setTxnDateTo(e.target.value); searchOrders(undefined, undefined, undefined, undefined, e.target.value) }} />
                    </div>
                  </div>

                  {(txnPaymentStatusFilter !== "all" || txnPaymentMethodFilter !== "all" || txnDateFrom || txnDateTo) && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                      setTxnPaymentStatusFilter("all"); setTxnPaymentMethodFilter("all"); setTxnDateFrom(""); setTxnDateTo("")
                      searchOrders(txnOrderSearch, "all", "all", "", "")
                    }}><X className="h-3 w-3 mr-1" />Clear Filters</Button>
                  )}

                  {txnSelectedOrder && (
                    <div className="flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-md">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-mono font-medium">{txnSelectedOrder.order_number}</span>
                        <span className="text-muted-foreground ml-2">{formatCurrency(Number(txnSelectedOrder.total_amount))}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => setTxnSelectedOrder(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Results Table */}
                  <div className="border rounded-md max-h-[400px] overflow-y-auto">
                    {searchingOrders ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />Searching...
                      </div>
                    ) : txnOrderResults.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        {txnOrderSearch || txnPaymentStatusFilter !== "all" || txnPaymentMethodFilter !== "all" || txnDateFrom || txnDateTo
                          ? "No orders found" : "Use search or filters to find orders"}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Order</TableHead>
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Method</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {txnOrderResults.map(order => {
                            const existingTxn = getOrderTxnStatus(order.order_number, order.easebuzz_txn_id)
                            return (
                            <TableRow key={order.id} className={`cursor-pointer hover:bg-muted/50 ${existingTxn ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`} onClick={() => handleSelectOrder(order)}>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="font-mono text-xs">{order.order_number}</div>
                                  {existingTxn && (
                                    <TooltipProvider delayDuration={0}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                          <p className="text-xs font-medium">Already added as {existingTxn}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                {(order.invoice_number_gst || order.invoice_number_non_gst) && (
                                  <div className="text-[10px] text-muted-foreground">{order.invoice_number_gst || order.invoice_number_non_gst}</div>
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                {order.customer_name ? (
                                  <div>
                                    <div className="text-xs font-medium truncate max-w-[140px]">{order.customer_name}</div>
                                    <div className="text-[10px] text-muted-foreground">{order.customer_phone}{order.customer_vip ? ` | Sd: ${order.customer_vip}` : ""}</div>
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell className="text-xs py-2 whitespace-nowrap">{new Date(order.order_date).toLocaleDateString()}</TableCell>
                              <TableCell className="text-xs py-2">{order.payment_method || "-"}</TableCell>
                              <TableCell className="py-2">
                                <Badge variant={order.payment_status === "completed" ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                                  {order.payment_status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs py-2 text-right font-medium">{formatCurrency(Number(order.total_amount))}</TableCell>
                              <TableCell className="py-2">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Plus className="h-3 w-3" /></Button>
                              </TableCell>
                            </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{txnOrderResults.length > 0 ? `${txnOrderResults.length} orders found` : ""}</p>
                </TabsContent>

                {/* Distributor Tab */}
                <TabsContent value="distributor" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{txnType === "Dr" ? "Select Distributor / Vendor / Customer" : "Select Distributor / Customer"}</Label>
                    <PartyCombobox
                      // Payment Out can be settling a vendor bill (purchase
                      // payment), so vendors join the list only for Debit —
                      // Payment In has no reason to come from a vendor.
                      types={txnType === "Dr" ? ["distributor", "vendor", "customer"] : ["distributor", "customer"]}
                      value={txnSelectedDistributor}
                      onValueChange={handleSelectDistributorParty}
                      placeholder={txnType === "Dr" ? "Search distributor, vendor or customer..." : "Search distributor or customer..."}
                    />
                  </div>

                  {txnSelectedParty && (() => {
                    const linkedGodown = txnSelectedParty.type === "distributor"
                      ? godowns.find(g => g.distributor_id === txnSelectedParty.id)
                      : null
                    return (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
                            <Warehouse className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="font-semibold text-blue-900 dark:text-blue-100">{txnSelectedParty.name}</div>
                            <div className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                              <span className="capitalize">{txnSelectedParty.type}</span>
                              {txnSelectedParty.phone && <><span>·</span><span>{txnSelectedParty.phone}</span></>}
                              {linkedGodown?.city && <><span>·</span><span>{linkedGodown.city}</span></>}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => { setTxnSelectedDistributor(""); setTxnSelectedParty(null); setTxnVendorBills([]); setTxnSelectedVendorBill(null); setTxnDescription(""); setTxnReference("") }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        {linkedGodown && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            Linked warehouse: {linkedGodown.name} ({linkedGodown.godown_code})
                            {linkedGodown.manager_name && ` · Manager: ${linkedGodown.manager_name}`}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Vendor's bills — pick one to tie a Payment Out to a
                      specific purchase instead of just the vendor overall. */}
                  {txnSelectedParty?.type === "vendor" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Link to a bill (optional)
                      </Label>
                      {txnSelectedVendorBill ? (
                        <div className="flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-md">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-mono font-medium">{txnSelectedVendorBill.purchase_number}</span>
                            {txnSelectedVendorBill.invoice_number && <span className="text-muted-foreground ml-1">({txnSelectedVendorBill.invoice_number})</span>}
                            <span className="text-muted-foreground ml-2">{formatCurrency(Number(txnSelectedVendorBill.total_amount))}</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => setTxnSelectedVendorBill(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : loadingVendorBills ? (
                        <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading bills...
                        </div>
                      ) : txnVendorBills.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No purchases found for this vendor — you can still record the payment without linking a bill.</p>
                      ) : (
                        <div className="border rounded-md max-h-[220px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Bill</TableHead>
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs text-right">Amount</TableHead>
                                <TableHead className="text-xs text-right">Due</TableHead>
                                <TableHead className="text-xs w-[40px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {txnVendorBills.map(bill => (
                                <TableRow key={bill.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSelectVendorBill(bill)}>
                                  <TableCell className="py-2">
                                    <div className="font-mono text-xs">{bill.purchase_number}</div>
                                    {bill.invoice_number && <div className="text-[10px] text-muted-foreground">{bill.invoice_number}</div>}
                                  </TableCell>
                                  <TableCell className="text-xs py-2 whitespace-nowrap">{bill.purchase_date ? new Date(bill.purchase_date).toLocaleDateString() : "-"}</TableCell>
                                  <TableCell className="py-2">
                                    <Badge variant={bill.payment_status === "completed" ? "default" : "outline"} className="text-[10px] px-1.5 py-0">{bill.payment_status}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs py-2 text-right">{formatCurrency(Number(bill.total_amount))}</TableCell>
                                  <TableCell className="text-xs py-2 text-right">{Number(bill.remaining_amount) > 0 ? formatCurrency(Number(bill.remaining_amount)) : "-"}</TableCell>
                                  <TableCell className="py-2">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Plus className="h-3 w-3" /></Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    <p>Select a distributor/warehouse to create a transaction. No order linking needed — just enter the amount and details.</p>
                  </div>
                </TabsContent>

                {/* Expense Tab */}
                <TabsContent value="expense" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Expense Type *</Label>
                    <Select value={txnExpenseType} onValueChange={setTxnExpenseType}>
                      <SelectTrigger><SelectValue placeholder="Select expense type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loan">Loan Payment</SelectItem>
                        <SelectItem value="daily_expenses">Daily Expenses</SelectItem>
                        <SelectItem value="rent">Rent</SelectItem>
                        <SelectItem value="utilities">Utilities (Electricity, Water, etc.)</SelectItem>
                        <SelectItem value="salary">Salary</SelectItem>
                        <SelectItem value="wages">Wages</SelectItem>
                        <SelectItem value="transportation">Transportation</SelectItem>
                        <SelectItem value="maintenance">Maintenance &amp; Repairs</SelectItem>
                        <SelectItem value="marketing">Marketing &amp; Advertising</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Vendor (optional)</Label>
                    <PartyCombobox
                      types={["vendor"]}
                      value={txnExpenseVendor?.id || ""}
                      onValueChange={handleSelectExpenseVendor}
                      placeholder="Search vendor — e.g. purchase payment, rent..."
                    />
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                      <ArrowDownLeft className="h-4 w-4" />
                      Money Out — Auto-mirrored to Expenses
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      This will be saved as a <span className="font-semibold">Debit (Payment Out)</span> in the selected bank/cash account
                      <span className="block">AND will appear at <span className="font-mono">/dashboard/expenses</span> with the chosen expense type.</span>
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    <p>Fill the Amount, Description and Date on the right. The transaction type is locked to <span className="font-semibold">Debit</span> for expenses.</p>
                  </div>
                </TabsContent>

                {/* Contra Tab — move money between two of your own accounts:
                    cash withdrawal (Bank → Cash), cash deposit (Cash →
                    Bank), or a bank-to-bank transfer. */}
                <TabsContent value="contra" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>From Account * <span className="text-xs text-muted-foreground font-normal">(money leaving)</span></Label>
                    <Select value={txnContraFromAccount} onValueChange={setTxnContraFromAccount}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {bankAccountsList.length > 0 && <SelectItem value="__bank_h__" disabled className="text-xs font-semibold text-muted-foreground">--- Bank ---</SelectItem>}
                        {bankAccountsList.map(b => (
                          <SelectItem key={b.id} value={b.id} disabled={b.id === txnContraToAccount}>{b.bank_name} - {b.account_no}</SelectItem>
                        ))}
                        {cashAccountsList.length > 0 && <SelectItem value="__cash_h__" disabled className="text-xs font-semibold text-muted-foreground">--- Cash ---</SelectItem>}
                        {cashAccountsList.map(b => (
                          <SelectItem key={b.id} value={b.id} disabled={b.id === txnContraToAccount}>{b.bank_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-center">
                    <div className="bg-muted rounded-full p-1.5">
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>To Account * <span className="text-xs text-muted-foreground font-normal">(money arriving)</span></Label>
                    <Select value={txnContraToAccount} onValueChange={setTxnContraToAccount}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {bankAccountsList.length > 0 && <SelectItem value="__bank_h2__" disabled className="text-xs font-semibold text-muted-foreground">--- Bank ---</SelectItem>}
                        {bankAccountsList.map(b => (
                          <SelectItem key={b.id} value={b.id} disabled={b.id === txnContraFromAccount}>{b.bank_name} - {b.account_no}</SelectItem>
                        ))}
                        {cashAccountsList.length > 0 && <SelectItem value="__cash_h2__" disabled className="text-xs font-semibold text-muted-foreground">--- Cash ---</SelectItem>}
                        {cashAccountsList.map(b => (
                          <SelectItem key={b.id} value={b.id} disabled={b.id === txnContraFromAccount}>{b.bank_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded-md space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100">
                      <ArrowLeftRight className="h-4 w-4" />
                      Contra Entry
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Creates two linked entries for the same amount — a Debit in the &quot;From&quot; account and a Credit in the &quot;To&quot; account. Use this for cash withdrawals (Bank → Cash), cash deposits (Cash → Bank), or moving money between two bank accounts.
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    <p>Fill the Amount, Description and Date on the right.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right: Transaction Details */}
            <div className="space-y-4">
              <div className="font-medium text-sm">Transaction Details</div>

              {txnMode !== "contra" && (
                <div className="space-y-2">
                  <Label>Account *</Label>
                  <Select value={txnBankId} onValueChange={setTxnBankId}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {bankAccountsList.length > 0 && <SelectItem value="__bank_h__" disabled className="text-xs font-semibold text-muted-foreground">--- Bank ---</SelectItem>}
                      {bankAccountsList.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.bank_name} - {b.account_no}</SelectItem>
                      ))}
                      {cashAccountsList.length > 0 && <SelectItem value="__cash_h__" disabled className="text-xs font-semibold text-muted-foreground">--- Cash ---</SelectItem>}
                      {cashAccountsList.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className={txnMode === "contra" ? "grid grid-cols-1" : "grid grid-cols-2 gap-4"}>
                {txnMode !== "contra" && (
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select value={txnType} onValueChange={handleTxnTypeChange} disabled={txnMode === "expense"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cr">Credit (Payment In)</SelectItem>
                        <SelectItem value="Dr">Debit (Payment Out)</SelectItem>
                      </SelectContent>
                    </Select>
                    {txnMode === "expense" && (
                      <p className="text-[10px] text-muted-foreground">Locked to Debit for expenses</p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} placeholder="0.00" />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={txnDescription} onChange={e => setTxnDescription(e.target.value)} placeholder={txnMode === "contra" ? "e.g. Cash Withdrawal" : "e.g. Payment In - ORD-123"} />
              </div>

              {txnMode !== "contra" && (
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={txnReference} onChange={e => setTxnReference(e.target.value)} placeholder="Transaction ID or reference" />
                </div>
              )}

              <DialogFooter className="mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsCreateTxnOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTransaction} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {submitting ? "Creating..." : "Create Transaction"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditTxnOpen} onOpenChange={setIsEditTxnOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>Update this transaction&apos;s details. Account balances are adjusted automatically to match.</DialogDescription>
          </DialogHeader>

          {editingTxn?.reference?.startsWith("CONTRA:") && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-md text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This is one leg of a contra entry — editing it won&apos;t update its linked pair, so the two sides may no longer match. Consider deleting and recreating the pair instead if the amount needs to change.
            </div>
          )}

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Account *</Label>
              <Select value={editTxnBankId} onValueChange={setEditTxnBankId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {bankAccountsList.length > 0 && <SelectItem value="__bank_h__" disabled className="text-xs font-semibold text-muted-foreground">--- Bank ---</SelectItem>}
                  {bankAccountsList.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.bank_name} - {b.account_no}</SelectItem>
                  ))}
                  {cashAccountsList.length > 0 && <SelectItem value="__cash_h__" disabled className="text-xs font-semibold text-muted-foreground">--- Cash ---</SelectItem>}
                  {cashAccountsList.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={editTxnType} onValueChange={handleEditTxnTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cr">Credit (Payment In)</SelectItem>
                    <SelectItem value="Dr">Debit (Payment Out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={editTxnDate} onChange={e => setEditTxnDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vendor / Customer / Distributor</Label>
              <PartyCombobox
                types={editTxnType === "Dr" ? ["distributor", "vendor", "customer"] : ["distributor", "customer"]}
                value={editTxnSelectedPartyId}
                onValueChange={handleEditSelectParty}
                placeholder={editTxnType === "Dr" ? "Search distributor, vendor or customer..." : "Search distributor or customer..."}
              />
              <p className="text-[11px] text-muted-foreground">
                Picking someone here corrects both the description and the underlying link — the right fix if the wrong party was selected originally, instead of hand-editing the text below.
              </p>
              {editTxnSelectedParty && (
                <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-2 rounded-md">
                  <span className="font-medium text-blue-900 dark:text-blue-100">{editTxnSelectedParty.name}</span>
                  <span className="text-xs text-blue-700 dark:text-blue-300 capitalize">({editTxnSelectedParty.type})</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => { setEditTxnSelectedPartyId(""); setEditTxnSelectedParty(null); setEditTxnVendorBills([]); setEditTxnSelectedVendorBill(null) }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {editTxnSelectedParty?.type === "vendor" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Link to a bill (optional)</Label>
                  {editTxnSelectedVendorBill ? (
                    <div className="flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-2 rounded-md">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono font-medium">{editTxnSelectedVendorBill.purchase_number}</span>
                        {editTxnSelectedVendorBill.invoice_number && <span className="text-muted-foreground ml-1">({editTxnSelectedVendorBill.invoice_number})</span>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => setEditTxnSelectedVendorBill(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : loadingEditVendorBills ? (
                    <div className="flex items-center justify-center py-3 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading bills...
                    </div>
                  ) : editTxnVendorBills.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No purchases found for this vendor.</p>
                  ) : (
                    <div className="border rounded-md max-h-[160px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Bill</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs text-right">Due</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editTxnVendorBills.map(bill => (
                            <TableRow key={bill.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEditSelectVendorBill(bill)}>
                              <TableCell className="py-1.5">
                                <div className="font-mono text-xs">{bill.purchase_number}</div>
                                {bill.invoice_number && <div className="text-[10px] text-muted-foreground">{bill.invoice_number}</div>}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-right">{formatCurrency(Number(bill.total_amount))}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">{Number(bill.remaining_amount) > 0 ? formatCurrency(Number(bill.remaining_amount)) : "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" value={editTxnAmount} onChange={e => setEditTxnAmount(e.target.value)} placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editTxnDescription} onChange={e => setEditTxnDescription(e.target.value)} placeholder="e.g. Payment In - ORD-123" />
            </div>

            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={editTxnReference} onChange={e => setEditTxnReference(e.target.value)} placeholder="Transaction ID or reference" />
              <p className="text-[11px] text-muted-foreground">Set automatically when you pick a party above — only hand-edit this if you know what you&apos;re doing.</p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditTxnOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleUpdateTransaction} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation — password gated */}
      <Dialog open={!!deleteConfirmTxn} onOpenChange={(open) => { if (!open) { setDeleteConfirmTxn(null); setDeletePassword(""); setDeletePasswordError("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />Remove Transaction
            </DialogTitle>
            <DialogDescription>
              {deleteConfirmTxn?.reference?.startsWith("CONTRA:")
                ? "This is a contra entry — its linked pair (the other side of the transfer) will also be removed. This can't be undone."
                : "This can't be undone. Enter your password to confirm."}
            </DialogDescription>
          </DialogHeader>

          {deleteConfirmTxn && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-0.5">
              <div className="font-medium truncate">{deleteConfirmTxn.description || "—"}</div>
              <div className="text-muted-foreground">
                {new Date(deleteConfirmTxn.txn_date).toLocaleDateString()} · {deleteConfirmTxn.txn_type === "Cr" ? "Credit" : "Debit"} · {formatCurrency(Number(deleteConfirmTxn.amount))}
              </div>
            </div>
          )}

          <div className="space-y-2 mt-2">
            <Label>Your password *</Label>
            <Input
              type="password"
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeletePasswordError("") }}
              onKeyDown={e => { if (e.key === "Enter" && !deletePasswordSubmitting) confirmDeleteWithPassword() }}
              placeholder="Enter your login password"
              autoFocus
            />
            {deletePasswordError && <p className="text-sm text-destructive">{deletePasswordError}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setDeleteConfirmTxn(null); setDeletePassword(""); setDeletePasswordError("") }} disabled={deletePasswordSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteWithPassword} disabled={deletePasswordSubmitting || !deletePassword}>
              {deletePasswordSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {deletePasswordSubmitting ? "Verifying..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
