"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { MetricCard } from "@/components/panel/metric-card"
import { QuickActions } from "@/components/panel/quick-actions"
import { RecentActivity } from "@/components/panel/recent-activity"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Eye,
  FileText,
  Download,
  Truck,
  CreditCard,
  BarChart3,
  AlertCircle,
  DollarSign,
  Boxes,
  ClipboardList,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  PackageCheck,
  FileSignature,
  Receipt,
  Filter
} from "lucide-react"
import { format } from "date-fns"

interface DashboardMetrics {
  totalPurchaseOrders: number
  pendingOrders: number
  completedOrders: number
  totalSupplyValue: number
  monthlySupply: number
  outstandingPayment: number
  productsSupplied: number
  activeProducts: number
  avgDeliveryTime: number
  onTimeDeliveryRate: number
}

interface PurchaseOrder {
  id: string
  po_number: string
  order_date: string
  delivery_date: string
  total_amount: number
  status: 'pending' | 'approved' | 'in_transit' | 'delivered' | 'cancelled'
  payment_status: 'pending' | 'partial' | 'paid'
  items_count: number
}

interface SuppliedProduct {
  id: string
  name: string
  category: string
  unit_price: number
  quantity_supplied: number
  total_value: number
  last_supply_date: string
}

interface Payment {
  id: string
  invoice_number: string
  amount: number
  due_date: string
  status: 'pending' | 'partial' | 'paid' | 'overdue'
  po_number: string
}

