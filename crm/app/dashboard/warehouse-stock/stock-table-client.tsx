'use client'

import { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { StockFilters } from './stock-filters'
import { EditStockDialog } from './edit-stock-dialog'
import { formatKg } from '@/lib/product-weight'

export type FlavourStock = {
  category_id: string
  category_name: string
  label: string
  price_per_kg: number
  warehouses: {
    [key: string]: {
      godown_id: string
      warehouse_name: string
      kg: number
    }
  }
  total_kg: number
  total_amount: number
}

type Distributor = {
  id: string
  name: string
  company_name: string
}

type StockTableClientProps = {
  flavours: FlavourStock[]
  warehouseNames: string[]
  onStockUpdate?: () => void
  distributors?: Distributor[]
  selectedDistributor?: string
  onDistributorChange?: (distributorId: string) => void
  warehouseFilter: string
  onWarehouseFilterChange: (warehouse: string) => void
  // Factory role: only ever one warehouse, so the distributor/warehouse
  // pickers are pointless (and would otherwise expose other warehouses).
  lockWarehouseFilter?: boolean
}

type EditDialogState = {
  open: boolean
  godownId: string
  godownName: string
  categoryId: string
  flavourName: string
  currentKg: number
}

export function StockTableClient({
  flavours,
  warehouseNames,
  onStockUpdate,
  distributors,
  selectedDistributor,
  onDistributorChange,
  warehouseFilter,
  onWarehouseFilterChange,
  lockWarehouseFilter = false,
}: StockTableClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    godownId: '',
    godownName: '',
    categoryId: '',
    flavourName: '',
    currentKg: 0,
  })

  // A selected warehouse narrows the columns to just that one.
  const visibleWarehouses = useMemo(
    () => (warehouseFilter === 'all' ? warehouseNames : [warehouseFilter]),
    [warehouseFilter, warehouseNames]
  )

  const filteredFlavours = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return q ? flavours.filter((f) => f.label.toLowerCase().includes(q)) : flavours
  }, [flavours, searchQuery])

  const kgIn = (f: FlavourStock) =>
    visibleWarehouses.reduce((sum, w) => sum + (f.warehouses[w]?.kg || 0), 0)

  const totalKg = filteredFlavours.reduce((sum, f) => sum + kgIn(f), 0)
  const totalAmount = filteredFlavours.reduce((sum, f) => sum + kgIn(f) * f.price_per_kg, 0)

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      {lockWarehouseFilter ? (
        <div className="relative max-w-sm">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
        </div>
      ) : (
        <StockFilters
          onSearchChange={setSearchQuery}
          selectedWarehouse={warehouseFilter}
          onWarehouseFilter={onWarehouseFilterChange}
          warehouses={warehouseNames}
          distributors={distributors}
          selectedDistributor={selectedDistributor}
          onDistributorChange={onDistributorChange}
        />
      )}

      <div className="w-0 min-w-full max-w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="min-w-[180px] font-semibold uppercase tracking-wider text-[11px]">Flavour</TableHead>
              {visibleWarehouses.map((warehouse) => (
                <TableHead key={warehouse} className="text-center font-semibold uppercase tracking-wider text-[11px]">
                  {warehouse}
                </TableHead>
              ))}
              <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px] text-blue-600">Total Kg</TableHead>
              <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px] text-purple-600">Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFlavours.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleWarehouses.length + 3} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No flavours match your search' : 'No stock data available'}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredFlavours.map((flavour) => {
                  const rowKg = kgIn(flavour)
                  return (
                    <TableRow key={flavour.category_id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">{flavour.label}</TableCell>
                      {visibleWarehouses.map((warehouseName) => {
                        const stock = flavour.warehouses[warehouseName]
                        const kg = stock?.kg || 0
                        return (
                          <TableCell key={warehouseName} className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span
                                className={
                                  kg < 0
                                    ? 'font-medium text-red-600 tabular-nums'
                                    : kg > 0
                                      ? 'font-medium tabular-nums'
                                      : 'text-muted-foreground tabular-nums'
                                }
                              >
                                {formatKg(kg)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                disabled={!stock?.godown_id}
                                onClick={() =>
                                  setEditDialog({
                                    open: true,
                                    godownId: stock?.godown_id || '',
                                    godownName: warehouseName,
                                    categoryId: flavour.category_id,
                                    flavourName: flavour.label,
                                    currentKg: kg,
                                  })
                                }
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-center tabular-nums">
                        <span className={rowKg < 0 ? 'font-semibold text-red-600' : 'font-semibold text-blue-600'}>
                          {formatKg(rowKg)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        <span className="font-medium text-purple-600">
                          {rowKg > 0 ? `₹${(rowKg * flavour.price_per_kg).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredFlavours.length > 1 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>TOTALS</TableCell>
                    {visibleWarehouses.map((warehouseName) => {
                      const warehouseKg = filteredFlavours.reduce(
                        (sum, f) => sum + (f.warehouses[warehouseName]?.kg || 0),
                        0
                      )
                      return (
                        <TableCell key={warehouseName} className="text-center tabular-nums">
                          <span className={warehouseKg < 0 ? 'text-red-600' : ''}>
                            {warehouseKg !== 0 ? formatKg(warehouseKg) : '-'}
                          </span>
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center tabular-nums">
                      <span className="text-blue-600">{formatKg(totalKg)}</span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      <span className="text-purple-600">
                        {totalAmount > 0 ? `₹${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}
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
        categoryId={editDialog.categoryId}
        flavourName={editDialog.flavourName}
        currentKg={editDialog.currentKg}
        onSuccess={() => onStockUpdate?.()}
      />
    </div>
  )
}
