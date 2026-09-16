"use client"

import { useEffect, useState, useMemo } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import {
  lookupPincode,
  preloadPincodeCache,
  type PincodeData,
} from "@/lib/pincode-lookup"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  MapPin,
  Image as ImageIcon,
  Loader2,
  Leaf,
  ArrowRight,
  Tag,
  ShoppingBag,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

// --- Types ---

type Category = {
  id: string
  category_name: string
}

type RateListProduct = {
  id: string
  name: string
  brand: string | null
  customer_price: number
  customer_sale_price: number | null
  customer_discount_percent: number | null
  images: string[] | null
  short_description: string | null
  parent_category_id: string | null
  sub_category_id: string | null
  parent_category?: Category
  sub_category?: Category
}

type PincodePricing = {
  product_id: string
  customer_price: number | null
  customer_sale_price: number | null
}

// --- Helpers ---

function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") return false
  return url.startsWith("http://") || url.startsWith("https://")
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function getEffectivePrice(
  product: RateListProduct,
  pricingMap: Map<string, PincodePricing>
) {
  const override = pricingMap.get(product.id)
  const customerPrice = override?.customer_price ?? product.customer_price
  const customerSalePrice =
    override?.customer_sale_price ?? product.customer_sale_price
  return { customerPrice, customerSalePrice }
}

// --- Component ---

