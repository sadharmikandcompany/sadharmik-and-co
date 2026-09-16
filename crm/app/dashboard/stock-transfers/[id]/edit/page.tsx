"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
  godown_type: string
}

type StockInventory = {
  id: string
  product_id: string | null
  variant_id: string | null
  material_id: string | null
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

type GodownStock = {
  id: string
  godown_id: string
  stock_inventory_id: string
  quantity: number
  available_quantity: number
  stock_inventory: StockInventory
}

type TransferItem = {
  id?: string // Optional for existing items
  stock_inventory_id: string
  quantity: number
  available_quantity: number
  product_name: string
  product_detail: string
}

type ExistingTransfer = {
  id: string
  from_godown_id: string
  to_godown_id: string
  transfer_reason: string | null
  is_urgent: boolean
  expected_delivery_date: string | null
  vehicle_number: string | null
  driver_name: string | null
  driver_phone: string | null
  notes: string | null
  stock_transfer_items: {
    id: string
    stock_inventory_id: string
    quantity: number
    stock_inventory: {
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
    } | null
  }[]
}

export default function EditStockTransferPage() {
  const params = useParams()
  const router = useRouter()
  const transferId = params.id as string

  const [godowns, setGodowns] = useState<Godown[]>([])
  const [stockItems, setStockItems] = useState<GodownStock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    from_godown_id: "",
    to_godown_id: "",
    transfer_reason: "",
    is_urgent: false,
    expected_delivery_date: "",
    vehicle_number: "",
    driver_name: "",
    driver_phone: "",
    notes: ""
  })

  const [transferItems, setTransferItems] = useState<TransferItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState("")
  const [selectedQuantity, setSelectedQuantity] = useState("")

  useEffect(() => {
    fetchGodowns()
    fetchTransferDetails()
  }, [])

  useEffect(() => {
    if (formData.from_godown_id) {
      fetchStockAtGodown(formData.from_godown_id)
    } else {
      setStockItems([])
    }
  }, [formData.from_godown_id])

  const fetchGodowns = async () => {
    const { data, error } = await supabase
      .from("godowns")
      .select("id, name, godown_code, godown_type")
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("Error fetching godowns:", error)
      toast.error("Failed to fetch warehouses")
    } else {
      setGodowns(data || [])
    }
  }

  const fetchTransferDetails = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("stock_transfers")
      .select(`
        *,
        stock_transfer_items (
          id,
          stock_inventory_id,
          quantity,
          stock_inventory (
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
        )
      `)
      .eq("id", transferId)
      .single()

    if (error) {
      console.error("Error fetching transfer:", error)
      toast.error("Failed to fetch transfer details")
      router.push("/dashboard/stock-transfers")
      return
    }

    const transfer = data as ExistingTransfer

    // Check if transfer can be edited
    if (transfer && data.transfer_status !== "pending") {
      toast.error("Only pending transfers can be edited")
      router.push(`/dashboard/stock-transfers/${transferId}`)
      return
    }

    // Set form data
    setFormData({
      from_godown_id: transfer.from_godown_id,
      to_godown_id: transfer.to_godown_id,
      transfer_reason: transfer.transfer_reason || "",
      is_urgent: transfer.is_urgent,
      expected_delivery_date: transfer.expected_delivery_date || "",
      vehicle_number: transfer.vehicle_number || "",
      driver_name: transfer.driver_name || "",
      driver_phone: transfer.driver_phone || "",
      notes: transfer.notes || ""
    })

    // Set transfer items
    const items = transfer.stock_transfer_items.map(item => {
      const product = item.stock_inventory?.products
      const variant = item.stock_inventory?.product_variants
      const material = item.stock_inventory?.packaging_materials

      return {
        id: item.id,
        stock_inventory_id: item.stock_inventory_id,
        quantity: item.quantity,
        available_quantity: item.quantity, // Will be updated when stock is fetched
        product_name: product?.name || material?.name || "Unknown",
        product_detail: variant?.variant_name || product?.brand || ""
      }
    })

    setTransferItems(items)
    setLoading(false)
  }

  const fetchStockAtGodown = async (godownId: string) => {
    const { data, error } = await supabase
      .from("godown_stock")
      .select(`
        *,
        stock_inventory (
          id,
          product_id,
          variant_id,
          material_id,
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
      .gt("available_quantity", 0)
      .order("available_quantity", { ascending: false })

    if (error) {
      console.error("Error fetching stock:", error)
      toast.error("Failed to fetch stock at warehouse")
    } else {
      setStockItems(data || [])

      // Update available quantities for existing items
      setTransferItems(prevItems =>
        prevItems.map(item => {
          const stockItem = data?.find(s => s.stock_inventory_id === item.stock_inventory_id)
          return {
            ...item,
            available_quantity: stockItem ? stockItem.available_quantity + item.quantity : item.quantity
          }
        })
      )
    }
  }

  const addProductToTransfer = () => {
    if (!selectedProduct) {
      toast.error("Please select a product")
      return
    }

    const quantity = parseInt(selectedQuantity)
    if (!quantity || quantity <= 0) {
      toast.error("Please enter a valid quantity")
      return
    }

    const stockItem = stockItems.find(s => s.stock_inventory_id === selectedProduct)
    if (!stockItem) {
      toast.error("Invalid product selected")
      return
    }

    // Check if product already added
    const existingItem = transferItems.find(i => i.stock_inventory_id === selectedProduct)
    if (existingItem) {
      toast.error("This product is already added. Remove it first to change quantity.")
      return
    }

    if (quantity > stockItem.available_quantity) {
      toast.error(`Quantity cannot exceed available stock (${stockItem.available_quantity} units)`)
      return
    }

    const product = stockItem.stock_inventory?.products
    const variant = stockItem.stock_inventory?.product_variants
    const material = stockItem.stock_inventory?.packaging_materials

    const name = product?.name || material?.name || "Unknown"
    const detail = variant?.variant_name || product?.brand || ""

    const newItem: TransferItem = {
      stock_inventory_id: selectedProduct,
      quantity: quantity,
      available_quantity: stockItem.available_quantity,
      product_name: name,
      product_detail: detail
    }

    setTransferItems([...transferItems, newItem])
    setSelectedProduct("")
    setSelectedQuantity("")
    toast.success("Product added to transfer")
  }

  const removeProductFromTransfer = (stockInventoryId: string) => {
    setTransferItems(transferItems.filter(item => item.stock_inventory_id !== stockInventoryId))
    toast.success("Product removed from transfer")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.from_godown_id || !formData.to_godown_id) {
      toast.error("Please select source and destination warehouses")
      return
    }

    if (formData.from_godown_id === formData.to_godown_id) {
      toast.error("Source and destination warehouses must be different")
      return
    }

    if (transferItems.length === 0) {
      toast.error("Please add at least one product to transfer")
      return
    }

    setSaving(true)

    try {
      // Update the stock transfer
      const { error: transferError } = await supabase
        .from("stock_transfers")
        .update({
          from_godown_id: formData.from_godown_id,
          to_godown_id: formData.to_godown_id,
          transfer_reason: formData.transfer_reason || null,
          is_urgent: formData.is_urgent,
          expected_delivery_date: formData.expected_delivery_date || null,
          vehicle_number: formData.vehicle_number || null,
          driver_name: formData.driver_name || null,
          driver_phone: formData.driver_phone || null,
          notes: formData.notes || null,
        })
        .eq("id", transferId)

      if (transferError) throw transferError

      // Delete existing transfer items
      const { error: deleteError } = await supabase
        .from("stock_transfer_items")
        .delete()
        .eq("stock_transfer_id", transferId)

      if (deleteError) throw deleteError

      // Insert new transfer items
      const transferItemsData = transferItems.map(item => ({
        stock_transfer_id: transferId,
        stock_inventory_id: item.stock_inventory_id,
        quantity: item.quantity
      }))

      const { error: itemsError } = await supabase
        .from("stock_transfer_items")
        .insert(transferItemsData)

      if (itemsError) throw itemsError

      toast.success(`Transfer updated with ${transferItems.length} product(s)`)
      router.push(`/dashboard/stock-transfers/${transferId}`)
    } catch (error: unknown) {
      console.error("Error updating transfer:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update transfer"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const getStockItemLabel = (item: GodownStock) => {
    const product = item.stock_inventory?.products
    const variant = item.stock_inventory?.product_variants
    const material = item.stock_inventory?.packaging_materials

    const name = product?.name || material?.name || "Unknown"
    const detail = variant?.variant_name || product?.brand || ""
    const available = item.available_quantity

    return `${name}${detail ? ` - ${detail}` : ""} (Available: ${available})`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard/stock-transfers")}>
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push(`/dashboard/stock-transfers/${transferId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Product Transfer</h1>
          <p className="text-muted-foreground">Update transfer details and products</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Transfer Details</CardTitle>
            <CardDescription>Update source and destination warehouses and products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source and Destination */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from_godown">Source Warehouse *</Label>
                <Select
                  value={formData.from_godown_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, from_godown_id: value })
                    // Clear items if warehouse changes
                    if (value !== formData.from_godown_id) {
                      setTransferItems([])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {godowns.map((godown) => (
                      <SelectItem key={godown.id} value={godown.id}>
                        {godown.name} ({godown.godown_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="to_godown">Destination Warehouse *</Label>
                <Select
                  value={formData.to_godown_id}
                  onValueChange={(value) => setFormData({ ...formData, to_godown_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {godowns
                      .filter(g => g.id !== formData.from_godown_id)
                      .map((godown) => (
                        <SelectItem key={godown.id} value={godown.id}>
                          {godown.name} ({godown.godown_code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product Selection */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold">Add Products to Transfer *</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="product">Select Product</Label>
                  <Select
                    value={selectedProduct}
                    onValueChange={setSelectedProduct}
                    disabled={!formData.from_godown_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        formData.from_godown_id
                          ? "Select product"
                          : "Select source warehouse first"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {stockItems
                        .filter(item => !transferItems.some(ti => ti.stock_inventory_id === item.stock_inventory_id))
                        .map((item) => (
                          <SelectItem key={item.id} value={item.stock_inventory_id}>
                            {getStockItemLabel(item)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_quantity">Quantity</Label>
                  <Input
                    id="product_quantity"
                    type="number"
                    min="1"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    disabled={!selectedProduct}
                  />
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">
                      Max: {stockItems.find(s => s.stock_inventory_id === selectedProduct)?.available_quantity || 0} units
                    </p>
                  )}
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={addProductToTransfer}
                    disabled={!selectedProduct || !selectedQuantity}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </div>
              </div>
            </div>

            {/* Selected Products Table */}
            {transferItems.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Products ({transferItems.length})</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transferItems.map((item) => (
                        <TableRow key={item.stock_inventory_id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.product_detail || "—"}</TableCell>
                          <TableCell className="font-semibold">{item.quantity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.available_quantity}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProductFromTransfer(item.stock_inventory_id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Transfer Reason */}
            <div className="space-y-2">
              <Label htmlFor="transfer_reason">Transfer Reason</Label>
              <Textarea
                id="transfer_reason"
                value={formData.transfer_reason}
                onChange={(e) => setFormData({ ...formData, transfer_reason: e.target.value })}
                placeholder="Why is this transfer needed?"
                rows={3}
              />
            </div>

            {/* Transport Details */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold">Transport Details (Optional)</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_number">Vehicle Number</Label>
                  <Input
                    id="vehicle_number"
                    value={formData.vehicle_number}
                    onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                    placeholder="MH01AB1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver_name">Driver Name</Label>
                  <Input
                    id="driver_name"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                    placeholder="Driver name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver_phone">Driver Phone</Label>
                  <Input
                    id="driver_phone"
                    value={formData.driver_phone}
                    onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                <Input
                  id="expected_delivery_date"
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-8">
                <input
                  type="checkbox"
                  id="is_urgent"
                  checked={formData.is_urgent}
                  onChange={(e) => setFormData({ ...formData, is_urgent: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_urgent">Mark as Urgent</Label>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional information about this transfer"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/dashboard/stock-transfers/${transferId}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Updating..." : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Transfer
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
