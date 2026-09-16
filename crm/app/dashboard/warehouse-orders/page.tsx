"use client"

import React, { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Warehouse,
  Package,
  ExternalLink,
  MapPin,
  ArrowLeft,
  Eye,
  IndianRupee,
  CreditCard,
  Banknote,
  Smartphone,
  DollarSign,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  User,
  Search,
  Download,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ExportButtons } from "@/components/export-buttons"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"

type Godown = {
  id: string
  name: string
  godown_code: string
  godown_type: string
  city: string | null
  state: string | null
  pincode: string | null
  manager_name: string | null
  manager_phone: string | null
  is_active: boolean
}

type OrderItem = {
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

type Order = {
  id: string
  order_number: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  customer_full_name: string | null
  order_status: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  cod_amount: number | null
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  shipping_full_address: string | null
  is_priority: boolean
  order_date: string
  created_at: string
  source_godown_id: string | null
  delivery_partner_name: string | null
  delivery_partner_id: string | null
  invoice_number_gst: string | null
  invoice_number_non_gst: string | null
  order_items: OrderItem[]
  delivery_status: string | null
}

type WarehouseSummary = {
  warehouse: Godown
  orderCount: number
  totalAmount: number
}

type WarehouseTransaction = {
  id: string
  bank_account_id: string
  bank_name?: string
  txn_date: string
  amount: number
  txn_type: string
  description: string | null
  reference: string | null
  status: string
  created_at?: string
}

export default function WarehouseOrdersPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityDetails, loading: entityLoading } = useEntityData()
  const isDistributor = role === 'main_distributor' || role === 'sub_distributor'
  const isMainDistributor = role === 'main_distributor'
  const isSubDistributor = role === 'sub_distributor'

  const [warehouses, setWarehouses] = useState<Godown[]>([])
  const [warehouseSummaries, setWarehouseSummaries] = useState<WarehouseSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)

  // Expanded warehouse detail state
  const [selectedWarehouse, setSelectedWarehouse] = useState<Godown | null>(null)
  const [warehouseTxns, setWarehouseTxns] = useState<WarehouseTransaction[]>([])
  const [loadingTxns, setLoadingTxns] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<string>("all")
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (isDistributor && (entityLoading || !entityId)) return
    fetchWarehousesAndSummaries()
  }, [role, entityId, entityLoading])

  const fetchWarehousesAndSummaries = async () => {
    try {
      setLoadingList(true)

      // Pre-fetch distributor data for filtering
      let distributorPincodes: string[] = []
      let distributorRetailerIds: string[] = []
      let subDistributorIds: string[] = []

      if (isDistributor && entityId) {
        distributorPincodes = entityDetails?.serviceable_pincodes || []
        const { data: retailers } = await supabase
          .from('retailers').select('id').eq('distributor_id', entityId)
        distributorRetailerIds = (retailers || []).map((r: any) => r.id)

        if (isMainDistributor) {
          const { data: subDists } = await supabase
            .from('distributors').select('id').eq('parent_id', entityId)
          subDistributorIds = (subDists || []).map((d: any) => d.id)
        }
      }

      const { data: warehousesData, error: warehousesError } = await supabase
        .from("godowns")
        .select("id, name, godown_code, godown_type, city, state, pincode, manager_name, manager_phone, is_active")
        .eq("is_active", true)
        .order("name")

      if (warehousesError) throw warehousesError
      setWarehouses(warehousesData || [])

      // Get order counts per warehouse
      let ordersQuery = supabase
        .from("orders")
        .select("source_godown_id, total_amount")
        .not("source_godown_id", "is", null)

      // Distributor filtering
      if (isDistributor && entityId) {
        if (isSubDistributor) {
          const filterParts: string[] = []
          if (distributorPincodes.length > 0) {
            filterParts.push(`shipping_pincode.in.(${distributorPincodes.join(',')})`)
          }
          if (distributorRetailerIds.length > 0) {
            filterParts.push(`retailer_id.in.(${distributorRetailerIds.join(',')})`)
          }
          if (filterParts.length > 0) {
            ordersQuery = ordersQuery.or(filterParts.join(','))
          }
          ordersQuery = ordersQuery.is("distributor_id", null)
        } else {
          const filterParts: string[] = []
          if (distributorPincodes.length > 0) {
            filterParts.push(`shipping_pincode.in.(${distributorPincodes.join(',')})`)
          }
          if (distributorRetailerIds.length > 0) {
            filterParts.push(`retailer_id.in.(${distributorRetailerIds.join(',')})`)
          }
          filterParts.push(`distributor_id.eq.${entityId}`)
          if (subDistributorIds.length > 0) {
            filterParts.push(`distributor_id.in.(${subDistributorIds.join(',')})`)
          }
          if (filterParts.length > 0) {
            ordersQuery = ordersQuery.or(filterParts.join(','))
          }
        }
      }

      const { data: ordersData, error: ordersError } = await ordersQuery

      if (ordersError) throw ordersError

      // Build summaries
      const summaryMap = new Map<string, { count: number; total: number }>()
      ordersData?.forEach((order: any) => {
        const existing = summaryMap.get(order.source_godown_id) || { count: 0, total: 0 }
        existing.count += 1
        existing.total += order.total_amount || 0
        summaryMap.set(order.source_godown_id, existing)
      })

      const summaries: WarehouseSummary[] = (warehousesData || [])
        .map((warehouse) => {
          const summary = summaryMap.get(warehouse.id) || { count: 0, total: 0 }
          return {
            warehouse,
            orderCount: summary.count,
            totalAmount: summary.total,
          }
        })
        .filter((s) => !isDistributor || s.orderCount > 0)
        .sort((a, b) => b.orderCount - a.orderCount)

      setWarehouseSummaries(summaries)
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch warehouses")
    } finally {
      setLoadingList(false)
    }
  }

  const handleOpenWarehouse = async (warehouse: Godown) => {
    setSelectedWarehouse(warehouse)
    setOrders([])
    setWarehouseTxns([])
    setSearchTerm("")
    setActiveTab("all")
    const tasks = [fetchOrdersForWarehouse(warehouse.id)]
    if (!isDistributor) tasks.push(fetchWarehouseTransactions(warehouse.id))
    await Promise.all(tasks)
  }

  const handleBackToList = () => {
    setSelectedWarehouse(null)
    setOrders([])
    setWarehouseTxns([])
    setSearchTerm("")
    setActiveTab("all")
  }

  const fetchWarehouseTransactions = async (warehouseId: string) => {
    setLoadingTxns(true)
    try {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .like("reference", `GODOWN:${warehouseId}%`)
        .order("txn_date", { ascending: false })

      if (error) throw error

      // Fetch bank account names for display
      const accountIds = [...new Set((data || []).map((t: any) => t.bank_account_id))]
      let accountsMap = new Map<string, string>()

      if (accountIds.length > 0) {
        const { data: accounts } = await supabase
          .from("bank_accounts")
          .select("id, bank_name")
          .in("id", accountIds)

        accounts?.forEach((a: any) => accountsMap.set(a.id, a.bank_name))
      }

      const txnsWithNames = (data || []).map((t: any) => ({
        ...t,
        bank_name: accountsMap.get(t.bank_account_id) || "Unknown",
      }))

      setWarehouseTxns(txnsWithNames)
    } catch (error: any) {
      console.error("Error fetching warehouse transactions:", error)
    } finally {
      setLoadingTxns(false)
    }
  }

  const fetchOrdersForWarehouse = async (warehouseId: string) => {
    setLoadingOrders(true)
    try {
      // Pre-fetch distributor data for filtering
      let distributorPincodes: string[] = []
      let distributorRetailerIds: string[] = []
      let subDistributorIds: string[] = []

      if (isDistributor && entityId) {
        distributorPincodes = entityDetails?.serviceable_pincodes || []
        const { data: retailers } = await supabase
          .from('retailers').select('id').eq('distributor_id', entityId)
        distributorRetailerIds = (retailers || []).map((r: any) => r.id)

        if (isMainDistributor) {
          const { data: subDists } = await supabase
            .from('distributors').select('id').eq('parent_id', entityId)
          subDistributorIds = (subDists || []).map((d: any) => d.id)
        }
      }

      let query = supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_id,
          customer_full_name,
          order_status,
          payment_status,
          payment_method,
          total_amount,
          cod_amount,
          shipping_city,
          shipping_state,
          shipping_pincode,
          shipping_full_address,
          is_priority,
          order_date,
          created_at,
          source_godown_id,
          delivery_partner_id,
          invoice_number_gst,
          invoice_number_non_gst,
          delivery_status,
          order_items(
            product_name,
            quantity,
            unit_price,
            total
          )
        `)
        .eq("source_godown_id", warehouseId)
        .order("created_at", { ascending: false })

      // Distributor filtering
      if (isDistributor && entityId) {
        if (isSubDistributor) {
          const filterParts: string[] = []
          if (distributorPincodes.length > 0) {
            filterParts.push(`shipping_pincode.in.(${distributorPincodes.join(',')})`)
          }
          if (distributorRetailerIds.length > 0) {
            filterParts.push(`retailer_id.in.(${distributorRetailerIds.join(',')})`)
          }
          if (filterParts.length > 0) {
            query = query.or(filterParts.join(','))
          }
          query = query.is("distributor_id", null)
        } else {
          const filterParts: string[] = []
          if (distributorPincodes.length > 0) {
            filterParts.push(`shipping_pincode.in.(${distributorPincodes.join(',')})`)
          }
          if (distributorRetailerIds.length > 0) {
            filterParts.push(`retailer_id.in.(${distributorRetailerIds.join(',')})`)
          }
          filterParts.push(`distributor_id.eq.${entityId}`)
          if (subDistributorIds.length > 0) {
            filterParts.push(`distributor_id.in.(${subDistributorIds.join(',')})`)
          }
          if (filterParts.length > 0) {
            query = query.or(filterParts.join(','))
          }
        }
      }

      const { data: ordersData, error: ordersError } = await query

      if (ordersError) throw ordersError

      if (!ordersData || ordersData.length === 0) {
        setOrders([])
        setLoadingOrders(false)
        return
      }

      // Fetch customer and delivery partner data in chunks
      const customerIds = [...new Set(
        ordersData.filter((o: any) => o.customer_id).map((o: any) => o.customer_id)
      )]
      const deliveryPartnerIds = [...new Set(
        ordersData.filter((o: any) => o.delivery_partner_id).map((o: any) => o.delivery_partner_id)
      )]

      const chunkArray = <T,>(array: T[], size: number): T[][] => {
        const chunks: T[][] = []
        for (let i = 0; i < array.length; i += size) {
          chunks.push(array.slice(i, i + size))
        }
        return chunks
      }

      const CHUNK_SIZE = 100

      const [customerResults, dpResults] = await Promise.all([
        customerIds.length > 0
          ? Promise.all(
              chunkArray(customerIds, CHUNK_SIZE).map((chunk) =>
                supabase
                  .from("customers")
                  .select("id, first_name, last_name, mobile_primary")
                  .in("id", chunk)
              )
            )
          : Promise.resolve([]),
        deliveryPartnerIds.length > 0
          ? Promise.all(
              chunkArray(deliveryPartnerIds, CHUNK_SIZE).map((chunk) =>
                supabase
                  .from("delivery_partners")
                  .select("id, name")
                  .in("id", chunk)
              )
            )
          : Promise.resolve([]),
      ])

      const customersMap = new Map<string, any>()
      customerResults.forEach((result) => {
        if (result.data) {
          result.data.forEach((c: any) => customersMap.set(c.id, c))
        }
      })

      const dpMap = new Map<string, any>()
      dpResults.forEach((result) => {
        if (result.data) {
          result.data.forEach((dp: any) => dpMap.set(dp.id, dp))
        }
      })

      const ordersWithDetails = ordersData.map((order: any) => {
        let customer_name = order.customer_full_name || "Unknown"
        let customer_phone = ""

        if (order.customer_id) {
          const customer = customersMap.get(order.customer_id)
          if (customer) {
            customer_name = `${customer.first_name} ${customer.last_name}`.trim()
            customer_phone = customer.mobile_primary || ""
          }
        }

        const dp = order.delivery_partner_id ? dpMap.get(order.delivery_partner_id) : undefined

        return {
          ...order,
          customer_name,
          customer_phone,
          delivery_partner_name: dp?.name || null,
          order_items: order.order_items || [],
        }
      })

      // Sort: oldest order_date first (backlog at top)
      ordersWithDetails.sort((a: Order, b: Order) => {
        const dateA = new Date(a.order_date || a.created_at).getTime()
        const dateB = new Date(b.order_date || b.created_at).getTime()
        return dateA - dateB
      })

      setOrders(ordersWithDetails)
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch orders")
    } finally {
      setLoadingOrders(false)
    }
  }

  // Filter orders based on search and tab
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_phone && order.customer_phone.includes(searchTerm))

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "pending" && (order.order_status.toLowerCase() === "pending" || order.order_status.toLowerCase() === "processing")) ||
      (activeTab === "delivered" && (order.order_status.toLowerCase() === "delivered" || order.order_status.toLowerCase() === "completed")) ||
      (activeTab === "cancelled" && order.order_status.toLowerCase() === "cancelled") ||
      (activeTab === "failed" && order.order_status.toLowerCase() === "failed")

    return matchesSearch && matchesTab
  })

  // Calculate totals for selected warehouse orders
  const calculateTotals = () => {
    const totalOrders = orders.length
    const deliveredOrders = orders.filter(
      (o) => o.order_status.toLowerCase() === "delivered" || o.order_status.toLowerCase() === "completed"
    )
    const pendingOrders = orders.filter((o) => o.order_status.toLowerCase() === "pending" || o.order_status.toLowerCase() === "processing")
    const cancelledOrders = orders.filter((o) => o.order_status.toLowerCase() === "cancelled")
    const failedOrders = orders.filter((o) => o.order_status.toLowerCase() === "failed")

    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0)

    // Payment method breakdown
    const expectedByMethod: Record<string, number> = {}
    const expectedCountByMethod: Record<string, number> = {}

    orders.forEach((o) => {
      const method = (o.payment_method || "unknown").toLowerCase()
      const amount = o.cod_amount || o.total_amount
      expectedByMethod[method] = (expectedByMethod[method] || 0) + amount
      expectedCountByMethod[method] = (expectedCountByMethod[method] || 0) + 1
    })

    const paidOrders = orders.filter((o) => o.payment_status?.toLowerCase() === "completed" || o.payment_status?.toLowerCase() === "paid")
    const unpaidOrders = orders.filter((o) => o.payment_status?.toLowerCase() !== "completed" && o.payment_status?.toLowerCase() !== "paid")

    return {
      totalOrders,
      deliveredCount: deliveredOrders.length,
      pendingCount: pendingOrders.length,
      cancelledCount: cancelledOrders.length,
      failedCount: failedOrders.length,
      totalAmount,
      paidCount: paidOrders.length,
      unpaidCount: unpaidOrders.length,
      paidAmount: paidOrders.reduce((sum, o) => sum + o.total_amount, 0),
      unpaidAmount: unpaidOrders.reduce((sum, o) => sum + o.total_amount, 0),
      expectedByMethod,
      expectedCountByMethod,
    }
  }

  const totals = selectedWarehouse ? calculateTotals() : null

  const getStatusVariant = (status: string) => {
    const s = status.toLowerCase()
    if (s === "completed" || s === "delivered" || s === "paid") return "default" as const
    if (s === "pending" || s === "processing") return "outline" as const
    if (s === "cancelled" || s === "failed") return "destructive" as const
    return "secondary" as const
  }

  // Export
  const exportData = filteredOrders.map((order) => ({
    "Order Number": order.order_number,
    Customer: order.customer_name,
    Phone: order.customer_phone || "",
    "Order Status": order.order_status,
    "Payment Status": order.payment_status,
    "Payment Method": order.payment_method || "N/A",
    Amount: `₹${order.total_amount.toFixed(2)}`,
    Priority: order.is_priority ? "Yes" : "No",
    "Order Date": format(new Date(order.order_date || order.created_at), "PPP"),
    "Delivery Partner": order.delivery_partner_name || "Not assigned",
    City: order.shipping_city || "",
  }))

  const exportColumns = [
    { header: "Order #", dataKey: "Order Number" },
    { header: "Customer", dataKey: "Customer" },
    { header: "Phone", dataKey: "Phone" },
    { header: "Status", dataKey: "Order Status" },
    { header: "Payment", dataKey: "Payment Status" },
    { header: "Amount", dataKey: "Amount" },
    { header: "Date", dataKey: "Order Date" },
    { header: "Delivery Partner", dataKey: "Delivery Partner" },
  ]

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error("No orders to export")
      return
    }
    try {
      const headers = [
        "Order Number", "Customer", "Phone", "Order Status", "Payment Status",
        "Payment Method", "Amount", "Order Date", "Delivery Partner", "City", "Address"
      ]
      const rows = filteredOrders.map((order) => [
        order.order_number,
        order.customer_name,
        order.customer_phone || "-",
        order.order_status,
        order.payment_status,
        order.payment_method || "N/A",
        order.total_amount.toFixed(2),
        format(new Date(order.order_date || order.created_at), "PPP"),
        order.delivery_partner_name || "Not assigned",
        order.shipping_city || "",
        order.shipping_full_address || "",
      ])
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))
      ].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `warehouse-orders_${selectedWarehouse?.name || "warehouse"}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("Report exported successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to export report")
    }
  }

  // =============================================
  // VIEW: Warehouse List (default view)
  // =============================================
  if (!selectedWarehouse) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/orders")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Warehouse Orders</h1>
              <p className="text-muted-foreground mt-1">
                Select a warehouse to view its orders
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Warehouses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warehouseSummaries.filter((s) => s.orderCount > 0).length}</div>
              <p className="text-xs text-muted-foreground">{warehouses.length} total active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {warehouseSummaries.reduce((sum, s) => sum + s.orderCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Across all warehouses</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{warehouseSummaries.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">All warehouse orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Warehouse Cards */}
        {loadingList ? (
          <div className="text-center py-10 text-muted-foreground">Loading warehouses...</div>
        ) : (
          <div className="grid gap-4">
            {warehouseSummaries.map((summary) => (
              <Card
                key={summary.warehouse.id}
                className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/50"
                onClick={() => handleOpenWarehouse(summary.warehouse)}
              >
                <div className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Warehouse className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{summary.warehouse.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="font-mono">{summary.warehouse.godown_code}</span>
                        <span>·</span>
                        <Badge variant="outline" className="capitalize">
                          {summary.warehouse.godown_type}
                        </Badge>
                        {summary.warehouse.city && (
                          <>
                            <span>·</span>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {summary.warehouse.city}
                                {summary.warehouse.state ? `, ${summary.warehouse.state}` : ""}
                              </span>
                            </div>
                          </>
                        )}
                        {summary.warehouse.manager_name && (
                          <>
                            <span>·</span>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{summary.warehouse.manager_name}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-2xl font-bold">{summary.orderCount}</div>
                      <div className="text-sm text-muted-foreground">Orders</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">₹{summary.totalAmount.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            ))}

            {warehouseSummaries.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                No warehouses found
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // =============================================
  // VIEW: Warehouse Detail (when a card is clicked)
  // =============================================
  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{selectedWarehouse.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="font-mono">{selectedWarehouse.godown_code}</span>
              <span>·</span>
              <Badge variant="outline" className="capitalize">
                {selectedWarehouse.godown_type}
              </Badge>
              {selectedWarehouse.city && (
                <>
                  <span>·</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{selectedWarehouse.city}{selectedWarehouse.state ? `, ${selectedWarehouse.state}` : ""}</span>
                  </div>
                </>
              )}
              {selectedWarehouse.manager_name && (
                <>
                  <span>·</span>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>Manager: {selectedWarehouse.manager_name}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {totals && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totals.deliveredCount}</div>
              {totals.totalOrders > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  of {totals.totalOrders} orders
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{totals.pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelled / Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {totals.cancelledCount + totals.failedCount}
              </div>
              {(totals.cancelledCount > 0 || totals.failedCount > 0) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.cancelledCount} cancelled · {totals.failedCount} failed
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totals.totalAmount.toFixed(2)}</div>
              <div className="space-y-0.5 mt-2">
                {Object.entries(totals.expectedByMethod).map(([method, amount]) => (
                  <div key={method} className="text-xs flex justify-between text-muted-foreground">
                    <span className="capitalize">{method}:</span>
                    <span>₹{amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Orders Table with Tabs */}
      {totals && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="all" className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              All ({totals.totalOrders})
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Pending ({totals.pendingCount})
            </TabsTrigger>
            <TabsTrigger value="delivered" className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              Delivered ({totals.deliveredCount})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Cancelled ({totals.cancelledCount})
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Failed ({totals.failedCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Orders</CardTitle>
                    <CardDescription>
                      All orders from {selectedWarehouse.name}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <ExportButtons
                      data={exportData}
                      filename={`warehouse-orders_${selectedWarehouse.name}`}
                      columns={exportColumns}
                      pdfTitle={`Warehouse Orders - ${selectedWarehouse.name}`}
                    />
                    <Button variant="outline" onClick={handleExportCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order #, customer name, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Order #</TableHead>
                        <TableHead className="w-[110px]">Order Date</TableHead>
                        <TableHead className="min-w-[150px]">Customer</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[120px]">Payment</TableHead>
                        <TableHead className="min-w-[100px]">Amount</TableHead>
                        <TableHead className="min-w-[120px]">Delivery Partner</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingOrders ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            Loading orders...
                          </TableCell>
                        </TableRow>
                      ) : filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            No orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Link
                                href={`/dashboard/orders/${order.id}/edit`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                {order.order_number}
                              </Link>
                              {(order.invoice_number_gst || order.invoice_number_non_gst) && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {order.invoice_number_gst || order.invoice_number_non_gst}
                                </div>
                              )}
                              {order.is_priority && (
                                <Badge variant="destructive" className="text-xs mt-1">
                                  Priority
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {order.order_date
                                  ? new Date(order.order_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                  : "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{order.customer_name}</div>
                                {order.customer_phone && (
                                  <div className="text-sm text-muted-foreground">
                                    {order.customer_phone}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(order.order_status)}>
                                {order.order_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <Badge variant={getStatusVariant(order.payment_status)}>
                                  {order.payment_status}
                                </Badge>
                                <div className="text-xs text-muted-foreground mt-1 capitalize">
                                  {order.payment_method || "Not set"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">₹{order.total_amount.toFixed(2)}</span>
                            </TableCell>
                            <TableCell>
                              {order.delivery_partner_name ? (
                                <span className="text-sm">{order.delivery_partner_name}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Not assigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setShowDetailsDialog(true)
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Summary Footer */}
                {filteredOrders.length > 0 && (
                  <div className="border-t p-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground">Total Orders</div>
                        <div className="text-xl font-bold">{filteredOrders.length}</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-sm text-green-700 dark:text-green-300">Delivered</div>
                        <div className="text-xl font-bold text-green-600">
                          {filteredOrders.filter((o) => o.order_status.toLowerCase() === "delivered" || o.order_status.toLowerCase() === "completed").length}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">Pending</div>
                        <div className="text-xl font-bold text-yellow-600">
                          {filteredOrders.filter((o) => o.order_status.toLowerCase() === "pending" || o.order_status.toLowerCase() === "processing").length}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-sm text-red-700 dark:text-red-300">Cancelled / Failed</div>
                        <div className="text-xl font-bold text-red-600">
                          {filteredOrders.filter((o) => o.order_status.toLowerCase() === "cancelled" || o.order_status.toLowerCase() === "failed").length}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground">Total Value</div>
                        <div className="text-xl font-bold">
                          ₹{filteredOrders.reduce((sum, o) => sum + o.total_amount, 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Payment Method Summary */}
      {totals && orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Summary by Method
            </CardTitle>
            <CardDescription>
              Order amounts by payment method from {selectedWarehouse.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* Cash / COD */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full">
                    <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100">Cash / COD</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Orders:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      {(totals.expectedCountByMethod["cash"] || 0) + (totals.expectedCountByMethod["cod"] || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Amount:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      ₹{((totals.expectedByMethod["cash"] || 0) + (totals.expectedByMethod["cod"] || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* UPI */}
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-full">
                    <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100">UPI</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-700 dark:text-purple-300">Orders:</span>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      {totals.expectedCountByMethod["upi"] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700 dark:text-purple-300">Amount:</span>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      ₹{(totals.expectedByMethod["upi"] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full">
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Card</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Orders:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {totals.expectedCountByMethod["card"] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Amount:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      ₹{(totals.expectedByMethod["card"] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Online / Bank */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-800 rounded-full">
                    <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-orange-900 dark:text-orange-100">Online / Bank</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Orders:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">
                      {(totals.expectedCountByMethod["online"] || 0) + (totals.expectedCountByMethod["bank"] || 0) + (totals.expectedCountByMethod["bank_transfer"] || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Amount:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">
                      ₹{((totals.expectedByMethod["online"] || 0) + (totals.expectedByMethod["bank"] || 0) + (totals.expectedByMethod["bank_transfer"] || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-full">
                    <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100">Balance</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-700 dark:text-amber-300">Orders:</span>
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      {totals.expectedCountByMethod["balance"] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700 dark:text-amber-300">Amount:</span>
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      ₹{(totals.expectedByMethod["balance"] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="mt-6 bg-muted p-4 rounded-lg">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Orders</div>
                  <div className="text-2xl font-bold">{totals.totalOrders}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="text-2xl font-bold">₹{totals.totalAmount.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Paid / Unpaid</div>
                  <div className="text-2xl font-bold">
                    <span className="text-green-600">₹{totals.paidAmount.toFixed(2)}</span>
                    <span className="text-muted-foreground text-base mx-1">/</span>
                    <span className="text-red-600">₹{totals.unpaidAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Section (admin/warehouse only) */}
      {selectedWarehouse && !isDistributor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Transactions
            </CardTitle>
            <CardDescription>
              Bank and cash transactions recorded for {selectedWarehouse.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTxns ? (
              <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
            ) : warehouseTxns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions recorded for this distributor yet.
                <br />
                <span className="text-xs">Create transactions from the Reconciliation page.</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[110px]">Date</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="w-[100px] text-right">Debit</TableHead>
                        <TableHead className="w-[100px] text-right">Credit</TableHead>
                        <TableHead className="w-[90px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouseTxns.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-sm">
                            {new Date(txn.txn_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{txn.bank_name}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{txn.description || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-muted-foreground">
                              {txn.reference?.replace(`GODOWN:${selectedWarehouse.id}`, "").replace(/^[-:]/, "") || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {txn.txn_type === "Dr" ? (
                              <span className="text-sm font-medium text-red-600 flex items-center justify-end gap-1">
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                ₹{txn.amount.toFixed(2)}
                              </span>
                            ) : <span className="text-sm text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {txn.txn_type === "Cr" ? (
                              <span className="text-sm font-medium text-green-600 flex items-center justify-end gap-1">
                                <ArrowDownRight className="h-3.5 w-3.5" />
                                ₹{txn.amount.toFixed(2)}
                              </span>
                            ) : <span className="text-sm text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={txn.status === "matched" ? "default" : txn.status === "ignored" ? "secondary" : "outline"}>
                              {txn.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Transaction Totals */}
                <div className="border-t mt-4 pt-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground">Total Transactions</div>
                      <div className="text-xl font-bold">{warehouseTxns.length}</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-sm text-red-700 dark:text-red-300">Total Debit (Out)</div>
                      <div className="text-xl font-bold text-red-600">
                        ₹{warehouseTxns.filter(t => t.txn_type === "Dr").reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-sm text-green-700 dark:text-green-300">Total Credit (In)</div>
                      <div className="text-xl font-bold text-green-600">
                        ₹{warehouseTxns.filter(t => t.txn_type === "Cr").reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Order #{selectedOrder?.order_number}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h4>
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{selectedOrder.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mobile:</span>
                    <span className="font-medium">{selectedOrder.customer_phone || "-"}</span>
                  </div>
                  {selectedOrder.shipping_full_address && (
                    <div className="pt-2 border-t">
                      <div className="text-muted-foreground mb-1">Address:</div>
                      <div className="font-medium">{selectedOrder.shipping_full_address}</div>
                    </div>
                  )}
                  {!selectedOrder.shipping_full_address && (selectedOrder.shipping_city || selectedOrder.shipping_pincode) && (
                    <div className="pt-2 border-t">
                      <div className="text-muted-foreground mb-1">Location:</div>
                      <div className="font-medium">
                        {[selectedOrder.shipping_city, selectedOrder.shipping_state, selectedOrder.shipping_pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Order Items
                </h4>
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  {selectedOrder.order_items.length > 0 ? (
                    <>
                      {selectedOrder.order_items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span>
                            {item.product_name}{" "}
                            <span className="text-muted-foreground">x {item.quantity}</span>
                          </span>
                          <span className="font-medium">₹{item.total.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t flex justify-between items-center font-semibold">
                        <span>Total:</span>
                        <span className="text-lg">₹{selectedOrder.total_amount.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No item details available</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Order & Delivery Info
                </h4>
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Order Status:</span>
                    <Badge variant={getStatusVariant(selectedOrder.order_status)}>
                      {selectedOrder.order_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment Status:</span>
                    <Badge variant={getStatusVariant(selectedOrder.payment_status)}>
                      {selectedOrder.payment_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span className="font-medium capitalize">{selectedOrder.payment_method || "Not set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Date:</span>
                    <span className="font-medium">
                      {format(new Date(selectedOrder.order_date || selectedOrder.created_at), "PPP")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Partner:</span>
                    <span className="font-medium">
                      {selectedOrder.delivery_partner_name || "Not assigned"}
                    </span>
                  </div>
                  {(selectedOrder.invoice_number_gst || selectedOrder.invoice_number_non_gst) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice:</span>
                      <span className="font-medium">
                        {selectedOrder.invoice_number_gst || selectedOrder.invoice_number_non_gst}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/orders/${selectedOrder.id}/edit`)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
