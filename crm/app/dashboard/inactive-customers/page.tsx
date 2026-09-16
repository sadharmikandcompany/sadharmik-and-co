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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Search, ChevronLeft, ChevronRight, UserX, TrendingDown, CalendarClock, Users } from "lucide-react"
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon"
import { toast } from "sonner"
import { ExportButtons } from "@/components/export-buttons"

type InactiveCustomer = {
  customer_id: string
  customer_name: string
  mobile_primary: string
  whatsapp_number: string | null
  company_name: string | null
  total_orders: number
  last_order_date: string
  average_gap_days: number
  days_since_last_order: number
  overdue_by_days: number
}

export default function InactiveCustomersPage() {
  const [customers, setCustomers] = useState<InactiveCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterOverdue, setFilterOverdue] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  useEffect(() => {
    fetchInactiveCustomers()
  }, [])

  const fetchInactiveCustomers = async () => {
    setLoading(true)
    try {
      // Fetch all active customers
      const { data: allCustomers, error: custError } = await supabase
        .from("customers")
        .select("id, first_name, last_name, mobile_primary, whatsapp_number, company_name")
        .eq("is_active", true)

      if (custError) {
        toast.error("Failed to fetch customers: " + custError.message)
        setLoading(false)
        return
      }

      if (!allCustomers || allCustomers.length === 0) {
        setCustomers([])
        setLoading(false)
        return
      }

      // Fetch completed/delivered orders for these customers
      const customerIds = allCustomers.map(c => c.id)

      // Batch fetch orders in chunks to avoid URL length limits
      const chunkSize = 50
      const allOrders: { customer_id: string; order_date: string; created_at: string }[] = []

      for (let i = 0; i < customerIds.length; i += chunkSize) {
        const chunk = customerIds.slice(i, i + chunkSize)
        const { data: orders, error: ordError } = await supabase
          .from("orders")
          .select("customer_id, order_date, created_at")
          .in("customer_id", chunk)
          .in("order_status", ["delivered", "completed", "processing", "pending"])
          .order("order_date", { ascending: true })

        if (ordError) {
          toast.error("Failed to fetch orders: " + ordError.message)
          continue
        }
        if (orders) allOrders.push(...orders)
      }

      // Group orders by customer
      const customerOrders: Record<string, string[]> = {}
      allOrders.forEach(order => {
        const cid = order.customer_id
        if (!cid) return
        if (!customerOrders[cid]) customerOrders[cid] = []
        customerOrders[cid].push(order.order_date || order.created_at)
      })

      const now = new Date()
      const inactiveList: InactiveCustomer[] = []

      allCustomers.forEach(customer => {
        const orderDates = customerOrders[customer.id]
        if (!orderDates || orderDates.length < 2) return // Need at least 2 orders to calculate gap

        // Sort dates
        const sorted = orderDates
          .map(d => new Date(d))
          .sort((a, b) => a.getTime() - b.getTime())

        // Use last 3 orders (or all if fewer) to calculate average gap
        const recentOrders = sorted.slice(-3)
        let totalGap = 0
        let gapCount = 0

        for (let i = 1; i < recentOrders.length; i++) {
          const gap = Math.floor(
            (recentOrders[i].getTime() - recentOrders[i - 1].getTime()) / (1000 * 60 * 60 * 24)
          )
          totalGap += gap
          gapCount++
        }

        if (gapCount === 0) return

        const avgGap = Math.round(totalGap / gapCount)
        const lastOrder = sorted[sorted.length - 1]
        const daysSinceLast = Math.floor(
          (now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24)
        )
        const overdueBy = daysSinceLast - avgGap

        // Only show customers who are overdue (days since last order > average gap)
        if (overdueBy > 0) {
          inactiveList.push({
            customer_id: customer.id,
            customer_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
            mobile_primary: customer.mobile_primary || "",
            whatsapp_number: customer.whatsapp_number || null,
            company_name: customer.company_name || null,
            total_orders: orderDates.length,
            last_order_date: lastOrder.toISOString(),
            average_gap_days: avgGap,
            days_since_last_order: daysSinceLast,
            overdue_by_days: overdueBy,
          })
        }
      })

      // Sort by most overdue first
      inactiveList.sort((a, b) => b.overdue_by_days - a.overdue_by_days)
      setCustomers(inactiveList)
    } catch {
      toast.error("An error occurred while fetching data")
    }
    setLoading(false)
  }

  const getWhatsAppLink = (customer: InactiveCustomer) => {
    const phone = (customer.whatsapp_number || customer.mobile_primary).replace(/\D/g, "")
    const phoneWithCountry = phone.startsWith("91") ? phone : `91${phone}`
    const message = encodeURIComponent(
      `Namaste ${customer.customer_name} ji,\n\nIt has been ${customer.days_since_last_order} days since your last order with Sadharmik & Company. Is there a problem?\n\nWe would love to serve you again. Please let us know if you need anything.\n\nThank you!`
    )
    return `https://wa.me/${phoneWithCountry}?text=${message}`
  }

  const getOverdueColor = (overdueDays: number) => {
    if (overdueDays >= 30) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    if (overdueDays >= 15) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
    if (overdueDays >= 7) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  }

  // Filter and search
  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.mobile_primary.includes(search) ||
      (c.company_name && c.company_name.toLowerCase().includes(search.toLowerCase()))

    const matchesOverdue =
      filterOverdue === "all" ? true :
      filterOverdue === "30plus" ? c.overdue_by_days >= 30 :
      filterOverdue === "15to30" ? c.overdue_by_days >= 15 && c.overdue_by_days < 30 :
      filterOverdue === "7to15" ? c.overdue_by_days >= 7 && c.overdue_by_days < 15 :
      filterOverdue === "under7" ? c.overdue_by_days < 7 : true

    return matchesSearch && matchesOverdue
  })

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Stats
  const criticalCount = customers.filter(c => c.overdue_by_days >= 30).length
  const warningCount = customers.filter(c => c.overdue_by_days >= 15 && c.overdue_by_days < 30).length

  // Export data
  const exportData = filteredCustomers.map(c => ({
    "Customer Name": c.customer_name,
    "Company": c.company_name || "-",
    "Phone": c.mobile_primary,
    "Total Orders": c.total_orders,
    "Last Order Date": new Date(c.last_order_date).toLocaleDateString("en-IN"),
    "Avg Order Gap (Days)": c.average_gap_days,
    "Days Since Last Order": c.days_since_last_order,
    "Overdue By (Days)": c.overdue_by_days,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inactive Customers</h1>
          <p className="text-muted-foreground">Customers who haven&apos;t ordered beyond their usual pattern</p>
        </div>
        <ExportButtons data={exportData} filename="inactive-customers" />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-2 sm:gap-3 md:grid-cols-4">
        <Card className="gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">Total Inactive</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">Customers past their usual order cycle</p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">Critical (30+ Days)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground">Overdue by 30+ days</p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">Warning (15-30 Days)</CardTitle>
            <CalendarClock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{warningCount}</div>
            <p className="text-xs text-muted-foreground">Overdue by 15-30 days</p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">Recently Inactive</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {customers.length - criticalCount - warningCount}
            </div>
            <p className="text-xs text-muted-foreground">Overdue by under 15 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Re-engagement List</CardTitle>
          <CardDescription>
            Based on average ordering pattern from last 3 bills. Customers shown here have exceeded their usual order gap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customer name, phone, or company..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={filterOverdue} onValueChange={(v) => { setFilterOverdue(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by overdue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Inactive</SelectItem>
                <SelectItem value="30plus">30+ Days Overdue</SelectItem>
                <SelectItem value="15to30">15-30 Days Overdue</SelectItem>
                <SelectItem value="7to15">7-15 Days Overdue</SelectItem>
                <SelectItem value="under7">Under 7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No inactive customers found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-center">Total Orders</TableHead>
                      <TableHead>Last Order</TableHead>
                      <TableHead className="text-center">Avg Gap (Days)</TableHead>
                      <TableHead className="text-center">Days Since Last</TableHead>
                      <TableHead className="text-center">Overdue By</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.map((customer) => (
                      <TableRow key={customer.customer_id} className={customer.overdue_by_days >= 30 ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{customer.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{customer.mobile_primary}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {customer.company_name || "-"}
                        </TableCell>
                        <TableCell className="text-center">{customer.total_orders}</TableCell>
                        <TableCell>{new Date(customer.last_order_date).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{customer.average_gap_days} days</Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {customer.days_since_last_order} days
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getOverdueColor(customer.overdue_by_days)}>
                            +{customer.overdue_by_days} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            asChild
                          >
                            <a
                              href={getWhatsAppLink(customer)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <WhatsAppIcon className="h-4 w-4 mr-1" />
                              Follow Up
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of{" "}
                  {filteredCustomers.length} results
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
