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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Package, CheckCircle2, TrendingUp, ExternalLink, UserMinus, FileDown } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { generateDeliveryRoutePDF } from "@/lib/pdf-generator"

type DeliveryPartner = {
  id: string
  name: string
  activeCount?: number
  completedCount?: number
}

type Order = {
  id: string
  order_number: string
  customer_id: string
  shipping_pincode: string
  shipping_city: string
  total_amount: number
  order_status: string
  created_at: string
}

type Assignment = {
  id: string
  order_id: string
  delivery_partner_id: string
  route_id: string
  status: string
  scheduled_delivery_date: string | null
  delivery_time: string | null
  sequence_number: number | null
  created_at: string
  order?: Order
  route_name?: string
  customer_name?: string
}

type PartnerStats = {
  totalActive: number
  totalCompleted: number
  totalAmount: number
  avgDeliveryTime: number
}

export default function PartnerOrdersPage() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState("")
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([])
  const [completedAssignments, setCompletedAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [stats, setStats] = useState<PartnerStats>({
    totalActive: 0,
    totalCompleted: 0,
    totalAmount: 0,
    avgDeliveryTime: 0,
  })
  const [showUnassignDialog, setShowUnassignDialog] = useState(false)
  const [assignmentToUnassign, setAssignmentToUnassign] = useState<Assignment | null>(null)
  const [unassigning, setUnassigning] = useState(false)

  useEffect(() => {
    fetchPartners()

    // Set up real-time subscription for route_assignments
    const assignmentsSubscription = supabase
      .channel('route_assignments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'route_assignments'
        },
        (payload) => {
          console.log('Assignment change received:', payload)
          // Refresh assignments for selected partner
          if (selectedPartnerId) {
            fetchPartnerAssignments(selectedPartnerId)
          }
        }
      )
      .subscribe()

    // Set up real-time subscription for orders
    const ordersSubscription = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order change received:', payload)
          // Refresh assignments for selected partner
          if (selectedPartnerId) {
            fetchPartnerAssignments(selectedPartnerId)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(assignmentsSubscription)
      supabase.removeChannel(ordersSubscription)
    }
  }, [selectedPartnerId])

  useEffect(() => {
    if (selectedPartnerId) {
      fetchPartnerAssignments(selectedPartnerId)
    }
  }, [selectedPartnerId])

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from("delivery_partners")
      .select("id, name")
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("Error fetching partners:", error)
      return
    }

    // Fetch assignment counts for each partner
    const partnersWithStats = await Promise.all(
      (data || []).map(async (partner) => {
        // Get route assignments
        const { data: routeAssignments } = await supabase
          .from("route_assignments")
          .select("id, status")
          .eq("delivery_partner_id", partner.id)

        // Get direct order assignments
        const { data: directOrders } = await supabase
          .from("orders")
          .select("id, order_status")
          .eq("delivery_partner_id", partner.id)

        // Get order IDs in route assignments to avoid duplicates
        const routeOrderIds = new Set(routeAssignments?.map((a: any) => a.order_id) || [])

        // Filter direct orders that aren't already in route assignments
        const uniqueDirectOrders = (directOrders || []).filter(
          (order: any) => !routeOrderIds.has(order.id)
        )

        const activeRouteCount = routeAssignments?.filter(
          (a) => a.status !== "delivered" && a.status !== "cancelled"
        ).length || 0

        const completedRouteCount = routeAssignments?.filter(
          (a) => a.status === "delivered"
        ).length || 0

        const activeDirectCount = uniqueDirectOrders.filter(
          (o: any) => o.order_status !== "delivered" && o.order_status !== "cancelled"
        ).length || 0

        const completedDirectCount = uniqueDirectOrders.filter(
          (o: any) => o.order_status === "delivered"
        ).length || 0

        return {
          ...partner,
          activeCount: activeRouteCount + activeDirectCount,
          completedCount: completedRouteCount + completedDirectCount,
        }
      })
    )

    setPartners(partnersWithStats)
    if (partnersWithStats && partnersWithStats.length > 0 && !selectedPartnerId) {
      setSelectedPartnerId(partnersWithStats[0].id)
    }
  }

  const fetchPartnerAssignments = async (partnerId: string) => {
    setLoading(true)

    // Fetch route assignments for this partner
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("route_assignments")
      .select("*")
      .eq("delivery_partner_id", partnerId)
      .order("created_at", { ascending: false })

    if (assignmentsError) {
      console.error("Error fetching route assignments:", assignmentsError)
      setLoading(false)
      return
    }

    // Also fetch direct order assignments (orders with delivery_partner_id)
    const { data: directOrdersData, error: directOrdersError } = await supabase
      .from("orders")
      .select("*")
      .eq("delivery_partner_id", partnerId)
      .order("created_at", { ascending: false })

    if (directOrdersError) {
      console.error("Error fetching direct orders:", directOrdersError)
    }

    // Get order IDs that are already in route_assignments to avoid duplicates
    const routeAssignedOrderIds = new Set(assignmentsData?.map((a) => a.order_id) || [])

    // Filter out orders that are already in route assignments
    const uniqueDirectOrders = (directOrdersData || []).filter(
      (order) => !routeAssignedOrderIds.has(order.id)
    )

    // Convert direct orders to assignment format
    const directAssignments = uniqueDirectOrders.map((order) => ({
      id: `direct-${order.id}`,
      order_id: order.id,
      delivery_partner_id: partnerId,
      route_id: null,
      status: order.order_status === "delivered" ? "delivered" : "assigned",
      scheduled_delivery_date: null,
      delivery_time: order.delivered_date || null,
      sequence_number: null,
      created_at: order.assigned_to_delivery_at || order.created_at,
      assignment_date: order.assigned_to_delivery_at,
    }))

    // Combine both types of assignments
    const allAssignments = [...(assignmentsData || []), ...directAssignments]

    if (allAssignments.length === 0) {
      setActiveAssignments([])
      setCompletedAssignments([])
      setStats({
        totalActive: 0,
        totalCompleted: 0,
        totalAmount: 0,
        avgDeliveryTime: 0,
      })
      setLoading(false)
      return
    }

    // Fetch related data
    const orderIds = [...new Set(allAssignments.map((a) => a.order_id))]
    const routeIds = [...new Set(allAssignments.filter((a) => a.route_id).map((a) => a.route_id))]

    // First fetch orders and routes
    const [{ data: ordersData }, { data: routesData }] = await Promise.all([
      supabase.from("orders").select("*").in("id", orderIds),
      routeIds.length > 0
        ? supabase.from("routes").select("id, route_name").in("id", routeIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    // Then fetch customers based on orders
    const customerIds = [
      ...new Set(ordersData?.map((o: Order) => o.customer_id) || []),
    ]
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, first_name, last_name")
      .in("id", customerIds)

    // Create lookup maps
    const orderMap = new Map(ordersData?.map((o) => [o.id, o]))
    const routeMap = new Map(routesData?.map((r) => [r.id, r.route_name]))
    const customerMap = new Map(
      customersData?.map((c) => [c.id, `${c.first_name} ${c.last_name}`])
    )

    // Enrich assignments with related data
    const enrichedAssignments = allAssignments.map((assignment) => {
      const order = orderMap.get(assignment.order_id)
      return {
        ...assignment,
        order,
        route_name: assignment.route_id ? routeMap.get(assignment.route_id) : "Direct Assignment",
        customer_name: order ? customerMap.get(order.customer_id) : undefined,
      }
    })

    // Split into active and completed
    const active = enrichedAssignments.filter(
      (a) => a.status !== "delivered" && a.status !== "cancelled"
    )
    const completed = enrichedAssignments.filter(
      (a) => a.status === "delivered"
    )

    setActiveAssignments(active)
    setCompletedAssignments(completed)

    // Calculate stats
    const totalAmount = completed.reduce(
      (sum, a) => sum + (a.order?.total_amount || 0),
      0
    )

    // Calculate average delivery time for completed orders
    let totalDeliveryMinutes = 0
    let deliveryCount = 0

    completed.forEach((a) => {
      if (a.delivery_time && a.assignment_date) {
        const deliveryDate = new Date(a.delivery_time)
        const assignmentDate = new Date(a.assignment_date)
        const diffMinutes = (deliveryDate.getTime() - assignmentDate.getTime()) / (1000 * 60)
        if (diffMinutes > 0) {
          totalDeliveryMinutes += diffMinutes
          deliveryCount++
        }
      }
    })

    setStats({
      totalActive: active.length,
      totalCompleted: completed.length,
      totalAmount,
      avgDeliveryTime: deliveryCount > 0 ? Math.round(totalDeliveryMinutes / deliveryCount / 60) : 0, // Convert to hours
    })

    setLoading(false)
  }

  const handleUnassignClick = (assignment: Assignment) => {
    setAssignmentToUnassign(assignment)
    setShowUnassignDialog(true)
  }

  const confirmUnassignment = async () => {
    if (!assignmentToUnassign) return

    setUnassigning(true)

    try {
      // Check if this is a direct assignment or route assignment
      const isDirectAssignment = assignmentToUnassign.id.startsWith('direct-')

      if (!isDirectAssignment) {
        // Delete the route assignment
        const { error: deleteError } = await supabase
          .from("route_assignments")
          .delete()
          .eq("id", assignmentToUnassign.id)

        if (deleteError) throw deleteError
      }

      // Clear delivery_partner_id from the order (for both types)
      // Also reset order status to pending if it was in processing
      const currentOrderStatus = assignmentToUnassign.order?.order_status
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          delivery_partner_id: null,
          assigned_to_delivery_at: null,
          order_status: currentOrderStatus === "processing" ? "pending" : currentOrderStatus
        })
        .eq("id", assignmentToUnassign.order_id)

      if (updateError) {
        console.error("Error clearing delivery partner from order:", updateError)
        throw updateError
      }

      toast.success("Order unassigned successfully")

      setShowUnassignDialog(false)
      setAssignmentToUnassign(null)

      // Refresh data
      await fetchPartners()
      if (selectedPartnerId) {
        await fetchPartnerAssignments(selectedPartnerId)
      }
    } catch (error: unknown) {
      console.error("Error unassigning order:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to unassign order"
      toast.error(errorMessage)
    } finally {
      setUnassigning(false)
    }
  }

  const handleGenerateDeliverySheet = async () => {
    if (!selectedPartnerId) {
      toast.error("Please select a delivery partner")
      return
    }

    if (activeAssignments.length === 0) {
      toast.error("No active orders to generate delivery sheet")
      return
    }

    try {
      toast.loading("Generating delivery sheet...")

      // Get partner details
      const selectedPartner = partners.find(p => p.id === selectedPartnerId)
      if (!selectedPartner) {
        toast.error("Partner not found")
        return
      }

      // Fetch full partner details including phone
      const { data: partnerData, error: partnerError } = await supabase
        .from("delivery_partners")
        .select("name, mobile")
        .eq("id", selectedPartnerId)
        .single()

      if (partnerError) throw partnerError

      // Get all order IDs from active assignments
      const orderIds = activeAssignments.map(a => a.order_id)

      // Fetch orders with items
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .in("id", orderIds)

      if (ordersError) throw ordersError

      // Fetch customers
      const customerIds = [...new Set(ordersData?.map(o => o.customer_id))]
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, first_name, last_name, mobile_primary, mobile_secondary_1, mobile_secondary_2, full_address")
        .in("id", customerIds)

      if (customersError) throw customersError

      // Fetch order items for all orders
      const { data: orderItemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)

      if (itemsError) throw itemsError

      // Create lookup maps
      const orderMap = new Map(ordersData?.map(o => [o.id, o]))
      const customerMap = new Map(customersData?.map(c => [c.id, c]))
      const orderItemsMap = new Map<string, any[]>()
      orderItemsData?.forEach(item => {
        if (!orderItemsMap.has(item.order_id)) {
          orderItemsMap.set(item.order_id, [])
        }
        orderItemsMap.get(item.order_id)?.push(item)
      })

      // Prepare PDF data
      const pdfOrders = activeAssignments
        .sort((a, b) => (a.sequence_number || 999) - (b.sequence_number || 999))
        .map((assignment, index) => {
          const order = orderMap.get(assignment.order_id)
          const customer = order ? customerMap.get(order.customer_id) : undefined
          const items = orderItemsMap.get(assignment.order_id) || []

          if (!order || !customer) return null

          return {
            sequenceNumber: assignment.sequence_number || index + 1,
            orderNumber: order.order_number,
            customerName: `${customer.first_name} ${customer.last_name}`,
            customerPhone: customer.mobile_primary,
            customerPhoneSecondary1: customer.mobile_secondary_1 || undefined,
            customerPhoneSecondary2: customer.mobile_secondary_2 || undefined,
            amount: order.total_amount,
            address: {
              fullAddress: customer.full_address || undefined,
              buildingName: order.shipping_building_name || undefined,
              streetArea: order.shipping_street_area || undefined,
              landmark: order.shipping_landmark || undefined,
              city: order.shipping_city || undefined,
              state: order.shipping_state || undefined,
              pincode: order.shipping_pincode || undefined,
            },
            items: items.map(item => ({
              product_name: item.product_name,
              quantity: item.quantity,
            })),
          }
        })
        .filter((order): order is NonNullable<typeof order> => order !== null)

      // Determine route name - use the most common route name from assignments
      const routeNames = activeAssignments
        .map(a => a.route_name)
        .filter((name): name is string => name !== undefined && name !== null)
      const routeName = routeNames.length > 0
        ? routeNames[0] // Use first route name
        : `${partnerData.name} - Active Orders`

      // Generate PDF
      generateDeliveryRoutePDF({
        routeName: routeName,
        partnerName: partnerData.name,
        partnerPhone: partnerData.mobile || "N/A",
        assignmentDate: new Date().toLocaleDateString("en-IN"),
        orders: pdfOrders,
      })

      // Save delivery sheet record to database
      const { error: insertError } = await supabase
        .from("delivery_sheets")
        .insert({
          route_id: null, // No route for direct assignments
          delivery_partner_id: selectedPartnerId,
          generated_at: new Date().toISOString(),
          orders_count: pdfOrders.length,
          total_amount: pdfOrders.reduce((sum, o) => sum + o.amount, 0),
          items_count: pdfOrders.reduce((sum, o) => {
            return sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
          }, 0),
        })

      if (insertError) {
        console.error("Error saving delivery sheet record:", insertError)
        // Don't throw error, just log it - PDF was still generated successfully
      }

      toast.dismiss()
      toast.success("Delivery sheet generated successfully")
    } catch (error) {
      console.error("Error generating delivery sheet:", error)
      toast.dismiss()
      toast.error("Failed to generate delivery sheet")
    }
  }

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "delivered") return "default"
    if (lowerStatus === "in_transit" || lowerStatus === "picked_up" || lowerStatus === "out_for_delivery") return "outline"
    if (lowerStatus === "assigned") return "secondary"
    if (lowerStatus === "failed" || lowerStatus === "cancelled") return "destructive"
    return "secondary"
  }

  const filteredActiveAssignments = activeAssignments.filter(
    (assignment) =>
      (assignment.order?.order_number &&
        assignment.order.order_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (assignment.customer_name &&
        assignment.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      assignment.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredCompletedAssignments = completedAssignments.filter(
    (assignment) =>
      (assignment.order?.order_number &&
        assignment.order.order_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (assignment.customer_name &&
        assignment.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const selectedPartnerName = partners.find((p) => p.id === selectedPartnerId)?.name || ""

  if (loading && partners.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Partner Orders</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Partner Orders</h1>
          <p className="text-muted-foreground">
            View and manage orders assigned to delivery partners
          </p>
        </div>
      </div>

      {/* Partner Selection - Carousel */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Delivery Partners</h2>
          <p className="text-sm text-muted-foreground">Click on a partner to view their orders • Scroll to see more</p>
        </div>
        <Carousel
          opts={{
            align: "start",
            slidesToScroll: 1,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {partners.map((partner) => (
              <CarouselItem key={partner.id} className="pl-4 basis-1/5">
                <Card
                  className={`cursor-pointer transition-all hover:shadow-lg h-full ${
                    selectedPartnerId === partner.id
                      ? "border-primary border-2 shadow-md"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedPartnerId(partner.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="truncate">{partner.name}</span>
                      {selectedPartnerId === partner.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                        <p className="text-2xl font-bold">{partner.activeCount || 0}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                        <p className="text-2xl font-bold">{partner.completedCount || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>

      {selectedPartnerId && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalActive}</div>
                <p className="text-xs text-muted-foreground">Currently assigned</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCompleted}</div>
                <p className="text-xs text-muted-foreground">Successfully delivered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{stats.totalAmount.toLocaleString("en-IN")}
                </div>
                <p className="text-xs text-muted-foreground">From completed orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgDeliveryTime}h</div>
                <p className="text-xs text-muted-foreground">Hours per delivery</p>
              </CardContent>
            </Card>
          </div>

          {/* Orders Tabs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Orders for {selectedPartnerName}</CardTitle>
                  <CardDescription>Active and completed order assignments</CardDescription>
                </div>
                <Button
                  onClick={handleGenerateDeliverySheet}
                  disabled={activeAssignments.length === 0}
                  variant="default"
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Generate Delivery Sheet
                </Button>
              </div>
              <div className="mt-4">
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="active">
                    Active Orders ({filteredActiveAssignments.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    Completed ({filteredCompletedAssignments.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Order Status</TableHead>
                          <TableHead>Assignment Status</TableHead>
                          <TableHead>Assigned Date</TableHead>
                          <TableHead>Scheduled Date</TableHead>
                          <TableHead>Sequence</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActiveAssignments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center">
                              No active orders found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredActiveAssignments.map((assignment) => (
                            <TableRow key={assignment.id}>
                              <TableCell className="font-medium">
                                {assignment.order?.order_number ? (
                                  <Link
                                    href={`/dashboard/orders/${assignment.order_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-blue-600 hover:underline"
                                  >
                                    {assignment.order.order_number}
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>{assignment.customer_name || "-"}</TableCell>
                              <TableCell>{assignment.route_name || "-"}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div>{assignment.order?.shipping_city || "-"}</div>
                                  <div className="text-muted-foreground">
                                    {assignment.order?.shipping_pincode || "-"}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                ₹
                                {(assignment.order?.total_amount || 0).toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusVariant(assignment.order?.order_status || "")}>
                                  {assignment.order?.order_status || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusVariant(assignment.status)}>
                                  {assignment.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {assignment.created_at ? (
                                  <div className="text-sm">
                                    <div>{new Date(assignment.created_at).toLocaleDateString("en-IN")}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(assignment.created_at).toLocaleTimeString("en-IN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {assignment.scheduled_delivery_date
                                  ? new Date(
                                      assignment.scheduled_delivery_date
                                    ).toLocaleDateString("en-IN")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {assignment.sequence_number !== null ? (
                                  <Badge variant="outline">
                                    #{assignment.sequence_number}
                                  </Badge>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
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
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="completed" className="mt-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Order Status</TableHead>
                          <TableHead>Assigned Date</TableHead>
                          <TableHead>Delivered Date</TableHead>
                          <TableHead>Delivery Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCompletedAssignments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center">
                              No completed orders found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCompletedAssignments.map((assignment) => (
                            <TableRow key={assignment.id}>
                              <TableCell className="font-medium">
                                {assignment.order?.order_number ? (
                                  <Link
                                    href={`/dashboard/orders/${assignment.order_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-blue-600 hover:underline"
                                  >
                                    {assignment.order.order_number}
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>{assignment.customer_name || "-"}</TableCell>
                              <TableCell>{assignment.route_name || "-"}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div>{assignment.order?.shipping_city || "-"}</div>
                                  <div className="text-muted-foreground">
                                    {assignment.order?.shipping_pincode || "-"}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                ₹
                                {(assignment.order?.total_amount || 0).toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusVariant(assignment.order?.order_status || "")}>
                                  {assignment.order?.order_status || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {assignment.created_at ? (
                                  <div className="text-sm">
                                    <div>{new Date(assignment.created_at).toLocaleDateString("en-IN")}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(assignment.created_at).toLocaleTimeString("en-IN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {assignment.delivery_time
                                  ? new Date(assignment.delivery_time).toLocaleDateString("en-IN")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {assignment.delivery_time
                                  ? new Date(assignment.delivery_time).toLocaleTimeString(
                                      "en-IN",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* Unassign Confirmation Dialog */}
      <Dialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to unassign this order from the delivery partner?
            </DialogDescription>
          </DialogHeader>
          {assignmentToUnassign && (
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Order Number:</div>
                <div className="font-medium">{assignmentToUnassign.order?.order_number}</div>

                <div className="text-muted-foreground">Route:</div>
                <div>{assignmentToUnassign.route_name}</div>

                <div className="text-muted-foreground">Delivery Partner:</div>
                <div>{selectedPartnerName}</div>

                <div className="text-muted-foreground">Customer:</div>
                <div>{assignmentToUnassign.customer_name}</div>

                <div className="text-muted-foreground">Status:</div>
                <div>
                  <Badge variant={getStatusVariant(assignmentToUnassign.status)}>
                    {assignmentToUnassign.status}
                  </Badge>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-md text-sm">
                <p className="text-amber-800 dark:text-amber-200">
                  This order will be moved back to the unassigned orders list and can be reassigned to another route or delivery partner.
                </p>
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
              {unassigning ? "Unassigning..." : "Unassign Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
