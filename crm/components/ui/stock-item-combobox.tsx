"use client"

import * as React from "react"
import { Check, ChevronsUpDown, AlertTriangle, TrendingDown, TrendingUp, Droplets } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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

export type StockItem = {
  id: string
  category: string
  variant: string
  material: string
  quantity: number
  min_stock: number
  price: number
  is_loose_stock?: boolean
  quantity_liters?: number
}

interface StockItemComboboxProps {
  stockItems: StockItem[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function StockItemCombobox({
  stockItems,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Search stock items...",
}: StockItemComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Filter stock items based on search query
  const filteredStockItems = React.useMemo(() => {
    if (!searchQuery) return stockItems

    const query = searchQuery.toLowerCase()
    return stockItems.filter((item) => {
      const categoryMatch = item.category.toLowerCase().includes(query)
      const variantMatch = item.variant.toLowerCase().includes(query)
      const materialMatch = item.material.toLowerCase().includes(query)
      const looseMatch = item.is_loose_stock && "loose".includes(query)
      const bulkMatch = item.is_loose_stock && "bulk".includes(query)
      const combinedMatch = `${item.category} ${item.variant} ${item.material}`.toLowerCase().includes(query)

      return categoryMatch || variantMatch || materialMatch || combinedMatch || looseMatch || bulkMatch
    })
  }, [stockItems, searchQuery])

  // Separate regular and loose stock items
  const regularStockItems = filteredStockItems.filter(item => !item.is_loose_stock)
  const looseStockItems = filteredStockItems.filter(item => item.is_loose_stock)

  const selectedItem = stockItems.find((item) => item.id === value)

  // Get stock status based on quantity and min_stock
  const getStockStatus = (quantity: number, minStock: number): {
    status: string
    badge: "default" | "outline" | "destructive"
    icon: React.ComponentType<{ className?: string }>
    color: string
  } => {
    if (quantity === 0) {
      return { status: "Out of Stock", badge: "destructive", icon: TrendingDown, color: "text-red-600" }
    }
    if (quantity < minStock) {
      return { status: "Low Stock", badge: "outline", icon: AlertTriangle, color: "text-yellow-600" }
    }
    return { status: "In Stock", badge: "default", icon: TrendingUp, color: "text-green-600" }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedItem ? (
              <span className="flex items-center gap-2">
                {selectedItem.is_loose_stock && (
                  <Droplets className="h-4 w-4 text-orange-600 shrink-0" />
                )}
                <span>
                  {selectedItem.category} - {selectedItem.variant} - {selectedItem.material}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {selectedItem.is_loose_stock ? (
                      `(${selectedItem.quantity_liters?.toFixed(2)}L, ₹${selectedItem.price}/L)`
                    ) : (
                      `(Stock: ${selectedItem.quantity}, Price: ₹${selectedItem.price})`
                    )}
                  </span>
                </span>
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[700px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by category, variant, or material..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No stock item found.</CommandEmpty>

            {/* Loose Stock Items */}
            {looseStockItems.length > 0 && (
              <CommandGroup heading="Loose Stock (Bulk)">
                {looseStockItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue)
                      setOpen(false)
                      setSearchQuery("")
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-orange-600 shrink-0" />
                        <span className="font-medium">
                          {item.category} - {item.variant}
                        </span>
                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                          Loose Stock
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 font-medium text-orange-600">
                          <Droplets className="h-3 w-3" />
                          {item.quantity_liters?.toFixed(2)}L available
                        </span>
                        <span className="text-muted-foreground">
                          Price: ₹{item.price.toFixed(2)}/L
                        </span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Regular Stock Items */}
            {regularStockItems.length > 0 && (
              <CommandGroup heading="Packaged Stock">
                {regularStockItems.map((item) => {
                  const stockStatus = getStockStatus(item.quantity, item.min_stock)
                  const StatusIcon = stockStatus.icon

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={(currentValue) => {
                        onValueChange(currentValue)
                        setOpen(false)
                        setSearchQuery("")
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {item.category} - {item.variant} - {item.material}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={cn("flex items-center gap-1 font-medium", stockStatus.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {item.quantity} units
                          </span>
                          <span className="text-muted-foreground">
                            Min: {item.min_stock}
                          </span>
                          <span className="text-muted-foreground">
                            Price: ₹{item.price.toFixed(2)}
                          </span>
                          <Badge variant={stockStatus.badge} className="text-xs">
                            {stockStatus.status}
                          </Badge>
                        </div>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
