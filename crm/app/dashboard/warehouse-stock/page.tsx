'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  Warehouse,
  ArrowRightLeft,
  Droplets,
  IndianRupee,
  Layers,
  Beaker,
  Boxes,
} from 'lucide-react'
import Link from 'next/link'
import { StockTableClient } from './stock-table-client'

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

// Extract volume in litres from product name
function extractVolumeLitres(productName: string): number {
  // Match patterns like "500ML", "15 LTR", "1 LTR", "100 ML", "5 LTR"
  const match = productName.match(/(\d+(?:\.\d+)?)\s*(ML|LTR|L|LITRE)/i)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  // Convert to litres
  if (unit === 'ML') return value / 1000
  return value // LTR, L, LITRE are already in litres
}

function WarehouseStockContent() {
  const searchParams = useSearchParams()
  const distributorIdFromUrl = searchParams.get('distributor')

  const [products, setProducts] = useState<WarehouseStock[]>([])
  const [warehouseNames, setWarehouseNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [selectedDistributor, setSelectedDistributor] = useState<string>('all')

  useEffect(() => {
    fetchDistributors()
  }, [])

  useEffect(() => {
    if (distributorIdFromUrl) {
      setSelectedDistributor(distributorIdFromUrl)
    }
  }, [distributorIdFromUrl])

  useEffect(() => {
    fetchStockData()
  }, [selectedDistributor])

  const fetchDistributors = async () => {
    const { data, error } = await supabase
      .from('distributors')
      .select('id, name, company_name')
      .order('name')

    if (!error && data) {
      setDistributors(data)
    }
  }

  const handleDistributorChange = (distributorId: string) => {
    setSelectedDistributor(distributorId)
  }

  const fetchStockData = async () => {
    try {
      setLoading(true)

      // Fetch warehouses - filter by distributor if selected
      let warehouseQuery = supabase
        .from('godowns')
        .select('id, name, distributor_id')
        .order('name')

      if (selectedDistributor && selectedDistributor !== 'all') {
        warehouseQuery = warehouseQuery.eq('distributor_id', selectedDistributor)
      }

      const { data: warehousesData, error: warehousesError } = await warehouseQuery

      if (warehousesError) {
        console.error('Error fetching warehouses:', warehousesError)
        setError('Error loading warehouses')
        return
      }

      // Fetch only product-based stock inventory (finished products)
      // Filter: product_id IS NOT NULL (excludes material-based records)
      const { data: productsData, error: productsError } = await supabase
        .from('stock_inventory')
        .select(`
          id,
          product_id,
          variant_id,
          products (
            id,
            name,
            customer_price,
            customer_sale_price
          ),
          product_variants (
            id,
            variant_name,
            product_categories (
              name
            )
          )
        `)
        .not('product_id', 'is', null)
        .order('products(name)')

      if (productsError) {
        console.error('Error fetching products:', productsError)
        setError('Error loading products')
        return
      }

      // Fetch all stock data
      const { data: stockData, error: stockError } = await supabase
        .from('godown_stock')
        .select(`
          godown_id,
          stock_inventory_id,
          quantity,
          reserved_quantity,
          available_quantity
        `)

      if (stockError) {
        console.error('Error fetching stock:', stockError)
        setError('Error loading stock data')
        return
      }

      processStockData(productsData || [], warehousesData || [], stockData || [])
    } catch (err) {
      console.error('Error:', err)
      setError('Error loading stock data')
    } finally {
      setLoading(false)
    }
  }

  const processStockData = (productsData: any[], warehousesData: any[], stockData: any[]) => {
    // Create a lookup map for stock data: key = "stockInventoryId-godownId"
    const stockLookup = new Map<string, any>()
    stockData.forEach((stock: any) => {
      const key = `${stock.stock_inventory_id}-${stock.godown_id}`
      stockLookup.set(key, stock)
    })

    // Create warehouse names array
    const warehouseNames = warehousesData.map((w: any) => w.name)
    setWarehouseNames(warehouseNames)

    // Process each product
    const processedProducts: WarehouseStock[] = productsData.map((productInventory: any) => {
      const stockInventoryId = productInventory.id
      // Product info comes from direct product_id relation
      const productId = productInventory.products?.id || productInventory.product_id
      const productName = productInventory.products?.name || 'Unknown Product'
      const variantName = productInventory.product_variants?.variant_name || 'Default'
      const categoryName = productInventory.product_variants?.product_categories?.name || 'Uncategorized'

      // Get price (prefer sale price if available)
      const unitPrice = productInventory.products?.customer_sale_price
        || productInventory.products?.customer_price
        || 0

      // Extract volume from product name
      const unitVolumeLitres = extractVolumeLitres(productName)

      const warehouses: { [key: string]: any } = {}
      let total_quantity = 0
      let total_reserved = 0
      let total_available = 0

      // For each warehouse, get the stock or default to 0
      warehousesData.forEach((warehouse: any) => {
        const key = `${stockInventoryId}-${warehouse.id}`
        const stock = stockLookup.get(key)

        const quantity = stock?.quantity || 0
        const reserved_quantity = stock?.reserved_quantity || 0
        const available_quantity = stock?.available_quantity || 0

        warehouses[warehouse.name] = {
          godown_id: warehouse.id,
          warehouse_name: warehouse.name,
          quantity,
          reserved_quantity,
          available_quantity,
        }

        total_quantity += quantity
        total_reserved += reserved_quantity
        total_available += available_quantity
      })

      return {
        product_id: productId,
        product_name: productName,
        variant_name: variantName,
        category_name: categoryName,
        stock_inventory_id: stockInventoryId,
        warehouses,
        total_quantity,
        total_reserved,
        total_available,
        unit_volume_litres: unitVolumeLitres,
        unit_price: unitPrice,
        total_litres: unitVolumeLitres * total_quantity,
        total_amount: unitPrice * total_quantity,
      }
    })

    setProducts(processedProducts)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-72" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchStockData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const selectedDistributorName = selectedDistributor && selectedDistributor !== 'all'
    ? distributors.find(d => d.id === selectedDistributor)?.name || 'Selected Distributor'
    : null

  // Calculate category-wise totals
  const getCategoryData = (categoryName: string) => {
    const categoryProducts = products.filter(p => p.category_name === categoryName)
    return {
      products: categoryProducts,
      totalQuantity: categoryProducts.reduce((sum, p) => sum + p.total_quantity, 0),
      totalLitres: categoryProducts.reduce((sum, p) => sum + p.total_litres, 0),
      totalAmount: categoryProducts.reduce((sum, p) => sum + p.total_amount, 0),
      totalAvailable: categoryProducts.reduce((sum, p) => sum + p.total_available, 0),
      totalReserved: categoryProducts.reduce((sum, p) => sum + p.total_reserved, 0),
    }
  }

  const categoryData = {
    cowGhee: getCategoryData('Cow Ghee'),
    buffaloGhee: getCategoryData('Buffalo Ghee'),
    valonaGhee: getCategoryData('Valona Ghee'),
    groundnutOil: getCategoryData('Groundnut Oil'),
  }

  // Grand totals
  const grandTotals = {
    totalQuantity: products.reduce((sum, p) => sum + p.total_quantity, 0),
    totalLitres: products.reduce((sum, p) => sum + p.total_litres, 0),
    totalAmount: products.reduce((sum, p) => sum + p.total_amount, 0),
    totalAvailable: products.reduce((sum, p) => sum + p.total_available, 0),
    totalReserved: products.reduce((sum, p) => sum + p.total_reserved, 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Warehouse className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Warehouse Stock Overview
            </h1>
            <p className="text-sm text-muted-foreground">
              View and manage stock levels across {selectedDistributorName ? `${selectedDistributorName}'s warehouses` : 'all warehouses'}
            </p>
          </div>
        </div>
        <Link href="/dashboard/stock-transfers/new">
          <Button>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer Stock
          </Button>
        </Link>
      </div>

      {/* Category-wise Stock Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cow Ghee */}
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardDescription>Cow Ghee</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {categoryData.cowGhee.totalLitres.toFixed(2)} L
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/60">
                <Layers className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Products:</span>
              <span className="font-medium">{categoryData.cowGhee.products.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-semibold tabular-nums">{categoryData.cowGhee.totalQuantity.toLocaleString()} pcs</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-semibold tabular-nums text-green-600">{categoryData.cowGhee.totalAvailable.toLocaleString()} pcs</span>
            </div>
            {categoryData.cowGhee.totalReserved > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reserved:</span>
                <span className="font-semibold tabular-nums text-orange-600">{categoryData.cowGhee.totalReserved.toLocaleString()} pcs</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t pt-2">
              <span className="text-muted-foreground font-medium">Total Amount:</span>
              <span className="font-bold tabular-nums text-primary">₹{categoryData.cowGhee.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Buffalo Ghee */}
        <Card className="border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20">
          <CardHeader>
            <CardDescription>Buffalo Ghee</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-400">
              {categoryData.buffaloGhee.totalLitres.toFixed(2)} L
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/60">
                <Beaker className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Products:</span>
              <span className="font-medium">{categoryData.buffaloGhee.products.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-semibold tabular-nums">{categoryData.buffaloGhee.totalQuantity.toLocaleString()} pcs</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-semibold tabular-nums text-green-600">{categoryData.buffaloGhee.totalAvailable.toLocaleString()} pcs</span>
            </div>
            {categoryData.buffaloGhee.totalReserved > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reserved:</span>
                <span className="font-semibold tabular-nums text-orange-600">{categoryData.buffaloGhee.totalReserved.toLocaleString()} pcs</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t pt-2">
              <span className="text-muted-foreground font-medium">Total Amount:</span>
              <span className="font-bold tabular-nums text-primary">₹{categoryData.buffaloGhee.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Valona Ghee */}
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardHeader>
            <CardDescription>Valona Ghee</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {categoryData.valonaGhee.totalLitres.toFixed(2)} L
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60">
                <Droplets className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Products:</span>
              <span className="font-medium">{categoryData.valonaGhee.products.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-semibold tabular-nums">{categoryData.valonaGhee.totalQuantity.toLocaleString()} pcs</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-semibold tabular-nums text-green-600">{categoryData.valonaGhee.totalAvailable.toLocaleString()} pcs</span>
            </div>
            {categoryData.valonaGhee.totalReserved > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reserved:</span>
                <span className="font-semibold tabular-nums text-orange-600">{categoryData.valonaGhee.totalReserved.toLocaleString()} pcs</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t pt-2">
              <span className="text-muted-foreground font-medium">Total Amount:</span>
              <span className="font-bold tabular-nums text-primary">₹{categoryData.valonaGhee.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Groundnut Oil */}
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader>
            <CardDescription>Groundnut Oil</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-700 dark:text-orange-400">
              {categoryData.groundnutOil.totalLitres.toFixed(2)} L
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60">
                <Droplets className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Products:</span>
              <span className="font-medium">{categoryData.groundnutOil.products.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-semibold tabular-nums">{categoryData.groundnutOil.totalQuantity.toLocaleString()} pcs</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-semibold tabular-nums text-green-600">{categoryData.groundnutOil.totalAvailable.toLocaleString()} pcs</span>
            </div>
            {categoryData.groundnutOil.totalReserved > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reserved:</span>
                <span className="font-semibold tabular-nums text-orange-600">{categoryData.groundnutOil.totalReserved.toLocaleString()} pcs</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t pt-2">
              <span className="text-muted-foreground font-medium">Total Amount:</span>
              <span className="font-bold tabular-nums text-primary">₹{categoryData.groundnutOil.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Products</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {products.length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Boxes className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Unique product variants
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Warehouses</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {warehouseNames.length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Warehouse className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Active warehouse locations
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Stock</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {grandTotals.totalLitres.toFixed(2)} L
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Package className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {grandTotals.totalQuantity.toLocaleString()} units
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader>
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-green-600">
              ₹{grandTotals.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950/60">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Stock value at sale price
          </CardContent>
        </Card>
      </div>

      {/* Stock Table with Filters */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Stock Distribution</CardTitle>
                <CardDescription className="mt-0.5">
                  Product quantities across {selectedDistributorName ? `${selectedDistributorName}'s warehouse locations` : 'all warehouse locations'}
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
              {products.length} {products.length === 1 ? "product" : "products"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 min-w-0 max-w-full">
          <div className="w-0 min-w-full max-w-full overflow-hidden">
            <StockTableClient
              products={products}
              warehouseNames={warehouseNames}
              onStockUpdate={fetchStockData}
              distributors={distributors}
              selectedDistributor={selectedDistributor}
              onDistributorChange={handleDistributorChange}
            />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Legend
          </CardTitle>
          <CardDescription>What each column means</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 text-sm space-y-2">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Total:</div>
            <div className="text-muted-foreground">Total quantity in warehouse</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-orange-600 font-medium">Reserved:</div>
            <div className="text-muted-foreground">Stock reserved for pending transfers</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-green-600 font-medium">Available:</div>
            <div className="text-muted-foreground">Stock available for transfer (Total - Reserved)</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function WarehouseStockPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-72" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    }>
      <WarehouseStockContent />
    </Suspense>
  )
}
