"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Package, ArrowLeft, Download, Minus, Plus, Save, X } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type FactoryProduct = {
  id: string
  stock_inventory_id: string
  product_id: string
  product_name: string
  variant_name: string
  category_name: string
  factory_quantity: number
  min_stock: number
  unit_price: number
  unit_volume_litres: number
}

// Extract volume in litres from product name
function extractVolumeLitres(productName: string): number {
  const match = productName.match(/(\d+(?:\.\d+)?)\s*(ML|LTR|L|LITRE)/i)
  if (!match) return 0
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  if (unit === "ML") return value / 1000
  return value
}

export default function FactoryWarehousePage() {
  const [products, setProducts] = useState<FactoryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Distributor proforma order quantities by product_id
  const [orderQuantities, setOrderQuantities] = useState<Map<string, number>>(new Map())

  // Edit state
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map())
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<FactoryProduct | null>(null)
  const [pendingQuantity, setPendingQuantity] = useState(0)
  const [comment, setComment] = useState("")
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Min stock editing
  const [editingMinId, setEditingMinId] = useState<string | null>(null)
  const [editingMinValue, setEditingMinValue] = useState("")

  useEffect(() => {
    fetchFactoryStock()
    fetchOrderQuantities()
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const fetchFactoryStock = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("factory_warehouse_stock")
        .select(`
          id,
          stock_inventory_id,
          product_id,
          quantity,
          min_stock_level,
          products!inner (
            id,
            name,
            customer_price,
            customer_sale_price
          ),
          stock_inventory!inner (
            price,
            product_variants!inner (
              variant_name,
              product_categories!inner (
                name
              )
            )
          )
        `)

      if (error) throw error

      const transformed: FactoryProduct[] = (data || []).map((item: any) => {
        const productName = item.products?.name || "Unknown Product"
        const unitPrice =
          item.products?.customer_sale_price ||
          item.products?.customer_price ||
          item.stock_inventory?.price ||
          0
        return {
          id: item.id,
          stock_inventory_id: item.stock_inventory_id,
          product_id: item.product_id,
          product_name: productName,
          variant_name: item.stock_inventory?.product_variants?.variant_name || "Default",
          category_name: item.stock_inventory?.product_variants?.product_categories?.name || "Uncategorized",
          factory_quantity: item.quantity || 0,
          min_stock: item.min_stock_level || 0,
          unit_price: unitPrice,
          unit_volume_litres: extractVolumeLitres(productName),
        }
      })

      setProducts(transformed)
    } catch (error) {
      console.error("Error fetching factory stock:", error)
      toast.error("Failed to fetch factory stock")
    } finally {
      setLoading(false)
    }
  }

  const fetchOrderQuantities = async () => {
    try {
      const { data, error } = await supabase
        .from("order_items")
        .select(`
          product_id,
          quantity,
          orders!inner (
            order_status,
            distributor_id,
            invoice_number_gst,
            invoice_number_non_gst
          )
        `)
        .not("orders.distributor_id", "is", null)
        .is("orders.invoice_number_gst", null)
        .is("orders.invoice_number_non_gst", null)
        .in("orders.order_status", ["pending", "confirmed", "processing", "shipped"])

      if (error) throw error

      const quantitiesMap = new Map<string, number>()
      data?.forEach((item: any) => {
        const currentQty = quantitiesMap.get(item.product_id) || 0
        quantitiesMap.set(item.product_id, currentQty + item.quantity)
      })
      setOrderQuantities(quantitiesMap)
    } catch (error) {
      console.error("Error fetching order quantities:", error)
    }
  }

  // Stock editing
  const handleQuantityChange = (id: string, delta: number) => {
    const product = products.find((p) => p.id === id)
    if (!product) return
    const currentPending = pendingChanges.get(id) ?? product.factory_quantity
    const newQuantity = Math.max(0, currentPending + delta)
    setPendingChanges(new Map(pendingChanges.set(id, newQuantity)))
  }

  const handleSaveClick = (product: FactoryProduct) => {
    const newQuantity = pendingChanges.get(product.id)
    if (newQuantity === undefined || newQuantity === product.factory_quantity) {
      toast.error("No changes to save")
      return
    }
    setCurrentProduct(product)
    setPendingQuantity(newQuantity)
    setCommentDialogOpen(true)
  }

  const handleCancelChanges = (id: string) => {
    const newPending = new Map(pendingChanges)
    newPending.delete(id)
    setPendingChanges(newPending)
  }

  const handleCommentSubmit = async () => {
    if (!comment.trim()) {
      toast.error("Comment is required")
      return
    }
    if (!currentProduct) return

    try {
      // Update factory_warehouse_stock
      const { error: stockError } = await supabase
        .from("factory_warehouse_stock")
        .update({ quantity: pendingQuantity })
        .eq("id", currentProduct.id)

      if (stockError) throw stockError

      // Insert comment record in stock_comments for audit trail
      const { error: commentError } = await supabase
        .from("stock_comments")
        .insert([{
          stock_inventory_id: currentProduct.stock_inventory_id,
          user_id: currentUser?.id || null,
          user_email: currentUser?.email || null,
          previous_quantity: currentProduct.factory_quantity,
          new_quantity: pendingQuantity,
          quantity_change: pendingQuantity - currentProduct.factory_quantity,
          comment: `[Factory Warehouse] ${comment}`,
        }])

      if (commentError) console.error("Error saving comment:", commentError)

      // Update local state
      setProducts((prev) =>
        prev.map((p) =>
          p.id === currentProduct.id
            ? { ...p, factory_quantity: pendingQuantity }
            : p
        )
      )

      // Clear pending change
      const newPending = new Map(pendingChanges)
      newPending.delete(currentProduct.id)
      setPendingChanges(newPending)

      toast.success("Factory stock updated")
    } catch (error) {
      console.error("Error updating factory stock:", error)
      toast.error("Failed to update stock")
    } finally {
      setCommentDialogOpen(false)
      setComment("")
      setCurrentProduct(null)
    }
  }

  const handleMinStockSave = async (product: FactoryProduct) => {
    const newMin = parseInt(editingMinValue, 10)
    if (isNaN(newMin) || newMin < 0) {
      toast.error("Invalid min stock value")
      setEditingMinId(null)
      return
    }
    if (newMin === product.min_stock) {
      setEditingMinId(null)
      return
    }

    try {
      const { error } = await supabase
        .from("factory_warehouse_stock")
        .update({ min_stock_level: newMin })
        .eq("id", product.id)

      if (error) throw error

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, min_stock: newMin } : p
        )
      )
      toast.success("Min stock updated")
    } catch (error) {
      console.error("Error updating min stock:", error)
      toast.error("Failed to update min stock")
    } finally {
      setEditingMinId(null)
    }
  }

  const uniqueCategories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category_name))).sort(),
    [products]
  )

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        searchTerm === "" ||
        p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.variant_name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory =
        selectedCategory === "all" || p.category_name === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const totals = useMemo(() => {
    return filteredProducts.reduce(
      (acc, p) => {
        const orders = orderQuantities.get(p.product_id) || 0
        const needed = Math.max(0, orders - p.factory_quantity)
        const minMinusStock = p.min_stock - p.factory_quantity
        const litres = p.unit_volume_litres * p.factory_quantity
        const amount = p.unit_price * p.factory_quantity
        return {
          factoryQty: acc.factoryQty + p.factory_quantity,
          orders: acc.orders + orders,
          needed: acc.needed + needed,
          minStock: acc.minStock + p.min_stock,
          minMinusStock: acc.minMinusStock + minMinusStock,
          litres: acc.litres + litres,
          amount: acc.amount + amount,
        }
      },
      { factoryQty: 0, orders: 0, needed: 0, minStock: 0, minMinusStock: 0, litres: 0, amount: 0 }
    )
  }, [filteredProducts, orderQuantities])

  const exportToCSV = () => {
    const headers = [
      "Category",
      "Product",
      "Variant",
      "Orders",
      "Order - Needed",
      "Min Stock",
      "Min - Stock",
      "Stock",
      "Actual",
      "Litres",
      "Amount (₹)",
    ]
    const rows = filteredProducts.map((p) => {
      const orders = orderQuantities.get(p.product_id) || 0
      const needed = Math.max(0, orders - p.factory_quantity)
      return [
        p.category_name,
        p.product_name,
        p.variant_name,
        orders,
        needed,
        p.min_stock,
        p.min_stock - p.factory_quantity,
        p.factory_quantity,
        p.factory_quantity,
        (p.unit_volume_litres * p.factory_quantity).toFixed(2),
        (p.unit_price * p.factory_quantity).toFixed(2),
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `factory-warehouse-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    toast.success("CSV exported successfully")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Package className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading factory stock data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/stock">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Factory Warehouse</h1>
            <p className="text-muted-foreground mt-1">
              Finished product stock at factory - with orders, min stock, and actual availability
            </p>
          </div>
        </div>
        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredProducts.length}</div>
            <p className="text-xs text-muted-foreground">Finished products at factory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.factoryQty}</div>
            <p className="text-xs text-muted-foreground">Units in factory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Litres</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totals.litres.toFixed(2)} L</div>
            <p className="text-xs text-muted-foreground">Volume at factory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Stock</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.factoryQty === 0 ? "text-red-600" : "text-green-600"}`}>
              {totals.factoryQty}
            </div>
            <p className="text-xs text-muted-foreground">Total units at factory</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Factory Stock</CardTitle>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Input
              placeholder="Search by product or variant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                onClick={() => setSelectedCategory("all")}
                size="sm"
              >
                All
              </Button>
              {uniqueCategories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat)}
                  size="sm"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="border-r">Category</TableHead>
                  <TableHead className="text-center border-r">Orders</TableHead>
                  <TableHead className="text-center border-r">Order - Needed</TableHead>
                  <TableHead className="text-center border-r">Min</TableHead>
                  <TableHead className="text-center border-r">Min - Stock</TableHead>
                  <TableHead className="text-center min-w-[180px] border-r">Stock</TableHead>
                  <TableHead className="text-center border-r">Actual</TableHead>
                  <TableHead className="text-center border-r">Litres</TableHead>
                  <TableHead className="text-center">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredProducts.map((product) => {
                      const orders = orderQuantities.get(product.product_id) || 0
                      const needed = Math.max(0, orders - product.factory_quantity)
                      const minMinusStock = product.min_stock - product.factory_quantity
                      const hasPendingChange = pendingChanges.has(product.id)
                      const displayQuantity = pendingChanges.get(product.id) ?? product.factory_quantity
                      const litres = product.unit_volume_litres * displayQuantity
                      const amount = product.unit_price * displayQuantity

                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.product_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{product.variant_name}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground border-r">{product.category_name}</TableCell>
                          <TableCell className="text-center border-r">
                            <span className={orders > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                              {orders > 0 ? orders : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center border-r">
                            <span className={needed > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                              {needed > 0 ? `-${needed}` : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center border-r">
                            {editingMinId === product.id ? (
                              <Input
                                type="number"
                                min={0}
                                value={editingMinValue}
                                onChange={(e) => setEditingMinValue(e.target.value)}
                                onBlur={() => handleMinStockSave(product)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleMinStockSave(product)
                                  if (e.key === "Escape") setEditingMinId(null)
                                }}
                                className="h-7 w-16 text-center mx-auto"
                                autoFocus
                              />
                            ) : (
                              <span
                                className="text-muted-foreground cursor-pointer hover:text-foreground hover:underline"
                                onClick={() => {
                                  setEditingMinId(product.id)
                                  setEditingMinValue(String(product.min_stock))
                                }}
                                title="Click to edit"
                              >
                                {product.min_stock > 0 ? product.min_stock : "-"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center border-r">
                            <span className={`font-semibold ${minMinusStock > 0 ? "text-red-600" : "text-green-600"}`}>
                              {minMinusStock}
                            </span>
                          </TableCell>
                          <TableCell className="text-center border-r">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleQuantityChange(product.id, -1)}
                                disabled={displayQuantity === 0}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className={`font-semibold min-w-[2rem] text-center ${hasPendingChange ? "text-orange-600" : ""}`}>
                                {displayQuantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleQuantityChange(product.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              {hasPendingChange && (
                                <>
                                  <Button
                                    variant="default"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleSaveClick(product)}
                                    title="Save changes"
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleCancelChanges(product.id)}
                                    title="Cancel changes"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center border-r">
                            <span className={`font-semibold ${displayQuantity === 0 ? "text-red-500" : ""}`}>
                              {displayQuantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-center border-r">
                            <span className="text-blue-600">
                              {litres > 0 ? `${litres.toFixed(2)}` : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-purple-600">
                              {amount > 0 ? `₹${amount.toLocaleString()}` : "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {/* Totals Row */}
                    {filteredProducts.length > 1 && (
                      <TableRow className="bg-muted/50 font-semibold border-t-2">
                        <TableCell colSpan={3} className="border-r">TOTALS</TableCell>
                        <TableCell className="text-center border-r">
                          <span className={totals.orders > 0 ? "text-green-600" : ""}>
                            {totals.orders > 0 ? totals.orders : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center border-r">
                          <span className={totals.needed > 0 ? "text-red-600" : ""}>
                            {totals.needed > 0 ? `-${totals.needed}` : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground border-r">
                          {totals.minStock}
                        </TableCell>
                        <TableCell className="text-center border-r">
                          <span className={totals.minMinusStock > 0 ? "text-red-600" : "text-green-600"}>
                            {totals.minMinusStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-center border-r">{totals.factoryQty}</TableCell>
                        <TableCell className="text-center border-r">
                          {totals.factoryQty}
                        </TableCell>
                        <TableCell className="text-center border-r">
                          <span className="text-blue-600">{totals.litres.toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-purple-600">₹{totals.amount.toLocaleString()}</span>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </CardContent>
      </Card>

      {/* Comment Dialog for stock update */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Factory Stock</DialogTitle>
            <DialogDescription>
              {currentProduct && (
                <>
                  {currentProduct.product_name} ({currentProduct.variant_name})
                  <br />
                  Changing from <strong>{currentProduct.factory_quantity}</strong> to <strong>{pendingQuantity}</strong>
                  <br />
                  Change: <strong>{pendingQuantity - currentProduct.factory_quantity > 0 ? "+" : ""}{pendingQuantity - currentProduct.factory_quantity}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comment">Comment (Required)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note about this change (required)..."
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCommentDialogOpen(false)
              setComment("")
            }}>
              Cancel
            </Button>
            <Button onClick={handleCommentSubmit}>
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
