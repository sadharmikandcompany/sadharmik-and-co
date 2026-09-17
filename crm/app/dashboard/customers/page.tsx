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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Pencil, Trash2, ShoppingCart, Eye, MapPin, ChevronLeft, ChevronRight, MapPinned, Printer, Copy, Phone, MessageCircle, Wallet, Users, CheckCircle2, Clock, XCircle, IndianRupee, AlertCircle, Package } from "lucide-react"
import { toast } from "sonner"
import { lookupPincode } from "@/lib/pincode-lookup"
import { ExportButtons } from "@/components/export-buttons"
import Link from "next/link"

// Indian States and Union Territories
const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
]

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  mobile_primary: string
  whatsapp_number: string | null
  mobile_secondary_1: string | null
  mobile_secondary_2: string | null
  company_name: string | null
  gst_number: string | null
  pan_card_number: string | null
  is_vip: boolean
  vip_number: string | null
  is_defaulter: boolean
  is_mandir: boolean
  mandir_number: string | null
  is_shop: boolean
  shop_number: string | null
  full_address: string | null
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
  billing_same_as_shipping: boolean
  billing_room_number: string | null
  billing_floor: string | null
  billing_wing: string | null
  billing_flat_number: string | null
  billing_floor_wing: string | null
  billing_building_name: string | null
  billing_street_area: string | null
  billing_landmark: string | null
  billing_pincode: string | null
  billing_country: string | null
  billing_state: string | null
  billing_city: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

type CustomerFormData = {
  first_name: string
  last_name: string
  email: string
  mobile_primary: string
  whatsapp_number: string
  whatsapp_same_as_primary: boolean
  mobile_secondary_1: string
  mobile_secondary_2: string
  company_name: string
  gst_number: string
  pan_card_number: string
  full_address: string
  shipping_room_number: string
  shipping_floor: string
  shipping_wing: string
  shipping_flat_number: string
  shipping_floor_wing: string
  shipping_building_name: string
  shipping_street_area: string
  shipping_landmark: string
  shipping_pincode: string
  shipping_country: string
  shipping_city: string
  shipping_state: string
  billing_same_as_shipping: boolean
  billing_room_number: string
  billing_floor: string
  billing_wing: string
  billing_flat_number: string
  billing_floor_wing: string
  billing_building_name: string
  billing_street_area: string
  billing_landmark: string
  billing_pincode: string
  billing_country: string
  billing_state: string
  billing_city: string
  is_vip: boolean
  vip_number: string
  is_defaulter: boolean
  is_mandir: boolean
  mandir_number: string
  is_shop: boolean
  shop_number: string
  is_active: boolean
}

