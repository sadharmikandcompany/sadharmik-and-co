"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Package, TrendingUp, DollarSign, ShoppingCart } from "lucide-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

type Distributor = {
  id: string
  name: string
  company_name: string
}

type OrderWithItems = {
  id: string
  order_number: string
  order_date: string
  order_status: string
  total_amount: number
  items: OrderItem[]
}

type OrderItem = {
  id: string
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price: number
  total: number
}

export default function DistributorStockPage() {
  const params = useParams()
  const router = useRouter()
  const distributorId = params.id as string

  const [distributor, setDistributor] = useState<Distributor | null>(null)
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [totalValue, setTotalValue] = useState(0)
  const [totalQuantity, setTotalQuantity] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)

  useEffect(() => {
    if (distributorId) {
      fetchDistributor()
      fetchStockPurchases()
    }
  }, [distributorId])

  const fetchDistributor = async () => {
    const { data, error } = await supabase
      .from("distributors")
      .select("id, name, company_name")
      .eq("id", distributorId)
      .single()

    if (error) {
      console.error("Error fetching distributor:", error)
      toast.error("Failed to fetch distributor details")
      router.push("/dashboard/distributors")
    } else {
      setDistributor(data)
    }
  }

  const fetchStockPurchases = async () => {
    setLoading(true)

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        order_date,
        order_status,
        total_amount,
        order_items (
          id,
          product_name,
          product_sku,
          quantity,
          unit_price,
          total
        )
      `)
      .eq("distributor_id", distributorId)
      .order("order_date", { ascending: false })

    if (orderError) {
      console.error("Error fetching orders:", orderError)
      toast.error("Failed to fetch stock purchases")
    } else {
      const ordersWithItems: OrderWithItems[] = (orderData || []).map(order => ({
        ...order,
        items: Array.isArray(order.order_items) ? order.order_items : []
      }))

      setOrders(ordersWithItems)

      // Calculate totals
      const totalVal = ordersWithItems.reduce((sum, order) => sum + (order.total_amount || 0), 0)
      const totalQty = ordersWithItems.reduce((sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)

      setTotalValue(totalVal)
      setTotalQuantity(totalQty)
      setTotalOrders(ordersWithItems.length)
    }

    setLoading(false)
  }

  if (loading || !distributor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(`/dashboard/distributors/${distributorId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(`/dashboard/distributors/${distributorId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Stock Purchases</h1>
            <p className="text-muted-foreground">
              {distributor.name} - {distributor.company_name}
            </p>
          </div>
        </div>
        <Link href="/dashboard/distributor-stock">
          <Button variant="outline">
            View All Distributor Stock
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity}</div>
            <p className="text-xs text-muted-foreground">units purchased</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{totalOrders > 0 ? (totalValue / totalOrders).toFixed(0) : "0"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
          <CardDescription>
            Stock purchased by {distributor.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No purchase history found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        {new Date(order.order_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {order.items.slice(0, 2).map(item => (
                            <span key={item.id} className="text-sm">
                              {item.product_name}
                            </span>
                          ))}
                          {order.items.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{order.items.length - 2} more
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </TableCell>
                      <TableCell>₹{order.total_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.order_status === "delivered"
                              ? "default"
                              : order.order_status === "cancelled"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {order.order_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
