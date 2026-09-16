"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Warehouse, MapPin, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Godown {
  id: string
  name: string
  godown_code: string
  godown_type: string
  pincode: string
  serviceable_pincodes: string | null
  city: string
  state: string
  is_active: boolean
  is_primary: boolean
}

interface WarehouseStock {
  product_id: string
  available_quantity: number
}

interface WarehouseSelectorProps {
  shippingPincode: string
  selectedWarehouseId: string | null
  onWarehouseSelect: (warehouseId: string) => void
  selectedProducts?: Array<{ product_id: string; quantity: number }>
  paymentMethod?: string
  className?: string
  excludeWarehouseIds?: string[]
}

export function WarehouseSelector({
  shippingPincode,
  selectedWarehouseId,
  onWarehouseSelect,
  selectedProducts = [],
  paymentMethod,
  className,
  excludeWarehouseIds = [],
}: WarehouseSelectorProps) {
  const [open, setOpen] = useState(false)
  const [warehouses, setWarehouses] = useState<Godown[]>([])
  const [warehouseStock, setWarehouseStock] = useState<Record<string, WarehouseStock[]>>({})
  const [loading, setLoading] = useState(true)
  const [autoDetectedId, setAutoDetectedId] = useState<string | null>(null)
  const [cashWarehouseReason, setCashWarehouseReason] = useState<string | null>(null)

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId)

  // Fetch active warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      setLoading(true)
      try {
        const response = await fetch("/api/godowns?is_active=true")

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        // Ensure data is an array, filter out retailer warehouses and excluded IDs
        const warehousesArray = Array.isArray(data)
          ? data.filter((warehouse: Godown) =>
              !excludeWarehouseIds.includes(warehouse.id)
            )
          : []
        setWarehouses(warehousesArray)

        // Auto-detect warehouse based on pincode (skip for cash payments)
        // Cash payments will be handled after stock is fetched
        const isCashPayment = paymentMethod === "cash" || paymentMethod === "Cash"

        if (!isCashPayment && shippingPincode && shippingPincode.length === 6 && warehousesArray.length > 0) {
          const matched = warehousesArray.find((warehouse: Godown) => {
            if (!warehouse.serviceable_pincodes) return false

            // Handle both array and comma-separated string formats
            const pincodes = Array.isArray(warehouse.serviceable_pincodes)
              ? warehouse.serviceable_pincodes
              : warehouse.serviceable_pincodes.split(",").map((p) => p.trim())

            return pincodes.includes(shippingPincode)
          })

          if (matched) {
            setAutoDetectedId(matched.id)
            onWarehouseSelect(matched.id)
          } else {
            setAutoDetectedId(null)
          }
        }
      } catch (error) {
        console.error("Error fetching warehouses:", error)
        setWarehouses([]) // Set empty array on error
      } finally {
        setLoading(false)
      }
    }

    fetchWarehouses()
  }, [shippingPincode, paymentMethod, excludeWarehouseIds.join(",")])

  // Fetch warehouse stock for selected products
  useEffect(() => {
    const fetchWarehouseStock = async () => {
      if (selectedProducts.length === 0 || warehouses.length === 0) return

      try {
        const stockPromises = warehouses.map(async (warehouse) => {
          const productIds = selectedProducts.map((p) => p.product_id).join(",")
          const response = await fetch(
            `/api/godowns/${warehouse.id}/stock?product_ids=${productIds}`
          )

          if (!response.ok) {
            console.error(`Failed to fetch stock for warehouse ${warehouse.id}`)
            return { warehouseId: warehouse.id, stock: [] }
          }

          const data = await response.json()
          const stockArray = Array.isArray(data) ? data : []
          return { warehouseId: warehouse.id, stock: stockArray }
        })

        const stockResults = await Promise.all(stockPromises)
        const stockMap = stockResults.reduce((acc, { warehouseId, stock }) => {
          acc[warehouseId] = stock
          return acc
        }, {} as Record<string, WarehouseStock[]>)

        setWarehouseStock(stockMap)
      } catch (error) {
        console.error("Error fetching warehouse stock:", error)
        setWarehouseStock({}) // Set empty object on error
      }
    }

    fetchWarehouseStock()
  }, [selectedProducts, warehouses])

  // Handle warehouse selection based on payment method and pincode
  useEffect(() => {
    const isCashPayment = paymentMethod === "cash" || paymentMethod === "Cash"

    if (warehouses.length === 0) return

    // First, check pincode-based selection for all cases
    let pincodeMatchedWarehouse: Godown | undefined
    if (shippingPincode && shippingPincode.length === 6) {
      pincodeMatchedWarehouse = warehouses.find((warehouse) => {
        if (!warehouse.serviceable_pincodes) return false

        const pincodes = Array.isArray(warehouse.serviceable_pincodes)
          ? warehouse.serviceable_pincodes
          : warehouse.serviceable_pincodes.split(",").map((p) => p.trim())

        return pincodes.includes(shippingPincode)
      })
    }

    // Check if the pincode is serviced by Dadar warehouses (GDN002 or RAJ123)
    const primaryCashWarehouse = warehouses.find((w) => w.godown_code === "GDN002")
    const fallbackCashWarehouse = warehouses.find((w) => w.godown_code === "RAJ123")

    const isDadarPincode = pincodeMatchedWarehouse &&
      (pincodeMatchedWarehouse.godown_code === "GDN002" ||
       pincodeMatchedWarehouse.godown_code === "RAJ123")

    // Special cash payment logic ONLY for Dadar warehouse pincodes
    if (isCashPayment && isDadarPincode) {
      // If no products selected yet, default to primary warehouse
      if (selectedProducts.length === 0) {
        if (primaryCashWarehouse) {
          setAutoDetectedId(primaryCashWarehouse.id)
          onWarehouseSelect(primaryCashWarehouse.id)
          setCashWarehouseReason("Selected for cash payment (primary warehouse)")
        }
        return
      }

      // Wait for stock data to be loaded
      if (Object.keys(warehouseStock).length === 0) return

      // Check if all items are available in primary warehouse (GDN002)
      if (primaryCashWarehouse) {
        const primaryStock = warehouseStock[primaryCashWarehouse.id] || []
        const allAvailableInPrimary = selectedProducts.every((product) => {
          const stock = primaryStock.find((s) => s.product_id === product.product_id)
          return stock && stock.available_quantity >= product.quantity
        })

        if (allAvailableInPrimary) {
          setAutoDetectedId(primaryCashWarehouse.id)
          onWarehouseSelect(primaryCashWarehouse.id)
          setCashWarehouseReason("Selected for cash payment (primary warehouse)")
          return
        }
      }

      // Fallback to RAJ123 if items not available in GDN002
      if (fallbackCashWarehouse) {
        setAutoDetectedId(fallbackCashWarehouse.id)
        onWarehouseSelect(fallbackCashWarehouse.id)
        setCashWarehouseReason("Selected for cash payment (fallback - items not available in primary)")
        return
      }

      // If neither warehouse has the items, still select primary for cash
      if (primaryCashWarehouse) {
        setAutoDetectedId(primaryCashWarehouse.id)
        onWarehouseSelect(primaryCashWarehouse.id)
        setCashWarehouseReason("Selected for cash payment (primary warehouse)")
      }
    } else {
      // Normal pincode-based selection for non-Dadar pincodes OR non-cash payments
      setCashWarehouseReason(null)

      if (pincodeMatchedWarehouse) {
        setAutoDetectedId(pincodeMatchedWarehouse.id)
        onWarehouseSelect(pincodeMatchedWarehouse.id)
      } else {
        setAutoDetectedId(null)
      }
    }
  }, [paymentMethod, warehouses, selectedProducts, warehouseStock, shippingPincode])

  const getStockStatus = (warehouseId: string) => {
    if (selectedProducts.length === 0) return null

    const stock = warehouseStock[warehouseId] || []
    const allAvailable = selectedProducts.every((product) => {
      const warehouseStock = stock.find((s) => s.product_id === product.product_id)
      return warehouseStock && warehouseStock.available_quantity >= product.quantity
    })

    const someAvailable = selectedProducts.some((product) => {
      const warehouseStock = stock.find((s) => s.product_id === product.product_id)
      return warehouseStock && warehouseStock.available_quantity >= product.quantity
    })

    if (allAvailable) return { status: "sufficient", label: "Stock Available" }
    if (someAvailable) return { status: "partial", label: "Partial Stock" }
    return { status: "insufficient", label: "Insufficient Stock" }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Source Warehouse <span className="text-destructive">*</span>
        </label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedWarehouse ? (
                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  <span>{selectedWarehouse.name}</span>
                  {autoDetectedId === selectedWarehouse.id && (
                    <Badge variant="secondary" className="ml-2">
                      {cashWarehouseReason ? "Cash Payment" : "Auto-detected"}
                    </Badge>
                  )}
                </div>
              ) : (
                <span>Select warehouse...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search warehouse..." />
              <CommandList>
                <CommandEmpty>No warehouse found.</CommandEmpty>
                <CommandGroup>
                  {warehouses.map((warehouse) => {
                    const stockStatus = getStockStatus(warehouse.id)
                    const isAutoDetected = autoDetectedId === warehouse.id

                    return (
                      <CommandItem
                        key={warehouse.id}
                        value={warehouse.name}
                        onSelect={() => {
                          onWarehouseSelect(warehouse.id)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedWarehouseId === warehouse.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{warehouse.name}</span>
                            {isAutoDetected && (
                              <Badge variant="secondary" className="text-xs">
                                Recommended
                              </Badge>
                            )}
                            {warehouse.is_primary && (
                              <Badge variant="outline" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{warehouse.godown_code}</span>
                            <span>•</span>
                            <span>{warehouse.godown_type}</span>
                            {warehouse.pincode && (
                              <>
                                <span>•</span>
                                <MapPin className="h-3 w-3" />
                                <span>{warehouse.pincode}</span>
                              </>
                            )}
                          </div>
                          {stockStatus && (
                            <div className="flex items-center gap-1 text-xs mt-1">
                              <Package className="h-3 w-3" />
                              <span
                                className={cn(
                                  stockStatus.status === "sufficient" && "text-green-600",
                                  stockStatus.status === "partial" && "text-amber-600",
                                  stockStatus.status === "insufficient" && "text-destructive"
                                )}
                              >
                                {stockStatus.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedWarehouse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Warehouse Details</CardTitle>
            <CardDescription>Selected source warehouse information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Code:</span>{" "}
                <span className="font-medium">{selectedWarehouse.godown_code}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                <span className="font-medium capitalize">{selectedWarehouse.godown_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">City:</span>{" "}
                <span className="font-medium">{selectedWarehouse.city}</span>
              </div>
              <div>
                <span className="text-muted-foreground">State:</span>{" "}
                <span className="font-medium">{selectedWarehouse.state}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Pincode:</span>{" "}
                <span className="font-medium">{selectedWarehouse.pincode}</span>
              </div>
            </div>

            {selectedProducts.length > 0 && (
              <div className="pt-2 border-t">
                <h4 className="font-medium mb-2">Stock Availability</h4>
                <div className="space-y-1">
                  {selectedProducts.map((product) => {
                    const stock = warehouseStock[selectedWarehouse.id]?.find(
                      (s) => s.product_id === product.product_id
                    )
                    const available = stock?.available_quantity || 0
                    const isAvailable = available >= product.quantity

                    return (
                      <div
                        key={product.product_id}
                        className="flex justify-between text-xs"
                      >
                        <span className="text-muted-foreground">
                          Product {product.product_id.slice(0, 8)}
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            isAvailable ? "text-green-600" : "text-destructive"
                          )}
                        >
                          {available} / {product.quantity} required
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && shippingPincode && !autoDetectedId && (
        <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 p-3 rounded-md">
          No warehouse found servicing pincode {shippingPincode}. Please select manually.
        </div>
      )}
    </div>
  )
}
