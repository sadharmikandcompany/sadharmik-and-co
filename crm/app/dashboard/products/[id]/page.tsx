"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Calendar, MapPin, Package, Tag, Box } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import { ProductWarehouseStock } from "./product-warehouse-stock"

type Category = {
  id: string
  category_name: string
}

type Product = {
  id: string
  name: string
  brand: string | null
  hsn_code: string | null
  gst_percentage: number | null
  parent_category_id: string | null
  sub_category_id: string | null
  parent_category?: Category
  sub_category?: Category
  stock: number | null
  customer_price: number
  customer_sale_price: number | null
  customer_discount_percent: number | null
  distributor_price: number | null
  distributor_sale_price: number | null
  distributor_discount_percent: number | null
  sub_distributor_price: number | null
  sub_distributor_sale_price: number | null
  sub_distributor_discount_percent: number | null
  short_description: string | null
  long_description: string | null
  images: string[] | null
  specifications: any[] | null
  available_offers: any[] | null
  questions_answers: any[] | null
  meta_title: string | null
  meta_description: string | null
  meta_content: string | null
  is_active: boolean
  is_featured: boolean
  created_at: string
  updated_at: string | null
}

type PincodePricing = {
  id: string
  product_id: string
  pincode: string
  customer_price: number | null
  customer_sale_price: number | null
  distributor_price: number | null
  distributor_sale_price: number | null
  sub_distributor_price: number | null
  sub_distributor_sale_price: number | null
  created_at: string
  updated_at: string | null
}

