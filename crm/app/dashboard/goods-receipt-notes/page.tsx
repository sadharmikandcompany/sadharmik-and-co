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
import { Plus, PackageCheck, X, Eye, Search, ClipboardCheck, ListChecks, Clock, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

type GRN = {
  id: string
  grn_number: string | null
  purchase_id: string | null
  vendor_name: string | null
  received_date: string
  status: string
  discrepancy_notes: string | null
  remarks: string | null
  created_at: string
}

type GRNItem = {
  id: string
  product_id: string | null
  expected_qty: number
  received_qty: number
  accepted_qty: number
  rejected_qty: number
  rate: number
  remarks: string | null
  product?: { name: string } | null
}

export default function GoodsReceiptNotesPage() {
  const [grns, setGrns] = useState<GRN[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null)
  const [grnItems, setGrnItems] = useState<GRNItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  useEffect(() => { fetchGRNs() }, [])

  const fetchGRNs = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("goods_receipt_notes").select("*").order("created_at", { ascending: false })
    if (error) { toast.error("Failed to fetch GRNs"); setLoading(false); return }
    setGrns(data || [])
    setLoading(false)
  }

  const viewDetail = async (grn: GRN) => {
    setSelectedGRN(grn)
    setIsDetailOpen(true)
    setItemsLoading(true)
    const { data } = await supabase
      .from("grn_items")
      .select(`*, product:products!grn_items_product_id_fkey(name)`)
      .eq("grn_id", grn.id)
    setGrnItems(data || [])
    setItemsLoading(false)
  }

  const handleApprove = async (grn: GRN) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("goods_receipt_notes")
      .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", grn.id)
    if (error) { toast.error("Failed to approve"); return }
    toast.success("GRN approved")
    fetchGRNs()
    setIsDetailOpen(false)
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)

  const filtered = grns.filter(g => {
    const matchesSearch = searchTerm === "" ||
      (g.grn_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.vendor_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || g.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="rounded-full capitalize">Pending</Badge>
      case "qc_hold": return <Badge className="rounded-full capitalize bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">QC Hold</Badge>
      case "approved": return <Badge className="rounded-full capitalize bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Approved</Badge>
      case "rejected": return <Badge variant="destructive" className="rounded-full capitalize">Rejected</Badge>
      default: return <Badge variant="secondary" className="rounded-full capitalize">{status}</Badge>
    }
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Goods Receipt Notes</h1>
        </div>
      </div>
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Goods Receipt Notes</h1>
            <p className="text-sm text-muted-foreground">Record physical receipt of goods against purchase orders</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Link href="/dashboard/goods-receipt-notes/new">
            <Button><Plus className="mr-2 h-4 w-4" />New GRN</Button>
          </Link>
        </div>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>GRN: {selectedGRN?.grn_number}</DialogTitle>
            <DialogDescription>Vendor: {selectedGRN?.vendor_name} | Date: {selectedGRN?.received_date && new Date(selectedGRN.received_date).toLocaleDateString()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {selectedGRN && getStatusBadge(selectedGRN.status)}
              {selectedGRN?.discrepancy_notes && <span className="text-sm text-red-600">Discrepancy: {selectedGRN.discrepancy_notes}</span>}
            </div>
            {itemsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Product</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Accepted</TableHead><TableHead className="text-right">Rejected</TableHead><TableHead className="text-right">Rate</TableHead><TableHead>Remarks</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {grnItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product?.name || "Unknown"}</TableCell>
                        <TableCell className="text-right">{Number(item.expected_qty)}</TableCell>
                        <TableCell className="text-right">{Number(item.received_qty)}</TableCell>
                        <TableCell className="text-right text-green-600">{Number(item.accepted_qty)}</TableCell>
                        <TableCell className="text-right text-red-600">{Number(item.rejected_qty)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.rate))}</TableCell>
                        <TableCell className="text-sm">{item.remarks || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            {selectedGRN?.status === "pending" && <Button onClick={() => handleApprove(selectedGRN)} className="bg-green-600 hover:bg-green-700">Approve GRN</Button>}
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total GRNs</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{grns.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All goods receipt notes</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{grns.filter(g => g.status === "pending").length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Clock className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Awaiting review</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{grns.filter(g => g.status === "approved").length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Approved receipts</CardContent>
        </Card>
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{grns.filter(g => g.status === "rejected").length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <XCircle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Rejected receipts</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">GRN Records</CardTitle>
                <CardDescription className="mt-0.5">View and manage goods receipt notes</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">{filtered.length} {filtered.length === 1 ? "GRN" : "GRNs"}</Badge>
              {(searchTerm || statusFilter !== "all") && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search GRN #, vendor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[220px] pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="qc_hold">QC Hold</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {(searchTerm || statusFilter !== "all") && <Button variant="ghost" onClick={() => { setSearchTerm(""); setStatusFilter("all") }} className="gap-2"><X className="h-4 w-4" />Clear Filters</Button>}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">GRN #</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Vendor</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Received Date</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Discrepancy</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">No GRNs found</TableCell></TableRow>
                ) : filtered.map(grn => (
                  <TableRow key={grn.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">{grn.grn_number || "-"}</TableCell>
                    <TableCell>{grn.vendor_name || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(grn.received_date).toLocaleDateString()}</TableCell>
                    <TableCell>{getStatusBadge(grn.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{grn.discrepancy_notes || "-"}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => viewDetail(grn)}><Eye className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filtered.length} of {grns.length} GRNs
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
