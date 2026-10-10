'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUserRole } from '@/hooks/use-user-role'
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
  IndianRupee,
  Layers,
  Wheat,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { StockTableClient, type FlavourStock } from './stock-table-client'
import { AddProductionDialog } from './add-production-dialog'
import { formatKg } from '@/lib/product-weight'

type Distributor = {
  id: string
  name: string
  company_name: string
}

// Cycled by category index so any number of flavours/categories gets a
// distinct card color — no more hardcoding which 4 flavours exist.
const CARD_STYLES = [
  { border: 'border-amber-200', bg: 'bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400', iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60' },
  { border: 'border-violet-200', bg: 'bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20', text: 'text-violet-700 dark:text-violet-400', iconBg: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60' },
  { border: 'border-emerald-200', bg: 'bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60' },
  { border: 'border-orange-200', bg: 'bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-400', iconBg: 'bg-orange-100 text-orange-600 dark:bg-orange-950/60' },
  { border: 'border-sky-200', bg: 'bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20', text: 'text-sky-700 dark:text-sky-400', iconBg: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60' },
  { border: 'border-rose-200', bg: 'bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20', text: 'text-rose-700 dark:text-rose-400', iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60' },
  { border: 'border-lime-200', bg: 'bg-lime-50/50 dark:border-lime-900 dark:bg-lime-950/20', text: 'text-lime-700 dark:text-lime-400', iconBg: 'bg-lime-100 text-lime-600 dark:bg-lime-950/60' },
] as const

// Extract weight in kg from a product name like "500 GRAM Classic Sada" or "250g Spicy Masala"
function extractWeightKg(productName: string): number {
  const match = productName.match(/(\d+(?:\.\d+)?)\s*(GRAMS?|G|KG|KILOGRAMS?)\b/i)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  if (unit.startsWith('KG') || unit.startsWith('KILOGRAM')) return value
  return value / 1000 // GRAM(S)/G are in grams, convert to kg
}

function WarehouseStockContent() {
  const searchParams = useSearchParams()
  const distributorIdFromUrl = searchParams.get('distributor')
  const { role } = useUserRole()
  const isFactoryRole = role === 'factories'

  const [flavours, setFlavours] = useState<FlavourStock[]>([])
  const [warehouseNames, setWarehouseNames] = useState<string[]>([])
  const [companyGodownId, setCompanyGodownId] = useState<string | null>(null)
  const [companyGodownName, setCompanyGodownName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Set when the godown_kg_stock table hasn't been created yet.
  const [needsMigration, setNeedsMigration] = useState(false)
  const [distributors, setDistributors] = useState<Distributor[]>([])
  // Lifted up from the table so the summary cards below can also react to it
  // — e.g. picking "sadharmik&Company Bhyander" (the factory's own godown,
  // godown_type='company') shows factory-only totals instead of grand
  // totals across the factory + every distributor's godown combined.
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [selectedDistributor, setSelectedDistributor] = useState<string>('all')
  const [addProductionOpen, setAddProductionOpen] = useState(false)

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

  // The factory role only ever deals with their own warehouse — lock the
  // filter to it instead of leaving the full distributor-by-distributor view
  // (and its other distributors' stock) visible.
  useEffect(() => {
    if (isFactoryRole && companyGodownName) {
      setWarehouseFilter(companyGodownName)
    }
  }, [isFactoryRole, companyGodownName])

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
        .select('id, name, distributor_id, godown_type')
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

      const company = (warehousesData || []).find((w: any) => w.godown_type === 'company')
      setCompanyGodownId(company?.id || null)
      setCompanyGodownName(company?.name || null)

      // Finished products — used to find every category that actually has
      // stock-tracked products (khakhra flavours, ghee, and anything added
      // later) and its price per kg (pack price ÷ pack weight). No category
      // is hardcoded, so a new product category shows up automatically.
      const { data: productsData, error: productsError } = await supabase
        .from('stock_inventory')
        .select(`
          id,
          products (
            name,
            customer_price,
            customer_sale_price,
            net_weight_grams
          ),
          product_variants (
            product_categories (
              id,
              name
            )
          )
        `)
        .not('product_id', 'is', null)

      if (productsError) {
        console.error('Error fetching products:', productsError)
        setError('Error loading products')
        return
      }

      const { data: kgData, error: kgError } = await supabase
        .from('godown_kg_stock')
        .select('godown_id, category_id, quantity_kg')

      if (kgError) {
        // Table not created yet — show the flavours at 0 kg with a notice
        // rather than failing the whole page.
        console.error('Error fetching kg stock:', kgError)
        setNeedsMigration(true)
      } else {
        setNeedsMigration(false)
      }

      processStockData(productsData || [], warehousesData || [], kgError ? [] : kgData || [])
    } catch (err) {
      console.error('Error:', err)
      setError('Error loading stock data')
    } finally {
      setLoading(false)
    }
  }

  const processStockData = (productsData: any[], warehousesData: any[], kgData: any[]) => {
    const kgLookup = new Map<string, number>()
    kgData.forEach((row: any) => {
      kgLookup.set(`${row.category_id}-${row.godown_id}`, Number(row.quantity_kg) || 0)
    })

    setWarehouseNames(warehousesData.map((w: any) => w.name))

    // category name -> { id, best price per kg } — discovered entirely from
    // whatever finished products exist in stock_inventory, not a fixed list.
    const categories = new Map<string, { id: string; pricePerKg: number }>()
    productsData.forEach((item: any) => {
      const category = item.product_variants?.product_categories
      if (!category?.id) return
      const packPrice = Number(item.products?.customer_sale_price || item.products?.customer_price) || 0
      const netGrams = Number(item.products?.net_weight_grams) || 0
      const packKg = netGrams > 0 ? netGrams / 1000 : extractWeightKg(item.products?.name || '')
      const pricePerKg = packKg > 0 ? packPrice / packKg : 0
      const existing = categories.get(category.name)
      if (!existing || pricePerKg > existing.pricePerKg) {
        categories.set(category.name, { id: category.id, pricePerKg })
      }
    })

    const rows: FlavourStock[] = Array.from(categories.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryName, category]) => {
        const warehouses: FlavourStock['warehouses'] = {}
        let total_kg = 0
        warehousesData.forEach((warehouse: any) => {
          const kg = kgLookup.get(`${category.id}-${warehouse.id}`) || 0
          warehouses[warehouse.name] = { godown_id: warehouse.id, warehouse_name: warehouse.name, kg }
          total_kg += kg
        })

        return {
          category_id: category.id,
          category_name: categoryName,
          label: categoryName,
          price_per_kg: category.pricePerKg,
          warehouses,
          total_kg,
          total_amount: total_kg * category.pricePerKg,
        }
      })

    setFlavours(rows)
  }

  const categoryOptions = useMemo(
    () => flavours.map((f) => ({ id: f.category_id, name: f.label })),
    [flavours]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-72" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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

  // When a specific warehouse is selected (e.g. the factory's own godown),
  // every total below should reflect just that warehouse, not the grand
  // total across the factory + every distributor's godown combined.
  const isFactoryOnly = warehouseFilter !== 'all'
  const kgFor = (f: FlavourStock) =>
    isFactoryOnly ? (f.warehouses[warehouseFilter]?.kg || 0) : f.total_kg
  const amountFor = (f: FlavourStock) => kgFor(f) * f.price_per_kg

  const grandTotals = {
    totalKg: flavours.reduce((sum, f) => sum + kgFor(f), 0),
    totalAmount: flavours.reduce((sum, f) => sum + amountFor(f), 0),
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
              {isFactoryOnly
                ? `Showing only ${warehouseFilter}${isFactoryRole ? '' : ' — clear the warehouse filter below to see all warehouses'}`
                : `Stock in kg across ${selectedDistributorName ? `${selectedDistributorName}'s warehouses` : 'all warehouses'}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {companyGodownId && (
            <Button variant="outline" onClick={() => setAddProductionOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Production
            </Button>
          )}
          {!isFactoryRole && (
            <Link href="/dashboard/stock-transfers/new">
              <Button>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer Stock
              </Button>
            </Link>
          )}
        </div>
      </div>

      {needsMigration && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Kg stock isn&apos;t set up yet — run <code className="font-mono">migrations/create_godown_kg_stock.sql</code> in
            the Supabase SQL editor, then refresh this page.
          </span>
        </div>
      )}

      {/* Flavor-wise Stock Cards — one line on desktop */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {flavours.map((flavour, i) => {
          const style = CARD_STYLES[i % CARD_STYLES.length]
          const kg = kgFor(flavour)
          const amount = amountFor(flavour)
          return (
            <Card key={flavour.category_id} className={`${style.border} ${style.bg} gap-0 py-0`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-xs font-semibold ${style.text}`}>{flavour.label}</p>
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${style.iconBg}`}>
                    <Wheat className="h-3 w-3" />
                  </div>
                </div>
                <p className="text-lg font-bold tabular-nums">{formatKg(kg)}</p>
                <p className="text-xs font-semibold text-primary mt-1 pt-1 border-t">₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Warehouses</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {isFactoryRole ? 1 : warehouseNames.length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Warehouse className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {isFactoryRole ? 'Your warehouse' : 'Active warehouse locations'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Stock</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {formatKg(grandTotals.totalKg)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Package className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All {flavours.length} {flavours.length === 1 ? 'product' : 'products'}
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
            Stock value at sale price per kg
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
                  Kg per product across {selectedDistributorName ? `${selectedDistributorName}'s warehouse locations` : 'all warehouse locations'}
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
              {flavours.length} {flavours.length === 1 ? "product" : "products"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 min-w-0 max-w-full">
          <div className="w-0 min-w-full max-w-full overflow-hidden">
            <StockTableClient
              flavours={flavours}
              warehouseNames={isFactoryRole && companyGodownName ? [companyGodownName] : warehouseNames}
              onStockUpdate={fetchStockData}
              distributors={isFactoryRole ? undefined : distributors}
              selectedDistributor={selectedDistributor}
              onDistributorChange={handleDistributorChange}
              warehouseFilter={warehouseFilter}
              onWarehouseFilterChange={isFactoryRole ? () => {} : setWarehouseFilter}
              lockWarehouseFilter={isFactoryRole}
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
            <div className="font-semibold">Warehouse columns:</div>
            <div className="text-muted-foreground">Kg of that product in the warehouse — click ✏️ to change it</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-blue-600 font-medium">Total Kg:</div>
            <div className="text-muted-foreground">Kg across the warehouses shown</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-purple-600 font-medium">Total Amount:</div>
            <div className="text-muted-foreground">Total kg × sale price per kg</div>
          </div>
        </CardContent>
      </Card>

      {companyGodownId && (
        <AddProductionDialog
          open={addProductionOpen}
          onOpenChange={setAddProductionOpen}
          godownId={companyGodownId}
          godownName={companyGodownName || 'Factory'}
          categories={categoryOptions}
          onSuccess={fetchStockData}
        />
      )}
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
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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
