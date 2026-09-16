"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Edit,
  FileText,
  Package,
  DollarSign,
  MapPin,
  Calendar,
  User,
  Mail,
  Phone,
  Building,
  CreditCard,
  Truck,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Printer,
  Droplets,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { generatePurchaseInvoice } from "@/lib/invoice-generator"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"

type Purchase = {
  id: string
  purchase_number: string
  vendor_id: string | null
  distributor_id: string | null
  purchase_status: string
  payment_status: string
  payment_method: string | null
  transaction_id: string | null
  supplier_name: string
  supplier_email: string | null
  supplier_phone: string | null
  supplier_address_line1: string | null
  supplier_address_line2: string | null
  supplier_city: string | null
  supplier_state: string | null
  supplier_pincode: string | null
  supplier_country: string | null
  supplier_gst_number: string | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  shipping_charges: number
  other_charges: number
  total_amount: number
  shipping_method: string | null
  tracking_number: string | null
  courier_partner: string | null
  expected_delivery_date: string | null
  shipped_date: string | null
  received_date: string | null
  purchase_notes: string | null
  internal_notes: string | null
  terms_and_conditions: string | null
  invoice_number: string | null
  invoice_date: string | null
  invoice_url: string | null
  is_urgent: boolean
  purchase_date: string
  created_at: string
  updated_at: string
}

type PurchaseItem = {
  id: string
  purchase_id: string
  product_id: string
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  hsn_code: string | null
  gst_percentage: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  subtotal: number
  total: number
  received_quantity: number
  created_at: string
  updated_at: string
}

type Vendor = {
  id: string
  vendor_name: string
  company_name: string | null
  contact_person: string | null
  mobile_primary: string
  email: string | null
}

type Distributor = {
  id: string
  name: string
  company_name: string
  phone_primary: string
  email: string
  gst_number: string | null
  shipping_address_line1: string | null
  shipping_address_line2: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_pincode: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  bank_branch: string | null
}

type LooseStockTransaction = {
  id: string
  loose_stock_id: string
  transaction_type: string
  quantity_liters: number
  price_per_liter: number
  total_amount: number
  vendor_id: string | null
  vendor_name: string | null
  invoice_number: string | null
  batch_number: string | null
  transaction_notes: string | null
  transaction_date: string
  created_at: string
  loose_stock: {
    product_categories: {
      name: string
    }
  }
}

