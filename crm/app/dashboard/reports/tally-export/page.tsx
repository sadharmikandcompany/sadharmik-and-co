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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  X,
  FileSpreadsheet,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Package,
  ShoppingCart,
  ShoppingBag,
  FileDown,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import {
  type SalesOrder,
  type Purchase,
  type Customer,
  type Vendor,
  type Product,
  type OrderItem,
  type PurchaseItem,
  generateSalesVouchersXML,
  generatePurchaseVouchersXML,
  generateLedgerMastersXML,
  generateStockItemMastersXML,
  generateAllDataXML,
  downloadTallyXML,
  exportSalesOrdersToExcel,
  exportPurchasesToExcel,
  exportMastersToExcel,
  exportAllDataToExcel,
} from "@/lib/tally-xml-generator"

type ExportTab = "sales" | "purchases" | "masters" | "all"

export default function TallyExportPage() {
  const [activeTab, setActiveTab] = useState<ExportTab>("sales")
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Sales data
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [salesLoading, setSalesLoading] = useState(false)

  // Purchase data
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)

  // Masters data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [completedOnly, setCompletedOnly] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Fetch data when tab changes or filters change
  useEffect(() => {
    if (activeTab === "sales" || activeTab === "all") {
      fetchSalesOrders()
    }
    if (activeTab === "purchases" || activeTab === "all") {
      fetchPurchases()
    }
    if (activeTab === "masters" || activeTab === "all") {
      fetchMasters()
    }
  }, [activeTab])

  // Refetch when date filters change
  useEffect(() => {
    if (activeTab === "sales") {
      fetchSalesOrders()
    } else if (activeTab === "purchases") {
      fetchPurchases()
    }
  }, [dateFrom, dateTo, completedOnly])

  const fetchSalesOrders = async () => {
    setSalesLoading(true)
    try {
      // Fetch orders with pagination to get all records (Supabase limits to 1000 per request)
      const pageSize = 1000
      let allOrdersData: any[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from("orders")
          .select("*")
          .order("order_date", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (completedOnly) {
          query = query.in("order_status", ["delivered", "completed"])
        }

        if (dateFrom) {
          query = query.gte("order_date", dateFrom.toISOString())
        }

        if (dateTo) {
          const endDate = new Date(dateTo)
          endDate.setHours(23, 59, 59, 999)
          query = query.lte("order_date", endDate.toISOString())
        }

        const { data: ordersData, error: ordersError } = await query

        if (ordersError) {
          console.error("Supabase error details:", ordersError)
          throw ordersError
        }

        if (ordersData && ordersData.length > 0) {
          allOrdersData = [...allOrdersData, ...ordersData]
          page++
          // If we got less than pageSize, we've reached the end
          hasMore = ordersData.length === pageSize
        } else {
          hasMore = false
        }
      }

      const ordersData = allOrdersData

      // Fetch order items for each order
      const orderIds = ordersData?.map((o) => o.id) || []

      // Fetch customer details for orders without customer_full_name
      const customerIds = [...new Set(ordersData?.map((o) => o.customer_id).filter(Boolean))]
      let customersMap: Record<string, { name: string; gst_number: string | null }> = {}

      if (customerIds.length > 0) {
        // Batch customer query to avoid URL length limits
        const customerBatchSize = 100
        for (let i = 0; i < customerIds.length; i += customerBatchSize) {
          const batchIds = customerIds.slice(i, i + customerBatchSize)
          const { data: customersData } = await supabase
            .from("customers")
            .select("id, first_name, last_name, company_name, gst_number")
            .in("id", batchIds)

          if (customersData) {
            customersData.forEach((c: { id: string; first_name: string | null; last_name: string | null; company_name: string | null; gst_number: string | null }) => {
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || "Unknown"
              customersMap[c.id] = { name, gst_number: c.gst_number }
            })
          }
        }
      }

      if (orderIds.length > 0) {
        // Batch order items query to avoid URL length limits
        const batchSize = 100
        let allItemsData: any[] = []

        for (let i = 0; i < orderIds.length; i += batchSize) {
          const batchIds = orderIds.slice(i, i + batchSize)
          const { data: itemsData, error: itemsError } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", batchIds)

          if (itemsError) throw itemsError
          if (itemsData) {
            allItemsData = [...allItemsData, ...itemsData]
          }
        }

        // Group items by order
        const itemsByOrder: Record<string, OrderItem[]> = {}
        allItemsData.forEach((item) => {
          if (!itemsByOrder[item.order_id]) {
            itemsByOrder[item.order_id] = []
          }
          itemsByOrder[item.order_id].push({
            product_name: item.product_name,
            product_sku: item.product_sku,
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
            hsn_code: item.hsn_code,
            gst_percentage: Number(item.gst_percentage || 18),
            cgst_amount: Number(item.cgst_amount || 0),
            sgst_amount: Number(item.sgst_amount || 0),
            igst_amount: Number(item.igst_amount || 0),
            subtotal: Number(item.subtotal || 0),
            total: Number(item.total || 0),
          })
        })

        // Map orders with items
        const processedOrders: SalesOrder[] = ordersData.map((order) => {
          // Build customer name from multiple sources
          let customerName = order.customer_full_name
          if (!customerName) {
            customerName = [order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ")
          }
          if (!customerName && order.company_name) {
            customerName = order.company_name
          }
          if (!customerName && order.customer_id && customersMap[order.customer_id]) {
            customerName = customersMap[order.customer_id].name
          }
          if (!customerName) {
            customerName = "Unknown Customer"
          }

          // Get GST number from order or customer
          const gstNumber = order.customer_gst_number ||
            (order.customer_id && customersMap[order.customer_id]?.gst_number) || null

          // Use GST invoice number if available, otherwise use non-GST invoice number
          const invoiceNumber = order.is_gst_invoice
            ? order.invoice_number_gst
            : order.invoice_number_non_gst

          return {
            id: order.id,
            order_number: order.order_number,
            invoice_number_gst: invoiceNumber,
            customer_name: customerName,
            customer_gst_number: gstNumber,
            customer_pan_number: order.customer_pan_number,
            customer_state: order.shipping_state,
            customer_city: order.shipping_city,
            customer_address: order.shipping_full_address,
            order_date: order.order_date,
            subtotal: Number(order.subtotal || 0),
            cgst_amount: Number(order.cgst_amount || 0),
            sgst_amount: Number(order.sgst_amount || 0),
            igst_amount: Number(order.igst_amount || 0),
            total_amount: Number(order.total_amount || 0),
            is_interstate: Number(order.igst_amount || 0) > 0,
            items: itemsByOrder[order.id] || [],
          }
        })

        setSalesOrders(processedOrders)
      } else {
        setSalesOrders([])
      }
    } catch (error) {
      console.error("Error fetching sales orders:", error)
      toast.error("Failed to fetch sales orders")
    } finally {
      setSalesLoading(false)
    }
  }

  const fetchPurchases = async () => {
    setPurchasesLoading(true)
    try {
      // Fetch purchases with pagination to get all records (Supabase limits to 1000 per request)
      const pageSize = 1000
      let allPurchasesData: any[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from("purchases")
          .select(`id, purchase_number, invoice_number, supplier_name, supplier_gst_number, supplier_state, supplier_city, supplier_address_line1, supplier_address_line2, purchase_date, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, purchase_status, payment_status`)
          .order("purchase_date", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (completedOnly) {
          query = query.in("purchase_status", ["received", "completed"])
        }

        if (dateFrom) {
          query = query.gte("purchase_date", dateFrom.toISOString())
        }

        if (dateTo) {
          const endDate = new Date(dateTo)
          endDate.setHours(23, 59, 59, 999)
          query = query.lte("purchase_date", endDate.toISOString())
        }

        const { data: purchasesPageData, error: purchasesError } = await query

        if (purchasesError) throw purchasesError

        if (purchasesPageData && purchasesPageData.length > 0) {
          allPurchasesData = [...allPurchasesData, ...purchasesPageData]
          page++
          hasMore = purchasesPageData.length === pageSize
        } else {
          hasMore = false
        }
      }

      const purchasesData = allPurchasesData

      // Fetch purchase items
      const purchaseIds = purchasesData?.map((p) => p.id) || []

      if (purchaseIds.length > 0) {
        // Batch purchase items query to avoid URL length limits
        const batchSize = 100
        let allItemsData: any[] = []

        for (let i = 0; i < purchaseIds.length; i += batchSize) {
          const batchIds = purchaseIds.slice(i, i + batchSize)
          const { data: itemsData, error: itemsError } = await supabase
            .from("purchase_items")
            .select("*")
            .in("purchase_id", batchIds)

          if (itemsError) throw itemsError
          if (itemsData) {
            allItemsData = [...allItemsData, ...itemsData]
          }
        }

        // Group items by purchase
        const itemsByPurchase: Record<string, PurchaseItem[]> = {}
        allItemsData.forEach((item) => {
          if (!itemsByPurchase[item.purchase_id]) {
            itemsByPurchase[item.purchase_id] = []
          }
          itemsByPurchase[item.purchase_id].push({
            product_name: item.product_name,
            product_sku: item.product_sku,
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
            hsn_code: item.hsn_code,
            gst_percentage: Number(item.gst_percentage || 18),
            cgst_amount: Number(item.cgst_amount || 0),
            sgst_amount: Number(item.sgst_amount || 0),
            igst_amount: Number(item.igst_amount || 0),
            subtotal: Number(item.subtotal || 0),
            total: Number(item.total || 0),
          })
        })

        // Map purchases with items
        const processedPurchases: Purchase[] = purchasesData.map((purchase) => ({
          id: purchase.id,
          purchase_number: purchase.purchase_number,
          invoice_number: purchase.invoice_number,
          supplier_name: purchase.supplier_name || "Unknown Supplier",
          supplier_gst_number: purchase.supplier_gst_number,
          supplier_state: purchase.supplier_state,
          supplier_city: purchase.supplier_city,
          supplier_address: [purchase.supplier_address_line1, purchase.supplier_address_line2]
            .filter(Boolean)
            .join(", "),
          purchase_date: purchase.purchase_date,
          subtotal: Number(purchase.subtotal || 0),
          cgst_amount: Number(purchase.cgst_amount || 0),
          sgst_amount: Number(purchase.sgst_amount || 0),
          igst_amount: Number(purchase.igst_amount || 0),
          total_amount: Number(purchase.total_amount || 0),
          is_interstate: Number(purchase.igst_amount || 0) > 0,
          items: itemsByPurchase[purchase.id] || [],
        }))

        setPurchases(processedPurchases)
      } else {
        setPurchases([])
      }
    } catch (error) {
      console.error("Error fetching purchases:", error)
      toast.error("Failed to fetch purchases")
    } finally {
      setPurchasesLoading(false)
    }
  }

  const fetchMasters = async () => {
    setMastersLoading(true)
    try {
      // Fetch customers with pagination (Supabase limits to 1000 per request)
      const pageSize = 1000
      let allCustomersData: any[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        const { data: customersPageData, error: customersError } = await supabase
          .from("customers")
          .select("id, first_name, last_name, company_name, gst_number, pan_card_number, email, mobile_primary, full_address, shipping_city, shipping_state, shipping_pincode")
          .eq("is_active", true)
          .order("first_name")
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (customersError) throw customersError

        if (customersPageData && customersPageData.length > 0) {
          allCustomersData = [...allCustomersData, ...customersPageData]
          page++
          hasMore = customersPageData.length === pageSize
        } else {
          hasMore = false
        }
      }

      const processedCustomers: Customer[] =
        allCustomersData.map((c) => ({
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || "Unknown",
          company_name: c.company_name,
          gst_number: c.gst_number,
          pan_number: c.pan_card_number,
          email: c.email,
          mobile: c.mobile_primary,
          address: c.full_address,
          city: c.shipping_city,
          state: c.shipping_state,
          pincode: c.shipping_pincode,
        })) || []

      setCustomers(processedCustomers)

      // Fetch vendors with pagination
      let allVendorsData: any[] = []
      page = 0
      hasMore = true

      while (hasMore) {
        const { data: vendorsPageData, error: vendorsError } = await supabase
          .from("vendors")
          .select("id, vendor_name, company_name, gst_number, email, mobile_primary, address_line1, address_line2, city, state, pincode")
          .eq("is_active", true)
          .order("vendor_name")
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (vendorsError) throw vendorsError

        if (vendorsPageData && vendorsPageData.length > 0) {
          allVendorsData = [...allVendorsData, ...vendorsPageData]
          page++
          hasMore = vendorsPageData.length === pageSize
        } else {
          hasMore = false
        }
      }

      const processedVendors: Vendor[] =
        allVendorsData.map((v) => ({
          id: v.id,
          name: v.vendor_name || v.company_name || "Unknown Vendor",
          company_name: v.company_name,
          gst_number: v.gst_number,
          email: v.email,
          mobile: v.mobile_primary,
          address: [v.address_line1, v.address_line2].filter(Boolean).join(", "),
          city: v.city,
          state: v.state,
          pincode: v.pincode,
        })) || []

      setVendors(processedVendors)

      // Fetch products with pagination
      let allProductsData: any[] = []
      page = 0
      hasMore = true

      while (hasMore) {
        const { data: productsPageData, error: productsError } = await supabase
          .from("products")
          .select("id, name, hsn_code, brand")
          .eq("is_active", true)
          .order("name")
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (productsError) throw productsError

        if (productsPageData && productsPageData.length > 0) {
          allProductsData = [...allProductsData, ...productsPageData]
          page++
          hasMore = productsPageData.length === pageSize
        } else {
          hasMore = false
        }
      }

      const processedProducts: Product[] =
        allProductsData.map((p) => ({
          id: p.id,
          name: p.name,
          sku: null,
          hsn_code: p.hsn_code,
          unit: "Nos",
          category: p.brand || "Primary",
        })) || []

      setProducts(processedProducts)
    } catch (error) {
      console.error("Error fetching masters:", error)
      toast.error("Failed to fetch masters")
    } finally {
      setMastersLoading(false)
    }
  }

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setSearchTerm("")
    setCurrentPage(1)
  }

  const hasActiveFilters = dateFrom || dateTo || searchTerm !== ""

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, dateFrom, dateTo, activeTab])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Filter data based on search
  const filteredSalesOrders = salesOrders.filter(
    (order) =>
      searchTerm === "" ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.invoice_number_gst?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPurchases = purchases.filter(
    (purchase) =>
      searchTerm === "" ||
      purchase.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredCustomers = customers.filter(
    (customer) =>
      searchTerm === "" ||
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.gst_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredVendors = vendors.filter(
    (vendor) =>
      searchTerm === "" ||
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.gst_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredProducts = products.filter(
    (product) =>
      searchTerm === "" ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.hsn_code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Pagination helpers
  const getPaginatedData = <T,>(data: T[]): T[] => {
    const startIndex = (currentPage - 1) * pageSize
    return data.slice(startIndex, startIndex + pageSize)
  }

  const getTotalPages = (totalItems: number): number => {
    return Math.ceil(totalItems / pageSize)
  }

  // Calculate summary stats
  const salesStats = {
    count: filteredSalesOrders.length,
    total: filteredSalesOrders.reduce((sum, o) => sum + o.total_amount, 0),
    cgst: filteredSalesOrders.reduce((sum, o) => sum + o.cgst_amount, 0),
    sgst: filteredSalesOrders.reduce((sum, o) => sum + o.sgst_amount, 0),
    igst: filteredSalesOrders.reduce((sum, o) => sum + o.igst_amount, 0),
  }

  const purchaseStats = {
    count: filteredPurchases.length,
    total: filteredPurchases.reduce((sum, p) => sum + p.total_amount, 0),
    cgst: filteredPurchases.reduce((sum, p) => sum + p.cgst_amount, 0),
    sgst: filteredPurchases.reduce((sum, p) => sum + p.sgst_amount, 0),
    igst: filteredPurchases.reduce((sum, p) => sum + p.igst_amount, 0),
  }

  // Export handlers
  const handleExportSales = () => {
    if (filteredSalesOrders.length === 0) {
      toast.error("No sales orders to export")
      return
    }
    setExporting(true)
    try {
      const xml = generateSalesVouchersXML(filteredSalesOrders)
      const filename = `tally-sales-vouchers-${format(new Date(), "yyyy-MM-dd")}`
      downloadTallyXML(xml, filename)
      toast.success(`Exported ${filteredSalesOrders.length} sales vouchers`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export sales vouchers")
    } finally {
      setExporting(false)
    }
  }

  const handleExportPurchases = () => {
    if (filteredPurchases.length === 0) {
      toast.error("No purchases to export")
      return
    }
    setExporting(true)
    try {
      const xml = generatePurchaseVouchersXML(filteredPurchases)
      const filename = `tally-purchase-vouchers-${format(new Date(), "yyyy-MM-dd")}`
      downloadTallyXML(xml, filename)
      toast.success(`Exported ${filteredPurchases.length} purchase vouchers`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export purchase vouchers")
    } finally {
      setExporting(false)
    }
  }

  const handleExportMasters = () => {
    if (filteredCustomers.length === 0 && filteredVendors.length === 0 && filteredProducts.length === 0) {
      toast.error("No masters to export")
      return
    }
    setExporting(true)
    try {
      // Export ledgers (customers + vendors)
      const ledgerXml = generateLedgerMastersXML(filteredCustomers, filteredVendors)
      const ledgerFilename = `tally-ledger-masters-${format(new Date(), "yyyy-MM-dd")}`
      downloadTallyXML(ledgerXml, ledgerFilename)

      // Export stock items
      if (filteredProducts.length > 0) {
        const stockXml = generateStockItemMastersXML(filteredProducts)
        const stockFilename = `tally-stock-item-masters-${format(new Date(), "yyyy-MM-dd")}`
        downloadTallyXML(stockXml, stockFilename)
      }

      toast.success(
        `Exported ${filteredCustomers.length} customers, ${filteredVendors.length} vendors, ${filteredProducts.length} products`
      )
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export masters")
    } finally {
      setExporting(false)
    }
  }

  const handleExportAll = () => {
    setExporting(true)
    try {
      const xml = generateAllDataXML(
        filteredSalesOrders,
        filteredPurchases,
        filteredCustomers,
        filteredVendors,
        filteredProducts
      )
      const filename = `tally-complete-export-${format(new Date(), "yyyy-MM-dd")}`
      downloadTallyXML(xml, filename)
      toast.success("Exported all data to Tally XML")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export data")
    } finally {
      setExporting(false)
    }
  }

  // Excel Export Handlers
  const handleExportSalesExcel = () => {
    if (filteredSalesOrders.length === 0) {
      toast.error("No sales orders to export")
      return
    }
    setExporting(true)
    try {
      const filename = `sales-orders-${format(new Date(), "yyyy-MM-dd")}`
      exportSalesOrdersToExcel(filteredSalesOrders, filename)
      toast.success(`Exported ${filteredSalesOrders.length} sales orders to Excel`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export to Excel")
    } finally {
      setExporting(false)
    }
  }

  const handleExportPurchasesExcel = () => {
    if (filteredPurchases.length === 0) {
      toast.error("No purchases to export")
      return
    }
    setExporting(true)
    try {
      const filename = `purchases-${format(new Date(), "yyyy-MM-dd")}`
      exportPurchasesToExcel(filteredPurchases, filename)
      toast.success(`Exported ${filteredPurchases.length} purchases to Excel`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export to Excel")
    } finally {
      setExporting(false)
    }
  }

  const handleExportMastersExcel = () => {
    if (filteredCustomers.length === 0 && filteredVendors.length === 0 && filteredProducts.length === 0) {
      toast.error("No masters to export")
      return
    }
    setExporting(true)
    try {
      const filename = `masters-${format(new Date(), "yyyy-MM-dd")}`
      exportMastersToExcel(filteredCustomers, filteredVendors, filteredProducts, filename)
      toast.success(
        `Exported ${filteredCustomers.length} customers, ${filteredVendors.length} vendors, ${filteredProducts.length} products to Excel`
      )
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export to Excel")
    } finally {
      setExporting(false)
    }
  }

  const handleExportAllExcel = () => {
    setExporting(true)
    try {
      const filename = `complete-export-${format(new Date(), "yyyy-MM-dd")}`
      exportAllDataToExcel(
        filteredSalesOrders,
        filteredPurchases,
        filteredCustomers,
        filteredVendors,
        filteredProducts,
        filename
      )
      toast.success("Exported all data to Excel")
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export to Excel")
    } finally {
      setExporting(false)
    }
  }

  const isLoading = salesLoading || purchasesLoading || mastersLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Tally Export</h1>
            <p className="text-sm text-muted-foreground">
              Export data to Tally ERP 9 / TallyPrime in XML format
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ExportTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Sales Vouchers
          </TabsTrigger>
          <TabsTrigger value="purchases" className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Purchase Vouchers
          </TabsTrigger>
          <TabsTrigger value="masters" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Masters
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Export All
          </TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesStats.count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(salesStats.total)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">CGST</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(salesStats.cgst)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">SGST</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(salesStats.sgst)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">IGST</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(salesStats.igst)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Vouchers</CardTitle>
              <CardDescription>
                Export GST sales invoices to Tally
              </CardDescription>
              <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[200px]"
                />

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

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="completedOnly"
                    checked={completedOnly}
                    onCheckedChange={(checked) => setCompletedOnly(checked as boolean)}
                  />
                  <label htmlFor="completedOnly" className="text-sm">
                    Delivered only
                  </label>
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}

                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={handleExportSalesExcel} disabled={exporting || salesLoading}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Export Excel
                  </Button>
                  <Button onClick={handleExportSales} disabled={exporting || salesLoading}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download Tally XML
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Order #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>GST #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead className="text-right">GST</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getPaginatedData(filteredSalesOrders).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center">
                              No orders found
                            </TableCell>
                          </TableRow>
                        ) : (
                          getPaginatedData(filteredSalesOrders).map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">
                                {order.invoice_number_gst || "-"}
                              </TableCell>
                              <TableCell>{order.order_number}</TableCell>
                              <TableCell>{order.customer_name}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {order.customer_gst_number || "-"}
                              </TableCell>
                              <TableCell>
                                {format(new Date(order.order_date), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(order.subtotal)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(
                                  order.cgst_amount + order.sgst_amount + order.igst_amount
                                )}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {formatCurrency(order.total_amount)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Rows per page:</span>
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
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {getTotalPages(filteredSalesOrders.length) || 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage >= getTotalPages(filteredSalesOrders.length)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setCurrentPage(getTotalPages(filteredSalesOrders.length))
                          }
                          disabled={currentPage >= getTotalPages(filteredSalesOrders.length)}
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchases" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Purchases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{purchaseStats.count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(purchaseStats.total)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  CGST Input
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(purchaseStats.cgst)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  SGST Input
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(purchaseStats.sgst)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  IGST Input
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(purchaseStats.igst)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Table */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Vouchers</CardTitle>
              <CardDescription>Export purchase invoices to Tally</CardDescription>
              <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <Input
                  placeholder="Search purchases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[200px]"
                />

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

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="completedOnlyPurchase"
                    checked={completedOnly}
                    onCheckedChange={(checked) => setCompletedOnly(checked as boolean)}
                  />
                  <label htmlFor="completedOnlyPurchase" className="text-sm">
                    Received only
                  </label>
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}

                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={handleExportPurchasesExcel} disabled={exporting || purchasesLoading}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Export Excel
                  </Button>
                  <Button onClick={handleExportPurchases} disabled={exporting || purchasesLoading}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download Tally XML
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {purchasesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>PO #</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>GST #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead className="text-right">GST</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getPaginatedData(filteredPurchases).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center">
                              No purchases found
                            </TableCell>
                          </TableRow>
                        ) : (
                          getPaginatedData(filteredPurchases).map((purchase) => (
                            <TableRow key={purchase.id}>
                              <TableCell className="font-medium">
                                {purchase.invoice_number || "-"}
                              </TableCell>
                              <TableCell>{purchase.purchase_number}</TableCell>
                              <TableCell>{purchase.supplier_name}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {purchase.supplier_gst_number || "-"}
                              </TableCell>
                              <TableCell>
                                {format(new Date(purchase.purchase_date), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(purchase.subtotal)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(
                                  purchase.cgst_amount + purchase.sgst_amount + purchase.igst_amount
                                )}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {formatCurrency(purchase.total_amount)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Rows per page:</span>
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
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {getTotalPages(filteredPurchases.length) || 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage >= getTotalPages(filteredPurchases.length)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(getTotalPages(filteredPurchases.length))}
                          disabled={currentPage >= getTotalPages(filteredPurchases.length)}
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Masters Tab */}
        <TabsContent value="masters" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Customers (Sundry Debtors)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredCustomers.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Vendors (Sundry Creditors)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredVendors.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Products (Stock Items)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredProducts.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Tables */}
          <Card>
            <CardHeader>
              <CardTitle>Masters Export</CardTitle>
              <CardDescription>
                Export Ledgers (Customers, Vendors) and Stock Items to Tally
              </CardDescription>
              <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[200px]"
                />

                {searchTerm && (
                  <Button variant="ghost" onClick={() => setSearchTerm("")} className="gap-2">
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}

                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={handleExportMastersExcel} disabled={exporting || mastersLoading}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Export Excel
                  </Button>
                  <Button onClick={handleExportMasters} disabled={exporting || mastersLoading}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download Tally XML
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {mastersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Customers Table */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Customers (Sundry Debtors)</h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>GST Number</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>Contact</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getPaginatedData(filteredCustomers).slice(0, 5).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center">
                                No customers found
                              </TableCell>
                            </TableRow>
                          ) : (
                            getPaginatedData(filteredCustomers)
                              .slice(0, 5)
                              .map((customer) => (
                                <TableRow key={customer.id}>
                                  <TableCell className="font-medium">{customer.name}</TableCell>
                                  <TableCell>{customer.company_name || "-"}</TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {customer.gst_number || "-"}
                                  </TableCell>
                                  <TableCell>{customer.state || "-"}</TableCell>
                                  <TableCell>{customer.mobile || customer.email || "-"}</TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredCustomers.length > 5 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        ... and {filteredCustomers.length - 5} more customers
                      </p>
                    )}
                  </div>

                  {/* Vendors Table */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Vendors (Sundry Creditors)</h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>GST Number</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>Contact</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredVendors.slice(0, 5).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center">
                                No vendors found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredVendors.slice(0, 5).map((vendor) => (
                              <TableRow key={vendor.id}>
                                <TableCell className="font-medium">{vendor.name}</TableCell>
                                <TableCell>{vendor.company_name || "-"}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {vendor.gst_number || "-"}
                                </TableCell>
                                <TableCell>{vendor.state || "-"}</TableCell>
                                <TableCell>{vendor.mobile || vendor.email || "-"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredVendors.length > 5 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        ... and {filteredVendors.length - 5} more vendors
                      </p>
                    )}
                  </div>

                  {/* Products Table */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Products (Stock Items)</h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>HSN Code</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Unit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.slice(0, 5).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">
                                No products found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredProducts.slice(0, 5).map((product) => (
                              <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {product.hsn_code || "-"}
                                </TableCell>
                                <TableCell>{product.category || "-"}</TableCell>
                                <TableCell>{product.unit}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredProducts.length > 5 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        ... and {filteredProducts.length - 5} more products
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export All Tab */}
        <TabsContent value="all" className="space-y-4">
          {/* Summary Stats */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sales Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredSalesOrders.length}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(salesStats.total)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Purchases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredPurchases.length}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(purchaseStats.total)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredCustomers.length}</div>
                <p className="text-xs text-muted-foreground">Sundry Debtors</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vendors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredVendors.length}</div>
                <p className="text-xs text-muted-foreground">Sundry Creditors</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredProducts.length}</div>
                <p className="text-xs text-muted-foreground">Stock Items</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Complete Export</CardTitle>
              <CardDescription>
                Export all data (Masters + Vouchers) in a single XML file for Tally import
              </CardDescription>
              <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
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

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="completedOnlyAll"
                    checked={completedOnly}
                    onCheckedChange={(checked) => setCompletedOnly(checked as boolean)}
                  />
                  <label htmlFor="completedOnlyAll" className="text-sm">
                    Completed/Delivered only
                  </label>
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}

                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={handleExportAllExcel} disabled={exporting || isLoading} size="lg">
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Export All to Excel
                  </Button>
                  <Button onClick={handleExportAll} disabled={exporting || isLoading} size="lg">
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export All to Tally XML
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <h4 className="font-semibold mb-2">Export Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Sales Vouchers:</span>
                        <span className="ml-2 font-medium">{filteredSalesOrders.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Purchase Vouchers:</span>
                        <span className="ml-2 font-medium">{filteredPurchases.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Customer Ledgers:</span>
                        <span className="ml-2 font-medium">{filteredCustomers.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vendor Ledgers:</span>
                        <span className="ml-2 font-medium">{filteredVendors.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stock Items:</span>
                        <span className="ml-2 font-medium">{filteredProducts.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="font-semibold mb-2">Import Instructions</h4>
                    <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                      <li>Download the Tally XML file using the button above</li>
                      <li>Open Tally ERP 9 or TallyPrime</li>
                      <li>
                        Go to <strong>Gateway of Tally &gt; Import Data</strong>
                      </li>
                      <li>Select the downloaded XML file</li>
                      <li>Review the import summary and confirm</li>
                    </ol>
                    <p className="mt-3 text-xs text-amber-600">
                      Note: Ensure the required ledger groups (Sundry Debtors, Sundry Creditors,
                      Sales, Purchase) and GST ledgers are already configured in Tally before
                      importing.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
