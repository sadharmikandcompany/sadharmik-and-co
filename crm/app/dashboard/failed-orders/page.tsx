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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ArrowLeft,
  RefreshCcw,
  UserCheck,
  AlertTriangle,
  Clock,
  ChevronDown,
  ExternalLink,
  MoreVertical,
  X,
  Download,
  Edit,
  XCircle,
  Calendar as CalendarIconLucide,
  Check,
  Pencil
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { format, addHours, startOfTomorrow, isToday, startOfToday, endOfToday } from "date-fns"
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
  shipping_full_address: string | null
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  is_priority: boolean
  order_date: string
  created_at: string
  invoice_number_gst?: string | null
  invoice_number_non_gst?: string | null
  is_gst_invoice?: boolean
  serviceable_distributor_name?: string | null
  serviceable_distributor_id?: string | null
  delivery_partner_id?: string | null
  delivery_partner_name?: string | null
  delivery_partner_mobile?: string | null
  assigned_to_delivery_at?: string | null
  failed_at?: string | null
  failure_reason?: string | null
  failed_attempts?: number
  next_delivery_at?: string | null
}

type DeliveryPartner = {
  id: string
  name: string
  mobile: string
  is_active: boolean
  is_available: boolean
  serviceable_pincodes: string[] | null
  total_deliveries: number
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

export default function FailedOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [driverFilter, setDriverFilter] = useState<string>("all")
  const [showTodayDeliveries, setShowTodayDeliveries] = useState(false)

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})

  // Delivery partners state
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([])
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null)

  // Reassignment dialog state
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false)
  const [selectedOrderForReassign, setSelectedOrderForReassign] = useState<Order | null>(null)
  const [reassignNote, setReassignNote] = useState("")
  const [selectedNewDriver, setSelectedNewDriver] = useState<string>("")
  const [nextDeliveryDate, setNextDeliveryDate] = useState<Date | undefined>(undefined)
  const [nextDeliveryTime, setNextDeliveryTime] = useState<string>("10:00")

  // Inline edit state
  const [editingField, setEditingField] = useState<{orderId: string, field: string} | null>(null)
  const [editValues, setEditValues] = useState<{
    address?: string
    nextDeliveryDate?: Date
    nextDeliveryTime?: string
    attempts?: number
  }>({})
  const [savingField, setSavingField] = useState(false)

  useEffect(() => {
    fetchFailedOrders()
    fetchDeliveryPartners()
  }, [])

  const fetchDeliveryPartners = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_partners")
        .select("id, name, mobile, is_active, is_available, serviceable_pincodes, total_deliveries")
        .eq("is_active", true)
        .order("name")

      if (error) throw error

      setDeliveryPartners(data || [])
    } catch (error) {
      console.error("Error fetching delivery partners:", error)
      toast.error("Failed to fetch delivery partners")
    }
  }

  const fetchFailedOrders = async () => {
    try {
      setLoading(true)

      // Fetch failed orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("order_status", "failed")
        .order("created_at", { ascending: false })

      if (ordersError) {
        console.error("Error fetching failed orders:", ordersError)
        toast.error(`Failed to fetch orders: ${ordersError.message}`)
        setLoading(false)
        return
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([])
        setLoading(false)
        return
      }

      // Extract unique IDs
      const customerIds = ordersData
        .filter((order: any) => order.customer_id)
        .map((order: any) => order.customer_id)
      const retailerIds = ordersData
        .filter((order: any) => order.retailer_id)
        .map((order: any) => order.retailer_id)
      const distributorIds = ordersData
        .filter((order: any) => order.distributor_id)
        .map((order: any) => order.distributor_id)
      const deliveryPartnerIds = ordersData
        .filter((order: any) => order.delivery_partner_id)
        .map((order: any) => order.delivery_partner_id)

      // Extract unique shipping pincodes for distributor matching
      const shippingPincodes = [...new Set(
        ordersData
          .filter((order: any) => order.shipping_pincode)
          .map((order: any) => order.shipping_pincode)
      )]

      // Fetch related data in parallel
      const [customersResult, retailersResult, distributorsResult, deliveryPartnersResult, serviceableDistributorsResult] = await Promise.all([
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
        deliveryPartnerIds.length > 0
          ? supabase
              .from("delivery_partners")
              .select("id, name, mobile")
              .in("id", deliveryPartnerIds)
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
      const deliveryPartnersMap = new Map(
        (deliveryPartnersResult.data || []).map((dp: any) => [dp.id, dp])
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

        // Get delivery partner details
        const deliveryPartner = order.delivery_partner_id
          ? deliveryPartnersMap.get(order.delivery_partner_id)
          : undefined

        return {
          ...order,
          customer_name,
          customer_phone,
          customer_full_address,
          customer_vip_number,
          serviceable_distributor_name: serviceableDistributor?.name || null,
          serviceable_distributor_id: serviceableDistributor?.id || null,
          delivery_partner_name: deliveryPartner?.name || null,
          delivery_partner_mobile: deliveryPartner?.mobile || null,
        }
      })

      setOrders(ordersWithDetails || [])
      setLoading(false)
    } catch (error) {
      console.error("Unexpected error in fetchFailedOrders:", error)
      toast.error("An unexpected error occurred while fetching failed orders")
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

  const handleRetryDelivery = async (orderId: string, orderNumber: string) => {
    try {
      // Set next delivery to tomorrow at 10 AM by default
      const nextDeliveryDateTime = startOfTomorrow()
      nextDeliveryDateTime.setHours(10, 0, 0, 0)

      const { error } = await supabase
        .from("orders")
        .update({
          order_status: "processing",
          failed_at: null,
          failure_reason: null,
          next_delivery_at: nextDeliveryDateTime.toISOString()
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Order ${orderNumber} has been marked for retry on ${format(nextDeliveryDateTime, 'PP')}`)
      fetchFailedOrders() // Refresh the list
    } catch (error) {
      console.error("Error retrying order:", error)
      toast.error("Failed to retry order")
    }
  }

  const openReassignDialog = (order: Order) => {
    setSelectedOrderForReassign(order)
    setSelectedNewDriver("")
    setReassignNote("")
    // Set default next delivery to tomorrow at 10 AM
    setNextDeliveryDate(startOfTomorrow())
    setNextDeliveryTime("10:00")
    setReassignDialogOpen(true)
  }

  const handleReassignDriver = async () => {
    if (!selectedOrderForReassign || !selectedNewDriver) {
      toast.error("Please select a driver")
      return
    }

    if (!nextDeliveryDate) {
      toast.error("Please select a next delivery date")
      return
    }

    try {
      setAssigningDriver(selectedOrderForReassign.id)

      // Combine date and time for next delivery
      const [hours, minutes] = nextDeliveryTime.split(":").map(Number)
      const nextDeliveryDateTime = new Date(nextDeliveryDate)
      nextDeliveryDateTime.setHours(hours, minutes, 0, 0)

      // Update the order with new driver and reset failed status
      const { error } = await supabase
        .from("orders")
        .update({
          delivery_partner_id: selectedNewDriver,
          assigned_to_delivery_at: new Date().toISOString(),
          order_status: "processing",
          failed_at: null,
          failure_reason: reassignNote || null,
          failed_attempts: (selectedOrderForReassign.failed_attempts || 0) + 1,
          next_delivery_at: nextDeliveryDateTime.toISOString()
        })
        .eq("id", selectedOrderForReassign.id)

      if (error) throw error

      const driver = deliveryPartners.find(d => d.id === selectedNewDriver)
      toast.success(`Order ${selectedOrderForReassign.order_number} reassigned to ${driver?.name || 'driver'} for ${format(nextDeliveryDateTime, 'PPp')}`)

      setReassignDialogOpen(false)
      setSelectedOrderForReassign(null)
      setSelectedNewDriver("")
      setReassignNote("")
      setNextDeliveryDate(undefined)
      setNextDeliveryTime("10:00")

      fetchFailedOrders() // Refresh the list
    } catch (error) {
      console.error("Error reassigning driver:", error)
      toast.error("Failed to reassign driver")
    } finally {
      setAssigningDriver(null)
    }
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

  const handlePermanentCancel = async (orderId: string, orderNumber: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          order_status: "cancelled",
          cancelled_at: new Date().toISOString()
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Order ${orderNumber} has been permanently cancelled`)
      fetchFailedOrders() // Refresh the list
    } catch (error) {
      console.error("Error cancelling order:", error)
      toast.error("Failed to cancel order")
    }
  }

  // Inline edit functions
  const startInlineEdit = (orderId: string, field: string, currentValue: any) => {
    setEditingField({ orderId, field })

    if (field === 'address') {
      setEditValues({ address: currentValue })
    } else if (field === 'nextDelivery') {
      const date = currentValue ? new Date(currentValue) : new Date()
      const time = currentValue
        ? format(new Date(currentValue), 'HH:mm')
        : '10:00'
      setEditValues({ nextDeliveryDate: date, nextDeliveryTime: time })
    } else if (field === 'attempts') {
      setEditValues({ attempts: currentValue || 0 })
    }
  }

  const cancelInlineEdit = () => {
    setEditingField(null)
    setEditValues({})
  }

  const saveInlineEdit = async (orderId: string, field: string) => {
    setSavingField(true)

    try {
      let updateData: any = {}

      if (field === 'address') {
        updateData.shipping_full_address = editValues.address
      } else if (field === 'nextDelivery') {
        if (editValues.nextDeliveryDate && editValues.nextDeliveryTime) {
          const [hours, minutes] = editValues.nextDeliveryTime.split(':').map(Number)
          const nextDeliveryDateTime = new Date(editValues.nextDeliveryDate)
          nextDeliveryDateTime.setHours(hours, minutes, 0, 0)
          updateData.next_delivery_at = nextDeliveryDateTime.toISOString()
        }
      } else if (field === 'attempts') {
        updateData.failed_attempts = editValues.attempts
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)

      if (error) throw error

      toast.success(`${field === 'address' ? 'Address' : field === 'nextDelivery' ? 'Next delivery' : 'Attempts'} updated successfully`)

      setEditingField(null)
      setEditValues({})
      fetchFailedOrders() // Refresh the list
    } catch (error) {
      console.error('Error saving inline edit:', error)
      toast.error('Failed to save changes')
    } finally {
      setSavingField(false)
    }
  }

  // Get available drivers for an order
  const getAvailableDriversForOrder = (order: Order): DeliveryPartner[] => {
    if (!order.shipping_pincode) return deliveryPartners

    return deliveryPartners.filter(driver => {
      // Exclude the current driver who failed
      if (driver.id === order.delivery_partner_id) {
        return false
      }

      if (!driver.serviceable_pincodes || driver.serviceable_pincodes.length === 0) {
        return true // If no pincodes specified, driver can service all areas
      }
      return driver.serviceable_pincodes.includes(order.shipping_pincode)
    })
  }

  const filteredOrders = orders.filter((order) => {
    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.delivery_partner_name && order.delivery_partner_name.toLowerCase().includes(searchTerm.toLowerCase()))

    // Date range filter
    const orderDate = new Date(order.failed_at || order.created_at)
    const matchesDateFrom = !dateFrom || orderDate >= dateFrom
    const matchesDateTo = !dateTo || orderDate <= dateTo

    // Driver filter
    const matchesDriver =
      driverFilter === "all" ||
      (driverFilter === "unassigned" && !order.delivery_partner_id) ||
      order.delivery_partner_id === driverFilter

    // Today's deliveries filter
    const matchesTodayDeliveries = !showTodayDeliveries ||
      (order.next_delivery_at && isToday(new Date(order.next_delivery_at)))

    return matchesSearch && matchesDateFrom && matchesDateTo && matchesDriver && matchesTodayDeliveries
  })

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setDriverFilter("all")
    setSearchTerm("")
    setShowTodayDeliveries(false)
  }

  const hasActiveFilters =
    dateFrom || dateTo || driverFilter !== "all" || searchTerm !== "" || showTodayDeliveries

  // Count orders scheduled for today
  const todayDeliveryCount = orders.filter(order =>
    order.next_delivery_at && isToday(new Date(order.next_delivery_at))
  ).length

  // Prepare export data
  const exportData = filteredOrders.map(order => ({
    'Order Number': order.order_number,
    'Customer': order.customer_name || 'Unknown',
    'Phone': order.customer_phone || '',
    'Shipping Address': order.shipping_full_address || `${order.shipping_city}, ${order.shipping_state}`,
    'Pincode': order.shipping_pincode || '',
    'Failed Driver': order.delivery_partner_name || 'Not assigned',
    'Driver Phone': order.delivery_partner_mobile || '',
    'Failed At': order.failed_at ? format(new Date(order.failed_at), 'PPP') : 'Unknown',
    'Next Delivery': order.next_delivery_at ? format(new Date(order.next_delivery_at), 'PPp') : 'Not scheduled',
    'Failure Reason': order.failure_reason || 'No reason provided',
    'Attempts': order.failed_attempts || 1,
    'Amount': `₹${order.total_amount.toFixed(2)}`,
    'Original Order Date': format(new Date(order.order_date || order.created_at), 'PPP')
  }))

  const exportColumns = [
    { header: 'Order #', dataKey: 'Order Number' },
    { header: 'Customer', dataKey: 'Customer' },
    { header: 'Phone', dataKey: 'Phone' },
    { header: 'Address', dataKey: 'Shipping Address' },
    { header: 'Pincode', dataKey: 'Pincode' },
    { header: 'Failed Driver', dataKey: 'Failed Driver' },
    { header: 'Failed At', dataKey: 'Failed At' },
    { header: 'Next Delivery', dataKey: 'Next Delivery' },
    { header: 'Reason', dataKey: 'Failure Reason' },
    { header: 'Attempts', dataKey: 'Attempts' },
    { header: 'Amount', dataKey: 'Amount' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Failed Orders</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-destructive/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Failed Orders</h1>
            <p className="text-sm text-muted-foreground">Manage and reassign failed delivery attempts</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/orders")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
          <ExportButtons
            data={exportData}
            filename="failed-orders"
            columns={exportColumns}
            pdfTitle="Failed Orders Report"
          />
          <Button
            onClick={fetchFailedOrders}
            variant="outline"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Failed */}
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardHeader>
            <CardDescription>Total Failed</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {orders.length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Orders requiring attention
          </CardContent>
        </Card>

        {/* Unassigned */}
        <Card>
          <CardHeader>
            <CardDescription>Unassigned</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {orders.filter(o => !o.delivery_partner_id).length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <UserCheck className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Need driver assignment
          </CardContent>
        </Card>

        {/* Multiple Attempts */}
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader>
            <CardDescription>Multiple Attempts</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
              {orders.filter(o => (o.failed_attempts || 0) > 1).length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
                <RefreshCcw className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Failed more than once
          </CardContent>
        </Card>

        {/* Today's Failures */}
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardDescription>Today&apos;s Failures</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {orders.filter(o => {
                const failedDate = o.failed_at ? new Date(o.failed_at) : new Date(o.created_at)
                const today = new Date()
                return failedDate.toDateString() === today.toDateString()
              }).length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Failed today
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 max-w-full">
        <CardHeader>
          <CardTitle>Failed Orders List</CardTitle>
          <CardDescription>
            <span>Orders that failed delivery and need to be reassigned or cancelled.</span>
            <span className="ml-2 inline-flex items-center gap-1 text-xs">
              <Pencil className="h-3 w-3" />
              Click on address, next delivery, or attempts to edit inline
            </span>
          </CardDescription>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[250px]"
              />

              {/* Driver Filter */}
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by Driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectSeparator />
                  {deliveryPartners.map(driver => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
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

              <Button
                variant={showTodayDeliveries ? "default" : "outline"}
                onClick={() => setShowTodayDeliveries(!showTodayDeliveries)}
                className="gap-2"
              >
                <CalendarIconLucide className="h-4 w-4" />
                Today's Deliveries
                {todayDeliveryCount > 0 && (
                  <Badge variant={showTodayDeliveries ? "secondary" : "default"} className="ml-1">
                    {todayDeliveryCount}
                  </Badge>
                )}
              </Button>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          <div className="w-0 min-w-full max-w-full overflow-hidden">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Order Info</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Delivery Address</TableHead>
                  <TableHead>Failed Driver</TableHead>
                  <TableHead>Failure Details</TableHead>
                  <TableHead>Next Delivery</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      <div className="py-8">
                        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium">No failed orders found</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          All orders are being processed successfully
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const isExpanded = expandedRows.has(order.id)
                    const items = orderItems[order.id] || []

                    return (
                      <React.Fragment key={order.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
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
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span>{order.customer_name}</span>
                                {order.customer_vip_number && (
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {order.customer_vip_number}
                                  </Badge>
                                )}
                              </div>
                              {order.customer_phone && (
                                <span className="text-xs text-muted-foreground">{order.customer_phone}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {editingField?.orderId === order.id && editingField?.field === 'address' ? (
                              <div className="max-w-xs">
                                <div className="flex gap-1">
                                  <Textarea
                                    value={editValues.address || ''}
                                    onChange={(e) => setEditValues({ ...editValues, address: e.target.value })}
                                    className="min-h-[60px] text-sm"
                                    disabled={savingField}
                                    autoFocus
                                  />
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => saveInlineEdit(order.id, 'address')}
                                      disabled={savingField}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={cancelInlineEdit}
                                      disabled={savingField}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="max-w-xs group relative">
                                <div
                                  className="truncate font-medium cursor-pointer hover:bg-muted/50 p-1 rounded"
                                  title={order.shipping_full_address || `${order.shipping_city}, ${order.shipping_state}`}
                                  onClick={() => startInlineEdit(order.id, 'address', order.shipping_full_address || `${order.shipping_city}, ${order.shipping_state}`)}
                                >
                                  {order.shipping_full_address
                                    ? order.shipping_full_address
                                    : `${order.shipping_city}, ${order.shipping_state}`}
                                  <Pencil className="h-3 w-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                {order.shipping_pincode && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    PIN: {order.shipping_pincode}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {order.delivery_partner_name ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{order.delivery_partner_name}</span>
                                {order.delivery_partner_mobile && (
                                  <span className="text-xs text-muted-foreground">{order.delivery_partner_mobile}</span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                No driver assigned
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm">
                                {order.failed_at ? (
                                  <span className="text-destructive">
                                    Failed: {format(new Date(order.failed_at), 'PP')}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">No failure date</span>
                                )}
                              </div>
                              {order.failure_reason && (
                                <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={order.failure_reason}>
                                  {order.failure_reason}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {editingField?.orderId === order.id && editingField?.field === 'nextDelivery' ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="h-8 text-xs justify-start"
                                        disabled={savingField}
                                      >
                                        <CalendarIconLucide className="mr-1 h-3 w-3" />
                                        {editValues.nextDeliveryDate
                                          ? format(editValues.nextDeliveryDate, 'PP')
                                          : 'Select date'}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                        mode="single"
                                        selected={editValues.nextDeliveryDate}
                                        onSelect={(date) => setEditValues({ ...editValues, nextDeliveryDate: date })}
                                        disabled={(date) => date < new Date()}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="flex gap-1 items-center">
                                  <Input
                                    type="time"
                                    value={editValues.nextDeliveryTime || '10:00'}
                                    onChange={(e) => setEditValues({ ...editValues, nextDeliveryTime: e.target.value })}
                                    className="h-8 w-24 text-xs"
                                    disabled={savingField}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => saveInlineEdit(order.id, 'nextDelivery')}
                                    disabled={savingField}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={cancelInlineEdit}
                                    disabled={savingField}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 group cursor-pointer hover:bg-muted/50 p-1 rounded"
                                   onClick={() => startInlineEdit(order.id, 'nextDelivery', order.next_delivery_at)}>
                                {order.next_delivery_at ? (
                                  <>
                                    <span className="text-sm font-medium">
                                      {format(new Date(order.next_delivery_at), 'PP')}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(order.next_delivery_at), 'p')}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not scheduled</span>
                                )}
                                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {editingField?.orderId === order.id && editingField?.field === 'attempts' ? (
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={editValues.attempts || 0}
                                  onChange={(e) => setEditValues({ ...editValues, attempts: parseInt(e.target.value) || 0 })}
                                  className="h-7 w-16 text-center text-xs"
                                  disabled={savingField}
                                  autoFocus
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => saveInlineEdit(order.id, 'attempts')}
                                  disabled={savingField}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={cancelInlineEdit}
                                  disabled={savingField}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                className="inline-flex items-center gap-1 group cursor-pointer"
                                onClick={() => startInlineEdit(order.id, 'attempts', order.failed_attempts || 1)}
                              >
                                <Badge
                                  variant={order.failed_attempts && order.failed_attempts > 1 ? "destructive" : "secondary"}
                                  className="hover:bg-muted/50"
                                >
                                  {order.failed_attempts || 1}
                                </Badge>
                                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            ₹{order.total_amount.toFixed(2)}
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
                                  onClick={() => openReassignDialog(order)}
                                >
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reassign Driver
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRetryDelivery(order.id, order.order_number)}
                                >
                                  <RefreshCcw className="mr-2 h-4 w-4" />
                                  Retry with Same Driver
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
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
                                <DropdownMenuItem
                                  onClick={() => handlePermanentCancel(order.id, order.order_number)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Row Content */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-muted/30 p-0">
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
              Showing {filteredOrders.length} of {orders.length} failed orders
            </div>
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Reassign Driver Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Driver</DialogTitle>
            <DialogDescription>
              Select a new driver for order {selectedOrderForReassign?.order_number}
            </DialogDescription>
          </DialogHeader>
          {selectedOrderForReassign && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Previous Driver</label>
                <div className="p-2 bg-muted rounded-md">
                  <p className="text-sm">
                    {selectedOrderForReassign.delivery_partner_name || "No driver was assigned"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select New Driver</label>
                <Select value={selectedNewDriver} onValueChange={setSelectedNewDriver}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a driver..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableDriversForOrder(selectedOrderForReassign).map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex justify-between items-center w-full">
                          <span>{driver.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({driver.total_deliveries || 0} deliveries)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Next Delivery Date & Time *</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !nextDeliveryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIconLucide className="mr-2 h-4 w-4" />
                        {nextDeliveryDate ? format(nextDeliveryDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={nextDeliveryDate}
                        onSelect={setNextDeliveryDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="relative">
                    <Input
                      type="time"
                      value={nextDeliveryTime}
                      onChange={(e) => setNextDeliveryTime(e.target.value)}
                      className="w-[120px] pl-8"
                    />
                    <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about the reassignment..."
                  value={reassignNote}
                  onChange={(e) => setReassignNote(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              {selectedOrderForReassign.failed_attempts && selectedOrderForReassign.failed_attempts > 1 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md">
                  <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    This order has failed {selectedOrderForReassign.failed_attempts} times
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReassignDriver}
              disabled={!selectedNewDriver || assigningDriver === selectedOrderForReassign?.id}
            >
              {assigningDriver === selectedOrderForReassign?.id ? "Reassigning..." : "Reassign Driver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}