type MaterialMapping = {
  id: string
  variant_name: string
  category_name: string
  material_name: string
  quantity_per_unit: number
  liters_consumed_per_unit: number
  is_required: boolean
  display_order: number
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [allPincodePricing, setAllPincodePricing] = useState<PincodePricing[]>([])
  const [materialMappings, setMaterialMappings] = useState<MaterialMapping[]>([])

  // Helper function to check if image URL is valid
  const isValidImageUrl = (url: string): boolean => {
    if (!url || url.trim() === '') return false
    // Check if it's a full URL (starts with http:// or https://)
    return url.startsWith('http://') || url.startsWith('https://')
  }

  useEffect(() => {
    fetchProduct()
    fetchAllPincodePricing()
    fetchMaterialMappings()
  }, [productId])

  const fetchProduct = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        parent_category:parent_category_id(id, category_name),
        sub_category:sub_category_id(id, category_name)
      `)
      .eq("id", productId)
      .single()

    if (error) {
      console.error("Error fetching product:", error)
      toast.error("Failed to fetch product")
      router.push("/dashboard/products")
    } else {
      setProduct(data)

      // Check for invalid image URLs
      if (data.images && data.images.length > 0) {
        const allImages = data.images
        const validImages = allImages.filter(isValidImageUrl)

        if (validImages.length < allImages.length) {
          toast.warning(`${allImages.length - validImages.length} image(s) have invalid URLs and won't be displayed.`)
        }
      }
    }
    setLoading(false)
  }

  const fetchAllPincodePricing = async () => {
    const { data, error } = await supabase
      .from("product_pincode_pricing")
      .select("*")
      .eq("product_id", productId)
      .order("pincode", { ascending: true })

    if (error) {
      console.error("Error fetching pincode pricing:", error)
    } else {
      setAllPincodePricing(data || [])
    }
  }

  const fetchMaterialMappings = async () => {
    const { data, error } = await supabase
      .from("variant_material_mapping")
      .select(`
        id,
        quantity_per_unit,
        liters_consumed_per_unit,
        is_required,
        display_order,
        product_variants!inner (
          variant_name,
          product_categories!inner (
            name
          )
        ),
        packaging_materials!inner (
          name
        )
      `)
      .eq("product_id", productId)
      .order("display_order")

    if (error) {
      console.error("Error fetching material mappings:", error)
    } else {
      const transformed: MaterialMapping[] = (data || []).map((m: any) => ({
        id: m.id,
        variant_name: m.product_variants.variant_name,
        category_name: m.product_variants.product_categories.name,
        material_name: m.packaging_materials.name,
        quantity_per_unit: m.quantity_per_unit,
        liters_consumed_per_unit: m.liters_consumed_per_unit,
        is_required: m.is_required,
        display_order: m.display_order,
      }))
      setMaterialMappings(transformed)
    }
  }

  const calculateDiscountPercent = (regularPrice: number | null, salePrice: number | null): string => {
    if (!regularPrice || !salePrice || regularPrice <= 0 || salePrice >= regularPrice) {
      return "0"
    }
    const discount = ((regularPrice - salePrice) / regularPrice) * 100
    return discount.toFixed(2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  if (!product) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">{product.brand || "No brand"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Images */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
          </CardHeader>
          <CardContent>
            {product.images && product.images.length > 0 && product.images.filter(isValidImageUrl).length > 0 ? (
              <div className="space-y-4">
                {isValidImageUrl(product.images[0]) ? (
                  <div className="aspect-square relative rounded-lg overflow-hidden border border-border">
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : product.images.filter(isValidImageUrl).length > 0 ? (
                  <div className="aspect-square relative rounded-lg overflow-hidden border border-border">
                    <Image
                      src={product.images.filter(isValidImageUrl)[0]}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : null}
                {product.images.filter(isValidImageUrl).length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {product.images.filter(isValidImageUrl).slice(1).map((img, idx) => (
                      <div
                        key={idx}
                        className="aspect-square relative rounded overflow-hidden border border-border"
                      >
                        <Image src={img} alt={`${product.name} ${idx + 2}`} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-square flex items-center justify-center bg-muted rounded border border-border">
                <Package className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Basic product information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">HSN Code</Label>
                <p className="font-medium">{product.hsn_code || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">GST %</Label>
                <p className="font-medium">{product.gst_percentage || "-"}%</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Stock</Label>
                <Badge
                  variant={
                    product.stock === null
                      ? "secondary"
                      : product.stock === 0
                      ? "destructive"
                      : product.stock < 10
                      ? "outline"
                      : "default"
                  }
                >
                  {product.stock === null ? "N/A" : product.stock}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <p className="font-medium">
                  {product.parent_category?.category_name || "-"}
                  {product.sub_category?.category_name &&
                    ` > ${product.sub_category.category_name}`}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="flex gap-2">
                  <Badge variant={product.is_active ? "default" : "secondary"}>
                    {product.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {product.is_featured && <Badge variant="outline">Featured</Badge>}
                </div>
              </div>
            </div>

            {product.short_description && (
              <>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Short Description</Label>
                  <p className="mt-1">{product.short_description}</p>
                </div>
              </>
            )}

            {product.long_description && (
              <>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Long Description</Label>
                  <p className="mt-1 whitespace-pre-wrap">{product.long_description}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pricing Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Customer Pricing
            </CardTitle>
            <CardDescription>Retail customer prices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-xs">Regular Price</Label>
              <p className="text-2xl font-bold">₹{product.customer_price}</p>
            </div>
            {product.customer_sale_price && (
              <>
                <div>
                  <Label className="text-muted-foreground text-xs">Sale Price</Label>
                  <p className="text-xl font-semibold text-green-600">
                    ₹{product.customer_sale_price}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Discount</Label>
                  <Badge variant="secondary">
                    {calculateDiscountPercent(product.customer_price, product.customer_sale_price)}% OFF
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Distributor Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Distributor Pricing
            </CardTitle>
            <CardDescription>Wholesale distributor prices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-xs">Regular Price</Label>
              <p className="text-2xl font-bold">
                ₹{product.distributor_price || product.customer_price}
              </p>
            </div>
            {product.distributor_sale_price && (
              <>
                <div>
                  <Label className="text-muted-foreground text-xs">Sale Price</Label>
                  <p className="text-xl font-semibold text-green-600">
                    ₹{product.distributor_sale_price}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Discount</Label>
                  <Badge variant="secondary">
                    {calculateDiscountPercent(product.distributor_price || product.customer_price, product.distributor_sale_price)}% OFF
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sub-Distributor Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Sub-Distributor Pricing
            </CardTitle>
            <CardDescription>Sub-distributor wholesale prices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-xs">Regular Price</Label>
              <p className="text-2xl font-bold">
                ₹{product.sub_distributor_price || product.customer_price}
              </p>
            </div>
            {product.sub_distributor_sale_price && (
              <>
                <div>
                  <Label className="text-muted-foreground text-xs">Sale Price</Label>
                  <p className="text-xl font-semibold text-green-600">
                    ₹{product.sub_distributor_sale_price}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Discount</Label>
                  <Badge variant="secondary">
                    {calculateDiscountPercent(product.sub_distributor_price || product.customer_price, product.sub_distributor_sale_price)}% OFF
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pincode-Based Pricing */}
      {allPincodePricing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Pincode-Based Pricing
            </CardTitle>
            <CardDescription>
              Custom pricing for specific pincodes ({allPincodePricing.length} pincodes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pincode</TableHead>
                    <TableHead>Customer Price</TableHead>
                    <TableHead>Distributor Price</TableHead>
                    <TableHead>Sub-Distributor Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPincodePricing.map((pricing) => (
                    <TableRow key={pricing.id}>
                      <TableCell className="font-medium">{pricing.pincode}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {pricing.customer_price && (
                            <div className="text-sm">
                              ₹{pricing.customer_price}
                              {pricing.customer_sale_price && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (Sale: ₹{pricing.customer_sale_price})
                                </span>
                              )}
                            </div>
                          )}
                          {!pricing.customer_price && <span className="text-muted-foreground text-xs">Default</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {pricing.distributor_price && (
                            <div className="text-sm">
                              ₹{pricing.distributor_price}
                              {pricing.distributor_sale_price && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (Sale: ₹{pricing.distributor_sale_price})
                                </span>
                              )}
                            </div>
                          )}
                          {!pricing.distributor_price && <span className="text-muted-foreground text-xs">Default</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {pricing.sub_distributor_price && (
                            <div className="text-sm">
                              ₹{pricing.sub_distributor_price}
                              {pricing.sub_distributor_sale_price && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (Sale: ₹{pricing.sub_distributor_sale_price})
                                </span>
                              )}
                            </div>
                          )}
                          {!pricing.sub_distributor_price && <span className="text-muted-foreground text-xs">Default</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Material Mapping */}
      {materialMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-4 w-4" />
              Material Requirements
            </CardTitle>
            <CardDescription>
              Packaging materials and loose stock required for this product ({materialMappings.length} materials)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Qty per Unit</TableHead>
                    <TableHead className="text-right">Liters Consumed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialMappings
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">{mapping.material_name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{mapping.variant_name}</div>
                            <div className="text-xs text-muted-foreground">{mapping.category_name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{mapping.quantity_per_unit}</TableCell>
                        <TableCell className="text-right">
                          {mapping.liters_consumed_per_unit > 0
                            ? `${mapping.liters_consumed_per_unit} L`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {mapping.is_required ? (
                            <Badge variant="default">Required</Badge>
                          ) : (
                            <Badge variant="outline">Optional</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warehouse Stock */}
      <ProductWarehouseStock productId={productId} productName={product.name} />

      {/* Specifications, Offers, Q&A */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            {product.specifications && Array.isArray(product.specifications) && product.specifications.length > 0 ? (
              <div className="space-y-2">
                {product.specifications.map((spec: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{spec.key || 'N/A'}</span>
                    <span className="font-medium">{spec.value || 'N/A'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specifications added</p>
            )}
          </CardContent>
        </Card>

        {/* Available Offers */}
        <Card>
          <CardHeader>
            <CardTitle>Available Offers</CardTitle>
          </CardHeader>
          <CardContent>
            {product.available_offers && Array.isArray(product.available_offers) && product.available_offers.length > 0 ? (
              <div className="space-y-3">
                {product.available_offers.map((offer: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-primary pl-3">
                    <p className="font-medium text-sm">{offer.title || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{offer.description || ''}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No offers available</p>
            )}
          </CardContent>
        </Card>

        {/* Questions & Answers */}
        <Card>
          <CardHeader>
            <CardTitle>Questions & Answers</CardTitle>
          </CardHeader>
          <CardContent>
            {product.questions_answers && Array.isArray(product.questions_answers) && product.questions_answers.length > 0 ? (
              <div className="space-y-3">
                {product.questions_answers.map((qa: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <p className="font-medium text-sm">Q: {qa.question || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">A: {qa.answer || 'N/A'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No Q&A available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SEO & Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>SEO & Metadata</CardTitle>
          <CardDescription>Search engine optimization information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Meta Title</Label>
              <p className="text-sm">{product.meta_title || "Not set"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Meta Keywords</Label>
              <p className="text-sm">{product.meta_content || "Not set"}</p>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Meta Description</Label>
            <p className="text-sm">{product.meta_description || "Not set"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Record Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground text-xs">Created At</Label>
              <p className="font-medium">{formatDate(product.created_at)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Last Updated</Label>
              <p className="font-medium">{product.updated_at ? formatDate(product.updated_at) : "Never"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
