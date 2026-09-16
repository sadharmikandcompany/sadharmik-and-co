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
import { X, ExternalLink, ChevronDown, Edit, Download, XCircle, Truck, CheckCircle, MoreVertical, ArrowLeft, FileText, Printer, IndianRupee } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"
import { generateOrderInvoice, generateBulkOrderInvoices, FACTORY_COMPANY_INFO } from "@/lib/invoice-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Order = {
  id: string
  order_number: string
  customer_id: string | null
  distributor_id?: string | null
  is_distributor?: boolean
  is_subdistributor?: boolean
  distributor_name?: string
  distributor_phone?: string
  distributor_company?: string
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
  is_factory_order?: boolean
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

export default function DistributorOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all")
  const [distributorTypeFilter, setDistributorTypeFilter] = useState<string>("all")
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "invoiced" | "non-invoiced">("all")

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})

  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false)
  const [convertingInvoiceId, setConvertingInvoiceId] = useState<string | null>(null)

  // Record Payment dialog (distributors often pay bills in part payments)
  const [paymentDialogOrder, setPaymentDialogOrder] = useState<Order | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethodInput, setPaymentMethodInput] = useState("cash")
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [savingPayment, setSavingPayment] = useState(false)
  const [orderPaidTotal, setOrderPaidTotal] = useState<number>(0)

  useEffect(() => {
    fetchDistributorOrders()
  }, [])

  const fetchDistributorOrders = async () => {
    try {
      setLoading(true)
      console.log("Starting to fetch distributor orders...")

      // Fetch only distributor orders (where distributor_id is not null)
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .not("distributor_id", "is", null)
        .order("created_at", { ascending: false })

      console.log("Distributor orders query result:", { ordersData, ordersError })

      if (ordersError) {
        console.error("Error fetching distributor orders:", ordersError)
        toast.error(`Failed to fetch distributor orders: ${ordersError.message}`)
        setLoading(false)
        return
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([])
        setLoading(false)
        return
      }

      // Extract unique distributor IDs
      const distributorIds = ordersData
        .filter((order: any) => order.distributor_id)
        .map((order: any) => order.distributor_id)

      // Fetch distributors
      const distributorsResult = distributorIds.length > 0
        ? await supabase
            .from("distributors")
            .select("id, name, phone_primary, company_name, parent_id")
            .in("id", distributorIds)
        : { data: [], error: null }

      // Create lookup map
      const distributorsMap = new Map(
        (distributorsResult.data || []).map((d: any) => [d.id, d])
      )

      // Map the data to the expected format
      const ordersWithDistributors = ordersData.map((order: any) => {
        let distributor_name = "Unknown Distributor"
        let distributor_phone = ""
        let distributor_company = ""

        if (order.distributor_id) {
          const distributor = distributorsMap.get(order.distributor_id)
          if (distributor) {
            distributor_name = distributor.name
            distributor_phone = distributor.phone_primary
            distributor_company = distributor.company_name
          }
        }

        return {
          ...order,
          distributor_name,
          distributor_phone,
          distributor_company,
        }
      })

      setOrders(ordersWithDistributors || [])
      setLoading(false)
      console.log("Distributor orders loaded successfully:", ordersWithDistributors?.length)
    } catch (error) {
      console.error("Unexpected error in fetchDistributorOrders:", error)
      toast.error("An unexpected error occurred while fetching distributor orders")
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

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      // Fetch full order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError

      // Fetch distributor
      const { data: distributorData, error: distributorError } = await supabase
        .from("distributors")
        .select("*")
        .eq("id", orderData.distributor_id)
        .single()

      if (distributorError) throw distributorError

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)

      if (itemsError) throw itemsError

      // Build distributor's full address from billing fields
      const distributorAddress = [
        distributorData.billing_address_line1,
        distributorData.billing_address_line2,
        distributorData.billing_city,
        distributorData.billing_state,
        distributorData.billing_pincode,
      ].filter(Boolean).join(', ')

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
          first_name: distributorData.name.split(' ')[0] || distributorData.name,
          last_name: distributorData.name.split(' ').slice(1).join(' ') || '',
          email: distributorData.email || undefined,
          mobile_primary: distributorData.phone_primary,
          company_name: distributorData.company_name || undefined,
          gst_number: distributorData.gst_number || undefined,
          full_address: distributorAddress || undefined,
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
        })),
        companyInfo: companyInfo
      }

      // Use distributor name for invoice filename
      generateOrderInvoice(invoiceData, distributorData.name)
      toast.success("Invoice downloaded successfully")
    } catch (error) {
      console.error("Error downloading invoice:", error)
      toast.error("Failed to download invoice")
    }
  }

  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          order_status: "cancelled",
          invoice_number_gst: null,
          invoice_number_non_gst: null,
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Order ${orderNumber} has been cancelled`)
      fetchDistributorOrders() // Refresh the list
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
          delivered_date: new Date().toISOString()
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Order ${orderNumber} marked as delivered`)
      fetchDistributorOrders() // Refresh the list
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
          delivered_date: new Date().toISOString()
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success(`Order ${orderNumber} has been completed`)
      fetchDistributorOrders() // Refresh the list
    } catch (error) {
      console.error("Error completing order:", error)
      toast.error("Failed to complete order")
    }
  }

  // ── Distributor part payments ────────────────────────────────────────────
  const openPaymentDialog = async (order: Order) => {
    setPaymentDialogOrder(order)
    setPaymentAmount("")
    setPaymentMethodInput("cash")
    setPaymentReference("")
    setPaymentNotes("")
    // Sum previous payments so the dialog shows the remaining balance
    const { data, error } = await supabase
      .from("distributor_payments")
      .select("amount")
      .eq("order_id", order.id)
    if (error) {
      // Table missing (migration not run yet) or fetch failed — still allow entry
      console.error("distributor_payments lookup failed:", error.message)
      setOrderPaidTotal(0)
      return
    }
    setOrderPaidTotal((data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0))
  }

  const handleRecordPayment = async () => {
    if (!paymentDialogOrder) return
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid payment amount")
      return
    }
    setSavingPayment(true)
    try {
      const { error: insertError } = await supabase.from("distributor_payments").insert({
        distributor_id: paymentDialogOrder.distributor_id || null,
        order_id: paymentDialogOrder.id,
        amount,
        payment_method: paymentMethodInput,
        reference_number: paymentReference || null,
        notes: paymentNotes || null,
      })
      if (insertError) throw insertError

      // Derive payment status from the running total
      const paidTotal = orderPaidTotal + amount
      const newStatus = paidTotal >= Number(paymentDialogOrder.total_amount || 0) ? "completed" : "partial"
      const { error: updateError } = await supabase
        .from("orders")
        .update({ payment_status: newStatus })
        .eq("id", paymentDialogOrder.id)
      if (updateError) throw updateError

      toast.success(
        `Payment of ₹${amount.toLocaleString("en-IN")} recorded — ${
          newStatus === "completed" ? "bill fully paid" : `₹${Math.max(0, Number(paymentDialogOrder.total_amount) - paidTotal).toLocaleString("en-IN")} remaining`
        }`
      )
      setPaymentDialogOrder(null)
      fetchDistributorOrders()
    } catch (error: any) {
      console.error("Error recording payment:", error)
      toast.error(error?.message || "Failed to record payment (has the distributor_payments migration been run?)")
    } finally {
      setSavingPayment(false)
    }
  }

  const handleConvertToInvoice = async (orderId: string, orderNumber: string) => {
    if (convertingInvoiceId) return // Prevent double-clicks
    setConvertingInvoiceId(orderId)

    try {
      // Fetch the order to get distributor info and verify it hasn't been invoiced already
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("distributor_id, invoice_number_gst, invoice_number_non_gst, order_status, is_factory_order, destination_godown_id")
        .eq("id", orderId)
        .single()

      if (orderError) throw orderError

      // Guard: already invoiced
      if (orderData.invoice_number_gst || orderData.invoice_number_non_gst) {
        toast.error("This order already has an invoice number")
        return
      }

      // Guard: cancelled orders
      if (orderData.order_status === "cancelled") {
        toast.error("Cannot convert a cancelled order to invoice")
        return
      }

      // Fetch distributor to check GST number and invoice code
      const { data: distributorData, error: distributorError } = await supabase
        .from("distributors")
        .select("gst_number, invoice_code")
        .eq("id", orderData.distributor_id)
        .single()

      if (distributorError) throw distributorError

      // Determine if this is a GST invoice - ensure it's a proper boolean
      const hasGST = Boolean(distributorData.gst_number && distributorData.gst_number.trim() !== '')

      // Factory orders use KP prefix, non-factory use distributor's invoice_code
      const distCode = orderData.is_factory_order
        ? null  // null = default KP prefix
        : (distributorData.invoice_code && distributorData.invoice_code.trim() !== '' ? distributorData.invoice_code : null)

      const { data: invoiceData, error: invoiceError } = await supabase
        .rpc('get_next_invoice_number', { is_gst: hasGST, dist_code: distCode })

      if (invoiceError) throw invoiceError

      // Update the order with the generated invoice number
      const updateData = hasGST
        ? {
            invoice_number_gst: invoiceData,
            invoice_number_non_gst: null,
            is_gst_invoice: true
          }
        : {
            invoice_number_gst: null,
            invoice_number_non_gst: invoiceData,
            is_gst_invoice: false
          }

      const { error: updateError } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)

      if (updateError) throw updateError

      // For factory orders: deduct factory stock and add to distributor's godown
      if (orderData.is_factory_order) {
        const { data: orderItemsData } = await supabase
          .from("order_items")
          .select("product_id, product_name, quantity")
          .eq("order_id", orderId)

        if (orderItemsData) {
          for (const item of orderItemsData) {
            // Deduct from factory_warehouse_stock
            const { data: factoryStock } = await supabase
              .from("factory_warehouse_stock")
              .select("id, quantity")
              .eq("product_id", item.product_id)
              .maybeSingle()

            if (factoryStock) {
              const newQty = Math.max(0, (factoryStock.quantity || 0) - item.quantity)
              if (newQty === 0 && (factoryStock.quantity || 0) < item.quantity) {
                toast.warning(`${item.product_name}: Factory stock insufficient — set to 0.`)
              }
              await supabase
                .from("factory_warehouse_stock")
                .update({ quantity: newQty })
                .eq("id", factoryStock.id)
            }

            // Add to destination godown
            if (orderData.destination_godown_id) {
              const { data: inventoryData } = await supabase
                .from("stock_inventory")
                .select("id")
                .eq("product_id", item.product_id)
                .maybeSingle()

              if (inventoryData) {
                const { data: destStock } = await supabase
                  .from("godown_stock")
                  .select("quantity, reserved_quantity")
                  .eq("godown_id", orderData.destination_godown_id)
                  .eq("stock_inventory_id", inventoryData.id)
                  .maybeSingle()

                const destNewQty = (destStock?.quantity || 0) + item.quantity

                await supabase
                  .from("godown_stock")
                  .upsert({
                    godown_id: orderData.destination_godown_id,
                    stock_inventory_id: inventoryData.id,
                    quantity: destNewQty,
                    reserved_quantity: destStock?.reserved_quantity || 0,
                  }, { onConflict: 'godown_id,stock_inventory_id' })
              }
            }
          }
          console.log("Factory stock deducted and distributor godown updated.")
        }
      }

      toast.success(`Order ${orderNumber} converted to invoice: ${invoiceData}`)
      fetchDistributorOrders() // Refresh the list
    } catch (error) {
      console.error("Error converting to invoice:", error)
      toast.error("Failed to convert to invoice")
    } finally {
      setConvertingInvoiceId(null)
    }
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

          // Fetch distributor
          const { data: distributorData, error: distributorError } = await supabase
            .from("distributors")
            .select("*")
            .eq("id", orderData.distributor_id)
            .single()

          if (distributorError) throw distributorError

          // Fetch order items
          const { data: itemsData, error: itemsError } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", orderId)

          if (itemsError) throw itemsError

          // Build distributor's full address from billing fields
          const distributorAddress = [
            distributorData.billing_address_line1,
            distributorData.billing_address_line2,
            distributorData.billing_city,
            distributorData.billing_state,
            distributorData.billing_pincode,
          ].filter(Boolean).join(', ')

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
              first_name: distributorData.name.split(' ')[0] || distributorData.name,
              last_name: distributorData.name.split(' ').slice(1).join(' ') || '',
              email: distributorData.email || undefined,
              mobile_primary: distributorData.phone_primary,
              company_name: distributorData.company_name || undefined,
              gst_number: distributorData.gst_number || undefined,
              full_address: distributorAddress || undefined,
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
            })),
            companyInfo: companyInfo
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

  const filteredOrders = orders.filter((order) => {
    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.distributor_name && order.distributor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.distributor_company && order.distributor_company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      order.order_status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.payment_status.toLowerCase().includes(searchTerm.toLowerCase())

    // Date range filter
    const orderDate = new Date(order.order_date || order.created_at)
    const matchesDateFrom = !dateFrom || orderDate >= dateFrom
    const matchesDateTo = !dateTo || orderDate <= dateTo

    // Order status filter
    const matchesOrderStatus =
      orderStatusFilter === "all" ||
      order.order_status.toLowerCase() === orderStatusFilter.toLowerCase()

    // Distributor type filter
    const matchesDistributorType =
      distributorTypeFilter === "all" ||
      (distributorTypeFilter === "distributor" && order.is_distributor) ||
      (distributorTypeFilter === "subdistributor" && order.is_subdistributor)

    // Invoice status filter
    const hasInvoice = order.invoice_number_gst || order.invoice_number_non_gst
    const matchesInvoiceStatus =
      invoiceStatusFilter === "all" ||
      (invoiceStatusFilter === "invoiced" && hasInvoice) ||
      (invoiceStatusFilter === "non-invoiced" && !hasInvoice)

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesOrderStatus &&
      matchesDistributorType &&
      matchesInvoiceStatus
    )
  })

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setOrderStatusFilter("all")
    setDistributorTypeFilter("all")
    setInvoiceStatusFilter("all")
    setSearchTerm("")
  }

  const hasActiveFilters =
    dateFrom ||
    dateTo ||
    orderStatusFilter !== "all" ||
    distributorTypeFilter !== "all" ||
    invoiceStatusFilter !== "all" ||
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

  // Prepare export data
  const exportData = filteredOrders.map(order => ({
    'Order Number': order.order_number,
    'Distributor': order.distributor_name || 'Unknown',
    'Company': order.distributor_company || '',
    'Type': order.is_subdistributor ? 'Subdistributor' : 'Distributor',
    'Phone': order.distributor_phone || '',
    'Shipping Address': order.shipping_full_address || `${order.shipping_city}, ${order.shipping_state}`,
    'Pincode': order.shipping_pincode || '',
    'Order Status': order.order_status,
    'Payment Status': order.payment_status,
    'Payment Method': order.payment_method || 'N/A',
    'Amount': `₹${order.total_amount.toFixed(2)}`,
    'Priority': order.is_priority ? 'Yes' : 'No',
    'Order Date': format(new Date(order.order_date || order.created_at), 'PPP')
  }))

  const exportColumns = [
    { header: 'Order #', dataKey: 'Order Number' },
    { header: 'Distributor', dataKey: 'Distributor' },
    { header: 'Company', dataKey: 'Company' },
    { header: 'Type', dataKey: 'Type' },
    { header: 'Phone', dataKey: 'Phone' },
    { header: 'Shipping Address', dataKey: 'Shipping Address' },
    { header: 'Pincode', dataKey: 'Pincode' },
    { header: 'Status', dataKey: 'Order Status' },
    { header: 'Payment', dataKey: 'Payment Status' },
    { header: 'Amount', dataKey: 'Amount' },
    { header: 'Date', dataKey: 'Order Date' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Distributor Orders</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/orders")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Distributor Performa Invoice</h1>
          </div>
          <p className="text-muted-foreground ml-12">Orders from distributors and subdistributors</p>
        </div>
        <div className="flex gap-2">
          {selectedOrders.size > 0 && (
            <Button
              variant="default"
              onClick={handleBulkPrintInvoices}
              disabled={bulkPrintLoading}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Selected ({selectedOrders.size})
            </Button>
          )}
          <ExportButtons
            data={exportData}
            filename="distributor-orders"
            columns={exportColumns}
            pdfTitle="Distributor Orders Report"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Distributor Order List</CardTitle>
              <CardDescription>
                A list of all orders from distributors and subdistributors ({filteredOrders.length} orders)
              </CardDescription>
            </div>
            <Tabs value={invoiceStatusFilter} onValueChange={(value) => setInvoiceStatusFilter(value as "all" | "invoiced" | "non-invoiced")}>
              <TabsList>
                <TabsTrigger value="all">All Orders</TabsTrigger>
                <TabsTrigger value="non-invoiced">
                  Proforma ({orders.filter(o => !o.invoice_number_gst && !o.invoice_number_non_gst).length})
                </TabsTrigger>
                <TabsTrigger value="invoiced">
                  Invoiced ({orders.filter(o => o.invoice_number_gst || o.invoice_number_non_gst).length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[200px]"
              />

              {/* Distributor Type Filter */}
              <Select value={distributorTypeFilter} onValueChange={setDistributorTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Distributor Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="distributor">Distributors</SelectItem>
                  <SelectItem value="subdistributor">Subdistributors</SelectItem>
                </SelectContent>
              </Select>

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
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear All Filters
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
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center">
                      No distributor orders found
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
                              {order.invoice_number_gst || order.invoice_number_non_gst ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownloadInvoice(order.id)
                                  }}
                                  className="hover:text-primary hover:underline text-left"
                                  title="Download Invoice"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono">
                                      {order.is_gst_invoice
                                        ? order.invoice_number_gst
                                        : order.invoice_number_non_gst
                                      }
                                    </span>
                                    <Badge variant={order.is_gst_invoice ? "default" : "secondary"} className="text-xs">
                                      {order.is_gst_invoice ? "GST" : "Non-GST"}
                                    </Badge>
                                  </div>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    Proforma
                                  </Badge>
                                </div>
                              )}
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
                                {order.is_factory_order && (
                                  <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400">
                                    Factory
                                  </Badge>
                                )}
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
                              <span className="font-medium">{order.distributor_name}</span>
                              {order.distributor_company && (
                                <span className="text-xs text-muted-foreground">{order.distributor_company}</span>
                              )}
                              {order.distributor_phone && (
                                <span className="text-xs text-muted-foreground">{order.distributor_phone}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={order.is_subdistributor ? "outline" : "default"}>
                              {order.is_subdistributor ? "Subdistributor" : "Distributor"}
                            </Badge>
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
                          <TableCell className="font-medium">
                            ₹{order.total_amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(order.order_status)}>
                              {order.order_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(order.payment_status)}>
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
                              <DropdownMenuContent align="end">
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
                                {!order.invoice_number_gst && !order.invoice_number_non_gst && order.order_status !== "cancelled" && (
                                  <DropdownMenuItem
                                    onClick={() => handleConvertToInvoice(order.id, order.order_number)}
                                    disabled={convertingInvoiceId === order.id}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    {convertingInvoiceId === order.id ? "Converting..." : "Convert to Invoice"}
                                  </DropdownMenuItem>
                                )}
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
                                <DropdownMenuItem
                                  onClick={() => openPaymentDialog(order)}
                                  disabled={order.order_status === "cancelled" || order.payment_status === "completed"}
                                >
                                  <IndianRupee className="mr-2 h-4 w-4" />
                                  Record Payment
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
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Row Content */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={11} className="bg-muted/30 p-0">
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
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {orders.length} distributor orders
            </div>
            {selectedOrders.size > 0 && (
              <div className="text-sm font-medium">
                {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Record Payment dialog — supports part payments against a bill */}
      <Dialog open={!!paymentDialogOrder} onOpenChange={(open) => !open && setPaymentDialogOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentDialogOrder && (
                <>
                  {paymentDialogOrder.order_number} · {paymentDialogOrder.distributor_name || "Distributor"} · Bill ₹
                  {Number(paymentDialogOrder.total_amount).toLocaleString("en-IN")}
                  {orderPaidTotal > 0 && (
                    <>
                      {" "}· Paid ₹{orderPaidTotal.toLocaleString("en-IN")} · Balance ₹
                      {Math.max(0, Number(paymentDialogOrder.total_amount) - orderPaidTotal).toLocaleString("en-IN")}
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount (₹) *</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount received"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethodInput} onValueChange={setPaymentMethodInput}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-reference">Reference / UTR Number</Label>
              <Input
                id="payment-reference"
                placeholder="Optional"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes</Label>
              <Input
                id="payment-notes"
                placeholder="Optional"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOrder(null)} disabled={savingPayment}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
