'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Warehouse, Pencil, RefreshCw } from 'lucide-react'
import { EditStockDialog } from '@/app/dashboard/warehouse-stock/edit-stock-dialog'

type WarehouseStockData = {
  godown_id: string
  godown_name: string
  stock_inventory_id: string
  variant_name: string
  quantity: number
  reserved_quantity: number
  available_quantity: number
}

type ProductWarehouseStockProps = {
  productId: string
  productName: string
}

export function ProductWarehouseStock({ productId, productName }: ProductWarehouseStockProps) {
  const [stockData, setStockData] = useState<WarehouseStockData[]>([])
  const [loading, setLoading] = useState(true)
  const [editDialog, setEditDialog] = useState({
    open: false,
    godownId: '',
    godownName: '',
    stockInventoryId: '',
    productName: '',
    variantName: '',
    currentQuantity: 0,
  })

  useEffect(() => {
    fetchWarehouseStock()
  }, [productId])

  const fetchWarehouseStock = async () => {
    try {
      setLoading(true)

      // First get stock inventory IDs for this product
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('stock_inventory')
        .select(`
          id,
          variant_id,
          product_variants (
            variant_name
          )
        `)
        .eq('product_id', productId)

      if (inventoryError) throw inventoryError

      if (!inventoryData || inventoryData.length === 0) {
        setStockData([])
        return
      }

      const inventoryIds = inventoryData.map(inv => inv.id)

      // Then get godown stock for these inventory IDs
      const { data: stockData, error: stockError } = await supabase
        .from('godown_stock')
        .select(`
          godown_id,
          stock_inventory_id,
          quantity,
          reserved_quantity,
          available_quantity,
          godowns (
            name
          )
        `)
        .in('stock_inventory_id', inventoryIds)
        .order('quantity', { ascending: false })

      if (stockError) throw stockError

      // Transform the data
      const transformed: WarehouseStockData[] = (stockData || []).map((stock: any) => {
        const inventory = inventoryData.find(inv => inv.id === stock.stock_inventory_id)
        // Handle product_variants which can be an array or object
        const variantName = inventory?.product_variants
          ? (Array.isArray(inventory.product_variants)
              ? inventory.product_variants[0]?.variant_name
              : (inventory.product_variants as any)?.variant_name)
          : 'Default'

        return {
          godown_id: stock.godown_id,
          godown_name: stock.godowns?.name || 'Unknown',
          stock_inventory_id: stock.stock_inventory_id,
          variant_name: variantName || 'Default',
          quantity: stock.quantity,
          reserved_quantity: stock.reserved_quantity,
          available_quantity: stock.available_quantity,
        }
      })

      setStockData(transformed)
    } catch (error) {
      console.error('Error fetching warehouse stock:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditStock = (
    godownId: string,
    godownName: string,
    stockInventoryId: string,
    variantName: string,
    currentQuantity: number
  ) => {
    setEditDialog({
      open: true,
      godownId,
      godownName,
      stockInventoryId,
      productName,
      variantName,
      currentQuantity,
    })
  }

  const totalQuantity = stockData.reduce((sum, stock) => sum + stock.quantity, 0)
  const totalReserved = stockData.reduce((sum, stock) => sum + stock.reserved_quantity, 0)
  const totalAvailable = stockData.reduce((sum, stock) => sum + stock.available_quantity, 0)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            Warehouse Stock
          </CardTitle>
          <CardDescription>Loading stock information...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (stockData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            Warehouse Stock
          </CardTitle>
          <CardDescription>No stock available in any warehouse</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This product has not been stocked in any warehouse yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-4 w-4" />
                Warehouse Stock
              </CardTitle>
              <CardDescription>
                Stock levels across all warehouses ({stockData.length} locations)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWarehouseStock}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total Quantity</p>
                <p className="text-2xl font-bold">{totalQuantity}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reserved</p>
                <p className="text-2xl font-bold text-orange-600">{totalReserved}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold text-green-600">{totalAvailable}</p>
              </div>
            </div>

            {/* Stock Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-center">Reserved</TableHead>
                    <TableHead className="text-center">Available</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockData.map((stock) => (
                    <TableRow key={`${stock.godown_id}-${stock.stock_inventory_id}`}>
                      <TableCell className="font-medium">{stock.godown_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{stock.variant_name}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {stock.quantity}
                      </TableCell>
                      <TableCell className="text-center">
                        {stock.reserved_quantity > 0 ? (
                          <Badge variant="secondary">{stock.reserved_quantity}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-medium">
                        {stock.available_quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleEditStock(
                              stock.godown_id,
                              stock.godown_name,
                              stock.stock_inventory_id,
                              stock.variant_name,
                              stock.quantity
                            )
                          }
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditStockDialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ ...editDialog, open })}
        godownId={editDialog.godownId}
        godownName={editDialog.godownName}
        stockInventoryId={editDialog.stockInventoryId}
        productName={editDialog.productName}
        variantName={editDialog.variantName}
        currentQuantity={editDialog.currentQuantity}
        onSuccess={fetchWarehouseStock}
      />
    </>
  )
}
