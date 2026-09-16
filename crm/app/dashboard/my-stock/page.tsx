"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Warehouse, AlertCircle, Search, ShoppingCart, TrendingUp, DollarSign } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

type GodownInfo = {
  id: string
  name: string
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
  product_id: string | null
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price: number
  total: number
}

type StockItem = {
  id: string
  godown_name: string
  godown_id: string
  product_id: string
  product_name: string
  variant_name: string | null
  quantity: number
  available_quantity: number
  reserved_quantity: number
  price: number
}

export default function MyStockPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityType, entityName, entityDetails, loading: entityLoading, error: entityError } = useEntityData()
  const isRetailer = entityType === 'retailer'

  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [godowns, setGodowns] = useState<GodownInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedGodown, setSelectedGodown] = useState<string>("all")
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [salesByProduct, setSalesByProduct] = useState<Record<string, { amount: number; units: number }>>({})
  const [totalOrderValue, setTotalOrderValue] = useState(0)
  const [totalOrderQuantity, setTotalOrderQuantity] = useState(0)
  const [totalOrdersCount, setTotalOrdersCount] = useState(0)

  // Check if user has distributor or retailer role
  useEffect(() => {
    if (!roleLoading && role !== 'main_distributor' && role !== 'sub_distributor' && role !== 'retailer') {
      router.push('/dashboard')
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    if (entityId && !entityLoading) {
      fetchStock()
      fetchStockPurchases()
    }
  }, [entityId, entityLoading, isRetailer])

  const fetchStock = async () => {
    setLoading(true)

    // Fetch godowns for this distributor or retailer
    const scopeCol = isRetailer ? "retailer_id" : "distributor_id"
    const { data: godownData, error: godownError } = await supabase
      .from("godowns")
      .select("id, name")
      .eq(scopeCol, entityId)
      .eq("is_active", true)
      .order("name")

    if (godownError) {
      console.error("Error fetching godowns:", godownError)
      toast.error("Failed to fetch godowns")
      setLoading(false)
      return
    }

    setGodowns(godownData || [])
    const godownIds = (godownData || []).map(g => g.id)

    if (godownIds.length === 0) {
      setStockItems([])
      setLoading(false)
      return
    }

    // Fetch stock from all godowns
    const { data: stockData, error: stockError } = await supabase
      .from("godown_stock")
      .select(`
        id,
        godown_id,
        quantity,
        available_quantity,
        reserved_quantity,
        godowns!inner (
          id,
          name
        ),
        stock_inventory!inner (
          price,
          products (
            id,
            name
          ),
          product_variants (
            variant_name
          )
        )
      `)
      .in("godown_id", godownIds)
      .order("quantity", { ascending: false })

    if (stockError) {
      console.error("Error fetching stock:", stockError)
      toast.error("Failed to fetch stock data")
      setLoading(false)
      return
    }

    const items: StockItem[] = (stockData || []).map((item: any) => ({
      id: item.id,
      godown_id: item.godown_id,
      product_id: item.stock_inventory?.products?.id || "",
      godown_name: item.godowns?.name || "Unknown",
      product_name: item.stock_inventory?.products?.name || "Unknown Product",
      variant_name: item.stock_inventory?.product_variants?.variant_name || null,
      quantity: item.quantity || 0,
      available_quantity: item.available_quantity || 0,
      reserved_quantity: item.reserved_quantity || 0,
      price: parseFloat(item.stock_inventory?.price) || 0,
    }))

    setStockItems(items)
    setLoading(false)
  }

  const fetchStockPurchases = async () => {
    setOrdersLoading(true)

    const scopeColumn = isRetailer ? "retailer_id" : "distributor_id"
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
          product_id,
          product_name,
          product_sku,
          quantity,
          unit_price,
          total
        )
      `)
      .eq(scopeColumn, entityId)
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

      // Aggregate sales amount + units sold per product (from the orders we generate)
      const salesMap: Record<string, { amount: number; units: number }> = {}
      ordersWithItems.forEach(order => {
        order.items.forEach(item => {
          if (!item.product_id) return
          if (!salesMap[item.product_id]) {
            salesMap[item.product_id] = { amount: 0, units: 0 }
          }
          salesMap[item.product_id].amount += item.total || 0
          salesMap[item.product_id].units += item.quantity || 0
        })
      })
      setSalesByProduct(salesMap)

      const totalVal = ordersWithItems.reduce((sum, order) => sum + (order.total_amount || 0), 0)
      const totalQty = ordersWithItems.reduce((sum, order) =>
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)

      setTotalOrderValue(totalVal)
      setTotalOrderQuantity(totalQty)
      setTotalOrdersCount(ordersWithItems.length)
    }

    setOrdersLoading(false)
  }

  if (roleLoading || entityLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading stock data...</p>
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

  // Filter stock items
  const filteredItems = stockItems.filter(item => {
    const matchesSearch = searchTerm === "" ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.variant_name && item.variant_name.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGodown = selectedGodown === "all" || item.godown_id === selectedGodown
    return matchesSearch && matchesGodown
  })

  // Calculate summary stats from filtered items
  const totalItems = filteredItems.length
  const totalQuantity = filteredItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalAvailable = filteredItems.reduce((sum, item) => sum + (item.quantity - (salesByProduct[item.product_id]?.units || 0)), 0)
  const totalStockValue = filteredItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
  const lowStockItems = filteredItems.filter(item => item.quantity > 0 && item.quantity < 10).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">My Stock</h1>
            <p className="text-sm text-muted-foreground">
              {`Inventory across ${godowns.length} godown${godowns.length !== 1 ? 's' : ''} for ${entityName} ${entityDetails?.company_name ? `- ${entityDetails.company_name}` : ''}`}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inventory">Stock Inventory</TabsTrigger>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
        </TabsList>

        {/* Stock Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total SKUs</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">{totalItems}</div>
                <p className="text-xs text-muted-foreground mt-1">{lowStockItems} low stock</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Quantity</CardTitle>
                <Package className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">{totalQuantity.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground mt-1">{totalAvailable.toLocaleString('en-IN')} available</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Stock Value</CardTitle>
                <Package className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">₹{Math.abs(totalStockValue).toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Godowns</CardTitle>
                <Warehouse className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">{godowns.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedGodown} onValueChange={setSelectedGodown}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Godowns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Godowns</SelectItem>
                {godowns.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">Stock Inventory</CardTitle>
                <CardDescription className="text-sm">
                  {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} across your godowns
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Godown</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Sales Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No stock items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>
                          {item.variant_name ? (
                            <Badge variant="outline">{item.variant_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.godown_name}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={item.quantity < 0 ? "text-red-600 font-medium" : item.quantity < 10 && item.quantity > 0 ? "text-orange-600 font-medium" : "font-medium"}>
                            {item.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity - (salesByProduct[item.product_id]?.units || 0)}</TableCell>
                        <TableCell className="text-right">
                          {item.reserved_quantity > 0 ? (
                            <Badge variant="secondary">{item.reserved_quantity}</Badge>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell className="text-right">₹{item.price.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{(item.quantity * item.price).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right">
                          {salesByProduct[item.product_id] && salesByProduct[item.product_id].amount > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-emerald-600">
                                ₹{salesByProduct[item.product_id].amount.toLocaleString('en-IN')}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {salesByProduct[item.product_id].units} sold
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchase History Tab */}
        <TabsContent value="purchases" className="space-y-6">
          {/* Purchase Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">{totalOrdersCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Quantity</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">{totalOrderQuantity.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground mt-1">units purchased</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">₹{totalOrderValue.toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
                <Package className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold">
                  ₹{totalOrdersCount > 0 ? (totalOrderValue / totalOrdersCount).toFixed(0) : "0"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Purchase History</CardTitle>
              <CardDescription className="text-sm">
                Stock purchased by {entityName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading purchases...</p>
                  </div>
                </div>
              ) : (
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
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                            <TableCell>₹{order.total_amount.toLocaleString('en-IN')}</TableCell>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
