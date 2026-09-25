"use client"

import React, { useEffect, useState, useCallback } from "react"
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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarIcon, Search, RefreshCw, ExternalLink, X, Download, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { format, subDays } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { toast } from "sonner"
import { generateOrderInvoice } from "@/lib/invoice-generator"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"

type EasebuzzTransaction = {
  id: string
  order_number: string
  invoice_number: string | null
  easebuzz_txn_id: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  order_status: string
  source: string
  order_date: string
  created_at: string
  updated_at: string
}

type EasebuzzApiTransaction = {
  status: string
  total_debit_amount: number
  net_debit_amount: number
  easepayid: string
  firstname: string
  phone: string
  udf1: string
  udf2: string
  udf3: string
  udf4: string
  udf5: string
  txnid: string
  email: string
}

type EasebuzzTxnDetail = {
  txnid: string
  firstname: string
  email: string
  phone: string
  key: string
  mode: string
  unmappedstatus: string
  cardCategory: string
  addedon: string
  payment_source: string
  PG_TYPE: string
  bank_ref_num: string
  bankcode: string
  error: string
  error_Message: string
  name_on_card: string
  upi_va: string
  cardnum: string
  issuing_bank: string
  easepayid: string
  amount: string
  net_amount_debit: string
  cash_back_percentage: string
  deduction_percentage: string
  surl: string
  furl: string
  productinfo: string
  udf1: string
  udf2: string
  udf3: string
  udf4: string
  udf5: string
  card_type: string
  status: string
  bank_name: string
  auth_code: string
  auth_ref_num: string
  response_code: string
  error_code: string
}

