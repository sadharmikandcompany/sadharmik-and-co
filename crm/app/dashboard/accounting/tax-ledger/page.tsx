"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Receipt, CalendarIcon, X, Loader2, Search, IndianRupee } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type TaxEntry = {
  id: string
  txn_date: string
  txn_type: string
  party_name: string | null
  gstin: string | null
  hsn: string | null
  taxable_value: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  cess_amount: number
  total_tax: number
  invoice_number: string | null
  is_b2b: boolean
  state_code: string | null
  created_at: string
}

export default function TaxLedgerPage() {
  const [entries, setEntries] = useState<TaxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("tax_ledger")
      .select("*")
      .order("txn_date", { ascending: false })
      .limit(1000)

    if (error) {
      console.error("Error:", error)
      toast.error("Failed to fetch tax ledger")
      setLoading(false)
      return
    }
    setEntries(data || [])
    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
  }

  const filtered = entries.filter(e => {
    const matchesSearch = searchTerm === "" ||
      (e.party_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.gstin || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.invoice_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.hsn || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "all" || e.txn_type === typeFilter
    const d = new Date(e.txn_date)
    const matchesFrom = !dateFrom || d >= dateFrom
    const matchesTo = !dateTo || d <= dateTo
    return matchesSearch && matchesType && matchesFrom && matchesTo
  })

  const totalTaxable = filtered.reduce((s, e) => s + Number(e.taxable_value || 0), 0)
  const totalCGST = filtered.reduce((s, e) => s + Number(e.cgst_amount || 0), 0)
  const totalSGST = filtered.reduce((s, e) => s + Number(e.sgst_amount || 0), 0)
  const totalIGST = filtered.reduce((s, e) => s + Number(e.igst_amount || 0), 0)
  const totalTax = filtered.reduce((s, e) => s + Number(e.total_tax || 0), 0)

  const clearFilters = () => { setSearchTerm(""); setTypeFilter("all"); setDateFrom(undefined); setDateTo(undefined) }
  const hasFilters = searchTerm || typeFilter !== "all" || dateFrom || dateTo

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Receipt className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Tax Ledger (GST)</h1>
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
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Tax Ledger (GST)</h1>
            <p className="text-sm text-muted-foreground">GST transaction register for GSTR filing</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Taxable Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{formatCurrency(totalTaxable)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><IndianRupee className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Sum of taxable amounts</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>CGST</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{formatCurrency(totalCGST)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500"><Receipt className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Central GST</CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>SGST</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{formatCurrency(totalSGST)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500"><Receipt className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">State GST</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>IGST</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{formatCurrency(totalIGST)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500"><Receipt className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Integrated GST</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Total Tax</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{formatCurrency(totalTax)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500"><Receipt className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">CGST + SGST + IGST</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Tax Transactions</CardTitle>
                <CardDescription className="mt-0.5">All GST transactions with HSN-wise breakdown</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">{filtered.length} entries</Badge>
              {hasFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search party, GSTIN, invoice, HSN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[260px] pl-8" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="credit_note">Credit Note</SelectItem>
                <SelectItem value="debit_note">Debit Note</SelectItem>
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
            {hasFilters && <Button variant="ghost" onClick={clearFilters} className="gap-2"><X className="h-4 w-4" />Clear Filters</Button>}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1100px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Invoice</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Party</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">GSTIN</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">HSN</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Taxable</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">CGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">SGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">IGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8">No tax entries found</TableCell></TableRow>
                ) : filtered.map(entry => (
                  <TableRow key={entry.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap">{new Date(entry.txn_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={entry.txn_type === "sale" ? "default" : entry.txn_type === "purchase" ? "secondary" : "outline"} className="rounded-full capitalize">
                        {entry.txn_type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{entry.invoice_number || "-"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{entry.party_name || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.gstin || "-"}</TableCell>
                    <TableCell>{entry.hsn || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(entry.taxable_value))}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{Number(entry.cgst_amount) > 0 ? formatCurrency(Number(entry.cgst_amount)) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-600">{Number(entry.sgst_amount) > 0 ? formatCurrency(Number(entry.sgst_amount)) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-violet-600">{Number(entry.igst_amount) > 0 ? formatCurrency(Number(entry.igst_amount)) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(entry.total_tax))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">Showing {filtered.length} of {entries.length} entries</div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
