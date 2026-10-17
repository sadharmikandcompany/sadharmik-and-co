"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  insertBankTransaction,
  adjustAccountBalance,
  allocateToOrders,
  orderOwed,
  type PayableOrder,
} from "@/lib/accounting/order-payments"

const formatCurrency = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type RecordPaymentParty = {
  id: string
  type: "customer" | "distributor" | "retailer"
  name: string
}

type BillRow = PayableOrder & { order_number: string; invoice_label: string; order_date: string }

export function RecordPaymentDialog({
  open,
  onOpenChange,
  party,
  defaultType,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  party: RecordPaymentParty
  defaultType: "Cr" | "Dr"
  onSaved: () => void
}) {
  const [type, setType] = useState<"Cr" | "Dr">(defaultType)
  const [bankAccounts, setBankAccounts] = useState<{ id: string; bank_name: string; account_type: string }[]>([])
  const [bankId, setBankId] = useState("")
  const [bills, setBills] = useState<BillRow[]>([])
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([])
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [description, setDescription] = useState("")
  const [reference, setReference] = useState("")
  const [loadingBills, setLoadingBills] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setType(defaultType)
    setSelectedBillIds([])
    setAmount("")
    setDate(new Date().toISOString().split("T")[0])
    setDescription(`${defaultType === "Cr" ? "Payment In" : "Payment Out"} - ${party.name}`)
    setReference("")
    fetchBankAccounts()
    fetchBills()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, party.id])

  const fetchBankAccounts = async () => {
    const { data } = await supabase.from("bank_accounts").select("id, bank_name, account_type").order("bank_name")
    setBankAccounts(data || [])
    setBankId((prev) => prev || (data && data.length > 0 ? data[0].id : ""))
  }

  // Only bills that still owe something — a credit note already covering
  // the whole thing, or a bill already fully paid, has nothing left to
  // collect against.
  const fetchBills = async () => {
    setLoadingBills(true)
    try {
      const column = party.type === "distributor" ? "distributor_id" : party.type === "retailer" ? "retailer_id" : "customer_id"
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, invoice_number_gst, invoice_number_non_gst, order_date, total_amount, paid_amount, payment_status, order_status")
        .eq(column, party.id)
        .in("payment_status", ["pending", "partial"])
        .neq("order_status", "cancelled")
        .order("order_date", { ascending: true })

      const orderIds = (orders || []).map((o) => o.id)
      const linkedByOrder: Record<string, number> = {}
      if (orderIds.length > 0) {
        const { data: notes, error } = await supabase
          .from("credit_notes")
          .select("linked_order_id, total_amount")
          .in("linked_order_id", orderIds)
        if (!error) {
          (notes || []).forEach((n: any) => {
            if (!n.linked_order_id) return
            linkedByOrder[n.linked_order_id] = (linkedByOrder[n.linked_order_id] || 0) + (Number(n.total_amount) || 0)
          })
        }
      }

      const rows: BillRow[] = (orders || [])
        .map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          invoice_label: o.invoice_number_gst || o.invoice_number_non_gst || o.order_number,
          order_date: o.order_date,
          total_amount: Number(o.total_amount) || 0,
          paid_amount: Number(o.paid_amount) || 0,
          linked_credit_notes: linkedByOrder[o.id] || 0,
        }))
        .filter((r: BillRow) => orderOwed(r) > 0)

      setBills(rows)
    } finally {
      setLoadingBills(false)
    }
  }

  const applyDescriptionFor = (next: BillRow[], currentType: "Cr" | "Dr") => {
    const typeLabel = currentType === "Cr" ? "Payment In" : "Payment Out"
    if (next.length === 0) {
      setDescription(`${typeLabel} - ${party.name}`)
      setReference("")
    } else if (next.length === 1) {
      setDescription(`${typeLabel} - ${next[0].order_number}`)
      setReference(next[0].order_number)
    } else {
      setDescription(`${typeLabel} - ${next.length} bills (${next.map((b) => b.invoice_label).join(", ")})`)
      setReference(next.map((b) => b.order_number).join(","))
    }
  }

  const toggleBill = (bill: BillRow) => {
    setSelectedBillIds((prev) => {
      const next = prev.includes(bill.id) ? prev.filter((id) => id !== bill.id) : [...prev, bill.id]
      const selectedBills = bills.filter((b) => next.includes(b.id))
      const total = selectedBills.reduce((sum, b) => sum + orderOwed(b), 0)
      setAmount(total > 0 ? String(total) : "")
      applyDescriptionFor(selectedBills, type)
      return next
    })
  }

  const handleTypeChange = (v: string) => {
    const next = v as "Cr" | "Dr"
    setType(next)
    applyDescriptionFor(bills.filter((b) => selectedBillIds.includes(b.id)), next)
  }

  const handleSubmit = async () => {
    if (!bankId) {
      toast.error("Please select an account")
      return
    }
    const amountNum = parseFloat(amount)
    if (!amount || amountNum <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: insertedTxn, error } = await insertBankTransaction(supabase, {
        bank_account_id: bankId,
        txn_date: date,
        value_date: date,
        amount: amountNum,
        txn_type: type,
        description: description || null,
        reference: reference || null,
        status: "matched",
        created_by: user?.id || null,
      })
      if (error) throw error

      await adjustAccountBalance(supabase, bankId, type === "Cr" ? amountNum : -amountNum)

      const selectedBills = bills.filter((b) => selectedBillIds.includes(b.id))
      if (insertedTxn?.id && selectedBills.length > 0) {
        await allocateToOrders(supabase, insertedTxn.id, selectedBills, amountNum, type)
      }

      toast.success(`${type === "Cr" ? "Payment In" : "Payment Out"} recorded`)
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{type === "Cr" ? "Record Payment In" : "Record Payment Out"}</DialogTitle>
          <DialogDescription>
            {type === "Cr" ? `Record money received from ${party.name}` : `Record money paid to ${party.name}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cr">Payment In</SelectItem>
                  <SelectItem value="Dr">Payment Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account *</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bank_name}{b.account_type === "cash" ? " (Cash)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Open Bills
              {selectedBillIds.length > 0 && ` — ${selectedBillIds.length} selected`}
            </Label>
            <div className="border rounded-md max-h-[220px] overflow-y-auto">
              {loadingBills ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading bills...
                </div>
              ) : bills.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">No open bills for this party</div>
              ) : (
                <div className="divide-y">
                  {bills.map((bill) => {
                    const isSelected = selectedBillIds.includes(bill.id)
                    return (
                      <div
                        key={bill.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-emerald-50/70 dark:bg-emerald-950/30" : ""}`}
                        onClick={() => toggleBill(bill)}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleBill(bill)} onClick={(e) => e.stopPropagation()} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono font-medium">{bill.invoice_label}</div>
                          <div className="text-[10px] text-muted-foreground">{new Date(bill.order_date).toLocaleDateString()}</div>
                        </div>
                        <div className="text-xs font-medium">{formatCurrency(orderOwed(bill))} owed</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? "Saving..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
