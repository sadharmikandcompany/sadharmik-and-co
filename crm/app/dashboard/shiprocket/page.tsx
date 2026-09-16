"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Search, Download, ExternalLink, Truck, AlertCircle, PackageX, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ExportButtons } from "@/components/export-buttons"

type OrderItem = {
  product_sku: string | null
  product_name: string
  quantity: number
  unit_price: string
  discount_amount: string
  gst_percentage: string
  hsn_code: string | null
  total: string
}

type ShiprocketOrder = {
  id: string
  order_number: string
  order_date: string
  order_status: string
  payment_status: string
  payment_method: string | null
  shipping_pincode: string
  shipping_city: string | null
  shipping_state: string | null
  shipping_country: string | null
  shipping_full_address: string | null
  shipping_building_name: string | null
  shipping_street_area: string | null
  shipping_landmark: string | null
  shipping_room_number: string | null
  shipping_floor: string | null
  shipping_wing: string | null
  billing_pincode: string
  billing_city: string | null
  billing_state: string | null
  billing_country: string | null
  billing_full_address: string | null
  billing_building_name: string | null
  billing_street_area: string | null
  billing_landmark: string | null
  billing_room_number: string | null
  billing_floor: string | null
  billing_wing: string | null
  total_amount: string
  subtotal: string
  discount_amount: string
  shipping_charges: string
  cod_amount: string | null
  customer_first_name: string | null
  customer_last_name: string | null
  customer_full_name: string | null
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_company_name: string
  customer_type: string
  order_items: OrderItem[]
}

