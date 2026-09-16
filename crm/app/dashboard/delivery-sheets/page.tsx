"use client"

import React, { useEffect, useState } from "react"
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
import { Separator } from "@/components/ui/separator"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Search, FileDown, Eye, ClipboardList, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { generateDeliveryRoutePDF, type DeliveryRouteData } from "@/lib/pdf-generator"

type DeliverySheet = {
  id: string
  route_id: string
  delivery_partner_id: string
  route_name: string
  partner_name: string
  partner_phone: string | null
  assignment_date: string
  generated_date: string
  total_orders: number
  total_items: number
  total_amount: number
  order_ids: string[]
  created_at: string
}

type Route = {
  id: string
  route_name: string
}

type DeliveryPartner = {
  id: string
  name: string
}

export default function DeliverySheetsPage() {
  const [deliverySheets, setDeliverySheets] = useState<DeliverySheet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRouteId, setFilterRouteId] = useState<string>("all")
  const [filterPartnerId, setFilterPartnerId] = useState<string>("all")
  const [filterDateFrom, setFilterDateFrom] = useState<Date>()
  const [filterDateTo, setFilterDateTo] = useState<Date>()
  const [routes, setRoutes] = useState<Route[]>([])
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([])

  useEffect(() => {
    fetchDeliverySheets()
    fetchRoutes()
    fetchDeliveryPartners()
  }, [])

  const fetchDeliverySheets = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from("delivery_sheets")
        .select("*")
        .order("generated_date", { ascending: false })

      if (error) throw error

      setDeliverySheets(data || [])
    } catch (error) {
      console.error("Error fetching delivery sheets:", error)
      toast.error("Failed to fetch delivery sheets")
    } finally {
      setLoading(false)
    }
  }

  const fetchRoutes = async () => {
    const { data, error } = await supabase
      .from("routes")
      .select("id, route_name")
      .eq("is_active", true)
      .order("route_name")

    if (error) {
      console.error("Error fetching routes:", error)
    } else {
      setRoutes(data || [])
    }
  }

  const fetchDeliveryPartners = async () => {
    const { data, error } = await supabase
      .from("delivery_partners")
      .select("id, name")
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("Error fetching delivery partners:", error)
    } else {
      setDeliveryPartners(data || [])
    }
  }

  const handleResetFilters = () => {
    setSearchTerm("")
    setFilterRouteId("all")
    setFilterPartnerId("all")
    setFilterDateFrom(undefined)
    setFilterDateTo(undefined)
  }

  const handleViewPDF = async (sheet: DeliverySheet) => {
    const toastId = toast.loading("Generating PDF...")

    try {
      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, total_amount, shipping_full_address, shipping_building_name, shipping_street_area, shipping_landmark, shipping_city, shipping_state, shipping_pincode, invoice_number_gst, invoice_number_non_gst, is_gst_invoice")
        .in("id", sheet.order_ids)

      if (ordersError) {
        console.error("Orders error:", ordersError)
        throw new Error(`Failed to fetch orders: ${ordersError.message}`)
      }

      if (!ordersData || ordersData.length === 0) {
        throw new Error("No orders found for this delivery sheet")
      }

      // Fetch customer details
      const customerIds = [...new Set(ordersData.map((o) => o.customer_id).filter(Boolean))]
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, first_name, last_name, vip_number, mobile_primary, mobile_secondary_1, mobile_secondary_2")
        .in("id", customerIds)

      if (customersError) {
        console.error("Customers error:", customersError)
      }

      // Fetch order items
      const { data: allOrderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("order_id, product_name, quantity")
        .in("order_id", sheet.order_ids)

      if (itemsError) {
        console.error("Order items error:", itemsError)
        throw new Error(`Failed to fetch order items: ${itemsError.message}`)
      }

      // Create lookup maps
      const orderMap = new Map(ordersData.map((o) => [o.id, o]))
      const customerMap = new Map(customersData?.map((c) => [c.id, c]) || [])

      // Group order items by order_id
      const orderItemsMap = new Map<string, { product_name: string; quantity: number }[]>()
      allOrderItems?.forEach((item) => {
        if (!orderItemsMap.has(item.order_id)) {
          orderItemsMap.set(item.order_id, [])
        }
        orderItemsMap.get(item.order_id)?.push({
          product_name: item.product_name,
          quantity: item.quantity,
        })
      })

      // Build PDF data
      const pdfOrders = sheet.order_ids.map((orderId, index) => {
        const order = orderMap.get(orderId)
        const customer = order ? customerMap.get(order.customer_id) : undefined
        const items = orderItemsMap.get(orderId) || []

        return {
          sequenceNumber: index + 1,
          orderNumber: order?.order_number || "Unknown",
          invoiceNumber: order?.is_gst_invoice
            ? (order?.invoice_number_gst || "-")
            : (order?.invoice_number_non_gst || "-"),
          customerName: customer ? `${customer.first_name} ${customer.last_name}` : "Unknown",
          customerVipNumber: customer?.vip_number,
          customerPhone: customer?.mobile_primary || "N/A",
          customerPhoneSecondary1: customer?.mobile_secondary_1,
          customerPhoneSecondary2: customer?.mobile_secondary_2,
          amount: order?.total_amount || 0,
          address: {
            fullAddress: order?.shipping_full_address,
            buildingName: order?.shipping_building_name,
            streetArea: order?.shipping_street_area,
            landmark: order?.shipping_landmark,
            city: order?.shipping_city,
            state: order?.shipping_state,
            pincode: order?.shipping_pincode,
          },
          items,
        }
      })

      const pdfData: DeliveryRouteData = {
        routeName: sheet.route_name,
        partnerName: sheet.partner_name,
        partnerPhone: sheet.partner_phone || "N/A",
        assignmentDate: new Date(sheet.assignment_date).toLocaleDateString("en-IN"),
        orders: pdfOrders,
      }

      generateDeliveryRoutePDF(pdfData)
      toast.success("PDF generated successfully", { id: toastId })
    } catch (error) {
      console.error("Error generating PDF:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to generate PDF"
      toast.error(errorMessage, { id: toastId })
    }
  }

  const filteredSheets = deliverySheets.filter((sheet) => {
    // Search filter
    const matchesSearch =
      sheet.route_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sheet.partner_name.toLowerCase().includes(searchTerm.toLowerCase())

    // Route filter
    const matchesRoute = filterRouteId === "all" || sheet.route_id === filterRouteId

    // Partner filter
    const matchesPartner = filterPartnerId === "all" || sheet.delivery_partner_id === filterPartnerId

    // Date range filter
    const sheetDate = new Date(sheet.assignment_date)
    const matchesDateFrom = !filterDateFrom || sheetDate >= filterDateFrom
    const matchesDateTo = !filterDateTo || sheetDate <= filterDateTo

    return matchesSearch && matchesRoute && matchesPartner && matchesDateFrom && matchesDateTo
  })

  const hasActiveFilters =
    searchTerm !== "" ||
    filterRouteId !== "all" ||
    filterPartnerId !== "all" ||
    !!filterDateFrom ||
    !!filterDateTo

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Delivery Sheets History</h1>
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
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Delivery Sheets History</h1>
            <p className="text-sm text-muted-foreground">View and search all generated delivery sheets</p>
          </div>
        </div>
      </div>

      {/* Delivery Sheets Card */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Delivery Sheets</CardTitle>
                <CardDescription className="mt-0.5">All generated delivery route sheets</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredSheets.length} {filteredSheets.length === 1 ? "sheet" : "sheets"}
              </Badge>
              {hasActiveFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by route or partner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>

              <Select value={filterRouteId} onValueChange={setFilterRouteId}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Routes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes</SelectItem>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.route_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterPartnerId} onValueChange={setFilterPartnerId}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Partners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  {deliveryPartners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[180px] justify-start text-left font-normal",
                      !filterDateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterDateFrom ? format(filterDateFrom, "PPP") : "From Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filterDateFrom}
                    onSelect={setFilterDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[180px] justify-start text-left font-normal",
                      !filterDateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterDateTo ? format(filterDateTo, "PPP") : "To Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filterDateTo}
                    onSelect={setFilterDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={handleResetFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Reset Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Generated Date</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Assignment Date</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Route</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Delivery Partner</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Phone</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Orders</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Items</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Amount</TableHead>
                  <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No delivery sheets found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSheets.map((sheet) => (
                    <TableRow key={sheet.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap">
                        {new Date(sheet.generated_date).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(sheet.assignment_date).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="font-medium">{sheet.route_name}</TableCell>
                      <TableCell>{sheet.partner_name}</TableCell>
                      <TableCell>{sheet.partner_phone || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant="outline" className="rounded-full">{sheet.total_orders}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant="outline" className="rounded-full">{sheet.total_items}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        ₹{sheet.total_amount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPDF(sheet)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredSheets.length} of {deliverySheets.length} sheets
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
