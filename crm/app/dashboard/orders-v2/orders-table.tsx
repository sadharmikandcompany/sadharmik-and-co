"use client"

import React, { useEffect, useState, useTransition, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Plus, X, ExternalLink, ChevronDown, Edit, Download,
  XCircle, Truck, CheckCircle, MoreVertical, Users, Printer, UserCheck,
  AlertTriangle, DollarSign, Trash2, Star, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, QrCode, Copy, Loader2, Store, Globe,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"
import {
  generateOrderInvoice, generateBulkOrderInvoices,
  generateThermalReceipt, generateBulkThermalReceipts,
  FACTORY_COMPANY_INFO,
} from "@/lib/invoice-generator"
import { totalKgForItems, kgForItem } from "@/lib/product-weight"

// ─── Types ──────────────────────────────────────────────────────────────────

type Order = {
  id: string
  order_number: string
  customer_id: string | null
  distributor_id?: string | null
  retailer_id?: string | null
  is_distributor?: boolean
  is_subdistributor?: boolean
  order_status: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  subtotal?: number
  discount_amount?: number
  cgst_amount?: number
  sgst_amount?: number
  igst_amount?: number
  shipping_charges?: number
  shipping_full_address: string | null
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  is_priority: boolean
  order_date: string
  created_at: string
  invoice_number_gst?: string | null
  invoice_number_non_gst?: string | null
  invoice_number?: string | null
  is_gst_invoice?: boolean
  delivery_partner_id?: string | null
  assigned_to_delivery_at?: string | null
  delivery_status?: string | null
  failed_at?: string | null
  failure_reason?: string | null
  failed_attempts?: number
  next_delivery_at?: string | null
  source?: string
  created_by_agent_name?: string | null
  transaction_id?: string | null
  order_notes?: string | null
  customer_notes?: string | null
  internal_notes?: string | null
  cod_collected_amount?: string | null
  cod_payment_method?: string | null
  delivery_proof_url?: string | null
  delivered_date?: string | null
  shipped_date?: string | null
  expected_delivery_date?: string | null
  shipping_method?: string | null
  tracking_number?: string | null
  courier_partner?: string | null
  // Enriched from view
  customer_name?: string
  customer_phone?: string
  customer_phone_secondary_1?: string | null
  customer_phone_secondary_2?: string | null
  customer_whatsapp?: string | null
  customer_full_address?: string
  customer_vip_number?: string | null
  customer_mandir_number?: string | null
  customer_shop_number?: string | null
  customer_email?: string | null
  customer_company_name?: string | null
  customer_gst_number?: string | null
  delivery_partner_name?: string | null
  delivery_partner_mobile?: string | null
  route_assignment_status?: string | null
  pickup_time?: string | null
  delivery_time?: string | null
  delivery_notes?: string | null
  collected_payment_method?: string | null
  collected_amount?: number | null
  customer_rating?: number | null
  customer_feedback?: string | null
  route_name?: string | null
  serviceable_distributor_id?: string | null
  serviceable_distributor_name?: string | null
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
  product_id: string | null
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

type Filters = {
  search: string
  orderStatus: string
  deliveryStatus: string
  paymentMethod: string
  distributorId: string
  deliveryPartnerId: string
  dateFrom: string
  dateTo: string
  amountFrom: string
  amountTo: string
  hideRetailer: string
  websiteOnly: string
}

type OrdersTableProps = {
  initialOrders: Order[]
  totalCount: number
  currentPage: number
  pageSize: number
  deliveryPartners: DeliveryPartner[]
  distributors: Array<{ id: string; name: string }>
  filters: Filters
  error?: string
}

const kgFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 })

