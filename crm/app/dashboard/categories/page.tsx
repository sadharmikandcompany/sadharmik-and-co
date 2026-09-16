"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, FolderTree, Loader2, Search, Layers, CheckCircle2, FolderX, Package as PackageIcon } from "lucide-react"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"

type Category = {
  id: string
  category_name: string
  parent_category_id: string | null
  parent_category_name?: string
  meta_title: string | null
  meta_description: string | null
  content: string | null
  visible_on_frontend: boolean
  is_active: boolean
  created_at: string
  parent_usage_count?: number
  sub_usage_count?: number
  total_usage_count?: number
}

type CategoryFormData = {
  category_name: string
  parent_category_id: string | null
  meta_title: string
  meta_description: string
  content: string
  visible_on_frontend: boolean
  is_active: boolean
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<CategoryFormData>({
    category_name: "",
    parent_category_id: null,
    meta_title: "",
    meta_description: "",
    content: "",
    visible_on_frontend: true,
    is_active: true,
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)

    // Fetch categories
    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false })

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError)
      toast.error("Failed to fetch categories")
      setLoading(false)
      return
    }

    // Fetch product counts for each category
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("parent_category_id, sub_category_id")

    if (productsError) {
      console.error("Error fetching product counts:", productsError)
    }

    // Calculate usage counts
    const parentUsageMap = new Map<string, number>()
    const subUsageMap = new Map<string, number>()

    productsData?.forEach((product) => {
      if (product.parent_category_id) {
        parentUsageMap.set(
          product.parent_category_id,
          (parentUsageMap.get(product.parent_category_id) || 0) + 1
        )
      }
      if (product.sub_category_id) {
        subUsageMap.set(
          product.sub_category_id,
          (subUsageMap.get(product.sub_category_id) || 0) + 1
        )
      }
    })

    const categoryMap = new Map<string, string>()
    categoriesData?.forEach((cat) => {
      categoryMap.set(cat.id, cat.category_name)
    })

    const categoriesWithDetails = categoriesData?.map((cat) => ({
      ...cat,
      parent_category_name: cat.parent_category_id
        ? categoryMap.get(cat.parent_category_id)
        : undefined,
      parent_usage_count: parentUsageMap.get(cat.id) || 0,
      sub_usage_count: subUsageMap.get(cat.id) || 0,
      total_usage_count: (parentUsageMap.get(cat.id) || 0) + (subUsageMap.get(cat.id) || 0),
    }))

    setCategories(categoriesWithDetails || [])
    setLoading(false)
  }

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        category_name: category.category_name,
        parent_category_id: category.parent_category_id,
        meta_title: category.meta_title || "",
        meta_description: category.meta_description || "",
        content: category.content || "",
        visible_on_frontend: category.visible_on_frontend,
        is_active: category.is_active,
      })
    } else {
      setEditingCategory(null)
      setFormData({
        category_name: "",
        parent_category_id: null,
        meta_title: "",
        meta_description: "",
        content: "",
        visible_on_frontend: true,
        is_active: true,
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update(formData)
          .eq("id", editingCategory.id)

        if (error) throw error
        toast.success("Category updated successfully")
      } else {
        const { error } = await supabase
          .from("categories")
          .insert([formData])

        if (error) throw error
        toast.success("Category created successfully")
      }

      setDialogOpen(false)
      fetchCategories()
    } catch (error: unknown) {
      console.error("Error saving category:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save category"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCategory) return

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", deletingCategory.id)

      if (error) throw error

      toast.success("Category deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingCategory(null)
      fetchCategories()
    } catch (error: unknown) {
      console.error("Error deleting category:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete category"
      toast.error(errorMessage)
    }
  }

  const filteredCategories = categories.filter(
    (category) =>
      category.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (category.parent_category_name &&
        category.parent_category_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (category.meta_title && category.meta_title.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const parentCategories = filteredCategories.filter((cat) => !cat.parent_category_id)
  const childCategories = filteredCategories.filter((cat) => cat.parent_category_id)

  // Get available parent categories for select dropdown (exclude current category when editing)
  const availableParentCategories = categories.filter(
    (cat) => !cat.parent_category_id && (!editingCategory || cat.id !== editingCategory.id)
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <FolderTree className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Categories</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const totalProducts = categories.reduce((sum, cat) => sum + (cat.total_usage_count || 0), 0)
  const categoriesWithProducts = categories.filter((cat) => (cat.total_usage_count || 0) > 0).length
  const categoriesWithoutProducts = categories.filter((cat) => (cat.total_usage_count || 0) === 0).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FolderTree className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Categories</h1>
            <p className="text-sm text-muted-foreground">Manage your product categories</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Categories</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{categories.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <Layers className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {parentCategories.length} parent, {childCategories.length} child
          </CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>With Products</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{categoriesWithProducts}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Categories in use</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Empty Categories</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{categoriesWithoutProducts}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <FolderX className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">No products assigned</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Total Products</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{totalProducts}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <PackageIcon className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across all categories</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900/50">
                <FolderTree className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Category List</CardTitle>
                <CardDescription className="mt-0.5">Hierarchical list of all categories</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"}
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Category Name</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Parent Category</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Product Usage</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Meta Title</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No categories found
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {parentCategories.map((category) => (
                      <TableRow key={category.id} className="transition-colors hover:bg-muted/30">
                        <TableCell className="font-bold">
                          {category.category_name}
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono">
                              {category.total_usage_count || 0}
                            </Badge>
                            {category.total_usage_count && category.total_usage_count > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                ({category.parent_usage_count || 0} parent, {category.sub_usage_count || 0} sub)
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No products</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{category.meta_title || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant={category.is_active ? "default" : "secondary"} className="rounded-full capitalize">
                              {category.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {category.visible_on_frontend && (
                              <Badge variant="outline" className="rounded-full capitalize">Visible</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingCategory(category)
                                setDeleteDialogOpen(true)
                              }}
                              disabled={(category.total_usage_count || 0) > 0}
                              title={(category.total_usage_count || 0) > 0 ? "Cannot delete category with products" : "Delete category"}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {childCategories.map((category) => (
                      <TableRow key={category.id} className="transition-colors hover:bg-muted/30">
                        <TableCell className="pl-8">
                          {category.category_name}
                        </TableCell>
                        <TableCell>{category.parent_category_name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono">
                              {category.total_usage_count || 0}
                            </Badge>
                            {category.total_usage_count && category.total_usage_count > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                ({category.parent_usage_count || 0} parent, {category.sub_usage_count || 0} sub)
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No products</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{category.meta_title || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant={category.is_active ? "default" : "secondary"} className="rounded-full capitalize">
                              {category.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {category.visible_on_frontend && (
                              <Badge variant="outline" className="rounded-full capitalize">Visible</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingCategory(category)
                                setDeleteDialogOpen(true)
                              }}
                              disabled={(category.total_usage_count || 0) > 0}
                              title={(category.total_usage_count || 0) > 0 ? "Cannot delete category with products" : "Delete category"}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredCategories.length} of {categories.length} categories
            ({parentCategories.length} parent, {childCategories.length} child)
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="border-b bg-muted/30 px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <FolderTree className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base">
                  {editingCategory ? "Edit Category" : "Add New Category"}
                </DialogTitle>
                <DialogDescription className="mt-0.5">
                  {editingCategory
                    ? "Update category information"
                    : "Enter category details to create a new category"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-4 py-4 space-y-3">
            <div className="rounded-lg border bg-card p-3 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Basic info</div>
              <div className="space-y-2">
                <Label htmlFor="category_name">Category Name <span className="text-rose-500">*</span></Label>
                <Input
                  id="category_name"
                  placeholder="e.g. Hair Care"
                  value={formData.category_name}
                  onChange={(e) =>
                    setFormData({ ...formData, category_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent_category_id">Parent Category</Label>
                <Select
                  value={formData.parent_category_id || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      parent_category_id: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Root Category)</SelectItem>
                    {availableParentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Category Description</Label>
                <Textarea
                  id="content"
                  placeholder="What does this category contain?"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SEO</div>
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  placeholder="Shown in search results"
                  value={formData.meta_title}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  placeholder="Short summary for search engines"
                  value={formData.meta_description}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_description: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visibility</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium">Active</div>
                    <div className="text-xs text-muted-foreground">Available for assignment</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.visible_on_frontend}
                    onChange={(e) =>
                      setFormData({ ...formData, visible_on_frontend: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium">Visible on Frontend</div>
                    <div className="text-xs text-muted-foreground">Show on storefront</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category{" "}
              <strong>{deletingCategory?.category_name}</strong>. This action cannot be undone.
              {deletingCategory && (deletingCategory.total_usage_count || 0) > 0 && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm font-semibold text-destructive">
                    Warning: This category is used by {deletingCategory.total_usage_count} product(s)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ({deletingCategory.parent_usage_count || 0} as parent category, {deletingCategory.sub_usage_count || 0} as sub-category)
                  </p>
                  <p className="text-xs mt-2">
                    Products will have their category references removed if you proceed.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
