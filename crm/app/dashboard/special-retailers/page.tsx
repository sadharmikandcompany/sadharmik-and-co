"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  CalendarIcon,
  IndianRupee,
  Loader2,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Star,
  CalendarDays,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type Retailer = {
  id: string
  name: string
  company_name: string | null
  retailer_code: string | null
  is_special: boolean
  opening_balance: number
}

type RetailerPayment = {
  id: string
  retailer_id: string
  payment_date: string
  amount: number
  payment_method: string
  reference: string | null
  notes: string | null
  created_at: string
}

type OrderRow = {
  total_amount: number
  order_date: string
}

type MonthData = {
  key: string
  label: string
  sales: number
  received: number
  outstanding: number
}

const PAYMENT_METHODS = ["Cash", "Cheque", "RTGS", "G Pay", "UPI", "Bank Transfer", "Other"]

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0)

const getMonthKey = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const getMonthLabel = (key: string) => {
  const [y, m] = key.split("-")
  const date = new Date(parseInt(y), parseInt(m) - 1, 1)
  return format(date, "MMM yyyy")
}

export default function SpecialRetailerTrackerPage() {
  const { role } = useUserRole()
  const { entityId: retailerEntityId } = useEntityData()
  const isRetailer = role === "retailer"

  const [retailers, setRetailers] = useState<Retailer[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loadingRetailers, setLoadingRetailers] = useState(true)

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [payments, setPayments] = useState<RetailerPayment[]>([])
  const [loadingData, setLoadingData] = useState(false)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Add payment dialog
  const [addOpen, setAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    payment_date: new Date() as Date | undefined,
    amount: "",
    payment_method: "",
    reference: "",
    notes: "",
  })

  // Delete dialog
  const [toDelete, setToDelete] = useState<RetailerPayment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const selectedRetailer = useMemo(
    () => retailers.find((r) => r.id === selectedId) || null,
    [retailers, selectedId]
  )

  useEffect(() => {
    init()
  }, [retailerEntityId])

  useEffect(() => {
    if (selectedId) {
      fetchRetailerData(selectedId)
    } else {
      setOrders([])
      setPayments([])
    }
  }, [selectedId])

  const init = async () => {
    const [{ data: userData }, retailerRes] = await Promise.all([
      supabase.auth.getUser(),
      isRetailer && retailerEntityId
        ? supabase
            .from("retailers")
            .select("id, name, company_name, retailer_code, is_special, opening_balance")
            .eq("id", retailerEntityId)
        : supabase
            .from("retailers")
            .select("id, name, company_name, retailer_code, is_special, opening_balance")
            .eq("is_special", true)
            .order("name"),
    ])

    if (userData?.user) setCurrentUserId(userData.user.id)

    if (retailerRes.error) {
      console.error(retailerRes.error)
      toast.error("Failed to load retailers")
      setLoadingRetailers(false)
      return
    }

    const list = (retailerRes.data || []) as Retailer[]
    setRetailers(list)
    setLoadingRetailers(false)

    // Retailer role: auto-select own retailer
    if (isRetailer && retailerEntityId) {
      setSelectedId(retailerEntityId)
      return
    }

    // Admin: default selection — Falguni if present, else first
    const falguni = list.find((r) => r.name.toLowerCase().includes("falgun"))
    if (falguni) setSelectedId(falguni.id)
    else if (list.length > 0) setSelectedId(list[0].id)
  }

  const fetchRetailerData = async (retailerId: string) => {
    setLoadingData(true)
    const [salesRes, paymentsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("total_amount, order_date")
        .eq("retailer_id", retailerId),
      supabase
        .from("retailer_payments")
        .select("*")
        .eq("retailer_id", retailerId)
        .order("payment_date", { ascending: false }),
    ])

    if (salesRes.error) {
      console.error(salesRes.error)
      toast.error("Failed to load sales totals")
    } else {
      setOrders((salesRes.data || []) as OrderRow[])
    }

    if (paymentsRes.error) {
      console.error(paymentsRes.error)
      toast.error("Failed to load payments")
    } else {
      setPayments((paymentsRes.data || []) as RetailerPayment[])
    }
    setLoadingData(false)
  }

  const totalSales = useMemo(
    () => orders.reduce((s, o) => s + (parseFloat(String(o.total_amount)) || 0), 0),
    [orders]
  )
  const totalReceived = useMemo(
    () => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments]
  )
  const opening = selectedRetailer?.opening_balance || 0
  const outstanding = opening + totalSales - totalReceived

  // Month-wise breakdown
  const monthlyData = useMemo(() => {
    const monthMap: Record<string, { sales: number; received: number }> = {}

    // Add opening balance as a special entry if > 0
    for (const o of orders) {
      if (!o.order_date) continue
      const key = getMonthKey(o.order_date)
      if (!monthMap[key]) monthMap[key] = { sales: 0, received: 0 }
      monthMap[key].sales += parseFloat(String(o.total_amount)) || 0
    }

    for (const p of payments) {
      if (!p.payment_date) continue
      const key = getMonthKey(p.payment_date)
      if (!monthMap[key]) monthMap[key] = { sales: 0, received: 0 }
      monthMap[key].received += Number(p.amount) || 0
    }

    const sortedKeys = Object.keys(monthMap).sort()
    let runningOutstanding = opening

    const result: MonthData[] = sortedKeys.map((key) => {
      const { sales, received } = monthMap[key]
      runningOutstanding += sales - received
      return {
        key,
        label: getMonthLabel(key),
        sales,
        received,
        outstanding: runningOutstanding,
      }
    })

    return result
  }, [orders, payments, opening])

  const handleAddPayment = async () => {
    if (!selectedId) return toast.error("Select a retailer first")
    if (!form.payment_date) return toast.error("Select a payment date")
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error("Enter a valid amount")
    if (!form.payment_method) return toast.error("Select a payment method")

    setSubmitting(true)

    const { error: paymentError } = await supabase.from("retailer_payments").insert([
      {
        retailer_id: selectedId,
        payment_date: form.payment_date.toISOString(),
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        reference: form.reference || null,
        notes: form.notes || null,
        added_by: currentUserId,
      },
    ])

    if (paymentError) {
      console.error(paymentError)
      toast.error("Failed to record payment")
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    toast.success(`Payment of ${inr(parseFloat(form.amount))} recorded`)
    setAddOpen(false)
    setForm({
      payment_date: new Date(),
      amount: "",
      payment_method: "",
      reference: "",
      notes: "",
    })
    await fetchRetailerData(selectedId)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    const { error } = await supabase
      .from("retailer_payments")
      .delete()
      .eq("id", toDelete.id)
    setDeleting(false)
    if (error) {
      console.error(error)
      toast.error("Failed to delete payment")
      return
    }
    toast.success("Payment removed")
    setToDelete(null)
    if (selectedId) await fetchRetailerData(selectedId)
  }

  if (loadingRetailers) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {isRetailer ? "My Payments" : "Special Retailer Payments"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRetailer
                ? "View your outstanding balance and send payments to the company."
                : "Track outstanding balance and record payments from special retailers (internal sales agents who pay back full sale amount)."}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Amount to collect</span>
          <span
            className={cn(
              "text-3xl font-bold flex items-center gap-1",
              outstanding > 0
                ? "text-orange-600 dark:text-orange-400"
                : "text-green-600 dark:text-green-400"
            )}
          >
            <IndianRupee className="h-6 w-6" />
            {Math.round(Math.abs(outstanding)).toLocaleString("en-IN")}
            {outstanding < 0 && <span className="text-xs ml-1">(advance)</span>}
          </span>
        </div>
      </div>

      {/* Retailer selector + add */}
      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-3 md:items-end">
          {isRetailer ? (
            <div className="flex-1">
              {selectedRetailer && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                  <span className="font-medium text-lg">{selectedRetailer.name}</span>
                  {selectedRetailer.company_name && (
                    <span className="text-muted-foreground">({selectedRetailer.company_name})</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 flex-1 max-w-md">
              <Label>Special retailer</Label>
              {retailers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No retailers marked as special yet. Set <code className="font-mono">retailers.is_special = true</code> for the ones you want to track here.
                </p>
              ) : (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a retailer" />
                  </SelectTrigger>
                  <SelectContent>
                    {retailers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <span className="flex items-center gap-2">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                          {r.name}
                          {r.company_name && <span className="text-muted-foreground">({r.company_name})</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {selectedRetailer && (
            <Button onClick={() => {
              if (isRetailer && outstanding > 0) {
                setForm(f => ({ ...f, amount: String(Math.round(outstanding)) }))
              }
              setAddOpen(true)
            }} disabled={!selectedId}>
              {isRetailer ? (
                <><Send className="h-4 w-4 mr-2" /> Send Payment</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Record Payment</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {selectedRetailer ? (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Opening Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">{inr(opening)}</div>
                <p className="text-xs text-muted-foreground mt-1">carry-forward</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">{inr(totalSales)}</div>
                <p className="text-xs text-muted-foreground mt-1">all orders against this retailer</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Amount Received</CardTitle>
                <TrendingDown className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">{inr(totalReceived)}</div>
                <p className="text-xs text-muted-foreground mt-1">{payments.length} payment{payments.length !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                outstanding > 0
                  ? "border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/30"
                  : "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30"
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
                <IndianRupee
                  className={cn(
                    "h-4 w-4",
                    outstanding > 0 ? "text-orange-600" : "text-green-600"
                  )}
                />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div
                  className={cn(
                    "text-2xl font-bold",
                    outstanding > 0
                      ? "text-orange-700 dark:text-orange-400"
                      : "text-green-700 dark:text-green-400"
                  )}
                >
                  {inr(Math.abs(outstanding))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Opening + Sales - Received{outstanding < 0 ? " (advance held)" : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Month-wise breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Month-wise Breakdown</CardTitle>
                  <CardDescription className="text-sm">
                    Sales, payments received, and running outstanding for each month.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : monthlyData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead className="text-right">Running Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opening > 0 && (
                        <TableRow className="bg-muted/30">
                          <TableCell className="font-medium text-muted-foreground">Opening Balance</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-bold text-orange-700 dark:text-orange-400">
                            {inr(opening)}
                          </TableCell>
                        </TableRow>
                      )}
                      {monthlyData.map((m) => {
                        const diff = m.sales - m.received
                        return (
                          <TableRow key={m.key}>
                            <TableCell className="font-medium">{m.label}</TableCell>
                            <TableCell className="text-right text-blue-700 dark:text-blue-400">
                              {m.sales > 0 ? inr(m.sales) : "-"}
                            </TableCell>
                            <TableCell className="text-right text-green-700 dark:text-green-400">
                              {m.received > 0 ? inr(m.received) : "-"}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-medium",
                              diff > 0 ? "text-orange-600 dark:text-orange-400" : diff < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                            )}>
                              {diff === 0 ? "-" : diff > 0 ? `+${inr(diff)}` : `-${inr(Math.abs(diff))}`}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-bold",
                              m.outstanding > 0 ? "text-orange-700 dark:text-orange-400" : m.outstanding < 0 ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
                            )}>
                              {inr(Math.abs(m.outstanding))}
                              {m.outstanding < 0 && <span className="text-xs ml-1">(adv)</span>}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {/* Total row */}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right text-blue-700 dark:text-blue-400">{inr(totalSales)}</TableCell>
                        <TableCell className="text-right text-green-700 dark:text-green-400">{inr(totalReceived)}</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className={cn(
                          "text-right",
                          outstanding > 0 ? "text-orange-700 dark:text-orange-400" : "text-green-700 dark:text-green-400"
                        )}>
                          {inr(Math.abs(outstanding))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Transactions</CardTitle>
              <CardDescription className="text-sm">
                Payments received from {selectedRetailer.name.trim()} — newest first. These also appear in Reconciliation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Notes</TableHead>
                        {!isRetailer && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isRetailer ? 5 : 6} className="text-center py-8 text-muted-foreground">
                            No payments recorded yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                            <TableCell className="text-right font-medium text-green-700 dark:text-green-400">
                              {inr(Number(p.amount))}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{p.payment_method}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{p.reference || "—"}</TableCell>
                            <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                              {p.notes || "—"}
                            </TableCell>
                            {!isRetailer && (
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setToDelete(p)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Explanation — admin only */}
          {!isRetailer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How this is calculated</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p><strong>Special retailer</strong>: an internal sales agent (often an employee). They take stock from us, sell at retail, and pay the full sale amount back to us.</p>
                <p><strong>Total Sales</strong>: sum of <code className="font-mono">orders.total_amount</code> where <code className="font-mono">retailer_id</code> = this retailer.</p>
                <p><strong>Amount Received</strong>: sum of <code className="font-mono">retailer_payments.amount</code> for this retailer.</p>
                <p><strong>Outstanding</strong>: <code className="font-mono">opening_balance + Total Sales - Amount Received</code>. Negative means they&apos;ve paid in advance.</p>
                <p><strong>Reconciliation</strong>: When a payment is recorded here, it also creates a bank transaction entry so it appears in the Accounting &gt; Reconciliation page.</p>
                <p className="pt-2 text-xs">To add another special retailer, set <code className="font-mono">retailers.is_special = true</code> for them. To set a starting balance, populate <code className="font-mono">retailers.opening_balance</code>.</p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Add Payment Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isRetailer ? "Send Payment" : "Record Payment"}</DialogTitle>
            <DialogDescription>
              {isRetailer
                ? `Send payment to the company`
                : `From ${selectedRetailer?.name?.trim()}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.payment_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.payment_date ? format(form.payment_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.payment_date}
                    onSelect={(d) => setForm({ ...form, payment_date: d })}
                  />
                </PopoverContent>
              </Popover>
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
              <Label>Payment Method</Label>
              <Select
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference (optional)</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="cheque no, txn id, etc."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleAddPayment} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && (
                <>
                  This will remove the {toDelete.payment_method} payment of {inr(Number(toDelete.amount))} dated{" "}
                  {format(new Date(toDelete.payment_date), "dd MMM yyyy")}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
