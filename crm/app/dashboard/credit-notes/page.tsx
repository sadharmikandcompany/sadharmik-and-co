"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { format } from "date-fns"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileText,
  FileMinus2,
  RefreshCw,
  X,
  ListChecks,
  Clock,
  CheckCircle2,
  IndianRupee,
  Percent,
} from "lucide-react"

type CreditNote = {
  id: string
  note_number: string
  party_name: string
  party_phone: string
  party_type: string
  return_no: string
  invoice_number: string | null
  invoice_date: string | null
  note_date: string
  state_of_supply: string | null
  subtotal: number
  discount_amount: number
  total_amount: number
  status: string
  created_at: string
}

export default function CreditNotesPage() {
  const router = useRouter()
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")

  useEffect(() => {
    fetchCreditNotes()
  }, [])

  const fetchCreditNotes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setCreditNotes(data || [])
    } catch (error) {
      console.error("Error fetching credit notes:", error)
      toast.error("Failed to fetch credit notes")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credit note?")) return

    try {
      const { error: itemsError } = await supabase
        .from("credit_note_items")
        .delete()
        .eq("credit_note_id", id)

      if (itemsError) throw itemsError

      const { error } = await supabase
        .from("credit_notes")
        .delete()
        .eq("id", id)

      if (error) throw error

      setCreditNotes(creditNotes.filter((note) => note.id !== id))
      toast.success("Credit note deleted successfully")
    } catch (error) {
      console.error("Error deleting credit note:", error)
      toast.error("Failed to delete credit note")
    }
  }

  // Nothing else in the app ever changed a note off its insert-time default
  // ("draft") — this is the one place that can move it to Approved, mirroring
  // Purchases' "Mark as Received" quick action.
  const handleMarkApproved = async (note: CreditNote) => {
    try {
      const { error } = await supabase
        .from("credit_notes")
        .update({ status: "approved" })
        .eq("id", note.id)

      if (error) throw error

      setCreditNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, status: "approved" } : n))
      )
      toast.success("Credit note marked as approved")
    } catch (error) {
      console.error("Error approving credit note:", error)
      toast.error("Failed to update status")
    }
  }

  const filteredNotes = creditNotes.filter((note) => {
    const matchesSearch =
      searchQuery === "" ||
      note.note_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.invoice_number?.toLowerCase() || "").includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || note.status === statusFilter

    const noteDate = new Date(note.note_date || note.created_at)
    const matchesDateFrom = !dateFrom || noteDate >= dateFrom
    const matchesDateTo = !dateTo || noteDate <= dateTo

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
  })

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
  }

  const hasActiveFilters =
    searchQuery !== "" || statusFilter !== "all" || dateFrom !== undefined || dateTo !== undefined

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="rounded-full capitalize bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Approved</Badge>
      case "cancelled":
        return <Badge variant="destructive" className="rounded-full capitalize">Cancelled</Badge>
      default:
        return <Badge variant="secondary" className="rounded-full capitalize">Draft</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileMinus2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Credit Notes</h1>
            <p className="text-sm text-muted-foreground">
              Manage credit notes issued to customers and vendors
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Link href="/dashboard/credit-notes/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Credit Note
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Credit Notes</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{filteredNotes.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{hasActiveFilters ? "Across current filters" : "All credit notes"}</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Draft</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">
              {filteredNotes.filter((n) => n.status !== "approved" && n.status !== "cancelled").length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Clock className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Awaiting approval</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
              {filteredNotes.filter((n) => n.status === "approved").length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Confirmed notes</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Total Taxable Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">
              {formatCurrency(
                filteredNotes.reduce((sum, n) => sum + (Number(n.subtotal || 0) - Number(n.discount_amount || 0)), 0)
              )}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <Percent className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Before GST · across current filters</CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
              {formatCurrency(filteredNotes.reduce((sum, n) => sum + Number(n.total_amount || 0), 0))}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across current filters</CardContent>
        </Card>
      </div>

      {/* Credit Notes Table */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50">
                <FileMinus2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Credit Note Records</CardTitle>
                <CardDescription className="mt-0.5">Search and manage credit notes</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
              </Badge>
              {hasActiveFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  Filters active
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by note number, party name, invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-[220px] pl-8"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />
                Clear All Filters
              </Button>
            )}

            <Button variant="outline" onClick={fetchCreditNotes}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
          <Table className="min-w-[1150px] w-full">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Note #</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Party</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Invoice #</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">State</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Taxable Value</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Amount</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-12 w-12" />
                      <p>No credit notes found</p>
                      <Link href="/dashboard/credit-notes/new">
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Create your first credit note
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredNotes.map((note) => (
                  <TableRow key={note.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {note.note_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{note.party_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {note.party_phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{note.invoice_number || "-"}</TableCell>
                    <TableCell>
                      {format(new Date(note.note_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{note.state_of_supply || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      ₹{(note.subtotal - note.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ₹{note.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{getStatusBadge(note.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {note.status !== "approved" && note.status !== "cancelled" && (
                            <DropdownMenuItem onClick={() => handleMarkApproved(note)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Mark as Approved
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/credit-notes/${note.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View / Print
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/credit-notes/${note.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleDelete(note.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          {filteredNotes.length > 0 && (
            <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Showing {filteredNotes.length} of {creditNotes.length} credit notes
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
