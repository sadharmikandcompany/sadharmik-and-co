"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Package, User, MapPin, CreditCard, Truck, Pencil, Printer, Download, Users, Globe, UserCircle } from "lucide-react"
import { toast } from "sonner"
import { generateOrderInvoice } from "@/lib/invoice-generator"

type Distributor = {
  id: string
  name: string
  email: string | null
  phone_primary: string
  company_name: string | null
  gst_number: string | null
  shipping_address_line1: string | null
  shipping_address_line2: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_pincode: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  bank_branch: string | null
}

type Order = {
  id: string
  order_number: string
  customer_id: string | null
  distributor_id: string | null
  is_distributor: boolean
  is_subdistributor: boolean
  order_status: string
  payment_status: string
  payment_method: string | null
  transaction_id: string | null
  shipping_room_number: string | null
  shipping_floor: string | null
  shipping_wing: string | null
  shipping_flat_number: string | null
  shipping_floor_wing: string | null
  shipping_building_name: string
  shipping_street_area: string
  shipping_landmark: string | null
  shipping_pincode: string
  shipping_country: string | null
  shipping_state: string
  shipping_city: string
  billing_room_number: string | null
  billing_floor: string | null
  billing_wing: string | null
  billing_flat_number: string | null
  billing_floor_wing: string | null
  billing_building_name: string
  billing_street_area: string
  billing_landmark: string | null
  billing_pincode: string
  billing_country: string | null
  billing_state: string
  billing_city: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  gst_amount: number
  shipping_charges: number
  total_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  shipping_method: string | null
  tracking_number: string | null
  courier_partner: string | null
  expected_delivery_date: string | null
  shipped_date: string | null
  delivered_date: string | null
  order_notes: string | null
  customer_notes: string | null
  internal_notes: string | null
  is_priority: boolean
  order_date: string
  created_at: string
  updated_at: string
  source: string | null
  created_by_agent_name: string | null
  created_by_agent_id: string | null
  cod_payment_method: string | null
  cod_collected_amount: string | number | null
}

type OrderItem = {
  id: string
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  hsn_code: string | null
  gst_percentage: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  subtotal: number
  total: number
}

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  mobile_primary: string
  mobile_secondary_1?: string | null
  mobile_secondary_2?: string | null
  whatsapp_number?: string | null
  whatsapp_same_as_primary?: boolean
  company_name: string | null
  gst_number: string | null
  is_vip: boolean
  is_defaulter: boolean
  is_mandir: boolean
  full_address: string | null
}