export default function PurchaseDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const purchaseId = params?.id as string
  const { role } = useUserRole()
  const isDistributor = role === "main_distributor" || role === "sub_distributor"

  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [looseStockTransactions, setLooseStockTransactions] = useState<LooseStockTransaction[]>([])
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [distributor, setDistributor] = useState<Distributor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (purchaseId) {
      fetchPurchaseDetails()
    }
  }, [purchaseId])

  const fetchPurchaseDetails = async () => {
    setLoading(true)

    try {
      // Fetch purchase details (use maybeSingle so missing row doesn't throw)
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseId)
        .maybeSingle()

      if (purchaseError) throw purchaseError

      // FALLBACK: id may belong to loose_stock_transactions instead of purchases
      if (!purchaseData) {
        // Plain select (no embedded join — RLS / embed quirks can return null with !inner)
        const { data: looseRow, error: looseRowError } = await supabase
          .from("loose_stock_transactions")
          .select("*")
          .eq("id", purchaseId)
          .maybeSingle()

        if (looseRowError) {
          console.error("loose_stock_transactions lookup error:", looseRowError?.message, looseRowError)
          throw looseRowError
        }
        if (!looseRow) {
          console.warn("No row found in either purchases or loose_stock_transactions for id:", purchaseId)
          toast.error("Purchase not found")
          router.push("/dashboard/purchases")
          return
        }

        // Enrich loose_stock + product_categories separately so we don't depend on embed
        let categoryName = "Unknown"
        if (looseRow.loose_stock_id) {
          const { data: ls } = await supabase
            .from("loose_stock")
            .select("id, category_id")
            .eq("id", looseRow.loose_stock_id)
            .maybeSingle()
          if (ls?.category_id) {
            const { data: pc } = await supabase
              .from("product_categories")
              .select("name")
              .eq("id", ls.category_id)
              .maybeSingle()
            if (pc?.name) categoryName = pc.name
          }
        }

        // Resolve vendor name if missing
        let resolvedVendorName = looseRow.vendor_name as string | null
        if (!resolvedVendorName && looseRow.vendor_id) {
          const { data: v } = await supabase
            .from("vendors")
            .select("id, vendor_name, company_name, contact_person, mobile_primary, email")
            .eq("id", looseRow.vendor_id)
            .maybeSingle()
          if (v) {
            resolvedVendorName = v.vendor_name
            setVendor(v as Vendor)
          }
        }

        const total = Number(looseRow.total_amount || (Number(looseRow.quantity_liters || 0) * Number(looseRow.price_per_liter || 0)))
        const syntheticPurchase: Purchase = {
          id: looseRow.id,
          purchase_number: `LOOSE-${looseRow.invoice_number || looseRow.id.substring(0, 8).toUpperCase()}`,
          vendor_id: looseRow.vendor_id ?? null,
          distributor_id: null,
          purchase_status: "received",
          payment_status: "completed",
          payment_method: null,
          transaction_id: null,
          supplier_name: resolvedVendorName || "Unknown Vendor",
          supplier_email: null,
          supplier_phone: null,
          supplier_address_line1: null,
          supplier_address_line2: null,
          supplier_city: null,
          supplier_state: null,
          supplier_pincode: null,
          supplier_country: null,
          supplier_gst_number: null,
          subtotal: total,
          discount_amount: 0,
          tax_amount: 0,
          gst_amount: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
          shipping_charges: 0,
          other_charges: 0,
          total_amount: total,
          shipping_method: null,
          tracking_number: null,
          courier_partner: null,
          expected_delivery_date: null,
          shipped_date: null,
          received_date: looseRow.transaction_date || looseRow.created_at,
          purchase_notes: looseRow.transaction_notes || null,
          internal_notes: null,
          terms_and_conditions: null,
          invoice_number: looseRow.invoice_number || null,
          invoice_date: null,
          invoice_url: null,
          is_urgent: false,
          purchase_date: looseRow.transaction_date || looseRow.created_at,
          created_at: looseRow.created_at,
          updated_at: looseRow.created_at,
        }

        const enrichedLoose = {
          ...looseRow,
          loose_stock: { product_categories: { name: categoryName } },
        } as LooseStockTransaction

        setPurchase(syntheticPurchase)
        setLooseStockTransactions([enrichedLoose])
        setPurchaseItems([])
        return
      }

      setPurchase(purchaseData)

      // Fetch purchase items
      const { data: itemsData, error: itemsError } = await supabase
        .from("purchase_items")
        .select("*")
        .eq("purchase_id", purchaseId)
        .order("created_at")

      if (itemsError) throw itemsError

      setPurchaseItems(itemsData || [])

      // Fetch loose stock transactions for this purchase
      const { data: looseTransactions, error: looseError } = await supabase
        .from("loose_stock_transactions")
        .select(`
          *,
          loose_stock!inner (
            product_categories!inner (
              name
            )
          )
        `)
        .eq("purchase_id", purchaseId)
        .eq("transaction_type", "purchase")
        .order("created_at")

      if (looseError) {
        console.error("Error fetching loose stock transactions:", looseError)
      } else if (looseTransactions) {
        setLooseStockTransactions(looseTransactions)
      }

      // Fetch vendor if vendor_id exists
      if (purchaseData.vendor_id) {
        const { data: vendorData, error: vendorError } = await supabase
          .from("vendors")
          .select("id, vendor_name, company_name, contact_person, mobile_primary, email")
          .eq("id", purchaseData.vendor_id)
          .single()

        if (!vendorError && vendorData) {
          setVendor(vendorData)
        }
      }

      // Fetch distributor if distributor_id exists
      if (purchaseData.distributor_id) {
        const { data: distributorData, error: distributorError } = await supabase
          .from("distributors")
          .select("id, name, company_name, phone_primary, email, gst_number, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode, bank_name, bank_account_number, bank_ifsc_code, bank_branch")
          .eq("id", purchaseData.distributor_id)
          .single()

        if (!distributorError && distributorData) {
          setDistributor(distributorData)
        }
      }
    } catch (error: any) {
      console.error("Error fetching purchase details:", error?.message || error, error)
      toast.error(error?.message || "Failed to fetch purchase details")
      router.push("/dashboard/purchases")
    } finally {
      setLoading(false)
    }
  }

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "completed" || lowerStatus === "received") {
      return "default"
    }
    if (lowerStatus === "pending" || lowerStatus === "processing" || lowerStatus === "shipped" || lowerStatus === "partial") {
      return "outline"
    }
    if (lowerStatus === "cancelled" || lowerStatus === "failed") {
      return "destructive"
    }
    if (lowerStatus === "partially_received") {
      return "secondary"
    }
    return "secondary"
  }

  const getStatusIcon = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "completed" || lowerStatus === "received") {
      return <CheckCircle className="h-4 w-4" />
    }
    if (lowerStatus === "cancelled" || lowerStatus === "failed") {
      return <AlertCircle className="h-4 w-4" />
    }
    return <Clock className="h-4 w-4" />
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    return format(new Date(dateString), "PPP")
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "N/A"
    return format(new Date(dateString), "PPP 'at' p")
  }

  const handleGenerateInvoice = () => {
    try {
      if (!purchase || purchaseItems.length === 0) {
        toast.error("Missing data for invoice generation")
        return
      }

      // Build company info: use distributor details if logged in as distributor
      const distributorCompanyInfo = isDistributor && distributor ? {
        name: distributor.company_name || distributor.name,
        address: [distributor.shipping_address_line1, distributor.shipping_address_line2].filter(Boolean).join(', '),
        city: distributor.shipping_city || '',
        pincode: distributor.shipping_pincode || '',
        phone: distributor.phone_primary || '',
        email: distributor.email || '',
        gst: distributor.gst_number || '',
        state: distributor.shipping_state || '',
        bankName: distributor.bank_name || '',
        accountNumber: distributor.bank_account_number || '',
        ifscCode: distributor.bank_ifsc_code || '',
        branch: distributor.bank_branch || '',
      } : undefined

      const invoiceData = {
        purchase: {
          id: purchase.id,
          purchase_number: purchase.purchase_number,
          purchase_date: purchase.purchase_date,
          purchase_status: purchase.purchase_status,
          payment_status: purchase.payment_status,
          payment_method: purchase.payment_method || 'Not specified',
          supplier_name: purchase.supplier_name,
          supplier_address: purchase.supplier_address_line1 || undefined,
          supplier_city: purchase.supplier_city || undefined,
          supplier_state: purchase.supplier_state || undefined,
          supplier_pincode: purchase.supplier_pincode || undefined,
          supplier_gst: purchase.supplier_gst_number || undefined,
          subtotal: purchase.subtotal,
          discount_amount: purchase.discount_amount,
          cgst_amount: purchase.cgst_amount,
          sgst_amount: purchase.sgst_amount,
          igst_amount: purchase.igst_amount,
          total_amount: purchase.total_amount,
          invoice_number: purchase.invoice_number || undefined,
          invoice_date: purchase.invoice_date || undefined,
        },
        items: purchaseItems.map(item => ({
          product_name: item.product_name,
          product_sku: item.product_sku || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          gst_percentage: item.gst_percentage,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total: item.total,
          hsn_code: item.hsn_code || undefined,
        })),
        companyInfo: distributorCompanyInfo,
      }

      generatePurchaseInvoice(invoiceData)
      toast.success("Purchase order generated successfully")
    } catch (error) {
      console.error("Error generating purchase order:", error)
      toast.error("Failed to generate purchase order")
    }
  }

  const handlePrintInvoice = () => {
    toast.info("Print functionality - generating PDF for printing")
    handleGenerateInvoice()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Loading...</h1>
        </div>
      </div>
    )
  }

  if (!purchase) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Purchase Not Found</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{purchase.purchase_number}</h1>
              {purchase.is_urgent && (
                <Badge variant="destructive">Urgent</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Purchase Order Details
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintInvoice}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateInvoice}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          {!purchase.purchase_number?.startsWith("LOOSE-") && (
            <Button size="sm" onClick={() => router.push(`/dashboard/purchases/${purchaseId}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Purchase Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(purchase.purchase_status)}
              <Badge variant={getStatusVariant(purchase.purchase_status)} className="text-base">
                {purchase.purchase_status.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(purchase.payment_status)}
              <Badge variant={getStatusVariant(purchase.payment_status)} className="text-base">
                {purchase.payment_status.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(purchase.total_amount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="items">
            <Package className="mr-2 h-4 w-4" />
            Items ({purchaseItems.length + looseStockTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="payment">
            <DollarSign className="mr-2 h-4 w-4" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="shipping">
            <Truck className="mr-2 h-4 w-4" />
            Shipping
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Supplier Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Supplier Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Name</div>
                  <div className="font-semibold">{purchase.supplier_name}</div>
                </div>

                {vendor && (
                  <>
                    {vendor.company_name && (
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Company</div>
                        <div>{vendor.company_name}</div>
                      </div>
                    )}
                    {vendor.contact_person && (
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Contact Person</div>
                        <div>{vendor.contact_person}</div>
                      </div>
                    )}
                  </>
                )}

                {purchase.supplier_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">{purchase.supplier_email}</div>
                  </div>
                )}

                {purchase.supplier_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">{purchase.supplier_phone}</div>
                  </div>
                )}

                {purchase.supplier_gst_number && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">GST Number</div>
                    <div className="font-mono text-sm">{purchase.supplier_gst_number}</div>
                  </div>
                )}

                {(purchase.supplier_address_line1 || purchase.supplier_city) && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        Address
                      </div>
                      <div className="text-sm space-y-1">
                        {purchase.supplier_address_line1 && <div>{purchase.supplier_address_line1}</div>}
                        {purchase.supplier_address_line2 && <div>{purchase.supplier_address_line2}</div>}
                        <div>
                          {[purchase.supplier_city, purchase.supplier_state, purchase.supplier_pincode]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                        {purchase.supplier_country && <div>{purchase.supplier_country}</div>}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Purchase Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Purchase Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Purchase Order Number</div>
                  <div className="font-mono font-semibold">{purchase.purchase_number}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Purchase Date</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(purchase.purchase_date)}
                  </div>
                </div>

                {purchase.invoice_number && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Invoice Number</div>
                    <div className="font-mono">{purchase.invoice_number}</div>
                  </div>
                )}

                {purchase.invoice_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Invoice Date</div>
                    <div>{formatDate(purchase.invoice_date)}</div>
                  </div>
                )}

                {purchase.expected_delivery_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Expected Delivery</div>
                    <div>{formatDate(purchase.expected_delivery_date)}</div>
                  </div>
                )}

                {purchase.shipped_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Shipped Date</div>
                    <div>{formatDateTime(purchase.shipped_date)}</div>
                  </div>
                )}

                {purchase.received_date && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Received Date</div>
                    <div>{formatDateTime(purchase.received_date)}</div>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Created At</div>
                  <div className="text-sm">{formatDateTime(purchase.created_at)}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                  <div className="text-sm">{formatDateTime(purchase.updated_at)}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes Section */}
          {(purchase.purchase_notes || purchase.internal_notes || purchase.terms_and_conditions) && (
            <div className="grid gap-4 md:grid-cols-3">
              {purchase.purchase_notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Purchase Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{purchase.purchase_notes}</p>
                  </CardContent>
                </Card>
              )}

              {purchase.internal_notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Internal Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{purchase.internal_notes}</p>
                  </CardContent>
                </Card>
              )}

              {purchase.terms_and_conditions && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Terms & Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{purchase.terms_and_conditions}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          {/* Loose Stock Items */}
          {looseStockTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-orange-600" />
                  Loose Stock Items
                </CardTitle>
                <CardDescription>
                  Bulk/loose stock purchased in this order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Quantity (Liters)</TableHead>
                        <TableHead className="text-right">Price per Liter</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Batch Number</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {looseStockTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Droplets className="h-4 w-4 text-orange-600" />
                              {transaction.loose_stock.product_categories.name}
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                                Loose Stock
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-orange-600">
                            {transaction.quantity_liters.toFixed(2)}L
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(transaction.price_per_liter)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(transaction.total_amount)}</TableCell>
                          <TableCell className="font-mono text-sm">{transaction.batch_number || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regular Packaged Stock Items */}
          {purchaseItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Packaged Stock Items
                </CardTitle>
                <CardDescription>
                  Packaged products purchased in this order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>HSN Code</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">GST %</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="font-mono text-sm">{item.product_sku || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{item.hsn_code || "-"}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {item.received_quantity > 0 ? (
                              <Badge variant={item.received_quantity >= item.quantity ? "default" : "outline"}>
                                {item.received_quantity}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right">
                            {item.discount_percent > 0 ? `${item.discount_percent}%` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.gst_percentage > 0 ? `${item.gst_percentage}%` : "-"}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No items message */}
          {purchaseItems.length === 0 && looseStockTransactions.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  No items found in this purchase order
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(purchase.subtotal)}</span>
                </div>

                {purchase.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>- {formatCurrency(purchase.discount_amount)}</span>
                  </div>
                )}

                {purchase.cgst_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{formatCurrency(purchase.cgst_amount)}</span>
                  </div>
                )}

                {purchase.sgst_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{formatCurrency(purchase.sgst_amount)}</span>
                  </div>
                )}

                {purchase.igst_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IGST</span>
                    <span>{formatCurrency(purchase.igst_amount)}</span>
                  </div>
                )}

                {purchase.gst_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total GST</span>
                    <span>{formatCurrency(purchase.gst_amount)}</span>
                  </div>
                )}

                {purchase.shipping_charges > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping Charges</span>
                    <span>{formatCurrency(purchase.shipping_charges)}</span>
                  </div>
                )}

                {purchase.other_charges > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Other Charges</span>
                    <span>{formatCurrency(purchase.other_charges)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span>{formatCurrency(purchase.total_amount)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Payment Status</div>
                  <Badge variant={getStatusVariant(purchase.payment_status)} className="mt-1">
                    {purchase.payment_status.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </div>

                {purchase.payment_method && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Payment Method</div>
                    <div className="capitalize">{purchase.payment_method.replace(/_/g, " ")}</div>
                  </div>
                )}

                {purchase.transaction_id && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Transaction ID</div>
                    <div className="font-mono text-sm">{purchase.transaction_id}</div>
                  </div>
                )}

                {purchase.payment_status === "partial" && purchase.internal_notes && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">Payment History</div>
                      <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
                        {purchase.internal_notes}
                      </div>
                    </div>
                  </>
                )}

                {purchase.payment_status === "pending" && (
                  <div className="mt-4">
                    <Button className="w-full" onClick={() => router.push(`/dashboard/purchases`)}>
                      Update Payment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Shipping Tab */}
        <TabsContent value="shipping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Shipping Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {purchase.shipping_method && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Shipping Method</div>
                  <div className="capitalize">{purchase.shipping_method}</div>
                </div>
              )}

              {purchase.courier_partner && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Courier Partner</div>
                  <div>{purchase.courier_partner}</div>
                </div>
              )}

              {purchase.tracking_number && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Tracking Number</div>
                  <div className="font-mono">{purchase.tracking_number}</div>
                </div>
              )}

              {purchase.expected_delivery_date && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Expected Delivery Date</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(purchase.expected_delivery_date)}
                  </div>
                </div>
              )}

              {purchase.shipped_date && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Shipped Date</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDateTime(purchase.shipped_date)}
                  </div>
                </div>
              )}

              {purchase.received_date && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Received Date</div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {formatDateTime(purchase.received_date)}
                  </div>
                </div>
              )}

              {!purchase.shipping_method && !purchase.courier_partner && !purchase.tracking_number && (
                <div className="text-center py-8 text-muted-foreground">
                  No shipping information available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
