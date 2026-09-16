"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
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
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Plus, FileText, X, Loader2, Eye, Search, ListChecks, Edit3, CheckCircle2, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"

type JournalEntry = {
  id: string
  entry_number: string | null
  entry_date: string
  narration: string | null
  reference_type: string | null
  reference_id: string | null
  status: string
  total_debit: number
  total_credit: number
  created_by: string | null
  posted_by: string | null
  posted_at: string | null
  created_at: string
  creator?: { full_name: string | null }
  poster?: { full_name: string | null }
}

type JournalLine = {
  id: string
  account_id: string
  debit: number
  credit: number
  narration: string | null
  account?: { code: string; name: string; type: string }
}

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")

  // View detail
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [entryLines, setEntryLines] = useState<JournalLine[]>([])
  const [linesLoading, setLinesLoading] = useState(false)

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("journal_entries")
      .select(`*, creator:users!journal_entries_created_by_fkey(full_name), poster:users!journal_entries_posted_by_fkey(full_name)`)
      .order("entry_date", { ascending: false })
      .limit(500)

    if (error) {
      console.error("Error fetching journal entries:", error)
      // Try without joins if relationship not set up
      const { data: fallback, error: fallbackError } = await supabase
        .from("journal_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .limit(500)
      if (fallbackError) {
        toast.error("Failed to fetch journal entries")
        setLoading(false)
        return
      }
      setEntries(fallback || [])
      setLoading(false)
      return
    }
    setEntries(data || [])
    setLoading(false)
  }

  const viewEntryDetail = async (entry: JournalEntry) => {
    setSelectedEntry(entry)
    setIsDetailOpen(true)
    setLinesLoading(true)

    const { data, error } = await supabase
      .from("journal_lines")
      .select(`*, account:chart_of_accounts!journal_lines_account_id_fkey(code, name, type)`)
      .eq("journal_id", entry.id)
      .order("created_at", { ascending: true })

    if (error) {
      const { data: fallback } = await supabase
        .from("journal_lines")
        .select("*")
        .eq("journal_id", entry.id)
      setEntryLines(fallback || [])
    } else {
      setEntryLines(data || [])
    }
    setLinesLoading(false)
  }

  const handlePostEntry = async (entry: JournalEntry) => {
    if (entry.total_debit !== entry.total_credit) {
      toast.error("Cannot post: Debits and Credits are not balanced")
      return
    }
    const { error } = await supabase
      .from("journal_entries")
      .update({ status: "Posted", posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", entry.id)
    if (error) {
      toast.error("Failed to post entry")
      return
    }
    toast.success("Journal entry posted")
    fetchEntries()
    if (isDetailOpen) setIsDetailOpen(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
  }

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = searchTerm === "" ||
      (entry.entry_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.narration || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter
    const entryDate = new Date(entry.entry_date)
    const matchesDateFrom = !dateFrom || entryDate >= dateFrom
    const matchesDateTo = !dateTo || entryDate <= dateTo
    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
  })

  const totalDebit = filteredEntries.reduce((s, e) => s + Number(e.total_debit || 0), 0)
  const totalCredit = filteredEntries.reduce((s, e) => s + Number(e.total_credit || 0), 0)
  const draftCount = entries.filter(e => e.status === "Draft").length
  const postedCount = entries.filter(e => e.status === "Posted").length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft": return <Badge variant="secondary">Draft</Badge>
      case "Posted": return <Badge className="bg-green-600 text-white">Posted</Badge>
      case "Reversed": return <Badge variant="destructive">Reversed</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const clearFilters = () => {
    setSearchTerm(""); setStatusFilter("all"); setDateFrom(undefined); setDateTo(undefined); setDatePreset("all")
  }

  const hasFilters = searchTerm || statusFilter !== "all" || dateFrom || dateTo

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <FileText className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Journal Entries</h1>
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
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Journal Entries</h1>
            <p className="text-sm text-muted-foreground">Double-entry bookkeeping journal</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <Link href="/dashboard/accounting/journal-entries/new">
          <Button><Plus className="mr-2 h-4 w-4" />New Journal Entry</Button>
        </Link>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Journal Entry: {selectedEntry?.entry_number || "N/A"}</DialogTitle>
            <DialogDescription>
              {selectedEntry?.entry_date && format(new Date(selectedEntry.entry_date), "PPP")} - {selectedEntry?.narration || "No narration"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {selectedEntry && getStatusBadge(selectedEntry.status)}
              <span className="text-sm text-muted-foreground">
                Created by: {selectedEntry?.creator?.full_name || "Unknown"}
              </span>
            </div>
            {linesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Narration</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entryLines.map(line => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <div className="font-medium">{line.account?.name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{line.account?.code || ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">{line.narration || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2} className="text-right">Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(entryLines.reduce((s, l) => s + Number(l.debit || 0), 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entryLines.reduce((s, l) => s + Number(l.credit || 0), 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            {selectedEntry?.status === "Draft" && (
              <Button onClick={() => handlePostEntry(selectedEntry)} className="bg-green-600 hover:bg-green-700">
                Post Entry
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Entries</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{entries.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All journal entries</CardContent>
        </Card>
        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Draft</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">{draftCount}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <Edit3 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Pending review</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Posted</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{postedCount}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Posted to ledger</CardContent>
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
          <CardContent className="text-xs text-muted-foreground">Across filtered entries</CardContent>
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
          <CardContent className="text-xs text-muted-foreground">Across filtered entries</CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">All Journal Entries</CardTitle>
                <CardDescription className="mt-0.5">View and manage accounting journal entries</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">{filteredEntries.length} entries</Badge>
              {hasFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search entries..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[220px] pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Posted">Posted</SelectItem>
                <SelectItem value="Reversed">Reversed</SelectItem>
              </SelectContent>
            </Select>
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
            {hasFilters && <Button variant="ghost" onClick={clearFilters} className="gap-2"><X className="h-4 w-4" />Clear Filters</Button>}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Entry #</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Narration</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Reference</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Debit</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Credit</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">No journal entries found</TableCell></TableRow>
                ) : filteredEntries.map(entry => (
                  <TableRow key={entry.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">{entry.entry_number || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.narration || "-"}</TableCell>
                    <TableCell className="text-sm">{entry.reference_type || "-"}</TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(entry.total_debit || 0))}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(entry.total_credit || 0))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => viewEntryDetail(entry)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredEntries.length} of {entries.length} entries
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
