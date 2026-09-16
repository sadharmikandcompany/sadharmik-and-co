"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Eye, Warehouse, Building2, Store, MapPin, Trash2, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Godown = {
  id: string
  name: string
  godown_code: string
  godown_type: "company" | "distributor" | "retailer"
  distributor_id: string | null
  retailer_id: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  manager_name: string | null
  manager_phone: string | null
  total_capacity_sqft: number | null
  storage_type: string | null
  serviceable_pincodes: string | null
  is_active: boolean
  is_primary: boolean
  created_at: string
}

type RelatedRecords = {
  godown_stock: number
  delivery_partner_stock: number
  orders: number
  reorder_rules: number
  stock_batches: number
  stock_dispatches: number
  stock_ledger: number
  stock_transfers: number
}

export default function GodownsPage() {
  const [godowns, setGodowns] = useState<Godown[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [deleteGodown, setDeleteGodown] = useState<Godown | null>(null)
  const [relatedRecords, setRelatedRecords] = useState<RelatedRecords | null>(null)
  const [loadingRelated, setLoadingRelated] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchGodowns()
  }, [])

  const fetchGodowns = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("godowns")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching godowns:", error)
      toast.error("Failed to fetch warehouses")
    } else {
      setGodowns(data || [])
    }
    setLoading(false)
  }

  const fetchRelatedRecords = async (godownId: string) => {
    setLoadingRelated(true)
    try {
      const [
        godownStock,
        deliveryPartnerStock,
        ordersSource,
        ordersDest,
        reorderRules,
        stockBatches,
        stockDispatches,
        stockLedger,
        stockTransfersFrom,
        stockTransfersTo,
      ] = await Promise.all([
        supabase.from("godown_stock").select("*", { count: "exact", head: true }).eq("godown_id", godownId),
        supabase.from("delivery_partner_stock").select("*", { count: "exact", head: true }).eq("source_godown_id", godownId),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("source_godown_id", godownId),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("destination_godown_id", godownId),
        supabase.from("reorder_rules").select("*", { count: "exact", head: true }).eq("warehouse_id", godownId),
        supabase.from("stock_batches").select("*", { count: "exact", head: true }).eq("warehouse_id", godownId),
        supabase.from("stock_dispatches").select("*", { count: "exact", head: true }).eq("to_godown_id", godownId),
        supabase.from("stock_ledger").select("*", { count: "exact", head: true }).eq("warehouse_id", godownId),
        supabase.from("stock_transfers").select("*", { count: "exact", head: true }).eq("from_godown_id", godownId),
        supabase.from("stock_transfers").select("*", { count: "exact", head: true }).eq("to_godown_id", godownId),
      ])

      setRelatedRecords({
        godown_stock: godownStock.count || 0,
        delivery_partner_stock: deliveryPartnerStock.count || 0,
        orders: (ordersSource.count || 0) + (ordersDest.count || 0),
        reorder_rules: reorderRules.count || 0,
        stock_batches: stockBatches.count || 0,
        stock_dispatches: stockDispatches.count || 0,
        stock_ledger: stockLedger.count || 0,
        stock_transfers: (stockTransfersFrom.count || 0) + (stockTransfersTo.count || 0),
      })
    } catch {
      toast.error("Failed to fetch related records")
    } finally {
      setLoadingRelated(false)
    }
  }

  const handleDeleteClick = (godown: Godown) => {
    setDeleteGodown(godown)
    setRelatedRecords(null)
    fetchRelatedRecords(godown.id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteGodown) return
    setDeleting(true)

    try {
      const id = deleteGodown.id

      // Delete direct child records
      await Promise.all([
        supabase.from("godown_stock").delete().eq("godown_id", id),
        supabase.from("delivery_partner_stock").delete().eq("source_godown_id", id),
        supabase.from("reorder_rules").delete().eq("warehouse_id", id),
        supabase.from("stock_batches").delete().eq("warehouse_id", id),
        supabase.from("stock_ledger").delete().eq("warehouse_id", id),
      ])

      // Nullify references in orders, dispatches, and transfers
      await Promise.all([
        supabase.from("orders").update({ source_godown_id: null }).eq("source_godown_id", id),
        supabase.from("orders").update({ destination_godown_id: null }).eq("destination_godown_id", id),
        supabase.from("stock_dispatches").update({ to_godown_id: null }).eq("to_godown_id", id),
        supabase.from("stock_transfers").update({ from_godown_id: null }).eq("from_godown_id", id),
        supabase.from("stock_transfers").update({ to_godown_id: null }).eq("to_godown_id", id),
      ])

      // Finally delete the godown
      const { error } = await supabase.from("godowns").delete().eq("id", id)
      if (error) throw error

      toast.success(`Warehouse "${deleteGodown.name}" deleted successfully`)
      setDeleteGodown(null)
      fetchGodowns()
    } catch (error) {
      console.error("Error deleting godown:", error)
      toast.error("Failed to delete warehouse")
    } finally {
      setDeleting(false)
    }
  }

  const totalRelatedRecords = relatedRecords
    ? Object.values(relatedRecords).reduce((a, b) => a + b, 0)
    : 0

  const relatedRecordLabels: Record<keyof RelatedRecords, { label: string; action: string }> = {
    godown_stock: { label: "Godown Stock", action: "Deleted" },
    delivery_partner_stock: { label: "Delivery Partner Stock", action: "Deleted" },
    orders: { label: "Orders", action: "Unlinked" },
    reorder_rules: { label: "Reorder Rules", action: "Deleted" },
    stock_batches: { label: "Stock Batches", action: "Deleted" },
    stock_dispatches: { label: "Stock Dispatches", action: "Unlinked" },
    stock_ledger: { label: "Stock Ledger Entries", action: "Deleted" },
    stock_transfers: { label: "Stock Transfers", action: "Unlinked" },
  }

  const filteredGodowns = godowns.filter((godown) => {
    const matchesSearch =
      godown.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      godown.godown_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (godown.city && godown.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (godown.state && godown.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (godown.pincode && godown.pincode.includes(searchTerm))

    const matchesType = typeFilter === "all" || godown.godown_type === typeFilter

    return matchesSearch && matchesType
  })

  // Separate by type
  const companyGodowns = filteredGodowns.filter(g => g.godown_type === "company")
  const distributorGodowns = filteredGodowns.filter(g => g.godown_type === "distributor")
  const retailerGodowns = filteredGodowns.filter(g => g.godown_type === "retailer")

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "company":
        return <Warehouse className="h-4 w-4" />
      case "distributor":
        return <Building2 className="h-4 w-4" />
      case "retailer":
        return <Store className="h-4 w-4" />
      default:
        return <Warehouse className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "company":
        return "text-blue-600"
      case "distributor":
        return "text-green-600"
      case "retailer":
        return "text-orange-600"
      default:
        return "text-gray-600"
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Warehouse className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Warehouses</h1>
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
            <Warehouse className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Warehouses (Godowns)</h1>
            <p className="text-sm text-muted-foreground">Manage warehouse locations and inventory</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Link href="/dashboard/godowns/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Warehouses</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{godowns.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <Warehouse className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All warehouse locations</CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Company Owned</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{companyGodowns.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Warehouse className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Internal warehouses</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Distributor</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{distributorGodowns.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <Building2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Distributor sites</CardContent>
        </Card>
        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Retailer</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">{retailerGodowns.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <Store className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Retailer sites</CardContent>
        </Card>
      </div>

      {/* Warehouses Table */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <Warehouse className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">All Warehouses</CardTitle>
                <CardDescription className="mt-0.5">Warehouse locations and inventory metadata</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredGodowns.length} {filteredGodowns.length === 1 ? "warehouse" : "warehouses"}
              </Badge>
              {(searchTerm || typeFilter !== "all") && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="distributor">Distributor</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Code</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Name</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Location</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Manager</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Capacity</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Storage Type</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGodowns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No warehouses found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGodowns.map((godown) => (
                    <TableRow key={godown.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {godown.godown_code}
                          </Badge>
                          {godown.is_primary && (
                            <Badge variant="default" className="text-xs">
                              Primary
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{godown.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={getTypeColor(godown.godown_type)}>
                            {getTypeIcon(godown.godown_type)}
                          </span>
                          <span className="capitalize">{godown.godown_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {[godown.city, godown.state, godown.pincode]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {godown.manager_name ? (
                          <div className="flex flex-col text-sm">
                            <span>{godown.manager_name}</span>
                            {godown.manager_phone && (
                              <span className="text-xs text-muted-foreground">
                                {godown.manager_phone}
                              </span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {godown.total_capacity_sqft
                          ? `${godown.total_capacity_sqft.toLocaleString()} sq ft`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {godown.storage_type ? (
                          <Badge variant="secondary" className="capitalize">
                            {godown.storage_type.replace("_", " ")}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={godown.is_active ? "default" : "secondary"} className="rounded-full capitalize">
                          {godown.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/godowns/${godown.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(godown)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredGodowns.length} of {godowns.length} warehouses
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteGodown} onOpenChange={(open) => !open && !deleting && setDeleteGodown(null)}>
        <DialogContent className="sm:max-w-lg p-0">
          <DialogHeader className="border-b bg-muted/30 px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base text-destructive">Delete Warehouse</DialogTitle>
                <DialogDescription className="mt-0.5">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-foreground">
                    {deleteGodown?.name} ({deleteGodown?.godown_code})
                  </span>
                  ? This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-4 pt-2 pb-4">
          {loadingRelated ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Checking related records...</span>
            </div>
          ) : relatedRecords && totalRelatedRecords > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                The following {totalRelatedRecords} related record(s) will be affected:
              </p>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead className="text-center">Records</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Object.entries(relatedRecords) as [keyof RelatedRecords, number][])
                      .filter(([, count]) => count > 0)
                      .map(([key, count]) => (
                        <TableRow key={key}>
                          <TableCell className="text-sm">{relatedRecordLabels[key].label}</TableCell>
                          <TableCell className="text-center font-medium">{count}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={relatedRecordLabels[key].action === "Deleted" ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {relatedRecordLabels[key].action}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Deleted</strong> = permanently removed. <strong>Unlinked</strong> = warehouse reference set to empty.
              </p>
            </div>
          ) : relatedRecords ? (
            <p className="text-sm text-muted-foreground py-2">
              No related records found. This warehouse can be safely deleted.
            </p>
          ) : null}
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-3">
            <Button
              variant="outline"
              onClick={() => setDeleteGodown(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={loadingRelated || deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleting ? "Deleting..." : "Delete Warehouse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
