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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, CalendarIcon, X, ExternalLink, ChevronDown, Edit, Download, XCircle, Truck, CheckCircle, MoreVertical, Users, Printer, UserCheck, AlertTriangle, DollarSign, Trash2, Star, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, QrCode, Copy } from "lucide-react"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"
import { generateOrderInvoice, generateBulkOrderInvoices, generateThermalReceipt, generateBulkThermalReceipts, FACTORY_COMPANY_INFO } from "@/lib/invoice-generator"

type Order = {
  id: string
  order_number: string
  customer_id: string | null
  distributor_id?: string | null
  retailer_id?: string | null
  is_distributor?: boolean
  is_subdistributor?: boolean
  customer_name?: string
  customer_phone?: string
  customer_phone_secondary_1?: string | null
  customer_phone_secondary_2?: string | null
  customer_whatsapp?: string | null
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
  delivery_status?: string | null
  assigned_to_delivery_at?: string | null
  failed_at?: string | null
  failure_reason?: string | null
  failed_attempts?: number
  next_delivery_at?: string | null
  // Route assignment data (real-time delivery tracking)
  route_assignment_status?: string | null
  pickup_time?: string | null
  delivery_time?: string | null
  delivery_notes?: string | null
  collected_payment_method?: string | null
  collected_amount?: number | null
  // COD collection fields
  cod_collected_amount?: string | null
  cod_payment_method?: string | null
  delivery_proof_url?: string | null
  // Order totals for summary display
  subtotal?: number
  discount_amount?: number
  cgst_amount?: number
  sgst_amount?: number
  igst_amount?: number
  shipping_charges?: number
  // Source of order
  source?: string
  created_by_agent_name?: string | null
  transaction_id?: string | null
  customer_email?: string | null
  customer_company_name?: string | null
  customer_gst_number?: string | null
  shipping_method?: string | null
  tracking_number?: string | null
  courier_partner?: string | null
  expected_delivery_date?: string | null
  shipped_date?: string | null
  delivered_date?: string | null
  order_notes?: string | null
  customer_notes?: string | null
  internal_notes?: string | null
  route_name?: string | null
  customer_rating?: number | null
  customer_feedback?: string | null
}

