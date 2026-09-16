"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Package,
  Truck,
  Calendar,
  User,
  FileText,
  Download,
  Eye,
  IndianRupee,
  Banknote,
  CreditCard,
  Smartphone,
  Calculator,
  Image as ImageIcon,
  ExternalLink,
  Wallet
} from "lucide-react"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"

interface DeliveryPartner {
  id: string
  name: string
  mobile: string
  partner_code?: string
  is_available: boolean
}

interface RouteAssignment {
  id: string
  route_id: string
  order_id: string
  delivery_partner_id: string
  status: string
  created_at?: string
  delivery_time?: string
  collected_payment_method?: string
  collected_amount?: number
  delivery_proof_url?: string
  customer_signature_url?: string
  delivery_notes?: string
  orders: {
    id: string
    order_number: string
    total_amount: number
    customer_id?: string
    shipping_full_address: string
    payment_method?: string
    payment_status?: string
    cod_amount?: number
    order_date?: string
    created_at?: string
    invoice_number_gst?: string
    invoice_number_non_gst?: string
    order_items: Array<{
      product_name: string
      quantity: number
      unit_price: number
      total: number
    }>
  }
  routes: {
    route_name: string
  }
  customer?: {
    name: string
    mobile: string
  }
}

interface DeliveryReview {
  id: string
  review_date: string
  delivery_partner_id: string
  partner_name: string
  total_deliveries: number
  verified_deliveries: number
  disputed_deliveries: number
  total_cash_expected: number
  total_cash_collected: number
  cash_difference: number
  review_status: string
  settlement_status: string
}

interface CashReconciliation {
  notes_2000: number
  notes_500: number
  notes_200: number
  notes_100: number
  notes_50: number
  notes_20: number
  notes_10: number
  coins_total: number
  total_cash_submitted?: number
  total_cash_expected: number
  cash_difference?: number
}