type RouteAssignment = {
  id: string
  route_id: string
  delivery_partner_id: string | null
  status: string
  sequence_number: number | null
  scheduled_delivery_date: string | null
  assignment_date: string | null
  delivery_time: string | null
  pickup_time: string | null
  delivery_notes: string | null
  delivery_proof_url: string | null
  customer_rating: number | null
  customer_feedback: string | null
  collected_amount: string | number | null
  collected_payment_method: string | null
  route_name?: string
  partner_name?: string
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [routeAssignment, setRouteAssignment] = useState<RouteAssignment | null>(null)
  const [serviceableDistributor, setServiceableDistributor] = useState<Distributor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  const fetchOrderDetails = async () => {
    setLoading(true)

    try {
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError

      setOrder(orderData)

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)

      if (itemsError) throw itemsError

      setOrderItems(itemsData || [])

      // Fetch customer or distributor
      if (orderData.customer_id) {
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("id, first_name, last_name, email, mobile_primary, mobile_secondary_1, mobile_secondary_2, whatsapp_number, whatsapp_same_as_primary, company_name, gst_number, is_vip, is_defaulter, is_mandir, full_address")
          .eq("id", orderData.customer_id)
          .single()

        if (customerError) throw customerError

        setCustomer(customerData)
      } else if (orderData.distributor_id) {
        // Fetch distributor and transform to Customer type
        const { data: distributorData, error: distributorError } = await supabase
          .from("distributors")
          .select("id, name, email, phone_primary, company_name, gst_number")
          .eq("id", orderData.distributor_id)
          .single()

        if (distributorError) throw distributorError

        // Transform distributor data to match Customer type
        setCustomer({
          id: distributorData.id,
          first_name: distributorData.name.split(' ')[0] || distributorData.name,
          last_name: distributorData.name.split(' ').slice(1).join(' ') || '',
          email: distributorData.email,
          mobile_primary: distributorData.phone_primary,
          company_name: distributorData.company_name,
          gst_number: distributorData.gst_number,
          is_vip: false,
          is_defaulter: false,
          is_mandir: false,
          full_address: null
        })
      }

      // Fetch route assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("route_assignments")
        .select("*")
        .eq("order_id", orderId)
        .single()

      if (!assignmentError && assignmentData) {
        // Fetch route and partner details
        const [{ data: routeData }, { data: partnerData }] = await Promise.all([
          supabase.from("routes").select("route_name").eq("id", assignmentData.route_id).single(),
          assignmentData.delivery_partner_id
            ? supabase
                .from("delivery_partners")
                .select("name")
                .eq("id", assignmentData.delivery_partner_id)
                .single()
            : Promise.resolve({ data: null }),
        ])

        setRouteAssignment({
          ...assignmentData,
          route_name: routeData?.route_name,
          partner_name: partnerData?.name,
        })
      }

      // Fetch serviceable distributor by pincode
      if (orderData.shipping_pincode) {
        const { data: distributorsData, error: distributorsError } = await supabase
          .from("distributors")
          .select("id, name, email, phone_primary, company_name, serviceable_pincodes, gst_number, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode, bank_name, bank_account_number, bank_ifsc_code, bank_branch")
          .not("serviceable_pincodes", "is", null)

        if (!distributorsError && distributorsData) {
          // Find the first distributor that services this pincode
          const matchingDistributor = distributorsData.find((dist: any) =>
            dist.serviceable_pincodes &&
            Array.isArray(dist.serviceable_pincodes) &&
            dist.serviceable_pincodes.includes(orderData.shipping_pincode)
          )

          if (matchingDistributor) {
            setServiceableDistributor({
              id: matchingDistributor.id,
              name: matchingDistributor.name,
              email: matchingDistributor.email,
              phone_primary: matchingDistributor.phone_primary,
              company_name: matchingDistributor.company_name,
              gst_number: matchingDistributor.gst_number,
              shipping_address_line1: matchingDistributor.shipping_address_line1,
              shipping_address_line2: matchingDistributor.shipping_address_line2,
              shipping_city: matchingDistributor.shipping_city,
              shipping_state: matchingDistributor.shipping_state,
              shipping_pincode: matchingDistributor.shipping_pincode,
              bank_name: matchingDistributor.bank_name,
              bank_account_number: matchingDistributor.bank_account_number,
              bank_ifsc_code: matchingDistributor.bank_ifsc_code,
              bank_branch: matchingDistributor.bank_branch,
            })
          }
        }
      }
    } catch (error: unknown) {
      console.error("Error fetching order details:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch order details"
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getDistributorCompanyInfo = () => {
    if (!serviceableDistributor) return undefined
    const dist = serviceableDistributor
    const address = [dist.shipping_address_line1, dist.shipping_address_line2].filter(Boolean).join(', ')
    return {
      name: dist.company_name || dist.name,
      address: address || '',
      city: dist.shipping_city || '',
      pincode: dist.shipping_pincode || '',
      phone: dist.phone_primary || '',
      email: dist.email || '',
      gst: dist.gst_number || '',
      state: dist.shipping_state ? `${dist.shipping_pincode?.substring(0, 2) || ''}-${dist.shipping_state}` : '',
      bankName: dist.bank_name || '',
      accountNumber: dist.bank_account_number || '',
      ifscCode: dist.bank_ifsc_code || '',
      branch: dist.bank_branch || '',
    }
  }

  const handleGenerateInvoice = () => {
    try {
      if (!order || !customer || orderItems.length === 0) {
        toast.error("Missing data for invoice generation")
        return
      }

      const invoiceData = {
        order: {
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          order_status: order.order_status,
          payment_status: order.payment_status,
          payment_method: order.payment_method || 'Not specified',
          subtotal: order.subtotal,
          discount_amount: order.discount_amount,
          cgst_amount: order.cgst_amount,
          sgst_amount: order.sgst_amount,
          igst_amount: order.igst_amount,
          shipping_charges: order.shipping_charges,
          total_amount: order.total_amount,
          shipping_room_number: order.shipping_room_number || undefined,
          shipping_floor: order.shipping_floor || undefined,
          shipping_wing: order.shipping_wing || undefined,
          shipping_flat_number: order.shipping_flat_number || undefined,
          shipping_floor_wing: order.shipping_floor_wing || undefined,
          shipping_building_name: order.shipping_building_name,
          shipping_street_area: order.shipping_street_area,
          shipping_landmark: order.shipping_landmark || undefined,
          shipping_city: order.shipping_city,
          shipping_state: order.shipping_state,
          shipping_pincode: order.shipping_pincode,
          shipping_country: order.shipping_country || undefined,
          billing_room_number: order.billing_room_number || undefined,
          billing_floor: order.billing_floor || undefined,
          billing_wing: order.billing_wing || undefined,
          billing_flat_number: order.billing_flat_number || undefined,
          billing_floor_wing: order.billing_floor_wing || undefined,
          billing_building_name: order.billing_building_name,
          billing_street_area: order.billing_street_area,
          billing_landmark: order.billing_landmark || undefined,
          billing_city: order.billing_city,
          billing_state: order.billing_state,
          billing_pincode: order.billing_pincode,
          billing_country: order.billing_country || undefined,
        },
        customer: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email || undefined,
          mobile_primary: customer.mobile_primary,
          mobile_secondary_1: customer.mobile_secondary_1 || undefined,
          mobile_secondary_2: customer.mobile_secondary_2 || undefined,
          whatsapp_number: customer.whatsapp_same_as_primary ? undefined : (customer.whatsapp_number || undefined),
          company_name: customer.company_name || undefined,
          gst_number: customer.gst_number || undefined,
        },
        items: orderItems.map(item => ({
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
        companyInfo: getDistributorCompanyInfo(),
      }

      generateOrderInvoice(invoiceData)
      toast.success("Invoice generated successfully")
    } catch (error) {
      console.error("Error generating invoice:", error)
      toast.error("Failed to generate invoice")
    }
  }

  const handlePrintInvoice = () => {
    toast.info("Print functionality - generating PDF for printing")
    handleGenerateInvoice()
  }

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "completed" || lowerStatus === "delivered" || lowerStatus === "paid") {
      return "default"
    }
    if (lowerStatus === "pending" || lowerStatus === "processing") {
      return "outline"
    }
    if (lowerStatus === "cancelled" || lowerStatus === "failed") {
      return "destructive"
    }
    return "secondary"
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Order Details</h1>
        <p>Loading...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Order Not Found</h1>
        <Button onClick={() => router.push("/dashboard/orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/orders")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order {order.order_number}</h1>
            <p className="text-muted-foreground">
              Placed on {new Date(order.order_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintInvoice}>
            <Printer className="mr-2 h-4 w-4" />
            Print Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateInvoice}>
            <Download className="mr-2 h-4 w-4" />
            Download Invoice
          </Button>
          <Button onClick={() => router.push(`/dashboard/orders/${orderId}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Order
          </Button>
          <Badge variant={getStatusVariant(order.order_status)}>{order.order_status}</Badge>
          {order.is_priority && <Badge variant="destructive">Priority</Badge>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Order Source & Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Order Source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Source:</span>
              <Badge variant="outline" className="capitalize">
                {order.source || "Unknown"}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Created By</span>
              </div>
              <p className="text-sm">
                {order.created_by_agent_name || "System / Unknown"}
              </p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Created: {new Date(order.created_at).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Updated: {new Date(order.updated_at).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium">
                {customer?.first_name} {customer?.last_name}
              </p>
              {customer?.company_name && (
                <p className="text-sm text-muted-foreground">{customer.company_name}</p>
              )}
              <div className="flex gap-1 mt-2">
                {customer?.is_vip && (
                  <Badge variant="default" className="text-xs">VIP</Badge>
                )}
                {customer?.is_mandir && (
                  <Badge variant="secondary" className="text-xs">Mandir</Badge>
                )}
                {customer?.is_defaulter && (
                  <Badge variant="destructive" className="text-xs">Defaulter</Badge>
                )}
              </div>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Mobile:</span> {customer?.mobile_primary}
              </p>
              {customer?.email && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Email:</span> {customer.email}
                </p>
              )}
              {customer?.gst_number && (
                <p className="text-sm">
                  <span className="text-muted-foreground">GST:</span> {customer.gst_number}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant={getStatusVariant(order.payment_status)}>
                {order.payment_status}
              </Badge>
            </div>
            {order.payment_method && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Method:</span>
                <span className="text-sm font-medium">{order.payment_method}</span>
              </div>
            )}
            {order.transaction_id && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Transaction ID:</span>
                <span className="text-sm font-mono">{order.transaction_id}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Amount:</span>
              <span className="text-lg font-bold">₹{order.total_amount.toFixed(2)}</span>
            </div>

            {/* Payment In / Payment Out (stacked) */}
            {(() => {
              const raAmount = parseFloat(routeAssignment?.collected_amount as any) || 0
              const raMethod = routeAssignment?.collected_payment_method || null
              const codAmount = parseFloat(order.cod_collected_amount as any) || 0
              const codMethod = order.cod_payment_method || null
              const payOutAmount = raAmount > 0 ? raAmount : codAmount
              const payOutMethod = raAmount > 0 ? raMethod : codMethod
              const total = order.total_amount || 0
              // Payment In = money paid before delivery (pre-payment / advance).
              // Only counts if payment_status is completed AND collected < total.
              const payInAmount =
                order.payment_status === "completed"
                  ? Math.max(0, total - payOutAmount)
                  : 0
              const payInMethod = payInAmount > 0 ? order.payment_method : null
              return (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400">
                        Payment In
                      </span>
                      <span className="text-xs font-medium capitalize text-emerald-900 dark:text-emerald-200">
                        {payInMethod || "—"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      ₹{payInAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-red-700 dark:text-red-400">
                        Sale
                      </span>
                      <span className="text-xs font-medium capitalize text-red-900 dark:text-red-200">
                        {payOutMethod || "—"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-red-700 dark:text-red-400">
                      ₹{payOutAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>

        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Delivery Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {routeAssignment ? (
              <>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Route:</span> {routeAssignment.route_name}
                  </p>
                  {routeAssignment.partner_name && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Partner:</span>{" "}
                      {routeAssignment.partner_name}
                    </p>
                  )}
                  {routeAssignment.sequence_number !== null && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Sequence:</span> #
                      {routeAssignment.sequence_number}
                    </p>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={getStatusVariant(routeAssignment.status)}>
                    {routeAssignment.status}
                  </Badge>
                </div>
                {routeAssignment.assignment_date && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Assigned:</span>{" "}
                    {new Date(routeAssignment.assignment_date).toLocaleDateString()}
                  </p>
                )}
                {routeAssignment.scheduled_delivery_date && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Scheduled:</span>{" "}
                    {new Date(routeAssignment.scheduled_delivery_date).toLocaleDateString()}
                  </p>
                )}
                {routeAssignment.pickup_time && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Picked up:</span>{" "}
                    {new Date(routeAssignment.pickup_time).toLocaleString()}
                  </p>
                )}
                {routeAssignment.delivery_time && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Delivered:</span>{" "}
                    {new Date(routeAssignment.delivery_time).toLocaleString()}
                  </p>
                )}
                {routeAssignment.customer_rating && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Rating:</span>{" "}
                    {"⭐".repeat(routeAssignment.customer_rating)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned to any route yet</p>
            )}
            {order.expected_delivery_date && (
              <>
                <Separator />
                <p className="text-sm">
                  <span className="text-muted-foreground">Expected:</span>{" "}
                  {new Date(order.expected_delivery_date).toLocaleDateString()}
                </p>
              </>
            )}
            {order.shipped_date && (
              <p className="text-sm">
                <span className="text-muted-foreground">Shipped:</span>{" "}
                {new Date(order.shipped_date).toLocaleDateString()}
              </p>
            )}
            {order.delivered_date && (
              <p className="text-sm">
                <span className="text-muted-foreground">Delivered (Order):</span>{" "}
                {new Date(order.delivered_date).toLocaleDateString()}
              </p>
            )}
            {order.tracking_number && (
              <>
                <Separator />
                <p className="text-sm">
                  <span className="text-muted-foreground">Tracking:</span> {order.tracking_number}
                </p>
              </>
            )}
            {order.courier_partner && (
              <p className="text-sm">
                <span className="text-muted-foreground">Courier:</span> {order.courier_partner}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shipping Address and Distributor */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Shipping Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Check if order has proper address, otherwise use customer's full_address */}
            {order.shipping_city && order.shipping_city !== 'N/A' && order.shipping_city !== '' ? (
              <address className="not-italic text-sm">
                {order.shipping_room_number && order.shipping_room_number !== 'N/A' && <span>Room {order.shipping_room_number}, </span>}
                {order.shipping_floor && order.shipping_floor !== 'N/A' && <span>Floor {order.shipping_floor}, </span>}
                {order.shipping_wing && order.shipping_wing !== 'N/A' && <span>Wing {order.shipping_wing}, </span>}
                {order.shipping_flat_number && order.shipping_flat_number !== 'N/A' && <span>{order.shipping_flat_number}, </span>}
                {order.shipping_floor_wing && order.shipping_floor_wing !== 'N/A' && <span>{order.shipping_floor_wing}, </span>}
                {order.shipping_building_name && order.shipping_building_name !== 'N/A' && (
                  <>
                    {order.shipping_building_name}
                    <br />
                  </>
                )}
                {order.shipping_street_area && order.shipping_street_area !== 'N/A' && (
                  <>
                    {order.shipping_street_area}
                    <br />
                  </>
                )}
                {order.shipping_landmark && order.shipping_landmark !== 'N/A' && (
                  <>
                    Near {order.shipping_landmark}
                    <br />
                  </>
                )}
                {order.shipping_city}, {order.shipping_state} - {order.shipping_pincode}
                {order.shipping_country && order.shipping_country !== 'N/A' && (
                  <>
                    <br />
                    {order.shipping_country}
                  </>
                )}
              </address>
            ) : customer?.full_address && customer.full_address !== '000000' && customer.full_address !== 'Not Provided' ? (
              <address className="not-italic text-sm">
                {customer.full_address}
                <br />
                <span className="text-xs text-muted-foreground italic mt-2 block">
                  (Using customer's saved address)
                </span>
              </address>
            ) : (
              <p className="text-sm text-muted-foreground">No address available</p>
            )}
          </CardContent>
        </Card>

        {/* Serviceable Distributor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Serviceable Distributor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {serviceableDistributor ? (
              <div className="space-y-2">
                <div>
                  <button
                    onClick={() => router.push(`/dashboard/distributors/${serviceableDistributor.id}`)}
                    className="text-base font-medium hover:text-primary hover:underline transition-colors"
                  >
                    {serviceableDistributor.name}
                  </button>
                  {serviceableDistributor.company_name && (
                    <p className="text-sm text-muted-foreground">{serviceableDistributor.company_name}</p>
                  )}
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Mobile:</span> {serviceableDistributor.phone_primary}
                  </p>
                  {serviceableDistributor.email && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Email:</span> {serviceableDistributor.email}
                    </p>
                  )}
                  <p className="text-sm">
                    <span className="text-muted-foreground">Services Pincode:</span> {order.shipping_pincode}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No distributor services pincode {order.shipping_pincode}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Order Items
          </CardTitle>
          <CardDescription>Products included in this order</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-center">Disc %</TableHead>
                  <TableHead className="text-right">Disc Amt</TableHead>
                  <TableHead className="text-right">Net Amount</TableHead>
                  <TableHead className="text-center">GST %</TableHead>
                  <TableHead className="text-right">GST Amt</TableHead>
                  <TableHead className="text-right">Gross Amt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map((item) => {
                  const itemSubtotal = item.quantity * item.unit_price
                  const netAmount = itemSubtotal - item.discount_amount
                  const itemGst = (netAmount * item.gst_percentage) / 100

                  return (
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
                      <TableCell className="text-right text-muted-foreground">
                        ₹{item.unit_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{itemSubtotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.discount_percent > 0 ? `${item.discount_percent.toFixed(2)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.discount_amount > 0 ? `₹${item.discount_amount.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{netAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.gst_percentage > 0 ? `${item.gst_percentage}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.gst_amount > 0 ? `₹${item.gst_amount.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{item.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Order Summary */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>
              {(() => {
                const totalItemDiscount = orderItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0)
                return totalItemDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Item Discounts:</span>
                    <span className="text-destructive">-₹{totalItemDiscount.toFixed(2)}</span>
                  </div>
                )
              })()}
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Discount:</span>
                  <span className="text-destructive">-₹{order.discount_amount.toFixed(2)}</span>
                </div>
              )}
              {order.cgst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST:</span>
                  <span>₹{order.cgst_amount.toFixed(2)}</span>
                </div>
              )}
              {order.sgst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST:</span>
                  <span>₹{order.sgst_amount.toFixed(2)}</span>
                </div>
              )}
              {order.igst_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IGST:</span>
                  <span>₹{order.igst_amount.toFixed(2)}</span>
                </div>
              )}
              {order.shipping_charges > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping:</span>
                  <span>₹{order.shipping_charges.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total:</span>
                <span>₹{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(order.customer_notes || order.order_notes || order.internal_notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Order Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.customer_notes && (
              <div>
                <p className="text-sm font-medium">Customer Notes:</p>
                <p className="text-sm text-muted-foreground">{order.customer_notes}</p>
              </div>
            )}
            {order.order_notes && (
              <div>
                <p className="text-sm font-medium">Order Notes:</p>
                <p className="text-sm text-muted-foreground">{order.order_notes}</p>
              </div>
            )}
            {order.internal_notes && (
              <div>
                <p className="text-sm font-medium">Internal Notes:</p>
                <p className="text-sm text-muted-foreground">{order.internal_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delivery Notes & Feedback */}
      {routeAssignment && (routeAssignment.delivery_notes || routeAssignment.customer_feedback || routeAssignment.delivery_proof_url) && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Notes & Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {routeAssignment.delivery_notes && (
              <div>
                <p className="text-sm font-medium">Delivery Notes:</p>
                <p className="text-sm text-muted-foreground">{routeAssignment.delivery_notes}</p>
              </div>
            )}
            {routeAssignment.customer_feedback && (
              <div>
                <p className="text-sm font-medium">Customer Feedback:</p>
                <p className="text-sm text-muted-foreground">{routeAssignment.customer_feedback}</p>
              </div>
            )}
            {routeAssignment.delivery_proof_url && (
              <div>
                <p className="text-sm font-medium">Delivery Proof:</p>
                <a
                  href={routeAssignment.delivery_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View Delivery Proof
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
