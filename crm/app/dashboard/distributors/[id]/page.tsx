"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Package, MapPin, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

type Distributor = {
  id: string
  name: string
  email: string
  phone_primary: string
  company_name: string
  gst_number: string
  serviceable_pincodes: string[] | null
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  is_active: boolean
  is_verified: boolean
}

type DistributorListItem = {
  id: string
  name: string
  company_name: string
  is_verified: boolean
}

type Order = {
  id: string
  order_number: string
  customer_id: string | null
  distributor_id: string | null
  order_status: string
  payment_status: string
  shipping_pincode: string | null
  shipping_city: string | null
  shipping_state: string | null
  total_amount: number
  order_date: string
  created_at: string
}

export default function DistributorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const distributorId = params.id as string

  const [distributor, setDistributor] = useState<Distributor | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [allDistributors, setAllDistributors] = useState<DistributorListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchDistributor()
    fetchAllDistributors()
  }, [distributorId])

  useEffect(() => {
    if (distributor) {
      fetchOrders()
    }
  }, [distributor])

  const fetchDistributor = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("distributors")
      .select("*")
      .eq("id", distributorId)
      .single()

    if (error) {
      console.error("Error fetching distributor:", error)
    } else {
      setDistributor(data)
    }
    setLoading(false)
  }

  const fetchAllDistributors = async () => {
    const { data, error } = await supabase
      .from("distributors")
      .select("id, name, company_name, is_verified")
      .eq("is_verified", true)
      .order("name")

    if (error) {
      console.error("Error fetching distributors:", error)
    } else {
      setAllDistributors(data || [])
    }
  }

  const fetchOrders = async () => {
    if (!distributor) return

    setOrdersLoading(true)

    // Get serviceable pincodes from distributor
    const pincodes = distributor.serviceable_pincodes || []

    if (pincodes.length === 0) {
      setOrders([])
      setOrdersLoading(false)
      return
    }

    // Fetch orders where shipping_pincode matches any of the serviceable pincodes
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("shipping_pincode", pincodes)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching orders:", error)
    } else {
      setOrders(data || [])
    }
    setOrdersLoading(false)
  }

  const handleDistributorChange = (newDistributorId: string) => {
    router.push(`/dashboard/distributors/${newDistributorId}`)
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shipping_pincode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shipping_city?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || order.order_status === statusFilter

    return matchesSearch && matchesStatus
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "secondary",
      processing: "default",
      shipped: "default",
      delivered: "default",
      cancelled: "destructive",
    }
    return statusMap[status] || "secondary"
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Loading...</h1>
      </div>
    )
  }

  if (!distributor) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Distributor not found</h1>
        <Link href="/dashboard/distributors">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Distributors
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/distributors">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Distributor Details</h1>
          <p className="text-muted-foreground">View orders from serviceable pincodes</p>
        </div>
      </div>

      {/* Distributor Switcher and Information */}
      <Card>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Side - Distributor Switcher */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="distributor-select">Switch Distributor</Label>
                <Select value={distributorId} onValueChange={handleDistributorChange}>
                  <SelectTrigger id="distributor-select">
                    <SelectValue placeholder="Select a distributor" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDistributors.map((dist) => (
                      <SelectItem key={dist.id} value={dist.id}>
                        {dist.name} - {dist.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right Side - Distributor Details */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-lg font-semibold">{distributor.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Company</p>
                <p className="text-base">{distributor.company_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{distributor.phone_primary}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant={distributor.is_active ? "default" : "secondary"}>
                  {distributor.is_active ? "Active" : "Inactive"}
                </Badge>
                {distributor.is_verified && <Badge variant="outline">Verified</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Serviceable Pincodes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Serviceable Pincodes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {distributor.serviceable_pincodes && distributor.serviceable_pincodes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Total: {distributor.serviceable_pincodes.length} pincodes
              </p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {distributor.serviceable_pincodes.map((pincode) => (
                  <Badge key={pincode} variant="secondary">
                    {pincode}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No serviceable pincodes configured</p>
          )}
        </CardContent>
      </Card>

      {/* Orders Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orders from Serviceable Pincodes</CardTitle>
              <CardDescription>
                Orders with shipping addresses in the distributor's service area
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg">
              {filteredOrders.length} Orders
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by order number, pincode, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders Table */}
          {ordersLoading ? (
            <p className="text-center py-8">Loading orders...</p>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {orders.length === 0 ? (
                <div>
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No orders found for the serviceable pincodes</p>
                  <p className="text-sm mt-2">
                    {distributor.serviceable_pincodes?.length === 0
                      ? "This distributor has no serviceable pincodes configured"
                      : "Orders will appear here when customers place orders in the service area"}
                  </p>
                </div>
              ) : (
                <p>No orders match your search criteria</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Shipping Location</TableHead>
                    <TableHead>Pincode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="hover:underline text-primary"
                        >
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(order.order_date || order.created_at)}</TableCell>
                      <TableCell>
                        {order.shipping_city}, {order.shipping_state}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.shipping_pincode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(order.order_status) as any}>
                          {order.order_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.payment_status === "paid" ? "default" : "secondary"
                          }
                        >
                          {order.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(order.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
