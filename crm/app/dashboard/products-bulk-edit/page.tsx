"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { Save, RotateCcw, Search, Check, X, ChevronLeft, ChevronRight, Package } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

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
  is_active: boolean
  is_featured: boolean
}

type EditedProduct = Partial<Product> & { id: string }

const PAGE_SIZE = 50

export default function ProductsBulkEditPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [editedProducts, setEditedProducts] = useState<Map<string, EditedProduct>>(new Map())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, category_name")
      .order("category_name")
    setCategories(data || [])
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("products")
        .select("id, name, brand, hsn_code, gst_percentage, parent_category_id, sub_category_id, stock, customer_price, customer_sale_price, customer_discount_percent, distributor_price, distributor_sale_price, distributor_discount_percent, sub_distributor_price, sub_distributor_sale_price, sub_distributor_discount_percent, short_description, is_active, is_featured", { count: "exact" })
        .order("name")
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,hsn_code.ilike.%${searchTerm}%`)
      }

      if (categoryFilter !== "all") {
        query = query.eq("parent_category_id", categoryFilter)
      }

      const { data, count, error } = await query

      if (error) throw error
      setProducts(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error("Error fetching products:", error)
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, categoryFilter])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return ""
    return categories.find(c => c.id === categoryId)?.category_name || ""
  }

  const handleCellChange = (productId: string, field: keyof Product, value: unknown) => {
    setEditedProducts(prev => {
      const next = new Map(prev)
      const existing = next.get(productId) || { id: productId }
      next.set(productId, { ...existing, [field]: value })
      return next
    })
  }

  const getEditedValue = (product: Product, field: keyof Product) => {
    const edited = editedProducts.get(product.id)
    if (edited && field in edited) {
      return edited[field as keyof EditedProduct]
    }
    return product[field]
  }

  const isEdited = (productId: string) => {
    return editedProducts.has(productId)
  }

  const handleSaveAll = async () => {
    if (editedProducts.size === 0) {
      toast.info("No changes to save")
      return
    }

    setSaving(true)
    let successCount = 0
    let errorCount = 0

    try {
      for (const [productId, changes] of editedProducts.entries()) {
        const { id, ...updateData } = changes
        const { error } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", productId)

        if (error) {
          console.error(`Error updating product ${productId}:`, error)
          errorCount++
        } else {
          successCount++
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} product(s) updated successfully`)
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} product(s) failed to update`)
      }

      setEditedProducts(new Map())
      fetchProducts()
    } catch (error) {
      console.error("Error saving products:", error)
      toast.error("Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  const handleResetAll = () => {
    setEditedProducts(new Map())
    toast.info("All changes discarded")
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Products Bulk Editor</h1>
              <p className="text-sm text-muted-foreground">
                Edit multiple products at once, like a spreadsheet
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {editedProducts.size > 0 && (
              <Badge variant="secondary" className="text-sm px-3 py-1 rounded-full">
                {editedProducts.size} changed
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={handleResetAll}
              disabled={editedProducts.size === 0}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={saving || editedProducts.size === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : `Save All (${editedProducts.size})`}
            </Button>
          </div>
        </div>

        {/* Filters + Spreadsheet */}
        <div className="w-full min-w-0 max-w-full">
        <Card className="w-full max-w-full overflow-hidden">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, brand, or HSN code..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full pl-8"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(val) => {
                  setCategoryFilter(val)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
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
              <Badge variant="secondary" className="rounded-full self-center">
                {totalCount} products
              </Badge>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Spreadsheet Grid */}
        <div className="w-full min-w-0 max-w-full">
        <Card className="w-full max-w-full overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[1800px]">
                {/* Header */}
                <div className="grid grid-cols-[40px_200px_120px_100px_70px_120px_80px_100px_100px_100px_100px_100px_100px_100px_100px_100px_70px_70px] border-b bg-muted/50 sticky top-0 z-10">
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r">#</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r">Name</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r">Brand</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r">HSN Code</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r">GST%</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r">Category</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r">Stock</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-green-50 dark:bg-green-950/30">Cust. Price</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-green-50 dark:bg-green-950/30">Cust. Sale</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-green-50 dark:bg-green-950/30">Cust. Disc%</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-blue-50 dark:bg-blue-950/30">Dist. Price</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-blue-50 dark:bg-blue-950/30">Dist. Sale</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-blue-50 dark:bg-blue-950/30">Dist. Disc%</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-purple-50 dark:bg-purple-950/30">SubDist Price</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-purple-50 dark:bg-purple-950/30">SubDist Sale</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r bg-purple-50 dark:bg-purple-950/30">SubDist Disc%</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground border-r">Active</div>
                  <div className="p-2 text-xs font-semibold text-muted-foreground">Featured</div>
                </div>

                {/* Rows */}
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading products...</div>
                ) : products.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No products found</div>
                ) : (
                  products.map((product, index) => (
                    <div
                      key={product.id}
                      className={`grid grid-cols-[40px_200px_120px_100px_70px_120px_80px_100px_100px_100px_100px_100px_100px_100px_100px_100px_70px_70px] border-b hover:bg-accent/30 transition-colors ${isEdited(product.id) ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
                    >
                      {/* Row Number */}
                      <div className="p-1.5 text-xs text-muted-foreground border-r flex items-center justify-center">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </div>

                      {/* Name */}
                      <div className="border-r">
                        <input
                          type="text"
                          value={String(getEditedValue(product, "name") || "")}
                          onChange={(e) => handleCellChange(product.id, "name", e.target.value)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Brand */}
                      <div className="border-r">
                        <input
                          type="text"
                          value={String(getEditedValue(product, "brand") || "")}
                          onChange={(e) => handleCellChange(product.id, "brand", e.target.value || null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* HSN Code */}
                      <div className="border-r">
                        <input
                          type="text"
                          value={String(getEditedValue(product, "hsn_code") || "")}
                          onChange={(e) => handleCellChange(product.id, "hsn_code", e.target.value || null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* GST% */}
                      <div className="border-r">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={String(getEditedValue(product, "gst_percentage") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "gst_percentage", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Category */}
                      <div className="border-r">
                        <select
                          value={String(getEditedValue(product, "parent_category_id") || "")}
                          onChange={(e) => handleCellChange(product.id, "parent_category_id", e.target.value || null)}
                          className="w-full h-full px-1 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        >
                          <option value="">None</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Stock */}
                      <div className="border-r">
                        <input
                          type="number"
                          min="0"
                          value={String(getEditedValue(product, "stock") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "stock", e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Customer Price */}
                      <div className="border-r bg-green-50/50 dark:bg-green-950/10">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(getEditedValue(product, "customer_price") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "customer_price", parseFloat(e.target.value) || 0)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Customer Sale Price */}
                      <div className="border-r bg-green-50/50 dark:bg-green-950/10">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(getEditedValue(product, "customer_sale_price") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "customer_sale_price", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Customer Discount % */}
                      <div className="border-r bg-green-50/50 dark:bg-green-950/10">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={String(getEditedValue(product, "customer_discount_percent") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "customer_discount_percent", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Distributor Price */}
                      <div className="border-r bg-blue-50/50 dark:bg-blue-950/10">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(getEditedValue(product, "distributor_price") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "distributor_price", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Distributor Sale Price */}
                      <div className="border-r bg-blue-50/50 dark:bg-blue-950/10">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(getEditedValue(product, "distributor_sale_price") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "distributor_sale_price", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Distributor Discount % */}
                      <div className="border-r bg-blue-50/50 dark:bg-blue-950/10">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={String(getEditedValue(product, "distributor_discount_percent") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "distributor_discount_percent", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Sub-Distributor Price */}
                      <div className="border-r bg-purple-50/50 dark:bg-purple-950/10">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(getEditedValue(product, "sub_distributor_price") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "sub_distributor_price", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Sub-Distributor Sale Price */}
                      <div className="border-r bg-purple-50/50 dark:bg-purple-950/10">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(getEditedValue(product, "sub_distributor_sale_price") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "sub_distributor_sale_price", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Sub-Distributor Discount % */}
                      <div className="border-r bg-purple-50/50 dark:bg-purple-950/10">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={String(getEditedValue(product, "sub_distributor_discount_percent") ?? "")}
                          onChange={(e) => handleCellChange(product.id, "sub_distributor_discount_percent", e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-0 focus:outline-none focus:bg-primary/5"
                        />
                      </div>

                      {/* Active */}
                      <div className="border-r flex items-center justify-center">
                        <button
                          onClick={() => handleCellChange(product.id, "is_active", !(getEditedValue(product, "is_active")))}
                          className={`h-5 w-5 rounded flex items-center justify-center transition-colors ${getEditedValue(product, "is_active") ? 'bg-green-500 text-white' : 'bg-muted border'}`}
                        >
                          {getEditedValue(product, "is_active") ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      </div>

                      {/* Featured */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleCellChange(product.id, "is_featured", !(getEditedValue(product, "is_featured")))}
                          className={`h-5 w-5 rounded flex items-center justify-center transition-colors ${getEditedValue(product, "is_featured") ? 'bg-yellow-500 text-white' : 'bg-muted border'}`}
                        >
                          {getEditedValue(product, "is_featured") ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalCount} products)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
