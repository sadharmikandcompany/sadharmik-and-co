"use client"

import { useEffect, useState } from "react"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Package,
  MapPin,
  Phone,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Navigation,
  Camera,
  Star,
  AlertCircle,
  MapPinned,
  PackageCheck,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { useUserRole } from "@/hooks/use-user-role"

type DeliveryAssignment = {
  id: string
  route_id: string
  order_id: string
  delivery_partner_id: string
  status: string
  sequence_number: number | null
  scheduled_delivery_date: string | null
  pickup_time: string | null
  delivery_time: string | null
  delivery_notes: string | null
  delivery_proof_url: string | null
  current_latitude: number | null
  current_longitude: number | null
  customer_rating: number | null
  customer_feedback: string | null
  collected_payment_method: string | null
  collected_amount: number | null
  created_at: string
  // Enriched fields
  route_name?: string
  order_number?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  customer_vip_number?: string | null
  shipping_full_address?: string | null
  shipping_room_number?: string
  shipping_floor?: string
  shipping_wing?: string
  shipping_flat_number?: string
  shipping_floor_wing?: string
  shipping_building_name?: string
  shipping_street_area?: string
  shipping_landmark?: string
  shipping_city?: string
  shipping_state?: string
  shipping_pincode?: string
  shipping_country?: string
  total_amount?: number
  subtotal?: number
  discount_amount?: number
  tax_amount?: number
  cgst_amount?: number
  sgst_amount?: number
  igst_amount?: number
  shipping_charges?: number
  order_status?: string
  payment_status?: string
  payment_method?: string
  order_date?: string
  customer_notes?: string
  order_items?: OrderItem[]
  invoice_number_gst?: string | null
  invoice_number_non_gst?: string | null
  is_gst_invoice?: boolean
}

type OrderItem = {
  id: string
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price: number
  discount_amount: number
  gst_amount: number
  total: number
}

const statusOptions = [
  { value: "assigned", label: "Assigned", color: "secondary", icon: Package },
  { value: "picked_up", label: "Picked Up", color: "outline", icon: CheckCircle2 },
  { value: "out_for_delivery", label: "Out for Delivery", color: "outline", icon: Navigation },
  { value: "delivered", label: "Delivered", color: "default", icon: CheckCircle2 },
  { value: "failed", label: "Failed", color: "destructive", icon: XCircle },
  { value: "returned", label: "Returned", color: "destructive", icon: XCircle },
]

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card Payment" },
  { value: "online", label: "Online Payment" },
  { value: "other", label: "Other" },
]

