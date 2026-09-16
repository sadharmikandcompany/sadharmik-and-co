"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { ArrowLeft, Package2, Plus, Pencil, Trash2, Settings2, X, Info } from "lucide-react"

type ProductCategory = {
  id: string
  name: string
}

type ProductVariant = {
  id: string
  variant_name: string
  category_id: string
  category_name?: string
  product_id?: string | null
  product_name?: string | null
}

type PackagingMaterial = {
  id: string
  name: string
  material_type: string
}

type Product = {
  id: string
  name: string
}

type MaterialMapping = {
  id: string
  variant_id: string
  variant_name: string
  category_name: string
  material_id: string
  material_name: string
  material_type: string
  quantity_per_unit: number
  liters_consumed_per_unit: number
  is_required: boolean
  display_order: number
  product_id: string | null
  product_name: string | null
}

export default function MaterialMappingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [materials, setMaterials] = useState<PackagingMaterial[]>([])
  const [mappings, setMappings] = useState<MaterialMapping[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])

  // Variant product mapping states
  const [editingVariantProduct, setEditingVariantProduct] = useState<string | null>(null)
  const [variantProductId, setVariantProductId] = useState("")
  const [updatingVariantProduct, setUpdatingVariantProduct] = useState(false)

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Dialog states
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState<MaterialMapping | null>(null)
  const [deletingMapping, setDeletingMapping] = useState<MaterialMapping | null>(null)

  // Form states
  const [formVariantId, setFormVariantId] = useState("")
  const [formMaterialId, setFormMaterialId] = useState("")
  const [formProductId, setFormProductId] = useState("")
  const [formQuantityPerUnit, setFormQuantityPerUnit] = useState("1")
  const [formLitersConsumed, setFormLitersConsumed] = useState("0")
  const [formIsRequired, setFormIsRequired] = useState("true")
  const [formDisplayOrder, setFormDisplayOrder] = useState("0")

  // Batch form states for adding multiple materials
  type MaterialRow = {
    id: string
    material_id: string
    quantity_per_unit: string
    liters_consumed_per_unit: string
    is_required: string
    display_order: string
  }
  const [batchMode, setBatchMode] = useState(false)
  const [batchMaterialRows, setBatchMaterialRows] = useState<MaterialRow[]>([
    {
      id: crypto.randomUUID(),
      material_id: "",
      quantity_per_unit: "1",
      liters_consumed_per_unit: "0",
      is_required: "true",
      display_order: "0",
    },
  ])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchCategories(),
        fetchVariants(),
        fetchMaterials(),
        fetchProducts(),
        fetchMappings(),
      ])
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .order("name")

    if (error) throw error
    setCategories(data || [])
  }

  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from("product_variants")
      .select(`
        id,
        variant_name,
        category_id,
        product_id,
        product_categories!inner (
          name
        ),
        products (
          name
        )
      `)
      .order("variant_name")

    if (error) throw error

    const transformedVariants: ProductVariant[] = (data || []).map((v: any) => ({
      id: v.id,
      variant_name: v.variant_name,
      category_id: v.category_id,
      category_name: v.product_categories.name,
      product_id: v.product_id,
      product_name: v.products?.name || null,
    }))

    setVariants(transformedVariants)
  }

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("packaging_materials")
      .select("*")
      .order("name")

    if (error) throw error
    setMaterials(data || [])
  }

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .eq("is_active", true)
      .order("name")

    if (error) throw error
    setProducts(data || [])
  }

  const updateVariantProductMapping = async (variantId: string, productId: string) => {
    setUpdatingVariantProduct(true)
    try {
      const { error } = await supabase
        .from("product_variants")
        .update({ product_id: productId || null })
        .eq("id", variantId)

      if (error) throw error

      toast.success("Product mapping updated successfully")
      setEditingVariantProduct(null)
      fetchVariants()
    } catch (error) {
      console.error("Error updating variant product mapping:", error)
      toast.error("Failed to update product mapping")
    } finally {
      setUpdatingVariantProduct(false)
    }
  }

  const fetchMappings = async () => {
    const { data, error } = await supabase
      .from("variant_material_mapping")
      .select(`
        id,
        variant_id,
        material_id,
        product_id,
        quantity_per_unit,
        liters_consumed_per_unit,
        is_required,
        display_order,
        product_variants!inner (
          variant_name,
          product_categories!inner (
            name
          )
        ),
        packaging_materials!inner (
          name,
          material_type
        ),
        products!variant_material_mapping_product_id_fkey (
          name
        )
      `)
      .order("display_order")

    if (error) throw error

    const transformedMappings: MaterialMapping[] = (data || []).map((m: any) => ({
      id: m.id,
      variant_id: m.variant_id,
      variant_name: m.product_variants.variant_name,
      category_name: m.product_variants.product_categories.name,
      material_id: m.material_id,
      material_name: m.packaging_materials.name,
      material_type: m.packaging_materials.material_type,
      quantity_per_unit: m.quantity_per_unit,
      liters_consumed_per_unit: m.liters_consumed_per_unit,
      is_required: m.is_required,
      display_order: m.display_order,
      product_id: m.product_id,
      product_name: m.products?.name || null,
    }))

    setMappings(transformedMappings)
  }

  const openAddDialog = () => {
    setEditingMapping(null)
    setFormVariantId("")
    setFormMaterialId("")
    setFormProductId("")
    setFormQuantityPerUnit("1")
    setFormLitersConsumed("0")
    setFormIsRequired("true")
    setFormDisplayOrder("0")
    setBatchMode(true) // Default to batch mode for better UX
    setBatchMaterialRows([
      {
        id: crypto.randomUUID(),
        material_id: "",
        quantity_per_unit: "1",
        liters_consumed_per_unit: "0",
        is_required: "true",
        display_order: "0",
      },
    ])
    updateAvailableProducts(null)
    setMappingDialogOpen(true)
  }

  const openEditDialog = (mapping: MaterialMapping) => {
    setEditingMapping(mapping)
    setFormVariantId(mapping.variant_id)
    setFormMaterialId(mapping.material_id)
    setFormProductId(mapping.product_id || "")
    setFormQuantityPerUnit(mapping.quantity_per_unit.toString())
    setFormLitersConsumed(mapping.liters_consumed_per_unit.toString())
    setFormIsRequired(mapping.is_required.toString())
    setFormDisplayOrder(mapping.display_order.toString())
    setBatchMode(false) // Single mode for editing
    updateAvailableProducts(mapping.id)
    setMappingDialogOpen(true)
  }

  // Batch material row management
  const addMaterialRow = () => {
    setBatchMaterialRows([
      ...batchMaterialRows,
      {
        id: crypto.randomUUID(),
        material_id: "",
        quantity_per_unit: "1",
        liters_consumed_per_unit: "0",
        is_required: "true",
        display_order: batchMaterialRows.length.toString(),
      },
    ])
  }

  const removeMaterialRow = (rowId: string) => {
    if (batchMaterialRows.length > 1) {
      setBatchMaterialRows(batchMaterialRows.filter((row) => row.id !== rowId))
    }
  }

  const updateMaterialRow = (rowId: string, field: keyof MaterialRow, value: string) => {
    setBatchMaterialRows(
      batchMaterialRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    )
  }

  // Update available products - show only unmapped products and the currently mapped product
  const updateAvailableProducts = (currentMappingId: string | null) => {
    // Get all product IDs that are already mapped
    const mappedProductIds = new Set(
      mappings
        .filter(m => m.product_id && (!currentMappingId || m.id !== currentMappingId))
        .map(m => m.product_id)
    )

    // Filter to show only unmapped products or the current product
    const available = products.filter(p => !mappedProductIds.has(p.id))
    setAvailableProducts(available)
  }

  const handleSaveMapping = async () => {
    // Validation
    if (!formVariantId) {
      toast.error("Please select a variant")
      return
    }

    setSaving(true)
    try {
      if (batchMode && !editingMapping) {
        // Batch mode - add multiple materials
        const validRows = batchMaterialRows.filter((row) => row.material_id)

        if (validRows.length === 0) {
          toast.error("Please select at least one material")
          setSaving(false)
          return
        }

        // Validate each row
        for (const row of validRows) {
          if (!row.quantity_per_unit || parseFloat(row.quantity_per_unit) <= 0) {
            toast.error("All quantities must be greater than 0")
            setSaving(false)
            return
          }
          if (parseFloat(row.liters_consumed_per_unit) < 0) {
            toast.error("Liters consumed cannot be negative")
            setSaving(false)
            return
          }
        }

        // Create batch mappings
        const mappingsToInsert = validRows.map((row) => ({
          variant_id: formVariantId,
          material_id: row.material_id,
          product_id: null,
          quantity_per_unit: parseFloat(row.quantity_per_unit),
          liters_consumed_per_unit: parseFloat(row.liters_consumed_per_unit),
          is_required: row.is_required === "true",
          display_order: parseInt(row.display_order) || 0,
        }))

        const { error } = await supabase
          .from("variant_material_mapping")
          .insert(mappingsToInsert)

        if (error) throw error
        toast.success(`${validRows.length} material mapping(s) created successfully`)
      } else {
        // Single mode - add/edit one material
        if (!formMaterialId) {
          toast.error("Please select a material")
          setSaving(false)
          return
        }
        if (!formQuantityPerUnit || parseFloat(formQuantityPerUnit) <= 0) {
          toast.error("Quantity per unit must be greater than 0")
          setSaving(false)
          return
        }
        if (parseFloat(formLitersConsumed) < 0) {
          toast.error("Liters consumed cannot be negative")
          setSaving(false)
          return
        }

        const mappingData = {
          variant_id: formVariantId,
          material_id: formMaterialId,
          product_id: null,
          quantity_per_unit: parseFloat(formQuantityPerUnit),
          liters_consumed_per_unit: parseFloat(formLitersConsumed),
          is_required: formIsRequired === "true",
          display_order: parseInt(formDisplayOrder) || 0,
        }

        if (editingMapping) {
          // Update existing mapping
          const { error } = await supabase
            .from("variant_material_mapping")
            .update(mappingData)
            .eq("id", editingMapping.id)

          if (error) throw error
          toast.success("Material mapping updated successfully")
        } else {
          // Create new mapping
          const { error } = await supabase
            .from("variant_material_mapping")
            .insert([mappingData])

          if (error) throw error
          toast.success("Material mapping created successfully")
        }
      }

      setMappingDialogOpen(false)
      fetchMappings()
    } catch (error: any) {
      console.error("Error saving material mapping:", error)
      if (error.code === "23505") {
        toast.error("One or more variant-material combinations already exist")
      } else {
        toast.error("Failed to save material mapping")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMapping = async () => {
    if (!deletingMapping) return

    try {
      const { error } = await supabase
        .from("variant_material_mapping")
        .delete()
        .eq("id", deletingMapping.id)

      if (error) throw error

      toast.success("Material mapping deleted successfully")
      setDeletingMapping(null)
      fetchMappings()
    } catch (error) {
      console.error("Error deleting material mapping:", error)
      toast.error("Failed to delete material mapping")
    }
  }

  // Filter mappings by category
  const filteredMappings = mappings.filter((mapping) =>
    selectedCategory === "all" ||
    variants.find(v => v.id === mapping.variant_id)?.category_id === selectedCategory
  )

  // Group mappings by variant
  const groupedMappings = filteredMappings.reduce((acc, mapping) => {
    const key = `${mapping.variant_id}`
    if (!acc[key]) {
      acc[key] = {
        variant_id: mapping.variant_id,
        variant_name: mapping.variant_name,
        category_name: mapping.category_name,
        mappings: [],
      }
    }
    acc[key].mappings.push(mapping)
    return acc
  }, {} as Record<string, { variant_id: string; variant_name: string; category_name: string; mappings: MaterialMapping[] }>)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Settings2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Material Mapping</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Settings2 className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Settings2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Variant Material Mapping</h1>
            <p className="text-sm text-muted-foreground">
              Define material requirements and loose stock consumption for each product variant
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Mapping
          </Button>
        </div>
      </div>

      {/* Material Type Info */}
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>Material Types:</strong>{" "}
          <span className="inline-flex items-center gap-1">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">
              Content
            </Badge>
            materials (Ghee, oil) are liquids tracked in loose stock - they won't block transfers if not in stock inventory.
          </span>{" "}
          <span className="inline-flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              Packaging
            </Badge>
            materials (Bottle, Sticker, etc.) must be available in stock inventory for transfers to proceed.
          </span>
        </AlertDescription>
      </Alert>

      {/* Filter */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription className="mt-0.5">Narrow material mappings by category</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {Object.values(groupedMappings).length} {Object.values(groupedMappings).length === 1 ? "variant" : "variants"}
              </Badge>
              {selectedCategory !== "all" && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-4 text-xs text-muted-foreground">
          {Object.values(groupedMappings).length} variant group(s) shown
        </CardContent>
      </Card>
      </div>

      {/* Mappings Display */}
      {Object.values(groupedMappings).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Material Mappings Found</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Define material requirements for variants to enable proper stock tracking and transfers
            </p>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Mapping
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.values(groupedMappings).map((group) => {
          const variant = variants.find((v) => v.id === group.variant_id)
          const isEditingProduct = editingVariantProduct === group.variant_id

          return (
            <Card key={group.variant_id}>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{group.variant_name}</CardTitle>
                      <CardDescription>{group.category_name}</CardDescription>
                    </div>
                    <Badge variant="outline">
                      {group.mappings.length} material{group.mappings.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  {/* Product Mapping Section */}
                  {variant && (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                      {isEditingProduct ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Package2 className="h-4 w-4 text-muted-foreground" />
                          <Select
                            value={variantProductId || "none"}
                            onValueChange={setVariantProductId}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Product</SelectItem>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() =>
                              updateVariantProductMapping(
                                group.variant_id,
                                variantProductId === "none" ? "" : variantProductId
                              )
                            }
                            disabled={updatingVariantProduct}
                          >
                            {updatingVariantProduct ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingVariantProduct(null)}
                            disabled={updatingVariantProduct}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Mapped Product:</span>
                            {variant.product_name ? (
                              <Badge variant="secondary">{variant.product_name}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not mapped</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingVariantProduct(group.variant_id)
                              setVariantProductId(variant.product_id || "none")
                            }}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Update
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <div className="w-full max-w-full overflow-x-auto">
                <Table className="min-w-[800px] w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Material</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Qty per Unit</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Liters Consumed</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Required</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Order</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.mappings
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((mapping) => (
                        <TableRow key={mapping.id} className="transition-colors hover:bg-muted/30">
                          <TableCell className="font-medium">{mapping.material_name}</TableCell>
                          <TableCell>
                            {mapping.material_type === 'content' ? (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                Content
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Packaging
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{mapping.quantity_per_unit}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {mapping.liters_consumed_per_unit > 0 ? `${mapping.liters_consumed_per_unit} L` : '-'}
                          </TableCell>
                          <TableCell>
                            {mapping.is_required ? (
                              <Badge variant="default">Required</Badge>
                            ) : (
                              <Badge variant="outline">Optional</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{mapping.display_order}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(mapping)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingMapping(mapping)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </CardContent>
          </Card>
          )
        })
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="border-b bg-muted/30 px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base">{editingMapping ? "Edit" : "Add"} Material Mapping</DialogTitle>
                <DialogDescription className="mt-0.5">
                  {batchMode
                    ? "Add multiple materials for a variant at once"
                    : "Define how many units of each material are needed for this variant"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 px-4 pt-2 pb-4">
            {/* Variant Selection */}
            <div className="space-y-2">
              <Label>Variant *</Label>
              <Select
                value={formVariantId}
                onValueChange={setFormVariantId}
                disabled={!!editingMapping}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select variant" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.category_name} - {variant.variant_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {batchMode ? (
              /* Batch Mode - Multiple Materials */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Materials</Label>
                  <Button type="button" size="sm" onClick={addMaterialRow}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Material
                  </Button>
                </div>

                <div className="space-y-3">
                  {batchMaterialRows.map((row, index) => (
                    <Card key={row.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            {/* Material Selection */}
                            <div className="space-y-2">
                              <Label className="text-sm">Material *</Label>
                              <Select
                                value={row.material_id}
                                onValueChange={(value) =>
                                  updateMaterialRow(row.id, "material_id", value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select material" />
                                </SelectTrigger>
                                <SelectContent>
                                  {materials.map((material) => (
                                    <SelectItem key={material.id} value={material.id}>
                                      <div className="flex items-center gap-2">
                                        <span>{material.name}</span>
                                        {material.material_type === 'content' && (
                                          <span className="text-xs text-orange-600 dark:text-orange-400">(Content)</span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                              {/* Quantity */}
                              <div className="space-y-2">
                                <Label className="text-xs">Qty per Unit *</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.0001"
                                  value={row.quantity_per_unit}
                                  onChange={(e) =>
                                    updateMaterialRow(row.id, "quantity_per_unit", e.target.value)
                                  }
                                  placeholder="1"
                                />
                              </div>

                              {/* Liters Consumed */}
                              <div className="space-y-2">
                                <Label className="text-xs">Liters Consumed</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.0001"
                                  value={row.liters_consumed_per_unit}
                                  onChange={(e) =>
                                    updateMaterialRow(
                                      row.id,
                                      "liters_consumed_per_unit",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0"
                                />
                              </div>

                              {/* Required */}
                              <div className="space-y-2">
                                <Label className="text-xs">Required?</Label>
                                <Select
                                  value={row.is_required}
                                  onValueChange={(value) =>
                                    updateMaterialRow(row.id, "is_required", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">Yes</SelectItem>
                                    <SelectItem value="false">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* Remove button */}
                          {batchMaterialRows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMaterialRow(row.id)}
                              className="mt-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              /* Single Mode - One Material (for editing) */
              <>
                <div className="space-y-2">
                  <Label>Material *</Label>
                  <Select
                    value={formMaterialId}
                    onValueChange={setFormMaterialId}
                    disabled={!!editingMapping}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          <div className="flex items-center gap-2">
                            <span>{material.name}</span>
                            {material.material_type === 'content' && (
                              <span className="text-xs text-orange-600 dark:text-orange-400">(Content)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Quantity per Unit *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={formQuantityPerUnit}
                      onChange={(e) => setFormQuantityPerUnit(e.target.value)}
                      placeholder="e.g., 1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Liters Consumed per Unit</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={formLitersConsumed}
                      onChange={(e) => setFormLitersConsumed(e.target.value)}
                      placeholder="e.g., 1 or 0.5"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Is Required?</Label>
                    <Select value={formIsRequired} onValueChange={setFormIsRequired}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Required</SelectItem>
                        <SelectItem value="false">Optional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formDisplayOrder}
                      onChange={(e) => setFormDisplayOrder(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="border-t bg-muted/30 px-6 py-3">
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMapping} disabled={saving}>
              {saving
                ? "Saving..."
                : batchMode
                ? `Create ${batchMaterialRows.filter((r) => r.material_id).length} Mapping(s)`
                : editingMapping
                ? "Update"
                : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingMapping} onOpenChange={() => setDeletingMapping(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the material mapping for{" "}
              <strong>{deletingMapping?.variant_name}</strong> - <strong>{deletingMapping?.material_name}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMapping}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
