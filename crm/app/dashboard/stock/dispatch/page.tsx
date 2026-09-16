"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { ArrowLeft, Truck, Plus, Trash2, Package, AlertCircle } from "lucide-react"

type Godown = {
  id: string
  name: string
  godown_code: string | null
  godown_type: string
}

type StockInventoryItem = {
  id: string
  quantity: number
  price: number
  variant_id: string
  material_id: string
  product_variants: {
    variant_name: string
    product_categories: {
      name: string
    }
  }
  packaging_materials: {
    name: string
    material_type: string
  }
}

type DispatchItem = {
  stock_inventory_id: string
  quantity: number
  available_quantity: number
  category_name: string
  variant_name: string
  material_name: string
}

export default function StockDispatchPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [godowns, setGodowns] = useState<Godown[]>([])
  const [stockItems, setStockItems] = useState<StockInventoryItem[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Form state
  const [selectedGodown, setSelectedGodown] = useState("")
  const [selectedProduct, setSelectedProduct] = useState("")
  const [dispatchQuantity, setDispatchQuantity] = useState("")
  const [notes, setNotes] = useState("")

  // Dispatch items list
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([])

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    try {
      // Fetch current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      // Fetch active godowns
      const { data: godownsData, error: godownsError } = await supabase
        .from("godowns")
        .select("id, name, godown_code, godown_type")
        .eq("is_active", true)
        .order("name")

      if (godownsError) throw godownsError
      setGodowns(godownsData || [])

      // Fetch stock inventory with quantity > 0
      const { data: stockData, error: stockError } = await supabase
        .from("stock_inventory")
        .select(`
          id,
          quantity,
          price,
          variant_id,
          material_id,
          product_variants!inner (
            variant_name,
            product_categories!inner (
              name
            )
          ),
          packaging_materials!inner (
            name,
            material_type
          )
        `)
        .gt("quantity", 0)
        .order("quantity", { ascending: false })

      if (stockError) throw stockError

      // Transform the data to match StockInventoryItem type
      // Supabase returns joined tables as arrays, we need to extract the first element
      const transformedStock: StockInventoryItem[] = (stockData || [])
        .filter((item: any) => {
          const material = Array.isArray(item.packaging_materials)
            ? item.packaging_materials[0]
            : item.packaging_materials
          return material?.material_type !== 'content'
        })
        .map((item: any) => {
          const variant = Array.isArray(item.product_variants)
            ? item.product_variants[0]
            : item.product_variants
          const category = Array.isArray(variant?.product_categories)
            ? variant.product_categories[0]
            : variant?.product_categories
          const material = Array.isArray(item.packaging_materials)
            ? item.packaging_materials[0]
            : item.packaging_materials

          return {
            id: item.id,
            quantity: item.quantity,
            price: item.price,
            variant_id: item.variant_id,
            material_id: item.material_id,
            product_variants: {
              variant_name: variant?.variant_name || '',
              product_categories: {
                name: category?.name || ''
              }
            },
            packaging_materials: {
              name: material?.name || '',
              material_type: material?.material_type || ''
            }
          }
        })

      setStockItems(transformedStock)
    } catch (error) {
      console.error("Error fetching initial data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const getProductDisplayName = (item: StockInventoryItem) => {
    return `${item.product_variants.product_categories.name} - ${item.product_variants.variant_name} (${item.packaging_materials.name})`
  }

  const addProductToDispatch = () => {
    if (!selectedProduct) {
      toast.error("Please select a product")
      return
    }

    const quantity = parseInt(dispatchQuantity)
    if (!quantity || quantity <= 0) {
      toast.error("Please enter a valid quantity")
      return
    }

    const stockItem = stockItems.find(s => s.id === selectedProduct)
    if (!stockItem) {
      toast.error("Invalid product selected")
      return
    }

    // Check if already added
    const existingItem = dispatchItems.find(i => i.stock_inventory_id === selectedProduct)
    if (existingItem) {
      toast.error("This product is already added. Remove it first to change quantity.")
      return
    }

    // Check available quantity (accounting for items already in dispatch list)
    const alreadyDispatchedQty = dispatchItems
      .filter(i => i.stock_inventory_id === selectedProduct)
      .reduce((sum, i) => sum + i.quantity, 0)

    const availableQty = stockItem.quantity - alreadyDispatchedQty

    if (quantity > availableQty) {
      toast.error(`Quantity cannot exceed available stock (${availableQty} units)`)
      return
    }

    const newItem: DispatchItem = {
      stock_inventory_id: selectedProduct,
      quantity: quantity,
      available_quantity: stockItem.quantity,
      category_name: stockItem.product_variants.product_categories.name,
      variant_name: stockItem.product_variants.variant_name,
      material_name: stockItem.packaging_materials.name,
    }

    setDispatchItems([...dispatchItems, newItem])
    setSelectedProduct("")
    setDispatchQuantity("")
    toast.success("Product added to dispatch list")
  }

  const removeProductFromDispatch = (stockInventoryId: string) => {
    setDispatchItems(dispatchItems.filter(i => i.stock_inventory_id !== stockInventoryId))
    toast.success("Product removed from dispatch list")
  }

  const generateDispatchNumber = () => {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `DSP-${dateStr}-${randomPart}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedGodown) {
      toast.error("Please select a destination warehouse")
      return
    }

    if (dispatchItems.length === 0) {
      toast.error("Please add at least one product to dispatch")
      return
    }

    setSaving(true)

    try {
      const dispatchNumber = generateDispatchNumber()
      const selectedGodownData = godowns.find(g => g.id === selectedGodown)

      // Step 1: Create dispatch record
      const { data: dispatchData, error: dispatchError } = await supabase
        .from("stock_dispatches")
        .insert([{
          dispatch_number: dispatchNumber,
          to_godown_id: selectedGodown,
          dispatch_status: "completed",
          dispatched_by_user_id: currentUser?.id,
          dispatched_by_email: currentUser?.email,
          notes: notes || null,
        }])
        .select()
        .single()

      if (dispatchError) throw dispatchError

      // Step 2: Create dispatch items
      const dispatchItemsToInsert = dispatchItems.map(item => ({
        stock_dispatch_id: dispatchData.id,
        stock_inventory_id: item.stock_inventory_id,
        quantity: item.quantity,
      }))

      const { error: itemsError } = await supabase
        .from("stock_dispatch_items")
        .insert(dispatchItemsToInsert)

      if (itemsError) throw itemsError

      // Step 3: Update stock_inventory and godown_stock for each item
      for (const item of dispatchItems) {
        // Get current stock inventory quantity
        const { data: currentStock, error: stockFetchError } = await supabase
          .from("stock_inventory")
          .select("quantity")
          .eq("id", item.stock_inventory_id)
          .single()

        if (stockFetchError) throw stockFetchError

        const newQuantity = currentStock.quantity - item.quantity

        // Deduct from stock_inventory
        const { error: stockUpdateError } = await supabase
          .from("stock_inventory")
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.stock_inventory_id)

        if (stockUpdateError) throw stockUpdateError

        // Create stock comment for audit trail
        const { error: commentError } = await supabase
          .from("stock_comments")
          .insert([{
            stock_inventory_id: item.stock_inventory_id,
            previous_quantity: currentStock.quantity,
            new_quantity: newQuantity,
            quantity_change: -item.quantity,
            comment: `Dispatched ${item.quantity} units to ${selectedGodownData?.name || 'warehouse'} (${dispatchNumber})`,
            user_id: currentUser?.id,
            user_email: currentUser?.email,
          }])

        if (commentError) {
          console.error("Error creating stock comment:", commentError)
          // Don't throw - comment is not critical
        }

        // Check if godown_stock entry exists
        const { data: existingGodownStock, error: godownFetchError } = await supabase
          .from("godown_stock")
          .select("id, quantity")
          .eq("godown_id", selectedGodown)
          .eq("stock_inventory_id", item.stock_inventory_id)
          .maybeSingle()

        if (godownFetchError) throw godownFetchError

        if (existingGodownStock) {
          // Update existing godown_stock
          const { error: godownUpdateError } = await supabase
            .from("godown_stock")
            .update({
              quantity: existingGodownStock.quantity + item.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingGodownStock.id)

          if (godownUpdateError) throw godownUpdateError
        } else {
          // Create new godown_stock entry
          const { error: godownInsertError } = await supabase
            .from("godown_stock")
            .insert([{
              godown_id: selectedGodown,
              stock_inventory_id: item.stock_inventory_id,
              quantity: item.quantity,
              reserved_quantity: 0,
            }])

          if (godownInsertError) throw godownInsertError
        }
      }

      toast.success(`Successfully dispatched ${dispatchItems.length} product(s) to ${selectedGodownData?.name}`)
      router.push("/dashboard/stock")
    } catch (error: unknown) {
      console.error("Error creating dispatch:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to create dispatch"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const getTotalItems = () => {
    return dispatchItems.reduce((sum, item) => sum + item.quantity, 0)
  }

  const getSelectedProductMaxQty = () => {
    if (!selectedProduct) return 0
    const stockItem = stockItems.find(s => s.id === selectedProduct)
    if (!stockItem) return 0

    // Account for items already in dispatch list
    const alreadyDispatchedQty = dispatchItems
      .filter(i => i.stock_inventory_id === selectedProduct)
      .reduce((sum, i) => sum + i.quantity, 0)

    return stockItem.quantity - alreadyDispatchedQty
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/stock")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch to Warehouse</h1>
          <p className="text-muted-foreground">
            Transfer stock from main inventory to a warehouse
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Destination Warehouse */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Destination Warehouse
            </CardTitle>
            <CardDescription>
              Select the warehouse to dispatch stock to
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <Label htmlFor="godown">Warehouse</Label>
              <Select value={selectedGodown} onValueChange={setSelectedGodown}>
                <SelectTrigger id="godown" className="mt-1.5">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {godowns.map((godown) => (
                    <SelectItem key={godown.id} value={godown.id}>
                      {godown.name}
                      {godown.godown_code && ` (${godown.godown_code})`}
                      <span className="ml-2 text-xs text-muted-foreground capitalize">
                        - {godown.godown_type}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Add Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Add Products to Dispatch
            </CardTitle>
            <CardDescription>
              Select products from main stock and specify quantities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label htmlFor="product">Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger id="product" className="mt-1.5">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockItems.map((item) => (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        disabled={dispatchItems.some(d => d.stock_inventory_id === item.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{getProductDisplayName(item)}</span>
                          <Badge variant="secondary" className="ml-2">
                            {item.quantity} available
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={getSelectedProductMaxQty()}
                    value={dispatchQuantity}
                    onChange={(e) => setDispatchQuantity(e.target.value)}
                    placeholder="Enter qty"
                  />
                  <Button
                    type="button"
                    onClick={addProductToDispatch}
                    disabled={!selectedProduct || !dispatchQuantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Max: {getSelectedProductMaxQty()} units
                  </p>
                )}
              </div>
            </div>

            {/* Dispatch Items Table */}
            {dispatchItems.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatchItems.map((item) => (
                      <TableRow key={item.stock_inventory_id}>
                        <TableCell>{item.category_name}</TableCell>
                        <TableCell>{item.variant_name}</TableCell>
                        <TableCell>{item.material_name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProductFromDispatch(item.stock_inventory_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No products added yet. Select a product and quantity above to add to the dispatch list.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Notes & Submit */}
        <Card>
          <CardHeader>
            <CardTitle>Dispatch Summary</CardTitle>
            <CardDescription>
              Review and add any notes before dispatching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dispatchItems.length > 0 && (
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">{dispatchItems.length}</p>
                </div>
                <div className="border-l pl-4">
                  <p className="text-sm text-muted-foreground">Total Units</p>
                  <p className="text-2xl font-bold">{getTotalItems()}</p>
                </div>
                {selectedGodown && (
                  <div className="border-l pl-4">
                    <p className="text-sm text-muted-foreground">Destination</p>
                    <p className="text-lg font-semibold">
                      {godowns.find(g => g.id === selectedGodown)?.name}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this dispatch..."
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/stock")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || dispatchItems.length === 0 || !selectedGodown}
              >
                {saving ? (
                  "Dispatching..."
                ) : (
                  <>
                    <Truck className="mr-2 h-4 w-4" />
                    Dispatch to Warehouse
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
