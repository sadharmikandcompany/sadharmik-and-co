"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Package, Droplets, AlertCircle, CheckCircle2 } from "lucide-react"

type ProductCategory = {
  id: string
  name: string
}

type ProductVariant = {
  id: string
  variant_name: string
  category_id: string
}

type MaterialRequirement = {
  id: string
  material_id: string
  material_name: string
  material_type: string
  quantity_per_unit: number
  liters_consumed_per_unit: number
  is_required: boolean
  available_quantity: number
}

type LooseStock = {
  id: string
  category_id: string
  quantity_liters: number
  price_per_liter: number
}

type Product = {
  id: string
  name: string
  stock: number
}

type TransferResult = {
  variantName: string
  categoryName: string
  quantity: number
  litersConsumed: number
  materialsUsed: { name: string; quantity: number }[]
  previousLooseStock: number
  newLooseStock: number
  timestamp: string
  batchNo: string
  mfgDate: string
  expiryDate: string
}

const MAIN_STOCK_CATEGORIES = [
  "Buffalo Ghee",
  "Cow Ghee",
  "Valona Ghee",
  "Groundnut Oil"
]

export default function StockTransferPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="text-muted-foreground">Loading...</div></div>}>
      <StockTransferPage />
    </Suspense>
  )
}

function StockTransferPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirement[]>([])
  const [looseStock, setLooseStock] = useState<LooseStock | null>(null)
  const [lastTransferResult, setLastTransferResult] = useState<TransferResult | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [mappedProduct, setMappedProduct] = useState<Product | null>(null)
  const [selectedProductId, setSelectedProductId] = useState("")
  const [isUpdatingMapping, setIsUpdatingMapping] = useState(false)

  // Form state
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedVariant, setSelectedVariant] = useState("")
  const [transferQuantity, setTransferQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [packageType, setPackageType] = useState<"sticker" | "plain">("sticker")
  const [batchNo, setBatchNo] = useState("")
  const [purchasedBatches, setPurchasedBatches] = useState<string[]>([])
  const [mfgDate, setMfgDate] = useState(() => new Date().toISOString().split("T")[0])
  const [expiryDate, setExpiryDate] = useState("")

  // Track which optional materials are excluded from the transfer
  const [excludedMaterials, setExcludedMaterials] = useState<Set<string>>(new Set())

  // Packaging configuration based on variant type
  const PACKAGING_CONFIG: { [key: string]: { unitsPerCarton: number; cartonsPerBag: number } } = {
    "pouch": { unitsPerCarton: 8, cartonsPerBag: 3 },
    "500ml": { unitsPerCarton: 12, cartonsPerBag: 3 },
    "500 ml": { unitsPerCarton: 12, cartonsPerBag: 3 },
    "1l": { unitsPerCarton: 6, cartonsPerBag: 3 },
    "1 l": { unitsPerCarton: 6, cartonsPerBag: 3 },
    "1ltr": { unitsPerCarton: 6, cartonsPerBag: 3 },
    "1 ltr": { unitsPerCarton: 6, cartonsPerBag: 3 },
    "5l": { unitsPerCarton: 2, cartonsPerBag: 2 },
    "5 l": { unitsPerCarton: 2, cartonsPerBag: 2 },
    "5ltr": { unitsPerCarton: 2, cartonsPerBag: 2 },
    "5 ltr": { unitsPerCarton: 2, cartonsPerBag: 2 },
    "15l": { unitsPerCarton: 1, cartonsPerBag: 1 },
    "15 l": { unitsPerCarton: 1, cartonsPerBag: 1 },
    "15ltr": { unitsPerCarton: 1, cartonsPerBag: 1 },
    "15 ltr": { unitsPerCarton: 1, cartonsPerBag: 1 },
  }

  // Get packaging config for current variant
  const getPackagingConfig = (variantName: string) => {
    const lowerName = variantName.toLowerCase()
    for (const [key, config] of Object.entries(PACKAGING_CONFIG)) {
      if (lowerName.includes(key)) {
        return config
      }
    }
    // Default for unknown variants
    return { unitsPerCarton: 1, cartonsPerBag: 1 }
  }

  // URL params for auto-fill
  const paramCategoryId = searchParams.get("categoryId")
  const paramVariantId = searchParams.get("variantId")

  useEffect(() => {
    fetchCategories()
  }, [])

  // Auto-fill category from URL params after categories load
  useEffect(() => {
    if (paramCategoryId && categories.length > 0 && !selectedCategory) {
      const match = categories.find(c => c.id === paramCategoryId)
      if (match) {
        setSelectedCategory(paramCategoryId)
      }
    }
  }, [paramCategoryId, categories])

  // Auto-fill variant from URL params after variants load
  useEffect(() => {
    if (paramVariantId && variants.length > 0 && !selectedVariant) {
      const match = variants.find(v => v.id === paramVariantId)
      if (match) {
        setSelectedVariant(paramVariantId)
      }
    }
  }, [paramVariantId, variants])

  useEffect(() => {
    if (selectedCategory) {
      fetchVariants()
      fetchLooseStock()
      fetchProducts()
    }
  }, [selectedCategory])

  useEffect(() => {
    if (selectedVariant) {
      fetchMaterialRequirements()
      fetchMappedProduct()
    }
  }, [selectedVariant])

  // Handle package type change - auto exclude sticker and bottle bag for "plain"
  useEffect(() => {
    if (packageType === "plain" && materialRequirements.length > 0) {
      const toExclude = new Set(excludedMaterials)
      materialRequirements.forEach(req => {
        const lowerName = req.material_name.toLowerCase()
        if (lowerName.includes('sticker') || lowerName.includes('bottle bag')) {
          toExclude.add(req.material_id)
        }
      })
      setExcludedMaterials(toExclude)
    } else if (packageType === "sticker" && materialRequirements.length > 0) {
      // Remove sticker from excluded when switching to sticker mode
      const toExclude = new Set(excludedMaterials)
      materialRequirements.forEach(req => {
        const lowerName = req.material_name.toLowerCase()
        if (lowerName.includes('sticker')) {
          toExclude.delete(req.material_id)
        }
        // Keep bottle bag excluded unless user manually includes it
      })
      setExcludedMaterials(toExclude)
    }
  }, [packageType, materialRequirements.length])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .in("name", MAIN_STOCK_CATEGORIES)
        .order("name")

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast.error("Failed to load categories")
    }
  }

  const fetchVariants = async () => {
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("category_id", selectedCategory)
        .order("variant_name")

      if (error) throw error
      setVariants(data || [])

      // Reset variant selection when category changes
      setSelectedVariant("")
      setMaterialRequirements([])
      // Reset batch selection when category changes
      setBatchNo("")
      setPurchasedBatches([])
    } catch (error) {
      console.error("Error fetching variants:", error)
      toast.error("Failed to load variants")
    }
  }

  const fetchLooseStock = async () => {
    try {
      const { data, error } = await supabase
        .from("loose_stock")
        .select("*")
        .eq("category_id", selectedCategory)
        .single()

      if (error && error.code !== "PGRST116") throw error
      setLooseStock(data || null)

      if (data?.id) {
        fetchPurchasedBatches(data.id)
      } else {
        setPurchasedBatches([])
      }
    } catch (error) {
      console.error("Error fetching loose stock:", error)
      toast.error("Failed to load loose stock information")
    }
  }

  const fetchPurchasedBatches = async (looseStockId: string) => {
    try {
      const { data, error } = await supabase
        .from("loose_stock_transactions")
        .select("batch_number, created_at")
        .eq("loose_stock_id", looseStockId)
        .eq("transaction_type", "purchase")
        .not("batch_number", "is", null)
        .neq("batch_number", "")
        .order("created_at", { ascending: false })

      if (error) throw error
      setPurchasedBatches(
        Array.from(new Set((data || []).map((r) => r.batch_number).filter(Boolean)))
      )
    } catch (error) {
      console.error("Error fetching purchased batches:", error)
      setPurchasedBatches([])
    }
  }

  const fetchProducts = async () => {
    try {
      // Get the category name to filter products by name matching
      const categoryName = getCategoryName(selectedCategory)

      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock")
        .eq("is_active", true)
        .ilike("name", `%${categoryName}%`)
        .order("name")

      if (error) throw error
      setProducts(data || [])

      // If no products found with name filter, show all active products
      if (!data || data.length === 0) {
        const { data: allData, error: allError } = await supabase
          .from("products")
          .select("id, name, stock")
          .eq("is_active", true)
          .order("name")

        if (allError) throw allError
        setProducts(allData || [])
      }
    } catch (error) {
      console.error("Error fetching products:", error)
      toast.error("Failed to load products")
    }
  }

  const fetchMappedProduct = async () => {
    try {
      const { data: variantData, error: variantError } = await supabase
        .from("product_variants")
        .select("product_id")
        .eq("id", selectedVariant)
        .single()

      if (variantError) throw variantError

      if (variantData?.product_id) {
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("id, name, stock")
          .eq("id", variantData.product_id)
          .single()

        if (productError) throw productError
        setMappedProduct(productData)
        setSelectedProductId(productData.id)
      } else {
        setMappedProduct(null)
        setSelectedProductId("")
      }
    } catch (error) {
      console.error("Error fetching mapped product:", error)
      setMappedProduct(null)
      setSelectedProductId("")
    }
  }

  const updateProductMapping = async () => {
    if (!selectedProductId || !selectedVariant) {
      toast.error("Please select a product")
      return
    }

    setIsUpdatingMapping(true)
    try {
      const { error } = await supabase
        .from("product_variants")
        .update({ product_id: selectedProductId })
        .eq("id", selectedVariant)

      if (error) throw error

      toast.success("Product mapping updated successfully")
      fetchMappedProduct()
    } catch (error) {
      console.error("Error updating product mapping:", error)
      toast.error("Failed to update product mapping")
    } finally {
      setIsUpdatingMapping(false)
    }
  }

  const fetchMaterialRequirements = async () => {
    try {
      // Fetch variant with product_id
      const { data: variantData, error: variantError } = await supabase
        .from("product_variants")
        .select("product_id")
        .eq("id", selectedVariant)
        .single()

      if (variantError) throw variantError

      if (!variantData?.product_id) {
        toast.error("This variant is not linked to a product. Please configure product mapping first.")
        setMaterialRequirements([])
        return
      }

      // Fetch material mappings for the selected variant
      const { data: mappings, error: mappingError } = await supabase
        .from("variant_material_mapping")
        .select(`
          *,
          packaging_materials!inner (
            id,
            name,
            material_type
          )
        `)
        .eq("variant_id", selectedVariant)
        .order("display_order")

      if (mappingError) throw mappingError

      if (!mappings || mappings.length === 0) {
        toast.error("No material requirements found for this variant. Please configure them first.")
        setMaterialRequirements([])
        return
      }

      // Fetch current stock levels for each material
      const materialIds = mappings.map((m: any) => m.material_id)

      // Identify sticker materials (variant-specific, not shared)
      const stickerMaterialIds = mappings
        .filter((m: any) => m.packaging_materials.name.toLowerCase().includes('sticker'))
        .map((m: any) => m.material_id)
      const sharedMaterialIds = materialIds.filter((id: string) => !stickerMaterialIds.includes(id))

      // Fetch stock for shared materials for the selected variant only
      const { data: sharedStockData, error: sharedStockError } = await supabase
        .from("stock_inventory")
        .select("material_id, quantity")
        .eq("variant_id", selectedVariant)
        .in("material_id", sharedMaterialIds)
        .not("material_id", "is", null)

      if (sharedStockError) throw sharedStockError

      // Map quantity per material for the selected variant
      const materialTotals = new Map<string, number>()
      sharedStockData?.forEach((s: any) => {
        const current = materialTotals.get(s.material_id) || 0
        materialTotals.set(s.material_id, current + (s.quantity || 0))
      })

      // Fetch stock for stickers only for the selected variant
      if (stickerMaterialIds.length > 0) {
        const { data: stickerStockData, error: stickerStockError } = await supabase
          .from("stock_inventory")
          .select("material_id, quantity")
          .eq("variant_id", selectedVariant)
          .in("material_id", stickerMaterialIds)

        if (stickerStockError) throw stickerStockError

        stickerStockData?.forEach((s: any) => {
          materialTotals.set(s.material_id, s.quantity || 0)
        })
      }

      // Combine mappings with stock data
      const requirements: MaterialRequirement[] = mappings.map((mapping: any) => {
        return {
          id: mapping.id,
          material_id: mapping.material_id,
          material_name: mapping.packaging_materials.name,
          material_type: mapping.packaging_materials.material_type,
          quantity_per_unit: mapping.quantity_per_unit,
          liters_consumed_per_unit: mapping.liters_consumed_per_unit,
          is_required: mapping.is_required,
          available_quantity: materialTotals.get(mapping.material_id) || 0,
        }
      })

      setMaterialRequirements(requirements)

      // Auto-exclude "bag" materials by default (bags are always optional)
      const autoExcluded = new Set<string>()
      requirements.forEach(req => {
        if (req.material_name.toLowerCase().includes('bag')) {
          autoExcluded.add(req.material_id)
        }
      })
      setExcludedMaterials(autoExcluded)
    } catch (error) {
      console.error("Error fetching material requirements:", error)
      toast.error("Failed to load material requirements")
    }
  }

  const toggleMaterial = (materialId: string) => {
    setExcludedMaterials(prev => {
      const next = new Set(prev)
      if (next.has(materialId)) {
        next.delete(materialId)
      } else {
        next.add(materialId)
      }
      return next
    })
  }

  const calculateRequirements = () => {
    const quantity = Number(transferQuantity) || 0
    if (quantity <= 0) return null

    // Only include materials that are not excluded
    const activeMaterials = materialRequirements.filter(req => !excludedMaterials.has(req.material_id))

    const totalLitersNeeded = activeMaterials.reduce((sum, req) => {
      return sum + (req.liters_consumed_per_unit * quantity)
    }, 0)

    const materialNeeds = materialRequirements.map(req => {
      const lowerName = req.material_name.toLowerCase()
      const isBag = lowerName.includes('bag') && !lowerName.includes('bottle bag')
      const isBottleBag = lowerName.includes('bottle bag')
      const isSticker = lowerName.includes('sticker')
      const isExcluded = excludedMaterials.has(req.material_id)

      // In plain mode, sticker and bottle bag are always excluded
      const isPlainExcluded = packageType === "plain" && (isSticker || isBottleBag)
      const effectivelyExcluded = isExcluded || isPlainExcluded

      return {
        ...req,
        isBag,
        isBottleBag,
        isSticker,
        excluded: effectivelyExcluded,
        needed: effectivelyExcluded ? 0 : req.quantity_per_unit * quantity,
        // Content materials (ghee, oil) are tracked in loose_stock, not stock_inventory
        // Only check availability for packaging materials
        sufficient: req.material_type === 'content' || effectivelyExcluded ? true : req.available_quantity >= (req.quantity_per_unit * quantity),
      }
    })

    const looseStockSufficient = looseStock ? looseStock.quantity_liters >= totalLitersNeeded : false

    // Only validate active packaging materials (not excluded, not content)
    // Bags, bottle bags, and stickers are always optional — never block the transfer
    const activePackagingMaterials = materialNeeds.filter(m => m.material_type === 'packaging' && !m.excluded)

    return {
      totalLitersNeeded,
      materialNeeds,
      looseStockSufficient,
      allMaterialsSufficient: activePackagingMaterials.every(m => m.sufficient || !m.is_required || m.isBag || m.isBottleBag || m.isSticker),
      canProceed: looseStockSufficient && activePackagingMaterials.every(m => m.sufficient || !m.is_required || m.isBag || m.isBottleBag || m.isSticker),
    }
  }

  const requirements = calculateRequirements()

  const handleTransfer = async () => {
    if (!selectedCategory || !selectedVariant || !transferQuantity) {
      toast.error("Please fill in all required fields")
      return
    }

    if (!mappedProduct) {
      toast.error("Please map this variant to a product before transferring")
      return
    }

    if (!batchNo.trim()) {
      toast.error("Please enter a batch number")
      return
    }

    if (!mfgDate) {
      toast.error("Please enter a manufacturing date")
      return
    }

    const quantity = Number(transferQuantity)
    if (quantity <= 0) {
      toast.error("Please enter a valid quantity")
      return
    }

    if (!requirements || !requirements.canProceed) {
      toast.error("Insufficient materials or loose stock to complete this transfer")
      return
    }

    if (!looseStock) {
      toast.error("Loose stock not found for this category")
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Reduce loose stock
      const newLooseQuantity = looseStock.quantity_liters - requirements.totalLitersNeeded
      const { error: looseUpdateError } = await supabase
        .from("loose_stock")
        .update({
          quantity_liters: newLooseQuantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", looseStock.id)

      if (looseUpdateError) throw looseUpdateError

      // 2. Create loose stock transaction
      const { error: looseTransactionError } = await supabase
        .from("loose_stock_transactions")
        .insert([{
          loose_stock_id: looseStock.id,
          transaction_type: "transfer",
          quantity_liters: requirements.totalLitersNeeded,
          batch_number: batchNo.trim(),
          transaction_notes: notes || `Transferred to ${quantity} unit(s) of packaged product`,
          user_id: user?.id,
          user_email: user?.email,
        }])

      if (looseTransactionError) throw looseTransactionError

      // 3. Reduce packaging materials (skip content and excluded materials)
      for (const material of requirements.materialNeeds) {
        // Skip content materials (ghee, oil) - they're consumed from loose_stock, not stock_inventory
        if (material.material_type === 'content') continue
        // Skip excluded optional materials (e.g. bag)
        if (material.excluded) continue

        if (material.needed > 0) {
          const newMaterialQuantity = material.available_quantity - material.needed

          // Check if stock inventory entry exists
          const { data: existingStock, error: fetchError } = await supabase
            .from("stock_inventory")
            .select("id, quantity")
            .eq("variant_id", selectedVariant)
            .eq("material_id", material.material_id)
            .maybeSingle()

          if (fetchError) throw fetchError

          if (existingStock) {
            // Update existing stock
            const { error: materialUpdateError } = await supabase
              .from("stock_inventory")
              .update({
                quantity: newMaterialQuantity,
                updated_at: new Date().toISOString()
              })
              .eq("id", existingStock.id)

            if (materialUpdateError) throw materialUpdateError

            // Create stock comment for packaging material
            const { error: commentError } = await supabase
              .from("stock_comments")
              .insert([{
                stock_inventory_id: existingStock.id,
                previous_quantity: existingStock.quantity,
                new_quantity: newMaterialQuantity,
                quantity_change: -(material.needed),
                comment: `Used ${material.needed} ${material.material_name} for transfer of ${quantity} units`,
                user_id: user?.id,
                user_email: user?.email,
              }])

            if (commentError) throw commentError
          }
        }
      }

      // 4. Find or create final packaged product stock
      // Fetch the product_id linked to this variant
      const { data: variantData, error: variantFetchError } = await supabase
        .from("product_variants")
        .select("product_id")
        .eq("id", selectedVariant)
        .single()

      if (variantFetchError) throw variantFetchError

      const productId = variantData?.product_id

      if (productId) {
        const { data: finalStock, error: finalFetchError } = await supabase
          .from("stock_inventory")
          .select("id, quantity")
          .eq("variant_id", selectedVariant)
          .eq("product_id", productId)
          .maybeSingle()

        if (finalFetchError) throw finalFetchError

        let finalStockId = finalStock?.id

        if (finalStock) {
          // Update existing final product stock
          const { error: finalUpdateError } = await supabase
            .from("stock_inventory")
            .update({
              quantity: finalStock.quantity + quantity,
              updated_at: new Date().toISOString()
            })
            .eq("id", finalStock.id)

          if (finalUpdateError) throw finalUpdateError
        } else {
          // Create new final product stock entry
          const { data: newStock, error: finalInsertError } = await supabase
            .from("stock_inventory")
            .insert([{
              variant_id: selectedVariant,
              product_id: productId,
              quantity: quantity,
              min_stock: 0,
              price: looseStock.price_per_liter, // Use loose stock price as base
            }])
            .select("id")
            .single()

          if (finalInsertError) throw finalInsertError
          finalStockId = newStock?.id
        }

        // Create stock comment for final product
        if (finalStockId) {
          const { error: finalCommentError } = await supabase
            .from("stock_comments")
            .insert([{
              stock_inventory_id: finalStockId,
              previous_quantity: finalStock?.quantity || 0,
              new_quantity: (finalStock?.quantity || 0) + quantity,
              quantity_change: quantity,
              comment: `Transferred ${quantity} units from loose stock. Used ${requirements.totalLitersNeeded.toFixed(2)}L of loose stock. ${notes || ''}`,
              user_id: user?.id,
              user_email: user?.email,
            }])

          if (finalCommentError) throw finalCommentError
        }

        // 5. Update products table stock
        const { error: productStockError } = await supabase
          .from("products")
          .update({
            stock: (mappedProduct.stock || 0) + quantity,
            updated_at: new Date().toISOString()
          })
          .eq("id", productId)

        if (productStockError) throw productStockError

        // 5b. Insert stock_batches record for this packaged batch
        const ratePerUnit = quantity > 0
          ? (requirements.totalLitersNeeded * looseStock.price_per_liter) / quantity
          : 0
        const { error: batchInsertError } = await supabase
          .from("stock_batches")
          .insert([{
            product_id: productId,
            variant_id: selectedVariant,
            batch_no: batchNo.trim(),
            mfg_date: mfgDate,
            expiry_date: expiryDate || null,
            qty: quantity,
            rate: ratePerUnit,
            status: "active",
          }])

        if (batchInsertError) throw batchInsertError

        // 6. Update factory_warehouse_stock
        if (finalStockId) {
          const { data: existingFactoryStock, error: factoryFetchError } = await supabase
            .from("factory_warehouse_stock")
            .select("id, quantity")
            .eq("stock_inventory_id", finalStockId)
            .maybeSingle()

          if (factoryFetchError) throw factoryFetchError

          if (existingFactoryStock) {
            // Update existing factory warehouse stock
            const { error: factoryUpdateError } = await supabase
              .from("factory_warehouse_stock")
              .update({ quantity: existingFactoryStock.quantity + quantity })
              .eq("id", existingFactoryStock.id)

            if (factoryUpdateError) throw factoryUpdateError
          } else {
            // Create new factory warehouse stock entry
            const { error: factoryInsertError } = await supabase
              .from("factory_warehouse_stock")
              .insert([{
                stock_inventory_id: finalStockId,
                product_id: productId,
                quantity: quantity,
                min_stock_level: 0,
              }])

            if (factoryInsertError) throw factoryInsertError
          }
        }
      }

      toast.success(`Successfully transferred ${quantity} units to packaged stock`)

      // Store transfer result for display (only packaging materials, not content)
      const variantName = variants.find(v => v.id === selectedVariant)?.variant_name || ""
      const categoryName = getCategoryName(selectedCategory)
      setLastTransferResult({
        variantName,
        categoryName,
        quantity,
        litersConsumed: requirements.totalLitersNeeded,
        materialsUsed: requirements.materialNeeds
          .filter(m => m.material_type === 'packaging' && !m.excluded)
          .map(m => ({
            name: m.material_name,
            quantity: m.needed
          })),
        previousLooseStock: looseStock.quantity_liters,
        newLooseStock: newLooseQuantity,
        timestamp: new Date().toISOString(),
        batchNo: batchNo.trim(),
        mfgDate,
        expiryDate,
      })

      // Reset form
      setSelectedVariant("")
      setTransferQuantity("")
      setNotes("")
      setMaterialRequirements([])
      setMappedProduct(null)
      setPackageType("sticker")
      setBatchNo("")
      setMfgDate(new Date().toISOString().split("T")[0])
      setExpiryDate("")

      // Refresh data
      fetchLooseStock()
    } catch (error) {
      console.error("Error during transfer:", error)
      toast.error("Failed to complete transfer")
    } finally {
      setLoading(false)
    }
  }

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || ""
  }

  const generateBatchNo = () => {
    const categoryName = getCategoryName(selectedCategory)
    const prefix = categoryName
      ? categoryName.split(" ").map(w => w[0]).join("").toUpperCase()
      : "BATCH"
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`
    setBatchNo(`${prefix}-${stamp}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Transfer Loose Stock to Packages</h1>
          <p className="text-muted-foreground">
            Convert bulk/loose stock into packaged products
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Details</CardTitle>
              <CardDescription>
                Select the product and quantity to package
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Selection */}
              <div className="space-y-2">
                <Label htmlFor="category">Product Category *</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Loose Stock Info */}
              {selectedCategory && looseStock && (
                <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                  <Droplets className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 dark:text-orange-200">
                    <strong>Available Loose Stock:</strong> {looseStock.quantity_liters.toFixed(2)}L
                    <br />
                    <span className="text-sm">Price: ₹{looseStock.price_per_liter.toFixed(2)}/L</span>
                  </AlertDescription>
                </Alert>
              )}

              {selectedCategory && !looseStock && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No loose stock available for {getCategoryName(selectedCategory)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Variant Selection */}
              <div className="space-y-2">
                <Label htmlFor="variant">Product Variant *</Label>
                <Select
                  value={selectedVariant}
                  onValueChange={setSelectedVariant}
                  disabled={!selectedCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.variant_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Mapping */}
              {selectedVariant && mappedProduct && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                  <Package className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <strong>Mapped Product:</strong> {mappedProduct.name}
                    <br />
                    <span className="text-sm">Current Stock: {mappedProduct.stock} units</span>
                  </AlertDescription>
                </Alert>
              )}

              {selectedVariant && !mappedProduct && (
                <div className="space-y-3 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                        No Product Mapped
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        Please select which product this variant creates
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product">Select Product *</Label>
                    <Select
                      value={selectedProductId}
                      onValueChange={setSelectedProductId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} (Stock: {product.stock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    size="sm"
                    onClick={updateProductMapping}
                    disabled={!selectedProductId || isUpdatingMapping}
                    className="w-full"
                  >
                    {isUpdatingMapping ? "Saving..." : "Save Product Mapping"}
                  </Button>
                </div>
              )}

              {/* Package Type Selection */}
              {selectedVariant && materialRequirements.length > 0 && (
                <div className="space-y-2">
                  <Label>Package Type *</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={packageType === "sticker" ? "default" : "outline"}
                      className={`flex-1 ${packageType === "sticker" ? "bg-primary" : ""}`}
                      onClick={() => setPackageType("sticker")}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Sticker
                    </Button>
                    <Button
                      type="button"
                      variant={packageType === "plain" ? "default" : "outline"}
                      className={`flex-1 ${packageType === "plain" ? "bg-orange-600 hover:bg-orange-700" : ""}`}
                      onClick={() => setPackageType("plain")}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Plain
                    </Button>
                  </div>
                  {packageType === "plain" && (
                    <p className="text-xs text-orange-600">
                      Sticker और Bottle Bag use नहीं होंगे
                    </p>
                  )}
                </div>
              )}

              {/* Quantity Input */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity to Package (units) *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  disabled={!selectedVariant || materialRequirements.length === 0}
                />
                {materialRequirements.length === 0 && selectedVariant && (
                  <p className="text-sm text-destructive">
                    No material mappings found. Please configure material requirements first.
                  </p>
                )}
              </div>

              {/* Packaging Info Display */}
              {selectedVariant && transferQuantity && Number(transferQuantity) > 0 && (
                <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Packaging Calculation
                  </h4>
                  {(() => {
                    const variantName = variants.find(v => v.id === selectedVariant)?.variant_name || ""
                    const config = getPackagingConfig(variantName)
                    const qty = Number(transferQuantity)
                    const cartonsNeeded = Math.floor(qty / config.unitsPerCarton)
                    const bagsNeeded = Math.floor(cartonsNeeded / config.cartonsPerBag)
                    const remainingUnits = qty - (cartonsNeeded * config.unitsPerCarton)
                    const remainingCartons = cartonsNeeded - (bagsNeeded * config.cartonsPerBag)

                    return (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Units per Carton:</span>
                          <span className="font-medium">{config.unitsPerCarton}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cartons per Bag:</span>
                          <span className="font-medium">{config.cartonsPerBag}</span>
                        </div>
                        <div className="border-t pt-1 mt-1"></div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cartons Needed:</span>
                          <span className="font-semibold text-blue-600">{cartonsNeeded}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bags Needed:</span>
                          <span className="font-semibold text-green-600">{bagsNeeded}</span>
                        </div>
                        {remainingUnits > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-orange-600">Loose units (not filling a carton):</span>
                            <span className="text-orange-600">{remainingUnits}</span>
                          </div>
                        )}
                        {remainingCartons > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-orange-600">Loose cartons (not filling a bag):</span>
                            <span className="text-orange-600">{remainingCartons} cartons</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Batch Details */}
              {selectedVariant && materialRequirements.length > 0 && (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Batch Details
                  </h4>
                  <div className="space-y-2">
                    <Label htmlFor="batchNo">Batch Number *</Label>
                    {purchasedBatches.length > 0 ? (
                      <Select value={batchNo} onValueChange={setBatchNo}>
                        <SelectTrigger id="batchNo">
                          <SelectValue placeholder="Select purchased batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {purchasedBatches.map((batch) => (
                            <SelectItem key={batch} value={batch}>
                              {batch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <Input
                            id="batchNo"
                            value={batchNo}
                            onChange={(e) => setBatchNo(e.target.value)}
                            placeholder="e.g. BG-20260421-1430"
                          />
                          <Button type="button" variant="outline" onClick={generateBatchNo}>
                            Auto
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          No purchased batches for this category — enter manually
                        </p>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="mfgDate">Mfg Date *</Label>
                      <Input
                        id="mfgDate"
                        type="date"
                        value={mfgDate}
                        onChange={(e) => setMfgDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiryDate">Expiry Date</Label>
                      <Input
                        id="expiryDate"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this transfer..."
                  rows={3}
                />
              </div>

              {/* Action Button */}
              <Button
                className="w-full"
                onClick={handleTransfer}
                disabled={!requirements?.canProceed || loading || !mappedProduct || !batchNo.trim() || !mfgDate}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {loading ? "Processing..." : "Complete Transfer"}
              </Button>
              {selectedVariant && !mappedProduct && (
                <p className="text-sm text-destructive text-center">
                  Please map the variant to a product to enable transfer
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Requirements & Validation */}
        <div className="space-y-6">
          {/* Transfer Result Card */}
          {lastTransferResult && (
            <Card className="border-green-500 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-green-900 dark:text-green-100">
                      Transfer Completed
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLastTransferResult(null)}
                    className="h-8 w-8 p-0"
                  >
                    ✕
                  </Button>
                </div>
                <CardDescription className="text-green-700 dark:text-green-300">
                  {new Date(lastTransferResult.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Batch Info */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">
                    Batch Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Batch No:</span>
                      <span className="font-medium">{lastTransferResult.batchNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mfg Date:</span>
                      <span className="font-medium">{lastTransferResult.mfgDate}</span>
                    </div>
                    {lastTransferResult.expiryDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expiry Date:</span>
                        <span className="font-medium">{lastTransferResult.expiryDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transfer Details */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">
                    Transfer Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Product:</span>
                      <span className="font-medium text-right">
                        {lastTransferResult.categoryName} - {lastTransferResult.variantName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity Packaged:</span>
                      <span className="font-medium text-green-700 dark:text-green-300">
                        {lastTransferResult.quantity} units
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loose Stock Used:</span>
                      <span className="font-medium text-orange-600">
                        {lastTransferResult.litersConsumed.toFixed(2)}L
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock Changes */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">
                    Loose Stock Balance
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Previous:</span>
                      <span className="font-medium">
                        {lastTransferResult.previousLooseStock.toFixed(2)}L
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Consumed:</span>
                      <span className="font-medium text-red-600">
                        -{lastTransferResult.litersConsumed.toFixed(2)}L
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-muted-foreground font-semibold">Current:</span>
                      <span className="font-bold text-green-700 dark:text-green-300">
                        {lastTransferResult.newLooseStock.toFixed(2)}L
                      </span>
                    </div>
                  </div>
                </div>

                {/* Packaging Materials Consumed */}
                {lastTransferResult.materialsUsed.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">
                      Packaging Materials Consumed
                    </h4>
                    <div className="space-y-2">
                      {lastTransferResult.materialsUsed.map((material, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center px-3 py-2 rounded-md bg-background border"
                      >
                        <span className="text-sm">{material.name}</span>
                        <Badge variant="destructive" className="ml-2">
                          -{material.quantity}
                        </Badge>
                      </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Material Requirements */}
          {materialRequirements.filter(req => req.material_type === 'packaging').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Packaging Material Requirements</CardTitle>
                <CardDescription>
                  Packaging materials needed per unit and availability check
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Use</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Per Unit</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialRequirements.filter(req => req.material_type === 'packaging').map((req) => {
                      const lowerName = req.material_name.toLowerCase()
                      const isBag = lowerName.includes('bag') && !lowerName.includes('bottle bag')
                      const isBottleBag = lowerName.includes('bottle bag')
                      const isSticker = lowerName.includes('sticker')
                      const isExcluded = excludedMaterials.has(req.material_id)
                      const needed = isExcluded ? 0 : req.quantity_per_unit * (Number(transferQuantity) || 0)
                      const sufficient = isExcluded || req.available_quantity >= needed

                      // Disable checkbox for sticker/bottle bag when plain is selected
                      const isPlainDisabled = packageType === "plain" && (isSticker || isBottleBag)

                      return (
                        <TableRow key={req.id} className={isExcluded ? "opacity-50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={!isExcluded}
                              onCheckedChange={() => toggleMaterial(req.material_id)}
                              disabled={(req.is_required && !isBag && !isBottleBag && !isSticker) || isPlainDisabled}
                              aria-label={`Include ${req.material_name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {req.material_name}
                            {req.is_required && !isBag && !isBottleBag && !isSticker && (
                              <Badge variant="secondary" className="ml-2 text-xs">Required</Badge>
                            )}
                            {(!req.is_required || isBag || isBottleBag || isSticker) && (
                              <Badge variant="outline" className="ml-2 text-xs">Optional</Badge>
                            )}
                            {isPlainDisabled && (
                              <Badge variant="destructive" className="ml-2 text-xs">Plain Mode</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {req.quantity_per_unit}
                          </TableCell>
                          <TableCell className="text-right">
                            {req.available_quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {isExcluded ? (
                              <span className="text-xs text-muted-foreground">Skipped</span>
                            ) : transferQuantity && Number(transferQuantity) > 0 ? (
                              sufficient ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-destructive ml-auto" />
                              )
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Transfer Summary */}
          {requirements && Number(transferQuantity) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Transfer Summary</CardTitle>
                <CardDescription>
                  Validation and requirements check
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Loose Stock Requirement */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-orange-600" />
                    <span className="font-medium">Loose Stock Needed</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-orange-600">
                      {requirements.totalLitersNeeded.toFixed(2)}L
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Available: {looseStock?.quantity_liters.toFixed(2)}L
                    </div>
                  </div>
                </div>

                {/* Material Summary - Only show active packaging materials */}
                {requirements.materialNeeds.filter(m => m.material_type === 'packaging').length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Packaging Materials Needed:</h4>
                    {requirements.materialNeeds.filter(m => m.material_type === 'packaging').map((material) => (
                      <div key={material.id} className={`flex items-center justify-between text-sm p-2 rounded bg-muted/50 ${material.excluded ? 'opacity-50' : ''}`}>
                        <span>{material.material_name}{material.excluded ? ' (skipped)' : ''}</span>
                        <div className="flex items-center gap-2">
                          {material.excluded ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <>
                              <span className={material.sufficient ? "text-green-600" : "text-destructive"}>
                                {material.needed} / {material.available_quantity}
                              </span>
                              {material.sufficient ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Final Status */}
                {requirements.canProceed ? (
                  <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      All requirements met. Ready to transfer {transferQuantity} unit(s).
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {!requirements.looseStockSufficient && "Insufficient loose stock. "}
                      {!requirements.allMaterialsSufficient && "Some required materials are insufficient."}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