type DeliveryPartner = {
  id: string
  name: string
  partner_code: string | null
  mobile: string
  vehicle_type: string | null
  vehicle_number: string | null
  is_active: boolean
  is_available: boolean
  serviceable_pincodes: string[] | null
  average_rating: number | null
  total_deliveries: number | null
  active_orders_count: number
  city: string | null
  state: string | null
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

// Orders placed for a distributor (e.g. Order from Factory) have
// distributor_id set and customer_id null — fetch from whichever party the
// order actually belongs to instead of assuming it's always a customer.
async function fetchInvoiceParty(orderData: any) {
  if (orderData.customer_id) {
    const { data, error } = await supabase.from("customers").select("*").eq("id", orderData.customer_id).single()
    if (error) throw error
    return data
  }
  if (orderData.distributor_id) {
    const { data, error } = await supabase.from("distributors").select("*").eq("id", orderData.distributor_id).single()
    if (error) throw error
    return {
      first_name: data.name.split(" ")[0] || data.name,
      last_name: data.name.split(" ").slice(1).join(" ") || "",
      email: data.email,
      mobile_primary: data.phone_primary,
      mobile_secondary_1: data.phone_secondary,
      mobile_secondary_2: data.phone_tertiary,
      whatsapp_same_as_primary: true,
      whatsapp_number: data.phone_primary,
      company_name: data.company_name,
      gst_number: data.gst_number,
      full_address: [data.billing_address_line1, data.billing_address_line2, data.billing_city, data.billing_state, data.billing_pincode]
        .filter(Boolean)
        .join(", "),
      vip_number: null,
    }
  }
  throw new Error("This order has no linked customer or distributor")
}

export default function OrdersPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityDetails, loading: entityLoading } = useEntityData()
  const isDistributor = role === 'main_distributor' || role === 'sub_distributor'
  const isSubDistributor = role === 'sub_distributor'
  const isMainDistributor = role === 'main_distributor'
  const isRetailer = role === 'retailer'
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all")
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>("all")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all")
  const [distributorFilter, setDistributorFilter] = useState<string>("all")
  const [deliveryPartnerFilter, setDeliveryPartnerFilter] = useState<string>("all")
  const [amountFrom, setAmountFrom] = useState<string>("")
  const [amountTo, setAmountTo] = useState<string>("")

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})

  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false)
  const [bulkThermalPrintLoading, setBulkThermalPrintLoading] = useState(false)
  const [bulkDeliveredLoading, setBulkDeliveredLoading] = useState(false)

  // Delivery partners state
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([])
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null)

  // Filter options derived from orders
  const [uniqueDistributors, setUniqueDistributors] = useState<Array<{ id: string; name: string }>>([])

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingOrder, setDeletingOrder] = useState<{ id: string; orderNumber: string } | null>(null)

  // Bulk delivery confirmation state
  const [bulkDeliveryDialogOpen, setBulkDeliveryDialogOpen] = useState(false)

  // Bulk complete confirmation state
  const [bulkCompleteDialogOpen, setBulkCompleteDialogOpen] = useState(false)
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false)
  const [bulkCompletePaymentMethod, setBulkCompletePaymentMethod] = useState<string>("cash")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Picks up ?from=&to=&q= from links like the Factory Dashboard's Monthly
  // Summary table, so clicking a month's figure lands here pre-filtered.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get("from")
    const to = params.get("to")
    const q = params.get("q")
    if (from) setDateFrom(new Date(from))
    if (to) setDateTo(new Date(to))
    if (q) setSearchTerm(q)
  }, [])

  useEffect(() => {
    if (roleLoading || entityLoading) return
    if (isDistributor && !entityId) return
    fetchOrders()
    fetchDeliveryPartners()
  }, [roleLoading, entityLoading, entityId, isDistributor])

  const fetchDeliveryPartners = async () => {
    try {
      const response = await fetch("/api/delivery-partners?is_active=true&is_available=true")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const partnersArray = Array.isArray(data) ? data : []

      // Sort by active orders count (ascending) to prioritize less busy partners
      partnersArray.sort((a, b) => (a.active_orders_count || 0) - (b.active_orders_count || 0))

      setDeliveryPartners(partnersArray)
    } catch (error) {
      console.error("Error fetching delivery partners:", error)
      toast.error("Failed to fetch delivery partners")
      setDeliveryPartners([])
    }
  }

  // Helper function to batch large arrays for Supabase queries
  const batchArray = <T,>(array: T[], batchSize: number): T[][] => {
    const batches: T[][] = []
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize))
    }
    return batches
  }

  // Helper function to fetch data in batches
  const fetchInBatches = async <T,>(
    table: string,
    selectColumns: string,
    ids: string[],
    idColumn: string = "id",
    batchSize: number = 200
  ): Promise<T[]> => {
    if (ids.length === 0) return []

    const batches = batchArray(ids, batchSize)
    const results: T[] = []

    // Process batches in parallel (max 5 concurrent batches)
    const maxConcurrent = 5
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const batchPromises = batches.slice(i, i + maxConcurrent).map(batch =>
        supabase
          .from(table)
          .select(selectColumns)
          .in(idColumn, batch)
      )

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(result => {
        if (result.data) {
          results.push(...(result.data as T[]))
        }
      })
    }

    return results
  }

  const fetchOrders = async () => {
    try {
      setLoading(true)
      console.log("Starting to fetch orders...")

      // For distributor users, pre-fetch their retailer IDs and subdistributor IDs for filtering
      let distributorRetailerIds: string[] = []
      let distributorPincodes: string[] = []
      let subDistributorIds: string[] = []

      if (isDistributor && entityId) {
        const { data: distRetailers } = await supabase
          .from('retailers')
          .select('id')
          .eq('distributor_id', entityId)
        distributorRetailerIds = (distRetailers || []).map((r: any) => r.id)
        distributorPincodes = entityDetails?.serviceable_pincodes || []

        // For main distributors: fetch their subdistributor IDs so they can see subdistributor orders
        if (isMainDistributor) {
          const { data: subDists } = await supabase
            .from('distributors')
            .select('id')
            .eq('parent_id', entityId)
          subDistributorIds = (subDists || []).map((d: any) => d.id)
        }
      }

      // Fetch orders - filtered for distributors, all for admin
      // Supabase has a default limit of 1000 rows per query, so we paginate
      const allOrders: any[] = []
      const batchSize = 1000
      let from = 0
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from("orders")
          .select("*")

        if (isRetailer && entityId) {
          // Retailers: only see their own orders (where retailer_id matches)
          query = query.eq("retailer_id", entityId)
        } else if (isDistributor && entityId) {
          if (isSubDistributor) {
            // Subdistributors: only see customer/retailer orders in their pincodes (NOT their own distributor purchase orders)
            const subFilterParts: string[] = []
            if (distributorPincodes.length > 0) {
              subFilterParts.push(`shipping_pincode.in.(${distributorPincodes.join(',')})`)
            }
            if (distributorRetailerIds.length > 0) {
              subFilterParts.push(`retailer_id.in.(${distributorRetailerIds.join(',')})`)
            }
            if (subFilterParts.length > 0) {
              query = query.or(subFilterParts.join(','))
            }
            // Exclude distributor orders — those belong in /distributor-orders
            query = query.is("distributor_id", null)
          } else {
            // Main distributors: see orders by pincode, their retailers, their subdistributors, and their own
            const filterParts: string[] = []
            if (distributorPincodes.length > 0) {
              filterParts.push(`shipping_pincode.in.(${distributorPincodes.join(',')})`)
            }
            if (distributorRetailerIds.length > 0) {
              filterParts.push(`retailer_id.in.(${distributorRetailerIds.join(',')})`)
            }
            // Own orders
            filterParts.push(`distributor_id.eq.${entityId}`)
            // Subdistributor orders (their children)
            if (subDistributorIds.length > 0) {
              filterParts.push(`distributor_id.in.(${subDistributorIds.join(',')})`)
            }
            query = query.or(filterParts.join(','))
          }
        } else {
          query = query.or("customer_id.not.is.null,retailer_id.not.is.null,distributor_id.not.is.null")
        }

        const { data: batch, error: batchError } = await query
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1)

        if (batchError) {
          console.error("Error fetching orders:", batchError)
          toast.error(`Failed to fetch orders: ${batchError.message}`)
          setLoading(false)
          return
        }

        if (batch && batch.length > 0) {
          allOrders.push(...batch)
          from += batchSize
          hasMore = batch.length === batchSize
        } else {
          hasMore = false
        }
      }

      const ordersData = allOrders
      console.log("Orders query result: total fetched =", ordersData.length)

      if (ordersData.length === 0) {
        setOrders([])
        setLoading(false)
        return
      }

      // Extract unique customer, distributor, and retailer IDs (deduplicated)
      const customerIds = [...new Set(
        ordersData
          .filter((order: any) => order.customer_id)
          .map((order: any) => order.customer_id)
      )]
      const distributorIds = [...new Set(
        ordersData
          .filter((order: any) => order.distributor_id)
          .map((order: any) => order.distributor_id)
      )]
      const retailerIds = [...new Set(
        ordersData
          .filter((order: any) => order.retailer_id)
          .map((order: any) => order.retailer_id)
      )]
      const deliveryPartnerIds = [...new Set(
        ordersData
          .filter((order: any) => order.delivery_partner_id)
          .map((order: any) => order.delivery_partner_id)
      )]

      // Extract unique shipping pincodes for distributor matching
      const shippingPincodes = [...new Set(
        ordersData
          .filter((order: any) => order.shipping_pincode)
          .map((order: any) => order.shipping_pincode)
      )]

      // Extract order IDs for route assignment lookup
      const orderIds = ordersData.map((order: any) => order.id)

      // Fetch customers, distributors, retailers, delivery partners, serviceable distributors, and route assignments in parallel
      // Using batched queries to handle large datasets (Supabase default limit is 1000 rows)
      console.log(`Fetching related data: ${customerIds.length} customers, ${distributorIds.length} distributors, ${retailerIds.length} retailers, ${orderIds.length} route assignments`)

      const [customersData, distributorsData, retailersData, deliveryPartnersData, serviceableDistributorsResult, routeAssignmentsData] = await Promise.all([
        // Batch fetch customers (most likely to be large)
        fetchInBatches<any>(
          "customers",
          "id, first_name, last_name, mobile_primary, mobile_secondary_1, mobile_secondary_2, whatsapp_number, whatsapp_same_as_primary, full_address, vip_number, email, company_name, gst_number",
          customerIds
        ),
        // Batch fetch distributors
        fetchInBatches<any>(
          "distributors",
          "id, name, phone_primary, company_name",
          distributorIds
        ),
        // Batch fetch retailers
        fetchInBatches<any>(
          "retailers",
          "id, name, phone_primary, company_name",
          retailerIds
        ),
        // Batch fetch delivery partners
        fetchInBatches<any>(
          "delivery_partners",
          "id, name, mobile",
          deliveryPartnerIds
        ),
        // Serviceable distributors - fetch all with serviceable_pincodes
        shippingPincodes.length > 0
          ? supabase
              .from("distributors")
              .select("id, name, serviceable_pincodes")
              .not("serviceable_pincodes", "is", null)
          : Promise.resolve({ data: [], error: null }),
        // Batch fetch route assignments
        fetchInBatches<any>(
          "route_assignments",
          "order_id, route_id, status, pickup_time, delivery_time, delivery_notes, collected_payment_method, collected_amount, customer_rating, customer_feedback",
          orderIds,
          "order_id"
        ),
      ])

      console.log(`Fetched: ${customersData.length} customers, ${distributorsData.length} distributors, ${retailersData.length} retailers`)

      // Create lookup maps
      const customersMap = new Map(
        customersData.map((c: any) => [c.id, c])
      )
      const distributorsMap = new Map(
        distributorsData.map((d: any) => [d.id, d])
      )
      const retailersMap = new Map(
        retailersData.map((r: any) => [r.id, r])
      )
      const deliveryPartnersMap = new Map(
        deliveryPartnersData.map((dp: any) => [dp.id, dp])
      )
      const routeAssignmentsMap = new Map(
        routeAssignmentsData.map((ra: any) => [ra.order_id, ra])
      )

      // Fetch route names for route assignments
      const routeIds = [...new Set(
        routeAssignmentsData
          .filter((ra: any) => ra.route_id)
          .map((ra: any) => ra.route_id)
      )]
      const routesData = routeIds.length > 0
        ? await fetchInBatches<any>("routes", "id, route_name", routeIds)
        : []
      const routesMap = new Map(
        routesData.map((r: any) => [r.id, r.route_name])
      )

      // Create pincode to distributor mapping
      const pincodeToDistributorMap = new Map<string, { id: string; name: string }>()
      ;(serviceableDistributorsResult.data || []).forEach((dist: any) => {
        if (dist.serviceable_pincodes && Array.isArray(dist.serviceable_pincodes)) {
          dist.serviceable_pincodes.forEach((pincode: string) => {
            // If multiple distributors service same pincode, first one wins
            if (!pincodeToDistributorMap.has(pincode)) {
              pincodeToDistributorMap.set(pincode, { id: dist.id, name: dist.name })
            }
          })
        }
      })

      // Map the data to the expected format
      const ordersWithCustomers = ordersData.map((order: any) => {
        let customer_name = "Unknown"
        let customer_phone = ""
        let customer_phone_secondary_1 = null
        let customer_phone_secondary_2 = null
        let customer_whatsapp: string | null = null
        let customer_full_address = ""
        let customer_vip_number = null
        let customer_email: string | null = null
        let customer_company_name: string | null = null
        let customer_gst_number: string | null = null

        if (order.customer_id) {
          const customer = customersMap.get(order.customer_id)
          if (customer) {
            customer_name = `${customer.first_name} ${customer.last_name}`.trim()
            customer_phone = customer.mobile_primary
            customer_phone_secondary_1 = customer.mobile_secondary_1
            customer_phone_secondary_2 = customer.mobile_secondary_2
            // Only set whatsapp if it's different from primary
            customer_whatsapp = customer.whatsapp_same_as_primary ? null : (customer.whatsapp_number || null)
            customer_full_address = customer.full_address
            customer_vip_number = customer.vip_number
            customer_email = customer.email || null
            customer_company_name = customer.company_name || null
            customer_gst_number = customer.gst_number || null
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
            customer_name = `${distributor.name} (${order.is_subdistributor ? 'Subdistributor' : 'Distributor'})`
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

        // Get route assignment details (real-time delivery tracking)
        const routeAssignment = routeAssignmentsMap.get(order.id)

        return {
          ...order,
          customer_name,
          customer_phone,
          customer_phone_secondary_1,
          customer_phone_secondary_2,
          customer_whatsapp,
          customer_full_address,
          customer_vip_number,
          customer_email,
          customer_company_name,
          customer_gst_number,
          serviceable_distributor_name: serviceableDistributor?.name || null,
          serviceable_distributor_id: serviceableDistributor?.id || null,
          delivery_partner_name: deliveryPartner?.name || null,
          delivery_partner_mobile: deliveryPartner?.mobile || null,
          // Route assignment data (real-time delivery status)
          route_assignment_status: routeAssignment?.status || null,
          pickup_time: routeAssignment?.pickup_time || null,
          delivery_time: routeAssignment?.delivery_time || null,
          delivery_notes: routeAssignment?.delivery_notes || null,
          collected_payment_method: routeAssignment?.collected_payment_method || null,
          collected_amount: routeAssignment?.collected_amount || null,
          route_name: routeAssignment?.route_id ? routesMap.get(routeAssignment.route_id) || null : null,
          customer_rating: routeAssignment?.customer_rating || null,
          customer_feedback: routeAssignment?.customer_feedback || null,
        }
      })

      // For subdistributors: only show customer orders where serviceable distributor is them
      const finalOrders = isSubDistributor && entityId
        ? ordersWithCustomers.filter((order: any) => {
            // Show their retailer orders
            if (order.retailer_id && distributorRetailerIds.includes(order.retailer_id)) return true
            // For customer orders: only show if serviceable distributor is them
            if (order.serviceable_distributor_id === entityId) return true
            // Hide everything else
            return false
          })
        : ordersWithCustomers

      setOrders(finalOrders || [])

      // Fetch all order items in bulk for export
      const allOrderItemsData = await fetchInBatches<any>(
        "order_items",
        "order_id, product_name, product_sku, quantity, unit_price, total",
        orderIds,
        "order_id"
      )
      const allOrderItemsMap: Record<string, any[]> = {}
      allOrderItemsData.forEach((item: any) => {
        if (!allOrderItemsMap[item.order_id]) {
          allOrderItemsMap[item.order_id] = []
        }
        allOrderItemsMap[item.order_id].push(item)
      })
      setOrderItems(allOrderItemsMap)

      // Extract unique distributors for filter dropdown
      const uniqueDistributorsMap = new Map<string, string>()
      ordersWithCustomers.forEach((order: any) => {
        if (order.serviceable_distributor_id && order.serviceable_distributor_name) {
          uniqueDistributorsMap.set(order.serviceable_distributor_id, order.serviceable_distributor_name)
        }
      })
      const distributorsList = Array.from(uniqueDistributorsMap.entries()).map(([id, name]) => ({ id, name }))
      distributorsList.sort((a, b) => a.name.localeCompare(b.name))
      setUniqueDistributors(distributorsList)

      setLoading(false)
      console.log("Orders loaded successfully:", ordersWithCustomers?.length)
    } catch (error) {
      console.error("Unexpected error in fetchOrders:", error)
      toast.error("An unexpected error occurred while fetching orders")
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

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      // Fetch full order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError

      // Fetch customer (or distributor, if this order belongs to one)
      const customerData = await fetchInvoiceParty(orderData)

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)

      if (itemsError) throw itemsError

      // Factory-supplied orders are always sold by the factory itself, never
      // by whichever distributor happens to service this shipping pincode.
      const companyInfo = orderData.is_factory_order
        ? FACTORY_COMPANY_INFO
        : orderData.shipping_pincode
          ? await fetchDistributorCompanyInfo(orderData.shipping_pincode)
          : undefined

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
          shipping_full_address: orderData.shipping_full_address || undefined,
          is_priority: orderData.is_priority || false,
          order_notes: orderData.order_notes || undefined,
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
          mobile_secondary_1: customerData.mobile_secondary_1 || undefined,
          mobile_secondary_2: customerData.mobile_secondary_2 || undefined,
          whatsapp_number: customerData.whatsapp_same_as_primary ? undefined : (customerData.whatsapp_number || undefined),
          company_name: customerData.company_name || undefined,
          gst_number: customerData.gst_number || undefined,
          full_address: customerData.full_address || undefined,
          vip_number: customerData.vip_number || undefined,
          mandir_number: customerData.mandir_number || undefined,
          shop_number: customerData.shop_number || undefined,
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
          item_description: item.item_description || undefined,
          weight_grams: item.weight_grams || undefined,
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

  const handleDownloadThermalReceipt = async (orderId: string) => {
    try {
      // Fetch full order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError

      // Fetch customer (or distributor, if this order belongs to one)
      const customerData = await fetchInvoiceParty(orderData)

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)

      if (itemsError) throw itemsError

      // Factory-supplied orders are always sold by the factory itself, never
      // by whichever distributor happens to service this shipping pincode.
      const thermalCompanyInfo = orderData.is_factory_order
        ? FACTORY_COMPANY_INFO
        : orderData.shipping_pincode
          ? await fetchDistributorCompanyInfo(orderData.shipping_pincode)
          : undefined

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
          shipping_full_address: orderData.shipping_full_address || undefined,
          is_priority: orderData.is_priority || false,
          order_notes: orderData.order_notes || undefined,
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
          mobile_secondary_1: customerData.mobile_secondary_1 || undefined,
          mobile_secondary_2: customerData.mobile_secondary_2 || undefined,
          whatsapp_number: customerData.whatsapp_same_as_primary ? undefined : (customerData.whatsapp_number || undefined),
          company_name: customerData.company_name || undefined,
          gst_number: customerData.gst_number || undefined,
          full_address: customerData.full_address || undefined,
          vip_number: customerData.vip_number || undefined,
          mandir_number: customerData.mandir_number || undefined,
          shop_number: customerData.shop_number || undefined,
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
          item_description: item.item_description || undefined,
          weight_grams: item.weight_grams || undefined,
        })),
        companyInfo: thermalCompanyInfo,
      }

      const customerName = `${customerData.first_name} ${customerData.last_name}`

      // Generate order page QR URL
      const paymentQrUrl = `${window.location.origin}/order/${orderData.order_number}`

      await generateThermalReceipt(invoiceData, customerName, paymentQrUrl)
      toast.success("Thermal receipt downloaded successfully")
    } catch (error) {
      console.error("Error downloading thermal receipt:", error)
      toast.error("Failed to download thermal receipt")
    }
  }

  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ order_status: "cancelled" })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Order ${orderNumber} has been cancelled`)
      fetchOrders() // Refresh the list
    } catch (error) {
      console.error("Error cancelling order:", error)
      toast.error("Failed to cancel order")
    }
  }

  const handleMarkAsDelivered = async (orderId: string, orderNumber: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          order_status: "delivered",
          delivery_status: "delivered",
          delivered_date: new Date().toISOString()
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Order ${orderNumber} marked as delivered`)
      fetchOrders() // Refresh the list
    } catch (error) {
      console.error("Error marking order as delivered:", error)
      toast.error("Failed to mark order as delivered")
    }
  }

  const handleCompleteOrder = async (orderId: string, orderNumber: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          order_status: "delivered",
          payment_status: "completed",
          delivery_status: "delivered",
          delivered_date: new Date().toISOString()
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Order ${orderNumber} has been completed`)
      fetchOrders() // Refresh the list
    } catch (error) {
      console.error("Error completing order:", error)
      toast.error("Failed to complete order")
    }
  }

  const handleAssignDriver = async (orderId: string, driverId: string, orderNumber: string) => {
    try {
      setAssigningDriver(orderId)

      // Get the order to find its pincode
      const order = orders.find(o => o.id === orderId)
      if (!order) {
        toast.error("Order not found")
        return
      }

      const driver = deliveryPartners.find(d => d.id === driverId)

      // Update the orders table with delivery partner assignment
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          delivery_partner_id: driverId,
          assigned_to_delivery_at: new Date().toISOString(),
          delivery_status: "assigned",
          order_status: order.order_status === "pending" ? "processing" : order.order_status
        })
        .eq("id", orderId)

      if (updateError) throw updateError

      // Try to find and assign to a route (optional - won't fail if no route exists)
      try {
        const { data: routes } = await supabase
          .from("routes")
          .select("id, route_name, pincodes")
          .eq("is_active", true)

        const matchingRoute = routes?.find(route =>
          route.pincodes && Array.isArray(route.pincodes) &&
          route.pincodes.includes(order.shipping_pincode)
        )

        if (matchingRoute) {
          // Get the max sequence number for this route
          const { data: existingAssignments } = await supabase
            .from("route_assignments")
            .select("sequence_number")
            .eq("route_id", matchingRoute.id)
            .order("sequence_number", { ascending: false })
            .limit(1)

          const nextSequence = existingAssignments && existingAssignments.length > 0
            ? (existingAssignments[0].sequence_number || 0) + 1
            : 1

          // Create route assignment (ignore error if already exists)
          await supabase
            .from("route_assignments")
            .insert({
              route_id: matchingRoute.id,
              order_id: orderId,
              delivery_partner_id: driverId,
              status: "assigned",
              sequence_number: nextSequence,
              assignment_date: new Date().toISOString(),
            })

          toast.success(`Order ${orderNumber} assigned to ${driver?.name || 'driver'} on route ${matchingRoute.route_name}`)
        } else {
          toast.success(`Order ${orderNumber} assigned to ${driver?.name || 'driver'}`)
        }
      } catch (routeError) {
        // Route assignment failed, but order is still assigned to driver
        console.log("Route assignment skipped:", routeError)
        toast.success(`Order ${orderNumber} assigned to ${driver?.name || 'driver'} (route assignment skipped)`)
      }

      fetchOrders() // Refresh the list
    } catch (error) {
      console.error("Error assigning driver:", error)
      toast.error("Failed to assign driver to order")
    } finally {
      setAssigningDriver(null)
    }
  }

  const handleUnassignDriver = async (orderId: string, orderNumber: string) => {
    try {
      setAssigningDriver(orderId)

      // Get current order to check status
      const order = orders.find(o => o.id === orderId)

      // Delete route assignment if it exists
      const { error: deleteError } = await supabase
        .from("route_assignments")
        .delete()
        .eq("order_id", orderId)

      if (deleteError) {
        console.error("Error deleting route assignment:", deleteError)
        // Don't throw - continue to update orders table
      }

      // Update the orders table - reset to pending if it was in processing
      const { error } = await supabase
        .from("orders")
        .update({
          delivery_partner_id: null,
          assigned_to_delivery_at: null,
          delivery_status: "not_assigned",
          order_status: order?.order_status === "processing" ? "pending" : order?.order_status
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Driver unassigned from order ${orderNumber}`)
      fetchOrders() // Refresh the list
    } catch (error) {
      console.error("Error unassigning driver:", error)
      toast.error("Failed to unassign driver")
    } finally {
      setAssigningDriver(null)
    }
  }

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return

    try {
      // Delete route assignments first (if any)
      const { error: assignmentError } = await supabase
        .from("route_assignments")
        .delete()
        .eq("order_id", deletingOrder.id)

      if (assignmentError) {
        console.error("Error deleting route assignments:", assignmentError)
        // Don't throw - continue with deletion
      }

      // Delete order items (foreign key constraint)
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", deletingOrder.id)

      if (itemsError) throw itemsError

      // Delete the order
      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", deletingOrder.id)

      if (orderError) throw orderError

      toast.success(`Order ${deletingOrder.orderNumber} has been deleted`)
      setDeleteDialogOpen(false)
      setDeletingOrder(null)
      fetchOrders()
    } catch (error) {
      console.error("Error deleting order:", error)
      toast.error("Failed to delete order")
    }
  }

  // Get drivers that can service a particular pincode
  const getAvailableDriversForOrder = (order: Order): {
    recommended: DeliveryPartner[]
    others: DeliveryPartner[]
  } => {
    if (!order.shipping_pincode) {
      return { recommended: [], others: deliveryPartners }
    }

    const recommended: DeliveryPartner[] = []
    const others: DeliveryPartner[] = []

    deliveryPartners.forEach(driver => {
      if (driver.serviceable_pincodes && driver.serviceable_pincodes.length > 0) {
        if (driver.serviceable_pincodes.includes(order.shipping_pincode)) {
          recommended.push(driver)
        } else {
          others.push(driver)
        }
      } else {
        // If no pincodes specified, add to others
        others.push(driver)
      }
    })

    return { recommended, others }
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
            name: match.company_name || match.name,
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

  const handleBulkPrintInvoices = async () => {
    if (selectedOrders.size === 0) {
      toast.error("No orders selected")
      return
    }

    try {
      setBulkPrintLoading(true)
      toast.loading(`Generating ${selectedOrders.size} invoices...`)

      const invoicesData = []
      const failedOrders: string[] = []

      // Fetch data for all selected orders
      for (const orderId of Array.from(selectedOrders)) {
        try {
          // Fetch order
          const { data: orderData, error: orderError } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single()

          if (orderError) throw orderError

          // Fetch customer (or distributor, if this order belongs to one)
          const customerData = await fetchInvoiceParty(orderData)

          // Fetch order items
          const { data: itemsData, error: itemsError } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", orderId)

          if (itemsError) throw itemsError

          // Factory-supplied orders are always sold by the factory itself,
          // never by whichever distributor happens to service this pincode.
          const companyInfo = orderData.is_factory_order
            ? FACTORY_COMPANY_INFO
            : orderData.shipping_pincode
              ? await fetchDistributorCompanyInfo(orderData.shipping_pincode)
              : undefined

          // Structure the invoice data
          invoicesData.push({
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
              shipping_full_address: orderData.shipping_full_address || undefined,
              is_priority: orderData.is_priority || false,
              order_notes: orderData.order_notes || undefined,
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
              mobile_secondary_1: customerData.mobile_secondary_1 || undefined,
              mobile_secondary_2: customerData.mobile_secondary_2 || undefined,
              whatsapp_number: customerData.whatsapp_same_as_primary ? undefined : (customerData.whatsapp_number || undefined),
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
              item_description: item.item_description || undefined,
              weight_grams: item.weight_grams || undefined,
            })),
            companyInfo,
          })
        } catch (error) {
          console.error(`Error fetching data for order ${orderId}:`, error)
          const order = orders.find(o => o.id === orderId)
          if (order) {
            failedOrders.push(order.order_number)
          }
        }
      }

      toast.dismiss()

      if (invoicesData.length === 0) {
        toast.error("Failed to fetch data for all selected orders")
        setBulkPrintLoading(false)
        return
      }

      // Generate bulk PDF
      generateBulkOrderInvoices(invoicesData)

      // Show success message
      if (failedOrders.length > 0) {
        toast.warning(
          `Generated ${invoicesData.length} invoices. Failed: ${failedOrders.join(", ")}`
        )
      } else {
        toast.success(`Successfully generated ${invoicesData.length} invoices`)
      }

      // Clear selections
      setSelectedOrders(new Set())
      setBulkPrintLoading(false)
    } catch (error) {
      console.error("Error generating bulk invoices:", error)
      toast.dismiss()
      toast.error("Failed to generate bulk invoices")
      setBulkPrintLoading(false)
    }
  }

  const handleBulkThermalPrint = async () => {
    if (selectedOrders.size === 0) {
      toast.error("No orders selected")
      return
    }

    try {
      setBulkThermalPrintLoading(true)
      toast.loading(`Generating ${selectedOrders.size} thermal receipts...`)

      const thermalData: Array<{ data: any; customerName?: string; paymentQrUrl?: string }> = []
      const failedOrders: string[] = []

      // Fetch data for all selected orders
      for (const orderId of Array.from(selectedOrders)) {
        try {
          // Fetch order
          const { data: orderData, error: orderError } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single()

          if (orderError) throw orderError

          // Fetch customer (or distributor, if this order belongs to one)
          const customerData = await fetchInvoiceParty(orderData)

          // Fetch order items
          const { data: itemsData, error: itemsError } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", orderId)

          if (itemsError) throw itemsError

          const customerName = `${customerData.first_name} ${customerData.last_name}`

          // Generate order page QR URL
          const paymentQrUrl = `${window.location.origin}/order/${orderData.order_number}`

          // Factory-supplied orders are always sold by the factory itself,
          // never by whichever distributor happens to service this pincode.
          const companyInfo = orderData.is_factory_order
            ? FACTORY_COMPANY_INFO
            : orderData.shipping_pincode
              ? await fetchDistributorCompanyInfo(orderData.shipping_pincode)
              : undefined

          // Structure the invoice data
          thermalData.push({
            data: {
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
                shipping_full_address: orderData.shipping_full_address || undefined,
                is_priority: orderData.is_priority || false,
                order_notes: orderData.order_notes || undefined,
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
                mobile_secondary_1: customerData.mobile_secondary_1 || undefined,
                mobile_secondary_2: customerData.mobile_secondary_2 || undefined,
                whatsapp_number: customerData.whatsapp_same_as_primary ? undefined : (customerData.whatsapp_number || undefined),
                company_name: customerData.company_name || undefined,
                gst_number: customerData.gst_number || undefined,
                full_address: customerData.full_address || undefined,
                vip_number: customerData.vip_number || undefined,
                mandir_number: customerData.mandir_number || undefined,
                shop_number: customerData.shop_number || undefined,
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
                item_description: item.item_description || undefined,
                weight_grams: item.weight_grams || undefined,
              })),
              companyInfo,
            },
            customerName,
            paymentQrUrl
          })
        } catch (error) {
          console.error(`Error fetching data for order ${orderId}:`, error)
          const order = orders.find(o => o.id === orderId)
          if (order) {
            failedOrders.push(order.order_number)
          }
        }
      }

      toast.dismiss()

      if (thermalData.length === 0) {
        toast.error("Failed to fetch data for all selected orders")
        setBulkThermalPrintLoading(false)
        return
      }

      // Generate bulk thermal PDF
      await generateBulkThermalReceipts(thermalData)

      // Show success message
      if (failedOrders.length > 0) {
        toast.warning(
          `Generated ${thermalData.length} thermal receipts. Failed: ${failedOrders.join(", ")}`
        )
      } else {
        toast.success(`Successfully generated ${thermalData.length} thermal receipts`)
      }

      // Clear selections
      setSelectedOrders(new Set())
      setBulkThermalPrintLoading(false)
    } catch (error) {
      console.error("Error generating bulk thermal receipts:", error)
      toast.dismiss()
      toast.error("Failed to generate bulk thermal receipts")
      setBulkThermalPrintLoading(false)
    }
  }

  const confirmBulkMarkAsDelivered = () => {
    if (selectedOrders.size === 0) {
      toast.error("No orders selected")
      return
    }

    const selectedOrderIds = Array.from(selectedOrders)
    const ordersToUpdate = orders.filter(order =>
      selectedOrderIds.includes(order.id) &&
      order.order_status !== "delivered" &&
      order.order_status !== "cancelled"
    )

    if (ordersToUpdate.length === 0) {
      toast.error("No eligible orders to mark as delivered (already delivered or cancelled)")
      return
    }

    setBulkDeliveryDialogOpen(true)
  }

  const handleBulkMarkAsDelivered = async () => {
    setBulkDeliveryDialogOpen(false)

    try {
      setBulkDeliveredLoading(true)
      const selectedOrderIds = Array.from(selectedOrders)

      // Filter out orders that are already delivered or cancelled
      const ordersToUpdate = orders.filter(order =>
        selectedOrderIds.includes(order.id) &&
        order.order_status !== "delivered" &&
        order.order_status !== "cancelled"
      )

      const orderIdsToUpdate = ordersToUpdate.map(o => o.id)
      const currentTime = new Date().toISOString()

      toast.loading(`Marking ${ordersToUpdate.length} orders as delivered...`)

      // Update all selected orders in the orders table
      const { error: ordersError } = await supabase
        .from("orders")
        .update({
          order_status: "delivered",
          delivery_status: "delivered",
          delivered_date: currentTime
        })
        .in("id", orderIdsToUpdate)

      if (ordersError) throw ordersError

      // Update route assignments if they exist (don't fail if no route assignments)
      try {
        const { error: routeError } = await supabase
          .from("route_assignments")
          .update({
            status: "delivered",
            delivery_time: currentTime
          })
          .in("order_id", orderIdsToUpdate)

        if (routeError) {
          console.log("Route assignment update skipped or failed:", routeError)
        }
      } catch (routeUpdateError) {
        // Non-critical error - orders are still marked as delivered
        console.log("Route assignment update error:", routeUpdateError)
      }

      toast.dismiss()
      toast.success(`Successfully marked ${ordersToUpdate.length} order${ordersToUpdate.length > 1 ? 's' : ''} as delivered`)

      // Clear selections and refresh
      setSelectedOrders(new Set())
      fetchOrders()
    } catch (error) {
      console.error("Error marking orders as delivered:", error)
      toast.dismiss()
      toast.error("Failed to mark orders as delivered")
    } finally {
      setBulkDeliveredLoading(false)
    }
  }

  const confirmBulkComplete = () => {
    if (selectedOrders.size === 0) {
      toast.error("No orders selected")
      return
    }

    const selectedOrderIds = Array.from(selectedOrders)
    const ordersToUpdate = orders.filter(order =>
      selectedOrderIds.includes(order.id) &&
      order.order_status !== "completed" &&
      order.order_status !== "cancelled"
    )

    if (ordersToUpdate.length === 0) {
      toast.error("No eligible orders to complete (already completed or cancelled)")
      return
    }

    setBulkCompletePaymentMethod("cash")
    setBulkCompleteDialogOpen(true)
  }

  const handleBulkComplete = async () => {
    setBulkCompleteDialogOpen(false)

    try {
      setBulkCompleteLoading(true)
      const selectedOrderIds = Array.from(selectedOrders)

      // Filter out orders that are already completed or cancelled
      const ordersToUpdate = orders.filter(order =>
        selectedOrderIds.includes(order.id) &&
        order.order_status !== "completed" &&
        order.order_status !== "cancelled"
      )

      const orderIdsToUpdate = ordersToUpdate.map(o => o.id)
      const currentTime = new Date().toISOString()

      toast.loading(`Completing ${ordersToUpdate.length} orders...`)

      // Update all selected orders
      const { error: ordersError } = await supabase
        .from("orders")
        .update({
          order_status: "delivered",
          payment_status: "completed",
          payment_method: bulkCompletePaymentMethod,
          delivery_status: "delivered",
          delivered_date: currentTime
        })
        .in("id", orderIdsToUpdate)

      if (ordersError) throw ordersError

      // Update route assignments if they exist - include payment info
      try {
        // Get total amounts for each order to set collected_amount
        const orderAmountsMap = new Map(ordersToUpdate.map(o => [o.id, o.total_amount]))

        // Update route assignments in batches per order for collected_amount
        for (const orderId of orderIdsToUpdate) {
          const { error: routeError } = await supabase
            .from("route_assignments")
            .update({
              status: "delivered",
              delivery_time: currentTime,
              collected_payment_method: bulkCompletePaymentMethod,
              collected_amount: orderAmountsMap.get(orderId) || 0,
            })
            .eq("order_id", orderId)

          if (routeError) {
            console.log(`Route assignment update skipped for order ${orderId}:`, routeError)
          }
        }
      } catch (routeUpdateError) {
        console.log("Route assignment update error:", routeUpdateError)
      }

      toast.dismiss()
      toast.success(`Successfully completed ${ordersToUpdate.length} order${ordersToUpdate.length > 1 ? 's' : ''} with payment: ${bulkCompletePaymentMethod.replace(/_/g, ' ')}`)

      // Clear selections and refresh
      setSelectedOrders(new Set())
      fetchOrders()
    } catch (error) {
      console.error("Error completing orders:", error)
      toast.dismiss()
      toast.error("Failed to complete orders")
    } finally {
      setBulkCompleteLoading(false)
    }
  }

  // Digits-only version of the search term so phone searches tolerate
  // spaces/dashes (e.g. "99676 93914" matches "9967693914")
  const searchDigits = searchTerm.replace(/\D/g, "")
  const matchesPhoneDigits = (phone: string | null | undefined) =>
    !!phone && searchDigits.length >= 4 && phone.replace(/\D/g, "").includes(searchDigits)

  const filteredOrders = orders.filter((order) => {
    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_phone && order.customer_phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_phone_secondary_1 && order.customer_phone_secondary_1.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_phone_secondary_2 && order.customer_phone_secondary_2.toLowerCase().includes(searchTerm.toLowerCase())) ||
      matchesPhoneDigits(order.customer_phone) ||
      matchesPhoneDigits(order.customer_phone_secondary_1) ||
      matchesPhoneDigits(order.customer_phone_secondary_2) ||
      (order.customer_vip_number && order.customer_vip_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_full_address && order.customer_full_address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.shipping_full_address && order.shipping_full_address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.shipping_city && order.shipping_city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.shipping_pincode && order.shipping_pincode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      order.order_status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.payment_status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.invoice_number_gst && order.invoice_number_gst.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.invoice_number_non_gst && order.invoice_number_non_gst.toLowerCase().includes(searchTerm.toLowerCase()))

    // Date range filter
    const orderDate = new Date(order.order_date || order.created_at)
    const matchesDateFrom = !dateFrom || orderDate >= dateFrom
    const matchesDateTo = !dateTo || orderDate <= dateTo

    // Order status filter
    const matchesOrderStatus =
      orderStatusFilter === "all" ||
      order.order_status.toLowerCase() === orderStatusFilter.toLowerCase()

    // Delivery status filter (using route_assignment_status as source of truth)
    const matchesDeliveryStatus =
      deliveryStatusFilter === "all" ||
      (order.route_assignment_status && order.route_assignment_status.toLowerCase() === deliveryStatusFilter.toLowerCase()) ||
      (deliveryStatusFilter === "not_assigned" && !order.route_assignment_status && !order.delivery_partner_id) ||
      (deliveryStatusFilter === "assigned" && !order.route_assignment_status && order.delivery_partner_id)

    // Payment method filter
    const matchesPaymentMethod =
      paymentMethodFilter === "all" ||
      (order.collected_payment_method && order.collected_payment_method.toLowerCase() === paymentMethodFilter.toLowerCase()) ||
      (!order.collected_payment_method && order.payment_method && order.payment_method.toLowerCase() === paymentMethodFilter.toLowerCase())

    // Distributor filter
    const matchesDistributor =
      distributorFilter === "all" ||
      order.serviceable_distributor_id === distributorFilter

    // Delivery partner filter
    const matchesDeliveryPartner =
      deliveryPartnerFilter === "all" ||
      (deliveryPartnerFilter === "not_assigned" && !order.delivery_partner_id) ||
      order.delivery_partner_id === deliveryPartnerFilter

    // Amount range filter
    const amountFromNum = amountFrom ? parseFloat(amountFrom) : null
    const amountToNum = amountTo ? parseFloat(amountTo) : null
    const matchesAmountFrom = !amountFromNum || order.total_amount >= amountFromNum
    const matchesAmountTo = !amountToNum || order.total_amount <= amountToNum

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesOrderStatus &&
      matchesDeliveryStatus &&
      matchesPaymentMethod &&
      matchesDistributor &&
      matchesDeliveryPartner &&
      matchesAmountFrom &&
      matchesAmountTo
    )
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, dateFrom, dateTo, orderStatusFilter, deliveryStatusFilter, paymentMethodFilter, distributorFilter, deliveryPartnerFilter, amountFrom, amountTo])

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setOrderStatusFilter("all")
    setDeliveryStatusFilter("all")
    setPaymentMethodFilter("all")
    setDistributorFilter("all")
    setDeliveryPartnerFilter("all")
    setAmountFrom("")
    setAmountTo("")
    setSearchTerm("")
    setCurrentPage(1)
  }

  const hasActiveFilters =
    dateFrom ||
    dateTo ||
    orderStatusFilter !== "all" ||
    deliveryStatusFilter !== "all" ||
    paymentMethodFilter !== "all" ||
    distributorFilter !== "all" ||
    deliveryPartnerFilter !== "all" ||
    amountFrom !== "" ||
    amountTo !== "" ||
    searchTerm !== ""

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

  const getRowColorClasses = (order: Order) => {
    // Priority orders get a distinct styling
    if (order.is_priority && order.order_status !== "delivered" && order.order_status !== "cancelled") {
      return "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500"
    }

    if (order.route_assignment_status === "failed" || order.order_status === "failed") {
      return "bg-red-50 hover:bg-red-100"
    }

    if (order.order_status === "cancelled") {
      return "bg-gray-100 hover:bg-gray-200"
    }

    // Payment still pending — flagged ahead of delivery status so a
    // delivered-but-unpaid order still stands out instead of showing green
    // ("done") while money hasn't actually come in yet. Previously this only
    // triggered when order_status was ALSO "pending", so a delivered order
    // with pending payment (exactly what happened with 172 factory orders)
    // was invisible here.
    if (order.payment_status === "pending") {
      return "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500"
    }

    // Check route assignment status first (real-time data)
    if (order.route_assignment_status === "delivered" || order.order_status === "delivered") {
      return "bg-green-50 hover:bg-green-100"
    }

    // In transit or picked up
    if (order.route_assignment_status === "in_transit" || order.route_assignment_status === "picked_up" || order.route_assignment_status === "out_for_delivery") {
      return "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500"
    }

    // Processing orders
    if (order.order_status === "processing") {
      return "bg-blue-50 hover:bg-blue-100"
    }

    // Default
    return "hover:bg-muted/50"
  }

  // Prepare export data
  const exportData = filteredOrders.map(order => {
    const items = orderItems[order.id] || []
    const itemsSummary = items.map(item => `${item.product_name} (x${item.quantity})`).join(', ')
    const itemsSKUs = items.map(item => item.product_sku || '').filter(Boolean).join(', ')
    const itemsQty = items.reduce((sum, item) => sum + item.quantity, 0)

    return {
      'Order Number': order.order_number,
      'Source': order.source || '',
      'Created By': order.created_by_agent_name || '',
      'Customer': order.customer_name || 'Unknown',
      'Email': order.customer_email || '',
      'Phone': order.customer_phone || '',
      'WhatsApp': order.customer_whatsapp || '',
      'Phone 2': order.customer_phone_secondary_1 || '',
      'Phone 3': order.customer_phone_secondary_2 || '',
      'Company Name': order.customer_company_name || '',
      'GST Number': order.customer_gst_number || '',
      'Sd Number': order.customer_vip_number || '',
      'Address': order.customer_full_address || '',
      'Shipping Address': order.shipping_full_address || `${order.shipping_city}, ${order.shipping_state}`,
      'Pincode': order.shipping_pincode || '',
      'Distributor': order.serviceable_distributor_name || 'No distributor',
      'Items': itemsSummary,
      'SKUs': itemsSKUs,
      'Total Qty': itemsQty,
      'Subtotal': order.subtotal ? `₹${Number(order.subtotal).toFixed(2)}` : '',
      'Discount': order.discount_amount ? `₹${Number(order.discount_amount).toFixed(2)}` : '',
      'CGST': order.cgst_amount ? `₹${Number(order.cgst_amount).toFixed(2)}` : '',
      'SGST': order.sgst_amount ? `₹${Number(order.sgst_amount).toFixed(2)}` : '',
      'IGST': order.igst_amount ? `₹${Number(order.igst_amount).toFixed(2)}` : '',
      'Shipping Charges': order.shipping_charges ? `₹${Number(order.shipping_charges).toFixed(2)}` : '',
      'Amount': `₹${order.total_amount.toFixed(2)}`,
      'Order Status': order.order_status,
      'Payment Status': order.payment_status,
      'Payment Method': order.payment_method ? order.payment_method.replace(/_/g, ' ') : 'Not specified',
      'Transaction ID': order.transaction_id || '',
      'Invoice GST': order.invoice_number_gst || '',
      'Invoice Non-GST': order.invoice_number_non_gst || '',
      'Collected Payment': order.collected_payment_method ? order.collected_payment_method.replace(/_/g, ' ') : '',
      'Collected Amount': order.collected_amount ? `₹${Number(order.collected_amount).toFixed(2)}` : '',
      'COD Payment Method': order.cod_payment_method ? order.cod_payment_method.replace(/_/g, ' ') : '',
      'COD Collected Amount': order.cod_collected_amount || '',
      'Route Name': order.route_name || '',
      'Delivery Driver': order.delivery_partner_name || 'Not assigned',
      'Driver Phone': order.delivery_partner_mobile || '',
      'Delivery Status': order.route_assignment_status ? order.route_assignment_status.replace(/_/g, ' ') : (order.delivery_partner_id ? 'Assigned' : 'Not assigned'),
      'Pickup Time': order.pickup_time ? format(new Date(order.pickup_time), 'PPp') : '',
      'Delivery Time': order.delivery_time ? format(new Date(order.delivery_time), 'PPp') : '',
      'Delivery Proof URL': order.delivery_proof_url || '',
      'Shipping Method': order.shipping_method || '',
      'Tracking Number': order.tracking_number || '',
      'Courier Partner': order.courier_partner || '',
      'Expected Delivery': order.expected_delivery_date ? format(new Date(order.expected_delivery_date), 'PPP') : '',
      'Shipped Date': order.shipped_date ? format(new Date(order.shipped_date), 'PPP') : '',
      'Delivered Date': order.delivered_date ? format(new Date(order.delivered_date), 'PPP') : '',
      'Priority': order.is_priority ? 'Yes' : 'No',
      'Failed At': order.failed_at ? format(new Date(order.failed_at), 'PPP') : '',
      'Failure Reason': order.failure_reason || '',
      'Failed Attempts': order.failed_attempts || '',
      'Next Delivery': order.next_delivery_at ? format(new Date(order.next_delivery_at), 'PPp') : '',
      'Order Notes': order.order_notes || '',
      'Customer Notes': order.customer_notes || '',
      'Internal Notes': order.internal_notes || '',
      'Customer Rating': order.customer_rating || '',
      'Customer Feedback': order.customer_feedback || '',
      'Order Date': format(new Date(order.order_date || order.created_at), 'PPP')
    }
  })

  const exportColumns = [
    { header: 'Order #', dataKey: 'Order Number' },
    { header: 'Source', dataKey: 'Source' },
    { header: 'Created By', dataKey: 'Created By' },
    { header: 'Customer', dataKey: 'Customer' },
    { header: 'Email', dataKey: 'Email' },
    { header: 'Phone', dataKey: 'Phone' },
    { header: 'Company', dataKey: 'Company Name' },
    { header: 'GST Number', dataKey: 'GST Number' },
    { header: 'Sd Number', dataKey: 'Sd Number' },
    { header: 'Address', dataKey: 'Address' },
    { header: 'Shipping Address', dataKey: 'Shipping Address' },
    { header: 'Pincode', dataKey: 'Pincode' },
    { header: 'Distributor', dataKey: 'Distributor' },
    { header: 'Items', dataKey: 'Items' },
    { header: 'SKUs', dataKey: 'SKUs' },
    { header: 'Total Qty', dataKey: 'Total Qty' },
    { header: 'Subtotal', dataKey: 'Subtotal' },
    { header: 'Discount', dataKey: 'Discount' },
    { header: 'CGST', dataKey: 'CGST' },
    { header: 'SGST', dataKey: 'SGST' },
    { header: 'IGST', dataKey: 'IGST' },
    { header: 'Shipping Charges', dataKey: 'Shipping Charges' },
    { header: 'Amount', dataKey: 'Amount' },
    { header: 'Status', dataKey: 'Order Status' },
    { header: 'Payment', dataKey: 'Payment Status' },
    { header: 'Payment Method', dataKey: 'Payment Method' },
    { header: 'Transaction ID', dataKey: 'Transaction ID' },
    { header: 'Invoice GST', dataKey: 'Invoice GST' },
    { header: 'Invoice Non-GST', dataKey: 'Invoice Non-GST' },
    { header: 'Collected Payment', dataKey: 'Collected Payment' },
    { header: 'Collected Amount', dataKey: 'Collected Amount' },
    { header: 'COD Payment Method', dataKey: 'COD Payment Method' },
    { header: 'COD Collected Amount', dataKey: 'COD Collected Amount' },
    { header: 'Route', dataKey: 'Route Name' },
    { header: 'Delivery Driver', dataKey: 'Delivery Driver' },
    { header: 'Driver Phone', dataKey: 'Driver Phone' },
    { header: 'Delivery Status', dataKey: 'Delivery Status' },
    { header: 'Pickup Time', dataKey: 'Pickup Time' },
    { header: 'Delivery Time', dataKey: 'Delivery Time' },
    { header: 'Delivery Proof', dataKey: 'Delivery Proof URL' },
    { header: 'Shipping Method', dataKey: 'Shipping Method' },
    { header: 'Tracking #', dataKey: 'Tracking Number' },
    { header: 'Courier', dataKey: 'Courier Partner' },
    { header: 'Expected Delivery', dataKey: 'Expected Delivery' },
    { header: 'Shipped Date', dataKey: 'Shipped Date' },
    { header: 'Delivered Date', dataKey: 'Delivered Date' },
    { header: 'Priority', dataKey: 'Priority' },
    { header: 'Failed At', dataKey: 'Failed At' },
    { header: 'Failure Reason', dataKey: 'Failure Reason' },
    { header: 'Failed Attempts', dataKey: 'Failed Attempts' },
    { header: 'Next Delivery', dataKey: 'Next Delivery' },
    { header: 'Order Notes', dataKey: 'Order Notes' },
    { header: 'Customer Notes', dataKey: 'Customer Notes' },
    { header: 'Internal Notes', dataKey: 'Internal Notes' },
    { header: 'Rating', dataKey: 'Customer Rating' },
    { header: 'Feedback', dataKey: 'Customer Feedback' },
    { header: 'Date', dataKey: 'Order Date' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Orders</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage orders</p>
        </div>
        <div className="flex gap-2">
          {selectedOrders.size === 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/failed-orders")}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Failed
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/balance-payment-orders")}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Balance
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/distributor-orders")}
          >
            <Users className="mr-2 h-4 w-4" />
            Distributor Orders
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/orders/invoice-management")}
          >
            <Edit className="mr-2 h-4 w-4" />
            Invoices
          </Button>
          {selectedOrders.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={confirmBulkMarkAsDelivered}
                disabled={bulkDeliveredLoading}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Delivered ({selectedOrders.size})
              </Button>
              <Button
                variant="outline"
                onClick={confirmBulkComplete}
                disabled={bulkCompleteLoading}
                className="border-green-500 text-green-700 hover:bg-green-50"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Complete ({selectedOrders.size})
              </Button>
              <Button
                variant="default"
                onClick={handleBulkPrintInvoices}
                disabled={bulkPrintLoading}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print ({selectedOrders.size})
              </Button>
              <Button
                variant="outline"
                onClick={handleBulkThermalPrint}
                disabled={bulkThermalPrintLoading}
                title="Thermal Print (80mm)"
              >
                <Printer className="mr-2 h-4 w-4" />
                Thermal ({selectedOrders.size})
              </Button>
            </>
          )}
          <ExportButtons
            data={exportData}
            filename="orders"
            columns={exportColumns}
            pdfTitle="Orders Report"
          />
          <Button onClick={() => router.push("/dashboard/orders/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      <Card className="min-w-0 max-w-full">
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search orders, invoices, address, pincode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[280px]"
              />

              {/* Order Status */}
              <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Order Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Delivery Status */}
              <Select value={deliveryStatusFilter} onValueChange={setDeliveryStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Delivery Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Delivery Status</SelectItem>
                  <SelectItem value="not_assigned">Not Assigned</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="picked_up">Picked Up</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>

              {/* Payment Method */}
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="net_banking">Net Banking</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="cod">COD</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="balance">Balance</SelectItem>
                </SelectContent>
              </Select>

              {/* Distributor */}
              <Select value={distributorFilter} onValueChange={setDistributorFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Distributor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Distributors</SelectItem>
                  {uniqueDistributors.map((distributor) => (
                    <SelectItem key={distributor.id} value={distributor.id}>
                      {distributor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Delivery Partner */}
              <Select value={deliveryPartnerFilter} onValueChange={setDeliveryPartnerFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Delivery Partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Delivery Partners</SelectItem>
                  <SelectItem value="not_assigned">Not Assigned</SelectItem>
                  {deliveryPartners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
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

              {/* Amount From */}
              <Input
                type="number"
                placeholder="Amount From ₹"
                value={amountFrom}
                onChange={(e) => setAmountFrom(e.target.value)}
                className="w-[150px]"
                min="0"
                step="0.01"
              />

              {/* Amount To */}
              <Input
                type="number"
                placeholder="Amount To ₹"
                value={amountTo}
                onChange={(e) => setAmountTo(e.target.value)}
                className="w-[150px]"
                min="0"
                step="0.01"
              />

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear All Filters
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
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Delivery Driver</TableHead>
                  <TableHead>Delivery Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => {
                    const isExpanded = expandedRows.has(order.id)
                    const items = orderItems[order.id] || []

                    return (
                      <React.Fragment key={order.id}>
                        <TableRow
                          className={cn("cursor-pointer", getRowColorClasses(order))}
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
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.has(order.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedOrders)
                                if (checked) {
                                  newSelected.add(order.id)
                                } else {
                                  newSelected.delete(order.id)
                                }
                                setSelectedOrders(newSelected)
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(order.order_date || order.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownloadThermalReceipt(order.id)
                                  }}
                                  className="p-1 hover:bg-muted rounded transition-colors"
                                  title="Thermal Print (80mm)"
                                >
                                  <Printer className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const url = `${window.location.origin}/order/${order.order_number}`
                                    navigator.clipboard.writeText(url)
                                    window.open(`/order/${order.order_number}`, '_blank')
                                  }}
                                  className="p-1 hover:bg-muted rounded transition-colors"
                                  title="QR Payment Page (opens & copies link)"
                                >
                                  <QrCode className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/dashboard/orders/${order.id}`)
                                  }}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
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
                          <TableCell>
                            <div className="max-w-xs">
                              <div className="truncate font-medium" title={order.shipping_full_address || `${order.shipping_city}, ${order.shipping_state}`}>
                                {order.shipping_full_address
                                  ? order.shipping_full_address
                                  : order.shipping_city && order.shipping_state
                                  ? `${order.shipping_city}, ${order.shipping_state}`
                                  : 'Address not available'}
                              </div>
                              {order.shipping_pincode && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  PIN: {order.shipping_pincode}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {order.serviceable_distributor_name && order.serviceable_distributor_id ? (
                              <button
                                onClick={() => router.push(`/dashboard/distributors/${order.serviceable_distributor_id}`)}
                                className="flex flex-col text-left hover:text-primary transition-colors"
                              >
                                <span className="font-medium hover:underline">{order.serviceable_distributor_name}</span>
                                <span className="text-xs text-muted-foreground">Services {order.shipping_pincode}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">No distributor</span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {order.delivery_partner_id && order.delivery_partner_name ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{order.delivery_partner_name}</span>
                                {order.delivery_partner_mobile && (
                                  <span className="text-xs text-muted-foreground">{order.delivery_partner_mobile}</span>
                                )}
                                {order.assigned_to_delivery_at && (
                                  <span className="text-xs text-muted-foreground">
                                    Assigned {format(new Date(order.assigned_to_delivery_at), 'PP')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {order.route_assignment_status ? (
                              <div className="flex flex-col gap-1">
                                <Badge
                                  variant={
                                    order.route_assignment_status === 'delivered' ? 'default' :
                                    order.route_assignment_status === 'in_transit' || order.route_assignment_status === 'picked_up' ? 'outline' :
                                    order.route_assignment_status === 'failed' ? 'destructive' :
                                    'secondary'
                                  }
                                >
                                  {order.route_assignment_status.replace(/_/g, ' ')}
                                </Badge>
                                {order.pickup_time && (
                                  <span className="text-xs text-muted-foreground">
                                    Picked: {format(new Date(order.pickup_time), 'PP p')}
                                  </span>
                                )}
                                {order.delivery_time && (
                                  <span className="text-xs text-muted-foreground">
                                    Delivered: {format(new Date(order.delivery_time), 'PP p')}
                                  </span>
                                )}
                              </div>
                            ) : order.delivery_partner_id ? (
                              <Badge variant="secondary">assigned</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {order.collected_payment_method ? (
                                <>
                                  <span className={cn(
                                    "text-sm capitalize font-medium",
                                    order.collected_amount && Number(order.collected_amount) === order.total_amount && "text-green-600"
                                  )}>
                                    {order.collected_payment_method.replace(/_/g, ' ')}
                                  </span>
                                  {order.collected_amount && (
                                    <span className={cn(
                                      "text-xs font-medium",
                                      Number(order.collected_amount) === order.total_amount ? "text-green-600" : "text-muted-foreground"
                                    )}>
                                      Collected: ₹{Number(order.collected_amount).toFixed(2)}
                                    </span>
                                  )}
                                </>
                              ) : order.cod_payment_method ? (
                                <>
                                  <span className={cn(
                                    "text-sm capitalize font-medium",
                                    order.cod_collected_amount && parseFloat(order.cod_collected_amount) === order.total_amount && "text-green-600"
                                  )}>
                                    COD - {order.cod_payment_method.replace(/_/g, ' ')}
                                  </span>
                                  {order.cod_collected_amount && (
                                    <span className={cn(
                                      "text-xs font-medium",
                                      parseFloat(order.cod_collected_amount) === order.total_amount ? "text-green-600" : "text-muted-foreground"
                                    )}>
                                      Collected: ₹{order.cod_collected_amount}
                                    </span>
                                  )}
                                </>
                              ) : order.payment_method ? (
                                <span className="text-sm capitalize">{order.payment_method.replace(/_/g, ' ')}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not specified</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ₹{order.total_amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={getStatusVariant(order.order_status)}>
                                {order.order_status}
                              </Badge>
                              {order.order_status.toLowerCase() === "failed" && (
                                <div className="text-xs space-y-0.5">
                                  {order.failed_at && (
                                    <div className="text-muted-foreground">
                                      Failed: {format(new Date(order.failed_at), 'PP')}
                                    </div>
                                  )}
                                  {order.failure_reason && (
                                    <div className="text-destructive max-w-[150px] truncate" title={order.failure_reason}>
                                      {order.failure_reason}
                                    </div>
                                  )}
                                  {order.failed_attempts && order.failed_attempts > 1 && (
                                    <Badge variant="outline" className="text-xs w-fit">
                                      {order.failed_attempts} attempts
                                    </Badge>
                                  )}
                                  {order.next_delivery_at && (
                                    <div className="text-muted-foreground">
                                      Next: {format(new Date(order.next_delivery_at), 'PP')}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={order.payment_status === "pending" ? "outline" : getStatusVariant(order.payment_status)}
                              className={order.payment_status === "pending" ? "text-amber-600 border-amber-300 bg-amber-50" : ""}
                            >
                              {order.payment_status}
                            </Badge>
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
                                <DropdownMenuItem
                                  onClick={() => handleDownloadThermalReceipt(order.id)}
                                >
                                  <Printer className="mr-2 h-4 w-4" />
                                  Thermal Print (80mm)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/dashboard/orders/new?reorder=${order.id}`)}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Reorder
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {/* Delivery Driver Assignment */}
                                {(() => {
                                  const { recommended, others } = getAvailableDriversForOrder(order)
                                  const allDrivers = [...recommended, ...others]

                                  if (order.delivery_partner_id) {
                                    return (
                                      <DropdownMenuItem
                                        onClick={() => handleUnassignDriver(order.id, order.order_number)}
                                        disabled={assigningDriver === order.id || order.order_status === "cancelled"}
                                      >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Unassign Driver
                                      </DropdownMenuItem>
                                    )
                                  } else if (allDrivers.length > 0) {
                                    return (
                                      <>
                                        {/* Recommended Drivers */}
                                        {recommended.length > 0 && (
                                          <>
                                            <DropdownMenuLabel className="text-xs text-green-600 font-semibold">
                                              Recommended (Pincode Match)
                                            </DropdownMenuLabel>
                                            {recommended.map((driver) => (
                                              <DropdownMenuItem
                                                key={driver.id}
                                                onClick={() => handleAssignDriver(order.id, driver.id, order.order_number)}
                                                disabled={assigningDriver === order.id || order.order_status === "cancelled"}
                                                className="cursor-pointer"
                                              >
                                                <UserCheck className="mr-2 h-4 w-4 text-green-600" />
                                                <div className="flex flex-col flex-1">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-medium">{driver.name}</span>
                                                    {driver.average_rating && (
                                                      <div className="flex items-center gap-0.5">
                                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                                        <span className="text-xs">{driver.average_rating.toFixed(1)}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                  <span className="text-xs text-muted-foreground">
                                                    {driver.active_orders_count || 0} active • {driver.total_deliveries || 0} total
                                                  </span>
                                                  {driver.vehicle_type && (
                                                    <span className="text-xs text-muted-foreground capitalize">
                                                      {driver.vehicle_type} {driver.vehicle_number ? `• ${driver.vehicle_number}` : ''}
                                                    </span>
                                                  )}
                                                </div>
                                              </DropdownMenuItem>
                                            ))}
                                            {others.length > 0 && <DropdownMenuSeparator />}
                                          </>
                                        )}

                                        {/* Other Drivers */}
                                        {others.length > 0 && (
                                          <>
                                            <DropdownMenuLabel className="text-xs">
                                              {recommended.length > 0 ? 'Other Drivers' : 'Assign Driver'}
                                            </DropdownMenuLabel>
                                            {others.map((driver) => (
                                              <DropdownMenuItem
                                                key={driver.id}
                                                onClick={() => handleAssignDriver(order.id, driver.id, order.order_number)}
                                                disabled={assigningDriver === order.id || order.order_status === "cancelled"}
                                                className="cursor-pointer"
                                              >
                                                <UserCheck className="mr-2 h-4 w-4" />
                                                <div className="flex flex-col flex-1">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-sm">{driver.name}</span>
                                                    {driver.average_rating && (
                                                      <div className="flex items-center gap-0.5">
                                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                                        <span className="text-xs">{driver.average_rating.toFixed(1)}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                  <span className="text-xs text-muted-foreground">
                                                    {driver.active_orders_count || 0} active • {driver.total_deliveries || 0} total
                                                  </span>
                                                  {driver.vehicle_type && (
                                                    <span className="text-xs text-muted-foreground capitalize">
                                                      {driver.vehicle_type} {driver.vehicle_number ? `• ${driver.vehicle_number}` : ''}
                                                    </span>
                                                  )}
                                                </div>
                                              </DropdownMenuItem>
                                            ))}
                                          </>
                                        )}
                                      </>
                                    )
                                  } else {
                                    return (
                                      <DropdownMenuItem disabled>
                                        <UserCheck className="mr-2 h-4 w-4" />
                                        No drivers available
                                      </DropdownMenuItem>
                                    )
                                  }
                                })()}

                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsDelivered(order.id, order.order_number)}
                                  disabled={order.order_status === "delivered" || order.order_status === "cancelled"}
                                >
                                  <Truck className="mr-2 h-4 w-4" />
                                  Mark as Delivered
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleCompleteOrder(order.id, order.order_number)}
                                  disabled={order.order_status === "completed" || order.order_status === "cancelled"}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Complete Order
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCancelOrder(order.id, order.order_number)}
                                  disabled={order.order_status === "cancelled" || order.order_status === "completed"}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Order
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDeletingOrder({ id: order.id, orderNumber: order.order_number })
                                    setDeleteDialogOpen(true)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Row Content */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={14} className="bg-muted/30 p-0">
                              <div className="p-4 space-y-4">
                                <div>
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
                                          <TableHead className="text-right">Subtotal</TableHead>
                                          <TableHead className="text-center">Disc %</TableHead>
                                          <TableHead className="text-right">Disc Amt</TableHead>
                                          <TableHead className="text-right">Net Amt</TableHead>
                                          <TableHead className="text-center">GST %</TableHead>
                                          <TableHead className="text-right">GST Amt</TableHead>
                                          <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {items.map((item) => {
                                          const itemSubtotal = item.quantity * item.unit_price
                                          const netAmount = itemSubtotal - item.discount_amount

                                          return (
                                            <TableRow key={item.id || `${order.id}-${item.product_name}-${item.quantity}`}>
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
                                  )}

                                  {/* Order Summary - Single Row */}
                                  {items.length > 0 && (
                                    <div className="mt-4 flex items-center border-t pt-3">
                                      {(() => {
                                        const calculatedSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
                                        const totalItemDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0)
                                        const totalDiscount = totalItemDiscount + (order.discount_amount ?? 0)
                                        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

                                        return (
                                          <div className="flex items-center gap-6">
                                            <div className="text-sm">
                                              <span className="text-muted-foreground">Products: </span>
                                              <span className="font-medium">{items.length}</span>
                                            </div>
                                            <div className="text-sm">
                                              <span className="text-muted-foreground">Qty: </span>
                                              <span className="font-medium">{totalQuantity}</span>
                                            </div>
                                            <div className="text-sm">
                                              <span className="text-muted-foreground">Subtotal: </span>
                                              <span className="font-medium">₹{(order.subtotal ?? calculatedSubtotal).toFixed(2)}</span>
                                            </div>
                                            {totalDiscount > 0 && (
                                              <div className="text-sm">
                                                <span className="text-muted-foreground">Discount: </span>
                                                <span className="font-medium text-destructive">-₹{totalDiscount.toFixed(2)}</span>
                                              </div>
                                            )}
                                            <div className="text-base font-bold">
                                              <span>Total: </span>
                                              <span>₹{order.total_amount.toFixed(2)}</span>
                                            </div>
                                            {order.source && (
                                              <div className="text-sm">
                                                <span className="text-muted-foreground">Source: </span>
                                                <span className="font-medium capitalize">{order.source.replace(/_/g, ' ')}</span>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  )}
                                </div>

                                {/* Delivery Proof Section */}
                                {(order.delivery_proof_url || order.cod_payment_method || order.delivery_notes) && (
                                  <div className="rounded-md border bg-background p-4">
                                    <h4 className="font-semibold mb-3">Delivery Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {order.cod_payment_method && (
                                        <div>
                                          <span className="text-sm font-medium text-muted-foreground">COD Payment Method:</span>
                                          <p className="text-sm mt-1 capitalize">{order.cod_payment_method.replace(/_/g, ' ')}</p>
                                        </div>
                                      )}
                                      {order.cod_collected_amount && (
                                        <div>
                                          <span className="text-sm font-medium text-muted-foreground">COD Collected Amount:</span>
                                          <p className="text-sm mt-1 font-medium">₹{order.cod_collected_amount}</p>
                                        </div>
                                      )}
                                      {order.delivery_notes && (
                                        <div className="md:col-span-2">
                                          <span className="text-sm font-medium text-muted-foreground">Delivery Notes:</span>
                                          <p className="text-sm mt-1">{order.delivery_notes}</p>
                                        </div>
                                      )}
                                      {order.delivery_proof_url && (
                                        <div className="md:col-span-2">
                                          <span className="text-sm font-medium text-muted-foreground">Delivery Proof:</span>
                                          <div className="mt-2">
                                            <a
                                              href={order.delivery_proof_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                                            >
                                              <ExternalLink className="h-4 w-4" />
                                              View Delivery Proof
                                            </a>
                                          </div>
                                        </div>
                                      )}
                                    </div>
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
          {/* Pagination Controls */}
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {filteredOrders.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
                {filteredOrders.length !== orders.length && (
                  <span className="ml-1">({orders.length} total)</span>
                )}
              </div>
              {selectedOrders.size > 0 && (
                <div className="text-sm font-medium text-primary">
                  {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} selected
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {(() => {
                    const pages: (number | string)[] = []
                    const maxVisiblePages = 5

                    if (totalPages <= maxVisiblePages) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i)
                      }
                    } else {
                      if (currentPage <= 3) {
                        for (let i = 1; i <= 4; i++) {
                          pages.push(i)
                        }
                        pages.push('...')
                        pages.push(totalPages)
                      } else if (currentPage >= totalPages - 2) {
                        pages.push(1)
                        pages.push('...')
                        for (let i = totalPages - 3; i <= totalPages; i++) {
                          pages.push(i)
                        }
                      } else {
                        pages.push(1)
                        pages.push('...')
                        pages.push(currentPage - 1)
                        pages.push(currentPage)
                        pages.push(currentPage + 1)
                        pages.push('...')
                        pages.push(totalPages)
                      }
                    }

                    return pages.map((page, index) => {
                      if (page === '...') {
                        return (
                          <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                            ...
                          </span>
                        )
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(page as number)}
                        >
                          {page}
                        </Button>
                      )
                    })
                  })()}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete order <strong>{deletingOrder?.orderNumber}</strong> and all its items.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingOrder(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrder} className="bg-destructive hover:bg-destructive/90">
              Delete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Mark as Delivered Confirmation Dialog */}
      <AlertDialog open={bulkDeliveryDialogOpen} onOpenChange={setBulkDeliveryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark orders as delivered?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''}</strong> as delivered.
              {selectedOrders.size > 0 && (
                <div className="mt-2">
                  Orders that are already delivered or cancelled will be skipped.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkMarkAsDelivered}>
              Mark as Delivered
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Complete Confirmation Dialog */}
      <AlertDialog open={bulkCompleteDialogOpen} onOpenChange={setBulkCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete orders?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  This will mark <strong>{selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''}</strong> as delivered and payment completed.
                </p>
                <p className="mt-1 text-sm">
                  Orders that are already completed or cancelled will be skipped.
                </p>
                <div className="mt-4">
                  <label className="text-sm font-medium text-foreground">Payment Method</label>
                  <Select value={bulkCompletePaymentMethod} onValueChange={setBulkCompletePaymentMethod}>
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="net_banking">Net Banking</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="cod">COD</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkComplete} className="bg-green-600 hover:bg-green-700">
              Complete Orders
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
