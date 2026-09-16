"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, CalendarIcon, Loader2, Save, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"

type Account = {
  id: string
  code: string
  name: string
  type: string
}

type JournalLine = {
  id: string
  account_id: string
  debit: string
  credit: string
  narration: string
}

export default function NewJournalEntryPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [entryDate, setEntryDate] = useState<Date>(new Date())
  const [narration, setNarration] = useState("")
  const [referenceType, setReferenceType] = useState("")
  const [lines, setLines] = useState<JournalLine[]>([
    { id: "1", account_id: "", debit: "", credit: "", narration: "" },
    { id: "2", account_id: "", debit: "", credit: "", narration: "" },
  ])

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("id, code, name, type")
      .eq("is_active", true)
      .order("code", { ascending: true })
    if (error) {
      toast.error("Failed to load accounts")
      setLoading(false)
      return
    }
    setAccounts(data || [])
    setLoading(false)
  }

  const addLine = () => {
    setLines(prev => [...prev, {
      id: Date.now().toString(),
      account_id: "",
      debit: "",
      credit: "",
      narration: "",
    }])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      toast.error("Minimum 2 lines required")
      return
    }
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const updateLine = (id: string, field: keyof JournalLine, value: string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      // If entering debit, clear credit and vice versa
      if (field === "debit" && value) updated.credit = ""
      if (field === "credit" && value) updated.debit = ""
      return updated
    }))
  }

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
  }

  const handleSubmit = async (postImmediately: boolean = false) => {
    // Validate
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
    if (validLines.length < 2) {
      toast.error("At least 2 valid lines required")
      return
    }
    if (!isBalanced) {
      toast.error("Debits must equal Credits")
      return
    }

    setSubmitting(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // Generate entry number
      const entryNumber = `JE-${format(entryDate, "yyyyMMdd")}-${Date.now().toString().slice(-6)}`

      // Create journal entry
      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert([{
          entry_number: entryNumber,
          entry_date: format(entryDate, "yyyy-MM-dd"),
          narration: narration || null,
          reference_type: referenceType || null,
          status: postImmediately ? "Posted" : "Draft",
          total_debit: totalDebit,
          total_credit: totalCredit,
          created_by: user?.id || null,
          posted_by: postImmediately ? user?.id : null,
          posted_at: postImmediately ? new Date().toISOString() : null,
        }])
        .select()
        .single()

      if (entryError) throw entryError

      // Create journal lines
      const lineData = validLines.map(l => ({
        journal_id: entry.id,
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        narration: l.narration || null,
      }))

      const { error: linesError } = await supabase
        .from("journal_lines")
        .insert(lineData)

      if (linesError) throw linesError

      toast.success(`Journal entry ${postImmediately ? 'posted' : 'saved as draft'} successfully`)
      router.push("/dashboard/accounting/journal-entries")
    } catch (error: any) {
      console.error("Error creating journal entry:", error)
      toast.error(error.message || "Failed to create journal entry")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">New Journal Entry</h1>
        <p>Loading accounts...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/accounting/journal-entries">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Journal Entry</h1>
          <p className="text-muted-foreground">Create a double-entry journal voucher</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entry Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Entry Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(entryDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={entryDate} onSelect={d => d && setEntryDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Reference Type</Label>
              <Select value={referenceType} onValueChange={setReferenceType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="opening">Opening Balance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Narration</Label>
              <Textarea placeholder="Description of this journal entry" value={narration} onChange={e => setNarration(e.target.value)} rows={1} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Debit & Credit Lines</CardTitle>
              <CardDescription>Add accounts with debit or credit amounts</CardDescription>
            </div>
            <Button variant="outline" onClick={addLine}><Plus className="mr-2 h-4 w-4" />Add Line</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground px-1">
              <div className="col-span-4">Account</div>
              <div className="col-span-3">Narration</div>
              <div className="col-span-2 text-right">Debit (₹)</div>
              <div className="col-span-2 text-right">Credit (₹)</div>
              <div className="col-span-1" />
            </div>

            {lines.map(line => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Select value={line.account_id} onValueChange={v => updateLine(line.id, "account_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input placeholder="Line narration" value={line.narration} onChange={e => updateLine(line.id, "narration", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={line.debit} onChange={e => updateLine(line.id, "debit", e.target.value)} className="text-right" />
                </div>
                <div className="col-span-2">
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={line.credit} onChange={e => updateLine(line.id, "credit", e.target.value)} className="text-right" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeLine(line.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="grid grid-cols-12 gap-2 items-center border-t pt-3 mt-3">
              <div className="col-span-7 text-right font-bold">Total:</div>
              <div className="col-span-2 text-right font-bold">{formatCurrency(totalDebit)}</div>
              <div className="col-span-2 text-right font-bold">{formatCurrency(totalCredit)}</div>
              <div className="col-span-1" />
            </div>

            {/* Balance indicator */}
            <div className="flex justify-end">
              {isBalanced ? (
                <span className="text-sm text-green-600 font-medium">Balanced</span>
              ) : (
                <span className="text-sm text-red-600 font-medium">
                  Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Link href="/dashboard/accounting/journal-entries">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button variant="outline" onClick={() => handleSubmit(false)} disabled={submitting || !isBalanced}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save as Draft
        </Button>
        <Button onClick={() => handleSubmit(true)} disabled={submitting || !isBalanced} className="bg-green-600 hover:bg-green-700">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Post Entry
        </Button>
      </div>
    </div>
  )
}
