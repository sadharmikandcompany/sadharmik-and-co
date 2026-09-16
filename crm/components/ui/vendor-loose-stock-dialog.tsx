"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Droplets } from "lucide-react"

type ProductCategory = {
  id: string
  name: string
}

const MAIN_STOCK_CATEGORIES = [
  "Buffalo Ghee",
  "Cow Ghee",
  "Valona Ghee",
  "Groundnut Oil"
]

interface VendorLooseStockDialogProps {
  vendorId: string
  vendorName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

export function VendorLooseStockDialog({
  vendorId,
  vendorName,
  open,
  onOpenChange,
  onUpdate,
}: VendorLooseStockDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open, vendorId])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch main stock categories
      const { data: categoriesData, error: catError } = await supabase
        .from("product_categories")
        .select("id, name")
        .in("name", MAIN_STOCK_CATEGORIES)
        .order("name")

      if (catError) throw catError
      setCategories(categoriesData || [])

      // Fetch vendor's current loose stock associations
      const { data: vendorLooseStock, error: vLsError } = await supabase
        .from("vendor_loose_stock")
        .select("category_id")
        .eq("vendor_id", vendorId)

      if (vLsError) throw vLsError

      const categoryIds = (vendorLooseStock || []).map((item: any) => item.category_id)
      setSelectedCategories(categoryIds)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load loose stock categories")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Delete all existing associations for this vendor
      const { error: deleteError } = await supabase
        .from("vendor_loose_stock")
        .delete()
        .eq("vendor_id", vendorId)

      if (deleteError) throw deleteError

      // Insert new associations
      if (selectedCategories.length > 0) {
        const associations = selectedCategories.map((categoryId) => ({
          vendor_id: vendorId,
          category_id: categoryId,
        }))

        const { error: insertError } = await supabase
          .from("vendor_loose_stock")
          .insert(associations)

        if (insertError) throw insertError
      }

      toast.success("Loose stock categories updated successfully")
      onUpdate?.()
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving loose stock categories:", error)
      toast.error("Failed to update loose stock categories")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-orange-600" />
            Manage Loose Stock Categories
          </DialogTitle>
          <DialogDescription>
            Select which loose stock categories <strong>{vendorName}</strong> can supply
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-4">
              Loading categories...
            </div>
          ) : (
            <div className="space-y-3">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No main stock categories found
                </p>
              ) : (
                categories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={() => handleToggleCategory(category.id)}
                    />
                    <Label
                      htmlFor={`category-${category.id}`}
                      className="flex-1 cursor-pointer font-medium"
                    >
                      {category.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && selectedCategories.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>{selectedCategories.length}</strong> categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
