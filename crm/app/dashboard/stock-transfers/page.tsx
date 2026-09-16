"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
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
import { Plus, ArrowRightLeft, CheckCircle, XCircle, Clock, Truck, Package, Search } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type StockTransfer = {
  id: string
  transfer_number: string
  from_godown_id: string
  to_godown_id: string
  stock_inventory_id: string | null
  quantity: number | null
  transfer_status: "pending" | "in_transit" | "completed" | "cancelled" | "rejected"
  requested_date: string
  approved_date: string | null
  shipped_date: string | null
  received_date: string | null
  completed_date: string | null
  requested_by_email: string | null
  transfer_reason: string | null
  is_urgent: boolean
  from_godown: {
    name: string
    godown_code: string
    city: string | null
  } | null
  to_godown: {
    name: string
    godown_code: string
    city: string | null
  } | null
  stock_inventory: {
    products: {
      name: string
      brand: string | null
    } | null
    product_variants: {
      variant_name: string
    } | null
    packaging_materials: {
      name: string
    } | null
  } | null
  stock_transfer_items: {
    id: string
    stock_inventory_id: string
    quantity: number
  }[]
}

export default function StockTransfersPage() {
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, loading: entityLoading } = useEntityData()
  const isRetailer = role === "retailer"

  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    // Wait until we know the role, and (for retailers) until their entity is resolved,
    // so we can scope the query to only their own godowns' transfers.
    if (roleLoading) return
    if (isRetailer && entityLoading) return
    fetchTransfers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, isRetailer, entityLoading, entityId])

  const fetchTransfers = async () => {
    setLoading(true)

    // Retailers may only see transfers that involve one of their own godowns.
    let retailerGodownIds: string[] | null = null
    if (isRetailer) {
      if (!entityId) {
        setTransfers([])
        setLoading(false)
        return
      }

      const { data: godownData, error: godownError } = await supabase
        .from("godowns")
        .select("id")
        .eq("retailer_id", entityId)

      if (godownError) {
        console.error("Error fetching retailer godowns:", godownError)
        toast.error("Failed to fetch stock transfers")
        setTransfers([])
        setLoading(false)
        return
      }

      retailerGodownIds = (godownData || []).map((g) => g.id)

      if (retailerGodownIds.length === 0) {
        setTransfers([])
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from("stock_transfers")
      .select(`
        *,
        from_godown:godowns!from_godown_id (
          name,
          godown_code,
          city
        ),
        to_godown:godowns!to_godown_id (
          name,
          godown_code,
          city
        ),
        stock_inventory (
          products (
            name,
            brand
          ),
          product_variants (
            variant_name
          ),
          packaging_materials (
            name
          )
        ),
        stock_transfer_items (
          id,
          stock_inventory_id,
          quantity
        )
      `)
      .order("requested_date", { ascending: false })

    // Scope retailers to transfers where one of their godowns is the source or destination.
    if (retailerGodownIds) {
      const idList = retailerGodownIds.join(",")
      query = query.or(`from_godown_id.in.(${idList}),to_godown_id.in.(${idList})`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching transfers:", error)
      toast.error("Failed to fetch stock transfers")
    } else {
      setTransfers(data || [])
    }
    setLoading(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "in_transit":
        return <Truck className="h-4 w-4 text-blue-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-orange-600" />
      case "cancelled":
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Package className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default"
      case "in_transit":
        return "secondary"
      case "pending":
        return "outline"
      case "cancelled":
      case "rejected":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch =
      transfer.transfer_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transfer.from_godown && transfer.from_godown.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (transfer.to_godown && transfer.to_godown.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (transfer.transfer_reason && transfer.transfer_reason.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === "all" || transfer.transfer_status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Separate by status
  const pendingTransfers = filteredTransfers.filter(t => t.transfer_status === "pending")
  const inTransitTransfers = filteredTransfers.filter(t => t.transfer_status === "in_transit")
  const completedTransfers = filteredTransfers.filter(t => t.transfer_status === "completed")

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <ArrowRightLeft className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Stock Transfers</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <ArrowRightLeft className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Product Transfers</h1>
            <p className="text-sm text-muted-foreground">Manage product movements between warehouses</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Link href="/dashboard/stock-transfers/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Transfer
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Transfers</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{transfers.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All transfer requests</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{pendingTransfers.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Clock className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Awaiting action</CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>In Transit</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{inTransitTransfers.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Truck className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Currently shipping</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{completedTransfers.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <CheckCircle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Successfully received</CardContent>
        </Card>
      </div>

      {/* Transfers Table */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">All Transfers</CardTitle>
                <CardDescription className="mt-0.5">Movements of stock between warehouses</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredTransfers.length} {filteredTransfers.length === 1 ? "transfer" : "transfers"}
              </Badge>
              {(searchTerm || statusFilter !== "all") && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by transfer number, warehouse, reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
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
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Transfer #</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Product/Item</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">From</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">To</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Quantity</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Requested</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Reason</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No transfers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => {
                    // For backward compatibility: check if using new items system or old single item
                    const hasMultipleItems = transfer.stock_transfer_items && transfer.stock_transfer_items.length > 0
                    const product = transfer.stock_inventory?.products
                    const variant = transfer.stock_inventory?.product_variants
                    const material = transfer.stock_inventory?.packaging_materials

                    return (
                      <TableRow key={transfer.id} className="transition-colors hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">{transfer.transfer_number}</span>
                            {transfer.is_urgent && (
                              <Badge variant="destructive" className="text-xs">
                                Urgent
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasMultipleItems ? (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {transfer.stock_transfer_items.length} product(s)
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Click to view details
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {product?.name || material?.name || "—"}
                              </span>
                              {variant?.variant_name && (
                                <span className="text-xs text-muted-foreground">
                                  {variant.variant_name}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>{transfer.from_godown?.name || "—"}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {transfer.from_godown?.godown_code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>{transfer.to_godown?.name || "—"}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {transfer.to_godown?.godown_code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {hasMultipleItems
                            ? transfer.stock_transfer_items.reduce((sum, item) => sum + item.quantity, 0)
                            : (transfer.quantity || "—")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>{new Date(transfer.requested_date).toLocaleDateString()}</span>
                            {transfer.requested_by_email && (
                              <span className="text-xs text-muted-foreground">
                                {transfer.requested_by_email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusVariant(transfer.transfer_status)}
                            className="flex items-center gap-1 w-fit rounded-full capitalize"
                          >
                            {getStatusIcon(transfer.transfer_status)}
                            <span className="capitalize">{transfer.transfer_status.replace("_", " ")}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {transfer.transfer_reason || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/stock-transfers/${transfer.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredTransfers.length} of {transfers.length} transfers
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
