"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Scale, Download, Loader2, ArrowDownLeft, ArrowUpRight, CheckCircle2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"

type TrialBalanceRow = {
  account_id: string
  code: string
  name: string
  type: string
  total_debit: number
  total_credit: number
  balance: number
}

export default function TrialBalancePage() {
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [asOfDate, setAsOfDate] = useState<Date>(new Date())

  useEffect(() => {
    fetchTrialBalance()
  }, [asOfDate])

  const fetchTrialBalance = async () => {
    setLoading(true)
    try {
      // Get all posted journal lines up to the asOfDate
      const { data: lines, error: linesError } = await supabase
        .from("journal_lines")
        .select(`
          account_id, debit, credit,
          journal:journal_entries!journal_lines_journal_id_fkey(entry_date, status)
        `)

      if (linesError) throw linesError

      // Get all accounts
      const { data: accounts, error: accError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, type")
        .eq("is_active", true)
        .order("code", { ascending: true })

      if (accError) throw accError

      // Filter posted entries up to date and aggregate
      const dateStr = format(asOfDate, "yyyy-MM-dd")
      const accountMap = new Map<string, { debit: number; credit: number }>()

      ;(lines || []).forEach((line: any) => {
        if (line.journal?.status === "Posted" && line.journal?.entry_date <= dateStr) {
          const existing = accountMap.get(line.account_id) || { debit: 0, credit: 0 }
          existing.debit += Number(line.debit || 0)
          existing.credit += Number(line.credit || 0)
          accountMap.set(line.account_id, existing)
        }
      })

      // Build rows for all accounts that have transactions
      const result: TrialBalanceRow[] = (accounts || [])
        .filter(a => accountMap.has(a.id))
        .map(a => {
          const { debit, credit } = accountMap.get(a.id)!
          // For Asset/Expense: balance = Dr - Cr (debit normal)
          // For Liability/Equity/Revenue: balance = Cr - Dr (credit normal)
          const isDebitNormal = a.type === "Asset" || a.type === "Expense"
          return {
            account_id: a.id,
            code: a.code,
            name: a.name,
            type: a.type,
            total_debit: debit,
            total_credit: credit,
            balance: isDebitNormal ? debit - credit : credit - debit,
          }
        })

      setRows(result)
    } catch (error) {
      console.error("Error fetching trial balance:", error)
      toast.error("Failed to load trial balance")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
  }

  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const groupedByType = ["Asset", "Liability", "Equity", "Revenue", "Expense"].map(type => ({
    type,
    accounts: rows.filter(r => r.type === type),
    totalDebit: rows.filter(r => r.type === type).reduce((s, r) => s + r.total_debit, 0),
    totalCredit: rows.filter(r => r.type === type).reduce((s, r) => s + r.total_credit, 0),
  })).filter(g => g.accounts.length > 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Scale className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Trial Balance</h1>
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
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Trial Balance</h1>
            <p className="text-sm text-muted-foreground">As of {format(asOfDate, "PPP")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />As of: {format(asOfDate, "dd MMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={asOfDate} onSelect={d => d && setAsOfDate(d)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Balance Status */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Total Debit</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{formatCurrency(totalDebit)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All Dr balances</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Total Credit</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{formatCurrency(totalCredit)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All Cr balances</CardContent>
        </Card>
        <Card className={`h-full ${isBalanced ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40' : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40'}`}>
          <CardHeader>
            <CardDescription>Status</CardDescription>
            <CardTitle className={`text-2xl font-bold tabular-nums ${isBalanced ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {isBalanced ? "Balanced" : `Diff: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
            </CardTitle>
            <CardAction>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isBalanced ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500'}`}>
                {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{isBalanced ? "Debits = Credits" : "Imbalance detected"}</CardContent>
        </Card>
      </div>

      {/* Trial Balance Table */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Trial Balance Statement</CardTitle>
                <CardDescription className="mt-0.5">Debit and Credit balances for all accounts with posted journal entries</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full self-start sm:self-auto">{rows.length} accounts</Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No posted journal entries found</p>
              <p className="text-sm mt-2">Create and post journal entries to see the trial balance</p>
              <Link href="/dashboard/accounting/journal-entries/new">
                <Button className="mt-4">Create Journal Entry</Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border">
              {/* Header */}
              <div className="grid grid-cols-4 gap-4 py-3 px-4 bg-muted font-medium text-sm border-b">
                <div className="col-span-2">Account</div>
                <div className="text-right">Debit (₹)</div>
                <div className="text-right">Credit (₹)</div>
              </div>

              {groupedByType.map(group => (
                <div key={group.type}>
                  <div className="py-2 px-4 bg-muted/40 font-semibold text-sm border-b">{group.type}</div>
                  {group.accounts.map(row => (
                    <Link key={row.account_id} href={`/dashboard/accounting/ledger?account=${row.account_id}`}>
                      <div className="grid grid-cols-4 gap-4 py-2 px-4 border-b hover:bg-muted/30 cursor-pointer">
                        <div className="col-span-2">
                          <span className="font-mono text-sm mr-2">{row.code}</span>
                          <span>{row.name}</span>
                        </div>
                        <div className="text-right font-medium">
                          {row.total_debit > 0 ? formatCurrency(row.total_debit) : "-"}
                        </div>
                        <div className="text-right font-medium">
                          {row.total_credit > 0 ? formatCurrency(row.total_credit) : "-"}
                        </div>
                      </div>
                    </Link>
                  ))}
                  <div className="grid grid-cols-4 gap-4 py-2 px-4 border-b bg-muted/20 font-semibold text-sm">
                    <div className="col-span-2 text-right">Sub-total ({group.type})</div>
                    <div className="text-right">{formatCurrency(group.totalDebit)}</div>
                    <div className="text-right">{formatCurrency(group.totalCredit)}</div>
                  </div>
                </div>
              ))}

              {/* Grand Total */}
              <div className="grid grid-cols-4 gap-4 py-3 px-4 bg-muted font-bold text-sm">
                <div className="col-span-2 text-right">Grand Total</div>
                <div className="text-right">{formatCurrency(totalDebit)}</div>
                <div className="text-right">{formatCurrency(totalCredit)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
