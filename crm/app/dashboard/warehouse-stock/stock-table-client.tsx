'use client'

import { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { StockFilters } from './stock-filters'
import { EditStockDialog } from './edit-stock-dialog'

type WarehouseStock = {
  product_id: string
  product_name: string
  variant_name: string
  category_name: string
  stock_inventory_id: string
  warehouses: {
    [key: string]: {
      godown_id: string
      warehouse_name: string
      quantity: number
      reserved_quantity: number
      available_quantity: number
    }
  }
  total_quantity: number
  total_reserved: number
  total_available: number
  unit_volume_litres: number
  unit_price: number
  total_litres: number
  total_amount: number
}

type Distributor = {
  id: string
  name: string
  company_name: string
}

type StockTableClientProps = {
  products: WarehouseStock[]
  warehouseNames: string[]
  onStockUpdate?: () => void
  distributors?: Distributor[]
  selectedDistributor?: string
  onDistributorChange?: (distributorId: string) => void
}

type EditDialogState = {
  open: boolean
  godownId: string
  godownName: string
  stockInventoryId: string
  productName: string
  variantName: string
  currentQuantity: number
}

export function StockTableClient({
  products,
  warehouseNames,
  onStockUpdate,
  distributors,
  selectedDistributor,
  onDistributorChange
}: StockTableClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Get unique categories from products
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category_name))).sort()
  }, [products])
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    godownId: '',
    godownName: '',
    stockInventoryId: '',
    productName: '',
    variantName: '',
    currentQuantity: 0,
  })

  const handleEditStock = (
    godownId: string,
    godownName: string,
    stockInventoryId: string,
    productName: string,
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

  const handleEditSuccess = () => {
    if (onStockUpdate) {
      onStockUpdate()
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.variant_name.toLowerCase().includes(searchQuery.toLowerCase())

      // Warehouse filter
      const matchesWarehouse =
        warehouseFilter === 'all' ||
        product.warehouses[warehouseFilter] !== undefined

      // Category filter
      const matchesCategory =
        selectedCategory === 'all' ||
        product.category_name === selectedCategory

      return matchesSearch && matchesWarehouse && matchesCategory
    })
  }, [products, searchQuery, warehouseFilter, selectedCategory])

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    return {
      totalQuantity: filteredProducts.reduce((sum, p) => sum + p.total_quantity, 0),
      totalReserved: filteredProducts.reduce((sum, p) => sum + p.total_reserved, 0),
      totalAvailable: filteredProducts.reduce((sum, p) => sum + p.total_available, 0),
      totalLitres: filteredProducts.reduce((sum, p) => sum + p.total_litres, 0),
      totalAmount: filteredProducts.reduce((sum, p) => sum + p.total_amount, 0),
    }
  }, [filteredProducts])

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      <StockFilters
        onSearchChange={setSearchQuery}
        onWarehouseFilter={setWarehouseFilter}
        warehouses={warehouseNames}
        categories={uniqueCategories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        distributors={distributors}
        selectedDistributor={selectedDistributor}
        onDistributorChange={onDistributorChange}
      />

      {/* Summary of filtered results */}
      {(searchQuery || warehouseFilter !== 'all' || selectedCategory !== 'all') && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredProducts.length} of {products.length} products
          {selectedCategory !== 'all' && ` in ${selectedCategory}`}
          {warehouseFilter !== 'all' && ` at ${warehouseFilter}`}
        </div>
      )}

      <div className="w-0 min-w-full max-w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="min-w-[250px] font-semibold uppercase tracking-wider text-[11px]">Product</TableHead>
              <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Variant</TableHead>
              {warehouseNames.map((warehouse) => (
                <TableHead key={warehouse} className="text-center font-semibold uppercase tracking-wider text-[11px]">
                  {warehouse}
                </TableHead>
              ))}
              <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px]">Total</TableHead>
              <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px]">Reserved</TableHead>
              <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px] text-green-600">Available</TableHead>
              <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px] text-blue-600">Total Litres</TableHead>
              <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px] text-purple-600">Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={warehouseNames.length + 7} className="text-center py-8 text-muted-foreground">
                  {searchQuery || warehouseFilter !== 'all'
                    ? 'No products match your filters'
                    : 'No stock data available'}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredProducts.map((product) => (
                  <TableRow key={`${product.product_id}-${product.stock_inventory_id}`} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {product.product_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.variant_name}</Badge>
                    </TableCell>
                    {warehouseNames.map((warehouseName) => {
                      const warehouseStock = product.warehouses[warehouseName]
                      return (
                        <TableCell key={warehouseName} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                              <span className={
                                (warehouseStock?.quantity || 0) < 0
                                  ? "font-medium text-red-600"
                                  : (warehouseStock?.quantity || 0) > 0
                                    ? "font-medium"
                                    : "text-muted-foreground"
                              }>
                                {warehouseStock?.quantity || 0}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() =>
                                  handleEditStock(
                                    warehouseStock?.godown_id || '',
                                    warehouseName,
                                    product.stock_inventory_id,
                                    product.product_name,
                                    product.variant_name,
                                    warehouseStock?.quantity || 0
                                  )
                                }
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                            {warehouseStock?.reserved_quantity > 0 && (
                              <div className="text-xs text-orange-600">
                                ({warehouseStock.reserved_quantity} reserved)
                              </div>
                            )}
                          </div>
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center font-semibold">
                      <span className={product.total_quantity < 0 ? "text-red-600" : ""}>
                        {product.total_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {product.total_reserved > 0 ? (
                        <Badge variant="secondary">{product.total_reserved}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className={
                        product.total_available < 0
                          ? "font-medium text-red-600"
                          : "font-medium text-green-600"
                      }>
                        {product.total_available}
                      </span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className="font-medium text-blue-600">
                        {product.total_litres > 0 ? `${product.total_litres.toFixed(2)} L` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className="font-medium text-purple-600">
                        {product.total_amount > 0 ? `₹${product.total_amount.toLocaleString()}` : '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                {filteredProducts.length > 1 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>TOTALS</TableCell>
                    {warehouseNames.map((warehouseName) => {
                      const warehouseTotal = filteredProducts.reduce((sum, product) => {
                        const stock = product.warehouses[warehouseName]
                        return sum + (stock?.quantity || 0)
                      }, 0)
                      return (
                        <TableCell key={warehouseName} className="text-center">
                          <span className={warehouseTotal < 0 ? "text-red-600" : ""}>
                            {warehouseTotal !== 0 ? warehouseTotal : '-'}
                          </span>
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center tabular-nums">
                      <span className={filteredTotals.totalQuantity < 0 ? "text-red-600" : ""}>
                        {filteredTotals.totalQuantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{filteredTotals.totalReserved}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className={filteredTotals.totalAvailable < 0 ? "text-red-600" : "text-green-600"}>
                        {filteredTotals.totalAvailable}
                      </span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className="text-blue-600">
                        {filteredTotals.totalLitres > 0 ? `${filteredTotals.totalLitres.toFixed(2)} L` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className="text-purple-600">
                        {filteredTotals.totalAmount > 0 ? `₹${filteredTotals.totalAmount.toLocaleString()}` : '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <EditStockDialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ ...editDialog, open })}
        godownId={editDialog.godownId}
        godownName={editDialog.godownName}
        stockInventoryId={editDialog.stockInventoryId}
        productName={editDialog.productName}
        variantName={editDialog.variantName}
        currentQuantity={editDialog.currentQuantity}
        onSuccess={handleEditSuccess}
      />
    </div>
  )
}