export default function EasebuzzTransactionsPage() {
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, entityDetails, loading: entityLoading } = useEntityData()
  const isDistributor = role === 'main_distributor' || role === 'sub_distributor'
  const isMainDistributor = role === 'main_distributor'
  const isSubDistributor = role === 'sub_distributor'

  // Database tab state
  const [transactions, setTransactions] = useState<EasebuzzTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [stats, setStats] = useState({
    totalTransactions: 0,
    completedAmount: 0,
    pendingAmount: 0,
    todayTransactions: 0,
  })

  // Pagination
  const PAGE_SIZE = 20
  const [dbPage, setDbPage] = useState(1)
  const [apiPage, setApiPage] = useState(1)

  // Easebuzz API tab state
  const [apiTransactions, setApiTransactions] = useState<EasebuzzApiTransaction[]>([])
  const [apiLoading, setApiLoading] = useState(true)
  const [apiStartDate, setApiStartDate] = useState<Date>(subDays(new Date(), 30))
  const [apiEndDate, setApiEndDate] = useState<Date>(new Date())
  const [apiSearchQuery, setApiSearchQuery] = useState("")
  const [apiStatusFilter, setApiStatusFilter] = useState<string>("success")
  const [apiError, setApiError] = useState<string | null>(null)

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [txnDetail, setTxnDetail] = useState<EasebuzzTxnDetail | null>(null)

  // ---- Database Tab ----

  const fetchTransactions = async () => {
    if (isDistributor && (entityLoading || !entityId)) return

    setLoading(true)
    try {
      // Pre-fetch distributor data for filtering
      let distributorPincodes: string[] = []
      let distributorRetailerIds: string[] = []
      let subDistributorIds: string[] = []

      if (isDistributor && entityId) {
        distributorPincodes = entityDetails?.serviceable_pincodes || []
        const { data: retailers } = await supabase
          .from('retailers').select('id').eq('distributor_id', entityId)
        distributorRetailerIds = (retailers || []).map((r: any) => r.id)

        if (isMainDistributor) {
          const { data: subDists } = await supabase
            .from('distributors').select('id').eq('parent_id', entityId)
          subDistributorIds = (subDists || []).map((d: any) => d.id)
        }
      }

      let query = supabase
        .from("orders")
        .select(`
          id, order_number, invoice_number_gst, invoice_number_non_gst, is_gst_invoice,
          easebuzz_txn_id, payment_status, payment_method, total_amount, customer_id,
          order_status, source, order_date, created_at, updated_at
        `)
        .not("easebuzz_txn_id", "is", null)
        .order("created_at", { ascending: false })

      // Distributor filtering
      if (isDistributor && entityId) {
        if (isSubDistributor) {
          const filterParts: string[] = []
          if (distributorPincodes.length > 0) {
            filterParts.push(`shipping_pincode.in.(${distributorPincodes.join(',')})`)
          }
          if (distributorRetailerIds.length > 0) {
            filterParts.push(`retailer_id.in.(${distributorRetailerIds.join(',')})`)
          }
          if (filterParts.length > 0) {
            query = query.or(filterParts.join(','))
          }
          query = query.is("distributor_id", null)
        } else {
          const filterParts: string[] = []
          if (distributorPincodes.length > 0) {
            filterParts.push(`shipping_pincode.in.(${distributorPincodes.join(',')})`)
          }
          if (distributorRetailerIds.length > 0) {
            filterParts.push(`retailer_id.in.(${distributorRetailerIds.join(',')})`)
          }
          filterParts.push(`distributor_id.eq.${entityId}`)
          if (subDistributorIds.length > 0) {
            filterParts.push(`distributor_id.in.(${subDistributorIds.join(',')})`)
          }
          if (filterParts.length > 0) {
            query = query.or(filterParts.join(','))
          }
        }
      }

      if (paymentStatusFilter !== "all") query = query.eq("payment_status", paymentStatusFilter)
      if (sourceFilter !== "all") query = query.eq("source", sourceFilter)
      if (dateFrom) query = query.gte("order_date", dateFrom.toISOString())
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte("order_date", endDate.toISOString())
      }

      const { data, error } = await query
      if (error) throw error

      const customerIds = (data || []).filter((item: any) => item.customer_id).map((item: any) => item.customer_id)
      let customersMap: Record<string, { first_name: string; last_name: string; mobile_primary: string }> = {}

      if (customerIds.length > 0) {
        const { data: customersData } = await supabase
          .from("customers")
          .select("id, first_name, last_name, mobile_primary")
          .in("id", customerIds)
        if (customersData) {
          customersMap = customersData.reduce((acc: any, c: any) => { acc[c.id] = c; return acc }, {})
        }
      }

      const transformedData: EasebuzzTransaction[] = (data || []).map((item: any) => {
        const customer = item.customer_id ? customersMap[item.customer_id] : null
        const invoiceNumber = item.is_gst_invoice ? item.invoice_number_gst : item.invoice_number_non_gst
        return {
          id: item.id, order_number: item.order_number, invoice_number: invoiceNumber || null,
          easebuzz_txn_id: item.easebuzz_txn_id, payment_status: item.payment_status,
          payment_method: item.payment_method, total_amount: item.total_amount,
          customer_id: item.customer_id,
          customer_name: customer ? `${customer.first_name} ${customer.last_name}` : null,
          customer_phone: customer?.mobile_primary || null,
          order_status: item.order_status, source: item.source,
          order_date: item.order_date, created_at: item.created_at, updated_at: item.updated_at,
        }
      })

      let filteredData = transformedData
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filteredData = transformedData.filter(
          (t) => t.order_number.toLowerCase().includes(q) || t.invoice_number?.toLowerCase().includes(q) ||
            t.easebuzz_txn_id?.toLowerCase().includes(q) || t.customer_name?.toLowerCase().includes(q) ||
            t.customer_phone?.includes(q)
        )
      }
      setTransactions(filteredData)

      const today = new Date(); today.setHours(0, 0, 0, 0)
      setStats({
        totalTransactions: transformedData.length,
        completedAmount: transformedData.filter((t) => t.payment_status === "completed").reduce((s, t) => s + Number(t.total_amount), 0),
        pendingAmount: transformedData.filter((t) => t.payment_status === "pending").reduce((s, t) => s + Number(t.total_amount), 0),
        todayTransactions: transformedData.filter((t) => { const d = new Date(t.created_at); d.setHours(0, 0, 0, 0); return d.getTime() === today.getTime() }).length,
      })
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTransactions() }, [paymentStatusFilter, sourceFilter, dateFrom, dateTo, role, entityId])
  useEffect(() => { const t = setTimeout(() => fetchTransactions(), 300); return () => clearTimeout(t) }, [searchQuery])

  const clearFilters = () => {
    setSearchQuery(""); setPaymentStatusFilter("all"); setSourceFilter("all")
    setDateFrom(undefined); setDateTo(undefined); setDbPage(1)
  }

  const fetchDistributorCompanyInfo = async (shippingPincode: string) => {
    try {
      const { data: distributorsData } = await supabase
        .from("distributors")
        .select("company_name, name, email, phone_primary, gst_number, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode, bank_name, bank_account_number, bank_ifsc_code, bank_branch, serviceable_pincodes")
        .not("serviceable_pincodes", "is", null)
      if (distributorsData) {
        const match = distributorsData.find((dist: any) =>
          dist.serviceable_pincodes && Array.isArray(dist.serviceable_pincodes) && dist.serviceable_pincodes.includes(shippingPincode)
        )
        if (match) {
          const address = [match.shipping_address_line1, match.shipping_address_line2].filter(Boolean).join(', ')
          return {
            name: match.company_name || "Sadharmik & Company", address: address || '', city: match.shipping_city || '',
            pincode: match.shipping_pincode || '', phone: match.phone_primary || '', email: match.email || '',
            gst: match.gst_number || '',
            state: match.shipping_state ? `${match.shipping_pincode?.substring(0, 2) || ''}-${match.shipping_state}` : '',
            bankName: match.bank_name || '', accountNumber: match.bank_account_number || '',
            ifscCode: match.bank_ifsc_code || '', branch: match.bank_branch || '',
          }
        }
      }
    } catch (error) { console.error("Error fetching distributor info:", error) }
    return undefined
  }

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const { data: orderData, error: orderError } = await supabase.from("orders").select("*").eq("id", orderId).single()
      if (orderError) throw orderError
      const { data: customerData, error: customerError } = await supabase.from("customers").select("*").eq("id", orderData.customer_id).single()
      if (customerError) throw customerError
      const { data: itemsData, error: itemsError } = await supabase.from("order_items").select("*").eq("order_id", orderId)
      if (itemsError) throw itemsError
      const companyInfo = orderData.shipping_pincode ? await fetchDistributorCompanyInfo(orderData.shipping_pincode) : undefined
      const invoiceData = {
        order: {
          id: orderData.id, order_number: orderData.order_number,
          invoice_number_gst: orderData.invoice_number_gst, invoice_number_non_gst: orderData.invoice_number_non_gst,
          is_gst_invoice: orderData.is_gst_invoice, order_date: orderData.order_date,
          order_status: orderData.order_status, payment_status: orderData.payment_status,
          payment_method: orderData.payment_method || 'Not specified',
          subtotal: orderData.subtotal, discount_amount: orderData.discount_amount,
          cgst_amount: orderData.cgst_amount, sgst_amount: orderData.sgst_amount,
          igst_amount: orderData.igst_amount, shipping_charges: orderData.shipping_charges,
          total_amount: orderData.total_amount,
          shipping_room_number: orderData.shipping_room_number || undefined,
          shipping_floor: orderData.shipping_floor || undefined, shipping_wing: orderData.shipping_wing || undefined,
          shipping_flat_number: orderData.shipping_flat_number || undefined,
          shipping_floor_wing: orderData.shipping_floor_wing || undefined,
          shipping_building_name: orderData.shipping_building_name, shipping_street_area: orderData.shipping_street_area,
          shipping_landmark: orderData.shipping_landmark || undefined, shipping_city: orderData.shipping_city,
          shipping_state: orderData.shipping_state, shipping_pincode: orderData.shipping_pincode,
          shipping_country: orderData.shipping_country || undefined,
          shipping_full_address: orderData.shipping_full_address || undefined,
          billing_room_number: orderData.billing_room_number || undefined,
          billing_floor: orderData.billing_floor || undefined, billing_wing: orderData.billing_wing || undefined,
          billing_flat_number: orderData.billing_flat_number || undefined,
          billing_floor_wing: orderData.billing_floor_wing || undefined,
          billing_building_name: orderData.billing_building_name, billing_street_area: orderData.billing_street_area,
          billing_landmark: orderData.billing_landmark || undefined, billing_city: orderData.billing_city,
          billing_state: orderData.billing_state, billing_pincode: orderData.billing_pincode,
          billing_country: orderData.billing_country || undefined,
        },
        customer: {
          first_name: customerData.first_name, last_name: customerData.last_name,
          email: customerData.email || undefined, mobile_primary: customerData.mobile_primary,
          company_name: customerData.company_name || undefined, gst_number: customerData.gst_number || undefined,
          full_address: customerData.full_address || undefined, vip_number: customerData.vip_number || undefined,
        },
        items: itemsData.map(item => ({
          product_name: item.product_name, product_sku: item.product_sku || undefined,
          quantity: item.quantity, unit_price: item.unit_price, discount_percent: item.discount_percent,
          discount_amount: item.discount_amount, gst_percentage: item.gst_percentage,
          cgst_amount: item.cgst_amount, sgst_amount: item.sgst_amount, igst_amount: item.igst_amount,
          total: item.total, hsn_code: item.hsn_code || undefined,
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

  // ---- Easebuzz API Tab ----

  const fetchApiTransactions = useCallback(async (startDate: Date, endDate: Date) => {
    setApiLoading(true)
    setApiError(null)
    try {
      const response = await fetch("/api/easebuzz/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: format(startDate, "dd-MM-yyyy"),
          end_date: format(endDate, "dd-MM-yyyy"),
        }),
      })
      const result = await response.json()

      if (result.success) {
        setApiTransactions(result.data || [])
      } else {
        setApiError(result.error || "Failed to fetch from Easebuzz")
        setApiTransactions([])
      }
    } catch (error) {
      console.error("Error fetching Easebuzz API transactions:", error)
      setApiError("Failed to connect to Easebuzz API")
    } finally {
      setApiLoading(false)
    }
  }, [])

  // Auto-fetch on mount (admin only — distributors should not see raw merchant data)
  useEffect(() => {
    if (!isDistributor) {
      fetchApiTransactions(apiStartDate, apiEndDate)
    }
  }, [isDistributor])

  const handleDateRangeChange = () => {
    fetchApiTransactions(apiStartDate, apiEndDate)
  }

  const fetchTxnDetail = async (txnid: string) => {
    setDetailLoading(true)
    setDetailOpen(true)
    setTxnDetail(null)
    try {
      const response = await fetch(`/api/easebuzz/transactions?txnid=${encodeURIComponent(txnid)}`)
      const result = await response.json()
      if (result.success && result.status && result.msg?.length > 0) {
        setTxnDetail(result.msg[0])
      } else {
        toast.error("Could not fetch transaction details")
      }
    } catch (error) {
      console.error("Error fetching txn detail:", error)
      toast.error("Failed to fetch transaction details")
    } finally {
      setDetailLoading(false)
    }
  }

  const getFilteredApiTransactions = () => {
    let filtered = apiTransactions
    if (apiStatusFilter !== "all") filtered = filtered.filter((t) => t.status === apiStatusFilter)
    if (apiSearchQuery) {
      const q = apiSearchQuery.toLowerCase()
      filtered = filtered.filter((t) =>
        t.txnid?.toLowerCase().includes(q) || t.easepayid?.toLowerCase().includes(q) ||
        t.firstname?.toLowerCase().includes(q) || t.phone?.includes(q) || t.email?.toLowerCase().includes(q)
      )
    }
    return filtered
  }

  // Reset pages when filters change
  useEffect(() => { setApiPage(1) }, [apiSearchQuery, apiStatusFilter])
  useEffect(() => { setDbPage(1) }, [searchQuery, paymentStatusFilter, sourceFilter, dateFrom, dateTo])

  const paginate = <T,>(items: T[], page: number) => {
    const start = (page - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }

  const totalPages = (count: number) => Math.ceil(count / PAGE_SIZE)

  const apiStats = {
    total: apiTransactions.length,
    success: apiTransactions.filter((t) => t.status === "success").length,
    failed: apiTransactions.filter((t) => t.status === "failure").length,
    other: apiTransactions.filter((t) => ["dropped", "bounced", "userCancelled", "pending", "initiated"].includes(t.status)).length,
    successAmount: apiTransactions.filter((t) => t.status === "success").reduce((s, t) => s + Number(t.net_debit_amount || 0), 0),
  }

  // ---- Shared Helpers ----

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case "pending": return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case "failed": return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getEasebuzzStatusBadge = (status: string) => {
    switch (status) {
      case "success": return <Badge className="bg-green-100 text-green-800">Success</Badge>
      case "failure": return <Badge className="bg-red-100 text-red-800">Failure</Badge>
      case "pending": return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case "userCancelled": return <Badge className="bg-orange-100 text-orange-800">Cancelled</Badge>
      case "dropped": return <Badge className="bg-gray-100 text-gray-800">Dropped</Badge>
      case "bounced": return <Badge className="bg-purple-100 text-purple-800">Bounced</Badge>
      case "initiated": return <Badge className="bg-blue-100 text-blue-800">Initiated</Badge>
      case "preInitiated": return <Badge className="bg-blue-50 text-blue-600">Pre-Initiated</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "website": return <Badge className="bg-blue-100 text-blue-800">Website</Badge>
      case "backend": return <Badge className="bg-purple-100 text-purple-800">CRM</Badge>
      default: return <Badge variant="secondary">{source}</Badge>
    }
  }

  const formatCurrency = (amount: number) =>
    `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

  // Extract date from easepayid (format: EYYMMDD...)
  const getDateFromEasepayId = (easepayid: string) => {
    if (!easepayid || easepayid.length < 7) return "-"
    const yy = easepayid.substring(1, 3)
    const mm = easepayid.substring(3, 5)
    const dd = easepayid.substring(5, 7)
    const date = new Date(2000 + parseInt(yy), parseInt(mm) - 1, parseInt(dd))
    if (isNaN(date.getTime())) return "-"
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Easebuzz Transactions</h1>
          <p className="text-muted-foreground">View all payment transactions processed through Easebuzz</p>
        </div>
        <Button onClick={() => { fetchTransactions(); if (!isDistributor) fetchApiTransactions(apiStartDate, apiEndDate) }} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue={isDistributor ? "database" : "easebuzz-api"} className="space-y-6">
        <TabsList>
          {!isDistributor && <TabsTrigger value="easebuzz-api">Easebuzz API</TabsTrigger>}
          <TabsTrigger value="database">Database Orders</TabsTrigger>
        </TabsList>

        {/* ==================== EASEBUZZ API TAB (admin only) ==================== */}
        {!isDistributor && <TabsContent value="easebuzz-api" className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{apiStats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{apiStats.success}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{apiStats.failed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Other</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{apiStats.other}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(apiStats.successAmount)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by txn ID, name, phone, email..."
                  value={apiSearchQuery}
                  onChange={(e) => setApiSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={apiStatusFilter} onValueChange={setApiStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="userCancelled">Cancelled</SelectItem>
                <SelectItem value="dropped">Dropped</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="initiated">Initiated</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(apiStartDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={apiStartDate} onSelect={(d) => d && setApiStartDate(d)} initialFocus />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(apiEndDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={apiEndDate} onSelect={(d) => d && setApiEndDate(d)} initialFocus />
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={handleDateRangeChange} disabled={apiLoading}>
              Apply
            </Button>

            {(apiSearchQuery || apiStatusFilter !== "success") && (
              <Button variant="ghost" size="sm" onClick={() => { setApiSearchQuery(""); setApiStatusFilter("success") }}>
                <X className="mr-2 h-4 w-4" /> Clear
              </Button>
            )}
          </div>

          {/* Error */}
          {apiError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-800">{apiError}</p>
                <p className="text-sm text-red-600 mt-1">Make sure EASEBUZZ_MERCHANT_EMAIL is set in your .env.local file.</p>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Transactions ({getFilteredApiTransactions().length})</CardTitle>
              <CardDescription>All Easebuzz transactions for all customers - click eye icon to view full details</CardDescription>
            </CardHeader>
            <CardContent>
              {apiLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading all transactions from Easebuzz...</span>
                </div>
              ) : getFilteredApiTransactions().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No transactions found</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Txn ID (Order #)</TableHead>
                          <TableHead>Easepay ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Net Debit</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginate(getFilteredApiTransactions(), apiPage).map((txn, index) => (
                          <TableRow key={`${txn.easepayid}-${index}`}>
                            <TableCell className="font-mono text-sm font-medium">{txn.txnid}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{txn.easepayid}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{txn.firstname || "N/A"}</div>
                                {txn.phone && <div className="text-sm text-muted-foreground">{txn.phone}</div>}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(txn.total_debit_amount)}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(txn.net_debit_amount)}</TableCell>
                            <TableCell>{getEasebuzzStatusBadge(txn.status)}</TableCell>
                            <TableCell className="text-sm">{getDateFromEasepayId(txn.easepayid)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => fetchTxnDetail(txn.txnid)} title="View full details">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <PaginationControls
                    currentPage={apiPage}
                    totalItems={getFilteredApiTransactions().length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setApiPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

        {/* ==================== DATABASE TAB ==================== */}
        <TabsContent value="database" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.totalTransactions}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Amount</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(stats.completedAmount)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.pendingAmount)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Transactions</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.todayTransactions}</div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by order, txn ID, customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" />
                  </div>
                </div>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Payment Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="backend">CRM</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />{dateFrom ? format(dateFrom, "dd/MM/yyyy") : "From Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />{dateTo ? format(dateTo, "dd/MM/yyyy") : "To Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" onClick={clearFilters}><X className="mr-2 h-4 w-4" /> Clear</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transactions ({transactions.length})</CardTitle>
              <CardDescription>All orders with Easebuzz payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" /><span className="ml-2">Loading transactions...</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No transactions found</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Number</TableHead>
                        <TableHead>Easebuzz Txn ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment Status</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginate(transactions, dbPage).map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="font-medium">
                            <div>
                              <Link href={`/dashboard/orders/${txn.id}`} className="text-blue-600 hover:underline">{txn.order_number}</Link>
                              {txn.invoice_number && (
                                <button onClick={() => handleDownloadInvoice(txn.id)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary hover:underline" title="Download Invoice">
                                  <Download className="h-3 w-3" />{txn.invoice_number}
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{txn.easebuzz_txn_id}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{txn.customer_name || "N/A"}</div>
                              {txn.customer_phone && <div className="text-sm text-muted-foreground">{txn.customer_phone}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(txn.total_amount)}</TableCell>
                          <TableCell>{getPaymentStatusBadge(txn.payment_status)}</TableCell>
                          <TableCell><span className="capitalize">{txn.payment_method || "N/A"}</span></TableCell>
                          <TableCell>{getSourceBadge(txn.source)}</TableCell>
                          <TableCell className="text-sm">{formatDate(txn.created_at)}</TableCell>
                          <TableCell>
                            <Link href={`/dashboard/orders/${txn.id}`}>
                              <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    currentPage={dbPage}
                    totalItems={transactions.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setDbPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transaction Details</DialogTitle></DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" /><span className="ml-2">Loading details...</span>
            </div>
          ) : txnDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getEasebuzzStatusBadge(txnDetail.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold">{formatCurrency(Number(txnDetail.amount))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Amount Debited</p>
                  <p className="font-medium">{formatCurrency(Number(txnDetail.net_amount_debit))}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Mode</p>
                  <p className="font-medium">{txnDetail.card_type || txnDetail.mode || "N/A"}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Transaction Info</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DetailRow label="Txn ID" value={txnDetail.txnid} />
                  <DetailRow label="Easepay ID" value={txnDetail.easepayid} />
                  <DetailRow label="Date" value={txnDetail.addedon} />
                  <DetailRow label="Product Info" value={txnDetail.productinfo} />
                  <DetailRow label="Bank Ref" value={txnDetail.bank_ref_num} />
                  <DetailRow label="Bank Code" value={txnDetail.bankcode} />
                  <DetailRow label="Bank Name" value={txnDetail.bank_name} />
                  <DetailRow label="Payment Source" value={txnDetail.payment_source} />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Customer Info</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DetailRow label="Name" value={txnDetail.firstname} />
                  <DetailRow label="Email" value={txnDetail.email} />
                  <DetailRow label="Phone" value={txnDetail.phone} />
                  <DetailRow label="Name on Card" value={txnDetail.name_on_card} />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Payment Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DetailRow label="Card Type" value={txnDetail.card_type} />
                  <DetailRow label="Card Number" value={txnDetail.cardnum} />
                  <DetailRow label="Card Category" value={txnDetail.cardCategory} />
                  <DetailRow label="UPI VPA" value={txnDetail.upi_va} />
                  <DetailRow label="Deduction %" value={txnDetail.deduction_percentage} />
                  <DetailRow label="Cashback %" value={txnDetail.cash_back_percentage} />
                  <DetailRow label="Auth Code" value={txnDetail.auth_code} />
                  <DetailRow label="Auth Ref" value={txnDetail.auth_ref_num} />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">UDF Fields</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DetailRow label="UDF1 (Order ID)" value={txnDetail.udf1} />
                  <DetailRow label="UDF2 (Source)" value={txnDetail.udf2} />
                  <DetailRow label="UDF3" value={txnDetail.udf3} />
                  <DetailRow label="UDF4" value={txnDetail.udf4} />
                  <DetailRow label="UDF5" value={txnDetail.udf5} />
                </div>
              </div>
              {txnDetail.error && txnDetail.error !== "NA" && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Error / Message</h4>
                  <div className="text-sm p-3 bg-muted rounded">
                    <p>{txnDetail.error_Message || txnDetail.error}</p>
                    {txnDetail.error_code && txnDetail.error_code !== "NA" && (
                      <p className="text-muted-foreground mt-1">Error code: {txnDetail.error_code}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No details available</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaginationControls({
  currentPage, totalItems, pageSize, onPageChange,
}: {
  currentPage: number; totalItems: number; pageSize: number; onPageChange: (page: number) => void
}) {
  const total = Math.ceil(totalItems / pageSize)
  if (total <= 1) return null

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={currentPage === 1}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-sm font-medium">
          Page {currentPage} of {total}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === total}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(total)} disabled={currentPage === total}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  const displayValue = value && value !== "NA" && value !== "" ? value : "-"
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-all">{displayValue}</span>
    </div>
  )
}
