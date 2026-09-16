"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, BookOpenCheck, BookOpen, X, Loader2, ArrowDownLeft, ArrowUpRight, Wallet, FileText } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type Account = { id: string; code: string; name: string; type: string }

type LedgerEntry = {
  id: string
  entry_date: string
  entry_number: string | null
  narration: string | null
  line_narration: string | null
  debit: number
  credit: number
  running_balance: number
  reference_type: string | null
}

export default function AccountLedgerPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><h1 className="text-3xl font-bold">Account Ledger</h1><p>Loading...</p></div>}>
      <AccountLedgerContent />
    </Suspense>
  )
}

function AccountLedgerContent() {
  const searchParams = useSearchParams()
  const preselectedAccount = searchParams.get("account") || ""

  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>(preselectedAccount)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  useEffect(() => {
    fetchAccounts()
  }, [])

  useEffect(() => {
    if (selectedAccountId) {
      const acc = accounts.find(a => a.id === selectedAccountId)
      setSelectedAccount(acc || null)
      fetchLedger()
    }
  }, [selectedAccountId, dateFrom, dateTo, accounts])

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from("chart_of_accounts")
      .select("id, code, name, type")
      .eq("is_active", true)
      .order("code", { ascending: true })
    setAccounts(data || [])
  }

  const fetchLedger = async () => {
    if (!selectedAccountId) return
    setLoading(true)
    try {
      const { data: lines, error } = await supabase
        .from("journal_lines")
        .select(`
          id, debit, credit, narration,
          journal:journal_entries!journal_lines_journal_id_fkey(
            entry_date, entry_number, narration, reference_type, status
          )
        `)
        .eq("account_id", selectedAccountId)

      if (error) throw error

      // Filter by date and posted status
      const filtered = (lines || [])
        .filter((l: any) => {
          if (l.journal?.status !== "Posted") return false
          const d = l.journal.entry_date
          if (dateFrom && d < format(dateFrom, "yyyy-MM-dd")) return false
          if (dateTo && d > format(dateTo, "yyyy-MM-dd")) return false
          return true
        })
        .sort((a: any, b: any) => a.journal.entry_date.localeCompare(b.journal.entry_date))

      // Calculate running balance
      // For Asset/Expense accounts: Debit increases, Credit decreases (balance = Dr - Cr)
      // For Liability/Equity/Revenue accounts: Credit increases, Debit decreases (balance = Cr - Dr)
      const isDebitNormal = selectedAccount?.type === "Asset" || selectedAccount?.type === "Expense"
      let balance = 0
      const ledger: LedgerEntry[] = filtered.map((l: any) => {
        const debit = Number(l.debit || 0)
        const credit = Number(l.credit || 0)
        if (isDebitNormal) {
          balance += debit - credit
        } else {
          balance += credit - debit
        }
        return {
          id: l.id,
          entry_date: l.journal.entry_date,
          entry_number: l.journal.entry_number,
          narration: l.journal.narration,
          line_narration: l.narration,
          debit,
          credit,
          running_balance: balance,
          reference_type: l.journal.reference_type,
        }
      })

      setEntries(ledger)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load ledger")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0)
  const closingBalance = entries.length > 0 ? entries[entries.length - 1].running_balance : 0

  // For debit-normal accounts (Asset/Expense): positive balance = Dr
  // For credit-normal accounts (Liability/Equity/Revenue): positive balance = Cr
  const isDebitNormal = selectedAccount?.type === "Asset" || selectedAccount?.type === "Expense"
  const balanceLabel = (bal: number) => {
    if (bal >= 0) return isDebitNormal ? "Dr" : "Cr"
    return isDebitNormal ? "Cr" : "Dr"
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Account Ledger</h1>
            <p className="text-sm text-muted-foreground">View transaction history for individual accounts</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Select Account</CardTitle>
              <CardDescription className="mt-0.5">Choose an account and date range to view its ledger</CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-full sm:w-[350px]"><SelectValue placeholder="Choose an account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.code} - {a.name} ({a.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full sm:w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dateFrom ? format(dateFrom, "PPP") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full sm:w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />{dateTo ? format(dateTo, "PPP") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus /></PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" onClick={() => { setDateFrom(undefined); setDateTo(undefined) }}>
                <X className="h-4 w-4 mr-1" />Clear Dates
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedAccount && (
        <>
          {/* Summary */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="h-full">
              <CardHeader>
                <CardDescription>Account</CardDescription>
                <CardTitle className="text-base font-bold">{selectedAccount.code} - {selectedAccount.name}</CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">{selectedAccount.type}</CardContent>
            </Card>
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
              <CardContent className="text-xs text-muted-foreground">Sum of debits</CardContent>
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
              <CardContent className="text-xs text-muted-foreground">Sum of credits</CardContent>
            </Card>
            <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
              <CardHeader>
                <CardDescription>Closing Balance</CardDescription>
                <CardTitle className={`text-2xl font-bold tabular-nums ${closingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>{formatCurrency(Math.abs(closingBalance))} {balanceLabel(closingBalance)}</CardTitle>
                <CardAction>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                    <Wallet className="h-4 w-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Net balance</CardContent>
            </Card>
          </div>

          {/* Ledger Table */}
          <div className="w-full min-w-0 max-w-full">
          <Card className="w-full max-w-full overflow-hidden">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Transaction History</CardTitle>
                    <CardDescription className="mt-0.5">{entries.length} transactions found</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full self-start sm:self-auto">{entries.length} txns</Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent>
              {loading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No posted transactions for this account</div>
              ) : (
                <div className="rounded-md border">
                  <div className="grid grid-cols-7 gap-2 py-2 px-4 bg-muted font-medium text-sm border-b">
                    <div>Date</div>
                    <div>Entry #</div>
                    <div className="col-span-2">Narration</div>
                    <div className="text-right">Debit</div>
                    <div className="text-right">Credit</div>
                    <div className="text-right">Balance</div>
                  </div>
                  {entries.map(entry => (
                    <div key={entry.id} className="grid grid-cols-7 gap-2 py-2 px-4 border-b hover:bg-muted/30 text-sm">
                      <div>{new Date(entry.entry_date).toLocaleDateString()}</div>
                      <div className="font-mono">{entry.entry_number || "-"}</div>
                      <div className="col-span-2 truncate">{entry.line_narration || entry.narration || "-"}</div>
                      <div className="text-right font-medium">{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</div>
                      <div className="text-right font-medium">{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</div>
                      <div className={`text-right font-medium ${entry.running_balance >= 0 ? '' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(entry.running_balance))} {balanceLabel(entry.running_balance)}
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-7 gap-2 py-3 px-4 bg-muted font-bold text-sm">
                    <div className="col-span-4 text-right">Total</div>
                    <div className="text-right">{formatCurrency(totalDebit)}</div>
                    <div className="text-right">{formatCurrency(totalCredit)}</div>
                    <div className="text-right">{formatCurrency(Math.abs(closingBalance))} {balanceLabel(closingBalance)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </>
      )}
    </div>
  )
}
