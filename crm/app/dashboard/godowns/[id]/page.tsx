"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit, Package, ArrowRightLeft, MapPin, User } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Godown = {
  id: string
  name: string
  godown_code: string
  godown_type: "company" | "distributor" | "retailer"
  distributor_id: string | null
  retailer_id: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string | null
  serviceable_pincodes: string | null
  manager_name: string | null
  manager_phone: string | null
  manager_email: string | null
  total_capacity_sqft: number | null
  storage_type: string | null
  operating_hours: string | null
  notes: string | null
  is_active: boolean
  is_primary: boolean
  created_at: string
}

type GodownStock = {
  id: string
  godown_id: string
  stock_inventory_id: string
  quantity: number
  reserved_quantity: number
  available_quantity: number
  min_stock_level: number
  rack_number: string | null
  shelf_number: string | null
  bin_location: string | null
  stock_inventory: {
    product_id: string
    variant_id: string | null
    material_id: string | null
    price: number
    products: {
      name: string
      brand: string | null
    } | null
    product_variants: {
      variant_name: string
    } | null
    packaging_materials: {
      name: string
    } | null
  }
}

export default function GodownDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const godownId = params.id as string

  const [godown, setGodown] = useState<Godown | null>(null)
  const [stockItems, setStockItems] = useState<GodownStock[]>([])
  const [loading, setLoading] = useState(true)
  const [totalStockValue, setTotalStockValue] = useState(0)
  const [totalQuantity, setTotalQuantity] = useState(0)

  useEffect(() => {
    if (godownId) {
      fetchGodown()
      fetchGodownStock()
    }
  }, [godownId])

  const fetchGodown = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("godowns")
      .select("*")
      .eq("id", godownId)
      .single()

    if (error) {
      console.error("Error fetching godown:", error)
      toast.error("Failed to fetch warehouse details")
      router.push("/dashboard/godowns")
    } else {
      setGodown(data)
    }
    setLoading(false)
  }

  const fetchGodownStock = async () => {
    const { data, error } = await supabase
      .from("godown_stock")
      .select(`
        *,
        stock_inventory (
          product_id,
          variant_id,
          material_id,
          price,
          products (
            name,
            brand
          ),
          product_variants (
            variant_name
          ),
          packaging_materials (
            name
          )
        )
      `)
      .eq("godown_id", godownId)
      .order("quantity", { ascending: false })

    if (error) {
      console.error("Error fetching godown stock:", error)
      toast.error("Failed to fetch stock details")
    } else {
      setStockItems(data || [])

      // Calculate totals
      const totalQty = (data || []).reduce((sum, item) => sum + item.quantity, 0)
      const totalVal = (data || []).reduce((sum, item) =>
        sum + (item.quantity * (item.stock_inventory?.price || 0)), 0)

      setTotalQuantity(totalQty)
      setTotalStockValue(totalVal)
    }
  }

  if (loading || !godown) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard/godowns")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard/godowns")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{godown.name}</h1>
            <p className="text-muted-foreground font-mono">{godown.godown_code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/stock-transfers/new">
            <Button variant="outline">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transfer Stock
            </Button>
          </Link>
          <Link href={`/dashboard/godowns/${godownId}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2">
        <Badge variant={godown.is_active ? "default" : "secondary"}>
          {godown.is_active ? "Active" : "Inactive"}
        </Badge>
        {godown.is_primary && (
          <Badge variant="default">Primary Warehouse</Badge>
        )}
        <Badge variant="outline" className="capitalize">
          {godown.godown_type} Warehouse
        </Badge>
        {godown.storage_type && (
          <Badge variant="secondary" className="capitalize">
            {godown.storage_type.replace("_", " ")}
          </Badge>
        )}
      </div>

      {/* Stock Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockItems.length}</div>
            <p className="text-xs text-muted-foreground">distinct products</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity}</div>
            <p className="text-xs text-muted-foreground">units in stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalStockValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacity</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {godown.total_capacity_sqft ? `${godown.total_capacity_sqft.toLocaleString()}` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">sq ft</p>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Location Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Address</p>
              </div>
              <address className="not-italic text-sm">
                {[
                  godown.address_line1,
                  godown.address_line2,
                  godown.city,
                  godown.state,
                  godown.pincode,
                  godown.country
                ].filter(Boolean).join(", ")}
              </address>
            </div>
            {godown.operating_hours && (
              <div>
                <p className="text-sm text-muted-foreground">Operating Hours</p>
                <p className="font-medium">{godown.operating_hours}</p>
              </div>
            )}
            {godown.serviceable_pincodes && (
              <div>
                <p className="text-sm text-muted-foreground">Serviceable Pincodes</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {godown.serviceable_pincodes.split(",").map((pincode, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {pincode.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manager Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {godown.manager_name ? (
              <>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Manager Name</p>
                    <p className="font-medium">{godown.manager_name}</p>
                  </div>
                </div>
                {godown.manager_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{godown.manager_phone}</p>
                  </div>
                )}
                {godown.manager_email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{godown.manager_email}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No manager assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stock Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Inventory</CardTitle>
          <CardDescription>
            Items currently stored at this warehouse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant/Material</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Min Level</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No stock items found in this warehouse
                    </TableCell>
                  </TableRow>
                ) : (
                  stockItems.map((item) => {
                    const product = item.stock_inventory?.products
                    const variant = item.stock_inventory?.product_variants
                    const material = item.stock_inventory?.packaging_materials
                    const price = item.stock_inventory?.price || 0
                    const totalValue = item.quantity * price
                    const isLowStock = item.available_quantity <= item.min_stock_level

                    return (
                      <TableRow key={item.id} className={isLowStock ? "bg-red-50" : ""}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{product?.name || "—"}</span>
                            {product?.brand && (
                              <span className="text-xs text-muted-foreground">{product.brand}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {variant?.variant_name || material?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {[
                              item.rack_number && `R${item.rack_number}`,
                              item.shelf_number && `S${item.shelf_number}`,
                              item.bin_location && `B${item.bin_location}`
                            ].filter(Boolean).join(" / ") || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{item.quantity}</TableCell>
                        <TableCell>{item.reserved_quantity}</TableCell>
                        <TableCell>
                          <Badge variant={isLowStock ? "destructive" : "default"}>
                            {item.available_quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.min_stock_level}
                        </TableCell>
                        <TableCell>₹{price.toLocaleString()}</TableCell>
                        <TableCell className="font-medium">₹{totalValue.toLocaleString()}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