export default function DeliveryReviewerPage() {
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityDetails, loading: entityLoading } = useEntityData()
  const isDistributor = role === 'main_distributor' || role === 'sub_distributor'
  const isMainDistributor = role === 'main_distributor'
  const isSubDistributor = role === 'sub_distributor'

  const [loading, setLoading] = useState(false)
  const [loadingAllOrders, setLoadingAllOrders] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([])
  const [selectedPartner, setSelectedPartner] = useState<string>("")
  const [deliveries, setDeliveries] = useState<RouteAssignment[]>([])
  const [allOrders, setAllOrders] = useState<RouteAssignment[]>([])
  const [activeTab, setActiveTab] = useState<string>("review")
  const [currentReview, setCurrentReview] = useState<DeliveryReview | null>(null)
  const [showCashDialog, setShowCashDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState<RouteAssignment | null>(null)
  const [cashForm, setCashForm] = useState<CashReconciliation>({
    notes_2000: 0,
    notes_500: 0,
    notes_200: 0,
    notes_100: 0,
    notes_50: 0,
    notes_20: 0,
    notes_10: 0,
    coins_total: 0,
    total_cash_expected: 0
  })
  const [reviewNotes, setReviewNotes] = useState("")
  const [verificationStatus, setVerificationStatus] = useState<Record<string, string>>({})

  // Fetch delivery partners
  useEffect(() => {
    fetchDeliveryPartners()
  }, [])

  // Fetch deliveries when partner or date changes
  useEffect(() => {
    if (selectedPartner && selectedDate) {
      fetchDeliveries()
      fetchAllOrders()
      checkExistingReview()
    }
  }, [selectedPartner, selectedDate])

  const fetchDeliveryPartners = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_partners")
        .select("id, name, mobile, partner_code, is_available")
        .eq("is_active", true)
        .order("name")

      if (error) throw error
      setDeliveryPartners(data || [])
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch delivery partners")
    }
  }

  const fetchDeliveries = async () => {
    setLoading(true)
    try {
      // Pre-fetch distributor data for filtering
      let distributorPincodes: string[] = []
      if (isDistributor && entityId) {
        distributorPincodes = entityDetails?.serviceable_pincodes || []
      }

      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from("route_assignments")
        .select(`
          *,
          orders!inner(
            id,
            order_number,
            total_amount,
            shipping_full_address,
            shipping_pincode,
            customer_id,
            payment_method,
            payment_status,
            cod_amount,
            order_date,
            created_at,
            invoice_number_gst,
            invoice_number_non_gst,
            order_items(
              product_name,
              quantity,
              unit_price,
              total
            )
          ),
          routes!inner(
            route_name
          )
        `)
        .eq("delivery_partner_id", selectedPartner)
        .gte("delivery_time", startOfDay.toISOString())
        .lte("delivery_time", endOfDay.toISOString())
        .in("status", ["delivered", "failed"])
        .order("delivery_time", { ascending: false })

      if (error) throw error

      // Filter for distributor's serviceable pincodes
      let filteredData = data || []
      if (isDistributor && distributorPincodes.length > 0) {
        filteredData = filteredData.filter((d: any) =>
          distributorPincodes.includes(d.orders?.shipping_pincode)
        )
      }

      // Fetch customer data for each order
      const deliveriesWithCustomers = await Promise.all(
        filteredData.map(async (delivery) => {
          if (delivery.orders.customer_id) {
            const { data: customerData } = await supabase
              .from("customers")
              .select("first_name, last_name, mobile_primary")
              .eq("id", delivery.orders.customer_id)
              .single()

            if (customerData) {
              return {
                ...delivery,
                customer: {
                  name: `${customerData.first_name} ${customerData.last_name}`,
                  mobile: customerData.mobile_primary
                }
              }
            }
          }
          return {
            ...delivery,
            customer: {
              name: "Unknown Customer",
              mobile: ""
            }
          }
        })
      )

      // Sort by order date (oldest first) so backlog orders appear at top
      deliveriesWithCustomers.sort((a, b) => {
        const dateA = new Date(a.orders.order_date || a.orders.created_at || 0).getTime()
        const dateB = new Date(b.orders.order_date || b.orders.created_at || 0).getTime()
        return dateA - dateB
      })

      setDeliveries(deliveriesWithCustomers)

      // Initialize verification status
      const statusMap: Record<string, string> = {}
      deliveriesWithCustomers?.forEach(d => {
        statusMap[d.id] = "pending"
      })
      setVerificationStatus(statusMap)
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch deliveries")
    } finally {
      setLoading(false)
    }
  }

  const fetchAllOrders = async () => {
    setLoadingAllOrders(true)
    try {
      // Pre-fetch distributor data for filtering
      let distributorPincodes: string[] = []
      if (isDistributor && entityId) {
        distributorPincodes = entityDetails?.serviceable_pincodes || []
      }

      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from("route_assignments")
        .select(`
          *,
          orders!inner(
            id,
            order_number,
            total_amount,
            shipping_full_address,
            shipping_pincode,
            customer_id,
            payment_method,
            payment_status,
            cod_amount,
            order_date,
            created_at,
            invoice_number_gst,
            invoice_number_non_gst,
            order_items(
              product_name,
              quantity,
              unit_price,
              total
            )
          ),
          routes!inner(
            route_name
          )
        `)
        .eq("delivery_partner_id", selectedPartner)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: false })

      if (error) throw error

      // Filter for distributor's serviceable pincodes
      let filteredData = data || []
      if (isDistributor && distributorPincodes.length > 0) {
        filteredData = filteredData.filter((d: any) =>
          distributorPincodes.includes(d.orders?.shipping_pincode)
        )
      }

      // Fetch customer data for each order
      const ordersWithCustomers = await Promise.all(
        filteredData.map(async (order) => {
          if (order.orders.customer_id) {
            const { data: customerData } = await supabase
              .from("customers")
              .select("first_name, last_name, mobile_primary")
              .eq("id", order.orders.customer_id)
              .single()

            if (customerData) {
              return {
                ...order,
                customer: {
                  name: `${customerData.first_name} ${customerData.last_name}`,
                  mobile: customerData.mobile_primary
                }
              }
            }
          }
          return {
            ...order,
            customer: {
              name: "Unknown Customer",
              mobile: ""
            }
          }
        })
      )

      // Sort by order date (oldest first) so backlog orders appear at top
      ordersWithCustomers.sort((a, b) => {
        const dateA = new Date(a.orders.order_date || a.orders.created_at || 0).getTime()
        const dateB = new Date(b.orders.order_date || b.orders.created_at || 0).getTime()
        return dateA - dateB
      })

      setAllOrders(ordersWithCustomers)
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch all orders")
    } finally {
      setLoadingAllOrders(false)
    }
  }

  const checkExistingReview = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_reviews")
        .select("*")
        .eq("delivery_partner_id", selectedPartner)
        .eq("review_date", selectedDate)
        .single()

      if (data && !error) {
        setCurrentReview(data)

        // Load verification status from review items
        const { data: reviewItems } = await supabase
          .from("delivery_review_items")
          .select("route_assignment_id, verified_status")
          .eq("review_id", data.id)

        if (reviewItems) {
          const statusMap: Record<string, string> = {}
          reviewItems.forEach(item => {
            statusMap[item.route_assignment_id] = item.verified_status || "pending"
          })
          setVerificationStatus(statusMap)
        }
      } else {
        setCurrentReview(null)
      }
    } catch (error) {
      // No existing review, which is fine
      setCurrentReview(null)
    }
  }

  const calculateTotals = () => {
    const deliveredOrders = deliveries.filter(d => d.status === "delivered")

    // Calculate expected amounts by payment method
    const expectedByMethod: Record<string, number> = {}
    const expectedCountByMethod: Record<string, number> = {}

    deliveredOrders.forEach(d => {
      const method = (d.orders.payment_method || 'unknown').toLowerCase()
      const amount = d.orders.cod_amount || d.orders.total_amount
      expectedByMethod[method] = (expectedByMethod[method] || 0) + amount
      expectedCountByMethod[method] = (expectedCountByMethod[method] || 0) + 1
    })

    // Calculate collected amounts by payment method
    const collectedByMethod: Record<string, number> = {}
    const collectedCountByMethod: Record<string, number> = {}

    deliveredOrders.forEach(d => {
      if (d.collected_payment_method) {
        const method = d.collected_payment_method.toLowerCase()
        const amount = d.collected_amount || 0
        collectedByMethod[method] = (collectedByMethod[method] || 0) + amount
        collectedCountByMethod[method] = (collectedCountByMethod[method] || 0) + 1
      }
    })

    const totalDeliveries = deliveredOrders.length
    const verifiedCount = Object.values(verificationStatus).filter(s => s === "verified").length
    const disputedCount = Object.values(verificationStatus).filter(s => s === "disputed").length

    // Cash specific totals (for backward compatibility)
    const totalCashExpected = (expectedByMethod['cash'] || 0) + (expectedByMethod['cod'] || 0)
    const totalCashCollected = collectedByMethod['cash'] || 0
    const cashDeliveries = (expectedCountByMethod['cash'] || 0) + (expectedCountByMethod['cod'] || 0)
    const actualCashDeliveries = collectedCountByMethod['cash'] || 0

    return {
      totalDeliveries,
      verifiedCount,
      disputedCount,
      totalCashExpected,
      totalCashCollected,
      cashDeliveries,
      actualCashDeliveries,
      expectedByMethod,
      collectedByMethod,
      expectedCountByMethod,
      collectedCountByMethod
    }
  }

  const handleVerifyDelivery = async (assignmentId: string, status: string) => {
    // Update local state
    setVerificationStatus(prev => ({
      ...prev,
      [assignmentId]: status
    }))

    // Find the delivery to get the order ID
    const delivery = deliveries.find(d => d.id === assignmentId)
    if (!delivery) return

    // If verified and delivery was successful, update order payment_status to completed
    if (status === "verified" && delivery.status === "delivered") {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ payment_status: "completed" })
          .eq("id", delivery.orders.id)

        if (error) {
          console.error("Error updating order payment status:", error)
          toast.error("Failed to update order payment status")
        } else {
          toast.success(`Order ${delivery.orders.order_number} marked as payment completed`)
        }
      } catch (error) {
        console.error("Error updating order:", error)
        toast.error("Failed to update order")
      }
    }
  }

  const handleOpenCashDialog = async () => {
    const totals = calculateTotals()

    // If review exists, load existing cash reconciliation data
    if (currentReview) {
      try {
        const { data: cashData } = await supabase
          .from("daily_cash_reconciliation")
          .select("*")
          .eq("delivery_partner_id", selectedPartner)
          .eq("reconciliation_date", selectedDate)
          .single()

        if (cashData) {
          setCashForm({
            notes_2000: cashData.notes_2000 || 0,
            notes_500: cashData.notes_500 || 0,
            notes_200: cashData.notes_200 || 0,
            notes_100: cashData.notes_100 || 0,
            notes_50: cashData.notes_50 || 0,
            notes_20: cashData.notes_20 || 0,
            notes_10: cashData.notes_10 || 0,
            coins_total: parseFloat(cashData.coins_total) || 0,
            total_cash_expected: totals.totalCashExpected
          })
          setReviewNotes(cashData.review_notes || "")
        }
      } catch (error) {
        console.error("Error loading cash reconciliation:", error)
      }
    } else {
      setCashForm(prev => ({
        ...prev,
        total_cash_expected: totals.totalCashExpected
      }))
    }

    setShowCashDialog(true)
  }

  const calculateCashTotal = () => {
    return (
      cashForm.notes_2000 * 2000 +
      cashForm.notes_500 * 500 +
      cashForm.notes_200 * 200 +
      cashForm.notes_100 * 100 +
      cashForm.notes_50 * 50 +
      cashForm.notes_20 * 20 +
      cashForm.notes_10 * 10 +
      cashForm.coins_total
    )
  }

  const handleSubmitCashReconciliation = async () => {
    try {
      setLoading(true)
      const totals = calculateTotals()
      const totalCashSubmitted = calculateCashTotal()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No user found")

      // Create or update delivery review
      const reviewData = {
        review_date: selectedDate,
        reviewer_id: user.id,
        reviewer_name: user.email || "Reviewer",
        delivery_partner_id: selectedPartner,
        partner_name: deliveryPartners.find(p => p.id === selectedPartner)?.name || "",
        total_deliveries: totals.totalDeliveries,
        verified_deliveries: totals.verifiedCount,
        disputed_deliveries: totals.disputedCount,
        total_cash_expected: totals.totalCashExpected,
        total_cash_collected: totalCashSubmitted,
        cash_difference: totals.totalCashExpected - totalCashSubmitted,
        total_cheque_amount: 0,
        total_upi_amount: 0,
        total_card_amount: 0,
        total_online_amount: 0,
        review_status: totals.disputedCount > 0 ? "disputed" : "completed",
        settlement_status: Math.abs(totals.totalCashExpected - totalCashSubmitted) < 0.01 ? "complete" : "partial",
        review_notes: reviewNotes
      }

      let reviewId: string
      if (currentReview) {
        const { data, error } = await supabase
          .from("delivery_reviews")
          .update(reviewData)
          .eq("id", currentReview.id)
          .select()
          .single()

        if (error) throw error
        reviewId = data.id
      } else {
        const { data, error } = await supabase
          .from("delivery_reviews")
          .insert(reviewData)
          .select()
          .single()

        if (error) throw error
        reviewId = data.id
      }

      // Create cash reconciliation record
      const { error: cashError } = await supabase
        .from("daily_cash_reconciliation")
        .upsert({
          reconciliation_date: selectedDate,
          delivery_partner_id: selectedPartner,
          partner_name: deliveryPartners.find(p => p.id === selectedPartner)?.name || "",
          reviewer_id: user.id,
          reviewer_name: user.email || "Reviewer",
          notes_2000: cashForm.notes_2000,
          notes_500: cashForm.notes_500,
          notes_200: cashForm.notes_200,
          notes_100: cashForm.notes_100,
          notes_50: cashForm.notes_50,
          notes_20: cashForm.notes_20,
          notes_10: cashForm.notes_10,
          coins_total: cashForm.coins_total,
          total_cash_expected: totals.totalCashExpected,
          reconciliation_status: Math.abs(totals.totalCashExpected - totalCashSubmitted) < 0.01 ? "completed" : "discrepancy",
          discrepancy_reason: Math.abs(totals.totalCashExpected - totalCashSubmitted) >= 0.01
            ? `Cash difference: ₹${(totals.totalCashExpected - totalCashSubmitted).toFixed(2)}`
            : null
        }, {
          onConflict: "delivery_partner_id,reconciliation_date"
        })

      if (cashError) throw cashError

      // Create review items for each delivery
      const reviewItems = deliveries.map(delivery => ({
        review_id: reviewId,
        route_assignment_id: delivery.id,
        order_id: delivery.orders.id,
        order_number: delivery.orders.order_number,
        customer_name: delivery.customer?.name || "Unknown",
        delivery_address: delivery.orders.shipping_full_address,
        delivery_status: delivery.status,
        reported_delivered_at: delivery.delivery_time,
        verified_status: verificationStatus[delivery.id] || "pending",
        order_amount: delivery.orders.total_amount,
        reported_payment_method: delivery.collected_payment_method,
        reported_collected_amount: delivery.collected_amount || 0,
        verified_payment_method: delivery.collected_payment_method,
        verified_amount: delivery.collected_amount || 0
      }))

      const { error: itemsError } = await supabase
        .from("delivery_review_items")
        .upsert(reviewItems, {
          onConflict: "route_assignment_id"
        })

      if (itemsError) throw itemsError

      // Update orders to mark payment as completed for verified deliveries
      const verifiedOrderIds = deliveries
        .filter(d => verificationStatus[d.id] === "verified" && d.status === "delivered")
        .map(d => d.orders.id)

      if (verifiedOrderIds.length > 0) {
        const { error: ordersUpdateError } = await supabase
          .from("orders")
          .update({
            payment_status: "completed"
          })
          .in("id", verifiedOrderIds)

        if (ordersUpdateError) {
          console.error("Error updating orders payment status:", ordersUpdateError)
          // Don't throw - reconciliation was successful, this is a secondary update
          toast.warning(`Reconciliation saved, but failed to update ${verifiedOrderIds.length} order(s) payment status`)
        } else {
          toast.success(`Cash reconciliation completed. ${verifiedOrderIds.length} order(s) marked as payment completed.`)
        }
      } else {
        toast.success("Cash reconciliation completed successfully")
      }

      setShowCashDialog(false)
      checkExistingReview()
    } catch (error: any) {
      toast.error(error.message || "Failed to submit cash reconciliation")
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

  const handleExportReport = () => {
    if (deliveries.length === 0) {
      toast.error("No deliveries to export")
      return
    }

    try {
      // Prepare CSV data
      const headers = [
        "Order Number",
        "Customer Name",
        "Customer Mobile",
        "Route",
        "Delivery Status",
        "Delivery Time",
        "Expected Payment Method",
        "Collected Payment Method",
        "Expected Amount",
        "Collected Amount",
        "Verification Status",
        "Address"
      ]

      const rows = deliveries.map(delivery => [
        delivery.orders.order_number,
        delivery.customer?.name || "Unknown",
        delivery.customer?.mobile || "-",
        delivery.routes.route_name,
        delivery.status,
        delivery.delivery_time ? new Date(delivery.delivery_time).toLocaleString() : "-",
        delivery.orders.payment_method || "Not specified",
        delivery.collected_payment_method || "Not recorded",
        delivery.orders.total_amount.toFixed(2),
        (delivery.collected_amount || 0).toFixed(2),
        verificationStatus[delivery.id] || "pending",
        delivery.orders.shipping_full_address
      ])

      // Convert to CSV
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n")

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      const partnerName = deliveryPartners.find(p => p.id === selectedPartner)?.name || "Unknown"
      const fileName = `delivery-review_${partnerName}_${selectedDate}.csv`

      link.setAttribute("href", url)
      link.setAttribute("download", fileName)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("Report exported successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to export report")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Payment Collection Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Review all deliveries and collect payments from drivers at end of day
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Driver and Date</CardTitle>
          <CardDescription>Choose the delivery partner and review date to see all deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Review Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner">Delivery Partner</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger id="partner" className="w-full">
                  <SelectValue placeholder="Select a delivery partner" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryPartners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{partner.name}</span>
                        <span className="text-sm text-muted-foreground">· {partner.mobile}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completed Review Banner */}
      {selectedPartner && currentReview && currentReview.review_status === "completed" && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-green-500 p-2 shrink-0">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    Review Completed
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Payment reconciliation for {deliveryPartners.find(p => p.id === selectedPartner)?.name} on {new Date(selectedDate).toLocaleDateString()}
                    has been completed.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div className="space-y-1">
                    <div className="text-green-600 dark:text-green-400 font-medium">Deliveries</div>
                    <div className="text-green-900 dark:text-green-100">{currentReview.total_deliveries} total, {currentReview.verified_deliveries} verified</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-green-600 dark:text-green-400 font-medium">Cash Expected</div>
                    <div className="text-green-900 dark:text-green-100">₹{parseFloat(currentReview.total_cash_expected as any).toFixed(2)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-green-600 dark:text-green-400 font-medium">Cash Collected</div>
                    <div className="text-green-900 dark:text-green-100">₹{parseFloat(currentReview.total_cash_collected as any).toFixed(2)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-green-600 dark:text-green-400 font-medium">Settlement</div>
                    <div className="text-green-900 dark:text-green-100">
                      {currentReview.settlement_status === "complete" ? "✓ Complete" :
                       currentReview.settlement_status === "partial" ? "⚠️ Partial" :
                       currentReview.settlement_status}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {selectedPartner && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentReview ? currentReview.total_deliveries : totals.totalDeliveries}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {currentReview ? currentReview.verified_deliveries : totals.verifiedCount}
              </div>
              {!currentReview && totals.totalDeliveries > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  of {totals.totalDeliveries} deliveries
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disputed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {currentReview ? currentReview.disputed_deliveries : totals.disputedCount}
              </div>
              {!currentReview && totals.totalDeliveries > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  of {totals.totalDeliveries} deliveries
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(totals.expectedCountByMethod).map(([method, count]) => (
                  <div key={method} className="text-sm flex justify-between">
                    <span className="capitalize">{method}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(totals.expectedCountByMethod).length === 0 && (
                  <div className="text-sm text-muted-foreground">No data</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expected</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{Object.values(totals.expectedByMethod).reduce((sum, val) => sum + val, 0).toFixed(2)}
              </div>
              <div className="space-y-0.5 mt-2">
                {Object.entries(totals.expectedByMethod).map(([method, amount]) => (
                  <div key={method} className="text-xs flex justify-between text-muted-foreground">
                    <span className="capitalize">{method}:</span>
                    <span>₹{amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deliveries Tabs */}
      {selectedPartner && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="review" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Payment Review ({deliveries.length})
            </TabsTrigger>
            <TabsTrigger value="all-orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              All Orders ({allOrders.length})
            </TabsTrigger>
          </TabsList>

          {/* Payment Review Tab */}
          <TabsContent value="review">
            <Card>
              <CardHeader className="space-y-3">
                <div>
                  <CardTitle>Deliveries for Review</CardTitle>
                  <CardDescription>
                    Review each delivery and verify payment collection for all payment methods
                  </CardDescription>
                </div>

            {!currentReview && deliveries.length > 0 && totals.verifiedCount < totals.totalDeliveries && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-blue-900 dark:text-blue-100">
                      Verify Each Delivery
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      Click the <CheckCircle className="inline h-4 w-4 mx-1" /> button to verify each delivery,
                      or <XCircle className="inline h-4 w-4 mx-1" /> to mark as disputed.
                      Progress: <span className="font-semibold">{totals.verifiedCount + totals.disputedCount}/{totals.totalDeliveries}</span> reviewed
                    </div>
                  </div>
                </div>
              </div>
            )}

            {deliveries.filter(d => !d.collected_payment_method || !d.collected_amount).length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-red-900 dark:text-red-100">
                      Missing Payment Collection Data
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      {deliveries.filter(d => !d.collected_payment_method || !d.collected_amount).length} delivery(ies)
                      have no payment collection recorded. The driver did not record payment collection at delivery time.
                      These deliveries need investigation.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Order #</TableHead>
                    <TableHead className="w-[110px]">Order Date</TableHead>
                    <TableHead className="min-w-[150px]">Customer</TableHead>
                    <TableHead className="min-w-[120px]">Route</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[180px]">Payment Method</TableHead>
                    <TableHead className="min-w-[140px]">Amount</TableHead>
                    <TableHead className="w-[120px]">Verification</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading deliveries...
                      </TableCell>
                    </TableRow>
                  ) : deliveries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        No deliveries found for selected date and partner
                      </TableCell>
                    </TableRow>
                  ) : (
                    deliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/orders/${delivery.orders.id}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {delivery.orders.order_number}
                          </Link>
                          {(delivery.orders.invoice_number_gst || delivery.orders.invoice_number_non_gst) && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {delivery.orders.invoice_number_gst || delivery.orders.invoice_number_non_gst}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const orderDate = delivery.orders.order_date || delivery.orders.created_at
                            const orderDateStr = orderDate ? new Date(orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-"
                            const isBacklog = orderDate ? new Date(orderDate).toISOString().split('T')[0] < selectedDate : false
                            const daysLate = isBacklog && orderDate
                              ? Math.floor((new Date(selectedDate).getTime() - new Date(new Date(orderDate).toISOString().split('T')[0]).getTime()) / (1000 * 60 * 60 * 24))
                              : 0
                            return (
                              <div>
                                <div className="text-sm">{orderDateStr}</div>
                                {isBacklog && (
                                  <Badge variant="outline" className="text-xs mt-1 border-orange-400 text-orange-600 bg-orange-50">
                                    Backlog ({daysLate}d late)
                                  </Badge>
                                )}
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{delivery.customer?.name || "Unknown"}</div>
                            <div className="text-sm text-muted-foreground">
                              {delivery.customer?.mobile || "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{delivery.routes.route_name}</TableCell>
                        <TableCell>
                          <Badge variant={delivery.status === "delivered" ? "default" : "destructive"}>
                            {delivery.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">
                              Expected: <span className="font-medium">{delivery.orders.payment_method || "Not set"}</span>
                            </div>
                            <div className="text-sm">
                              Collected: {delivery.collected_payment_method ? (
                                <span className={`font-medium ${delivery.orders.payment_method !== delivery.collected_payment_method ? 'text-orange-600' : 'text-green-600'}`}>
                                  {delivery.collected_payment_method}
                                </span>
                              ) : (
                                <span className="text-red-600 font-medium">Not recorded ⚠️</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {delivery.collected_amount ? (
                              <>
                                <div className={`font-medium ${delivery.collected_amount !== delivery.orders.total_amount ? 'text-orange-600' : ''}`}>
                                  ₹{delivery.collected_amount.toFixed(2)}
                                </div>
                                {delivery.collected_amount !== delivery.orders.total_amount && (
                                  <div className="text-xs text-muted-foreground">
                                    Expected: ₹{delivery.orders.total_amount.toFixed(2)}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="font-medium text-red-600">₹0.00 ⚠️</div>
                                <div className="text-xs text-muted-foreground">
                                  Expected: ₹{delivery.orders.total_amount.toFixed(2)}
                                </div>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={verificationStatus[delivery.id] === "verified" ? "default" : "outline"}
                              onClick={() => handleVerifyDelivery(delivery.id, "verified")}
                              disabled={currentReview?.review_status === "completed"}
                              className={verificationStatus[delivery.id] === "verified" ? "bg-green-600 hover:bg-green-700" : ""}
                              title="Mark as verified"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={verificationStatus[delivery.id] === "disputed" ? "destructive" : "outline"}
                              onClick={() => handleVerifyDelivery(delivery.id, "disputed")}
                              disabled={currentReview?.review_status === "completed"}
                              title="Mark as disputed"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDelivery(delivery)
                                setShowDetailsDialog(true)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Details
                            </Button>
                            {(delivery.delivery_proof_url || delivery.customer_signature_url) && (
                              <div className="flex items-center gap-1" title="Has delivery proof/signature">
                                <ImageIcon className="h-3.5 w-3.5 text-green-600" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {deliveries.length > 0 && (
              <div className="border-t p-4">
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleExportReport}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                  {currentReview && currentReview.review_status === "completed" ? (
                    <Button
                      variant="outline"
                      onClick={handleOpenCashDialog}
                      className="border-green-500 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Cash Reconciliation
                    </Button>
                  ) : (
                    <Button
                      onClick={handleOpenCashDialog}
                      disabled={totals.cashDeliveries === 0}
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      Collect Cash ({totals.cashDeliveries} orders)
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* All Orders Tab */}
          <TabsContent value="all-orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  All Orders
                  <Badge variant="outline" className="ml-2 font-normal">
                    {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  All orders assigned to this driver on {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (all statuses)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Order #</TableHead>
                        <TableHead className="w-[110px]">Order Date</TableHead>
                        <TableHead className="min-w-[150px]">Customer</TableHead>
                        <TableHead className="min-w-[120px]">Route</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[120px]">Payment Method</TableHead>
                        <TableHead className="min-w-[100px]">Amount</TableHead>
                        <TableHead className="w-[150px]">Assigned At</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingAllOrders ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            Loading all orders...
                          </TableCell>
                        </TableRow>
                      ) : allOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            No orders found for selected date and partner
                          </TableCell>
                        </TableRow>
                      ) : (
                        allOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Link
                                href={`/dashboard/orders/${order.orders.id}/edit`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                {order.orders.order_number}
                              </Link>
                              {(order.orders.invoice_number_gst || order.orders.invoice_number_non_gst) && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {order.orders.invoice_number_gst || order.orders.invoice_number_non_gst}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const orderDate = order.orders.order_date || order.orders.created_at
                                const orderDateStr = orderDate ? new Date(orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-"
                                const isBacklog = orderDate ? new Date(orderDate).toISOString().split('T')[0] < selectedDate : false
                                const daysLate = isBacklog && orderDate
                                  ? Math.floor((new Date(selectedDate).getTime() - new Date(new Date(orderDate).toISOString().split('T')[0]).getTime()) / (1000 * 60 * 60 * 24))
                                  : 0
                                return (
                                  <div>
                                    <div className="text-sm">{orderDateStr}</div>
                                    {isBacklog && (
                                      <Badge variant="outline" className="text-xs mt-1 border-orange-400 text-orange-600 bg-orange-50">
                                        Backlog ({daysLate}d late)
                                      </Badge>
                                    )}
                                  </div>
                                )
                              })()}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{order.customer?.name || "Unknown"}</div>
                                <div className="text-sm text-muted-foreground">
                                  {order.customer?.mobile || "-"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{order.routes.route_name}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  order.status === "delivered" ? "default" :
                                  order.status === "failed" ? "destructive" :
                                  order.status === "in_transit" ? "secondary" :
                                  "outline"
                                }
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{order.orders.payment_method || "Not set"}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">₹{order.orders.total_amount.toFixed(2)}</span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {order.created_at ? new Date(order.created_at).toLocaleString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              }) : "-"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedDelivery(order)
                                  setShowDetailsDialog(true)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* All Orders Summary */}
                {allOrders.length > 0 && (
                  <div className="border-t p-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground">Total Orders</div>
                        <div className="text-xl font-bold">{allOrders.length}</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-sm text-green-700 dark:text-green-300">Delivered</div>
                        <div className="text-xl font-bold text-green-600">{allOrders.filter(o => o.status === "delivered").length}</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-sm text-red-700 dark:text-red-300">Failed</div>
                        <div className="text-xl font-bold text-red-600">{allOrders.filter(o => o.status === "failed").length}</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">In Transit</div>
                        <div className="text-xl font-bold text-yellow-600">{allOrders.filter(o => o.status === "in_transit").length}</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                        <div className="text-sm text-muted-foreground">Pending</div>
                        <div className="text-xl font-bold">{allOrders.filter(o => !["delivered", "failed", "in_transit"].includes(o.status)).length}</div>
                      </div>
                    </div>
                    <div className="mt-4 text-center p-3 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground">Total Order Value</div>
                      <div className="text-2xl font-bold">₹{allOrders.reduce((sum, o) => sum + o.orders.total_amount, 0).toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Payment Method Summary */}
      {selectedPartner && deliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Summary by Method
              <Badge variant="outline" className="ml-2 font-normal">
                {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Badge>
            </CardTitle>
            <CardDescription>
              Total transactions and amounts collected for each payment method on {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* Cash Summary */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full">
                    <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100">Cash / COD</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Expected Orders:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      {(totals.expectedCountByMethod['cash'] || 0) + (totals.expectedCountByMethod['cod'] || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Expected Amount:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      ₹{((totals.expectedByMethod['cash'] || 0) + (totals.expectedByMethod['cod'] || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-green-200 dark:border-green-700">
                    <span className="text-green-700 dark:text-green-300">Collected Orders:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      {totals.collectedCountByMethod['cash'] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Collected Amount:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      ₹{(totals.collectedByMethod['cash'] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* UPI Summary */}
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-full">
                    <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100">UPI</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-700 dark:text-purple-300">Expected Orders:</span>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      {totals.expectedCountByMethod['upi'] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700 dark:text-purple-300">Expected Amount:</span>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      ₹{(totals.expectedByMethod['upi'] || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-purple-200 dark:border-purple-700">
                    <span className="text-purple-700 dark:text-purple-300">Collected Orders:</span>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      {totals.collectedCountByMethod['upi'] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700 dark:text-purple-300">Collected Amount:</span>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      ₹{(totals.collectedByMethod['upi'] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full">
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Card</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Expected Orders:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {totals.expectedCountByMethod['card'] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Expected Amount:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      ₹{(totals.expectedByMethod['card'] || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-700">
                    <span className="text-blue-700 dark:text-blue-300">Collected Orders:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {totals.collectedCountByMethod['card'] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Collected Amount:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      ₹{(totals.collectedByMethod['card'] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Online/Bank Transfer Summary */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-800 rounded-full">
                    <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-orange-900 dark:text-orange-100">Online / Bank</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Expected Orders:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">
                      {(totals.expectedCountByMethod['online'] || 0) + (totals.expectedCountByMethod['bank'] || 0) + (totals.expectedCountByMethod['bank_transfer'] || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Expected Amount:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">
                      ₹{((totals.expectedByMethod['online'] || 0) + (totals.expectedByMethod['bank'] || 0) + (totals.expectedByMethod['bank_transfer'] || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-orange-200 dark:border-orange-700">
                    <span className="text-orange-700 dark:text-orange-300">Collected Orders:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">
                      {(totals.collectedCountByMethod['online'] || 0) + (totals.collectedCountByMethod['bank'] || 0) + (totals.collectedCountByMethod['bank_transfer'] || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Collected Amount:</span>
                    <span className="font-medium text-orange-900 dark:text-orange-100">
                      ₹{((totals.collectedByMethod['online'] || 0) + (totals.collectedByMethod['bank'] || 0) + (totals.collectedByMethod['bank_transfer'] || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-full">
                    <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100">Balance</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-700 dark:text-amber-300">Expected Orders:</span>
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      {totals.expectedCountByMethod['balance'] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700 dark:text-amber-300">Expected Amount:</span>
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      ₹{(totals.expectedByMethod['balance'] || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-amber-200 dark:border-amber-700">
                    <span className="text-amber-700 dark:text-amber-300">Collected Orders:</span>
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      {totals.collectedCountByMethod['balance'] || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700 dark:text-amber-300">Collected Amount:</span>
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      ₹{(totals.collectedByMethod['balance'] || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="mt-6 bg-muted p-4 rounded-lg">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Expected Orders</div>
                  <div className="text-2xl font-bold">{totals.totalDeliveries}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Expected Amount</div>
                  <div className="text-2xl font-bold">
                    ₹{Object.values(totals.expectedByMethod).reduce((sum, val) => sum + val, 0).toFixed(2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Collected Orders</div>
                  <div className="text-2xl font-bold">
                    {Object.values(totals.collectedCountByMethod).reduce((sum, val) => sum + val, 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Collected Amount</div>
                  <div className="text-2xl font-bold text-green-600">
                    ₹{Object.values(totals.collectedByMethod).reduce((sum, val) => sum + val, 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Collection Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              {currentReview && currentReview.review_status === "completed"
                ? "Cash Reconciliation (Completed)"
                : "Cash Collection & Reconciliation"}
            </DialogTitle>
            <DialogDescription>
              {currentReview && currentReview.review_status === "completed"
                ? "This cash reconciliation has been completed and cannot be edited."
                : `Count and verify cash collected from the delivery partner for ${totals.cashDeliveries} cash/COD order(s)`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">Total Cash Expected (Cash/COD Orders Only)</span>
                <span className="text-2xl font-bold text-green-900 dark:text-green-100">₹{cashForm.total_cash_expected.toFixed(2)}</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="text-green-700 dark:text-green-300">
                  Cash/COD orders breakdown:
                </div>
                {(totals.expectedCountByMethod['cash'] || 0) > 0 && (
                  <div className="flex justify-between text-xs text-green-800 dark:text-green-200">
                    <span>Cash:</span>
                    <span>{totals.expectedCountByMethod['cash']} order(s) - ₹{(totals.expectedByMethod['cash'] || 0).toFixed(2)}</span>
                  </div>
                )}
                {(totals.expectedCountByMethod['cod'] || 0) > 0 && (
                  <div className="flex justify-between text-xs text-green-800 dark:text-green-200">
                    <span>COD:</span>
                    <span>{totals.expectedCountByMethod['cod']} order(s) - ₹{(totals.expectedByMethod['cod'] || 0).toFixed(2)}</span>
                  </div>
                )}
                {totals.cashDeliveries === 0 && (
                  <div className="text-xs text-green-700 dark:text-green-300">No cash/COD orders for this date</div>
                )}
              </div>
              {totals.actualCashDeliveries !== totals.cashDeliveries && totals.cashDeliveries > 0 && (
                <div className="text-sm text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/30 p-2 rounded">
                  ⚠️ Warning: Only {totals.actualCashDeliveries} of {totals.cashDeliveries} cash order(s) have cash collection recorded by driver
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Count Denominations
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="notes_2000">₹2000 Notes</Label>
                  <Input
                    id="notes_2000"
                    type="number"
                    min="0"
                    value={cashForm.notes_2000}
                    onChange={(e) => setCashForm(prev => ({ ...prev, notes_2000: parseInt(e.target.value) || 0 }))}
                    disabled={currentReview?.review_status === "completed"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes_500">₹500 Notes</Label>
                  <Input
                    id="notes_500"
                    type="number"
                    min="0"
                    value={cashForm.notes_500}
                    onChange={(e) => setCashForm(prev => ({ ...prev, notes_500: parseInt(e.target.value) || 0 }))}
                    disabled={currentReview?.review_status === "completed"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes_200">₹200 Notes</Label>
                  <Input
                    id="notes_200"
                    type="number"
                    min="0"
                    value={cashForm.notes_200}
                    onChange={(e) => setCashForm(prev => ({ ...prev, notes_200: parseInt(e.target.value) || 0 }))}
                    disabled={currentReview?.review_status === "completed"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes_100">₹100 Notes</Label>
                  <Input
                    id="notes_100"
                    type="number"
                    min="0"
                    value={cashForm.notes_100}
                    onChange={(e) => setCashForm(prev => ({ ...prev, notes_100: parseInt(e.target.value) || 0 }))}
                    disabled={currentReview?.review_status === "completed"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes_50">₹50 Notes</Label>
                  <Input
                    id="notes_50"
                    type="number"
                    min="0"
                    value={cashForm.notes_50}
                    onChange={(e) => setCashForm(prev => ({ ...prev, notes_50: parseInt(e.target.value) || 0 }))}
                    disabled={currentReview?.review_status === "completed"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes_20">₹20 Notes</Label>
                  <Input
                    id="notes_20"
                    type="number"
                    min="0"
                    value={cashForm.notes_20}
                    onChange={(e) => setCashForm(prev => ({ ...prev, notes_20: parseInt(e.target.value) || 0 }))}
                    disabled={currentReview?.review_status === "completed"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes_10">₹10 Notes</Label>
                  <Input
                    id="notes_10"
                    type="number"
                    min="0"
                    value={cashForm.notes_10}
                    onChange={(e) => setCashForm(prev => ({ ...prev, notes_10: parseInt(e.target.value) || 0 }))}
                    disabled={currentReview?.review_status === "completed"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coins_total">Coins Total (₹)</Label>
                  <Input
                    id="coins_total"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashForm.coins_total}
                    onChange={(e) => setCashForm(prev => ({ ...prev, coins_total: parseFloat(e.target.value) || 0 }))}
                    disabled={currentReview?.review_status === "completed"}
                  />
                </div>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                Reconciliation Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Cash Submitted:</span>
                  <span className="font-bold text-lg">₹{calculateCashTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Expected Cash:</span>
                  <span className="font-bold text-lg">₹{cashForm.total_cash_expected.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold">Difference:</span>
                  <span className={`font-bold text-lg ${Math.abs(cashForm.total_cash_expected - calculateCashTotal()) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                    ₹{(cashForm.total_cash_expected - calculateCashTotal()).toFixed(2)}
                    {Math.abs(cashForm.total_cash_expected - calculateCashTotal()) < 0.01 && " ✓"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review_notes">Review Notes</Label>
              <Textarea
                id="review_notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about discrepancies or issues..."
                rows={3}
                disabled={currentReview?.review_status === "completed"}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCashDialog(false)}>
              Close
            </Button>
            {currentReview?.review_status !== "completed" && (
              <Button onClick={handleSubmitCashReconciliation} disabled={loading}>
                {loading ? (
                  <>
                    <Calculator className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Reconciliation
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery Details</DialogTitle>
            <DialogDescription>
              Order #{selectedDelivery?.orders.order_number}
            </DialogDescription>
          </DialogHeader>

          {selectedDelivery && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h4>
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{selectedDelivery.customer?.name || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mobile:</span>
                    <span className="font-medium">{selectedDelivery.customer?.mobile || "-"}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-muted-foreground mb-1">Address:</div>
                    <div className="font-medium">{selectedDelivery.orders.shipping_full_address}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Order Items
                </h4>
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  {selectedDelivery.orders.order_items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span>{item.product_name} <span className="text-muted-foreground">× {item.quantity}</span></span>
                      <span className="font-medium">₹{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t flex justify-between items-center font-semibold">
                    <span>Total:</span>
                    <span className="text-lg">₹{selectedDelivery.orders.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Delivery Information
                </h4>
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={selectedDelivery.status === "delivered" ? "default" : "destructive"}>
                      {selectedDelivery.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivered At:</span>
                    <span className="font-medium">
                      {selectedDelivery.delivery_time ? new Date(selectedDelivery.delivery_time).toLocaleString() : "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Information
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
                    <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">Expected from Order</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-blue-700 dark:text-blue-300">Payment Method:</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">{selectedDelivery.orders.payment_method || "Not specified"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700 dark:text-blue-300">Amount:</span>
                        <span className="font-medium text-blue-900 dark:text-blue-100">₹{selectedDelivery.orders.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedDelivery.collected_payment_method ? (
                    <div className={`border p-3 rounded-lg ${
                      selectedDelivery.orders.payment_method === selectedDelivery.collected_payment_method &&
                      selectedDelivery.collected_amount === selectedDelivery.orders.total_amount
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                    }`}>
                      <div className={`font-medium mb-2 ${
                        selectedDelivery.orders.payment_method === selectedDelivery.collected_payment_method &&
                        selectedDelivery.collected_amount === selectedDelivery.orders.total_amount
                          ? 'text-green-900 dark:text-green-100'
                          : 'text-orange-900 dark:text-orange-100'
                      }`}>
                        {selectedDelivery.orders.payment_method === selectedDelivery.collected_payment_method &&
                         selectedDelivery.collected_amount === selectedDelivery.orders.total_amount
                          ? '✓ Payment Collected (Matches Expected)'
                          : '⚠️ Payment Collected (Discrepancy)'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className={
                            selectedDelivery.orders.payment_method === selectedDelivery.collected_payment_method &&
                            selectedDelivery.collected_amount === selectedDelivery.orders.total_amount
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-orange-700 dark:text-orange-300'
                          }>Method:</span>
                          <span className={`font-medium ${
                            selectedDelivery.orders.payment_method === selectedDelivery.collected_payment_method &&
                            selectedDelivery.collected_amount === selectedDelivery.orders.total_amount
                              ? 'text-green-900 dark:text-green-100'
                              : 'text-orange-900 dark:text-orange-100'
                          }`}>{selectedDelivery.collected_payment_method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={
                            selectedDelivery.orders.payment_method === selectedDelivery.collected_payment_method &&
                            selectedDelivery.collected_amount === selectedDelivery.orders.total_amount
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-orange-700 dark:text-orange-300'
                          }>Amount:</span>
                          <span className={`font-medium ${
                            selectedDelivery.orders.payment_method === selectedDelivery.collected_payment_method &&
                            selectedDelivery.collected_amount === selectedDelivery.orders.total_amount
                              ? 'text-green-900 dark:text-green-100'
                              : 'text-orange-900 dark:text-orange-100'
                          }`}>₹{(selectedDelivery.collected_amount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      {(selectedDelivery.orders.payment_method !== selectedDelivery.collected_payment_method ||
                        selectedDelivery.collected_amount !== selectedDelivery.orders.total_amount) && (
                        <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800 space-y-1 text-xs">
                          {selectedDelivery.orders.payment_method !== selectedDelivery.collected_payment_method && (
                            <div className="text-orange-700 dark:text-orange-300">
                              • Payment method changed from {selectedDelivery.orders.payment_method} to {selectedDelivery.collected_payment_method}
                            </div>
                          )}
                          {selectedDelivery.collected_amount !== selectedDelivery.orders.total_amount && (
                            <div className="text-orange-700 dark:text-orange-300">
                              • Amount difference: ₹{Math.abs(selectedDelivery.orders.total_amount - (selectedDelivery.collected_amount || 0)).toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="font-medium text-red-900 dark:text-red-100 mb-2">⚠️ Payment Not Recorded</div>
                      <div className="text-red-700 dark:text-red-300">
                        The driver did not record payment collection for this delivery.
                        Expected ₹{selectedDelivery.orders.total_amount.toFixed(2)} via {selectedDelivery.orders.payment_method || "unspecified method"}.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(selectedDelivery.delivery_proof_url || selectedDelivery.customer_signature_url || selectedDelivery.delivery_notes) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Delivery Proof & Notes
                  </h4>
                  <div className="space-y-3">
                    {selectedDelivery.delivery_notes && (
                      <div className="bg-muted p-3 rounded-lg">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Delivery Notes</div>
                        <div className="text-sm">{selectedDelivery.delivery_notes}</div>
                      </div>
                    )}

                    {selectedDelivery.delivery_proof_url && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Delivery Proof Photo</div>
                        <div className="relative group">
                          <img
                            src={selectedDelivery.delivery_proof_url}
                            alt="Delivery Proof"
                            className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(selectedDelivery.delivery_proof_url, '_blank')}
                          />
                          <div className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedDelivery.customer_signature_url && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Customer Signature</div>
                        <div className="relative group">
                          <img
                            src={selectedDelivery.customer_signature_url}
                            alt="Customer Signature"
                            className="w-full h-32 object-contain bg-white rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(selectedDelivery.customer_signature_url, '_blank')}
                          />
                          <div className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}