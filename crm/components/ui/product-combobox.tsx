"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Package, Loader2 } from "lucide-react"
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
import { supabase } from "@/lib/supabase"
import { useDebounce } from "@/hooks/use-debounce"

export type Product = {
  id: string
  name: string
  hsn_code: string | null
  gst_percentage: number | null
  customer_price: number | null
  brand: string | null
  stock: number | null
}

interface ProductComboboxProps {
  value: string
  onValueChange: (value: string, product: Product | null) => void
  disabled?: boolean
  placeholder?: string
}

export function ProductCombobox({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Search products...",
}: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  // Fetch initial selected product if value is provided
  React.useEffect(() => {
    if (value && !selectedProduct) {
      fetchSelectedProduct(value)
    }
  }, [value])

  const fetchSelectedProduct = async (productId: string) => {
    const { data } = await supabase
      .from("products")
      .select("id, name, hsn_code, gst_percentage, customer_price, brand, stock")
      .eq("id", productId)
      .single()

    if (data) {
      setSelectedProduct(data)
    }
  }

  // Search products when query changes
  React.useEffect(() => {
    if (open) {
      searchProducts(debouncedSearch)
    }
  }, [debouncedSearch, open])

  const searchProducts = async (query: string) => {
    setLoading(true)
    try {
      let queryBuilder = supabase
        .from("products")
        .select("id, name, hsn_code, gst_percentage, customer_price, brand, stock")
        .eq("is_active", true)

      if (query) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query}%,hsn_code.ilike.%${query}%,brand.ilike.%${query}%`)
      }

      const { data } = await queryBuilder.order("name").limit(30)

      setProducts(data || [])
    } catch (error) {
      console.error("Error searching products:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (product: Product) => {
    setSelectedProduct(product)
    onValueChange(product.id, product)
    setOpen(false)
    setSearchQuery("")
  }

  const handleClear = () => {
    setSelectedProduct(null)
    onValueChange("", null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 px-3"
          disabled={disabled}
        >
          <span className="truncate text-left">
            {selectedProduct ? (
              selectedProduct.name
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, HSN, brand..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : (
              <>
                {products.length === 0 && (
                  <CommandEmpty>No products found.</CommandEmpty>
                )}

                {products.length > 0 && (
                  <CommandGroup heading={`Products (${products.length})`}>
                    {products.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        onSelect={() => handleSelect(product)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <Package className="mr-2 h-4 w-4 text-orange-500" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{product.name}</span>
                            {product.brand && (
                              <span className="text-xs text-muted-foreground">
                                ({product.brand})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {product.hsn_code && (
                              <span>HSN: {product.hsn_code}</span>
                            )}
                            {product.gst_percentage !== null && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {product.gst_percentage}% GST
                              </Badge>
                            )}
                            {product.customer_price !== null && (
                              <span className="text-green-600 font-medium">
                                ₹{product.customer_price.toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
