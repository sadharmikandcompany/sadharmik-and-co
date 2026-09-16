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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, ShoppingBag, Loader2, IndianRupee, Clock, CheckCircle2, Search, Filter as FilterIcon } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"

type Purchase = {
  id: string
  purchase_number: string
  supplier_name: string
  distributor_id: string | null
  distributor_name?: string
  purchase_status: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  supplier_city: string | null
  supplier_state: string | null
  is_urgent: boolean
  purchase_date: string
  created_at: string
  purchase_category?: string
}

export default function PurchasesReportPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<string>("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchPurchases()
  }, [])

  const fetchPurchases = async () => {
    setLoading(true)

    const { data: purchasesData, error: purchasesError } = await supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false })

    if (purchasesError) {
      console.error("Error fetching purchases:", purchasesError)
      toast.error("Failed to fetch purchases")
      setLoading(false)
      return
    }

    // Fetch distributor names if distributor_id is present
    const distributorIds = purchasesData
      ?.filter((p) => p.distributor_id)
      .map((p) => p.distributor_id)
      .filter((id): id is string => id !== null)

    const distributorMap = new Map<string, string>()

    if (distributorIds && distributorIds.length > 0) {
      const { data: distributorsData, error: distributorsError } = await supabase
        .from("distributors")
        .select("id, name")
        .in("id", distributorIds)

      if (distributorsError) {
        console.error("Error fetching distributors:", distributorsError)
      } else {
        distributorsData?.forEach((distributor) => {
          distributorMap.set(distributor.id, distributor.name)
        })
      }
    }

    const purchasesWithDistributors = purchasesData?.map((purchase) => ({
      ...purchase,
      distributor_name: purchase.distributor_id
        ? distributorMap.get(purchase.distributor_id) || "Unknown"
        : undefined,
    }))

    setPurchases(purchasesWithDistributors || [])
    setLoading(false)
  }

  const filteredPurchases = purchases.filter((purchase) => {
    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      purchase.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (purchase.distributor_name &&
        purchase.distributor_name.toLowerCase().includes(searchTerm.toLowerCase()))

    // Date range filter
    const purchaseDate = new Date(purchase.purchase_date || purchase.created_at)
    const matchesDateFrom = !dateFrom || purchaseDate >= dateFrom
    const matchesDateTo = !dateTo || purchaseDate <= dateTo

    // Purchase status filter
    const matchesPurchaseStatus =
      purchaseStatusFilter === "all" ||
      purchase.purchase_status.toLowerCase() === purchaseStatusFilter.toLowerCase()

    // Payment status filter
    const matchesPaymentStatus =
      paymentStatusFilter === "all" ||
      purchase.payment_status.toLowerCase() === paymentStatusFilter.toLowerCase()

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesPurchaseStatus &&
      matchesPaymentStatus
    )
  })

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setPurchaseStatusFilter("all")
    setPaymentStatusFilter("all")
    setSearchTerm("")
  }

  const hasActiveFilters =
    dateFrom ||
    dateTo ||
    purchaseStatusFilter !== "all" ||
    paymentStatusFilter !== "all" ||
    searchTerm !== ""

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "completed" || lowerStatus === "received") {
      return "default"
    }
    if (lowerStatus === "pending" || lowerStatus === "processing" || lowerStatus === "shipped") {
      return "outline"
    }
    if (lowerStatus === "cancelled" || lowerStatus === "failed") {
      return "destructive"
    }
    if (lowerStatus === "partially_received" || lowerStatus === "partial") {
      return "secondary"
    }
    return "secondary"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Calculate summary stats — Total Purchase Value only counts material
  // (stock) purchases; direct/indirect expense purchases are excluded, same
  // as the P&L report and factory dashboard.
  const totalPurchaseValue = filteredPurchases
    .filter((p) => (p.purchase_category || "material") === "material")
    .reduce((sum, p) => sum + Number(p.total_amount || 0), 0)
  const pendingPurchases = filteredPurchases.filter((p) => p.purchase_status === "pending").length
  const receivedPurchases = filteredPurchases.filter((p) => p.purchase_status === "received").length
  const urgentPurchases = filteredPurchases.filter((p) => p.is_urgent).length

  // Prepare export data
  const exportData = filteredPurchases.map(purchase => ({
    'Purchase Number': purchase.purchase_number,
    'Supplier': purchase.supplier_name,
    'Distributor': purchase.distributor_name || 'N/A',
    'Location': purchase.supplier_city && purchase.supplier_state
      ? `${purchase.supplier_city}, ${purchase.supplier_state}`
      : purchase.supplier_city || purchase.supplier_state || 'N/A',
    'Status': purchase.purchase_status,
    'Payment Status': purchase.payment_status,
    'Payment Method': purchase.payment_method || 'N/A',
    'Total': `₹${purchase.total_amount.toFixed(2)}`,
    'Urgent': purchase.is_urgent ? 'Yes' : 'No',
    'Purchase Date': format(new Date(purchase.purchase_date || purchase.created_at), 'PPP')
  }))

  const exportColumns = [
    { header: 'PO #', dataKey: 'Purchase Number' },
    { header: 'Supplier', dataKey: 'Supplier' },
    { header: 'Distributor', dataKey: 'Distributor' },
    { header: 'Status', dataKey: 'Status' },
    { header: 'Payment', dataKey: 'Payment Status' },
    { header: 'Total', dataKey: 'Total' },
    { header: 'Date', dataKey: 'Purchase Date' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Purchases Report</h1>
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
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Purchases Report</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive report of all purchases with export options
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <ExportButtons
          data={exportData}
          filename="purchases-report"
          columns={exportColumns}
          pdfTitle="Purchases Report"
        />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Purchases</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {filteredPurchases.length.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across current filters
          </CardContent>
        </Card>

        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
              {formatCurrency(totalPurchaseValue)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sum of purchase totals
          </CardContent>
        </Card>

        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">
              {pendingPurchases.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <Clock className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Awaiting receipt
          </CardContent>
        </Card>

        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Received</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
              {receivedPurchases.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Completed purchases
          </CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Purchase Details</CardTitle>
                <CardDescription className="mt-0.5">
                  Filter and view detailed purchase information
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredPurchases.length} {filteredPurchases.length === 1 ? "purchase" : "purchases"}
              </Badge>
              {hasActiveFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  Filters active
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search purchases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>

              {/* Purchase Status */}
              <Select value={purchaseStatusFilter} onValueChange={setPurchaseStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Purchase Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="partially_received">Partially Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Payment Status */}
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Payment Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              {/* Date range */}
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
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-max">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">PO Number</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Supplier</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Distributor</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Location</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Amount</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Purchase Status</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Payment Status</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Payment Method</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No purchases found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((purchase) => (
                    <TableRow key={purchase.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {purchase.purchase_number}
                        {purchase.is_urgent && (
                          <Badge variant="destructive" className="ml-2">
                            Urgent
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{purchase.supplier_name}</TableCell>
                      <TableCell>
                        {purchase.distributor_name ? (
                          <span className="text-sm">{purchase.distributor_name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {purchase.supplier_city && purchase.supplier_state
                          ? `${purchase.supplier_city}, ${purchase.supplier_state}`
                          : purchase.supplier_city || purchase.supplier_state || "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(Number(purchase.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(purchase.purchase_status)} className="rounded-full capitalize">
                          {purchase.purchase_status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(purchase.payment_status)} className="rounded-full capitalize">
                          {purchase.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {purchase.payment_method ? (
                          <span className="text-sm capitalize">
                            {purchase.payment_method.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(purchase.purchase_date || purchase.created_at), 'PP')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredPurchases.length} of {purchases.length} purchases
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