export default function MyDeliveriesPage() {
  const { userProfile, loading: userLoading } = useUserRole()
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<DeliveryAssignment | null>(null)
  const [updating, setUpdating] = useState(false)
  const [driverName, setDriverName] = useState<string>("")
  const [deliveryPartnerId, setDeliveryPartnerId] = useState<string | null>(null)
  const [homePincode, setHomePincode] = useState<string>("")
  const [serviceablePincodes, setServiceablePincodes] = useState<string[]>([])

  const [updateFormData, setUpdateFormData] = useState({
    status: "",
    delivery_notes: "",
    pickup_time: "",
    delivery_time: "",
    current_latitude: "",
    current_longitude: "",
    next_delivery_attempt: "",
    collected_payment_method: "",
    collected_amount: "",
  })

  const [isQuickUpdate, setIsQuickUpdate] = useState(false)
  const [deliveryOtp, setDeliveryOtp] = useState("")
  const [otpError, setOtpError] = useState("")

  useEffect(() => {
    if (!userLoading && userProfile) {
      fetchDriverInfo()
    }
  }, [userLoading, userProfile])

  useEffect(() => {
    if (deliveryPartnerId) {
      fetchMyAssignments()
    }
  }, [deliveryPartnerId])

  const fetchDriverInfo = async () => {
    if (!userProfile?.delivery_partner_id) {
      toast.error("No delivery partner linked to your account. Please contact admin.")
      setLoading(false)
      return
    }

    // Get delivery partner info
    const { data: partnerData, error } = await supabase
      .from("delivery_partners")
      .select("id, name, pincode, serviceable_pincodes")
      .eq("id", userProfile.delivery_partner_id)
      .single()

    if (error) {
      console.error("Error fetching delivery partner:", error)
      toast.error("Failed to fetch driver information")
      setLoading(false)
      return
    }

    if (partnerData) {
      setDeliveryPartnerId(partnerData.id)
      setDriverName(partnerData.name)
      setHomePincode(partnerData.pincode || "")
      setServiceablePincodes(partnerData.serviceable_pincodes || [])
    }
  }

  const fetchMyAssignments = async () => {
    if (!deliveryPartnerId) return

    setLoading(true)

    // Fetch only MY route assignments
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("route_assignments")
      .select("*")
      .eq("delivery_partner_id", deliveryPartnerId)
      .order("sequence_number", { ascending: true })

    if (assignmentsError) {
      console.error("Error fetching route assignments:", assignmentsError)
      toast.error("Failed to fetch your delivery assignments")
      setLoading(false)
      return
    }

    if (!assignmentsData || assignmentsData.length === 0) {
      setAssignments([])
      setLoading(false)
      return
    }

    // Fetch related data
    const routeIds = [...new Set(assignmentsData.map((a) => a.route_id))]
    const orderIds = [...new Set(assignmentsData.map((a) => a.order_id))]

    const [{ data: routesData }, { data: ordersData }] = await Promise.all([
      supabase.from("routes").select("id, route_name").in("id", routeIds),
      supabase.from("orders").select(`
        id, order_number, customer_id, total_amount, subtotal, discount_amount,
        tax_amount, cgst_amount, sgst_amount, igst_amount, shipping_charges,
        order_status, payment_status, payment_method, order_date, customer_notes,
        shipping_full_address, shipping_room_number, shipping_floor, shipping_wing, shipping_flat_number,
        shipping_floor_wing, shipping_building_name, shipping_street_area,
        shipping_landmark, shipping_city, shipping_state, shipping_pincode, shipping_country,
        invoice_number_gst, invoice_number_non_gst, is_gst_invoice
      `).in("id", orderIds),
    ])

    // Get customer IDs from orders
    const customerIds = [...new Set(ordersData?.map((o) => o.customer_id) || [])]
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, first_name, last_name, mobile_primary, email, vip_number")
      .in("id", customerIds)

    // Get order items for all orders
    const { data: orderItemsData } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, product_sku, quantity, unit_price, discount_amount, gst_amount, total")
      .in("order_id", orderIds)

    // Create lookup maps
    const routeMap = new Map(routesData?.map((r) => [r.id, r.route_name]))
    const orderMap = new Map(ordersData?.map((o) => [o.id, o]))
    const customerMap = new Map(customersData?.map((c) => [c.id, c]))

    // Group order items by order_id
    const orderItemsMap = new Map<string, OrderItem[]>()
    orderItemsData?.forEach((item) => {
      if (!orderItemsMap.has(item.order_id)) {
        orderItemsMap.set(item.order_id, [])
      }
      orderItemsMap.get(item.order_id)?.push(item)
    })

    // Enrich assignments with related data
    const enrichedAssignments = assignmentsData.map((assignment) => {
      const order = orderMap.get(assignment.order_id)
      const customer = order ? customerMap.get(order.customer_id) : null
      const items = orderItemsMap.get(assignment.order_id) || []

      return {
        ...assignment,
        route_name: routeMap.get(assignment.route_id),
        order_number: order?.order_number,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "Unknown",
        customer_phone: customer?.mobile_primary,
        customer_email: customer?.email,
        customer_vip_number: customer?.vip_number,
        shipping_full_address: order?.shipping_full_address,
        shipping_room_number: order?.shipping_room_number,
        shipping_floor: order?.shipping_floor,
        shipping_wing: order?.shipping_wing,
        shipping_flat_number: order?.shipping_flat_number,
        shipping_floor_wing: order?.shipping_floor_wing,
        shipping_building_name: order?.shipping_building_name,
        shipping_street_area: order?.shipping_street_area,
        shipping_landmark: order?.shipping_landmark,
        shipping_city: order?.shipping_city,
        shipping_state: order?.shipping_state,
        shipping_pincode: order?.shipping_pincode,
        shipping_country: order?.shipping_country,
        total_amount: order?.total_amount,
        subtotal: order?.subtotal,
        discount_amount: order?.discount_amount,
        tax_amount: order?.tax_amount,
        cgst_amount: order?.cgst_amount,
        sgst_amount: order?.sgst_amount,
        igst_amount: order?.igst_amount,
        shipping_charges: order?.shipping_charges,
        order_status: order?.order_status,
        payment_status: order?.payment_status,
        payment_method: order?.payment_method,
        order_date: order?.order_date,
        customer_notes: order?.customer_notes,
        order_items: items,
        invoice_number_gst: order?.invoice_number_gst,
        invoice_number_non_gst: order?.invoice_number_non_gst,
        is_gst_invoice: order?.is_gst_invoice,
      }
    })

    setAssignments(enrichedAssignments)
    setLoading(false)
  }

  const handleOpenDialog = (assignment: DeliveryAssignment, quickUpdate = false) => {
    console.log("📦 Opening dialog for order:")
    console.log("  Order ID:", assignment.order_id)
    console.log("  Order Number:", assignment.order_number)
    console.log("  Customer:", assignment.customer_name)

    // Show OTP for this order (last 3 digits of order number)
    if (assignment.order_number) {
      const otp = assignment.order_number.slice(-3)
      console.log("  🔑 OTP for this delivery (last 3 digits):", otp)
    }

    setSelectedAssignment(assignment)
    setIsQuickUpdate(quickUpdate)
    setDeliveryOtp("")
    setOtpError("")
    setUpdateFormData({
      status: assignment.status,
      delivery_notes: assignment.delivery_notes || "",
      pickup_time: assignment.pickup_time
        ? new Date(assignment.pickup_time).toISOString().slice(0, 16)
        : "",
      delivery_time: assignment.delivery_time
        ? new Date(assignment.delivery_time).toISOString().slice(0, 16)
        : "",
      current_latitude: assignment.current_latitude?.toString() || "",
      current_longitude: assignment.current_longitude?.toString() || "",
      next_delivery_attempt: "",
      collected_payment_method: assignment.collected_payment_method || "",
      collected_amount: assignment.collected_amount?.toString() || "",
    })
    setDialogOpen(true)
  }

  const getOrderOtp = (orderNumber: string): string => {
    const otp = orderNumber.slice(-3)
    console.log("🔐 OTP Debug Info:")
    console.log("  Order Number:", orderNumber)
    console.log("  Generated OTP (last 3 digits):", otp)
    return otp
  }

  const maskOrderNumber = (orderNumber: string): string => {
    if (orderNumber.length <= 3) return "***"
    return orderNumber.slice(0, -3) + "***"
  }

  const handleQuickStatusChange = async (assignment: DeliveryAssignment, newStatus: string) => {
    const currentTime = new Date().toISOString()

    const updateData: Record<string, unknown> = {
      status: newStatus,
      last_location_update: currentTime,
    }

    // Auto-set times based on status
    if (newStatus === "picked_up" && !assignment.pickup_time) {
      updateData.pickup_time = currentTime
    }
    if (newStatus === "delivered" && !assignment.delivery_time) {
      updateData.delivery_time = currentTime
    }

    // Auto-capture location if available
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          updateData.current_latitude = position.coords.latitude
          updateData.current_longitude = position.coords.longitude
          await performStatusUpdate(assignment.id, assignment.order_id, updateData, newStatus)
        },
        async () => {
          // If location fails, still update without it
          await performStatusUpdate(assignment.id, assignment.order_id, updateData, newStatus)
        }
      )
    } else {
      await performStatusUpdate(assignment.id, assignment.order_id, updateData, newStatus)
    }
  }

  const performStatusUpdate = async (
    assignmentId: string,
    orderId: string,
    updateData: Record<string, unknown>,
    newStatus: string
  ) => {
    try {
      const { error } = await supabase
        .from("route_assignments")
        .update(updateData)
        .eq("id", assignmentId)

      if (error) throw error

      // Update order status if delivered
      if (newStatus === "delivered") {
        await supabase
          .from("orders")
          .update({
            order_status: "delivered",
            delivered_date: updateData.delivery_time || new Date().toISOString()
          })
          .eq("id", orderId)
      }

      toast.success(`Status updated to ${statusOptions.find(s => s.value === newStatus)?.label}`)
      fetchMyAssignments()
    } catch (error: unknown) {
      console.error("Error updating status:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update status"
      toast.error(errorMessage)
    }
  }

  const handleGetCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUpdateFormData({
            ...updateFormData,
            current_latitude: position.coords.latitude.toFixed(6),
            current_longitude: position.coords.longitude.toFixed(6),
          })
          toast.success("Location captured successfully")
        },
        (error) => {
          console.error("Error getting location:", error)
          toast.error("Failed to get your location. Please enable location services.")
        }
      )
    } else {
      toast.error("Geolocation is not supported by your browser")
    }
  }

  const handleUpdateStatus = async () => {
    if (!selectedAssignment) return

    setUpdating(true)

    // Capture location before updating
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // Update form data with captured location
          const updatedFormData = {
            ...updateFormData,
            current_latitude: position.coords.latitude.toFixed(6),
            current_longitude: position.coords.longitude.toFixed(6),
          }
          await performUpdate(updatedFormData)
        },
        async (error) => {
          console.warn("Could not get location:", error)
          toast.warning("Location not captured. Updating without location.")
          await performUpdate(updateFormData)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      )
    } else {
      await performUpdate(updateFormData)
    }
  }

  const performUpdate = async (formData: typeof updateFormData) => {
    if (!selectedAssignment) return

    // Validate OTP if marking as delivered
    if (formData.status === "delivered") {
      if (!selectedAssignment.order_number) {
        console.log("❌ No order number found!")
        setOtpError("Order number not found. Cannot verify delivery.")
        setUpdating(false)
        return
      }

      const correctOtp = getOrderOtp(selectedAssignment.order_number)
      console.log("✅ OTP Validation:")
      console.log("  Entered OTP:", deliveryOtp)
      console.log("  Correct OTP:", correctOtp)
      console.log("  Match:", deliveryOtp === correctOtp)

      if (deliveryOtp !== correctOtp) {
        console.log("❌ OTP verification failed!")
        setOtpError("Incorrect OTP. Please ask customer for the last 3 digits of their Order Number.")
        setUpdating(false)
        return
      }
      console.log("✅ OTP verified successfully!")
    }

    // Validate required fields for failed status
    if (formData.status === "failed") {
      if (!formData.delivery_notes || formData.delivery_notes.trim() === "") {
        setOtpError("Please provide a reason why the delivery failed.")
        setUpdating(false)
        return
      }
    }

    try {
      const currentTime = new Date().toISOString()
      const updateData: Record<string, unknown> = {
        status: formData.status,
        delivery_notes: formData.delivery_notes || null,
        current_latitude: formData.current_latitude
          ? parseFloat(formData.current_latitude)
          : null,
        current_longitude: formData.current_longitude
          ? parseFloat(formData.current_longitude)
          : null,
        last_location_update: currentTime,
      }

      // Set pickup time when status is picked_up
      if (formData.status === "picked_up" && !selectedAssignment.pickup_time) {
        updateData.pickup_time = currentTime
      }

      // Set delivery time when status is delivered
      if (formData.status === "delivered" && !selectedAssignment.delivery_time) {
        updateData.delivery_time = currentTime
      }

      // Save payment collection details when delivered
      if (formData.status === "delivered") {
        updateData.collected_payment_method = formData.collected_payment_method || null
        updateData.collected_amount = formData.collected_amount
          ? parseFloat(formData.collected_amount)
          : null
      }

      // Set next delivery attempt when status is failed
      if (formData.status === "failed" && formData.next_delivery_attempt) {
        updateData.next_delivery_attempt = new Date(formData.next_delivery_attempt).toISOString()
        updateData.scheduled_delivery_date = new Date(formData.next_delivery_attempt).toISOString().split('T')[0]
      }

      const { error } = await supabase
        .from("route_assignments")
        .update(updateData)
        .eq("id", selectedAssignment.id)

      if (error) throw error

      // Also update order status if delivered
      if (formData.status === "delivered") {
        await supabase
          .from("orders")
          .update({
            order_status: "delivered",
            delivered_date: updateData.delivery_time || currentTime
          })
          .eq("id", selectedAssignment.order_id)
      }

      const locationInfo = updateData.current_latitude && updateData.current_longitude
        ? " (Location captured)"
        : " (No location)"

      toast.success(`Delivery status updated successfully${locationInfo}`)
      setDialogOpen(false)
      fetchMyAssignments()
    } catch (error: unknown) {
      console.error("Error updating delivery status:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update delivery status"
      toast.error(errorMessage)
    } finally {
      setUpdating(false)
    }
  }

  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch =
      assignment.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.route_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.shipping_pincode?.includes(searchTerm)

    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find((s) => s.value === status)
    if (!statusOption) return <Badge variant="secondary">{status}</Badge>

    const IconComponent = statusOption.icon

    return (
      <Badge
        variant={statusOption.color as "default" | "secondary" | "outline" | "destructive"}
        className="gap-1"
      >
        <IconComponent className="h-3 w-3" />
        {statusOption.label}
      </Badge>
    )
  }

  const getMyStats = () => {
    return {
      total: assignments.length,
      delivered: assignments.filter((a) => a.status === "delivered").length,
      inTransit: assignments.filter((a) => a.status === "out_for_delivery").length,
      pending: assignments.filter((a) => a.status === "assigned" || a.status === "picked_up").length,
      failed: assignments.filter((a) => a.status === "failed" || a.status === "returned").length,
    }
  }

  if (userLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <PackageCheck className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">My Deliveries</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!deliveryPartnerId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Account Not Linked
            </CardTitle>
            <CardDescription>
              Your account ({userProfile?.email}) is not linked to a delivery partner profile.
              Please contact your administrator to link your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">Need help?</p>
              <p className="text-muted-foreground">
                Your administrator needs to link your user account to a delivery partner profile in the Users management page.
                Once linked, you'll be able to see and manage your delivery orders here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = getMyStats()

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <PackageCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">My Deliveries</h1>
            <p className="text-sm text-muted-foreground">Welcome, {driverName}!</p>
          </div>
        </div>
      </div>

      {/* Serviceable Pincodes Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <MapPin className="h-4 w-4 md:h-5 md:w-5" />
            My Service Areas
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Pincodes you can deliver to</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:space-y-4">
            {homePincode && (
              <div>
                <div className="text-xs md:text-sm font-medium text-muted-foreground mb-2">Home Pincode</div>
                <Badge variant="default" className="text-sm md:text-base px-2 md:px-3 py-1 font-mono">
                  {homePincode}
                </Badge>
              </div>
            )}
            <div>
              <div className="text-xs md:text-sm font-medium text-muted-foreground mb-2">
                Serviceable Pincodes ({serviceablePincodes.length})
              </div>
              {serviceablePincodes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {serviceablePincodes.map((pincode, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-xs md:text-sm px-2 py-0.5 md:py-1 font-mono cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setSearchTerm(pincode)}
                      title={`Click to filter deliveries for ${pincode}`}
                    >
                      {pincode}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs md:text-sm text-muted-foreground italic">
                  No pincode restrictions - You can deliver to all areas
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Stats Card */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card className="overflow-hidden gap-0 py-0">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="text-xs md:text-sm font-medium text-muted-foreground">Pending</div>
              <div className="text-xl md:text-2xl font-bold text-orange-600">{stats.pending}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden gap-0 py-0">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="text-xs md:text-sm font-medium text-muted-foreground">In Transit</div>
              <div className="text-xl md:text-2xl font-bold text-blue-600">{stats.inTransit}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden gap-0 py-0">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="text-xs md:text-sm font-medium text-muted-foreground">Delivered</div>
              <div className="text-xl md:text-2xl font-bold text-green-600">{stats.delivered}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden gap-0 py-0">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <div className="text-xs md:text-sm font-medium text-muted-foreground">Failed</div>
              <div className="text-xl md:text-2xl font-bold text-red-600">{stats.failed}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Deliveries List */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg">My Delivery Orders</CardTitle>
          <CardDescription className="text-xs md:text-sm">Orders assigned to you for delivery</CardDescription>
          <div className="mt-3 md:mt-4 flex flex-col sm:flex-row flex-wrap gap-2 md:gap-4">
            <Input
              placeholder="Search order, customer, pincode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-sm text-sm"
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {filteredAssignments.length === 0 ? (
            <div className="py-8 text-center px-4">
              {assignments.length === 0 ? (
                <>
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No deliveries assigned yet</p>
                </>
              ) : (
                <p className="text-muted-foreground">No deliveries match your search</p>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-3">
                {filteredAssignments.map((assignment) => (
                  <Card
                    key={assignment.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden gap-0 py-0"
                    onClick={() => handleOpenDialog(assignment)}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Header Row */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          {assignment.sequence_number !== null && (
                            <Badge variant="outline" className="font-mono">
                              #{assignment.sequence_number}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {assignment.order_number ? maskOrderNumber(assignment.order_number) : "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>Invoice:</span>
                          <span className="font-mono font-medium">
                            {assignment.is_gst_invoice
                              ? (assignment.invoice_number_gst || "-")
                              : (assignment.invoice_number_non_gst || "-")
                            }
                          </span>
                          <Badge variant={assignment.is_gst_invoice ? "default" : "secondary"} className="text-xs">
                            {assignment.is_gst_invoice ? "GST" : "Non-GST"}
                          </Badge>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-medium text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {assignment.customer_name}
                          {assignment.customer_vip_number && (
                            <Badge variant="outline" className="text-xs font-mono ml-1">
                              VIP {assignment.customer_vip_number}
                            </Badge>
                          )}
                        </div>
                        {assignment.customer_phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <a
                              href={`tel:${assignment.customer_phone}`}
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {assignment.customer_phone}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Address */}
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="text-sm line-clamp-2">
                            {assignment.shipping_full_address
                              ? assignment.shipping_full_address
                              : (
                                <>
                                  {assignment.shipping_building_name && assignment.shipping_building_name !== 'N/A' && <span>{assignment.shipping_building_name}, </span>}
                                  {assignment.shipping_street_area && assignment.shipping_street_area !== 'N/A' && <span>{assignment.shipping_street_area}, </span>}
                                  {assignment.shipping_city}, {assignment.shipping_state}
                                </>
                              )}
                          </div>
                          {assignment.shipping_pincode && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {assignment.shipping_pincode}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Footer Row */}
                      <div className="pt-2 border-t space-y-2">
                        {/* Amount and Date */}
                        <div className="space-y-1">
                          {assignment.total_amount && (
                            <div className="font-semibold text-base">
                              ₹{assignment.total_amount.toLocaleString("en-IN")}
                            </div>
                          )}
                          {assignment.scheduled_delivery_date && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(assignment.scheduled_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </div>
                          )}
                        </div>
                        {/* Status Badge and Update Button */}
                        <div className="flex items-center justify-between gap-2">
                          <div>{getStatusBadge(assignment.status)}</div>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDialog(assignment)
                            }}
                          >
                            Update
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Seq</TableHead>
                      <TableHead className="min-w-[140px]">Order</TableHead>
                      <TableHead className="min-w-[160px]">Customer</TableHead>
                      <TableHead className="min-w-[200px]">Delivery Address</TableHead>
                      <TableHead className="min-w-[100px]">Amount</TableHead>
                      <TableHead className="min-w-[120px]">Status</TableHead>
                      <TableHead className="min-w-[120px]">Scheduled</TableHead>
                      <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment) => (
                      <TableRow
                        key={assignment.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenDialog(assignment)}
                      >
                        <TableCell>
                          {assignment.sequence_number !== null ? (
                            <Badge variant="outline" className="font-mono text-sm md:text-lg">
                              #{assignment.sequence_number}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Package className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground shrink-0" />
                              <span className="text-xs md:text-sm">{assignment.order_number ? maskOrderNumber(assignment.order_number) : "N/A"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>Invoice:</span>
                              <span className="font-mono font-medium">
                                {assignment.is_gst_invoice
                                  ? (assignment.invoice_number_gst || "-")
                                  : (assignment.invoice_number_non_gst || "-")
                                }
                              </span>
                              <Badge variant={assignment.is_gst_invoice ? "default" : "secondary"} className="text-xs">
                                {assignment.is_gst_invoice ? "GST" : "Non-GST"}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-1 text-xs md:text-sm">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{assignment.customer_name}</span>
                              {assignment.customer_vip_number && (
                                <Badge variant="outline" className="text-xs font-mono ml-1">
                                  VIP {assignment.customer_vip_number}
                                </Badge>
                              )}
                            </div>
                            {assignment.customer_phone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                <a href={`tel:${assignment.customer_phone}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                  {assignment.customer_phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="text-xs md:text-sm flex items-start gap-1">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <div className="line-clamp-2 font-medium">
                                {assignment.shipping_full_address
                                  ? assignment.shipping_full_address
                                  : (
                                    <>
                                      {assignment.shipping_building_name && assignment.shipping_building_name !== 'N/A' && <span>{assignment.shipping_building_name}, </span>}
                                      {assignment.shipping_street_area && assignment.shipping_street_area !== 'N/A' && <span>{assignment.shipping_street_area}, </span>}
                                      {assignment.shipping_city}, {assignment.shipping_state}
                                    </>
                                  )}
                              </div>
                            </div>
                            {assignment.shipping_pincode && (
                              <Badge variant="outline" className="mt-1 text-xs font-mono">
                                {assignment.shipping_pincode}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {assignment.total_amount ? (
                            <span className="font-medium text-xs md:text-sm whitespace-nowrap">
                              ₹{assignment.total_amount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                        <TableCell>
                          {assignment.scheduled_delivery_date ? (
                            <div className="flex items-center gap-1 text-xs md:text-sm whitespace-nowrap">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="hidden md:inline">
                                {new Date(assignment.scheduled_delivery_date).toLocaleDateString()}
                              </span>
                              <span className="md:hidden">
                                {new Date(assignment.scheduled_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDialog(assignment)
                            }}
                            className="text-xs px-2 md:px-4"
                          >
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <div className="mt-4 px-4 md:px-0 text-xs md:text-sm text-muted-foreground">
            Showing {filteredAssignments.length} of {assignments.length} deliveries
          </div>
        </CardContent>
      </Card>

      {/* Update Status Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Update Delivery Status</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Order {selectedAssignment?.order_number ? maskOrderNumber(selectedAssignment.order_number) : "N/A"} - {selectedAssignment?.customer_name}
            </DialogDescription>
          </DialogHeader>

          {selectedAssignment && (
            <div className="grid gap-3 md:gap-4 py-3 md:py-4">
              {/* Order Details */}
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-muted/50">
                <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                  <Package className="h-3 w-3 md:h-4 md:w-4" />
                  Order Information
                </h3>
                <div className="grid gap-2 md:gap-3 text-xs md:text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Order Number:</span>
                      <div className="font-medium">{selectedAssignment.order_number ? maskOrderNumber(selectedAssignment.order_number) : "N/A"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Invoice Number:</span>
                      <div className="font-medium font-mono">
                        {selectedAssignment.is_gst_invoice
                          ? (selectedAssignment.invoice_number_gst || "-")
                          : (selectedAssignment.invoice_number_non_gst || "-")
                        }
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Order Date:</span>
                      <div className="font-medium">
                        {selectedAssignment.order_date ? new Date(selectedAssignment.order_date).toLocaleDateString("en-IN") : "-"}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Invoice Type:</span>
                      <div>
                        <Badge variant={selectedAssignment.is_gst_invoice ? "default" : "secondary"}>
                          {selectedAssignment.is_gst_invoice ? "GST Invoice" : "Non-GST Invoice"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Order Status:</span>
                      <div><Badge variant="secondary">{selectedAssignment.order_status}</Badge></div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payment Status:</span>
                      <div><Badge variant="outline">{selectedAssignment.payment_status}</Badge></div>
                    </div>
                  </div>
                  {selectedAssignment.payment_method && (
                    <div>
                      <span className="text-muted-foreground">Payment Method:</span>
                      <span className="font-medium ml-2">{selectedAssignment.payment_method}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Details */}
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-muted/50">
                <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                  <User className="h-3 w-3 md:h-4 md:w-4" />
                  Customer Information
                </h3>
                <div className="grid gap-2 text-xs md:text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <div className="font-medium flex items-center gap-2">
                      {selectedAssignment.customer_name}
                      {selectedAssignment.customer_vip_number && (
                        <Badge variant="outline" className="text-xs font-mono">
                          VIP {selectedAssignment.customer_vip_number}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${selectedAssignment.customer_phone}`} className="hover:underline font-medium">
                      {selectedAssignment.customer_phone}
                    </a>
                  </div>
                  {selectedAssignment.customer_email && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <div className="font-medium">{selectedAssignment.customer_email}</div>
                    </div>
                  )}
                  {selectedAssignment.customer_notes && (
                    <div>
                      <span className="text-muted-foreground">Customer Notes:</span>
                      <div className="text-muted-foreground italic">{selectedAssignment.customer_notes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-muted/50">
                <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                  <MapPin className="h-3 w-3 md:h-4 md:w-4" />
                  Delivery Address
                </h3>
                <div className="text-xs md:text-sm">
                  {selectedAssignment.shipping_full_address ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-background rounded-md border-2 border-primary/20">
                        <address className="not-italic font-medium leading-relaxed">
                          {selectedAssignment.shipping_full_address}
                        </address>
                      </div>
                      {selectedAssignment.shipping_pincode && (
                        <Badge variant="outline" className="text-base px-3 py-1 font-mono">
                          {selectedAssignment.shipping_pincode}
                        </Badge>
                      )}
                    </div>
                  ) : selectedAssignment.shipping_city && selectedAssignment.shipping_city !== 'N/A' ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-background rounded-md border">
                        <address className="not-italic">
                          {selectedAssignment.shipping_room_number && selectedAssignment.shipping_room_number !== 'N/A' && <span>Room {selectedAssignment.shipping_room_number}, </span>}
                          {selectedAssignment.shipping_floor && selectedAssignment.shipping_floor !== 'N/A' && <span>Floor {selectedAssignment.shipping_floor}, </span>}
                          {selectedAssignment.shipping_wing && selectedAssignment.shipping_wing !== 'N/A' && <span>Wing {selectedAssignment.shipping_wing}, </span>}
                          {selectedAssignment.shipping_flat_number && selectedAssignment.shipping_flat_number !== 'N/A' && <span>{selectedAssignment.shipping_flat_number}, </span>}
                          {selectedAssignment.shipping_floor_wing && selectedAssignment.shipping_floor_wing !== 'N/A' && <span>{selectedAssignment.shipping_floor_wing}, </span>}
                          {selectedAssignment.shipping_building_name && selectedAssignment.shipping_building_name !== 'N/A' && (
                            <>
                              {selectedAssignment.shipping_building_name}
                              <br />
                            </>
                          )}
                          {selectedAssignment.shipping_street_area && selectedAssignment.shipping_street_area !== 'N/A' && (
                            <>
                              {selectedAssignment.shipping_street_area}
                              <br />
                            </>
                          )}
                          {selectedAssignment.shipping_landmark && selectedAssignment.shipping_landmark !== 'N/A' && (
                            <>
                              Near {selectedAssignment.shipping_landmark}
                              <br />
                            </>
                          )}
                          {selectedAssignment.shipping_city}, {selectedAssignment.shipping_state} - {selectedAssignment.shipping_pincode}
                          {selectedAssignment.shipping_country && selectedAssignment.shipping_country !== 'N/A' && (
                            <>
                              <br />
                              {selectedAssignment.shipping_country}
                            </>
                          )}
                        </address>
                      </div>
                      {selectedAssignment.shipping_pincode && (
                        <Badge variant="outline" className="text-base px-3 py-1 font-mono">
                          {selectedAssignment.shipping_pincode}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No address available</p>
                  )}
                </div>
              </div>

              {/* Order Items */}
              {selectedAssignment.order_items && selectedAssignment.order_items.length > 0 && (
                <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-muted/50">
                  <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                    <Package className="h-3 w-3 md:h-4 md:w-4" />
                    Order Items ({selectedAssignment.order_items.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedAssignment.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start p-2 bg-background rounded border text-sm">
                        <div className="flex-1">
                          <div className="font-medium">{item.product_name}</div>
                          {item.product_sku && (
                            <div className="text-xs text-muted-foreground">SKU: {item.product_sku}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Qty: {item.quantity} × ₹{item.unit_price.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">₹{item.total.toFixed(2)}</div>
                          {item.discount_amount > 0 && (
                            <div className="text-xs text-destructive">-₹{item.discount_amount.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="rounded-lg border p-3 md:p-4 space-y-2 md:space-y-3 bg-muted/50">
                <h3 className="font-semibold text-sm md:text-base">Payment Summary</h3>
                <div className="space-y-2 text-xs md:text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>₹{selectedAssignment.subtotal?.toFixed(2) || "0.00"}</span>
                  </div>
                  {selectedAssignment.discount_amount && selectedAssignment.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="text-destructive">-₹{selectedAssignment.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedAssignment.cgst_amount && selectedAssignment.cgst_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CGST:</span>
                      <span>₹{selectedAssignment.cgst_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedAssignment.sgst_amount && selectedAssignment.sgst_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SGST:</span>
                      <span>₹{selectedAssignment.sgst_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedAssignment.igst_amount && selectedAssignment.igst_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IGST:</span>
                      <span>₹{selectedAssignment.igst_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedAssignment.shipping_charges && selectedAssignment.shipping_charges > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping:</span>
                      <span>₹{selectedAssignment.shipping_charges.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold text-base">
                    <span>Total Collection Amount:</span>
                    <span className="text-green-600">₹{selectedAssignment.total_amount?.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}</span>
                  </div>
                </div>
              </div>

              {/* Payment Collection Info - Show if already collected */}
              {selectedAssignment.collected_payment_method && (
                <div className="rounded-lg border p-4 space-y-2 bg-green-50 dark:bg-green-950 border-green-500/50">
                  <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Payment Collected
                  </h3>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Method:</span>
                      <span className="font-medium capitalize">
                        {paymentMethodOptions.find(m => m.value === selectedAssignment.collected_payment_method)?.label || selectedAssignment.collected_payment_method}
                      </span>
                    </div>
                    {selectedAssignment.collected_amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount Collected:</span>
                        <span className="font-bold text-green-600">
                          ₹{selectedAssignment.collected_amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedAssignment.customer_rating && (
                <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold">Customer Rating: {selectedAssignment.customer_rating}/5</span>
                  </div>
                  {selectedAssignment.customer_feedback && (
                    <p className="text-sm text-muted-foreground italic">{selectedAssignment.customer_feedback}</p>
                  )}
                </div>
              )}

              {/* Status Update - Quick Action Buttons */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Update Delivery Status</Label>
                  <Badge variant="outline" className="text-sm">
                    {statusOptions.find(s => s.value === updateFormData.status)?.label}
                  </Badge>
                </div>

                {/* Suggested Next Actions */}
                <div className="space-y-2">
                  {updateFormData.status === "assigned" && (
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      className="w-full h-16 text-base gap-3 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        const currentTime = new Date().toISOString().slice(0, 16)
                        setUpdateFormData({ ...updateFormData, status: "picked_up", pickup_time: currentTime })
                      }}
                    >
                      <CheckCircle2 className="h-6 w-6" />
                      <span>Mark as Picked Up</span>
                    </Button>
                  )}

                  {updateFormData.status === "picked_up" && (
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      className="w-full h-16 text-base gap-3 bg-orange-600 hover:bg-orange-700"
                      onClick={() => {
                        setUpdateFormData({ ...updateFormData, status: "out_for_delivery" })
                      }}
                    >
                      <Navigation className="h-6 w-6" />
                      <span>Mark as Out for Delivery</span>
                    </Button>
                  )}

                  {updateFormData.status === "out_for_delivery" && (
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      className="w-full h-16 text-base gap-3 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        const currentTime = new Date().toISOString().slice(0, 16)
                        setUpdateFormData({ ...updateFormData, status: "delivered", delivery_time: currentTime })
                      }}
                    >
                      <CheckCircle2 className="h-6 w-6" />
                      <span>Mark as Delivered</span>
                    </Button>
                  )}
                </div>

                {/* All Status Options (Collapsed) */}
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <span>Show all status options</span>
                    <span className="group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {statusOptions.map((status) => {
                      const IconComponent = status.icon
                      const isCurrentStatus = updateFormData.status === status.value

                      return (
                        <Button
                          key={status.value}
                          type="button"
                          variant={isCurrentStatus ? "default" : "outline"}
                          size="lg"
                          className={`justify-start gap-2 h-14 ${isCurrentStatus ? "ring-2 ring-primary" : ""}`}
                          onClick={() => {
                            const currentTime = new Date().toISOString().slice(0, 16)
                            const updates: typeof updateFormData = { ...updateFormData, status: status.value }

                            // Auto-set pickup time when changing to picked_up
                            if (status.value === "picked_up" && !selectedAssignment?.pickup_time) {
                              updates.pickup_time = currentTime
                            }

                            // Auto-set delivery time when changing to delivered
                            if (status.value === "delivered" && !selectedAssignment?.delivery_time) {
                              updates.delivery_time = currentTime
                            }

                            setUpdateFormData(updates)
                          }}
                        >
                          <IconComponent className="h-5 w-5" />
                          <span className="text-sm">{status.label}</span>
                        </Button>
                      )
                    })}
                  </div>
                </details>
              </div>

              {/* Time Tracking - Read Only */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Pickup Time</Label>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/50 min-h-[40px]">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedAssignment?.pickup_time || updateFormData.pickup_time
                        ? new Date(selectedAssignment?.pickup_time || updateFormData.pickup_time).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })
                        : "Not picked up yet"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Delivery Time</Label>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/50 min-h-[40px]">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedAssignment?.delivery_time || updateFormData.delivery_time
                        ? new Date(selectedAssignment?.delivery_time || updateFormData.delivery_time).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })
                        : "Not delivered yet"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Current Location</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGetCurrentLocation}
                    className="gap-2"
                  >
                    <MapPinned className="h-4 w-4" />
                    Get Current Location
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="0.000001"
                      placeholder="e.g., 19.0760"
                      value={updateFormData.current_latitude}
                      onChange={(e) =>
                        setUpdateFormData({ ...updateFormData, current_latitude: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="0.000001"
                      placeholder="e.g., 72.8777"
                      value={updateFormData.current_longitude}
                      onChange={(e) =>
                        setUpdateFormData({ ...updateFormData, current_longitude: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Delivery OTP - Only shown when status is "delivered" */}
              {updateFormData.status === "delivered" && (
                <>
                  <div className="space-y-2 rounded-lg border-2 border-primary/50 p-4 bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      <Label htmlFor="delivery_otp" className="text-base font-semibold">
                        Delivery Verification Required
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Ask the customer for the last 3 digits of their Order Number to confirm delivery.
                    </p>
                    <Input
                      id="delivery_otp"
                      type="text"
                      maxLength={3}
                      placeholder="Enter 3-digit OTP"
                      value={deliveryOtp}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "")
                        console.log("🔢 OTP Input changed:", value)
                        setDeliveryOtp(value)
                        setOtpError("")
                      }}
                      className={`text-center text-2xl font-mono tracking-widest ${otpError ? "border-red-500" : ""}`}
                    />
                    {otpError && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        {otpError}
                      </p>
                    )}
                  </div>

                  {/* Payment Collection - Only shown when status is "delivered" */}
                  <div className="space-y-3 rounded-lg border-2 border-green-500/50 p-4 bg-green-50 dark:bg-green-950">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <Label className="text-base font-semibold">
                        Payment Collection Details
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Record how the customer paid for this order.
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="collected_payment_method">Payment Method</Label>
                      <Select
                        value={updateFormData.collected_payment_method}
                        onValueChange={(value) =>
                          setUpdateFormData({ ...updateFormData, collected_payment_method: value })
                        }
                      >
                        <SelectTrigger id="collected_payment_method" className="bg-background">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethodOptions.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="collected_amount">Amount Collected (₹)</Label>
                      <Input
                        id="collected_amount"
                        type="number"
                        step="0.01"
                        placeholder="Enter amount collected"
                        value={updateFormData.collected_amount}
                        onChange={(e) =>
                          setUpdateFormData({ ...updateFormData, collected_amount: e.target.value })
                        }
                        className="bg-background"
                      />
                      {selectedAssignment && selectedAssignment.total_amount && (
                        <p className="text-xs text-muted-foreground">
                          Expected amount: ₹{selectedAssignment.total_amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Next Delivery Attempt - Only shown when status is "failed" */}
              {updateFormData.status === "failed" && (
                <div className="space-y-2 rounded-lg border-2 border-orange-500/50 p-4 bg-orange-50 dark:bg-orange-950">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <Label htmlFor="next_delivery_attempt" className="text-base font-semibold">
                      Schedule Next Delivery Attempt
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Select when to attempt this delivery again.
                  </p>
                  <Input
                    id="next_delivery_attempt"
                    type="datetime-local"
                    value={updateFormData.next_delivery_attempt}
                    onChange={(e) =>
                      setUpdateFormData({ ...updateFormData, next_delivery_attempt: e.target.value })
                    }
                    min={new Date().toISOString().slice(0, 16)}
                    className="text-base"
                  />
                </div>
              )}

              {/* Delivery Notes */}
              <div className="space-y-2">
                <Label htmlFor="delivery_notes">Delivery Notes {updateFormData.status === "failed" && <span className="text-red-600">* (Required for failed deliveries)</span>}</Label>
                <Textarea
                  id="delivery_notes"
                  placeholder={updateFormData.status === "failed"
                    ? "Explain why delivery failed (e.g., customer not available, wrong address, etc.)"
                    : "Add notes about the delivery (e.g., met customer, left at security, etc.)"}
                  value={updateFormData.delivery_notes}
                  onChange={(e) =>
                    setUpdateFormData({ ...updateFormData, delivery_notes: e.target.value })
                  }
                  rows={3}
                  className={updateFormData.status === "failed" && !updateFormData.delivery_notes ? "border-red-500" : ""}
                />
              </div>

              {/* Delivery Proof */}
              {selectedAssignment.delivery_proof_url && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Delivery Proof
                  </Label>
                  <div className="rounded-md border p-2">
                    <a
                      href={selectedAssignment.delivery_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View Proof of Delivery
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto text-sm">
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updating} className="w-full sm:w-auto text-sm">
              {updating ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
