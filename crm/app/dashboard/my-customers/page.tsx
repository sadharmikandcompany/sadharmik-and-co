"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Phone,
  ShoppingCart,
  User,
  Users,
  X,
} from "lucide-react"

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
  invoice_number_non_gst: string | null
  created_at: string
  total_amount: number
  order_status: string
  payment_status: string | null
  payment_method: string | null
}

const PAGE_SIZE = 20

const formatINR = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

export default function MyCustomersPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityType, entityName, loading: entityLoading, error: entityError } = useEntityData()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [sortBy, setSortBy] = useState<"name" | "date" | "spend">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  useEffect(() => {
    if (!roleLoading && role !== "main_distributor" && role !== "sub_distributor" && role !== "retailer") {
      router.push("/dashboard")
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(0)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

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
      if (entityType === "retailer") {
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

  const selectCustomer = async (customerId: string) => {
    setSelectedId(customerId)
    setOrdersLoading(true)
    setCustomerOrders([])

    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, invoice_number_gst, invoice_number_non_gst, created_at, total_amount, order_status, payment_status, payment_method")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data) {
      setCustomerOrders(data)
    }
    setOrdersLoading(false)
  }

  const sortedCustomers = useMemo(() => {
    const list = [...customers]
    const dir = sortOrder === "asc" ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === "name") {
        return dir * `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      }
      if (sortBy === "spend") {
        return dir * ((a.total_spent || 0) - (b.total_spent || 0))
      }
      const ad = a.last_order ? new Date(a.last_order).getTime() : 0
      const bd = b.last_order ? new Date(b.last_order).getTime() : 0
      return dir * (ad - bd)
    })
    return list
  }, [customers, sortBy, sortOrder])

  const selectedCustomer = customers.find((c) => c.id === selectedId) || null

  const orderTotals = useMemo(() => {
    const active = customerOrders.filter((o) => o.order_status !== "cancelled")
    const billed = active.reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0)
    const due = active
      .filter((o) => o.payment_status !== "completed")
      .reduce((sum, o) => sum + (parseFloat(String(o.total_amount)) || 0), 0)
    return { billed, due, paid: billed - due, count: active.length }
  }, [customerOrders])

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
              Your user account is not linked to a {entityType ?? "distributor or retailer"} profile. Please contact your administrator.
            </p>
            <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="flex gap-3 -mx-6 -my-4 max-w-none w-[calc(100%+3rem)] px-3 py-3">
      {/* Left Panel - Customer List (1/3) */}
      <div className="w-1/3 flex flex-col sticky top-0 h-[calc(100vh-3.5rem)]">
        <Card className="flex flex-1 min-h-0 flex-col gap-3 py-3 border border-border ring-0 shadow-sm rounded-lg">
          <CardHeader className="px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl tracking-tight">My Customers</CardTitle>
                  <CardDescription className="mt-0.5 text-xs flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                      {totalCount}
                    </span>
                    <span className="text-muted-foreground">
                      customer{totalCount === 1 ? "" : "s"} for {entityName}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-1 min-h-0 flex-col gap-3 px-4">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, phone, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "date" | "spend")}>
                  <SelectTrigger className="h-8 min-w-[90px] text-xs">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Last order</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="spend">Spend</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                  title={sortOrder === "asc" ? "Ascending" : "Descending"}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Party Name</span>
              <span className="text-right pr-1">Amount</span>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="divide-y divide-border/60">
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <div key={i} className="px-3 py-2.5 animate-pulse grid grid-cols-[1fr_auto] gap-2 items-center">
                      <div className="h-3 w-2/3 rounded bg-muted" />
                      <div className="h-3 w-16 rounded bg-muted/70" />
                    </div>
                  ))
                ) : sortedCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <Users className="h-5 w-5" />
                    </div>
                    <p className="text-sm">No customers found</p>
                  </div>
                ) : (
                  sortedCustomers.map((customer) => {
                    const isSelected = selectedId === customer.id
                    return (
                      <button
                        key={customer.id}
                        onClick={() => selectCustomer(customer.id)}
                        className={`w-full text-left grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/50 ${
                          isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {customer.first_name} {customer.last_name}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {customer.mobile_primary && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customer.mobile_primary}
                              </span>
                            )}
                            {customer.shipping_city && <span>{customer.shipping_city}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold tabular-nums">{formatINR(customer.total_spent)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {customer.total_orders} order{customer.total_orders === 1 ? "" : "s"}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </ScrollArea>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Selected Customer (2/3) */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!selectedCustomer ? (
          <Card className="flex flex-1 items-center justify-center py-3 border border-border ring-0 shadow-sm rounded-lg">
            <CardContent className="flex flex-col items-center text-center text-muted-foreground">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                <User className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">Select a customer</p>
              <p className="text-xs mt-1">Pick a customer on the left to see their orders and balance.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="py-4 border border-border ring-0 shadow-sm rounded-lg">
              <CardHeader className="px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-xl tracking-tight truncate">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                      {selectedCustomer.mobile_primary && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedCustomer.mobile_primary}
                        </span>
                      )}
                      {(selectedCustomer.shipping_city || selectedCustomer.shipping_pincode) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[selectedCustomer.shipping_city, selectedCustomer.shipping_pincode].filter(Boolean).join(" - ")}
                        </span>
                      )}
                      {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                    </CardDescription>
                  </div>
                  <Badge variant={selectedCustomer.is_active ? "default" : "secondary"}>
                    {selectedCustomer.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Orders</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{orderTotals.count}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total billed</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{formatINR(orderTotals.billed)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Paid</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-green-600">{formatINR(orderTotals.paid)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Balance due</p>
                    <p className={`mt-1 text-lg font-semibold tabular-nums ${orderTotals.due > 0 ? "text-red-600" : ""}`}>
                      {formatINR(orderTotals.due)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-3 flex-1 min-h-0 py-4 border border-border ring-0 shadow-sm rounded-lg">
              <CardHeader className="px-5">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Orders</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5">
                {ordersLoading ? (
                  <div className="flex items-center gap-2 py-6">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm text-muted-foreground">Loading orders...</span>
                  </div>
                ) : customerOrders.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">No orders found for this customer.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    <div className="grid grid-cols-[1.2fr_1fr_1fr_auto_auto] gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Order / Invoice</span>
                      <span>Date</span>
                      <span>Status</span>
                      <span className="text-right">Amount</span>
                      <span className="text-right">Payment</span>
                    </div>
                    {customerOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                        className="grid w-full grid-cols-[1.2fr_1fr_1fr_auto_auto] items-center gap-2 px-2 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs">{order.order_number}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {order.invoice_number_non_gst || order.invoice_number_gst || "No invoice yet"}
                          </span>
                        </span>
                        <span className="text-xs">{new Date(order.created_at).toLocaleDateString("en-IN")}</span>
                        <span>
                          <Badge
                            variant={
                              order.order_status === "delivered" ? "default" :
                              order.order_status === "cancelled" ? "destructive" : "secondary"
                            }
                          >
                            {order.order_status}
                          </Badge>
                        </span>
                        <span className="text-right font-medium tabular-nums">{formatINR(parseFloat(String(order.total_amount)) || 0)}</span>
                        <span className="text-right">
                          <Badge variant={order.payment_status === "completed" ? "default" : "outline"}>
                            {order.payment_status === "completed" ? "Paid" : "Due"}
                          </Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
