"use client"

import React, { useEffect, useState } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  RefreshCcw,
  X,
  ExternalLink,
  ChevronDown,
  MoreVertical,
  Download,
  Edit,
  CheckCircle,
  Phone,
  MessageSquare,
  DollarSign,
  Clock,
  AlertCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { format, differenceInDays } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"
import { generateOrderInvoice } from "@/lib/invoice-generator"

type Order = {
  id: string
  order_number: string
  customer_id: string | null
  distributor_id?: string | null
  retailer_id?: string | null
  customer_name?: string
  customer_phone?: string
  customer_full_address?: string
  customer_vip_number?: string | null
  order_status: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  paid_amount?: number
  balance_amount?: number
  shipping_full_address: string | null
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  is_priority: boolean
  order_date: string
  created_at: string
  delivered_date?: string | null
  invoice_number_gst?: string | null
  invoice_number_non_gst?: string | null
  is_gst_invoice?: boolean
  serviceable_distributor_name?: string | null
  serviceable_distributor_id?: string | null
}

type OrderItem = {
  id: string
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  gst_percentage: number
  gst_amount: number
  total: number
}

export default function BalancePaymentOrdersPage() {
  const router = useRouter()
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [sortBy, setSortBy] = useState<string>("days_desc") // days_desc, days_asc, amount_desc, amount_asc

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})

  // Mark as paid dialog
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false)
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null)

  // Show all orders (including fully paid) toggle
  const [showAllOrders, setShowAllOrders] = useState(false)

  useEffect(() => {
    fetchBalancePaymentOrders()
  }, [])

  // Derive orders based on showAllOrders toggle
  const orders = showAllOrders
    ? allOrders
    : allOrders.filter(order => (order.balance_amount || 0) > 0)

  const fetchBalancePaymentOrders = async () => {
    try {
      setLoading(true)
      console.log("Starting to fetch balance payment orders...")

      // First, fetch route_assignments where collected_payment_method = 'balance'
      const { data: routeAssignmentsData, error: routeError } = await supabase
        .from("route_assignments")
        .select("order_id, collected_payment_method, collected_amount")
        .eq("collected_payment_method", "balance")

      if (routeError) {
        console.error("Error fetching route assignments:", routeError)
        toast.error(`Failed to fetch route assignments: ${routeError.message}`)
        setLoading(false)
        return
      }

      if (!routeAssignmentsData || routeAssignmentsData.length === 0) {
        setAllOrders([])
        setLoading(false)
        return
      }

      // Get order IDs from route assignments
      const orderIds = routeAssignmentsData.map((ra: any) => ra.order_id)

      // Create a map of order_id to route assignment data
      const routeAssignmentMap = new Map(
        routeAssignmentsData.map((ra: any) => [ra.order_id, ra])
      )

      // Fetch orders with balance payment method
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .in("id", orderIds)
        .order("delivered_date", { ascending: false })

      console.log("Orders query result:", { ordersData, ordersError })

      if (ordersError) {
        console.error("Error fetching balance payment orders:", ordersError)
        toast.error(`Failed to fetch orders: ${ordersError.message}`)
        setLoading(false)
        return
      }

      if (!ordersData || ordersData.length === 0) {
        setAllOrders([])
        setLoading(false)
        return
      }

      // Extract unique customer, distributor, and retailer IDs
      const customerIds = ordersData
        .filter((order: any) => order.customer_id)
        .map((order: any) => order.customer_id)
      const retailerIds = ordersData
        .filter((order: any) => order.retailer_id)
        .map((order: any) => order.retailer_id)
      const distributorIds = ordersData
        .filter((order: any) => order.distributor_id)
        .map((order: any) => order.distributor_id)

      // Extract unique shipping pincodes for distributor matching
      const shippingPincodes = [...new Set(
        ordersData
          .filter((order: any) => order.shipping_pincode)
          .map((order: any) => order.shipping_pincode)
      )]

      // Fetch related data in parallel
      const [customersResult, retailersResult, distributorsResult, serviceableDistributorsResult] = await Promise.all([
        customerIds.length > 0
          ? supabase
              .from("customers")
              .select("id, first_name, last_name, mobile_primary, full_address, vip_number")
              .in("id", customerIds)
          : Promise.resolve({ data: [], error: null }),
        retailerIds.length > 0
          ? supabase
              .from("retailers")
              .select("id, name, phone_primary, company_name")
              .in("id", retailerIds)
          : Promise.resolve({ data: [], error: null }),
        distributorIds.length > 0
          ? supabase
              .from("distributors")
              .select("id, name, phone_primary, company_name")
              .in("id", distributorIds)
          : Promise.resolve({ data: [], error: null }),
        shippingPincodes.length > 0
          ? supabase
              .from("distributors")
              .select("id, name, serviceable_pincodes")
              .not("serviceable_pincodes", "is", null)
          : Promise.resolve({ data: [], error: null }),
      ])

      // Create lookup maps
      const customersMap = new Map(
        (customersResult.data || []).map((c: any) => [c.id, c])
      )
      const retailersMap = new Map(
        (retailersResult.data || []).map((r: any) => [r.id, r])
      )
      const distributorsMap = new Map(
        (distributorsResult.data || []).map((d: any) => [d.id, d])
      )

      // Create pincode to distributor mapping
      const pincodeToDistributorMap = new Map<string, { id: string; name: string }>()
      ;(serviceableDistributorsResult.data || []).forEach((dist: any) => {
        if (dist.serviceable_pincodes && Array.isArray(dist.serviceable_pincodes)) {
          dist.serviceable_pincodes.forEach((pincode: string) => {
            if (!pincodeToDistributorMap.has(pincode)) {
              pincodeToDistributorMap.set(pincode, { id: dist.id, name: dist.name })
            }
          })
        }
      })

      // Map the data to the expected format
      const ordersWithDetails = ordersData.map((order: any) => {
        let customer_name = "Unknown"
        let customer_phone = ""
        let customer_full_address = ""
        let customer_vip_number = null

        if (order.customer_id) {
          const customer = customersMap.get(order.customer_id)
          if (customer) {
            customer_name = `${customer.first_name} ${customer.last_name}`.trim()
            customer_phone = customer.mobile_primary
            customer_full_address = customer.full_address
            customer_vip_number = customer.vip_number
          }
        } else if (order.retailer_id) {
          const retailer = retailersMap.get(order.retailer_id)
          if (retailer) {
            customer_name = `${retailer.name} (Retailer)`
            customer_phone = retailer.phone_primary
            customer_full_address = retailer.company_name
          }
        } else if (order.distributor_id) {
          const distributor = distributorsMap.get(order.distributor_id)
          if (distributor) {
            customer_name = `${distributor.name} (Distributor)`
            customer_phone = distributor.phone_primary
            customer_full_address = distributor.company_name
          }
        }

        // Get serviceable distributor by pincode
        const serviceableDistributor = order.shipping_pincode
          ? pincodeToDistributorMap.get(order.shipping_pincode)
          : undefined

        // Get route assignment data for collected amount
        const routeAssignment = routeAssignmentMap.get(order.id)
        const collected_amount = routeAssignment?.collected_amount ? parseFloat(routeAssignment.collected_amount) : 0

        // Calculate balance amount (total - collected)
        const balance_amount = order.total_amount - collected_amount

        return {
          ...order,
          customer_name,
          customer_phone,
          customer_full_address,
          customer_vip_number,
          serviceable_distributor_name: serviceableDistributor?.name || null,
          serviceable_distributor_id: serviceableDistributor?.id || null,
          paid_amount: collected_amount,
          balance_amount,
        }
      })

      // Store all orders - filtering is done via derived state
      setAllOrders(ordersWithDetails || [])
      setLoading(false)

      const outstandingCount = ordersWithDetails.filter((o: any) => o.balance_amount > 0).length
      console.log("Balance payment orders loaded successfully:", outstandingCount, "with outstanding balance out of", ordersWithDetails?.length, "total")
    } catch (error) {
      console.error("Unexpected error in fetchBalancePaymentOrders:", error)
      toast.error("An unexpected error occurred while fetching balance payment orders")
      setLoading(false)
    }
  }

  const fetchOrderItems = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)

      if (error) throw error

      setOrderItems(prev => ({ ...prev, [orderId]: data || [] }))
    } catch (error) {
      console.error("Error fetching order items:", error)
      toast.error("Failed to fetch order items")
    }
  }

  const toggleRowExpansion = async (orderId: string) => {
    const newExpandedRows = new Set(expandedRows)

    if (newExpandedRows.has(orderId)) {
      newExpandedRows.delete(orderId)
    } else {
      newExpandedRows.add(orderId)
      // Fetch order items if not already fetched
      if (!orderItems[orderId]) {
        await fetchOrderItems(orderId)
      }
    }

    setExpandedRows(newExpandedRows)
  }

  const fetchDistributorCompanyInfo = async (shippingPincode: string) => {
    try {
      const { data: distributorsData } = await supabase
        .from("distributors")
        .select("company_name, name, email, phone_primary, gst_number, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode, bank_name, bank_account_number, bank_ifsc_code, bank_branch, serviceable_pincodes")
        .not("serviceable_pincodes", "is", null)

      if (distributorsData) {
        const match = distributorsData.find((dist: any) =>
          dist.serviceable_pincodes &&
          Array.isArray(dist.serviceable_pincodes) &&
          dist.serviceable_pincodes.includes(shippingPincode)
        )
        if (match) {
          const address = [match.shipping_address_line1, match.shipping_address_line2].filter(Boolean).join(', ')
          return {
            name: match.company_name || "Sadharmik & Company",
            address: address || '',
            city: match.shipping_city || '',
            pincode: match.shipping_pincode || '',
            phone: match.phone_primary || '',
            email: match.email || '',
            gst: match.gst_number || '',
            state: match.shipping_state ? `${match.shipping_pincode?.substring(0, 2) || ''}-${match.shipping_state}` : '',
            bankName: match.bank_name || '',
            accountNumber: match.bank_account_number || '',
            ifscCode: match.bank_ifsc_code || '',
            branch: match.bank_branch || '',
          }
        }
      }
    } catch (error) {
      console.error("Error fetching distributor info:", error)
    }
    return undefined
  }

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      // Fetch full order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError

      // Fetch customer
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", orderData.customer_id)
        .single()

      if (customerError) throw customerError

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)

      if (itemsError) throw itemsError

      const companyInfo = orderData.shipping_pincode ? await fetchDistributorCompanyInfo(orderData.shipping_pincode) : undefined

      const invoiceData = {
        order: {
          id: orderData.id,
          order_number: orderData.order_number,
          invoice_number_gst: orderData.invoice_number_gst,
          invoice_number_non_gst: orderData.invoice_number_non_gst,
          is_gst_invoice: orderData.is_gst_invoice,
          order_date: orderData.order_date,
          order_status: orderData.order_status,
          payment_status: orderData.payment_status,
          payment_method: orderData.payment_method || 'Not specified',
          subtotal: orderData.subtotal,
          discount_amount: orderData.discount_amount,
          cgst_amount: orderData.cgst_amount,
          sgst_amount: orderData.sgst_amount,
          igst_amount: orderData.igst_amount,
          shipping_charges: orderData.shipping_charges,
          total_amount: orderData.total_amount,
          shipping_room_number: orderData.shipping_room_number || undefined,
          shipping_floor: orderData.shipping_floor || undefined,
          shipping_wing: orderData.shipping_wing || undefined,
          shipping_flat_number: orderData.shipping_flat_number || undefined,
          shipping_floor_wing: orderData.shipping_floor_wing || undefined,
          shipping_building_name: orderData.shipping_building_name,
          shipping_street_area: orderData.shipping_street_area,
          shipping_landmark: orderData.shipping_landmark || undefined,
          shipping_city: orderData.shipping_city,
          shipping_state: orderData.shipping_state,
          shipping_pincode: orderData.shipping_pincode,
          shipping_country: orderData.shipping_country || undefined,
          billing_room_number: orderData.billing_room_number || undefined,
          billing_floor: orderData.billing_floor || undefined,
          billing_wing: orderData.billing_wing || undefined,
          billing_flat_number: orderData.billing_flat_number || undefined,
          billing_floor_wing: orderData.billing_floor_wing || undefined,
          billing_building_name: orderData.billing_building_name,
          billing_street_area: orderData.billing_street_area,
          billing_landmark: orderData.billing_landmark || undefined,
          billing_city: orderData.billing_city,
          billing_state: orderData.billing_state,
          billing_pincode: orderData.billing_pincode,
          billing_country: orderData.billing_country || undefined,
        },
        customer: {
          first_name: customerData.first_name,
          last_name: customerData.last_name,
          email: customerData.email || undefined,
          mobile_primary: customerData.mobile_primary,
          company_name: customerData.company_name || undefined,
          gst_number: customerData.gst_number || undefined,
          full_address: customerData.full_address || undefined,
        },
        items: itemsData.map(item => ({
          product_name: item.product_name,
          product_sku: item.product_sku || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount,
          gst_percentage: item.gst_percentage,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total: item.total,
          hsn_code: item.hsn_code || undefined,
        })),
        companyInfo,
      }

      generateOrderInvoice(invoiceData)
      toast.success("Invoice downloaded successfully")
    } catch (error) {
      console.error("Error downloading invoice:", error)
      toast.error("Failed to download invoice")
    }
  }

  const openMarkPaidDialog = (order: Order) => {
    setSelectedOrderForPayment(order)
    setMarkPaidDialogOpen(true)
  }

  const handleMarkAsFullyPaid = async () => {
    if (!selectedOrderForPayment) return

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "completed",
          paid_amount: selectedOrderForPayment.total_amount,
        })
        .eq("id", selectedOrderForPayment.id)

      if (error) throw error

      toast.success(`Order ${selectedOrderForPayment.order_number} marked as fully paid`)
      setMarkPaidDialogOpen(false)
      setSelectedOrderForPayment(null)
      fetchBalancePaymentOrders() // Refresh the list
    } catch (error) {
      console.error("Error marking order as fully paid:", error)
      toast.error("Failed to mark order as fully paid")
    }
  }

  const getDaysSinceDelivery = (deliveredDate: string | null): number => {
    if (!deliveredDate) return 0
    return differenceInDays(new Date(), new Date(deliveredDate))
  }

  const filteredOrders = orders.filter((order) => {
    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_phone && order.customer_phone.includes(searchTerm))

    // Date range filter (delivery date)
    const deliveryDate = order.delivered_date ? new Date(order.delivered_date) : new Date(order.created_at)
    const matchesDateFrom = !dateFrom || deliveryDate >= dateFrom
    const matchesDateTo = !dateTo || deliveryDate <= dateTo

    return matchesSearch && matchesDateFrom && matchesDateTo
  })

  // Sort filtered orders
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    switch (sortBy) {
      case "days_desc":
        return getDaysSinceDelivery(b.delivered_date || null) - getDaysSinceDelivery(a.delivered_date || null)
      case "days_asc":
        return getDaysSinceDelivery(a.delivered_date || null) - getDaysSinceDelivery(b.delivered_date || null)
      case "amount_desc":
        return (b.balance_amount || 0) - (a.balance_amount || 0)
      case "amount_asc":
        return (a.balance_amount || 0) - (b.balance_amount || 0)
      default:
        return 0
    }
  })

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setSearchTerm("")
    setSortBy("days_desc")
  }

  const hasActiveFilters = dateFrom || dateTo || searchTerm !== "" || sortBy !== "days_desc"

  // Calculate statistics
  const totalBalanceAmount = orders.reduce((sum, order) => sum + (order.balance_amount || 0), 0)
  const avgBalanceAmount = orders.length > 0 ? totalBalanceAmount / orders.length : 0
  const urgentOrders = orders.filter(order => getDaysSinceDelivery(order.delivered_date || null) > 7).length

  // Prepare export data
  const exportData = sortedOrders.map(order => ({
    'Order Number': order.order_number,
    'Customer': order.customer_name || 'Unknown',
    'Phone': order.customer_phone || '',
    'Sd Number': order.customer_vip_number || '',
    'Total Amount': `₹${order.total_amount.toFixed(2)}`,
    'Paid Amount': `₹${(order.paid_amount || 0).toFixed(2)}`,
    'Balance Amount': `₹${(order.balance_amount || 0).toFixed(2)}`,
    'Payment Method': order.payment_method || 'N/A',
    'Days Since Delivery': getDaysSinceDelivery(order.delivered_date || null),
    'Delivered Date': order.delivered_date ? format(new Date(order.delivered_date), 'PPP') : 'Unknown',
    'Order Date': format(new Date(order.order_date || order.created_at), 'PPP')
  }))

  const exportColumns = [
    { header: 'Order #', dataKey: 'Order Number' },
    { header: 'Customer', dataKey: 'Customer' },
    { header: 'Phone', dataKey: 'Phone' },
    { header: 'Sd #', dataKey: 'Sd Number' },
    { header: 'Total', dataKey: 'Total Amount' },
    { header: 'Paid', dataKey: 'Paid Amount' },
    { header: 'Balance', dataKey: 'Balance Amount' },
    { header: 'Payment Method', dataKey: 'Payment Method' },
    { header: 'Days Since Delivery', dataKey: 'Days Since Delivery' },
    { header: 'Delivered', dataKey: 'Delivered Date' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Balance Payment Orders</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-orange-500" />
            Balance Payment Orders
          </h1>
          <p className="text-muted-foreground">Orders where payment was collected as "Balance" - track outstanding amounts</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/orders")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
          <ExportButtons
            data={exportData}
            filename="balance-payment-orders"
            columns={exportColumns}
            pdfTitle="Balance Payment Orders Report"
          />
          <Button
            onClick={fetchBalancePaymentOrders}
            variant="outline"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Collections</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">Orders with balance payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalBalanceAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total amount to collect</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{avgBalanceAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Average per order</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent (7+ days)</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{urgentOrders}</div>
            <p className="text-xs text-muted-foreground">Need immediate follow-up</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance Payment Orders</CardTitle>
          <CardDescription>
            Orders where delivery driver collected payment as "Balance" method
          </CardDescription>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search by order, customer, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[250px]"
              />

              {/* Sort By */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days_desc">Oldest First</SelectItem>
                  <SelectItem value="days_asc">Newest First</SelectItem>
                  <SelectItem value="amount_desc">Highest Balance</SelectItem>
                  <SelectItem value="amount_asc">Lowest Balance</SelectItem>
                </SelectContent>
              </Select>

              {/* Date range */}
              <DateRangePresetFilter
                preset={datePreset}
                onPresetChange={(p, range) => {
                  setDatePreset(p)
                  setDateFrom(range.from)
                  setDateTo(range.to)
                }}
                customFrom={dateFrom}
                customTo={dateTo}
                onCustomRangeChange={(from, to) => {
                  setDatePreset("custom")
                  setDateFrom(from)
                  setDateTo(to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999) : undefined)
                }}
              />

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Order Info</TableHead>
                  <TableHead>Customer & Contact</TableHead>
                  <TableHead>Amounts</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Days Since</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      <div className="py-8">
                        <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium">No balance payment orders found</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          All delivered orders have been fully paid
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOrders.map((order) => {
                    const isExpanded = expandedRows.has(order.id)
                    const items = orderItems[order.id] || []
                    const daysSinceDelivery = getDaysSinceDelivery(order.delivered_date || null)
                    const isUrgent = daysSinceDelivery > 7

                    return (
                      <React.Fragment key={order.id}>
                        <TableRow
                          className={cn(
                            "cursor-pointer hover:bg-muted/50",
                            isUrgent && "bg-orange-50/50 dark:bg-orange-950/20"
                          )}
                          onClick={() => toggleRowExpansion(order.id)}
                        >
                          <TableCell>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownloadInvoice(order.id)
                                }}
                                className="hover:text-primary hover:underline text-left font-mono"
                                title="Download Invoice"
                              >
                                {order.is_gst_invoice
                                  ? (order.invoice_number_gst || "-")
                                  : (order.invoice_number_non_gst || "-")
                                }
                              </button>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/dashboard/orders/${order.id}`)
                                  }}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                                >
                                  {order.order_number}
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                                {order.is_priority && (
                                  <Badge variant="destructive" className="text-xs">
                                    Priority
                                  </Badge>
                                )}
                                {isUrgent && (
                                  <Badge variant="destructive" className="text-xs">
                                    Urgent
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{order.customer_name}</span>
                                {order.customer_vip_number && (
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {order.customer_vip_number}
                                  </Badge>
                                )}
                              </div>
                              {order.customer_phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <a
                                    href={`tel:${order.customer_phone}`}
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Phone className="h-3 w-3" />
                                    {order.customer_phone}
                                  </a>
                                  <a
                                    href={`https://wa.me/${order.customer_phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-green-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Send WhatsApp message"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    WhatsApp
                                  </a>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total:</span>
                                <span>₹{order.total_amount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Paid:</span>
                                <span className="text-green-600">₹{(order.paid_amount || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1">
                                <span className="font-medium">Balance:</span>
                                <span className="font-bold text-destructive">
                                  ₹{(order.balance_amount || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {order.payment_method || 'Not specified'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {order.delivered_date ? (
                                format(new Date(order.delivered_date), 'PP')
                              ) : (
                                <span className="text-muted-foreground">Unknown</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className={cn(
                                "h-4 w-4",
                                isUrgent ? "text-destructive" : "text-muted-foreground"
                              )} />
                              <Badge variant={isUrgent ? "destructive" : "secondary"}>
                                {daysSinceDelivery} {daysSinceDelivery === 1 ? 'day' : 'days'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openMarkPaidDialog(order)}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark as Fully Paid
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/dashboard/orders/${order.id}/edit`)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Order
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDownloadInvoice(order.id)}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download Invoice
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {order.customer_phone && (
                                  <>
                                    <DropdownMenuItem asChild>
                                      <a href={`tel:${order.customer_phone}`}>
                                        <Phone className="mr-2 h-4 w-4" />
                                        Call Customer
                                      </a>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={`https://wa.me/${order.customer_phone.replace(/[^0-9]/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <MessageSquare className="mr-2 h-4 w-4" />
                                        WhatsApp Message
                                      </a>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Row Content */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/30 p-0">
                              <div className="p-4">
                                <h4 className="font-semibold mb-3">Order Items</h4>
                                {items.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Loading order items...</p>
                                ) : (
                                  <div className="rounded-md border bg-background">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Product</TableHead>
                                          <TableHead className="text-center">Qty</TableHead>
                                          <TableHead className="text-right">Unit Price</TableHead>
                                          <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {items.map((item) => (
                                          <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                              <div>
                                                {item.product_name}
                                                {item.product_sku && (
                                                  <div className="text-xs text-muted-foreground mt-1">
                                                    SKU: {item.product_sku}
                                                  </div>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                            <TableCell className="text-right">
                                              ₹{item.unit_price.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              ₹{item.total.toFixed(2)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {sortedOrders.length} of {orders.length} {showAllOrders ? "total" : "with outstanding"} balance payment orders
              {!showAllOrders && allOrders.length > orders.length && (
                <span className="ml-1">({allOrders.length - orders.length} fully paid hidden)</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllOrders(!showAllOrders)}
            >
              {showAllOrders ? "Show Outstanding Only" : `Show All (${allOrders.length})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mark as Paid Dialog */}
      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Order as Fully Paid</DialogTitle>
            <DialogDescription>
              Confirm that you have received the full payment for order {selectedOrderForPayment?.order_number}
            </DialogDescription>
          </DialogHeader>
          {selectedOrderForPayment && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="p-4 bg-muted rounded-md space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Customer:</span>
                    <span className="text-sm">{selectedOrderForPayment.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Total Amount:</span>
                    <span className="text-sm">₹{selectedOrderForPayment.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Already Paid:</span>
                    <span className="text-sm text-green-600">
                      ₹{(selectedOrderForPayment.paid_amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-bold">Balance to Collect:</span>
                    <span className="text-sm font-bold text-destructive">
                      ₹{(selectedOrderForPayment.balance_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This will mark the order as fully paid and update the payment status to "completed".
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsFullyPaid}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirm Full Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