// "Kg" column cell — total weight on the bill, from each product's own
// net_weight_grams (set on the Products page), not a Ghee/Oil split like the
// old liters version — khakhra doesn't have that category distinction.
function renderBillKg(totalKg: number | undefined) {
  if (!totalKg || totalKg <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return <span className="font-medium">{kgFormatter.format(totalKg)} Kg</span>
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OrdersTable({
  initialOrders,
  totalCount,
  currentPage,
  pageSize,
  deliveryPartners,
  distributors,
  filters,
  error,
}: OrdersTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Local interactive state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null)

  // Per-bill total weight (kg), shown in the "Kg" column — unlike
  // `orderItems` above (lazy, only fetched on row expand), this is fetched
  // eagerly in one batched query for every order on the current page, since
  // the column needs to show a value for every row without expanding it.
  const [orderKg, setOrderKg] = useState<Record<string, number>>({})
  // product_id -> net_weight_grams, populated alongside orderKg above and
  // reused by the expanded per-item rows below (same page of orders, so
  // every product that can appear there is already covered).
  const [productWeights, setProductWeights] = useState<Record<string, number | null>>({})

  useEffect(() => {
    const orderIds = initialOrders.map((o) => o.id)
    if (orderIds.length === 0) {
      setOrderKg({})
      return
    }
    let cancelled = false
    supabase
      .from("order_items")
      .select("order_id, product_id, quantity")
      .in("order_id", orderIds)
      .then(async ({ data, error }) => {
        if (cancelled || error) {
          if (error) console.error("Error fetching order items for Kg column:", error)
          return
        }
        const byOrder: Record<string, { product_id: string | null; quantity: number }[]> = {}
        const productIds = new Set<string>()
        ;(data || []).forEach((row: any) => {
          if (!byOrder[row.order_id]) byOrder[row.order_id] = []
          byOrder[row.order_id].push({ product_id: row.product_id, quantity: row.quantity })
          if (row.product_id) productIds.add(row.product_id)
        })

        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("id, net_weight_grams")
          .in("id", Array.from(productIds))
        if (cancelled) return
        if (productsError) {
          console.error("Error fetching product weights for Kg column:", productsError)
          return
        }
        const weightByProductId: Record<string, number | null> = {}
        ;(productsData || []).forEach((p: any) => {
          weightByProductId[p.id] = p.net_weight_grams
        })
        setProductWeights(weightByProductId)

        const kgMap: Record<string, number> = {}
        Object.entries(byOrder).forEach(([orderId, items]) => {
          kgMap[orderId] = totalKgForItems(items, weightByProductId)
        })
        setOrderKg(kgMap)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrders.map((o) => o.id).join(",")])

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingOrder, setDeletingOrder] = useState<{ id: string; orderNumber: string } | null>(null)
  const [bulkDeliveryDialogOpen, setBulkDeliveryDialogOpen] = useState(false)
  const [bulkCompleteDialogOpen, setBulkCompleteDialogOpen] = useState(false)
  const [bulkCompletePaymentMethod, setBulkCompletePaymentMethod] = useState("cash")

  // Loading states for bulk operations
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false)
  const [bulkThermalPrintLoading, setBulkThermalPrintLoading] = useState(false)
  const [bulkDeliveredLoading, setBulkDeliveredLoading] = useState(false)
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false)

  // Export: use current page data (increase page size for larger exports)

  // Local search input (debounced before updating URL)
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Not URL-persisted (unlike the rest of `filters`) — purely cosmetic label
  // state for the date preset dropdown. The actual dateFrom/dateTo strings it
  // resolves to ARE persisted via updateParams like every other filter, so
  // filtering still works correctly across reloads; only the preset LABEL
  // itself falls back to "Custom" after a refresh instead of e.g. "This Month".
  const [datePreset, setDatePreset] = useState<DatePreset>(
    filters.dateFrom || filters.dateTo ? "custom" : "all"
  )

  // ─── URL-based filter management ────────────────────────────────────────

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all" || value === "") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      // Reset to page 1 when filters change (unless updating page itself)
      if (!("page" in updates)) {
        params.delete("page")
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [searchParams, pathname, router, startTransition]
  )

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      updateParams({ search: value })
    }, 400)
  }

  const clearFilters = () => {
    setSearchInput("")
    setDatePreset("all")
    startTransition(() => {
      router.push(pathname)
    })
  }

  const hasActiveFilters =
    filters.search || filters.orderStatus !== "all" || filters.deliveryStatus !== "all" ||
    filters.paymentMethod !== "all" || filters.distributorId !== "all" ||
    filters.deliveryPartnerId !== "all" || filters.dateFrom || filters.dateTo ||
    filters.amountFrom || filters.amountTo || filters.hideRetailer || filters.websiteOnly

  // ─── Pagination ─────────────────────────────────────────────────────────

  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalCount)

  const setPage = (p: number) => updateParams({ page: String(p) })
  const setPageSize = (size: string) => updateParams({ pageSize: size, page: "1" })

  // ─── Row expansion ─────────────────────────────────────────────────────

  const fetchOrderItems = async (orderId: string) => {
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
    if (!error && data) {
      setOrderItems((prev) => ({ ...prev, [orderId]: data }))
    }
  }

  const toggleRowExpansion = async (orderId: string) => {
    const next = new Set(expandedRows)
    if (next.has(orderId)) {
      next.delete(orderId)
    } else {
      next.add(orderId)
      if (!orderItems[orderId]) await fetchOrderItems(orderId)
    }
    setExpandedRows(next)
  }

  // ─── Mutation helpers ───────────────────────────────────────────────────

  const refresh = () => startTransition(() => router.refresh())

  // ─── Single-order actions ───────────────────────────────────────────────

  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    const { error } = await supabase.from("orders").update({ order_status: "cancelled" }).eq("id", orderId)
    if (error) { toast.error("Failed to cancel order"); return }
    toast.success(`Order ${orderNumber} cancelled`)
    refresh()
  }

  const handleMarkAsDelivered = async (orderId: string, orderNumber: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ order_status: "delivered", delivery_status: "delivered", delivered_date: new Date().toISOString() })
      .eq("id", orderId)
    if (error) { toast.error("Failed to mark as delivered"); return }
    toast.success(`Order ${orderNumber} marked as delivered`)
    refresh()
  }

  const handleCompleteOrder = async (orderId: string, orderNumber: string) => {
    const { error } = await supabase
      .from("orders")
      .update({
        order_status: "delivered", payment_status: "completed",
        delivery_status: "delivered", delivered_date: new Date().toISOString(),
      })
      .eq("id", orderId)
    if (error) { toast.error("Failed to complete order"); return }
    toast.success(`Order ${orderNumber} completed`)
    refresh()
  }

  const handleAssignDriver = async (orderId: string, driverId: string, orderNumber: string) => {
    try {
      setAssigningDriver(orderId)
      const order = initialOrders.find((o) => o.id === orderId)
      if (!order) return
      const driver = deliveryPartners.find((d) => d.id === driverId)

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          delivery_partner_id: driverId,
          assigned_to_delivery_at: new Date().toISOString(),
          delivery_status: "assigned",
          order_status: order.order_status === "pending" ? "processing" : order.order_status,
        })
        .eq("id", orderId)
      if (updateError) throw updateError

      // Try to assign to a route
      try {
        const { data: routes } = await supabase.from("routes").select("id, route_name, pincodes").eq("is_active", true)
        const matchingRoute = routes?.find(
          (route: any) => route.pincodes && Array.isArray(route.pincodes) && route.pincodes.includes(order.shipping_pincode)
        )
        if (matchingRoute) {
          const { data: existingAssignments } = await supabase
            .from("route_assignments").select("sequence_number")
            .eq("route_id", matchingRoute.id).order("sequence_number", { ascending: false }).limit(1)
          const nextSequence = existingAssignments?.[0]?.sequence_number ? existingAssignments[0].sequence_number + 1 : 1
          await supabase.from("route_assignments").insert({
            route_id: matchingRoute.id, order_id: orderId, delivery_partner_id: driverId,
            status: "assigned", sequence_number: nextSequence, assignment_date: new Date().toISOString(),
          })
          toast.success(`Order ${orderNumber} assigned to ${driver?.name || "driver"} on route ${matchingRoute.route_name}`)
        } else {
          toast.success(`Order ${orderNumber} assigned to ${driver?.name || "driver"}`)
        }
      } catch {
        toast.success(`Order ${orderNumber} assigned to ${driver?.name || "driver"} (route skipped)`)
      }
      refresh()
    } catch {
      toast.error("Failed to assign driver")
    } finally {
      setAssigningDriver(null)
    }
  }

  const handleUnassignDriver = async (orderId: string, orderNumber: string) => {
    try {
      setAssigningDriver(orderId)
      const order = initialOrders.find((o) => o.id === orderId)
      await supabase.from("route_assignments").delete().eq("order_id", orderId)
      const { error } = await supabase
        .from("orders")
        .update({
          delivery_partner_id: null, assigned_to_delivery_at: null, delivery_status: "not_assigned",
          order_status: order?.order_status === "processing" ? "pending" : order?.order_status,
        })
        .eq("id", orderId)
      if (error) throw error
      toast.success(`Driver unassigned from order ${orderNumber}`)
      refresh()
    } catch {
      toast.error("Failed to unassign driver")
    } finally {
      setAssigningDriver(null)
    }
  }

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return
    try {
      await supabase.from("route_assignments").delete().eq("order_id", deletingOrder.id)
      const { error: itemsError } = await supabase.from("order_items").delete().eq("order_id", deletingOrder.id)
      if (itemsError) throw itemsError
      const { error: orderError } = await supabase.from("orders").delete().eq("id", deletingOrder.id)
      if (orderError) throw orderError
      toast.success(`Order ${deletingOrder.orderNumber} deleted`)
      setDeleteDialogOpen(false)
      setDeletingOrder(null)
      refresh()
    } catch {
      toast.error("Failed to delete order")
    }
  }

  // ─── Invoice & Print helpers ─────────────────────────────────────────────

  const fetchDistributorCompanyInfo = async (shippingPincode: string) => {
    try {
      const { data: distributorsData } = await supabase
        .from("distributors")
        .select("company_name, name, email, phone_primary, gst_number, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode, bank_name, bank_account_number, bank_ifsc_code, bank_branch, serviceable_pincodes")
        .not("serviceable_pincodes", "is", null)
      if (distributorsData) {
        const match = distributorsData.find((dist: any) =>
          dist.serviceable_pincodes?.includes(shippingPincode)
        )
        if (match) {
          const address = [match.shipping_address_line1, match.shipping_address_line2].filter(Boolean).join(", ")
          return {
            name: match.company_name || match.name, address, city: match.shipping_city || "",
            pincode: match.shipping_pincode || "", phone: match.phone_primary || "",
            email: match.email || "", gst: match.gst_number || "",
            state: match.shipping_state ? `${match.shipping_pincode?.substring(0, 2) || ""}-${match.shipping_state}` : "",
            bankName: match.bank_name || "", accountNumber: match.bank_account_number || "",
            ifscCode: match.bank_ifsc_code || "", branch: match.bank_branch || "",
          }
        }
      }
    } catch { /* ignore */ }
    return undefined
  }

  const buildInvoiceData = async (orderId: string) => {
    const { data: orderData, error: orderError } = await supabase.from("orders").select("*").eq("id", orderId).single()
    if (orderError) throw orderError

    // Orders placed for a distributor (e.g. Order from Factory) have
    // distributor_id set and customer_id null — fetch from whichever party
    // this order actually belongs to instead of assuming it's always a customer.
    let customerData: any
    if (orderData.customer_id) {
      const { data, error } = await supabase.from("customers").select("*").eq("id", orderData.customer_id).single()
      if (error) throw error
      customerData = data
    } else if (orderData.distributor_id) {
      const { data, error } = await supabase.from("distributors").select("*").eq("id", orderData.distributor_id).single()
      if (error) throw error
      customerData = {
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
    } else {
      throw new Error("This order has no linked customer or distributor")
    }

    const { data: itemsData, error: itemsError } = await supabase.from("order_items").select("*").eq("order_id", orderId)
    if (itemsError) throw itemsError
    // Factory-supplied orders are always sold by the factory itself, never
    // by whichever distributor happens to service this shipping pincode.
    const companyInfo = orderData.is_factory_order
      ? FACTORY_COMPANY_INFO
      : orderData.shipping_pincode
        ? await fetchDistributorCompanyInfo(orderData.shipping_pincode)
        : undefined

    return {
      order: {
        id: orderData.id, order_number: orderData.order_number,
        invoice_number_gst: orderData.invoice_number_gst, invoice_number_non_gst: orderData.invoice_number_non_gst,
        is_gst_invoice: orderData.is_gst_invoice, order_date: orderData.order_date,
        order_status: orderData.order_status, payment_status: orderData.payment_status,
        payment_method: orderData.payment_method || "Not specified",
        subtotal: orderData.subtotal, discount_amount: orderData.discount_amount,
        cgst_amount: orderData.cgst_amount, sgst_amount: orderData.sgst_amount,
        igst_amount: orderData.igst_amount, shipping_charges: orderData.shipping_charges,
        total_amount: orderData.total_amount,
        shipping_room_number: orderData.shipping_room_number || undefined,
        shipping_floor: orderData.shipping_floor || undefined,
        shipping_wing: orderData.shipping_wing || undefined,
        shipping_flat_number: orderData.shipping_flat_number || undefined,
        shipping_floor_wing: orderData.shipping_floor_wing || undefined,
        shipping_building_name: orderData.shipping_building_name,
        shipping_street_area: orderData.shipping_street_area,
        shipping_landmark: orderData.shipping_landmark || undefined,
        shipping_city: orderData.shipping_city, shipping_state: orderData.shipping_state,
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
        billing_city: orderData.billing_city, billing_state: orderData.billing_state,
        billing_pincode: orderData.billing_pincode,
        billing_country: orderData.billing_country || undefined,
      },
      customer: {
        first_name: customerData.first_name, last_name: customerData.last_name,
        email: customerData.email || undefined, mobile_primary: customerData.mobile_primary,
        mobile_secondary_1: customerData.mobile_secondary_1 || undefined,
        mobile_secondary_2: customerData.mobile_secondary_2 || undefined,
        whatsapp_number: customerData.whatsapp_same_as_primary ? undefined : (customerData.whatsapp_number || undefined),
        company_name: customerData.company_name || undefined,
        gst_number: customerData.gst_number || undefined,
        full_address: customerData.full_address || undefined,
        vip_number: customerData.vip_number || undefined,
      },
      items: itemsData.map((item: any) => ({
        product_name: item.product_name, product_sku: item.product_sku || undefined,
        quantity: item.quantity, unit_price: item.unit_price,
        discount_percent: item.discount_percent, discount_amount: item.discount_amount,
        gst_percentage: item.gst_percentage, cgst_amount: item.cgst_amount,
        sgst_amount: item.sgst_amount, igst_amount: item.igst_amount,
        total: item.total, hsn_code: item.hsn_code || undefined,
        item_description: item.item_description || undefined,
      })),
      companyInfo,
      customerName: `${customerData.first_name} ${customerData.last_name}`,
    }
  }

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const data = await buildInvoiceData(orderId)
      generateOrderInvoice(data)
      toast.success("Invoice downloaded")
    } catch {
      toast.error("Failed to download invoice")
    }
  }

  const handleDownloadThermalReceipt = async (orderId: string) => {
    try {
      const data = await buildInvoiceData(orderId)
      const paymentQrUrl = `${window.location.origin}/order/${data.order.order_number}`
      await generateThermalReceipt(data, data.customerName!, paymentQrUrl)
      toast.success("Thermal receipt downloaded")
    } catch {
      toast.error("Failed to download thermal receipt")
    }
  }

  // ─── Bulk operations ────────────────────────────────────────────────────

  const handleBulkPrintInvoices = async () => {
    if (selectedOrders.size === 0) return
    try {
      setBulkPrintLoading(true)
      toast.loading(`Generating ${selectedOrders.size} invoices...`)
      const invoicesData = []
      const failedOrders: string[] = []
      for (const orderId of Array.from(selectedOrders)) {
        try {
          invoicesData.push(await buildInvoiceData(orderId))
        } catch {
          const o = initialOrders.find((o) => o.id === orderId)
          if (o) failedOrders.push(o.order_number)
        }
      }
      toast.dismiss()
      if (invoicesData.length === 0) { toast.error("Failed to fetch data for all selected orders"); return }
      generateBulkOrderInvoices(invoicesData)
      if (failedOrders.length > 0) toast.warning(`Generated ${invoicesData.length} invoices. Failed: ${failedOrders.join(", ")}`)
      else toast.success(`Generated ${invoicesData.length} invoices`)
      setSelectedOrders(new Set())
    } catch {
      toast.dismiss()
      toast.error("Failed to generate bulk invoices")
    } finally {
      setBulkPrintLoading(false)
    }
  }

  const handleBulkThermalPrint = async () => {
    if (selectedOrders.size === 0) return
    try {
      setBulkThermalPrintLoading(true)
      toast.loading(`Generating ${selectedOrders.size} thermal receipts...`)
      const thermalData: Array<{ data: any; customerName?: string; paymentQrUrl?: string }> = []
      const failedOrders: string[] = []
      for (const orderId of Array.from(selectedOrders)) {
        try {
          const data = await buildInvoiceData(orderId)
          const paymentQrUrl = `${window.location.origin}/order/${data.order.order_number}`
          thermalData.push({ data, customerName: data.customerName, paymentQrUrl })
        } catch {
          const o = initialOrders.find((o) => o.id === orderId)
          if (o) failedOrders.push(o.order_number)
        }
      }
      toast.dismiss()
      if (thermalData.length === 0) { toast.error("Failed to fetch data"); return }
      await generateBulkThermalReceipts(thermalData)
      if (failedOrders.length > 0) toast.warning(`Generated ${thermalData.length} thermal receipts. Failed: ${failedOrders.join(", ")}`)
      else toast.success(`Generated ${thermalData.length} thermal receipts`)
      setSelectedOrders(new Set())
    } catch {
      toast.dismiss()
      toast.error("Failed to generate bulk thermal receipts")
    } finally {
      setBulkThermalPrintLoading(false)
    }
  }

  const confirmBulkMarkAsDelivered = () => {
    if (selectedOrders.size === 0) return
    const eligible = initialOrders.filter((o) => selectedOrders.has(o.id) && o.order_status !== "delivered" && o.order_status !== "cancelled")
    if (eligible.length === 0) { toast.error("No eligible orders"); return }
    setBulkDeliveryDialogOpen(true)
  }

  const handleBulkMarkAsDelivered = async () => {
    setBulkDeliveryDialogOpen(false)
    try {
      setBulkDeliveredLoading(true)
      const ordersToUpdate = initialOrders.filter((o) => selectedOrders.has(o.id) && o.order_status !== "delivered" && o.order_status !== "cancelled")
      const ids = ordersToUpdate.map((o) => o.id)
      const now = new Date().toISOString()
      toast.loading(`Marking ${ordersToUpdate.length} orders as delivered...`)
      const { error } = await supabase.from("orders").update({ order_status: "delivered", delivery_status: "delivered", delivered_date: now }).in("id", ids)
      if (error) throw error
      await supabase.from("route_assignments").update({ status: "delivered", delivery_time: now }).in("order_id", ids).then(() => {})
      toast.dismiss()
      toast.success(`Marked ${ordersToUpdate.length} order${ordersToUpdate.length > 1 ? "s" : ""} as delivered`)
      setSelectedOrders(new Set())
      refresh()
    } catch {
      toast.dismiss()
      toast.error("Failed to mark orders as delivered")
    } finally {
      setBulkDeliveredLoading(false)
    }
  }

  const confirmBulkComplete = () => {
    if (selectedOrders.size === 0) return
    const eligible = initialOrders.filter((o) => selectedOrders.has(o.id) && o.order_status !== "completed" && o.order_status !== "cancelled")
    if (eligible.length === 0) { toast.error("No eligible orders"); return }
    setBulkCompletePaymentMethod("cash")
    setBulkCompleteDialogOpen(true)
  }

  const handleBulkComplete = async () => {
    setBulkCompleteDialogOpen(false)
    try {
      setBulkCompleteLoading(true)
      const ordersToUpdate = initialOrders.filter((o) => selectedOrders.has(o.id) && o.order_status !== "completed" && o.order_status !== "cancelled")
      const ids = ordersToUpdate.map((o) => o.id)
      const now = new Date().toISOString()
      toast.loading(`Completing ${ordersToUpdate.length} orders...`)
      const { error } = await supabase.from("orders").update({
        order_status: "delivered", payment_status: "completed", payment_method: bulkCompletePaymentMethod,
        delivery_status: "delivered", delivered_date: now,
      }).in("id", ids)
      if (error) throw error
      for (const orderId of ids) {
        const orderAmount = ordersToUpdate.find((o) => o.id === orderId)?.total_amount || 0
        await supabase.from("route_assignments").update({
          status: "delivered", delivery_time: now, collected_payment_method: bulkCompletePaymentMethod, collected_amount: orderAmount,
        }).eq("order_id", orderId)
      }
      toast.dismiss()
      toast.success(`Completed ${ordersToUpdate.length} order${ordersToUpdate.length > 1 ? "s" : ""} with ${bulkCompletePaymentMethod.replace(/_/g, " ")}`)
      setSelectedOrders(new Set())
      refresh()
    } catch {
      toast.dismiss()
      toast.error("Failed to complete orders")
    } finally {
      setBulkCompleteLoading(false)
    }
  }

  // ─── Export data (current page) ──────────────────────────────────────

  const currentExportData = initialOrders.map((order) => ({
    "Order Number": order.order_number,
    Source: order.source || "",
    "Created By": order.created_by_agent_name || "",
    Customer: order.customer_name || "Unknown",
    Phone: order.customer_phone || "",
    "Sd Number": order.customer_vip_number || "",
    "Mandir Number": order.customer_mandir_number || "",
    "Shop Number": order.customer_shop_number || "",
    Address: order.customer_full_address || "",
    "Shipping Address": order.shipping_full_address || `${order.shipping_city}, ${order.shipping_state}`,
    Pincode: order.shipping_pincode || "",
    Distributor: order.serviceable_distributor_name || "",
    Amount: `₹${order.total_amount.toFixed(2)}`,
    "Order Status": order.order_status,
    "Payment Status": order.payment_status,
    "Payment Method": order.payment_method ? order.payment_method.replace(/_/g, " ") : "",
    "Invoice GST": order.invoice_number_gst || order.invoice_number || "",
    "Invoice Non-GST": order.invoice_number_non_gst || order.invoice_number || "",
    "Delivery Driver": order.delivery_partner_name || "Not assigned",
    "Delivery Status": order.route_assignment_status ? order.route_assignment_status.replace(/_/g, " ") : order.delivery_partner_id ? "Assigned" : "Not assigned",
    "Order Date": format(new Date(order.order_date || order.created_at), "PPP"),
  }))

  const exportColumns = [
    { header: "Order #", dataKey: "Order Number" }, { header: "Source", dataKey: "Source" },
    { header: "Customer", dataKey: "Customer" }, { header: "Phone", dataKey: "Phone" },
    { header: "Sd", dataKey: "Sd Number" }, { header: "Mandir", dataKey: "Mandir Number" },
    { header: "Shop", dataKey: "Shop Number" }, { header: "Address", dataKey: "Address" },
    { header: "Shipping", dataKey: "Shipping Address" }, { header: "Pincode", dataKey: "Pincode" },
    { header: "Distributor", dataKey: "Distributor" }, { header: "Items", dataKey: "Items" },
    { header: "Qty", dataKey: "Total Qty" }, { header: "Subtotal", dataKey: "Subtotal" },
    { header: "Amount", dataKey: "Amount" }, { header: "Status", dataKey: "Order Status" },
    { header: "Payment", dataKey: "Payment Status" }, { header: "Method", dataKey: "Payment Method" },
    { header: "Invoice GST", dataKey: "Invoice GST" }, { header: "Invoice Non-GST", dataKey: "Invoice Non-GST" },
    { header: "Driver", dataKey: "Delivery Driver" }, { header: "Delivery", dataKey: "Delivery Status" },
    { header: "Date", dataKey: "Order Date" },
  ]

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getStatusVariant = (status: string) => {
    const s = status.toLowerCase()
    if (s === "completed" || s === "delivered" || s === "paid") return "default"
    if (s === "pending" || s === "processing") return "outline"
    if (s === "cancelled" || s === "failed") return "destructive"
    return "secondary"
  }

  const getRowColorClasses = (order: Order) => {
    if (order.is_priority && order.order_status !== "delivered" && order.order_status !== "cancelled") return "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500"
    if (order.route_assignment_status === "failed" || order.order_status === "failed") return "bg-red-50 hover:bg-red-100"
    if (order.order_status === "cancelled") return "bg-gray-100 hover:bg-gray-200"
    // Payment still pending — flagged ahead of delivery status so a
    // delivered-but-unpaid order still stands out instead of showing green
    // ("done") while money hasn't actually come in yet. Previously this only
    // triggered when order_status was ALSO "pending" (see orders/page.tsx
    // for the identical fix on the other Orders page).
    if (order.payment_status === "pending") return "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500"
    if (order.route_assignment_status === "delivered" || order.order_status === "delivered") return "bg-green-50 hover:bg-green-100"
    if (["in_transit", "picked_up", "out_for_delivery"].includes(order.route_assignment_status || "")) return "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500"
    if (order.order_status === "processing") return "bg-blue-50 hover:bg-blue-100"
    return "hover:bg-muted/50"
  }

  const getAvailableDriversForOrder = (order: Order) => {
    if (!order.shipping_pincode) return { recommended: [] as DeliveryPartner[], others: deliveryPartners }
    const recommended: DeliveryPartner[] = []
    const others: DeliveryPartner[] = []
    deliveryPartners.forEach((driver) => {
      if (driver.serviceable_pincodes?.includes(order.shipping_pincode)) recommended.push(driver)
      else others.push(driver)
    })
    return { recommended, others }
  }

  // ─── Error state ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Orders</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading orders: {error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Make sure you have run the <code>create_orders_view_for_ssr.sql</code> migration in your Supabase SQL Editor.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage orders</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {selectedOrders.size === 0 && (
            <>
              <Button
                variant={filters.hideRetailer ? "default" : "outline"}
                onClick={() => updateParams({ hideRetailer: filters.hideRetailer ? "" : "1" })}
                title={filters.hideRetailer ? "Retailer orders hidden — click to show" : "Hide retailer orders"}
              >
                <Store className="mr-2 h-4 w-4" />
                {filters.hideRetailer ? "Retailer Hidden" : "Hide Retailer"}
              </Button>
              <Button
                variant={filters.websiteOnly ? "default" : "outline"}
                onClick={() => updateParams({ websiteOnly: filters.websiteOnly ? "" : "1" })}
                title={filters.websiteOnly ? "Showing only website orders — click for all" : "Show only website orders"}
              >
                <Globe className="mr-2 h-4 w-4" />
                {filters.websiteOnly ? "Website Only" : "Website Orders"}
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard/failed-orders")}>
                <AlertTriangle className="mr-2 h-4 w-4" />Failed
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard/balance-payment-orders")}>
                <DollarSign className="mr-2 h-4 w-4" />Balance
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.push("/dashboard/distributor-orders")}>
            <Users className="mr-2 h-4 w-4" />Distributor Orders
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/orders/invoice-management")}>
            <Edit className="mr-2 h-4 w-4" />Invoices
          </Button>
          {selectedOrders.size > 0 && (
            <>
              <Button variant="outline" onClick={confirmBulkMarkAsDelivered} disabled={bulkDeliveredLoading}>
                <CheckCircle className="mr-2 h-4 w-4" />Mark Delivered ({selectedOrders.size})
              </Button>
              <Button variant="outline" onClick={confirmBulkComplete} disabled={bulkCompleteLoading} className="border-green-500 text-green-700 hover:bg-green-50">
                <DollarSign className="mr-2 h-4 w-4" />Complete ({selectedOrders.size})
              </Button>
              <Button variant="default" onClick={handleBulkPrintInvoices} disabled={bulkPrintLoading}>
                <Printer className="mr-2 h-4 w-4" />Print ({selectedOrders.size})
              </Button>
              <Button variant="outline" onClick={handleBulkThermalPrint} disabled={bulkThermalPrintLoading} title="Thermal Print (80mm)">
                <Printer className="mr-2 h-4 w-4" />Thermal ({selectedOrders.size})
              </Button>
            </>
          )}
          <ExportButtons
            data={currentExportData}
            filename="orders"
            columns={exportColumns}
            pdfTitle="Orders Report"
          />
          <Button onClick={() => router.push("/dashboard/orders/new")}>
            <Plus className="mr-2 h-4 w-4" />Create Order
          </Button>
        </div>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Input placeholder="Search orders, invoices, address, pincode..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} className="w-[280px]" />

            <Select value={filters.orderStatus} onValueChange={(v) => updateParams({ orderStatus: v })}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Order Status" /></SelectTrigger>
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

            <Select value={filters.deliveryStatus} onValueChange={(v) => updateParams({ deliveryStatus: v })}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Delivery Status" /></SelectTrigger>
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

            <Select value={filters.paymentMethod} onValueChange={(v) => updateParams({ paymentMethod: v })}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Payment Method" /></SelectTrigger>
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

            <Select value={filters.distributorId} onValueChange={(v) => updateParams({ distributorId: v })}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Distributor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Distributors</SelectItem>
                {distributors.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
              </SelectContent>
            </Select>

            <Select value={filters.deliveryPartnerId} onValueChange={(v) => updateParams({ deliveryPartnerId: v })}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Delivery Partner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Delivery Partners</SelectItem>
                <SelectItem value="not_assigned">Not Assigned</SelectItem>
                {deliveryPartners.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>

            <DateRangePresetFilter
              preset={datePreset}
              onPresetChange={(p, range) => {
                setDatePreset(p)
                updateParams({
                  dateFrom: range.from ? format(range.from, "yyyy-MM-dd") : "",
                  dateTo: range.to ? format(range.to, "yyyy-MM-dd") : "",
                })
              }}
              customFrom={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
              customTo={filters.dateTo ? new Date(filters.dateTo) : undefined}
              onCustomRangeChange={(from, to) => {
                setDatePreset("custom")
                updateParams({
                  dateFrom: from ? format(from, "yyyy-MM-dd") : "",
                  dateTo: to ? format(to, "yyyy-MM-dd") : "",
                })
              }}
            />

            <Input type="number" placeholder="Amount From ₹" value={filters.amountFrom}
              onChange={(e) => updateParams({ amountFrom: e.target.value })} className="w-[150px]" min="0" step="0.01" />
            <Input type="number" placeholder="Amount To ₹" value={filters.amountTo}
              onChange={(e) => updateParams({ amountTo: e.target.value })} className="w-[150px]" min="0" step="0.01" />

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />Clear All Filters
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
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
                  <TableHead>Kg</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={15} className="text-center">No orders found</TableCell></TableRow>
                ) : (
                  initialOrders.map((order) => {
                    const isExpanded = expandedRows.has(order.id)
                    const items = orderItems[order.id] || []
                    return (
                      <React.Fragment key={order.id}>
                        <TableRow className={cn("cursor-pointer", getRowColorClasses(order))} onClick={() => toggleRowExpansion(order.id)}>
                          <TableCell>
                            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={(checked) => {
                              const next = new Set(selectedOrders)
                              if (checked) next.add(order.id); else next.delete(order.id)
                              setSelectedOrders(next)
                            }} />
                          </TableCell>
                          <TableCell>{format(new Date(order.order_date || order.created_at), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(order.id) }} className="hover:text-primary hover:underline text-left font-mono" title="Download Invoice">
                                  {order.is_gst_invoice ? (order.invoice_number_gst || order.invoice_number || "-") : (order.invoice_number_non_gst || order.invoice_number || "-")}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDownloadThermalReceipt(order.id) }} className="p-1 hover:bg-muted rounded transition-colors" title="Thermal Print (80mm)">
                                  <Printer className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/order/${order.order_number}`); window.open(`/order/${order.order_number}`, "_blank") }} className="p-1 hover:bg-muted rounded transition-colors" title="QR Payment Page">
                                  <QrCode className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/orders/${order.id}`) }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline">
                                  {order.order_number}<ExternalLink className="h-3 w-3" />
                                </button>
                                {order.is_priority && <Badge variant="destructive" className="text-xs">Priority</Badge>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{order.customer_name}</span>
                                {order.customer_vip_number && <Badge variant="outline" className="font-mono text-xs">Sd{order.customer_vip_number}</Badge>}
                                {order.customer_mandir_number && <Badge variant="outline" className="font-mono text-xs">Man{order.customer_mandir_number}</Badge>}
                                {order.customer_shop_number && <Badge variant="outline" className="font-mono text-xs">Shop{order.customer_shop_number}</Badge>}
                              </div>
                              {order.customer_phone && <span className="text-xs text-muted-foreground">{order.customer_phone}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <div className="truncate font-medium" title={order.shipping_full_address || `${order.shipping_city}, ${order.shipping_state}`}>
                                {order.shipping_full_address || (order.shipping_city && order.shipping_state ? `${order.shipping_city}, ${order.shipping_state}` : "Address not available")}
                              </div>
                              {order.shipping_pincode && <div className="text-xs text-muted-foreground mt-1">PIN: {order.shipping_pincode}</div>}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {order.serviceable_distributor_name && order.serviceable_distributor_id ? (
                              <button onClick={() => router.push(`/dashboard/distributors/${order.serviceable_distributor_id}`)} className="flex flex-col text-left hover:text-primary transition-colors">
                                <span className="font-medium hover:underline">{order.serviceable_distributor_name}</span>
                                <span className="text-xs text-muted-foreground">Services {order.shipping_pincode}</span>
                              </button>
                            ) : <span className="text-xs text-muted-foreground">No distributor</span>}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {order.delivery_partner_id && order.delivery_partner_name ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{order.delivery_partner_name}</span>
                                {order.delivery_partner_mobile && <span className="text-xs text-muted-foreground">{order.delivery_partner_mobile}</span>}
                                {order.assigned_to_delivery_at && <span className="text-xs text-muted-foreground">Assigned {format(new Date(order.assigned_to_delivery_at), "PP")}</span>}
                              </div>
                            ) : <span className="text-xs text-muted-foreground">Not assigned</span>}
                          </TableCell>
                          <TableCell>
                            {order.route_assignment_status ? (
                              <div className="flex flex-col gap-1">
                                <Badge variant={order.route_assignment_status === "delivered" ? "default" : ["in_transit", "picked_up"].includes(order.route_assignment_status) ? "outline" : order.route_assignment_status === "failed" ? "destructive" : "secondary"}>
                                  {order.route_assignment_status.replace(/_/g, " ")}
                                </Badge>
                                {order.pickup_time && <span className="text-xs text-muted-foreground">Picked: {format(new Date(order.pickup_time), "PP p")}</span>}
                                {order.delivery_time && <span className="text-xs text-muted-foreground">Delivered: {format(new Date(order.delivery_time), "PP p")}</span>}
                              </div>
                            ) : order.delivery_partner_id ? (
                              <Badge variant="secondary">assigned</Badge>
                            ) : <span className="text-xs text-muted-foreground">Not assigned</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {order.collected_payment_method ? (
                                <>
                                  <span className={cn("text-sm capitalize font-medium", order.collected_amount && Number(order.collected_amount) === order.total_amount && "text-green-600")}>
                                    {order.collected_payment_method.replace(/_/g, " ")}
                                  </span>
                                  {order.collected_amount && <span className={cn("text-xs font-medium", Number(order.collected_amount) === order.total_amount ? "text-green-600" : "text-muted-foreground")}>Collected: ₹{Number(order.collected_amount).toFixed(2)}</span>}
                                </>
                              ) : order.cod_payment_method ? (
                                <>
                                  <span className={cn("text-sm capitalize font-medium", order.cod_collected_amount && parseFloat(order.cod_collected_amount) === order.total_amount && "text-green-600")}>
                                    COD - {order.cod_payment_method.replace(/_/g, " ")}
                                  </span>
                                  {order.cod_collected_amount && <span className={cn("text-xs font-medium", parseFloat(order.cod_collected_amount) === order.total_amount ? "text-green-600" : "text-muted-foreground")}>Collected: ₹{order.cod_collected_amount}</span>}
                                </>
                              ) : order.payment_method ? (
                                <span className="text-sm capitalize">{order.payment_method.replace(/_/g, " ")}</span>
                              ) : <span className="text-xs text-muted-foreground">Not specified</span>}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">₹{order.total_amount.toFixed(2)}</TableCell>
                          <TableCell>{renderBillKg(orderKg[order.id])}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={getStatusVariant(order.order_status)}>{order.order_status}</Badge>
                              {order.order_status === "failed" && (
                                <div className="text-xs space-y-0.5">
                                  {order.failed_at && <div className="text-muted-foreground">Failed: {format(new Date(order.failed_at), "PP")}</div>}
                                  {order.failure_reason && <div className="text-destructive max-w-[150px] truncate" title={order.failure_reason}>{order.failure_reason}</div>}
                                  {order.failed_attempts && order.failed_attempts > 1 && <Badge variant="outline" className="text-xs w-fit">{order.failed_attempts} attempts</Badge>}
                                  {order.next_delivery_at && <div className="text-muted-foreground">Next: {format(new Date(order.next_delivery_at), "PP")}</div>}
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
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/orders/${order.id}/edit`)}><Edit className="mr-2 h-4 w-4" />Edit Order</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadInvoice(order.id)}><Download className="mr-2 h-4 w-4" />Download Invoice</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadThermalReceipt(order.id)}><Printer className="mr-2 h-4 w-4" />Thermal Print (80mm)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/orders/new?reorder=${order.id}`)}><Copy className="mr-2 h-4 w-4" />Reorder</DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {/* Driver Assignment */}
                                {(() => {
                                  const { recommended, others } = getAvailableDriversForOrder(order)
                                  if (order.delivery_partner_id) {
                                    return (
                                      <DropdownMenuItem onClick={() => handleUnassignDriver(order.id, order.order_number)} disabled={assigningDriver === order.id || order.order_status === "cancelled"}>
                                        <XCircle className="mr-2 h-4 w-4" />Unassign Driver
                                      </DropdownMenuItem>
                                    )
                                  }
                                  const allDrivers = [...recommended, ...others]
                                  if (allDrivers.length > 0) {
                                    return (
                                      <>
                                        {recommended.length > 0 && (
                                          <>
                                            <DropdownMenuLabel className="text-xs text-green-600 font-semibold">Recommended (Pincode Match)</DropdownMenuLabel>
                                            {recommended.map((driver) => (
                                              <DropdownMenuItem key={driver.id} onClick={() => handleAssignDriver(order.id, driver.id, order.order_number)} disabled={assigningDriver === order.id || order.order_status === "cancelled"} className="cursor-pointer">
                                                <UserCheck className="mr-2 h-4 w-4 text-green-600" />
                                                <div className="flex flex-col flex-1">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-medium">{driver.name}</span>
                                                    {driver.average_rating && <div className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><span className="text-xs">{driver.average_rating.toFixed(1)}</span></div>}
                                                  </div>
                                                  <span className="text-xs text-muted-foreground">{driver.active_orders_count || 0} active &bull; {driver.total_deliveries || 0} total</span>
                                                  {driver.vehicle_type && <span className="text-xs text-muted-foreground capitalize">{driver.vehicle_type} {driver.vehicle_number ? `• ${driver.vehicle_number}` : ""}</span>}
                                                </div>
                                              </DropdownMenuItem>
                                            ))}
                                            {others.length > 0 && <DropdownMenuSeparator />}
                                          </>
                                        )}
                                        {others.length > 0 && (
                                          <>
                                            <DropdownMenuLabel className="text-xs">{recommended.length > 0 ? "Other Drivers" : "Assign Driver"}</DropdownMenuLabel>
                                            {others.map((driver) => (
                                              <DropdownMenuItem key={driver.id} onClick={() => handleAssignDriver(order.id, driver.id, order.order_number)} disabled={assigningDriver === order.id || order.order_status === "cancelled"} className="cursor-pointer">
                                                <UserCheck className="mr-2 h-4 w-4" />
                                                <div className="flex flex-col flex-1">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-sm">{driver.name}</span>
                                                    {driver.average_rating && <div className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><span className="text-xs">{driver.average_rating.toFixed(1)}</span></div>}
                                                  </div>
                                                  <span className="text-xs text-muted-foreground">{driver.active_orders_count || 0} active &bull; {driver.total_deliveries || 0} total</span>
                                                  {driver.vehicle_type && <span className="text-xs text-muted-foreground capitalize">{driver.vehicle_type} {driver.vehicle_number ? `• ${driver.vehicle_number}` : ""}</span>}
                                                </div>
                                              </DropdownMenuItem>
                                            ))}
                                          </>
                                        )}
                                      </>
                                    )
                                  }
                                  return <DropdownMenuItem disabled><UserCheck className="mr-2 h-4 w-4" />No drivers available</DropdownMenuItem>
                                })()}

                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleMarkAsDelivered(order.id, order.order_number)} disabled={order.order_status === "delivered" || order.order_status === "cancelled"}>
                                  <Truck className="mr-2 h-4 w-4" />Mark as Delivered
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCompleteOrder(order.id, order.order_number)} disabled={order.order_status === "completed" || order.order_status === "cancelled"}>
                                  <CheckCircle className="mr-2 h-4 w-4" />Complete Order
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleCancelOrder(order.id, order.order_number)} disabled={order.order_status === "cancelled" || order.order_status === "completed"} className="text-destructive focus:text-destructive">
                                  <XCircle className="mr-2 h-4 w-4" />Cancel Order
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setDeletingOrder({ id: order.id, orderNumber: order.order_number }); setDeleteDialogOpen(true) }} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />Delete Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Row */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={15} className="bg-muted/30 p-0">
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
                                            <TableHead className="text-right">Kg</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {items.map((item) => {
                                            const itemSubtotal = item.quantity * item.unit_price
                                            const netAmount = itemSubtotal - item.discount_amount
                                            const itemKg = kgForItem(item.product_id ? productWeights[item.product_id] : null, item.quantity)
                                            return (
                                              <TableRow key={item.id || `${order.id}-${item.product_name}-${item.quantity}`}>
                                                <TableCell className="font-medium">
                                                  <div>{item.product_name}{item.product_sku && <div className="text-xs text-muted-foreground mt-1">SKU: {item.product_sku}</div>}</div>
                                                </TableCell>
                                                <TableCell className="text-center">{item.quantity}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">₹{item.unit_price.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">₹{itemSubtotal.toFixed(2)}</TableCell>
                                                <TableCell className="text-center text-muted-foreground">{item.discount_percent > 0 ? `${item.discount_percent.toFixed(2)}%` : "-"}</TableCell>
                                                <TableCell className="text-right">{item.discount_amount > 0 ? `₹${item.discount_amount.toFixed(2)}` : "-"}</TableCell>
                                                <TableCell className="text-right font-medium">₹{netAmount.toFixed(2)}</TableCell>
                                                <TableCell className="text-center">{item.gst_percentage > 0 ? `${item.gst_percentage}%` : "-"}</TableCell>
                                                <TableCell className="text-right">{item.gst_amount > 0 ? `₹${item.gst_amount.toFixed(2)}` : "-"}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">{itemKg > 0 ? `${kgFormatter.format(itemKg)} Kg` : "-"}</TableCell>
                                                <TableCell className="text-right font-medium">₹{item.total.toFixed(2)}</TableCell>
                                              </TableRow>
                                            )
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}

                                  {items.length > 0 && (
                                    <div className="mt-4 flex items-center border-t pt-3">
                                      {(() => {
                                        const calcSubtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
                                        const totalItemDiscount = items.reduce((sum, i) => sum + (i.discount_amount || 0), 0)
                                        const totalDiscount = totalItemDiscount + (order.discount_amount ?? 0)
                                        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0)
                                        const billKg = totalKgForItems(items, productWeights)
                                        return (
                                          <div className="flex items-center gap-6">
                                            <div className="text-sm"><span className="text-muted-foreground">Products: </span><span className="font-medium">{items.length}</span></div>
                                            <div className="text-sm"><span className="text-muted-foreground">Qty: </span><span className="font-medium">{totalQty}</span></div>
                                            {billKg > 0 && (
                                              <div className="text-sm">
                                                <span className="text-muted-foreground">Kg: </span>
                                                <span className="font-medium">{kgFormatter.format(billKg)} Kg</span>
                                              </div>
                                            )}
                                            <div className="text-sm"><span className="text-muted-foreground">Subtotal: </span><span className="font-medium">₹{(order.subtotal ?? calcSubtotal).toFixed(2)}</span></div>
                                            {totalDiscount > 0 && <div className="text-sm"><span className="text-muted-foreground">Discount: </span><span className="font-medium text-destructive">-₹{totalDiscount.toFixed(2)}</span></div>}
                                            <div className="text-base font-bold">Total: ₹{order.total_amount.toFixed(2)}</div>
                                            {order.source && <div className="text-sm"><span className="text-muted-foreground">Source: </span><span className="font-medium capitalize">{order.source.replace(/_/g, " ")}</span></div>}
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  )}
                                </div>

                                {(order.delivery_proof_url || order.cod_payment_method || order.delivery_notes) && (
                                  <div className="rounded-md border bg-background p-4">
                                    <h4 className="font-semibold mb-3">Delivery Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {order.cod_payment_method && <div><span className="text-sm font-medium text-muted-foreground">COD Payment Method:</span><p className="text-sm mt-1 capitalize">{order.cod_payment_method.replace(/_/g, " ")}</p></div>}
                                      {order.cod_collected_amount && <div><span className="text-sm font-medium text-muted-foreground">COD Collected Amount:</span><p className="text-sm mt-1 font-medium">₹{order.cod_collected_amount}</p></div>}
                                      {order.delivery_notes && <div className="md:col-span-2"><span className="text-sm font-medium text-muted-foreground">Delivery Notes:</span><p className="text-sm mt-1">{order.delivery_notes}</p></div>}
                                      {order.delivery_proof_url && (
                                        <div className="md:col-span-2"><span className="text-sm font-medium text-muted-foreground">Delivery Proof:</span>
                                          <div className="mt-2"><a href={order.delivery_proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ExternalLink className="h-4 w-4" />View Delivery Proof</a></div>
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
                Showing {totalCount > 0 ? startIndex + 1 : 0}-{endIndex} of {totalCount} orders
              </div>
              {selectedOrders.size > 0 && <div className="text-sm font-medium text-primary">{selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""} selected</div>}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v)}>
                  <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={currentPage === 1} title="First page"><ChevronsLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} title="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                <div className="flex items-center gap-1">
                  {(() => {
                    const pages: (number | string)[] = []
                    const maxVisible = 5
                    if (totalPages <= maxVisible) { for (let i = 1; i <= totalPages; i++) pages.push(i) }
                    else if (currentPage <= 3) { for (let i = 1; i <= 4; i++) pages.push(i); pages.push("..."); pages.push(totalPages) }
                    else if (currentPage >= totalPages - 2) { pages.push(1); pages.push("..."); for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i) }
                    else { pages.push(1); pages.push("..."); pages.push(currentPage - 1); pages.push(currentPage); pages.push(currentPage + 1); pages.push("..."); pages.push(totalPages) }
                    return pages.map((p, i) => {
                      if (p === "...") return <span key={`e-${i}`} className="px-2 text-muted-foreground">...</span>
                      return <Button key={p} variant={currentPage === p ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setPage(p as number)}>{p}</Button>
                    })
                  })()}
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} title="Next page"><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} title="Last page"><ChevronsRight className="h-4 w-4" /></Button>
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
              This will permanently delete order <strong>{deletingOrder?.orderNumber}</strong> and all its items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingOrder(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrder} className="bg-destructive hover:bg-destructive/90">Delete Order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Mark as Delivered Dialog */}
      <AlertDialog open={bulkDeliveryDialogOpen} onOpenChange={setBulkDeliveryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark orders as delivered?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""}</strong> as delivered. Already delivered or cancelled orders will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkMarkAsDelivered}>Mark as Delivered</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Complete Dialog */}
      <AlertDialog open={bulkCompleteDialogOpen} onOpenChange={setBulkCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete orders?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>This will mark <strong>{selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""}</strong> as delivered and payment completed.</p>
                <p className="mt-1 text-sm">Already completed or cancelled orders will be skipped.</p>
                <div className="mt-4">
                  <label className="text-sm font-medium text-foreground">Payment Method</label>
                  <Select value={bulkCompletePaymentMethod} onValueChange={setBulkCompletePaymentMethod}>
                    <SelectTrigger className="w-full mt-1.5"><SelectValue placeholder="Select payment method" /></SelectTrigger>
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
            <AlertDialogAction onClick={handleBulkComplete} className="bg-green-600 hover:bg-green-700">Complete Orders</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