export default function VendorPanel() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityName, entityDetails, loading: entityLoading, error: entityError } = useEntityData()

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPurchaseOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalSupplyValue: 0,
    monthlySupply: 0,
    outstandingPayment: 0,
    productsSupplied: 0,
    activeProducts: 0,
    avgDeliveryTime: 0,
    onTimeDeliveryRate: 0
  })

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [suppliedProducts, setSuppliedProducts] = useState<SuppliedProduct[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Check if user has vendor role
  useEffect(() => {
    if (!roleLoading && role !== 'vendors') {
      router.push('/dashboard')
    }
  }, [role, roleLoading, router])

  // Fetch dashboard data
  useEffect(() => {
    if (!entityId || entityLoading) return

    const fetchDashboardData = async () => {
      try {
        setLoading(true)

        // Fetch purchase orders from database
        const { data: purchasesData } = await supabase
          .from('purchases')
          .select('*')
          .eq('vendor_id', entityId)
          .order('created_at', { ascending: false })

        const fetchedPurchaseOrders: PurchaseOrder[] = (purchasesData || []).map((p: any) => ({
          id: p.id,
          po_number: p.purchase_number || `PO-${p.id.slice(0, 8)}`,
          order_date: p.created_at,
          delivery_date: p.expected_delivery_date || p.created_at,
          total_amount: p.total_amount || 0,
          status: p.purchase_status || 'pending',
          payment_status: p.payment_status || 'pending',
          items_count: 0 // Would need to fetch from purchase_items if needed
        }))
        setPurchaseOrders(fetchedPurchaseOrders)

        // Fetch vendor stock items (products this vendor supplies)
        const { data: vendorStockData } = await supabase
          .from('vendor_stock')
          .select(`
            id,
            vendor_price,
            stock_inventory!inner (
              id,
              product_variants!inner (
                variant_name,
                product_categories!inner (
                  name
                )
              ),
              packaging_materials!inner (
                name,
                price
              )
            )
          `)
          .eq('vendor_id', entityId)

        const fetchedProducts: SuppliedProduct[] = (vendorStockData || []).map((item: any) => ({
          id: item.id,
          name: `${item.stock_inventory.product_variants.variant_name} - ${item.stock_inventory.packaging_materials.name}`,
          category: item.stock_inventory.product_variants.product_categories.name,
          unit_price: item.vendor_price || item.stock_inventory.packaging_materials.price || 0,
          quantity_supplied: 0, // Would need purchase history to calculate
          total_value: 0, // Would need purchase history to calculate
          last_supply_date: new Date().toISOString() // Would need purchase history
        }))
        setSuppliedProducts(fetchedProducts)

        // Fetch payments/invoices from purchases
        const fetchedPayments: Payment[] = fetchedPurchaseOrders
          .filter(po => po.total_amount > 0)
          .map((po) => ({
            id: po.id,
            invoice_number: `INV-${po.id.slice(0, 8)}`,
            amount: po.total_amount,
            due_date: new Date(new Date(po.order_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from order
            status: po.payment_status as any,
            po_number: po.po_number
          }))
        setPayments(fetchedPayments)

        // Calculate metrics from real data
        const totalPurchaseOrders = fetchedPurchaseOrders.length
        const pendingOrders = fetchedPurchaseOrders.filter(po =>
          po.status === 'pending' || po.status === 'approved'
        ).length
        const completedOrders = fetchedPurchaseOrders.filter(po => po.status === 'delivered').length
        const totalSupplyValue = fetchedPurchaseOrders.reduce((sum, po) => sum + po.total_amount, 0)

        // Calculate monthly supply
        const now = new Date()
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthlySupply = fetchedPurchaseOrders
          .filter(po => {
            const orderDate = new Date(po.order_date)
            return orderDate >= currentMonthStart
          })
          .reduce((sum, po) => sum + po.total_amount, 0)

        // Calculate outstanding payments
        const outstandingPayment = fetchedPayments
          .filter(p => p.status === 'pending' || p.status === 'partial')
          .reduce((sum, p) => {
            if (p.status === 'partial') return sum + (p.amount * 0.5) // Assume 50% pending
            return sum + p.amount
          }, 0)

        const productsSupplied = fetchedProducts.length
        const activeProducts = productsSupplied // All products in vendor_stock are considered active

        // Create activities from real data
        const recentActivities: any[] = []

        // Add recent purchase orders to activities
        fetchedPurchaseOrders.slice(0, 3).forEach(po => {
          recentActivities.push({
            id: `po-${po.id}`,
            type: 'order' as const,
            title: po.status === 'pending' ? 'New PO received' : `PO ${po.status}`,
            description: `${po.po_number} for ₹${po.total_amount.toLocaleString()}`,
            timestamp: po.order_date,
            status: po.status === 'delivered' ? 'success' as const : 'info' as const
          })
        })

        // Add recent payments to activities
        fetchedPayments.filter(p => p.status === 'paid').slice(0, 2).forEach(payment => {
          recentActivities.push({
            id: `payment-${payment.id}`,
            type: 'payment' as const,
            title: 'Payment received',
            description: `₹${payment.amount.toLocaleString()} for ${payment.invoice_number}`,
            timestamp: payment.due_date,
            status: 'success' as const
          })
        })

        // Sort by timestamp
        recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setActivities(recentActivities.slice(0, 5))

        // Update metrics
        setMetrics({
          totalPurchaseOrders,
          pendingOrders,
          completedOrders,
          totalSupplyValue,
          monthlySupply,
          outstandingPayment,
          productsSupplied,
          activeProducts,
          avgDeliveryTime: 4.5, // days
          onTimeDeliveryRate: 92 // percentage
        })

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [entityId, entityLoading])

  const quickActions = [
    {
      title: "View POs",
      description: "Check purchase orders",
      icon: ClipboardList,
      href: "/dashboard/purchases"
    },
    {
      title: "Upload Invoice",
      description: "Submit new invoice",
      icon: FileSignature,
      onClick: () => console.log("Upload invoice")
    },
    {
      title: "Track Shipment",
      description: "Monitor deliveries",
      icon: Truck,
      onClick: () => console.log("Track shipment")
    },
    {
      title: "View Payments",
      description: "Payment history",
      icon: CreditCard,
      onClick: () => console.log("View payments")
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'paid':
        return 'default'
      case 'in_transit':
      case 'approved':
      case 'partial':
        return 'secondary'
      case 'pending':
        return 'outline'
      case 'cancelled':
      case 'overdue':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (roleLoading || entityLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (entityError) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Account Setup Required
            </CardTitle>
            <CardDescription>
              {entityError}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your user account is not linked to a vendor profile. Please contact your administrator to complete the setup.
            </p>
            <Button onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vendor Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {entityName}
        </p>
      </div>

      {/* Performance Metrics Bar */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-4">
              <Truck className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Delivery Performance</p>
                <div className="flex items-center gap-2">
                  <Progress value={metrics.onTimeDeliveryRate} className="w-20 h-2" />
                  <span className="text-xs text-green-700">{metrics.onTimeDeliveryRate}% on-time</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Clock className="h-6 w-6 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Avg Delivery Time</p>
                <p className="text-lg font-bold text-blue-700">{metrics.avgDeliveryTime} days</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <DollarSign className="h-6 w-6 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-900">Outstanding</p>
                <p className="text-lg font-bold text-orange-700">₹{metrics.outstandingPayment.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Supply Value"
          value={`₹${metrics.totalSupplyValue.toLocaleString()}`}
          description="All time"
          icon={TrendingUp}
        />
        <MetricCard
          title="Purchase Orders"
          value={metrics.totalPurchaseOrders}
          description={`${metrics.pendingOrders} pending`}
          icon={ShoppingCart}
          trend={{ value: 15, isPositive: true }}
        />
        <MetricCard
          title="This Month"
          value={`₹${metrics.monthlySupply.toLocaleString()}`}
          description="Supply value"
          icon={Calendar}
          trend={{ value: 22, isPositive: true }}
        />
        <MetricCard
          title="Products"
          value={metrics.productsSupplied}
          description={`${metrics.activeProducts} active`}
          icon={Package}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActions actions={quickActions} />
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <RecentActivity activities={activities} />
        </div>
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="shipments">Shipments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Purchase Orders</CardTitle>
                  <CardDescription>
                    Track and manage your purchase orders
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                  <Button>
                    <Eye className="mr-2 h-4 w-4" />
                    View All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.po_number}</TableCell>
                      <TableCell>{format(new Date(po.order_date), 'dd MMM')}</TableCell>
                      <TableCell>{format(new Date(po.delivery_date), 'dd MMM')}</TableCell>
                      <TableCell>{po.items_count}</TableCell>
                      <TableCell>₹{po.total_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(po.status)}>
                          {po.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(po.payment_status)}>
                          {po.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplied Products</CardTitle>
              <CardDescription>
                Products you supply to the company
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Qty Supplied</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Last Supply</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>₹{product.unit_price.toLocaleString()}</TableCell>
                      <TableCell>{product.quantity_supplied}</TableCell>
                      <TableCell>₹{product.total_value.toLocaleString()}</TableCell>
                      <TableCell>{format(new Date(product.last_supply_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payment Status</CardTitle>
                <CardDescription>
                  Track your invoice payments
                </CardDescription>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Paid: 1</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span>Pending: 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span>Partial: 1</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.invoice_number}</TableCell>
                      <TableCell>{payment.po_number}</TableCell>
                      <TableCell>₹{payment.amount.toLocaleString()}</TableCell>
                      <TableCell>{format(new Date(payment.due_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Shipments</CardTitle>
              <CardDescription>
                Track your ongoing deliveries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">PO-2024-002</p>
                        <p className="text-sm text-muted-foreground">35 items • Expected: {format(new Date('2024-01-25'), 'dd MMM')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-blue-500" />
                        <Badge variant="secondary">In Transit</Badge>
                      </div>
                    </div>
                    <Progress value={65} className="mt-3" />
                    <p className="text-xs text-muted-foreground mt-1">65% - Estimated arrival in 2 days</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">PO-2024-003</p>
                        <p className="text-sm text-muted-foreground">30 items • Expected: {format(new Date('2024-01-28'), 'dd MMM')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PackageCheck className="h-5 w-5 text-green-500" />
                        <Badge variant="secondary">Approved</Badge>
                      </div>
                    </div>
                    <Progress value={25} className="mt-3" />
                    <p className="text-xs text-muted-foreground mt-1">25% - Processing for dispatch</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
              <CardDescription>
                Download supply chain reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="cursor-pointer hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-5 w-5" />
                      Supply Report
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Monthly supply performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Receipt className="h-5 w-5" />
                      Payment Report
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Invoice and payment history
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Truck className="h-5 w-5" />
                      Delivery Report
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Shipment performance metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5" />
                      GST Report
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Tax compliance documents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}