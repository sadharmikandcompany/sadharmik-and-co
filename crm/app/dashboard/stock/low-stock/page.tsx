"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, AlertTriangle, TrendingDown, Package } from "lucide-react"

type StockItem = {
  id: string
  category: string
  variant: string
  material: string
  quantity: number
  min_stock: number
  price: number
  updated_at: string
  stock_in_litres: number
}

export default function LowStockPage() {
  const router = useRouter()
  const [stockData, setStockData] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLowStockData()
  }, [])

  const convertToLiters = (variantName: string, quantity: number): number => {
    const variant = variantName.toLowerCase()

    // Extract numeric value and unit
    if (variant.includes('ml')) {
      const ml = parseFloat(variant.replace('ml', ''))
      return (ml / 1000) * quantity
    } else if (variant.includes('l') && !variant.includes('m') && !variant.includes('r')) {
      // Handle liter variants (1l, 5l, 15l, etc.)
      const liters = parseFloat(variant.replace('l', '').replace('pouch', '').trim())
      return liters * quantity
    } else if (variant.includes('m') || variant.includes('r')) {
      // Handle special variants like 15m, 15r, 5m
      const value = parseFloat(variant.replace('m', '').replace('r', ''))
      return value * quantity
    } else if (!isNaN(parseFloat(variant))) {
      // Handle numeric-only variants like "200", "500" - assume ml
      const ml = parseFloat(variant)
      return (ml / 1000) * quantity
    }

    return 0
  }

  const fetchLowStockData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("stock_inventory")
        .select(`
          id,
          quantity,
          min_stock,
          price,
          updated_at,
          product_variants!inner (
            variant_name,
            product_categories!inner (
              name
            )
          ),
          packaging_materials!inner (
            name
          )
        `)
        .order("quantity", { ascending: true })

      if (error) throw error

      // Transform and filter the data
      const transformedData: StockItem[] = (data || [])
        .map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          min_stock: item.min_stock,
          price: item.price || 0,
          updated_at: item.updated_at,
          category: item.product_variants.product_categories.name,
          variant: item.product_variants.variant_name,
          material: item.packaging_materials.name,
          stock_in_litres: convertToLiters(item.product_variants.variant_name, item.quantity),
        }))
        .filter((item) => item.quantity <= item.min_stock) // Only low stock and out of stock items

      setStockData(transformedData)
    } catch (error) {
      console.error("Error fetching low stock data:", error)
    } finally {
      setLoading(false)
    }
  }

  const outOfStockItems = stockData.filter((item) => item.quantity === 0)
  const lowStockItems = stockData.filter((item) => item.quantity > 0 && item.quantity <= item.min_stock)

  const totalLitresLow = lowStockItems.reduce((sum, item) => sum + item.stock_in_litres, 0)
  const totalValueLow = lowStockItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Low Stock Alerts</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Low Stock Alerts</h1>
          <p className="text-muted-foreground">
            Items that need immediate attention and restocking
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockItems.length}</div>
            <p className="text-xs text-muted-foreground">
              Items requiring immediate restocking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">
              Items below minimum threshold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alert Items</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stockData.length}</div>
            <p className="text-xs text-muted-foreground">
              Total items needing attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Out of Stock Section */}
      {outOfStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Out of Stock Items
            </CardTitle>
            <CardDescription>
              These items are completely out of stock and require immediate restocking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead className="text-right">Required</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outOfStockItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell>{item.variant}</TableCell>
                      <TableCell>{item.material}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{item.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.min_stock}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        +{item.min_stock}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.price > 0 ? `₹${item.price.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(item.updated_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Section */}
      {lowStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Low Stock Items
            </CardTitle>
            <CardDescription>
              These items are below minimum stock levels and should be restocked soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Stock (Litres)</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead className="text-right">Required</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell>{item.variant}</TableCell>
                      <TableCell>{item.material}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">
                          {item.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.stock_in_litres > 0 ? `${item.stock_in_litres.toFixed(2)}L` : '-'}
                      </TableCell>
                      <TableCell className="text-right">{item.min_stock}</TableCell>
                      <TableCell className="text-right font-semibold text-yellow-600">
                        +{item.min_stock - item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.price > 0 ? `₹${item.price.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(item.updated_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell colSpan={3} className="text-right">Totals:</TableCell>
                    <TableCell className="text-right">{lowStockItems.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                    <TableCell className="text-right">{totalLitresLow.toFixed(2)}L</TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right">₹{totalValueLow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {stockData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-green-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">All Stock Levels Look Good!</h3>
            <p className="text-muted-foreground text-center max-w-md">
              There are no items currently below minimum stock levels. All inventory is adequately stocked.
            </p>
            <Button
              onClick={() => router.push('/dashboard/stock')}
              className="mt-6"
            >
              View All Stock
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
