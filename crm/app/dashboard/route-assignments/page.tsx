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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { UserPlus, ExternalLink, FileDown, ChevronDown, UserMinus, Route, Truck, Package, ListChecks, Search, Filter, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { generateDeliveryRoutePDF } from "@/lib/pdf-generator"
import { cn } from "@/lib/utils"

type RouteAssignment = {
  id: string
  route_id: string
  order_id: string
  delivery_partner_id: string | null
  route_name?: string
  order_number?: string
  partner_name?: string
  status: string
  sequence_number: number | null
  scheduled_delivery_date: string | null
  assignment_date: string | null
  delivery_time: string | null
  customer_rating: number | null
  created_at: string
  order_amount?: number
  order_created_at?: string
  customer_name?: string
  customer_vip_number?: string
  customer_phone?: string
  customer_full_address?: string
  shipping_full_address?: string
  shipping_building_name?: string
  shipping_street_area?: string
  shipping_landmark?: string
  shipping_city?: string
  shipping_state?: string
  shipping_pincode?: string
  invoice_number_gst?: string
  invoice_number_non_gst?: string
  is_gst_invoice?: boolean
}

type DeliveryPartner = {
  id: string
  name: string
  is_active: boolean
  serviceable_pincodes: string[] | null
}

type Godown = {
  id: string
  name: string
  godown_code: string
  pincode: string
  city: string
  state: string
  is_active: boolean
}

type Order = {
  id: string
  order_number: string
  customer_id: string
  order_status: string | null
  total_amount: number
  created_at: string
  shipping_full_address?: string
  shipping_building_name?: string
  shipping_street_area?: string
  shipping_landmark?: string
  shipping_city?: string
  shipping_state?: string
  shipping_pincode?: string
  customer_name?: string
  customer_vip_number?: string
  customer_phone?: string
  customer_full_address?: string
  invoice_number_gst?: string
  invoice_number_non_gst?: string
  is_gst_invoice?: boolean
}

type Route = {
  id: string
  route_name: string
  pincodes: string[]
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

export default function RouteAssignmentsPage() {
  const [assignments, setAssignments] = useState<RouteAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([])
  const [filterRouteId, setFilterRouteId] = useState("")
  const [filterPartnerId, setFilterPartnerId] = useState("")
  const [pdfRouteId, setPdfRouteId] = useState("")
  const [pdfPartnerId, setPdfPartnerId] = useState("")
  const [saving, setSaving] = useState(false)
  const [godowns, setGodowns] = useState<Godown[]>([])
  const [selectedGodownId, setSelectedGodownId] = useState("")
  const [optimizing, setOptimizing] = useState(false)
  const [showOptimizationPreview, setShowOptimizationPreview] = useState(false)
  const [optimizedRoutePreview, setOptimizedRoutePreview] = useState<any[]>([])
  const [showUnassignDialog, setShowUnassignDialog] = useState(false)
  const [assignmentToUnassign, setAssignmentToUnassign] = useState<RouteAssignment | null>(null)
  const [unassigning, setUnassigning] = useState(false)
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([])

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})

  useEffect(() => {
    fetchAssignments()
    fetchDeliveryPartners()
    fetchRoutes()
    fetchUnassignedOrders()
    fetchGodowns()
  }, [])

  // Helper to batch .in() queries to avoid PostgREST URL length limits
  const batchIn = async <T,>(
    table: string,
    selectFields: string,
    column: string,
    ids: string[],
    batchSize = 50
  ): Promise<T[]> => {
    if (ids.length === 0) return []
    const results: T[] = []
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from(table)
        .select(selectFields)
        .in(column, batch)
      if (error) {
        console.error(`Error fetching ${table} batch:`, error)
      } else if (data) {
        results.push(...(data as T[]))
      }
    }
    return results
  }

  const fetchAssignments = async () => {
    setLoading(true)

    // Only fetch non-delivered assignments since delivered ones are filtered out in the UI
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("route_assignments")
      .select("*")
      .neq("status", "delivered")
      .order("created_at", { ascending: false })

    if (assignmentsError) {
      console.error("Error fetching route assignments:", assignmentsError)
      toast.error("Failed to fetch route assignments")
      setLoading(false)
      return
    }

    // Fetch related data
    const routeIds = [...new Set(assignmentsData?.map((a) => a.route_id))]
    const orderIds = [...new Set(assignmentsData?.map((a) => a.order_id))]
    const partnerIds = [...new Set(assignmentsData?.map((a) => a.delivery_partner_id).filter(Boolean))]

    const [routesData, ordersData, partnersData] = await Promise.all([
      batchIn<{ id: string; route_name: string }>("routes", "id, route_name", "id", routeIds),
      batchIn<{ id: string; order_number: string; customer_id: string; total_amount: number; created_at: string; shipping_full_address: string; shipping_building_name: string; shipping_street_area: string; shipping_landmark: string; shipping_city: string; shipping_state: string; shipping_pincode: string; invoice_number_gst: string; invoice_number_non_gst: string; is_gst_invoice: boolean }>(
        "orders",
        "id, order_number, customer_id, total_amount, created_at, shipping_full_address, shipping_building_name, shipping_street_area, shipping_landmark, shipping_city, shipping_state, shipping_pincode, invoice_number_gst, invoice_number_non_gst, is_gst_invoice",
        "id",
        orderIds
      ),
      batchIn<{ id: string; name: string }>("delivery_partners", "id, name", "id", partnerIds),
    ])

    // Fetch customer details
    const customerIds = [...new Set(ordersData?.map((o) => o.customer_id).filter(Boolean))]
    const customersData = await batchIn<{ id: string; first_name: string; last_name: string; vip_number: string; mobile_primary: string; mobile_secondary_1: string; mobile_secondary_2: string; full_address: string }>(
      "customers",
      "id, first_name, last_name, vip_number, mobile_primary, mobile_secondary_1, mobile_secondary_2, full_address",
      "id",
      customerIds
    )

    // Create lookup maps
    const routeMap = new Map(routesData?.map((r) => [r.id, r.route_name]))
    const orderMap = new Map(ordersData?.map((o) => [o.id, o]))
    const partnerMap = new Map(partnersData?.map((p) => [p.id, p.name]))
    const customerMap = new Map(customersData?.map((c) => [c.id, c]))

    // Add related data to assignments
    const enrichedAssignments = assignmentsData?.map((assignment) => {
      const order = orderMap.get(assignment.order_id)
      const customer = order ? customerMap.get(order.customer_id) : undefined

      return {
        ...assignment,
        route_name: routeMap.get(assignment.route_id),
        order_number: order?.order_number,
        order_amount: order?.total_amount,
        order_created_at: order?.created_at,
        partner_name: assignment.delivery_partner_id
          ? partnerMap.get(assignment.delivery_partner_id)
          : undefined,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : undefined,
        customer_vip_number: customer?.vip_number,
        customer_phone: customer?.mobile_primary,
        customer_full_address: customer?.full_address,
        shipping_full_address: order?.shipping_full_address,
        shipping_building_name: order?.shipping_building_name,
        shipping_street_area: order?.shipping_street_area,
        shipping_landmark: order?.shipping_landmark,
        shipping_city: order?.shipping_city,
        shipping_state: order?.shipping_state,
        shipping_pincode: order?.shipping_pincode,
        invoice_number_gst: order?.invoice_number_gst,
        invoice_number_non_gst: order?.invoice_number_non_gst,
        is_gst_invoice: order?.is_gst_invoice,
      }
    })

    setAssignments(enrichedAssignments || [])
    setLoading(false)
  }

  const fetchDeliveryPartners = async () => {
    const { data, error } = await supabase
      .from("delivery_partners")
      .select("id, name, is_active, serviceable_pincodes")
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("Error fetching delivery partners:", error)
      toast.error("Failed to fetch delivery partners")
    } else {
      setDeliveryPartners(data || [])
    }
  }

  const fetchRoutes = async () => {
    const { data, error } = await supabase
      .from("routes")
      .select("id, route_name, pincodes")
      .eq("is_active", true)
      .order("route_name")

    if (error) {
      console.error("Error fetching routes:", error)
      toast.error("Failed to fetch routes")
    } else {
      setRoutes(data || [])
    }
  }

  const fetchGodowns = async () => {
    const { data, error } = await supabase
      .from("godowns")
      .select("id, name, godown_code, pincode, city, state, is_active")
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("Error fetching godowns:", error)
      toast.error("Failed to fetch warehouses")
    } else {
      setGodowns(data || [])
    }
  }

  const fetchUnassignedOrders = async () => {
    // Fetch all orders that are not yet delivered, cancelled, or completed
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_number, customer_id, order_status, total_amount, created_at, shipping_full_address, shipping_building_name, shipping_street_area, shipping_landmark, shipping_city, shipping_state, shipping_pincode, invoice_number_gst, invoice_number_non_gst, is_gst_invoice, delivery_partner_id")
      .in("order_status", ["pending", "confirmed", "processing"])
      .order("created_at", { ascending: false })

    if (ordersError) {
      console.error("Error fetching orders:", ordersError)
      return
    }

    // Fetch existing route assignments
    const { data: assignmentsData } = await supabase
      .from("route_assignments")
      .select("order_id")

    const assignedOrderIds = new Set(assignmentsData?.map((a) => a.order_id) || [])

    // Filter out already assigned orders (either via route assignments OR direct assignment)
    const unassigned = ordersData?.filter((order) =>
      !assignedOrderIds.has(order.id) && !order.delivery_partner_id
    ) || []

    // Fetch customer details
    const customerIds = [...new Set(unassigned.map((o) => o.customer_id).filter(Boolean))]

    if (customerIds.length === 0) {
      console.log("No customer IDs found in unassigned orders")
      setUnassignedOrders(unassigned)
      return
    }

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("id, first_name, last_name, vip_number, mobile_primary, mobile_secondary_1, mobile_secondary_2, full_address")
      .in("id", customerIds)

    if (customersError) {
      console.error("Error fetching customers:", customersError)
    }

    console.log("Customers fetched:", customersData?.length, "for", customerIds.length, "customer IDs")

    const customerMap = new Map(customersData?.map((c) => [c.id, c]))

    // Add customer details to orders
    const enrichedOrders = unassigned.map((order) => {
      const customer = customerMap.get(order.customer_id)
      if (!customer && order.customer_id) {
        console.log("Customer not found for order:", order.order_number, "customer_id:", order.customer_id)
      }
      return {
        ...order,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : undefined,
        customer_vip_number: customer?.vip_number,
        customer_phone: customer?.mobile_primary,
        customer_full_address: customer?.full_address,
      }
    })

    console.log("Enriched orders sample:", enrichedOrders.slice(0, 2).map(o => ({
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      customer_id: o.customer_id
    })))

    setUnassignedOrders(enrichedOrders)
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

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId])
    } else {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrdersByRouteAndPartner.map((order) => order.id))
    } else {
      setSelectedOrders([])
    }
  }

  const handleSelectAssignment = (assignmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedAssignments([...selectedAssignments, assignmentId])
    } else {
      setSelectedAssignments(selectedAssignments.filter((id) => id !== assignmentId))
    }
  }

  const handleSelectAllAssignments = (checked: boolean) => {
    if (checked) {
      setSelectedAssignments(filteredAssignments.map((assignment) => assignment.id))
    } else {
      setSelectedAssignments([])
    }
  }

  const handleResetFilters = () => {
    setFilterRouteId("")
    setFilterPartnerId("")
    setSelectedGodownId("")
    setSelectedOrders([])
  }

  const handleBulkAssign = async () => {
    if (selectedOrders.length === 0) {
      toast.error("Please select at least one order")
      return
    }

    if (!filterPartnerId || !filterRouteId) {
      toast.error("Please select route and delivery partner")
      return
    }

    if (!selectedGodownId) {
      toast.error("Please select a warehouse")
      return
    }

    setOptimizing(true)

    try {
      // Get selected godown details
      const selectedGodown = godowns.find((g) => g.id === selectedGodownId)
      if (!selectedGodown) {
        toast.error("Selected warehouse not found")
        return
      }

      // Get order details for selected orders
      const ordersToAssign = unassignedOrders.filter((order) =>
        selectedOrders.includes(order.id)
      )

      // Build addresses for optimization
      const warehouseAddress = {
        address: `${selectedGodown.name}, ${selectedGodown.city}, ${selectedGodown.state}`,
        pincode: selectedGodown.pincode,
        city: selectedGodown.city,
        state: selectedGodown.state,
      }

      const deliveryAddresses = ordersToAssign.map((order) => ({
        orderId: order.id,
        address: {
          address: order.shipping_full_address || order.customer_full_address || `${order.shipping_building_name}, ${order.shipping_street_area}`,
          pincode: order.shipping_pincode,
          city: order.shipping_city,
          state: order.shipping_state,
        },
      }))

      console.log("Calling route optimization API...")

      // Call route optimization API
      const response = await fetch("/api/route-optimization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          warehouseAddress,
          deliveryAddresses,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to optimize route")
      }

      const { optimizedRoute } = await response.json()

      console.log("Optimized route received:", optimizedRoute)

      // Show preview dialog
      setOptimizedRoutePreview(optimizedRoute)
      setShowOptimizationPreview(true)
    } catch (error: unknown) {
      console.error("Error optimizing route:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to optimize route"
      toast.error(errorMessage)
    } finally {
      setOptimizing(false)
    }
  }

  const openGoogleMapsRoute = () => {
    if (!selectedGodownId || optimizedRoutePreview.length === 0) return

    const selectedGodown = godowns.find((g) => g.id === selectedGodownId)
    if (!selectedGodown) return

    // Build Google Maps URL with directions
    // Format: https://www.google.com/maps/dir/origin/waypoint1/waypoint2/.../destination

    const warehouseAddress = `${selectedGodown.name}, ${selectedGodown.city}, ${selectedGodown.state} ${selectedGodown.pincode}`

    // Build waypoints from optimized route
    const waypoints = optimizedRoutePreview.map((stop) => {
      const order = unassignedOrders.find((o) => o.id === stop.orderId)
      if (!order) return ""

      // Use the full address from the stop
      return stop.address.address || ""
    }).filter(Boolean)

    // Create URL: Start from warehouse, visit all waypoints, return to warehouse
    const addresses = [
      warehouseAddress,
      ...waypoints,
      warehouseAddress // Return to warehouse
    ]

    // URL encode each address and join with /
    const encodedPath = addresses.map(addr => encodeURIComponent(addr)).join("/")
    const mapsUrl = `https://www.google.com/maps/dir/${encodedPath}`

    // Open in new tab
    window.open(mapsUrl, "_blank")
  }

  const handleUnassignClick = (assignment: RouteAssignment) => {
    setAssignmentToUnassign(assignment)
    setShowUnassignDialog(true)
  }

  const handleBulkUnassignClick = () => {
    if (selectedAssignments.length === 0) {
      toast.error("Please select at least one assignment to unassign")
      return
    }
    setAssignmentToUnassign(null) // null indicates bulk operation
    setShowUnassignDialog(true)
  }

  const confirmUnassignment = async () => {
    setUnassigning(true)

    try {
      // Check if this is a bulk operation or single operation
      const isBulkOperation = !assignmentToUnassign && selectedAssignments.length > 0

      if (isBulkOperation) {
        // Bulk unassignment
        const assignmentsToDelete = assignments.filter((a) => selectedAssignments.includes(a.id))
        const orderIds = assignmentsToDelete.map((a) => a.order_id)

        // Delete route assignments
        const { error: deleteError } = await supabase
          .from("route_assignments")
          .delete()
          .in("id", selectedAssignments)

        if (deleteError) throw deleteError

        // Clear delivery_partner_id from orders
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            delivery_partner_id: null,
            assigned_to_delivery_at: null
          })
          .in("id", orderIds)

        if (updateError) {
          console.error("Error clearing delivery partner from orders:", updateError)
        }

        toast.success(`${selectedAssignments.length} order(s) unassigned successfully`)
        setSelectedAssignments([])
      } else if (assignmentToUnassign) {
        // Single unassignment
        const { error: deleteError } = await supabase
          .from("route_assignments")
          .delete()
          .eq("id", assignmentToUnassign.id)

        if (deleteError) throw deleteError

        // Clear delivery_partner_id from the order
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            delivery_partner_id: null,
            assigned_to_delivery_at: null
          })
          .eq("id", assignmentToUnassign.order_id)

        if (updateError) {
          console.error("Error clearing delivery partner from order:", updateError)
        }

        toast.success("Order unassigned successfully")
      }

      setShowUnassignDialog(false)
      setAssignmentToUnassign(null)
      fetchAssignments()
      fetchUnassignedOrders()
    } catch (error: unknown) {
      console.error("Error unassigning order(s):", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to unassign order(s)"
      toast.error(errorMessage)
    } finally {
      setUnassigning(false)
    }
  }

  const confirmOptimizedAssignment = async () => {
    setSaving(true)

    try {
      // Get the max sequence number for this route
      const { data: existingAssignments } = await supabase
        .from("route_assignments")
        .select("sequence_number")
        .eq("route_id", filterRouteId)
        .order("sequence_number", { ascending: false })
        .limit(1)

      const startSequence = existingAssignments && existingAssignments.length > 0
        ? (existingAssignments[0].sequence_number || 0) + 1
        : 1

      // Create route assignments using the optimized sequence
      const assignments = optimizedRoutePreview.map((stop) => ({
        route_id: filterRouteId,
        order_id: stop.orderId,
        delivery_partner_id: filterPartnerId,
        status: "assigned",
        sequence_number: startSequence + stop.sequenceNumber - 1,
        scheduled_delivery_date: null,
        assignment_date: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from("route_assignments")
        .insert(assignments)

      if (error) throw error

      // Also update the orders table to set delivery_partner_id and order_status
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          delivery_partner_id: filterPartnerId,
          assigned_to_delivery_at: new Date().toISOString(),
          order_status: "processing"
        })
        .in("id", optimizedRoutePreview.map((stop) => stop.orderId))

      if (updateError) {
        console.error("Error updating orders with delivery partner:", updateError)
        // Don't throw error here as the route assignment was successful
      }

      toast.success(`Successfully assigned ${optimizedRoutePreview.length} order(s) with optimized route`)

      // Generate PDF after successful assignment
      await handleGeneratePDF(filterRouteId, filterPartnerId)

      setSelectedOrders([])
      setFilterRouteId("")
      setFilterPartnerId("")
      setSelectedGodownId("")
      setShowOptimizationPreview(false)
      setOptimizedRoutePreview([])
      fetchAssignments()
      fetchUnassignedOrders()
    } catch (error: unknown) {
      console.error("Error assigning orders:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to assign orders"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleGeneratePDF = async (routeId: string, partnerId: string) => {
    try {
      // Fetch route assignments for this route and partner (exclude delivered assignments)
      const { data: routeAssignments, error: assignmentsError } = await supabase
        .from("route_assignments")
        .select("*")
        .eq("route_id", routeId)
        .eq("delivery_partner_id", partnerId)
        .neq("status", "delivered")
        .order("sequence_number", { ascending: true })

      if (assignmentsError) throw assignmentsError

      if (!routeAssignments || routeAssignments.length === 0) {
        toast.error("No pending assignments found for this route and partner")
        return
      }

      // Fetch related data
      const orderIds = routeAssignments.map((a) => a.order_id)

      const [{ data: ordersData }, { data: routeData }, { data: partnerData }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, customer_id, total_amount, order_status, shipping_full_address, shipping_building_name, shipping_street_area, shipping_landmark, shipping_city, shipping_state, shipping_pincode, invoice_number_gst, invoice_number_non_gst, is_gst_invoice")
          .in("id", orderIds)
          .not("order_status", "in", "(delivered,cancelled,completed)"),
        supabase.from("routes").select("route_name").eq("id", routeId).single(),
        supabase.from("delivery_partners").select("name, mobile").eq("id", partnerId).single(),
      ])

      // Fetch customer details
      const customerIds = [...new Set(ordersData?.map((o) => o.customer_id) || [])]
      const { data: customersData } = await supabase
        .from("customers")
        .select("id, first_name, last_name, vip_number, mobile_primary, mobile_secondary_1, mobile_secondary_2, full_address")
        .in("id", customerIds)

      // Fetch all order items for these orders
      const { data: allOrderItems } = await supabase
        .from("order_items")
        .select("order_id, product_name, quantity")
        .in("order_id", orderIds)

      // Create lookup maps
      const orderMap = new Map(ordersData?.map((o) => [o.id, o]))
      const customerMap = new Map(customersData?.map((c) => [c.id, c]))

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

      // Prepare PDF data - only include orders that exist in ordersData (excludes delivered/cancelled/completed)
      const pdfOrders = routeAssignments
        .filter((assignment) => orderMap.has(assignment.order_id))
        .map((assignment) => {
          const order = orderMap.get(assignment.order_id)
          const customer = order ? customerMap.get(order.customer_id) : undefined
          const items = orderItemsMap.get(assignment.order_id) || []

          return {
            sequenceNumber: assignment.sequence_number || 0,
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
            items: items,
          }
        })

      // Check if there are any orders to include in PDF after filtering
      if (pdfOrders.length === 0) {
        toast.error("No pending orders found for this route and partner (all orders are delivered/cancelled/completed)")
        return
      }

      // Get only the order IDs that are included in the PDF
      const filteredOrderIds = ordersData?.map((o) => o.id) || []

      // Calculate totals
      const totalAmount = pdfOrders.reduce((sum, order) => sum + order.amount, 0)
      const totalItems = pdfOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
      }, 0)

      // Generate PDF
      generateDeliveryRoutePDF({
        routeName: routeData?.route_name || "Unknown",
        partnerName: partnerData?.name || "Unknown",
        partnerPhone: partnerData?.mobile || "N/A",
        assignmentDate: new Date().toLocaleDateString("en-IN"),
        orders: pdfOrders,
      })

      // Save delivery sheet record to database (only with non-delivered order IDs)
      const { error: insertError } = await supabase
        .from("delivery_sheets")
        .insert({
          route_id: routeId,
          delivery_partner_id: partnerId,
          route_name: routeData?.route_name || "Unknown",
          partner_name: partnerData?.name || "Unknown",
          partner_phone: partnerData?.mobile,
          assignment_date: new Date().toISOString().split('T')[0],
          total_orders: pdfOrders.length,
          total_items: totalItems,
          total_amount: totalAmount,
          order_ids: filteredOrderIds,
        })

      if (insertError) {
        console.error("Error saving delivery sheet record:", insertError)
        // Don't throw error, just log it - PDF was still generated successfully
      }

      toast.success("PDF generated successfully")
    } catch (error: unknown) {
      console.error("Error generating PDF:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to generate PDF"
      toast.error(errorMessage)
    }
  }

  // Filter by selected route's pincodes when a route is selected
  const selectedRoute = routes.find((r) => r.id === filterRouteId)
  const filteredByRoute = filterRouteId && selectedRoute
    ? unassignedOrders.filter((order) => {
        // Check if order's shipping pincode matches any of the route's pincodes
        const orderPincode = order.shipping_pincode
        if (!orderPincode) return false
        return selectedRoute.pincodes?.includes(orderPincode)
      })
    : unassignedOrders

  // Then apply search filter
  const searchLower = searchTerm.toLowerCase()
  const filteredOrdersByRouteAndPartner = filteredByRoute.filter(
    (order) =>
      order.order_number.toLowerCase().includes(searchLower) ||
      (order.order_status && order.order_status.toLowerCase().includes(searchLower)) ||
      (order.customer_vip_number && order.customer_vip_number.toLowerCase().includes(searchLower)) ||
      (order.invoice_number_gst && order.invoice_number_gst.toLowerCase().includes(searchLower)) ||
      (order.invoice_number_non_gst && order.invoice_number_non_gst.toLowerCase().includes(searchLower))
  )

  const filteredAssignments = assignments.filter(
    (assignment) =>
      // Exclude delivered orders
      assignment.status.toLowerCase() !== "delivered" &&
      ((assignment.route_name && assignment.route_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (assignment.order_number && assignment.order_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (assignment.partner_name && assignment.partner_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      assignment.status.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "delivered" || lowerStatus === "completed") return "default"
    if (lowerStatus === "in_transit" || lowerStatus === "picked_up") return "outline"
    if (lowerStatus === "pending" || lowerStatus === "assigned") return "secondary"
    if (lowerStatus === "failed" || lowerStatus === "cancelled") return "destructive"
    return "secondary"
  }

  const getInvoiceNumber = (order: Order | RouteAssignment) => {
    if (order.is_gst_invoice) {
      return order.invoice_number_gst || "-"
    } else {
      return order.invoice_number_non_gst || "-"
    }
  }

  const isAddressInvalid = (order: Order | RouteAssignment) => {
    // Check if address is N/A or invalid
    const isNA = (val: string | undefined) => !val || val === 'N/A' || val.trim() === ''
    const isInvalidPincode = (val: string | undefined) => !val || val === '000000' || val === 'N/A'

    return (isNA(order.shipping_building_name) && isNA(order.shipping_street_area)) ||
           isInvalidPincode(order.shipping_pincode)
  }

  const isValidFullAddress = (address: string | undefined) => {
    if (!address || address.trim() === '') return false
    // Check if it's just a pincode or "000000"
    const trimmed = address.trim()
    if (trimmed === '000000' || trimmed === 'N/A') return false
    // Check if it's only digits (likely just a pincode)
    if (/^\d+$/.test(trimmed)) return false
    return true
  }

  const getDisplayAddress = (order: Order | RouteAssignment) => {
    // First check if structured address is valid
    if (!isAddressInvalid(order)) {
      return {
        type: 'structured',
        building: order.shipping_building_name,
        street: order.shipping_street_area,
        landmark: order.shipping_landmark,
        city: order.shipping_city,
        state: order.shipping_state,
        pincode: order.shipping_pincode
      }
    }

    // Then check order's full shipping address
    if (isValidFullAddress(order.shipping_full_address)) {
      return {
        type: 'full_address',
        text: order.shipping_full_address,
        source: 'order'
      }
    }

    // Finally fall back to customer's full address
    if (isValidFullAddress(order.customer_full_address)) {
      return {
        type: 'full_address',
        text: order.customer_full_address,
        source: 'customer'
      }
    }

    // No valid address found
    return {
      type: 'none'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-72" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-44" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Route className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Route Assignments
            </h1>
            <p className="text-sm text-muted-foreground">
              Select route and delivery partner to assign orders
            </p>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" />
            Assignment Filters
          </CardTitle>
          <CardDescription>
            Select warehouse, route, and delivery partner, then choose orders to assign. Route will be optimized using Google Maps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filter-warehouse">Warehouse *</Label>
              <Select value={selectedGodownId} onValueChange={setSelectedGodownId}>
                <SelectTrigger id="filter-warehouse" className="w-full">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {godowns.map((godown) => (
                    <SelectItem key={godown.id} value={godown.id}>
                      {godown.name} - {godown.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-route">Route *</Label>
              <Select value={filterRouteId} onValueChange={setFilterRouteId}>
                <SelectTrigger id="filter-route" className="w-full">
                  <SelectValue placeholder="Select a route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.route_name} ({route.pincodes?.length || 0} pincodes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-partner">Delivery Partner *</Label>
              <Select value={filterPartnerId} onValueChange={setFilterPartnerId}>
                <SelectTrigger id="filter-partner" className="w-full">
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryPartners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end space-x-2">
              <Button onClick={handleResetFilters} variant="outline" className="flex-1">
                Reset
              </Button>
              {selectedOrders.length > 0 && (
                <Button onClick={handleBulkAssign} disabled={optimizing || saving} className="flex-1">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {optimizing ? "Optimizing..." : `Assign ${selectedOrders.length}`}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unassigned Orders Section */}
      <Card className="min-w-0 max-w-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-muted-foreground" />
            Unassigned Orders
          </CardTitle>
          <CardDescription>
            Select route and delivery partner above, then choose orders to assign (all orders shown regardless of pincode)
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="font-normal">
              {filteredOrdersByRouteAndPartner.length} of {unassignedOrders.length}
            </Badge>
          </CardAction>
          <div className="mt-4 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4 min-w-0 max-w-full">
          <div className="w-0 min-w-full max-w-full rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredOrdersByRouteAndPartner.length > 0 &&
                        selectedOrders.length === filteredOrdersByRouteAndPartner.length
                      }
                      onCheckedChange={handleSelectAll}
                      disabled={!filterPartnerId}
                    />
                  </TableHead>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Shipping Address</TableHead>
                  <TableHead>Order Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrdersByRouteAndPartner.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="py-12">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <Package className="h-5 w-5 opacity-50" />
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          No unassigned orders found
                        </p>
                        <p className="mt-1 text-xs">
                          Adjust filters or wait for new orders
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrdersByRouteAndPartner.map((order) => {
                    const isExpanded = expandedRows.has(order.id)
                    const items = orderItems[order.id] || []

                    return (
                      <React.Fragment key={order.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleRowExpansion(order.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={(checked) =>
                                handleSelectOrder(order.id, checked as boolean)
                              }
                              disabled={!filterPartnerId}
                            />
                          </TableCell>
                          <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-1">
                              <Link
                                href={`/dashboard/orders/${order.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                {order.order_number}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                Invoice: {getInvoiceNumber(order)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>
                                {order.customer_name || "-"}
                                {order.customer_vip_number && (
                                  <span className="ml-1 text-xs text-blue-600 font-medium">
                                    ({order.customer_vip_number})
                                  </span>
                                )}
                              </div>
                              {order.customer_phone && (
                                <div className="text-xs text-muted-foreground">
                                  {order.customer_phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            ₹{(order.total_amount || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {(() => {
                                const address = getDisplayAddress(order)
                                if (address.type === 'full_address') {
                                  return (
                                    <div>
                                      {address.source === 'customer' && (
                                        <div className="text-amber-600 text-xs mb-1">(From Customer Profile)</div>
                                      )}
                                      <div>{address.text}</div>
                                    </div>
                                  )
                                } else if (address.type === 'structured' && (address.building || address.street)) {
                                  return (
                                    <>
                                      <div>
                                        {address.building && address.building !== 'N/A' && <span>{address.building}</span>}
                                        {address.building && address.building !== 'N/A' && address.street && address.street !== 'N/A' && <span>, </span>}
                                        {address.street && address.street !== 'N/A' && <span>{address.street}</span>}
                                      </div>
                                      {address.landmark && address.landmark !== 'N/A' && (
                                        <div className="text-xs text-muted-foreground">Near {address.landmark}</div>
                                      )}
                                      <div className="text-muted-foreground text-xs">
                                        {address.city}, {address.state} - {address.pincode}
                                      </div>
                                    </>
                                  )
                                } else {
                                  return <span className="text-muted-foreground">-</span>
                                }
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.created_at
                              ? new Date(order.created_at).toLocaleDateString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {order.order_status || "pending"}
                            </Badge>
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
          <div className="mt-4 text-sm text-muted-foreground">
            {selectedOrders.length > 0 && (
              <span className="font-medium">
                {selectedOrders.length} order(s) selected •{" "}
              </span>
            )}
            <span>
              Showing {filteredOrdersByRouteAndPartner.length} of {unassignedOrders.length} unassigned orders
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Orders Section */}
      <Card className="min-w-0 max-w-full">
        <CardHeader className="border-b">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Route Assignment List
              </CardTitle>
              <CardDescription>
                All route assignments with delivery partner and status
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedAssignments.length > 0 && (
                <Button
                  onClick={handleBulkUnassignClick}
                  variant="destructive"
                  className="gap-2"
                >
                  <UserMinus className="h-4 w-4" />
                  Unassign {selectedAssignments.length}
                </Button>
              )}
              <Select
                value={pdfRouteId}
                onValueChange={(value) => {
                  setPdfRouteId(value)
                  setPdfPartnerId("")
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select route for PDF" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.route_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={pdfPartnerId}
                onValueChange={setPdfPartnerId}
                disabled={!pdfRouteId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryPartners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => handleGeneratePDF(pdfRouteId, pdfPartnerId)}
                disabled={!pdfRouteId || !pdfPartnerId}
                variant="outline"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Generate PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 min-w-0 max-w-full">
          <div className="w-0 min-w-full max-w-full rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredAssignments.length > 0 &&
                        selectedAssignments.length === filteredAssignments.length
                      }
                      onCheckedChange={handleSelectAllAssignments}
                    />
                  </TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Shipping Address</TableHead>
                  <TableHead>Order Created</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Delivery Partner</TableHead>
                  <TableHead>Sequence</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={14} className="py-12">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <ClipboardList className="h-5 w-5 opacity-50" />
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          No route assignments found
                        </p>
                        <p className="mt-1 text-xs">
                          Assign orders above to see them here
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssignments.map((assignment) => {
                    const isExpanded = expandedRows.has(assignment.order_id)
                    const items = orderItems[assignment.order_id] || []

                    return (
                      <React.Fragment key={assignment.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleRowExpansion(assignment.order_id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedAssignments.includes(assignment.id)}
                              onCheckedChange={(checked) =>
                                handleSelectAssignment(assignment.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                            {assignment.order_number ? (
                              <div className="space-y-1">
                                <Link
                                  href={`/dashboard/orders/${assignment.order_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-600 hover:underline"
                                >
                                  {assignment.order_number}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                                <div className="text-xs text-muted-foreground">
                                  Invoice: {getInvoiceNumber(assignment)}
                                </div>
                              </div>
                            ) : (
                              "Unknown"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>
                                {assignment.customer_name || "-"}
                                {assignment.customer_vip_number && (
                                  <span className="ml-1 text-xs text-blue-600 font-medium">
                                    ({assignment.customer_vip_number})
                                  </span>
                                )}
                              </div>
                              {assignment.customer_phone && (
                                <div className="text-xs text-muted-foreground">
                                  {assignment.customer_phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            ₹{(assignment.order_amount || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {(() => {
                                const address = getDisplayAddress(assignment)
                                if (address.type === 'full_address') {
                                  return (
                                    <div>
                                      {address.source === 'customer' && (
                                        <div className="text-amber-600 text-xs mb-1">(From Customer Profile)</div>
                                      )}
                                      <div>{address.text}</div>
                                    </div>
                                  )
                                } else if (address.type === 'structured' && (address.building || address.street)) {
                                  return (
                                    <>
                                      <div>
                                        {address.building && address.building !== 'N/A' && <span>{address.building}</span>}
                                        {address.building && address.building !== 'N/A' && address.street && address.street !== 'N/A' && <span>, </span>}
                                        {address.street && address.street !== 'N/A' && <span>{address.street}</span>}
                                      </div>
                                      {address.landmark && address.landmark !== 'N/A' && (
                                        <div className="text-xs text-muted-foreground">Near {address.landmark}</div>
                                      )}
                                      <div className="text-muted-foreground text-xs">
                                        {address.city}, {address.state} - {address.pincode}
                                      </div>
                                    </>
                                  )
                                } else {
                                  return <span className="text-muted-foreground">-</span>
                                }
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {assignment.order_created_at
                              ? new Date(assignment.order_created_at).toLocaleDateString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell>{assignment.route_name || "Unknown"}</TableCell>
                          <TableCell>
                            {assignment.partner_name || (
                              <span className="text-muted-foreground">Not assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {assignment.sequence_number !== null ? (
                              <Badge variant="outline">#{assignment.sequence_number}</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {assignment.scheduled_delivery_date
                              ? new Date(assignment.scheduled_delivery_date).toLocaleDateString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(assignment.status)}>
                              {assignment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assignment.customer_rating !== null ? (
                              <span>⭐ {assignment.customer_rating}/5</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnassignClick(assignment)}
                              className="h-8 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <UserMinus className="h-4 w-4" />
                              Unassign
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Row Content */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={14} className="bg-muted/30 p-0">
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
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredAssignments.length} of {assignments.length} assignments
          </div>
        </CardContent>
      </Card>

      {/* Unassign Confirmation Dialog */}
      <Dialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignmentToUnassign ? "Unassign Order" : `Unassign ${selectedAssignments.length} Order(s)`}
            </DialogTitle>
            <DialogDescription>
              {assignmentToUnassign
                ? "Are you sure you want to unassign this order from the delivery partner?"
                : `Are you sure you want to unassign ${selectedAssignments.length} order(s) from their delivery partners?`}
            </DialogDescription>
          </DialogHeader>
          {assignmentToUnassign ? (
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Order Number:</div>
                <div className="font-medium">{assignmentToUnassign.order_number}</div>

                <div className="text-muted-foreground">Route:</div>
                <div>{assignmentToUnassign.route_name}</div>

                <div className="text-muted-foreground">Delivery Partner:</div>
                <div>{assignmentToUnassign.partner_name || "Not assigned"}</div>

                <div className="text-muted-foreground">Customer:</div>
                <div>{assignmentToUnassign.customer_name}</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-md text-sm">
                <p className="text-amber-800 dark:text-amber-200">
                  This order will be moved back to the unassigned orders list and can be reassigned to another route or delivery partner.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-md text-sm">
                <p className="text-amber-800 dark:text-amber-200 mb-2">
                  The following {selectedAssignments.length} order(s) will be moved back to the unassigned orders list and can be reassigned to another route or delivery partner.
                </p>
                <div className="text-amber-900 dark:text-amber-100 font-medium">
                  Selected orders:
                  <ul className="list-disc list-inside mt-1 ml-2">
                    {assignments
                      .filter((a) => selectedAssignments.includes(a.id))
                      .slice(0, 5)
                      .map((a) => (
                        <li key={a.id}>
                          {a.order_number} - {a.customer_name} ({a.route_name})
                        </li>
                      ))}
                    {selectedAssignments.length > 5 && (
                      <li>... and {selectedAssignments.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUnassignDialog(false)}
              disabled={unassigning}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmUnassignment}
              disabled={unassigning}
            >
              {unassigning ? "Unassigning..." : assignmentToUnassign ? "Unassign Order" : `Unassign ${selectedAssignments.length} Order(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Optimization Preview Dialog */}
      <Dialog open={showOptimizationPreview} onOpenChange={setShowOptimizationPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Optimized Route Preview</DialogTitle>
            <DialogDescription>
              Review the optimized delivery sequence before confirming assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Route Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {optimizedRoutePreview.length}
                </div>
                <div className="text-sm text-muted-foreground">Stops</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {(() => {
                    let totalDistance = optimizedRoutePreview.reduce(
                      (sum, stop) => sum + (stop.distanceFromPrevious || 0),
                      0
                    )
                    // Add return trip distance
                    const lastStop = optimizedRoutePreview[optimizedRoutePreview.length - 1]
                    if (lastStop?.returnToWarehouse) {
                      totalDistance += lastStop.returnToWarehouse.distance
                    }
                    return (totalDistance / 1000).toFixed(1)
                  })()}
                  <span className="text-sm ml-1">km</span>
                </div>
                <div className="text-sm text-muted-foreground">Total Distance (round trip)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {(() => {
                    let totalDuration = optimizedRoutePreview.reduce(
                      (sum, stop) => sum + (stop.durationFromPrevious || 0),
                      0
                    )
                    // Add return trip duration
                    const lastStop = optimizedRoutePreview[optimizedRoutePreview.length - 1]
                    if (lastStop?.returnToWarehouse) {
                      totalDuration += lastStop.returnToWarehouse.duration
                    }
                    return Math.round(totalDuration / 60)
                  })()}
                  <span className="text-sm ml-1">min</span>
                </div>
                <div className="text-sm text-muted-foreground">Total Duration (round trip)</div>
              </div>
            </div>

            {/* Optimized Sequence */}
            <div className="space-y-2">
              <h4 className="font-semibold">Delivery Sequence</h4>
              <div className="space-y-2">
                {/* Starting Point */}
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                    0
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Starting Point - Warehouse</div>
                    <div className="text-sm text-muted-foreground">
                      {godowns.find((g) => g.id === selectedGodownId)?.name}
                    </div>
                  </div>
                </div>

                {/* Delivery Stops */}
                {optimizedRoutePreview.map((stop, index) => {
                  const order = unassignedOrders.find((o) => o.id === stop.orderId)
                  const isLastStop = index === optimizedRoutePreview.length - 1
                  return (
                    <div key={stop.orderId}>
                      {/* Connection Line with Distance/Time */}
                      {stop.distanceFromPrevious && stop.durationFromPrevious && (
                        <div className="ml-4 pl-4 border-l-2 border-dashed border-muted-foreground py-1 text-xs text-muted-foreground">
                          {(stop.distanceFromPrevious / 1000).toFixed(1)} km • {Math.round(stop.durationFromPrevious / 60)} min
                        </div>
                      )}

                      {/* Stop Card */}
                      <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                          {stop.sequenceNumber}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{order?.order_number}</span>
                            <Badge variant="outline">
                              ₹{(order?.total_amount || 0).toLocaleString("en-IN")}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {order?.customer_name} • {order?.customer_phone}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {stop.address.address}
                          </div>
                        </div>
                      </div>

                      {/* Return Trip (only for last stop) */}
                      {isLastStop && stop.returnToWarehouse && (
                        <>
                          <div className="ml-4 pl-4 border-l-2 border-dashed border-muted-foreground py-1 text-xs text-muted-foreground">
                            {(stop.returnToWarehouse.distance / 1000).toFixed(1)} km • {Math.round(stop.returnToWarehouse.duration / 60)} min
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                              ✓
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">Return to Warehouse</div>
                              <div className="text-sm text-muted-foreground">
                                {godowns.find((g) => g.id === selectedGodownId)?.name}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowOptimizationPreview(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={openGoogleMapsRoute}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View on Google Maps
            </Button>
            <Button onClick={confirmOptimizedAssignment} disabled={saving}>
              {saving ? "Assigning..." : "Confirm & Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
