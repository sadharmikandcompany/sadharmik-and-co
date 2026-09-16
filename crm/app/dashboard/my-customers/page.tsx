"use client"

import { Fragment, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Search, AlertCircle, Phone, ShoppingCart, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type Customer = {
  id: string
  first_name: string
  last_name: string
  mobile_primary: string | null
  email: string | null
  shipping_city: string | null
  shipping_pincode: string | null
  is_active: boolean
  total_orders: number
  total_spent: number
  last_order: string | null
}

type CustomerOrder = {
  id: string
  order_number: string
  invoice_number_gst: string | null
  created_at: string
  total_amount: number
  order_status: string
  payment_method: string | null
}

const PAGE_SIZE = 20

export default function MyCustomersPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityType, entityName, loading: entityLoading, error: entityError } = useEntityData()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Expandable rows
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  useEffect(() => {
    if (!roleLoading && role !== 'main_distributor' && role !== 'sub_distributor' && role !== 'retailer') {
      router.push('/dashboard')
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(0)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    if (!entityId || entityLoading) return
    fetchCustomers()
  }, [entityId, entityLoading, page, debouncedSearch])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: PAGE_SIZE.toString(),
      })
      if (entityType === 'retailer') {
        params.set("retailer_id", entityId!)
      } else {
        params.set("distributor_id", entityId!)
      }
      if (debouncedSearch) {
        params.set("search", debouncedSearch)
      }

      const res = await fetch(`/api/distributor-customers?${params}`)
      if (!res.ok) {
        console.error("API error:", res.status)
        setLoading(false)
        return
      }

      const data = await res.json()
      setCustomers(data.customers || [])
      setTotalCount(data.total || 0)
    } catch (err) {
      console.error("Error fetching customers:", err)
    }
    setLoading(false)
  }

  const toggleCustomerOrders = async (customerId: string) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null)
      setCustomerOrders([])
      return
    }

    setExpandedCustomer(customerId)
    setOrdersLoading(true)
    setCustomerOrders([])

    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, invoice_number_gst, created_at, total_amount, order_status, payment_method")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10)

    if (!error && data) {
      setCustomerOrders(data)
    }
    setOrdersLoading(false)
  }

  if (roleLoading || entityLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (entityError) {
    return (
      <div>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Account Setup Required
            </CardTitle>
            <CardDescription>{entityError}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your user account is not linked to a {entityType ?? 'distributor or retailer'} profile. Please contact your administrator.
            </p>
            <Button onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customers who have ordered from {entityName}
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Page Revenue</CardTitle>
            <ShoppingCart className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">
              ₹{customers.reduce((sum, c) => sum + c.total_spent, 0).toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Customers</CardTitle>
            <CardDescription className="text-sm">
              {totalCount} customer{totalCount !== 1 ? 's' : ''} found
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No customers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((customer) => {
                      const isExpanded = expandedCustomer === customer.id
                      return (
                        <Fragment key={customer.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleCustomerOrders(customer.id)}
                          >
                            <TableCell className="w-8 pr-0">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </TableCell>
                            <TableCell>
                              {customer.mobile_primary ? (
                                <span className="flex items-center gap-1.5 text-sm">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {customer.mobile_primary}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {customer.total_orders}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ₹{customer.total_spent.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell>
                              {customer.last_order ? (
                                <span className="text-sm">
                                  {new Date(customer.last_order).toLocaleDateString('en-IN')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={customer.is_active ? "default" : "secondary"}>
                                {customer.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30 p-0">
                                <div className="px-6 py-3">
                                  <p className="text-sm font-medium mb-2">
                                    Orders for {customer.first_name} {customer.last_name}
                                  </p>
                                  {ordersLoading ? (
                                    <div className="flex items-center gap-2 py-3">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                      <span className="text-sm text-muted-foreground">Loading orders...</span>
                                    </div>
                                  ) : customerOrders.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-2">No orders found</p>
                                  ) : (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Order #</TableHead>
                                          <TableHead>Invoice</TableHead>
                                          <TableHead>Date</TableHead>
                                          <TableHead className="text-right">Amount</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Payment</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {customerOrders.map((order) => (
                                          <TableRow
                                            key={order.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              router.push(`/dashboard/orders/${order.id}`)
                                            }}
                                          >
                                            <TableCell className="font-mono text-sm">
                                              {order.order_number}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                              {order.invoice_number_gst || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                              {new Date(order.created_at).toLocaleDateString('en-IN')}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              ₹{(parseFloat(String(order.total_amount)) || 0).toLocaleString('en-IN')}
                                            </TableCell>
                                            <TableCell>
                                              <Badge
                                                variant={
                                                  order.order_status === "delivered" ? "default" :
                                                  order.order_status === "cancelled" ? "destructive" : "secondary"
                                                }
                                              >
                                                {order.order_status}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm capitalize">
                                              {order.payment_method || "—"}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
