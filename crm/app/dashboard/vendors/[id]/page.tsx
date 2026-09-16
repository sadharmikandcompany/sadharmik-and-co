"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Mail, Phone, MapPin, Building2, CreditCard, Package, ShoppingBag } from "lucide-react"
import { toast } from "sonner"

type Vendor = {
  id: string
  vendor_name: string
  contact_person: string | null
  email: string | null
  mobile_primary: string
  whatsapp_number: string | null
  mobile_secondary_1: string | null
  mobile_secondary_2: string | null
  company_name: string | null
  gst_number: string | null
  pan_number: string | null
  vendor_type: string | null
  is_verified: boolean
  is_preferred: boolean
  credit_days: number
  credit_limit: number
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  pincode: string
  country: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  bank_account_holder_name: string | null
  bank_branch: string | null
  vendor_notes: string | null
  internal_notes: string | null
  is_active: boolean
  created_at: string
}

type StockItem = {
  id: string
  variant_name: string
  category_name: string
  material_name: string
  quantity: number
  price: number
}

type Purchase = {
  id: string
  purchase_number: string | null
  purchase_status: string | null
  payment_status: string | null
  total_amount: number | null
  created_at: string
}

export default function VendorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const vendorId = params.id as string

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [purchaseStats, setPurchaseStats] = useState({ totalPurchases: 0, totalAmount: 0 })

  useEffect(() => {
    if (vendorId) {
      fetchVendorDetails()
      fetchVendorStock()
      fetchPurchaseHistory()
    }
  }, [vendorId])

  const fetchVendorDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", vendorId)
        .single()

      if (error) throw error
      setVendor(data)
    } catch (error) {
      console.error("Error fetching vendor:", error)
      toast.error("Failed to fetch vendor details")
    } finally {
      setLoading(false)
    }
  }

  const fetchVendorStock = async () => {
    try {
      const { data, error } = await supabase
        .from("vendor_stock")
        .select(`
          stock_inventory_id,
          stock_inventory!inner (
            id,
            quantity,
            price,
            product_variants!inner (
              variant_name,
              product_categories!inner (
                name
              )
            ),
            packaging_materials!inner (
              name
            )
          )
        `)
        .eq("vendor_id", vendorId)

      if (error) throw error

      const transformedData: StockItem[] = (data || []).map((item: any) => ({
        id: item.stock_inventory.id,
        variant_name: item.stock_inventory.product_variants.variant_name,
        category_name: item.stock_inventory.product_variants.product_categories.name,
        material_name: item.stock_inventory.packaging_materials.name,
        quantity: item.stock_inventory.quantity,
        price: item.stock_inventory.price || 0,
      }))

      setStockItems(transformedData)
    } catch (error) {
      console.error("Error fetching vendor stock:", error)
      toast.error("Failed to fetch vendor stock items")
    }
  }

  const fetchPurchaseHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })

      if (error) throw error

      setPurchases(data || [])

      const totalPurchases = data?.length || 0
      const totalAmount = data?.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0) || 0
      setPurchaseStats({ totalPurchases, totalAmount })
    } catch (error) {
      console.error("Error fetching purchase history:", error)
      toast.error("Failed to fetch purchase history")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Loading...</h1>
        </div>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Vendor Not Found</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{vendor.vendor_name}</h1>
            <Badge variant={vendor.is_active ? "default" : "secondary"}>
              {vendor.is_active ? "Active" : "Inactive"}
            </Badge>
            {vendor.is_verified && <Badge variant="default">Verified</Badge>}
            {vendor.is_preferred && <Badge variant="outline">Preferred</Badge>}
          </div>
          <p className="text-muted-foreground">
            {vendor.vendor_type && `${vendor.vendor_type.charAt(0).toUpperCase() + vendor.vendor_type.slice(1)} • `}
            Member since {new Date(vendor.created_at).toLocaleDateString("en-IN")}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseStats.totalPurchases}</div>
            <p className="text-xs text-muted-foreground">Purchase orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{purchaseStats.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Total purchases value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockItems.length}</div>
            <p className="text-xs text-muted-foreground">Items supplied</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Contact Person</p>
              <p className="font-medium">{vendor.contact_person || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{vendor.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mobile Primary</p>
              <p className="font-medium">{vendor.mobile_primary}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">WhatsApp</p>
              <p className="font-medium">{vendor.whatsapp_number || "-"}</p>
            </div>
            {vendor.mobile_secondary_1 && (
              <div>
                <p className="text-sm text-muted-foreground">Mobile Secondary 1</p>
                <p className="font-medium">{vendor.mobile_secondary_1}</p>
              </div>
            )}
            {vendor.mobile_secondary_2 && (
              <div>
                <p className="text-sm text-muted-foreground">Mobile Secondary 2</p>
                <p className="font-medium">{vendor.mobile_secondary_2}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Company Name</p>
              <p className="font-medium">{vendor.company_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">GST Number</p>
              <p className="font-medium">{vendor.gst_number || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">PAN Number</p>
              <p className="font-medium">{vendor.pan_number || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Credit Days</p>
                <p className="font-medium">{vendor.credit_days}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credit Limit</p>
                <p className="font-medium">₹{vendor.credit_limit.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{vendor.address_line1}</p>
            {vendor.address_line2 && <p className="font-medium">{vendor.address_line2}</p>}
            <p className="font-medium">
              {vendor.city}, {vendor.state} - {vendor.pincode}
            </p>
            <p className="font-medium">{vendor.country || "India"}</p>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Bank Name</p>
              <p className="font-medium">{vendor.bank_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Holder</p>
              <p className="font-medium">{vendor.bank_account_holder_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Number</p>
              <p className="font-medium">{vendor.bank_account_number || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">IFSC Code</p>
                <p className="font-medium">{vendor.bank_ifsc_code || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Branch</p>
                <p className="font-medium">{vendor.bank_branch || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Items Supplied */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Items Supplied</CardTitle>
          <CardDescription>
            Products that this vendor can supply ({stockItems.length} items)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No stock items assigned</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.category_name}</TableCell>
                      <TableCell>{item.variant_name}</TableCell>
                      <TableCell>{item.material_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
          <CardDescription>
            Recent purchases from this vendor ({purchases.length} orders)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No purchase history</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">
                        {purchase.purchase_number || "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(purchase.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            purchase.purchase_status === "received"
                              ? "default"
                              : purchase.purchase_status === "cancelled"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {purchase.purchase_status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            purchase.payment_status === "completed"
                              ? "default"
                              : purchase.payment_status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {purchase.payment_status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{(purchase.total_amount || 0).toLocaleString("en-IN", {
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
        </CardContent>
      </Card>

      {/* Notes */}
      {(vendor.vendor_notes || vendor.internal_notes) && (
        <div className="grid gap-6 md:grid-cols-2">
          {vendor.vendor_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Vendor Notes</CardTitle>
                <CardDescription>Notes visible to vendor</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{vendor.vendor_notes}</p>
              </CardContent>
            </Card>
          )}

          {vendor.internal_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
                <CardDescription>Internal notes (not visible to vendor)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{vendor.internal_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