type Order = {
  id: string
  order_number: string | null
  customer_id: string
  order_status: string | null
  payment_status: string | null
  payment_method: string | null
  total_amount: number | null
  paid_amount: number | null
  balance_amount: number | null
  created_at: string
  order_date: string | null
  invoice_number_gst: string | null
  invoice_number_non_gst: string | null
  is_gst_invoice: boolean
  is_priority: boolean
  shipping_full_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_pincode: string | null
  serviceable_distributor_name: string | null
  delivery_partner_name: string | null
  delivery_partner_mobile: string | null
  assigned_to_delivery_at: string | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [deletingCustomerOrderCount, setDeletingCustomerOrderCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Filter states
  const [filterActive, setFilterActive] = useState<boolean | null>(null)
  const [filterVip, setFilterVip] = useState<boolean | null>(null)
  const [filterMandir, setFilterMandir] = useState<boolean | null>(null)
  const [filterDefaulter, setFilterDefaulter] = useState<boolean | null>(null)

  // Order history modal states
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [orderHistory, setOrderHistory] = useState<Order[]>([])
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false)
  const [orderStats, setOrderStats] = useState({
    totalOrders: 0,
    totalAmount: 0,
    completedOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0,
    lastOrderDate: null as string | null,
    totalPaidAmount: 0,
    outstandingBalance: 0
  })
  const [generatingVipNumber, setGeneratingVipNumber] = useState(false)
  const [generatingMandirNumber, setGeneratingMandirNumber] = useState(false)
  const [generatingShopNumber, setGeneratingShopNumber] = useState(false)

  const [formData, setFormData] = useState<CustomerFormData>({
    first_name: "",
    last_name: "",
    email: "",
    mobile_primary: "",
    whatsapp_number: "",
    whatsapp_same_as_primary: false,
    mobile_secondary_1: "",
    mobile_secondary_2: "",
    company_name: "",
    gst_number: "",
    pan_card_number: "",
    full_address: "",
    shipping_room_number: "",
    shipping_floor: "",
    shipping_wing: "",
    shipping_flat_number: "",
    shipping_floor_wing: "",
    shipping_building_name: "",
    shipping_street_area: "",
    shipping_landmark: "",
    shipping_pincode: "",
    shipping_country: "India",
    shipping_city: "",
    shipping_state: "",
    billing_same_as_shipping: true,
    billing_room_number: "",
    billing_floor: "",
    billing_wing: "",
    billing_flat_number: "",
    billing_floor_wing: "",
    billing_building_name: "",
    billing_street_area: "",
    billing_landmark: "",
    billing_pincode: "",
    billing_country: "",
    billing_state: "",
    billing_city: "",
    is_vip: false,
    vip_number: "",
    is_defaulter: false,
    is_mandir: false,
    mandir_number: "",
    is_shop: false,
    shop_number: "",
    is_active: true,
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Reset to page 1 when search term, filters, or items per page change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterActive, filterVip, filterMandir, filterDefaulter, itemsPerPage])

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCustomers()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, filterActive, filterVip, filterMandir, filterDefaulter, currentPage, itemsPerPage])

  const fetchCustomers = async () => {
    setLoading(true)
    await searchCustomers()
    setLoading(false)
  }

  const searchCustomers = async () => {
    setIsSearching(true)
    try {
      // Build base query
      let baseQuery = supabase.from("customers").select("*", { count: "exact" })

      // Apply search term if provided
      if (searchTerm && searchTerm.length >= 2) {
        const trimmedSearch = searchTerm.trim()

        // Check if search term contains space (potential full name search)
        if (trimmedSearch.includes(' ')) {
          // Split the search term into parts
          const nameParts = trimmedSearch.split(/\s+/)

          if (nameParts.length === 2) {
            // Search for exact first and last name combination OR regular search
            const [firstName, lastName] = nameParts
            baseQuery = baseQuery.or(
              `and(first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%),` +
              `and(first_name.ilike.%${lastName}%,last_name.ilike.%${firstName}%),` +
              `first_name.ilike.%${trimmedSearch}%,` +
              `last_name.ilike.%${trimmedSearch}%,` +
              `mobile_primary.ilike.%${trimmedSearch}%,` +
              `mobile_secondary_1.ilike.%${trimmedSearch}%,` +
              `mobile_secondary_2.ilike.%${trimmedSearch}%,` +
              `whatsapp_number.ilike.%${trimmedSearch}%,` +
              `email.ilike.%${trimmedSearch}%,` +
              `vip_number.ilike.%${trimmedSearch}%,` +
              `full_address.ilike.%${trimmedSearch}%`
            )
          } else {
            // For more than 2 parts, search all fields with the full term
            baseQuery = baseQuery.or(
              `first_name.ilike.%${trimmedSearch}%,` +
              `last_name.ilike.%${trimmedSearch}%,` +
              `mobile_primary.ilike.%${trimmedSearch}%,` +
              `mobile_secondary_1.ilike.%${trimmedSearch}%,` +
              `mobile_secondary_2.ilike.%${trimmedSearch}%,` +
              `whatsapp_number.ilike.%${trimmedSearch}%,` +
              `email.ilike.%${trimmedSearch}%,` +
              `vip_number.ilike.%${trimmedSearch}%,` +
              `full_address.ilike.%${trimmedSearch}%`
            )
          }
        } else {
          // Regular search for single term
          baseQuery = baseQuery.or(
            `first_name.ilike.%${trimmedSearch}%,` +
            `last_name.ilike.%${trimmedSearch}%,` +
            `mobile_primary.ilike.%${trimmedSearch}%,` +
            `mobile_secondary_1.ilike.%${trimmedSearch}%,` +
            `mobile_secondary_2.ilike.%${trimmedSearch}%,` +
            `whatsapp_number.ilike.%${trimmedSearch}%,` +
            `email.ilike.%${trimmedSearch}%,` +
            `vip_number.ilike.%${trimmedSearch}%,` +
            `full_address.ilike.%${trimmedSearch}%`
          )
        }
      }

      // Apply status filters
      if (filterActive !== null) {
        baseQuery = baseQuery.eq("is_active", filterActive)
      }
      if (filterVip !== null) {
        baseQuery = baseQuery.eq("is_vip", filterVip)
      }
      if (filterMandir !== null) {
        baseQuery = baseQuery.eq("is_mandir", filterMandir)
      }
      if (filterDefaulter !== null) {
        baseQuery = baseQuery.eq("is_defaulter", filterDefaulter)
      }

      // Calculate pagination offset
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      const query = baseQuery
        .order("created_at", { ascending: false })
        .range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching customers:", error)
        toast.error("Failed to fetch customers")
        setCustomers([])
        setTotalCount(0)
      } else {
        setCustomers(data || [])
        setTotalCount(count || 0)
      }
    } catch (error) {
      console.error("Error searching customers:", error)
      setCustomers([])
      setTotalCount(0)
    } finally {
      setIsSearching(false)
    }
  }

  // Plain "highest existing + 1, starting at 1" — same as Mandir/Shop below.
  // The old 9000/10000-range special-casing was for staying compatible with
  // Kalapurna's real historical VIP data; Sadharmik & Co's Sd numbers have
  // no such legacy to match, so they just start clean from 1.
  const getNextVipNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("vip_number")
        .not("vip_number", "is", null)

      if (error) {
        console.error("Error fetching Sd numbers:", error)
        throw error
      }

      if (!data || data.length === 0) return "1"

      const vipNumbers = data
        .map(item => parseInt(item.vip_number || "0", 10))
        .filter(num => !isNaN(num))
        .sort((a, b) => b - a)

      if (vipNumbers.length === 0) return "1"
      return (vipNumbers[0] + 1).toString()
    } catch (error) {
      console.error("Error generating Sd number:", error)
      // Return a fallback number if there's an error
      return Date.now().toString().slice(-4)
    }
  }

  const handleVipToggle = async (checked: boolean) => {
    if (checked && !formData.vip_number) {
      // Auto-generate Sd number when Sd is checked and no Sd number exists
      setGeneratingVipNumber(true)
      try {
        const nextVipNumber = await getNextVipNumber()
        setFormData({ ...formData, is_vip: true, vip_number: nextVipNumber })
        toast.success(`Sd number ${nextVipNumber} assigned automatically`)
      } catch (error) {
        console.error("Error generating Sd number:", error)
        toast.error("Failed to generate Sd number. Please enter manually.")
        setFormData({ ...formData, is_vip: true })
      } finally {
        setGeneratingVipNumber(false)
      }
    } else {
      setFormData({ ...formData, is_vip: checked })
    }
  }

  // Mandir/Shop numbers are Sadharmik & Co's own tiers (Kalapurna's data has
  // no legacy numbering to stay compatible with), so unlike getNextVipNumber
  // this is a plain "highest existing + 1, starting at 1" — no special
  // 9000/10000 range handling needed.
  const getNextMandirNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("mandir_number")
        .not("mandir_number", "is", null)

      if (error) {
        console.error("Error fetching Mandir numbers:", error)
        throw error
      }

      if (!data || data.length === 0) return "1"

      const numbers = data
        .map(item => parseInt(item.mandir_number || "0", 10))
        .filter(num => !isNaN(num))
        .sort((a, b) => b - a)

      if (numbers.length === 0) return "1"
      return (numbers[0] + 1).toString()
    } catch (error) {
      console.error("Error generating Mandir number:", error)
      return Date.now().toString().slice(-4)
    }
  }

  const handleMandirToggle = async (checked: boolean) => {
    if (checked && !formData.mandir_number) {
      setGeneratingMandirNumber(true)
      try {
        const nextMandirNumber = await getNextMandirNumber()
        setFormData({ ...formData, is_mandir: true, mandir_number: nextMandirNumber })
        toast.success(`Mandir number ${nextMandirNumber} assigned automatically`)
      } catch (error) {
        console.error("Error generating Mandir number:", error)
        toast.error("Failed to generate Mandir number. Please enter manually.")
        setFormData({ ...formData, is_mandir: true })
      } finally {
        setGeneratingMandirNumber(false)
      }
    } else {
      setFormData({ ...formData, is_mandir: checked })
    }
  }

  const getNextShopNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("shop_number")
        .not("shop_number", "is", null)

      if (error) {
        console.error("Error fetching Shop numbers:", error)
        throw error
      }

      if (!data || data.length === 0) return "1"

      const numbers = data
        .map(item => parseInt(item.shop_number || "0", 10))
        .filter(num => !isNaN(num))
        .sort((a, b) => b - a)

      if (numbers.length === 0) return "1"
      return (numbers[0] + 1).toString()
    } catch (error) {
      console.error("Error generating Shop number:", error)
      return Date.now().toString().slice(-4)
    }
  }

  const handleShopToggle = async (checked: boolean) => {
    if (checked && !formData.shop_number) {
      setGeneratingShopNumber(true)
      try {
        const nextShopNumber = await getNextShopNumber()
        setFormData({ ...formData, is_shop: true, shop_number: nextShopNumber })
        toast.success(`Shop number ${nextShopNumber} assigned automatically`)
      } catch (error) {
        console.error("Error generating Shop number:", error)
        toast.error("Failed to generate Shop number. Please enter manually.")
        setFormData({ ...formData, is_shop: true })
      } finally {
        setGeneratingShopNumber(false)
      }
    } else {
      setFormData({ ...formData, is_shop: checked })
    }
  }

  const fetchOrderHistory = async (customerId: string) => {
    setOrderHistoryLoading(true)
    try {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })

      if (error) throw error

      if (!ordersData || ordersData.length === 0) {
        setOrderHistory([])
        setOrderStats({
          totalOrders: 0,
          totalAmount: 0,
          completedOrders: 0,
          pendingOrders: 0,
          cancelledOrders: 0,
          averageOrderValue: 0,
          lastOrderDate: null,
          totalPaidAmount: 0,
          outstandingBalance: 0
        })
        setOrderHistoryLoading(false)
        return
      }

      // Extract unique distributor and delivery partner IDs
      const distributorIds = [...new Set(ordersData
        .filter((order: any) => order.serviceable_distributor_id)
        .map((order: any) => order.serviceable_distributor_id))]
      const deliveryPartnerIds = [...new Set(ordersData
        .filter((order: any) => order.delivery_partner_id)
        .map((order: any) => order.delivery_partner_id))]

      // Extract unique shipping pincodes for distributor matching
      const shippingPincodes = [...new Set(
        ordersData
          .filter((order: any) => order.shipping_pincode)
          .map((order: any) => order.shipping_pincode)
      )]

      // Extract order IDs for fetching route_assignments
      const orderIds = ordersData.map((order: any) => order.id)

      // Fetch distributors, delivery partners, and route_assignments in parallel
      const [distributorsResult, deliveryPartnersResult, serviceableDistributorsResult, routeAssignmentsResult] = await Promise.all([
        distributorIds.length > 0
          ? supabase
              .from("distributors")
              .select("id, name")
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
        // Fetch route_assignments for paid amount calculation
        orderIds.length > 0
          ? supabase
              .from("route_assignments")
              .select("order_id, collected_amount, collected_payment_method")
              .in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      // Create lookup maps
      const distributorsMap = new Map(
        (distributorsResult.data || []).map((d: any) => [d.id, d])
      )
      const deliveryPartnersMap = new Map(
        (deliveryPartnersResult.data || []).map((dp: any) => [dp.id, dp])
      )

      // Create order_id to collected_amount mapping for balance calculation
      const orderPaymentsMap = new Map<string, number>()
      ;(routeAssignmentsResult.data || []).forEach((ra: any) => {
        if (ra.order_id && ra.collected_amount) {
          const currentAmount = orderPaymentsMap.get(ra.order_id) || 0
          orderPaymentsMap.set(ra.order_id, currentAmount + (ra.collected_amount || 0))
        }
      })

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

      // Enrich orders with distributor, delivery partner, and payment info
      const enrichedOrders = ordersData.map((order: any) => {
        // Get serviceable distributor by pincode if not already set
        const serviceableDistributor = order.serviceable_distributor_id
          ? distributorsMap.get(order.serviceable_distributor_id)
          : (order.shipping_pincode ? pincodeToDistributorMap.get(order.shipping_pincode) : undefined)

        // Get delivery partner details
        const deliveryPartner = order.delivery_partner_id
          ? deliveryPartnersMap.get(order.delivery_partner_id)
          : undefined

        // Get paid amount from route_assignments
        const paidAmount = orderPaymentsMap.get(order.id) || 0
        const totalAmount = order.total_amount || 0
        const balanceAmount = totalAmount - paidAmount

        return {
          ...order,
          serviceable_distributor_name: serviceableDistributor?.name || null,
          delivery_partner_name: deliveryPartner?.name || null,
          delivery_partner_mobile: deliveryPartner?.mobile || null,
          paid_amount: paidAmount,
          balance_amount: balanceAmount,
        }
      })

      setOrderHistory(enrichedOrders)

      // Calculate comprehensive stats
      const totalOrders = enrichedOrders.length
      const totalAmount = enrichedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
      const completedOrders = enrichedOrders.filter(o => o.order_status === 'delivered' || o.order_status === 'completed').length
      const pendingOrders = enrichedOrders.filter(o => o.order_status === 'pending' || o.order_status === 'processing').length
      const cancelledOrders = enrichedOrders.filter(o => o.order_status === 'cancelled').length
      const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0
      const lastOrderDate = enrichedOrders.length > 0 ? enrichedOrders[0].order_date || enrichedOrders[0].created_at : null

      // Calculate total paid amount and outstanding balance (excluding cancelled orders)
      const nonCancelledOrders = enrichedOrders.filter(o => o.order_status !== 'cancelled')
      const totalPaidAmount = nonCancelledOrders.reduce((sum, order) => sum + (order.paid_amount || 0), 0)
      const outstandingBalance = nonCancelledOrders.reduce((sum, order) => sum + (order.balance_amount || 0), 0)

      setOrderStats({
        totalOrders,
        totalAmount,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        averageOrderValue,
        lastOrderDate,
        totalPaidAmount,
        outstandingBalance
      })
    } catch (error) {
      console.error("Error fetching order history:", error)
      toast.error("Failed to fetch order history")
      setOrderHistory([])
      setOrderStats({
        totalOrders: 0,
        totalAmount: 0,
        completedOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0,
        lastOrderDate: null,
        totalPaidAmount: 0,
        outstandingBalance: 0
      })
    } finally {
      setOrderHistoryLoading(false)
    }
  }

  const handleViewOrderHistory = (customer: Customer) => {
    setSelectedCustomer(customer)
    setOrderHistoryOpen(true)
    fetchOrderHistory(customer.id)
  }

  const handlePrintOrderHistory = () => {
    window.print()
  }

  const handleOpenMap = (customer: Customer) => {
    // Build the destination address from full_address or structured fields
    let destinationAddress = ''

    if (customer.full_address && customer.full_address.trim() !== '' && customer.full_address !== 'Not Provided') {
      // Use full address if available
      destinationAddress = customer.full_address
    } else {
      // Build from structured fields
      const addressParts = [
        customer.shipping_room_number,
        customer.shipping_floor,
        customer.shipping_wing,
        customer.shipping_flat_number,
        customer.shipping_floor_wing,
        customer.shipping_building_name,
        customer.shipping_street_area,
        customer.shipping_landmark,
        customer.shipping_city,
        customer.shipping_state,
        customer.shipping_pincode,
        customer.shipping_country
      ].filter(part => part && part.trim() !== '' && part !== 'Not Provided')

      destinationAddress = addressParts.join(', ')
    }

    if (!destinationAddress) {
      toast.error('No address available for this customer')
      return
    }

    // Get current location using browser geolocation
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }

    toast.loading('Getting your location...')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss()
        const { latitude, longitude } = position.coords

        // Encode destination for URL
        const encodedDestination = encodeURIComponent(destinationAddress)

        // Open Google Maps with directions from current location
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodedDestination}&travelmode=driving`

        window.open(mapsUrl, '_blank')
      },
      (error) => {
        toast.dismiss()
        console.error('Geolocation error:', error)

        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location permission denied. Please enable location access in your browser settings.')
            break
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information unavailable. Please try again.')
            break
          case error.TIMEOUT:
            toast.error('Location request timed out. Please try again.')
            break
          default:
            toast.error('Unable to get your location. Please try again.')
            break
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  const handleOpenDialog = (customer?: Customer) => {
    setFormErrors({}) // Clear errors when opening dialog
    if (customer) {
      setEditingCustomer(customer)
      setFormData({
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email || "",
        mobile_primary: customer.mobile_primary,
        whatsapp_number: customer.whatsapp_number || "",
        whatsapp_same_as_primary: customer.whatsapp_number === customer.mobile_primary,
        mobile_secondary_1: customer.mobile_secondary_1 || "",
        mobile_secondary_2: customer.mobile_secondary_2 || "",
        company_name: customer.company_name || "",
        gst_number: customer.gst_number || "",
        pan_card_number: customer.pan_card_number || "",
        full_address: customer.full_address || "",
        shipping_room_number: customer.shipping_room_number || "",
        shipping_floor: customer.shipping_floor || "",
        shipping_wing: customer.shipping_wing || "",
        shipping_flat_number: customer.shipping_flat_number || "",
        shipping_floor_wing: customer.shipping_floor_wing || "",
        shipping_building_name: customer.shipping_building_name,
        shipping_street_area: customer.shipping_street_area,
        shipping_landmark: customer.shipping_landmark || "",
        shipping_pincode: customer.shipping_pincode,
        shipping_country: customer.shipping_country || "India",
        shipping_city: customer.shipping_city,
        shipping_state: customer.shipping_state,
        billing_same_as_shipping: customer.billing_same_as_shipping,
        billing_room_number: customer.billing_room_number || "",
        billing_floor: customer.billing_floor || "",
        billing_wing: customer.billing_wing || "",
        billing_flat_number: customer.billing_flat_number || "",
        billing_floor_wing: customer.billing_floor_wing || "",
        billing_building_name: customer.billing_building_name || "",
        billing_street_area: customer.billing_street_area || "",
        billing_landmark: customer.billing_landmark || "",
        billing_pincode: customer.billing_pincode || "",
        billing_country: customer.billing_country || "",
        billing_state: customer.billing_state || "",
        billing_city: customer.billing_city || "",
        is_vip: customer.is_vip,
        vip_number: customer.vip_number || "",
        is_defaulter: customer.is_defaulter,
        is_mandir: customer.is_mandir,
        mandir_number: customer.mandir_number || "",
        is_shop: customer.is_shop,
        shop_number: customer.shop_number || "",
        is_active: customer.is_active,
      })
    } else {
      setEditingCustomer(null)
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        mobile_primary: "",
        whatsapp_number: "",
        whatsapp_same_as_primary: false,
        mobile_secondary_1: "",
        mobile_secondary_2: "",
        company_name: "",
        gst_number: "",
        pan_card_number: "",
        full_address: "",
        shipping_room_number: "",
        shipping_floor: "",
        shipping_wing: "",
        shipping_flat_number: "",
        shipping_floor_wing: "",
        shipping_building_name: "",
        shipping_street_area: "",
        shipping_landmark: "",
        shipping_pincode: "",
        shipping_country: "India",
        shipping_city: "",
        shipping_state: "",
        billing_same_as_shipping: true,
        billing_room_number: "",
        billing_floor: "",
        billing_wing: "",
        billing_flat_number: "",
        billing_floor_wing: "",
        billing_building_name: "",
        billing_street_area: "",
        billing_landmark: "",
        billing_pincode: "",
        billing_country: "",
        billing_state: "",
        billing_city: "",
        is_vip: false,
        vip_number: "",
        is_defaulter: false,
        is_mandir: false,
        mandir_number: "",
        is_shop: false,
        shop_number: "",
        is_active: true,
      })
    }
    setDialogOpen(true)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    // Email validation - only if provided
    if (formData.email && formData.email.trim().length > 0) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
      if (!formData.email.match(emailRegex)) {
        errors.email = "Please enter a valid email address"
      }
    }

    // GST validation - must be exactly 15 characters if provided
    if (formData.gst_number && formData.gst_number.trim().length > 0) {
      if (formData.gst_number.trim().length !== 15) {
        errors.gst_number = "GST number must be exactly 15 characters"
      }
    }

    // PAN validation - must match format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
    if (formData.pan_card_number && formData.pan_card_number.trim().length > 0) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
      if (!formData.pan_card_number.match(panRegex)) {
        errors.pan_card_number = "PAN must be in format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)"
      }
    }

    // Mobile number validation - must be exactly 10 digits
    const mobileRegex = /^\d{10}$/
    if (!formData.mobile_primary.match(mobileRegex)) {
      errors.mobile_primary = "Mobile number must be exactly 10 digits"
    }

    // Indian pincode validation - must be exactly 6 digits
    const pincodeRegex = /^\d{6}$/

    // Required fields
    if (!formData.first_name.trim()) {
      errors.first_name = "First name is required"
    }
    if (!formData.last_name.trim()) {
      errors.last_name = "Last name is required"
    }

    // Check if full_address is provided
    const hasFullAddress = formData.full_address && formData.full_address.trim().length > 0

    // Address validation: Either full_address OR structured address fields must be provided
    if (!hasFullAddress) {
      // If no full address, validate structured address fields
      if (!formData.shipping_building_name.trim()) {
        errors.shipping_building_name = "Building name is required"
      }
      if (!formData.shipping_street_area.trim()) {
        errors.shipping_street_area = "Street/Area is required"
      }
      if (!formData.shipping_pincode.trim()) {
        errors.shipping_pincode = "Pincode is required"
      } else if (!pincodeRegex.test(formData.shipping_pincode.trim())) {
        errors.shipping_pincode = "Pincode must be exactly 6 digits"
      }
      if (!formData.shipping_city.trim()) {
        errors.shipping_city = "City is required"
      }
      if (!formData.shipping_state.trim()) {
        errors.shipping_state = "State is required"
      }
    } else {
      // If full_address is provided, still validate pincode format if it's filled in
      if (formData.shipping_pincode.trim() && !pincodeRegex.test(formData.shipping_pincode.trim())) {
        errors.shipping_pincode = "Pincode must be exactly 6 digits"
      }
    }

    // Validate billing pincode if billing address is different from shipping
    if (!formData.billing_same_as_shipping && formData.billing_pincode && formData.billing_pincode.trim().length > 0) {
      if (!pincodeRegex.test(formData.billing_pincode.trim())) {
        errors.billing_pincode = "Pincode must be exactly 6 digits"
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handler for pincode auto-population
  const handlePincodeChange = async (pincode: string, addressType: 'shipping' | 'billing') => {
    // Only lookup when pincode is exactly 6 digits
    if (pincode.length === 6) {
      const result = await lookupPincode(pincode)
      if (result) {
        if (addressType === 'shipping') {
          setFormData({
            ...formData,
            shipping_pincode: pincode,
            shipping_city: result.city,
            shipping_state: result.state,
          })
          toast.success(`Auto-filled: ${result.city}, ${result.state}`, { duration: 2000 })
        } else if (addressType === 'billing') {
          setFormData({
            ...formData,
            billing_pincode: pincode,
            billing_city: result.city,
            billing_state: result.state,
          })
          toast.success(`Auto-filled: ${result.city}, ${result.state}`, { duration: 2000 })
        }
      } else {
        // Pincode not found in database
        if (addressType === 'shipping') {
          setFormData({ ...formData, shipping_pincode: pincode })
        } else if (addressType === 'billing') {
          setFormData({ ...formData, billing_pincode: pincode })
        }
        toast.warning('Pincode not found in database. Please enter city and state manually.', { duration: 3000 })
      }
    } else {
      // Just update the pincode value
      if (addressType === 'shipping') {
        setFormData({ ...formData, shipping_pincode: pincode })
      } else if (addressType === 'billing') {
        setFormData({ ...formData, billing_pincode: pincode })
      }
    }
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix the validation errors before saving")
      return
    }

    setSaving(true)

    try {
      // Clean up the form data - convert empty strings to null for optional fields
      // Also sync new fields (room_number, floor, wing) with old fields (flat_number, floor_wing) for backward compatibility
      const floorWing = [formData.shipping_floor, formData.shipping_wing]
        .filter(v => v && v.trim() !== "")
        .join(" / ")
      const billingFloorWing = [formData.billing_floor, formData.billing_wing]
        .filter(v => v && v.trim() !== "")
        .join(" / ")

      const cleanedData = {
        ...formData,
        email: formData.email.trim() === "" ? null : formData.email,
        company_name: formData.company_name.trim() === "" ? null : formData.company_name,
        gst_number: formData.gst_number.trim() === "" ? null : formData.gst_number,
        pan_card_number: formData.pan_card_number.trim() === "" ? null : formData.pan_card_number.toUpperCase(),
        vip_number: formData.vip_number.trim() === "" ? null : formData.vip_number,
        mandir_number: formData.mandir_number.trim() === "" ? null : formData.mandir_number,
        shop_number: formData.shop_number.trim() === "" ? null : formData.shop_number,
        // Sync old fields with new fields for backward compatibility
        shipping_flat_number: formData.shipping_room_number || null,
        shipping_floor_wing: floorWing || null,
        billing_flat_number: formData.billing_room_number || null,
        billing_floor_wing: billingFloorWing || null,
      }

      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from("customers")
          .update(cleanedData)
          .eq("id", editingCustomer.id)

        if (error) throw error
        toast.success("Customer updated successfully")
      } else {
        // Create new customer
        const { error } = await supabase
          .from("customers")
          .insert([cleanedData])

        if (error) throw error
        toast.success("Customer created successfully")
      }

      setDialogOpen(false)
      fetchCustomers()
    } catch (error: unknown) {
      console.error("Error saving customer:", error)
      
      // Handle specific database errors
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as { code: string; message: string }
        
        if (dbError.code === '23514') {
          // Check constraint violation
          if (dbError.message.includes('valid_gst') || dbError.message.includes('gst_number')) {
            toast.error("GST number must be exactly 15 characters or leave it empty")
          } else if (dbError.message.includes('email')) {
            toast.error("Please enter a valid email address")
          } else {
            toast.error("Invalid data format. Please check all fields and try again.")
          }
        } else if (dbError.code === '23505') {
          // Unique constraint violation
          if (dbError.message.includes('email')) {
            toast.error("This email is already registered")
          } else {
            toast.error("A customer with this information already exists")
          }
        } else {
          const errorMessage = error instanceof Error ? error.message : "Failed to save customer"
          toast.error(errorMessage)
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : "Failed to save customer"
        toast.error(errorMessage)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCustomer) return

    try {
      // First check if the customer has any orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id")
        .eq("customer_id", deletingCustomer.id)
        .limit(1)

      if (ordersError) throw ordersError

      if (orders && orders.length > 0) {
        toast.error("Cannot delete customer with existing orders. Please deactivate the customer instead.")
        setDeleteDialogOpen(false)
        setDeletingCustomer(null)
        return
      }

      // If no orders, proceed with deletion
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", deletingCustomer.id)

      if (error) throw error

      toast.success("Customer deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingCustomer(null)
      fetchCustomers()
    } catch (error: unknown) {
      console.error("Error deleting customer:", error)

      // Handle specific database errors
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as { code: string; message: string; details?: string }

        if (dbError.code === '23503') {
          // Foreign key constraint violation
          toast.error("Cannot delete customer with existing orders. Please deactivate the customer instead.")
        } else {
          const errorMessage = error instanceof Error ? error.message : "Failed to delete customer"
          toast.error(errorMessage)
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete customer"
        toast.error(errorMessage)
      }

      setDeleteDialogOpen(false)
      setDeletingCustomer(null)
    }
  }

  const hasActiveFilters = filterActive !== null || filterVip !== null || filterMandir !== null || filterDefaulter !== null

  const clearAllFilters = () => {
    setFilterActive(null)
    setFilterVip(null)
    setFilterMandir(null)
    setFilterDefaulter(null)
  }

  // Prepare export data
  const exportData = customers.map(customer => ({
    'First Name': customer.first_name,
    'Last Name': customer.last_name,
    'Email': customer.email || '',
    'Primary Mobile': customer.mobile_primary,
    'WhatsApp': customer.whatsapp_number || '',
    'Company': customer.company_name || '',
    'GST Number': customer.gst_number || '',
    'Full Address': customer.full_address || '',
    'City': customer.shipping_city,
    'State': customer.shipping_state,
    'Pincode': customer.shipping_pincode,
    'Sd': customer.is_vip ? 'Yes' : 'No',
    'Mandir': customer.is_mandir ? 'Yes' : 'No',
    'Defaulter': customer.is_defaulter ? 'Yes' : 'No',
    'Active': customer.is_active ? 'Yes' : 'No'
  }))

  const exportColumns = [
    { header: 'Name', dataKey: 'First Name' },
    { header: 'Last Name', dataKey: 'Last Name' },
    { header: 'Email', dataKey: 'Email' },
    { header: 'Phone', dataKey: 'Primary Mobile' },
    { header: 'Company', dataKey: 'Company' },
    { header: 'City', dataKey: 'City' },
    { header: 'Sd', dataKey: 'Sd' },
    { header: 'Active', dataKey: 'Active' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground">
              Manage your customer database · contacts, addresses, and order history.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground">
              Manage your customer database · contacts, addresses, and order history.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButtons
            data={exportData}
            filename="customers"
            columns={exportColumns}
            pdfTitle="Customers Report"
          />
          <Link href="/dashboard/customers/address-management">
            <Button variant="outline">
              <MapPinned className="mr-2 h-4 w-4" />
              Manage Addresses
            </Button>
          </Link>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>
            A list of all customers with their details
          </CardDescription>
          <div className="mt-4 flex gap-4 items-center justify-between flex-wrap">
            <div className="relative max-w-sm">
              <Input
                placeholder="Search by name, phone, email, Sd #, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-20"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              )}
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Filters:</span>

              <Button
                variant={filterActive === true ? "default" : filterActive === false ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilterActive(filterActive === true ? null : true)}
                className="whitespace-nowrap"
              >
                Active
                {filterActive === true && <span className="ml-1">✓</span>}
              </Button>

              <Button
                variant={filterActive === false ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterActive(filterActive === false ? null : false)}
                className="whitespace-nowrap"
              >
                Inactive
                {filterActive === false && <span className="ml-1">✓</span>}
              </Button>

              <Button
                variant={filterVip === true ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterVip(filterVip === true ? null : true)}
                className="whitespace-nowrap"
              >
                Sd
                {filterVip === true && <span className="ml-1">✓</span>}
              </Button>

              <Button
                variant={filterMandir === true ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMandir(filterMandir === true ? null : true)}
                className="whitespace-nowrap"
              >
                Mandir
                {filterMandir === true && <span className="ml-1">✓</span>}
              </Button>

              <Button
                variant={filterDefaulter === true ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterDefaulter(filterDefaulter === true ? null : true)}
                className="whitespace-nowrap"
              >
                Defaulter
                {filterDefaulter === true && <span className="ml-1">✓</span>}
              </Button>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground whitespace-nowrap"
                >
                  Clear all
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
                  <TableHead>Name</TableHead>
                  <TableHead>Sd #</TableHead>
                  <TableHead>Contact Numbers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      {isSearching ? "Searching..." : "No customers found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id} className={customer.is_vip ? "bg-green-50/50 dark:bg-green-950/10" : ""}>
                      <TableCell className="font-medium w-[400px] max-w-[400px]">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleViewOrderHistory(customer)}
                            className="text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                          >
                            {customer.first_name} {customer.last_name}
                          </button>
                          {customer.full_address && (
                            <div className="group flex items-start gap-2">
                              <span className="text-xs text-muted-foreground break-words line-clamp-2 flex-1">
                                {customer.full_address}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(customer.full_address || '')
                                  toast.success("Address copied to clipboard")
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                title="Copy address"
                              >
                                <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.vip_number ? (
                          <Badge className="font-mono bg-green-700 text-white hover:bg-green-800">
                            Sd{customer.vip_number}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {/* Primary Mobile */}
                          <div className="group flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <a
                              href={`tel:${customer.mobile_primary}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                            >
                              {customer.mobile_primary}
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(customer.mobile_primary)
                                toast.success("Mobile number copied")
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy number"
                            >
                              <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </button>
                          </div>
                          {/* WhatsApp */}
                          {customer.whatsapp_number && customer.whatsapp_number !== customer.mobile_primary && (
                            <div className="group flex items-center gap-1">
                              <MessageCircle className="h-3 w-3 text-green-600" />
                              <a
                                href={`https://wa.me/91${customer.whatsapp_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-800 hover:underline text-sm"
                              >
                                {customer.whatsapp_number}
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(customer.whatsapp_number || '')
                                  toast.success("WhatsApp number copied")
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy WhatsApp number"
                              >
                                <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          )}
                          {/* Secondary Mobile 1 */}
                          {customer.mobile_secondary_1 && (
                            <div className="group flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <a
                                href={`tel:${customer.mobile_secondary_1}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                              >
                                {customer.mobile_secondary_1}
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(customer.mobile_secondary_1 || '')
                                  toast.success("Mobile number copied")
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy number"
                              >
                                <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          )}
                          {/* Secondary Mobile 2 */}
                          {customer.mobile_secondary_2 && (
                            <div className="group flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <a
                                href={`tel:${customer.mobile_secondary_2}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                              >
                                {customer.mobile_secondary_2}
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(customer.mobile_secondary_2 || '')
                                  toast.success("Mobile number copied")
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy number"
                              >
                                <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={customer.is_active ? "default" : "secondary"}>
                            {customer.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {customer.is_vip && (
                            <Badge variant="default">Sd</Badge>
                          )}
                          {customer.is_mandir && (
                            <Badge variant="outline">Mandir</Badge>
                          )}
                          {customer.is_defaulter && (
                            <Badge variant="destructive">Defaulter</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenMap(customer)}
                            title="Open in Google Maps"
                          >
                            <MapPin className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewOrderHistory(customer)}
                            title="View Order History"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(customer)}
                            title="Edit Customer"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              setDeletingCustomer(customer)
                              // Check order count before showing dialog
                              const { data: orders } = await supabase
                                .from("orders")
                                .select("id", { count: "exact" })
                                .eq("customer_id", customer.id)
                              setDeletingCustomerOrderCount(orders?.length || 0)
                              setDeleteDialogOpen(true)
                            }}
                            title="Delete Customer"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {totalCount > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} customer{totalCount !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => setItemsPerPage(Number(value))}
                >
                  <SelectTrigger className="w-[80px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {Math.max(1, Math.ceil(totalCount / itemsPerPage))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="!max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? "Update customer information"
                : "Enter customer details to create a new customer"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <p className="text-sm text-muted-foreground">Personal details of the customer</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                    required
                    className={formErrors.first_name ? "border-red-500" : ""}
                  />
                  {formErrors.first_name && (
                    <p className="text-sm text-red-500">{formErrors.first_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                    required
                    className={formErrors.last_name ? "border-red-500" : ""}
                  />
                  {formErrors.last_name && (
                    <p className="text-sm text-red-500">{formErrors.last_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={formErrors.email ? "border-red-500" : ""}
                    placeholder="example@domain.com"
                  />
                  {formErrors.email && (
                    <p className="text-sm text-red-500">{formErrors.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <p className="text-sm text-muted-foreground">Phone numbers and contact details</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile_primary">Mobile Primary *</Label>
                  <Input
                    id="mobile_primary"
                    value={formData.mobile_primary}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, mobile_primary: value })
                    }}
                    required
                    maxLength={10}
                    placeholder="10 digit mobile number"
                    className={formErrors.mobile_primary ? "border-red-500" : ""}
                  />
                  {formErrors.mobile_primary && (
                    <p className="text-sm text-red-500">{formErrors.mobile_primary}</p>
                  )}
                  {formData.mobile_primary && formData.mobile_primary.length > 0 && !formErrors.mobile_primary && (
                    <p className="text-sm text-muted-foreground">
                      {formData.mobile_primary.length}/10 digits
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                  <Input
                    id="whatsapp_number"
                    value={formData.whatsapp_same_as_primary ? formData.mobile_primary : formData.whatsapp_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, whatsapp_number: value, whatsapp_same_as_primary: false })
                    }}
                    disabled={formData.whatsapp_same_as_primary}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.whatsapp_same_as_primary}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setFormData({
                          ...formData,
                          whatsapp_same_as_primary: checked,
                          whatsapp_number: checked ? formData.mobile_primary : formData.whatsapp_number
                        })
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-xs text-muted-foreground">Same as Primary</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_1">Mobile Secondary 1</Label>
                  <Input
                    id="mobile_secondary_1"
                    value={formData.mobile_secondary_1}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, mobile_secondary_1: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_2">Mobile Secondary 2</Label>
                  <Input
                    id="mobile_secondary_2"
                    value={formData.mobile_secondary_2}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, mobile_secondary_2: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                </div>
              </div>
            </div>

            {/* Business Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Business Information</h3>
                <p className="text-sm text-muted-foreground">Company, GST, and PAN details (optional)</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input
                    id="gst_number"
                    value={formData.gst_number}
                    onChange={(e) =>
                      setFormData({ ...formData, gst_number: e.target.value })
                    }
                    maxLength={15}
                    placeholder="15 characters"
                    className={formErrors.gst_number ? "border-red-500" : ""}
                  />
                  {formErrors.gst_number && (
                    <p className="text-sm text-red-500">{formErrors.gst_number}</p>
                  )}
                  {formData.gst_number && formData.gst_number.length > 0 && !formErrors.gst_number && (
                    <p className="text-sm text-muted-foreground">
                      {formData.gst_number.length}/15 characters
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_card_number">PAN Card Number</Label>
                  <Input
                    id="pan_card_number"
                    value={formData.pan_card_number}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                      setFormData({ ...formData, pan_card_number: value })
                    }}
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    className={formErrors.pan_card_number ? "border-red-500" : ""}
                  />
                  {formErrors.pan_card_number && (
                    <p className="text-sm text-red-500">{formErrors.pan_card_number}</p>
                  )}
                  {formData.pan_card_number && formData.pan_card_number.length > 0 && !formErrors.pan_card_number && (
                    <p className="text-sm text-muted-foreground">
                      {formData.pan_card_number.length}/10 characters
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Shipping Address Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Shipping Address *</h3>
                <p className="text-sm text-muted-foreground">Provide either full address OR structured address fields</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_address">Full Address (Option 1)</Label>
                <textarea
                  id="full_address"
                  value={formData.full_address}
                  onChange={(e) =>
                    setFormData({ ...formData, full_address: e.target.value })
                  }
                  rows={3}
                  placeholder="Complete address as provided (optional if structured fields below are filled)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Enter complete address here to skip structured fields below
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">OR</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Structured Address (Option 2)</Label>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="Room/Flat No."
                    value={formData.shipping_room_number}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_room_number: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Floor"
                    value={formData.shipping_floor}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_floor: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Wing/Block"
                    value={formData.shipping_wing}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_wing: e.target.value })
                    }
                  />
                </div>
                <Input
                  placeholder="Building Name *"
                  value={formData.shipping_building_name}
                  onChange={(e) =>
                    setFormData({ ...formData, shipping_building_name: e.target.value })
                  }
                  required
                  className={formErrors.shipping_building_name ? "border-red-500" : ""}
                />
                {formErrors.shipping_building_name && (
                  <p className="text-sm text-red-500">{formErrors.shipping_building_name}</p>
                )}
                <Input
                  placeholder="Street/Area *"
                  value={formData.shipping_street_area}
                  onChange={(e) =>
                    setFormData({ ...formData, shipping_street_area: e.target.value })
                  }
                  required
                  className={formErrors.shipping_street_area ? "border-red-500" : ""}
                />
                {formErrors.shipping_street_area && (
                  <p className="text-sm text-red-500">{formErrors.shipping_street_area}</p>
                )}
                <Input
                  placeholder="Landmark"
                  value={formData.shipping_landmark}
                  onChange={(e) =>
                    setFormData({ ...formData, shipping_landmark: e.target.value })
                  }
                />
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Input
                      placeholder="City *"
                      value={formData.shipping_city}
                      onChange={(e) =>
                        setFormData({ ...formData, shipping_city: e.target.value })
                      }
                      required
                      className={formErrors.shipping_city ? "border-red-500" : ""}
                    />
                    {formErrors.shipping_city && (
                      <p className="text-xs text-red-500">{formErrors.shipping_city}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Select
                      value={formData.shipping_state}
                      onValueChange={(value) =>
                        setFormData({ ...formData, shipping_state: value })
                      }
                    >
                      <SelectTrigger className={formErrors.shipping_state ? "border-red-500" : ""}>
                        <SelectValue placeholder="State *" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.shipping_state && (
                      <p className="text-xs text-red-500">{formErrors.shipping_state}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Pincode *"
                      value={formData.shipping_pincode}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/\D/g, '')
                        handlePincodeChange(value, 'shipping')
                      }}
                      required
                      maxLength={6}
                      className={formErrors.shipping_pincode ? "border-red-500" : ""}
                    />
                    {formErrors.shipping_pincode && (
                      <p className="text-xs text-red-500">{formErrors.shipping_pincode}</p>
                    )}
                    {formData.shipping_pincode && formData.shipping_pincode.length > 0 && !formErrors.shipping_pincode && (
                      <p className="text-xs text-muted-foreground">
                        {formData.shipping_pincode.length}/6 digits
                      </p>
                    )}
                  </div>
                  <Input
                    placeholder="Country"
                    value={formData.shipping_country}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_country: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Billing Address Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Billing Address</h3>
                <p className="text-sm text-muted-foreground">Invoice and billing address</p>
              </div>
              <div className="mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.billing_same_as_shipping}
                    onChange={(e) =>
                      setFormData({ ...formData, billing_same_as_shipping: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Same as Shipping Address</span>
                </label>
              </div>
              {!formData.billing_same_as_shipping && (
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      placeholder="Room/Flat No."
                      value={formData.billing_room_number}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_room_number: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Floor"
                      value={formData.billing_floor}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_floor: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Wing/Block"
                      value={formData.billing_wing}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_wing: e.target.value })
                      }
                    />
                  </div>
                  <Input
                    placeholder="Building Name"
                    value={formData.billing_building_name}
                    onChange={(e) =>
                      setFormData({ ...formData, billing_building_name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Street/Area"
                    value={formData.billing_street_area}
                    onChange={(e) =>
                      setFormData({ ...formData, billing_street_area: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Landmark"
                    value={formData.billing_landmark}
                    onChange={(e) =>
                      setFormData({ ...formData, billing_landmark: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-4 gap-3">
                    <Input
                      placeholder="City"
                      value={formData.billing_city}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_city: e.target.value })
                      }
                    />
                    <Select
                      value={formData.billing_state}
                      onValueChange={(value) =>
                        setFormData({ ...formData, billing_state: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="space-y-1">
                      <Input
                        placeholder="Pincode"
                        value={formData.billing_pincode}
                        onChange={(e) => {
                          // Only allow numbers
                          const value = e.target.value.replace(/\D/g, '')
                          handlePincodeChange(value, 'billing')
                        }}
                        maxLength={6}
                        className={formErrors.billing_pincode ? "border-red-500" : ""}
                      />
                      {formErrors.billing_pincode && (
                        <p className="text-xs text-red-500">{formErrors.billing_pincode}</p>
                      )}
                      {formData.billing_pincode && formData.billing_pincode.length > 0 && !formErrors.billing_pincode && (
                        <p className="text-xs text-muted-foreground">
                          {formData.billing_pincode.length}/6 digits
                        </p>
                      )}
                    </div>
                    <Input
                      placeholder="Country"
                      value={formData.billing_country}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_country: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Customer Classification Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Customer Classification</h3>
                <p className="text-sm text-muted-foreground">Customer type and status tags</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_vip}
                      onChange={(e) => handleVipToggle(e.target.checked)}
                      disabled={generatingVipNumber}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Sd Customer</span>
                    {generatingVipNumber && (
                      <span className="text-xs text-muted-foreground">(Generating Sd number...)</span>
                    )}
                  </label>
                  {formData.is_vip && (
                    <div className="flex-1 max-w-xs flex">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                        Sd
                      </span>
                      <Input
                        placeholder="Number"
                        value={formData.vip_number}
                        onChange={(e) =>
                          setFormData({ ...formData, vip_number: e.target.value })
                        }
                        className="h-9 rounded-l-none"
                        title="Sd number is auto-generated. You can edit it if needed."
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_mandir}
                      onChange={(e) => handleMandirToggle(e.target.checked)}
                      disabled={generatingMandirNumber}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Mandir/Temple</span>
                    {generatingMandirNumber && (
                      <span className="text-xs text-muted-foreground">(Generating Mandir number...)</span>
                    )}
                  </label>
                  {formData.is_mandir && (
                    <div className="flex-1 max-w-xs flex">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                        Man
                      </span>
                      <Input
                        placeholder="Number"
                        value={formData.mandir_number}
                        onChange={(e) =>
                          setFormData({ ...formData, mandir_number: e.target.value })
                        }
                        className="h-9 rounded-l-none"
                        title="Mandir number is auto-generated. You can edit it if needed."
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_shop}
                      onChange={(e) => handleShopToggle(e.target.checked)}
                      disabled={generatingShopNumber}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Shop</span>
                    {generatingShopNumber && (
                      <span className="text-xs text-muted-foreground">(Generating Shop number...)</span>
                    )}
                  </label>
                  {formData.is_shop && (
                    <div className="flex-1 max-w-xs flex">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                        Shop
                      </span>
                      <Input
                        placeholder="Number"
                        value={formData.shop_number}
                        onChange={(e) =>
                          setFormData({ ...formData, shop_number: e.target.value })
                        }
                        className="h-9 rounded-l-none"
                        title="Shop number is auto-generated. You can edit it if needed."
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_defaulter}
                    onChange={(e) =>
                      setFormData({ ...formData, is_defaulter: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Defaulter</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingCustomer ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingCustomerOrderCount > 0 ? "Cannot Delete Customer" : "Are you sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCustomerOrderCount > 0 ? (
                <div className="space-y-2">
                  <p>
                    Cannot delete customer{" "}
                    <strong>
                      {deletingCustomer?.first_name} {deletingCustomer?.last_name}
                    </strong>{" "}
                    because they have <strong>{deletingCustomerOrderCount}</strong> existing order{deletingCustomerOrderCount !== 1 ? "s" : ""}.
                  </p>
                  <p className="text-yellow-600 dark:text-yellow-500">
                    You can deactivate this customer instead to prevent them from placing new orders while preserving order history.
                  </p>
                </div>
              ) : (
                <p>
                  This will permanently delete the customer{" "}
                  <strong>
                    {deletingCustomer?.first_name} {deletingCustomer?.last_name}
                  </strong>
                  . This action cannot be undone.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false)
              setDeletingCustomer(null)
              setDeletingCustomerOrderCount(0)
            }}>
              {deletingCustomerOrderCount > 0 ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {deletingCustomerOrderCount === 0 && (
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            )}
            {deletingCustomerOrderCount > 0 && (
              <AlertDialogAction
                onClick={() => {
                  setDeleteDialogOpen(false)
                  if (deletingCustomer) {
                    handleOpenDialog(deletingCustomer)
                  }
                  setDeletingCustomer(null)
                  setDeletingCustomerOrderCount(0)
                }}
                className="bg-yellow-600 text-white hover:bg-yellow-700"
              >
                Deactivate Instead
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order History Modal */}
      <Dialog open={orderHistoryOpen} onOpenChange={setOrderHistoryOpen}>
        <DialogContent className="!max-w-[98vw] w-[98vw] max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible">
          <style jsx global>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 0.5cm 0.75cm;
              }

              html, body {
                width: 297mm;
                height: 210mm;
              }

              body * {
                visibility: hidden;
              }

              [data-slot="dialog-content"], [data-slot="dialog-content"] * {
                visibility: visible;
              }

              [data-slot="dialog-content"] {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                max-width: 297mm !important;
                box-shadow: none;
                border: none;
                padding: 10px !important;
              }

              [data-slot="dialog-overlay"] {
                display: none;
              }

              [data-slot="dialog-close"],
              [data-slot="dialog-footer"] {
                display: none !important;
              }

              [data-slot="dialog-header"] {
                margin-bottom: 10px;
                border-bottom: 2px solid #000;
                padding-bottom: 5px;
              }

              [data-slot="dialog-title"] {
                font-size: 18px !important;
                font-weight: bold;
                color: #000 !important;
              }

              table {
                page-break-inside: auto;
                border-collapse: collapse !important;
                width: 100% !important;
                max-width: 100% !important;
                font-size: 8px !important;
                table-layout: fixed !important;
              }

              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }

              thead {
                display: table-header-group;
              }

              thead tr th {
                background-color: #f3f4f6 !important;
                color: #000 !important;
                font-weight: bold !important;
                padding: 3px 4px !important;
                border: 1px solid #ddd !important;
                text-align: left !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                word-wrap: break-word !important;
                overflow: hidden !important;
                line-height: 1.2 !important;
              }

              tbody tr td {
                padding: 3px 4px !important;
                border: 1px solid #ddd !important;
                color: #000 !important;
                word-wrap: break-word !important;
                overflow: hidden !important;
                line-height: 1.3 !important;
              }

              /* Specific column widths optimized for A4 landscape */
              /* Column 1: Date - must be visible */
              thead tr th:nth-child(1),
              tbody tr td:nth-child(1) {
                width: 7% !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              /* Column 2: Invoice Number - must be visible */
              thead tr th:nth-child(2),
              tbody tr td:nth-child(2) {
                width: 10% !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              /* Column 3: Order Number - must be visible */
              thead tr th:nth-child(3),
              tbody tr td:nth-child(3) {
                width: 9% !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              /* Column 4: Shipping Address - must be visible */
              thead tr th:nth-child(4),
              tbody tr td:nth-child(4) {
                width: 25% !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              /* Column 5: Distributor - hidden in print */
              thead tr th:nth-child(5),
              tbody tr td:nth-child(5) {
                display: none !important;
                visibility: hidden !important;
                width: 0 !important;
              }

              /* Column 6: Delivery Driver */
              thead tr th:nth-child(6),
              tbody tr td:nth-child(6) {
                width: 12% !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              /* Column 7: Payment Method */
              thead tr th:nth-child(7),
              tbody tr td:nth-child(7) {
                width: 9% !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              /* Column 8: Delivery Status */
              thead tr th:nth-child(8),
              tbody tr td:nth-child(8) {
                width: 10% !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              /* Column 9: Payment Status */
              thead tr th:nth-child(9),
              tbody tr td:nth-child(9) {
                width: 10% !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              /* Column 10: Amount */
              thead tr th:nth-child(10),
              tbody tr td:nth-child(10) {
                width: 8% !important;
                text-align: right !important;
                display: table-cell !important;
                visibility: visible !important;
              }

              tbody tr:nth-child(even) {
                background-color: #f9fafb !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              .badge {
                border: 1px solid #000 !important;
                padding: 2px 6px !important;
                border-radius: 4px !important;
                font-size: 10px !important;
                background-color: transparent !important;
                color: #000 !important;
              }
            }
          `}</style>
          <DialogHeader>
            <div className="flex items-center gap-3 print:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 shrink-0">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base">
                  Order History · {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                </DialogTitle>
                <DialogDescription className="mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>Complete order history for this customer</span>
                  {selectedCustomer?.mobile_primary && (
                    <>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedCustomer.mobile_primary}
                      </span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
            <DialogTitle className="hidden print:block">
              Order History - {selectedCustomer?.first_name} {selectedCustomer?.last_name}
            </DialogTitle>
            {/* Print-only summary */}
            <div className="hidden print:block mt-2 text-xs" style={{ fontSize: '9px' }}>
              <div className="flex gap-6 mb-2">
                <div>
                  <strong>Total Orders:</strong> {orderStats.totalOrders}
                </div>
                <div>
                  <strong>Total Amount:</strong> ₹{orderStats.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div>
                  <strong>Completed:</strong> {orderStats.completedOrders}
                </div>
                <div>
                  <strong>Pending:</strong> {orderStats.pendingOrders}
                </div>
                <div>
                  <strong>Cancelled:</strong> {orderStats.cancelledOrders}
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <strong>Printed:</strong> {new Date().toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </div>
              </div>
            </div>
          </DialogHeader>

          {orderHistoryLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
              <p className="text-sm">Loading order history…</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
                {/* Total Orders */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Total
                    </span>
                  </div>
                  <p className="text-2xl font-bold leading-none tabular-nums">{orderStats.totalOrders}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">All orders</p>
                </div>

                {/* Total Amount */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <IndianRupee className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Amount
                    </span>
                  </div>
                  <p className="text-xl font-bold leading-none tabular-nums flex items-center">
                    <IndianRupee className="h-4 w-4" />
                    {orderStats.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Lifetime spend</p>
                </div>

                {/* Outstanding Balance */}
                <div className="p-3 rounded-lg border border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/15 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-red-700/80 dark:text-red-400/80">
                      Due
                    </span>
                  </div>
                  <p className="text-xl font-bold leading-none tabular-nums flex items-center text-red-700 dark:text-red-400">
                    <IndianRupee className="h-4 w-4" />
                    {orderStats.outstandingBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-red-700/70 dark:text-red-400/70 mt-1">Outstanding</p>
                </div>

                {/* Completed Orders */}
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700/80 dark:text-emerald-400/80">
                      Done
                    </span>
                  </div>
                  <p className="text-2xl font-bold leading-none tabular-nums text-emerald-700 dark:text-emerald-400">
                    {orderStats.completedOrders}
                  </p>
                  <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-1">Completed</p>
                </div>

                {/* Pending Orders */}
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700/80 dark:text-amber-400/80">
                      Open
                    </span>
                  </div>
                  <p className="text-2xl font-bold leading-none tabular-nums text-amber-700 dark:text-amber-400">
                    {orderStats.pendingOrders}
                  </p>
                  <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70 mt-1">Pending</p>
                </div>

                {/* Cancelled Orders */}
                <div className="p-3 rounded-lg border border-border bg-muted/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <XCircle className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Void
                    </span>
                  </div>
                  <p className="text-2xl font-bold leading-none tabular-nums text-muted-foreground">
                    {orderStats.cancelledOrders}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Cancelled</p>
                </div>
              </div>

              {/* Orders Tabs */}
              <Tabs defaultValue="all-orders" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 print:hidden">
                  <TabsTrigger value="all-orders" className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    All Orders ({orderHistory.length})
                  </TabsTrigger>
                  <TabsTrigger value="balance" className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Balance ({orderHistory.filter(o => (o.balance_amount || 0) > 0).length})
                  </TabsTrigger>
                </TabsList>

                {/* All Orders Tab */}
                <TabsContent value="all-orders">
                  {orderHistory.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <ShoppingCart className="h-6 w-6 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No orders found</p>
                      <p className="text-xs">This customer hasn&apos;t placed any orders yet</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Invoice Number</TableHead>
                            <TableHead>Order Number</TableHead>
                            <TableHead>Shipping Address</TableHead>
                            <TableHead className="print:hidden">Distributor</TableHead>
                            <TableHead>Delivery Driver</TableHead>
                            <TableHead>Payment Method</TableHead>
                            <TableHead>Delivery Status</TableHead>
                            <TableHead>Payment Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderHistory.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="whitespace-nowrap">
                                {new Date(order.order_date || order.created_at).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </TableCell>
                              <TableCell className="font-medium font-mono">
                                <div className="flex flex-col gap-1">
                                  {order.is_gst_invoice
                                    ? (order.invoice_number_gst || "-")
                                    : (order.invoice_number_non_gst || "-")
                                  }
                                  {order.is_priority && (
                                    <Badge variant="destructive" className="text-xs w-fit">
                                      Priority
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {order.order_number || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs">
                                  {order.shipping_full_address ? (
                                    <div className="truncate" title={order.shipping_full_address}>
                                      {order.shipping_full_address}
                                    </div>
                                  ) : (
                                    <div className="truncate">
                                      {order.shipping_city && order.shipping_state
                                        ? `${order.shipping_city}, ${order.shipping_state}`
                                        : 'Address not available'}
                                    </div>
                                  )}
                                  {order.shipping_pincode && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      PIN: {order.shipping_pincode}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="print:hidden">
                                {order.serviceable_distributor_name ? (
                                  <span className="text-sm">{order.serviceable_distributor_name}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No distributor</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {order.delivery_partner_name ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{order.delivery_partner_name}</span>
                                    {order.delivery_partner_mobile && (
                                      <span className="text-xs text-muted-foreground">{order.delivery_partner_mobile}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not assigned</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {order.payment_method ? (
                                  <span className="text-sm">{order.payment_method}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not specified</span>
                                )}
                              </TableCell>
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
                                  {order.order_status || "pending"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    order.payment_status === "completed"
                                      ? "default"
                                      : order.payment_status === "failed"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {order.payment_status || "pending"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap">
                                ₹{(order.total_amount || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap text-green-600">
                                ₹{(order.paid_amount || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className={`text-right font-medium whitespace-nowrap ${(order.balance_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ₹{(order.balance_amount || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Balance Tab - Only orders with outstanding balance */}
                <TabsContent value="balance">
                  {orderHistory.filter(o => (o.balance_amount || 0) > 0).length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="text-green-600 font-medium text-lg mb-2">✓ No Outstanding Balance</div>
                      <div className="text-muted-foreground">All orders have been fully paid</div>
                    </div>
                  ) : (
                    <>
                      {/* Balance Summary */}
                      <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-red-700 dark:text-red-300">Total Outstanding Balance</div>
                            <div className="text-2xl font-bold text-red-600">
                              ₹{orderHistory
                                .filter(o => (o.balance_amount || 0) > 0)
                                .reduce((sum, o) => sum + (o.balance_amount || 0), 0)
                                .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-red-700 dark:text-red-300">Orders with Balance</div>
                            <div className="text-2xl font-bold text-red-600">
                              {orderHistory.filter(o => (o.balance_amount || 0) > 0).length}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Invoice Number</TableHead>
                              <TableHead>Order Number</TableHead>
                              <TableHead>Payment Method</TableHead>
                              <TableHead>Delivery Status</TableHead>
                              <TableHead>Payment Status</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {orderHistory
                              .filter(order => (order.balance_amount || 0) > 0)
                              .map((order) => (
                                <TableRow key={order.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {new Date(order.order_date || order.created_at).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </TableCell>
                                  <TableCell className="font-medium font-mono">
                                    <div className="flex flex-col gap-1">
                                      {order.is_gst_invoice
                                        ? (order.invoice_number_gst || "-")
                                        : (order.invoice_number_non_gst || "-")
                                      }
                                      {order.is_priority && (
                                        <Badge variant="destructive" className="text-xs w-fit">
                                          Priority
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {order.order_number || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {order.payment_method ? (
                                      <span className="text-sm">{order.payment_method}</span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Not specified</span>
                                    )}
                                  </TableCell>
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
                                      {order.order_status || "pending"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        order.payment_status === "completed"
                                          ? "default"
                                          : order.payment_status === "failed"
                                          ? "destructive"
                                          : "secondary"
                                      }
                                    >
                                      {order.payment_status || "pending"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium whitespace-nowrap">
                                    ₹{(order.total_amount || 0).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right font-medium whitespace-nowrap text-green-600">
                                    ₹{(order.paid_amount || 0).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right font-bold whitespace-nowrap text-red-600">
                                    ₹{(order.balance_amount || 0).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <div className="flex-1 flex gap-2">
              {orderHistory.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePrintOrderHistory}
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                  <ExportButtons
                    data={orderHistory.map(order => ({
                      'Date': new Date(order.order_date || order.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }),
                      'Invoice Number': order.is_gst_invoice
                        ? (order.invoice_number_gst || "-")
                        : (order.invoice_number_non_gst || "-"),
                      'Order Number': order.order_number || "-",
                      'Shipping Address': order.shipping_full_address ||
                        (order.shipping_city && order.shipping_state
                          ? `${order.shipping_city}, ${order.shipping_state}`
                          : 'Not available'),
                      'Pincode': order.shipping_pincode || "-",
                      'Delivery Driver': order.delivery_partner_name || "Not assigned",
                      'Driver Mobile': order.delivery_partner_mobile || "-",
                      'Payment Method': order.payment_method || "Not specified",
                      'Delivery Status': order.order_status || "pending",
                      'Payment Status': order.payment_status || "pending",
                      'Priority': order.is_priority ? "Yes" : "No",
                      'Amount': `₹${(order.total_amount || 0).toFixed(2)}`,
                      'Paid': `₹${(order.paid_amount || 0).toFixed(2)}`,
                      'Balance': `₹${(order.balance_amount || 0).toFixed(2)}`
                    }))}
                    filename={`${selectedCustomer?.first_name}_${selectedCustomer?.last_name}_order_history`}
                    columns={[
                      { header: 'Date', dataKey: 'Date' },
                      { header: 'Invoice #', dataKey: 'Invoice Number' },
                      { header: 'Order #', dataKey: 'Order Number' },
                      { header: 'Address', dataKey: 'Shipping Address' },
                      { header: 'Pincode', dataKey: 'Pincode' },
                      { header: 'Driver', dataKey: 'Delivery Driver' },
                      { header: 'Payment Method', dataKey: 'Payment Method' },
                      { header: 'Delivery Status', dataKey: 'Delivery Status' },
                      { header: 'Payment Status', dataKey: 'Payment Status' },
                      { header: 'Amount', dataKey: 'Amount' },
                      { header: 'Paid', dataKey: 'Paid' },
                      { header: 'Balance', dataKey: 'Balance' }
                    ]}
                    pdfTitle={`Order History - ${selectedCustomer?.first_name} ${selectedCustomer?.last_name}`}
                  />
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => setOrderHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
