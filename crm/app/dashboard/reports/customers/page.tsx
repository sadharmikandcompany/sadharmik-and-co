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
import { Users, X, Loader2, CheckCircle2, Wallet, IndianRupee, Search, Filter as FilterIcon } from "lucide-react"
import { toast } from "sonner"
import { ExportButtons } from "@/components/export-buttons"

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  mobile_primary: string
  whatsapp_number: string | null
  company_name: string | null
  gst_number: string | null
  pan_card_number: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  customer_type: string | null
  credit_limit: number | null
  outstanding_balance: number | null
  is_active: boolean
  created_at: string
}

export default function CustomersReportPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all")
  const [stateFilter, setStateFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching customers:", error)
      toast.error("Failed to fetch customers")
      setLoading(false)
      return
    }

    setCustomers(data || [])
    setLoading(false)
  }

  // Get unique states for filter
  const uniqueStates = Array.from(
    new Set(customers.map(c => c.state).filter(Boolean))
  ).sort()

  const filteredCustomers = customers.filter((customer) => {
    // Text search filter
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase()
    const matchesSearch =
      searchTerm === "" ||
      fullName.includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mobile_primary.includes(searchTerm) ||
      customer.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.gst_number?.toLowerCase().includes(searchTerm.toLowerCase())

    // Customer type filter
    const matchesCustomerType =
      customerTypeFilter === "all" ||
      (customer.customer_type || "retail").toLowerCase() === customerTypeFilter.toLowerCase()

    // State filter
    const matchesState =
      stateFilter === "all" ||
      customer.state === stateFilter

    // Status filter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && customer.is_active) ||
      (statusFilter === "inactive" && !customer.is_active)

    return (
      matchesSearch &&
      matchesCustomerType &&
      matchesState &&
      matchesStatus
    )
  })

  const clearFilters = () => {
    setCustomerTypeFilter("all")
    setStateFilter("all")
    setStatusFilter("all")
    setSearchTerm("")
  }

  const hasActiveFilters =
    customerTypeFilter !== "all" ||
    stateFilter !== "all" ||
    statusFilter !== "all" ||
    searchTerm !== ""

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-"
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Calculate summary stats
  const totalCustomers = filteredCustomers.length
  const activeCustomers = filteredCustomers.filter(c => c.is_active).length
  const totalCreditLimit = filteredCustomers.reduce((sum, c) => sum + (c.credit_limit || 0), 0)
  const totalOutstanding = filteredCustomers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0)

  // Prepare export data
  const exportData = filteredCustomers.map(customer => ({
    'Name': `${customer.first_name} ${customer.last_name}`,
    'Company': customer.company_name || 'N/A',
    'Email': customer.email || 'N/A',
    'Mobile': customer.mobile_primary,
    'WhatsApp': customer.whatsapp_number || 'N/A',
    'GST Number': customer.gst_number || 'N/A',
    'PAN Number': customer.pan_card_number || 'N/A',
    'Customer Type': customer.customer_type || 'Retail',
    'Address': customer.address_line1 || 'N/A',
    'City': customer.city || 'N/A',
    'State': customer.state || 'N/A',
    'Pincode': customer.pincode || 'N/A',
    'Credit Limit': customer.credit_limit ? `₹${customer.credit_limit.toFixed(2)}` : 'N/A',
    'Outstanding': customer.outstanding_balance ? `₹${customer.outstanding_balance.toFixed(2)}` : '₹0.00',
    'Status': customer.is_active ? 'Active' : 'Inactive',
  }))

  const exportColumns = [
    { header: 'Name', dataKey: 'Name' },
    { header: 'Company', dataKey: 'Company' },
    { header: 'Mobile', dataKey: 'Mobile' },
    { header: 'Email', dataKey: 'Email' },
    { header: 'Type', dataKey: 'Customer Type' },
    { header: 'City', dataKey: 'City' },
    { header: 'State', dataKey: 'State' },
    { header: 'Status', dataKey: 'Status' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Customers Report</h1>
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
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Customers Report</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive report of all customers with export options
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <ExportButtons
          data={exportData}
          filename="customers-report"
          columns={exportColumns}
          pdfTitle="Customers Report"
        />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Customers</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {totalCustomers.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across current filters
          </CardContent>
        </Card>

        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Active Customers</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
              {activeCustomers.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Currently active accounts
          </CardContent>
        </Card>

        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Credit Limit</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
              {formatCurrency(totalCreditLimit)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <Wallet className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sum of credit limits
          </CardContent>
        </Card>

        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Total Outstanding</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">
              {formatCurrency(totalOutstanding)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pending receivables
          </CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/50">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Customer Details</CardTitle>
                <CardDescription className="mt-0.5">
                  Filter and view detailed customer information
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredCustomers.length} {filteredCustomers.length === 1 ? "customer" : "customers"}
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
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>

              {/* Customer Type */}
              <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Customer Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="distributor">Distributor</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>

              {/* State Filter */}
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {uniqueStates.map((state) => (
                    <SelectItem key={state} value={state!}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

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
            <Table className="min-w-[1100px] w-max">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Name</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Company</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Contact</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Email</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Location</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">GST Number</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Credit Limit</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Outstanding</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[11px] font-semibold">
                            {(customer.first_name || "").charAt(0).toUpperCase()}{(customer.last_name || "").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{customer.first_name} {customer.last_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.company_name ? (
                          <span className="text-sm">{customer.company_name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{customer.mobile_primary}</div>
                          {customer.whatsapp_number && (
                            <div className="text-xs text-muted-foreground">
                              WA: {customer.whatsapp_number}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.email ? (
                          <span className="text-sm">{customer.email}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.city && customer.state
                          ? `${customer.city}, ${customer.state}`
                          : customer.city || customer.state || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full capitalize">
                          {customer.customer_type || "Retail"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {customer.gst_number ? (
                          <span className="text-sm font-mono">{customer.gst_number}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(customer.credit_limit)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${customer.outstanding_balance && customer.outstanding_balance > 0 ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"}`}>
                        {formatCurrency(customer.outstanding_balance || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`rounded-full ${
                            customer.is_active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {customer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredCustomers.length} of {customers.length} customers
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