export default function RateListPage() {
  // Pincode state
  const [pincode, setPincode] = useState("")
  const [pincodeSubmitted, setPincodeSubmitted] = useState(false)
  const [pincodeInfo, setPincodeInfo] = useState<PincodeData | null>(null)
  const [pincodeError, setPincodeError] = useState("")
  const [validating, setValidating] = useState(false)

  // Data state
  const [products, setProducts] = useState<RateListProduct[]>([])
  const [pincodePricingMap, setPincodePricingMap] = useState<
    Map<string, PincodePricing>
  >(new Map())
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  // Filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Preload pincode cache on mount
  useEffect(() => {
    preloadPincodeCache()
  }, [])

  const handlePincodeSubmit = async () => {
    const cleanPincode = pincode.trim()
    if (!/^\d{6}$/.test(cleanPincode)) {
      setPincodeError("Please enter a valid 6-digit pincode")
      return
    }

    setValidating(true)
    setPincodeError("")

    const result = await lookupPincode(cleanPincode)
    if (!result) {
      setPincodeError("Invalid pincode. Please enter a valid Indian pincode.")
      setValidating(false)
      return
    }

    setPincodeInfo(result)
    setPincodeSubmitted(true)
    setValidating(false)
    fetchData(cleanPincode)
  }

  const handleChangePincode = () => {
    setPincodeSubmitted(false)
    setPincodeInfo(null)
    setProducts([])
    setPincodePricingMap(new Map())
    setCategories([])
    setSearchTerm("")
    setSelectedCategory("all")
  }

  const fetchData = async (enteredPincode: string) => {
    setLoading(true)
    try {
      const [productsResult, pricingResult, categoriesResult] =
        await Promise.all([
          supabase
            .from("products")
            .select(
              `
              id, name, brand, customer_price, customer_sale_price,
              customer_discount_percent, images, short_description,
              parent_category_id, sub_category_id,
              parent_category:parent_category_id(id, category_name),
              sub_category:sub_category_id(id, category_name)
            `
            )
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("product_pincode_pricing")
            .select("product_id, customer_price, customer_sale_price")
            .eq("pincode", enteredPincode),
          supabase
            .from("categories")
            .select("id, category_name")
            .order("category_name", { ascending: true }),
        ])

      if (productsResult.error) {
        console.error("Error fetching products:", productsResult.error)
        toast.error("Failed to fetch products")
        setLoading(false)
        return
      }

      if (pricingResult.error) {
        console.error("Error fetching pincode pricing:", pricingResult.error)
      }

      if (categoriesResult.error) {
        console.error("Error fetching categories:", categoriesResult.error)
      }

      // Supabase returns joined relations as arrays; normalize to single objects
      const normalizedProducts = (productsResult.data || []).map(
        (p: Record<string, unknown>) => ({
          ...p,
          parent_category: Array.isArray(p.parent_category)
            ? p.parent_category[0] ?? undefined
            : p.parent_category ?? undefined,
          sub_category: Array.isArray(p.sub_category)
            ? p.sub_category[0] ?? undefined
            : p.sub_category ?? undefined,
        })
      ) as RateListProduct[]
      setProducts(normalizedProducts)
      setCategories(categoriesResult.data || [])

      // Build pricing override map
      const pricingMap = new Map<string, PincodePricing>()
      if (pricingResult.data) {
        for (const entry of pricingResult.data) {
          pricingMap.set(entry.product_id, entry)
        }
      }
      setPincodePricingMap(pricingMap)
    } catch (err) {
      console.error("Error fetching data:", err)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Filtered products — also excludes products with "Mandir" in the name
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Exclude products containing "Mandir" in the name
      if (product.name.toLowerCase().includes("mandir")) return false

      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.brand &&
          product.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory =
        selectedCategory === "all" ||
        product.parent_category_id === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="border-b border-green-200 bg-gradient-to-r from-green-700 via-green-600 to-emerald-600 shadow-lg">
        <div className="container mx-auto px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Leaf className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Sadharmik & Company Rate List
              </h1>
              <p className="text-sm text-green-100">
                Check current product prices for your area
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:px-6">
        {/* Pincode Entry — shown when pincode not yet submitted */}
        {!pincodeSubmitted && (
          <div className="mx-auto mt-8 max-w-lg sm:mt-20">
            {/* Hero section */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <MapPin className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Find Prices Near You
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-gray-500">
                Enter your pincode to view the latest product prices available
                in your area
              </p>
            </div>

            <Card className="border-green-200 shadow-xl shadow-green-100/50">
              <CardContent className="p-6">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                    <Input
                      placeholder="Enter 6-digit pincode"
                      value={pincode}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6)
                        setPincode(val)
                        if (pincodeError) setPincodeError("")
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePincodeSubmit()
                      }}
                      maxLength={6}
                      inputMode="numeric"
                      className={cn(
                        "h-12 pl-10 text-lg focus-visible:ring-green-500",
                        pincodeError &&
                          "border-red-400 focus-visible:ring-red-400"
                      )}
                    />
                  </div>
                  <Button
                    onClick={handlePincodeSubmit}
                    disabled={validating || pincode.length !== 6}
                    className="h-12 bg-green-600 px-6 text-base font-semibold hover:bg-green-700"
                  >
                    {validating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        View Prices
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
                {pincodeError && (
                  <p className="mt-3 text-sm font-medium text-red-500">
                    {pincodeError}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Trust indicators */}
            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                <span>Best Prices</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Wide Selection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>Area-Specific Rates</span>
              </div>
            </div>
          </div>
        )}

        {/* Pincode bar + filters + products — shown after pincode submitted */}
        {pincodeSubmitted && (
          <div className="space-y-6">
            {/* Compact pincode bar */}
            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-900">
                    Prices for:
                  </span>
                  <Badge className="bg-green-600 text-white hover:bg-green-700">
                    {pincode}
                  </Badge>
                  {pincodeInfo && (
                    <span className="text-sm text-green-700">
                      {pincodeInfo.city}, {pincodeInfo.state}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangePincode}
                className="border-green-300 text-green-700 hover:bg-green-100 hover:text-green-800"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Change Pincode
              </Button>
            </div>

            {/* Filters row */}
            {!loading && products.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1 sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search by product name or brand..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 focus-visible:ring-green-500"
                    />
                  </div>
                  {categories.length > 0 && (
                    <Select
                      value={selectedCategory}
                      onValueChange={setSelectedCategory}
                    >
                      <SelectTrigger className="w-full focus:ring-green-500 sm:w-[200px]">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.category_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <p className="whitespace-nowrap text-sm font-medium text-gray-500">
                  {filteredProducts.length}{" "}
                  {filteredProducts.length === 1 ? "product" : "products"} found
                </p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card
                    key={i}
                    className="overflow-hidden border-gray-200 shadow-sm"
                  >
                    <Skeleton className="aspect-square w-full" />
                    <CardContent className="space-y-3 p-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-24" />
                      <div className="flex items-center gap-2 pt-1">
                        <Skeleton className="h-7 w-20" />
                        <Skeleton className="h-4 w-14" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Product grid */}
            {!loading && filteredProducts.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map((product) => {
                  const { customerPrice, customerSalePrice } =
                    getEffectivePrice(product, pincodePricingMap)
                  const hasDiscount =
                    customerSalePrice != null &&
                    customerSalePrice < customerPrice
                  const discountPercent = hasDiscount
                    ? Math.round(
                        ((customerPrice - customerSalePrice!) / customerPrice) *
                          100
                      )
                    : 0

                  const thumbnail =
                    product.images &&
                    product.images.length > 0 &&
                    isValidImageUrl(product.images[0])
                      ? product.images[0]
                      : null

                  const categoryName =
                    product.parent_category?.category_name ?? null

                  return (
                    <Card
                      key={product.id}
                      className="group overflow-hidden border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-100/50"
                    >
                      {/* Image */}
                      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
                        {thumbnail ? (
                          <Image
                            src={thumbnail}
                            alt={product.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                            <ImageIcon className="h-16 w-16 text-gray-200" />
                          </div>
                        )}
                        {hasDiscount && discountPercent > 0 && (
                          <div className="absolute left-0 top-3">
                            <div className="rounded-r-full bg-green-600 px-3 py-1 text-xs font-bold text-white shadow-md">
                              {discountPercent}% OFF
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <CardContent className="p-4">
                        {categoryName && (
                          <span className="mb-2 inline-block rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
                            {categoryName}
                          </span>
                        )}
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
                          {product.name}
                        </h3>
                        {product.brand && (
                          <p className="mt-1 text-xs text-gray-400">
                            {product.brand}
                          </p>
                        )}

                        {/* Pricing */}
                        <div className="mt-3 flex items-baseline gap-2 border-t border-gray-100 pt-3">
                          <span className="text-xl font-bold text-green-700">
                            {formatCurrency(
                              hasDiscount ? customerSalePrice! : customerPrice
                            )}
                          </span>
                          {hasDiscount && (
                            <span className="text-sm text-gray-400 line-through">
                              {formatCurrency(customerPrice)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Empty state */}
            {!loading && pincodeSubmitted && filteredProducts.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <ShoppingBag className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  No products found
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">
                  {products.length === 0
                    ? "No products are currently available for this area."
                    : "Try adjusting your search or category filter."}
                </p>
                {searchTerm || selectedCategory !== "all" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setSearchTerm("")
                      setSelectedCategory("all")
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-green-100 bg-green-50/50">
        <div className="container mx-auto px-4 py-6 text-center text-xs text-gray-400 sm:px-6">
          Prices are subject to change. Please confirm at the time of purchase.
        </div>
      </footer>
    </div>
  )
}