export default function ShiprocketPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<ShiprocketOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchUnmatchedOrders()
  }, [])

  const fetchUnmatchedOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/orders/shiprocket")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching unmatched orders:", error)
      toast.error("Failed to fetch orders")
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-500"
      case "confirmed":
        return "bg-blue-500"
      case "processing":
        return "bg-purple-500"
      case "packed":
        return "bg-indigo-500"
      case "shipped":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getPaymentStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-500"
      case "pending":
        return "bg-yellow-500"
      case "processing":
        return "bg-blue-500"
      case "failed":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatAddress = (order: ShiprocketOrder) => {
    // Try structured address fields first
    const parts = [
      order.shipping_room_number,
      order.shipping_floor,
      order.shipping_wing,
      order.shipping_building_name,
      order.shipping_street_area,
      order.shipping_landmark,
    ].filter(Boolean)

    if (parts.length > 0) {
      return parts.join(", ")
    }

    // Fallback to full address if available
    if (order.shipping_full_address) {
      // Replace semicolons with commas for better readability
      return order.shipping_full_address.replace(/;/g, ", ")
    }

    return "N/A"
  }

  const formatCityState = (order: ShiprocketOrder) => {
    const parts = [order.shipping_city, order.shipping_state].filter(Boolean)
    return parts.length > 0 ? parts.join(", ") : "N/A"
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(filteredOrders.map((order) => order.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders)
    if (checked) {
      newSelected.add(orderId)
    } else {
      newSelected.delete(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const exportToShiprocket = () => {
    const selectedOrdersData = orders.filter((order) => selectedOrders.has(order.id))

    if (selectedOrdersData.length === 0) {
      toast.error("Please select at least one order to export")
      return
    }

    // Helper function to format address
    const formatShippingAddress = (order: ShiprocketOrder) => {
      // Try structured address fields first
      const parts = [
        order.shipping_room_number,
        order.shipping_floor,
        order.shipping_wing,
        order.shipping_building_name,
      ].filter(Boolean)

      if (parts.length > 0) {
        return parts.join(", ")
      }

      // Fallback to full address (parse first part before semicolon)
      if (order.shipping_full_address) {
        const addressParts = order.shipping_full_address.split(";")
        // Return first 4 parts (room, floor, building, etc.)
        return addressParts.slice(0, 4).filter(Boolean).join(", ")
      }

      return ""
    }

    const formatShippingAddress2 = (order: ShiprocketOrder) => {
      // Try structured address fields first
      const parts = [order.shipping_street_area, order.shipping_landmark].filter(Boolean)

      if (parts.length > 0) {
        return parts.join(", ")
      }

      // Fallback to full address (parse remaining parts)
      if (order.shipping_full_address) {
        const addressParts = order.shipping_full_address.split(";")
        // Return last parts (street, landmark)
        return addressParts.slice(4).filter(Boolean).join(", ")
      }

      return ""
    }

    const formatBillingAddress = (order: ShiprocketOrder) => {
      // Try structured address fields first
      const parts = [
        order.billing_room_number,
        order.billing_floor,
        order.billing_wing,
        order.billing_building_name,
      ].filter(Boolean)

      if (parts.length > 0) {
        return parts.join(", ")
      }

      // Fallback to full address
      if (order.billing_full_address) {
        const addressParts = order.billing_full_address.split(";")
        return addressParts.slice(0, 4).filter(Boolean).join(", ")
      }

      // Fallback to shipping address
      return formatShippingAddress(order)
    }

    const formatBillingAddress2 = (order: ShiprocketOrder) => {
      // Try structured address fields first
      const parts = [order.billing_street_area, order.billing_landmark].filter(Boolean)

      if (parts.length > 0) {
        return parts.join(", ")
      }

      // Fallback to full address
      if (order.billing_full_address) {
        const addressParts = order.billing_full_address.split(";")
        return addressParts.slice(4).filter(Boolean).join(", ")
      }

      // Fallback to shipping address
      return formatShippingAddress2(order)
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr)
      const day = String(date.getDate()).padStart(2, "0")
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, "0")
      const minutes = String(date.getMinutes()).padStart(2, "0")
      return `${day}-${month}-${year} ${hours}:${minutes}`
    }

    // Split customer name into first and last
    const splitName = (fullName: string) => {
      const parts = fullName.trim().split(" ")
      const firstName = parts[0] || ""
      const lastName = parts.slice(1).join(" ") || ""
      return { firstName, lastName }
    }

    // Shiprocket CSV headers (53 columns as per template)
    const csvHeaders = [
      "*Order Id",
      "Order Date as dd-mm-yyyy hh:MM",
      "*Channel",
      "*Payment Method(COD/Prepaid)",
      "*Customer First Name",
      "Customer Last Name",
      "Email (Optional)",
      "*Customer Mobile",
      "Customer Alternate Mobile",
      "*Shipping Address Line 1",
      "Shipping Address Line 2",
      "*Shipping Address Country",
      "*Shipping Address State",
      "*Shipping Address City",
      "*Shipping Address Postcode",
      "Billing Address Line 1",
      "Billing Address Line 2",
      "Billing Address Country",
      "Billing Address State",
      "Billing Address City",
      "Billing Address Postcode",
      "*Master SKU",
      "*Product Name",
      "*Product Quantity",
      "Tax %",
      "*Selling Price(Per Unit Item, Inclusive of Tax)",
      "Discount(Per Unit Item)",
      "Shipping Charges(Per Order)",
      "COD Charges(Per Order)",
      "Gift Wrap Charges(Per Order)",
      "Total Discount (Per Order)",
      "*Partial COD (Yes/No)",
      "Paid Amount (Rs.)",
      "*Length (cm)",
      "*Breadth (cm)",
      "*Height (cm)",
      "*Weight Of Shipment(kg)",
      "Send Notification(True/False)",
      "Comment",
      "HSN Code",
      "Location Id",
      "Reseller Name",
      "Company Name",
      "latitude",
      "longitude",
      "Verified Order",
      "Is documents",
      "Order Type",
      "Order tag",
      "Fulfillment Tat",
      "Appointment Date",
      "Order Channel",
      "Po Expiry Date",
      "Po Units",
    ]

    // Generate CSV rows - one row per order item
    const csvRows: string[][] = []

    selectedOrdersData.forEach((order) => {
      const { firstName, lastName } = splitName(
        order.customer_first_name && order.customer_last_name
          ? `${order.customer_first_name} ${order.customer_last_name}`
          : order.customer_name
      )

      const paymentMethod = order.payment_method?.toUpperCase() === "COD" ? "COD" : "Prepaid"
      const partialCOD = order.cod_amount && parseFloat(order.cod_amount) > 0 ? "yes" : "no"
      const paidAmount = paymentMethod === "Prepaid" ? order.total_amount : (order.cod_amount || "0")
      const codCharges = paymentMethod === "COD" ? "10" : ""

      // If order has no items, create a single row with default product
      if (!order.order_items || order.order_items.length === 0) {
        csvRows.push([
          order.order_number, // Order Id
          formatDate(order.order_date), // Order Date
          "Custom", // Channel
          paymentMethod, // Payment Method
          firstName, // Customer First Name
          lastName, // Customer Last Name
          order.customer_email || "", // Email
          order.customer_phone || "", // Customer Mobile
          "", // Customer Alternate Mobile
          formatShippingAddress(order) || "NA", // Shipping Address Line 1
          formatShippingAddress2(order) || "", // Shipping Address Line 2
          order.shipping_country || "India", // Shipping Country
          order.shipping_state || "", // Shipping State
          order.shipping_city || "", // Shipping City
          order.shipping_pincode, // Shipping Postcode
          formatBillingAddress(order) || formatShippingAddress(order) || "NA", // Billing Address Line 1
          formatBillingAddress2(order) || formatShippingAddress2(order) || "", // Billing Address Line 2
          order.billing_country || order.shipping_country || "India", // Billing Country
          order.billing_state || order.shipping_state || "", // Billing State
          order.billing_city || order.shipping_city || "", // Billing City
          order.billing_pincode || order.shipping_pincode, // Billing Postcode
          "PRODUCT", // Master SKU (default)
          "Product", // Product Name (default)
          "1", // Product Quantity (default)
          "0", // Tax %
          order.total_amount, // Selling Price
          order.discount_amount || "0", // Discount
          order.shipping_charges || "0", // Shipping Charges
          codCharges, // COD Charges
          "", // Gift Wrap Charges
          order.discount_amount || "0", // Total Discount
          partialCOD, // Partial COD
          paidAmount, // Paid Amount
          "10", // Length (cm) - default
          "10", // Breadth (cm) - default
          "10", // Height (cm) - default
          "0.5", // Weight (kg) - default
          "True", // Send Notification
          "", // Comment
          "", // HSN Code
          "", // Location Id
          "", // Reseller Name
          order.customer_company_name || "", // Company Name
          "", // latitude
          "", // longitude
          "1", // Verified Order
          "No", // Is documents
          "Essentials", // Order Type
          "", // Order tag
          "", // Fulfillment Tat
          "", // Appointment Date
          "Custom", // Order Channel
          "", // Po Expiry Date
          "", // Po Units
        ])
      } else {
        // Create one row per order item
        order.order_items.forEach((item) => {
          csvRows.push([
            order.order_number, // Order Id
            formatDate(order.order_date), // Order Date
            "Custom", // Channel
            paymentMethod, // Payment Method
            firstName, // Customer First Name
            lastName, // Customer Last Name
            order.customer_email || "", // Email
            order.customer_phone || "", // Customer Mobile
            "", // Customer Alternate Mobile
            formatShippingAddress(order) || "NA", // Shipping Address Line 1
            formatShippingAddress2(order) || "", // Shipping Address Line 2
            order.shipping_country || "India", // Shipping Country
            order.shipping_state || "", // Shipping State
            order.shipping_city || "", // Shipping City
            order.shipping_pincode, // Shipping Postcode
            formatBillingAddress(order) || formatShippingAddress(order) || "NA", // Billing Address Line 1
            formatBillingAddress2(order) || formatShippingAddress2(order) || "", // Billing Address Line 2
            order.billing_country || order.shipping_country || "India", // Billing Country
            order.billing_state || order.shipping_state || "", // Billing State
            order.billing_city || order.shipping_city || "", // Billing City
            order.billing_pincode || order.shipping_pincode, // Billing Postcode
            item.product_sku || "PRODUCT", // Master SKU
            item.product_name, // Product Name
            String(item.quantity), // Product Quantity
            item.gst_percentage || "0", // Tax %
            item.unit_price, // Selling Price (per unit, inclusive of tax)
            item.discount_amount || "0", // Discount (per unit)
            order.shipping_charges || "0", // Shipping Charges (per order)
            codCharges, // COD Charges (per order)
            "", // Gift Wrap Charges
            order.discount_amount || "0", // Total Discount (per order)
            partialCOD, // Partial COD
            paidAmount, // Paid Amount
            "10", // Length (cm) - default
            "10", // Breadth (cm) - default
            "10", // Height (cm) - default
            "0.5", // Weight (kg) - default
            "True", // Send Notification
            "", // Comment
            item.hsn_code || "", // HSN Code
            "", // Location Id
            "", // Reseller Name
            order.customer_company_name || "", // Company Name
            "", // latitude
            "", // longitude
            "1", // Verified Order
            "No", // Is documents
            "Essentials", // Order Type
            "", // Order tag
            "", // Fulfillment Tat
            "", // Appointment Date
            "Custom", // Order Channel
            "", // Po Expiry Date
            "", // Po Units
          ])
        })
      }
    })

    // Create CSV content
    const csvContent = [
      csvHeaders.map((h) => `"${h}"`).join(","),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `shiprocket_orders_${new Date().getTime()}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    const totalItems = csvRows.length
    toast.success(
      `Exported ${selectedOrdersData.length} orders with ${totalItems} items for Shiprocket`
    )
  }

  // Filter orders based on search term
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(searchLower) ||
      order.customer_name.toLowerCase().includes(searchLower) ||
      order.customer_phone.includes(searchLower) ||
      order.shipping_pincode.includes(searchLower) ||
      (order.shipping_city && order.shipping_city.toLowerCase().includes(searchLower)) ||
      (order.shipping_state && order.shipping_state.toLowerCase().includes(searchLower))
    )
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <PackageX className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Shiprocket Orders</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <PackageX className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Shiprocket Orders</h1>
            <p className="text-sm text-muted-foreground">
              Orders with pincodes not serviced by your network
            </p>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-900/50">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Unmatched Pincode Orders</CardTitle>
                <CardDescription className="mt-0.5">
                  These orders require third-party courier service as they don't match any serviceable pincodes
                  from distributors, retailers, subdistributors, or delivery drivers
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}
              </Badge>
              <Button
                onClick={exportToShiprocket}
                disabled={selectedOrders.size === 0}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Selected ({selectedOrders.size})
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by order number, customer name, phone, pincode, city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[360px] pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                {orders.length === 0
                  ? "No unmatched orders found! All orders can be serviced by your network."
                  : "No orders match your search criteria"}
              </p>
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-auto">
              <Table className="min-w-[1400px] w-full">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-12 font-semibold uppercase tracking-wider text-[11px]">
                      <Checkbox
                        checked={
                          filteredOrders.length > 0 &&
                          selectedOrders.size === filteredOrders.length
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Order Number</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Customer</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Phone</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Address</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">City/State</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Pincode</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Amount</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Payment</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOrder(order.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(order.order_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[150px] truncate" title={order.customer_name}>
                          {order.customer_name}
                        </div>
                      </TableCell>
                      <TableCell>{order.customer_phone || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full capitalize">
                          {order.customer_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div
                          className="max-w-[200px] truncate text-sm"
                          title={formatAddress(order)}
                        >
                          {formatAddress(order)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatCityState(order)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full font-mono">
                          {order.shipping_pincode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        ₹{parseFloat(order.total_amount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-white rounded-full capitalize",
                            getPaymentStatusBadgeColor(order.payment_status)
                          )}
                        >
                          {order.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-white rounded-full capitalize",
                            getStatusBadgeColor(order.order_status)
                          )}
                        >
                          {order.order_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
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
    </div>
  )
}
