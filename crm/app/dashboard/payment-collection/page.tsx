"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, ChevronLeft, ChevronRight, AlertTriangle, IndianRupee, Users, ExternalLink, Phone } from "lucide-react"
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon"
import { toast } from "sonner"
import { ExportButtons } from "@/components/export-buttons"

type PendingPayment = {
  order_id: string
  order_number: string
  customer_id: string
  customer_name: string
  mobile_primary: string
  whatsapp_number: string | null
  mobile_secondary_1: string | null
  mobile_secondary_2: string | null
  company_name: string | null
  full_address: string | null
  total_amount: number
  collected_amount: number
  balance_amount: number
  order_date: string
  days_since_order: number
  payment_status: string
  order_status: string
  invoice_number_gst: string | null
  invoice_number_non_gst: string | null
}

type CustomerModalData = {
  customer_id: string
  customer_name: string
  mobile_primary: string
  whatsapp_number: string | null
  mobile_secondary_1: string | null
  mobile_secondary_2: string | null
  company_name: string | null
  full_address: string | null
  pending_orders: PendingPayment[]
  total_balance: number
}

export default function PaymentCollectionPage() {
  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterDays, setFilterDays] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  // Customer modal state
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerModalData | null>(null)

  useEffect(() => {
    fetchPendingPayments()
  }, [])

  const fetchPendingPayments = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/payment-collection")
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || "Failed to fetch payment data")
        setLoading(false)
        return
      }
      const data: PendingPayment[] = await response.json()
      setPayments(data)
    } catch {
      toast.error("An error occurred while fetching data")
    }
    setLoading(false)
  }

  const openCustomerModal = (payment: PendingPayment) => {
    // Get all pending orders for this customer
    const customerOrders = payments.filter(p => p.customer_id === payment.customer_id)
    const totalBalance = customerOrders.reduce((sum, p) => sum + p.balance_amount, 0)

    setSelectedCustomer({
      customer_id: payment.customer_id,
      customer_name: payment.customer_name,
      mobile_primary: payment.mobile_primary,
      whatsapp_number: payment.whatsapp_number,
      mobile_secondary_1: payment.mobile_secondary_1,
      mobile_secondary_2: payment.mobile_secondary_2,
      company_name: payment.company_name,
      full_address: payment.full_address,
      pending_orders: customerOrders,
      total_balance: totalBalance,
    })
    setCustomerModalOpen(true)
  }

  const getWhatsAppLink = (payment: PendingPayment) => {
    const phone = (payment.whatsapp_number || payment.mobile_primary).replace(/\D/g, "")
    const phoneWithCountry = phone.startsWith("91") ? phone : `91${phone}`
    const message = encodeURIComponent(
      `Namaste ${payment.customer_name} ji,\n\nThis is a reminder from Kalapurna. Your payment of ₹${payment.balance_amount.toFixed(2)} for order ${payment.order_number} is still pending.\n\nIf you have already made the payment, please confirm.\n\nThank you!`
    )
    return `https://wa.me/${phoneWithCountry}?text=${message}`
  }

  const getCustomerWhatsAppLink = (customer: CustomerModalData) => {
    const phone = (customer.whatsapp_number || customer.mobile_primary).replace(/\D/g, "")
    const phoneWithCountry = phone.startsWith("91") ? phone : `91${phone}`
    const message = encodeURIComponent(
      `Namaste ${customer.customer_name} ji,\n\nThis is a reminder from Kalapurna. Your total outstanding payment of ₹${customer.total_balance.toFixed(2)} is still pending.\n\nIf you have already made the payment, please confirm.\n\nThank you!`
    )
    return `https://wa.me/${phoneWithCountry}?text=${message}`
  }

  const getDaysColor = (days: number) => {
    if (days >= 10) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    if (days >= 5) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  }

  // Filter and search
  const filteredPayments = payments.filter(p => {
    const matchesSearch =
      p.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      p.order_number.toLowerCase().includes(search.toLowerCase()) ||
      p.mobile_primary.includes(search)

    const matchesDays =
      filterDays === "all" ? true :
      filterDays === "10plus" ? p.days_since_order >= 10 :
      filterDays === "5to10" ? p.days_since_order >= 5 && p.days_since_order < 10 :
      filterDays === "under5" ? p.days_since_order < 5 : true

    return matchesSearch && matchesDays
  })

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage)
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Stats
  const totalPending = payments.reduce((sum, p) => sum + p.balance_amount, 0)
  const overdueCount = payments.filter(p => p.days_since_order >= 10).length
  const totalCustomers = new Set(payments.map(p => p.customer_id)).size

  // Export data
  const exportData = filteredPayments.map(p => ({
    "Customer Name": p.customer_name,
    "Phone": p.mobile_primary,
    "Order Number": p.order_number,
    "Order Date": new Date(p.order_date).toLocaleDateString("en-IN"),
    "Total Amount": p.total_amount,
    "Collected": p.collected_amount,
    "Balance Due": p.balance_amount,
    "Days Pending": p.days_since_order,
    "Payment Status": p.payment_status,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Collection</h1>
          <p className="text-muted-foreground">Track and collect pending payments from customers</p>
        </div>
        <ExportButtons data={exportData} filename="payment-collection" />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
        <Card className="gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">Total Pending Amount</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {"\u20B9"}{totalPending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{filteredPayments.length} pending orders</p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">Overdue (10+ Days)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{overdueCount}</div>
            <p className="text-xs text-muted-foreground">Orders need immediate attention</p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-sm font-medium">Customers with Dues</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Unique customers with pending payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="min-w-0 max-w-full">
        <CardHeader>
          <CardTitle>Pending Payments</CardTitle>
          <CardDescription>Orders with unpaid or partially paid balances</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          <div className="w-0 min-w-full max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customer name, order number, or phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={filterDays} onValueChange={(v) => { setFilterDays(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pending</SelectItem>
                <SelectItem value="10plus">10+ Days (Urgent)</SelectItem>
                <SelectItem value="5to10">5-10 Days</SelectItem>
                <SelectItem value="under5">Under 5 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pending payments found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                      <TableHead className="text-center">Days Pending</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPayments.map((payment) => (
                      <TableRow key={payment.order_id} className={payment.days_since_order >= 10 ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                        <TableCell>
                          <div>
                            <button
                              onClick={() => openCustomerModal(payment)}
                              className="font-medium text-primary hover:underline cursor-pointer text-left"
                            >
                              {payment.customer_name}
                            </button>
                            <div className="text-xs text-muted-foreground">{payment.mobile_primary}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Link
                              href={`/dashboard/orders/${payment.order_id}`}
                              className="inline-flex items-center gap-1 font-mono text-sm text-primary hover:underline"
                            >
                              {payment.order_number}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                            {(payment.invoice_number_gst || payment.invoice_number_non_gst) && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {payment.invoice_number_gst || payment.invoice_number_non_gst}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(payment.order_date).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell className="text-right">{"\u20B9"}{payment.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{"\u20B9"}{payment.collected_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {"\u20B9"}{payment.balance_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getDaysColor(payment.days_since_order)}>
                            {payment.days_since_order} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={payment.payment_status === "partial" ? "secondary" : "destructive"}>
                            {payment.payment_status}
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
                              href={getWhatsAppLink(payment)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <WhatsAppIcon className="h-4 w-4 mr-1" />
                              Remind
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
                  {Math.min(currentPage * itemsPerPage, filteredPayments.length)} of{" "}
                  {filteredPayments.length} results
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
          </div>
        </CardContent>
      </Card>

      {/* Customer Detail Modal */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedCustomer.customer_name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 overflow-y-auto pr-1">
                {/* Customer Info */}
                <div className="rounded-md border p-4 space-y-3">
                  {selectedCustomer.company_name && (
                    <p className="text-sm text-muted-foreground">{selectedCustomer.company_name}</p>
                  )}

                  {/* Phone Numbers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href={`tel:${selectedCustomer.mobile_primary}`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {selectedCustomer.mobile_primary}
                      <Badge variant="outline" className="text-[10px] ml-1">Primary</Badge>
                    </a>
                    {selectedCustomer.whatsapp_number && selectedCustomer.whatsapp_number !== selectedCustomer.mobile_primary && (
                      <a
                        href={`https://wa.me/${selectedCustomer.whatsapp_number.replace(/\D/g, "").replace(/^(?!91)/, "91")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-green-600 hover:underline"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                        {selectedCustomer.whatsapp_number}
                        <Badge variant="outline" className="text-[10px] ml-1">WhatsApp</Badge>
                      </a>
                    )}
                    {selectedCustomer.mobile_secondary_1 && (
                      <a
                        href={`tel:${selectedCustomer.mobile_secondary_1}`}
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Phone className="h-4 w-4" />
                        {selectedCustomer.mobile_secondary_1}
                        <Badge variant="outline" className="text-[10px] ml-1">Phone 2</Badge>
                      </a>
                    )}
                    {selectedCustomer.mobile_secondary_2 && (
                      <a
                        href={`tel:${selectedCustomer.mobile_secondary_2}`}
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Phone className="h-4 w-4" />
                        {selectedCustomer.mobile_secondary_2}
                        <Badge variant="outline" className="text-[10px] ml-1">Phone 3</Badge>
                      </a>
                    )}
                  </div>

                  {/* WhatsApp Reminder Button */}
                  <a
                    href={getCustomerWhatsAppLink(selectedCustomer)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:underline"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    Send Payment Reminder via WhatsApp
                  </a>

                  {/* Address */}
                  {selectedCustomer.full_address && (
                    <p className="text-xs text-muted-foreground border-t pt-2">{selectedCustomer.full_address}</p>
                  )}
                </div>

                {/* Total Outstanding */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-sm text-muted-foreground">Total Outstanding</p>
                      <p className="text-2xl font-bold text-red-600">
                        {"\u20B9"}{selectedCustomer.total_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-sm text-muted-foreground">Pending Orders</p>
                      <p className="text-2xl font-bold">{selectedCustomer.pending_orders.length}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Pending Orders Table */}
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Order #</TableHead>
                        <TableHead className="whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Collected</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
                        <TableHead className="text-center whitespace-nowrap">Days</TableHead>
                        <TableHead className="text-center whitespace-nowrap">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCustomer.pending_orders.map((order) => (
                        <TableRow key={order.order_id}>
                          <TableCell className="whitespace-nowrap">
                            <div>
                              <Link
                                href={`/dashboard/orders/${order.order_id}`}
                                className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                                onClick={() => setCustomerModalOpen(false)}
                              >
                                {order.order_number}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                              {(order.invoice_number_gst || order.invoice_number_non_gst) && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {order.invoice_number_gst || order.invoice_number_non_gst}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {new Date(order.order_date).toLocaleDateString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-sm whitespace-nowrap">
                            {"\u20B9"}{order.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-sm whitespace-nowrap">
                            {"\u20B9"}{order.collected_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-red-600 whitespace-nowrap">
                            {"\u20B9"}{order.balance_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getDaysColor(order.days_since_order)}>
                              {order.days_since_order}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 text-xs"
                              asChild
                            >
                              <a
                                href={getWhatsAppLink(order)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <WhatsAppIcon className="h-3 w-3 mr-1" />
                                Remind
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
