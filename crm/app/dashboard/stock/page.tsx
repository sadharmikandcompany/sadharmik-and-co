"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Package,
  Pencil,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Settings,
  Minus,
  Download,
  MessageSquare,
  Save,
  X,
  Truck,
  ChevronDown,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type StockItem = {
  id: string
  category: string
  variant: string
  material: string
  material_type: string
  quantity: number
  min_stock: number
  price: number
  updated_at: string
}

type ProductCategory = {
  id: string
  name: string
  created_at: string
}

type ProductVariant = {
  id: string
  category_id: string
  variant_name: string
  category_name?: string
  created_at: string
  product_id?: string | null
  product_name?: string | null
  product_stock?: number
}

type PackagingMaterial = {
  id: string
  name: string
  material_type: string
  created_at: string
}

type StockComment = {
  id: string
  stock_inventory_id: string
  user_id: string | null
  user_email: string | null
  previous_quantity: number
  new_quantity: number
  quantity_change: number
  comment: string | null
  created_at: string
}

type LooseStock = {
  id: string
  category_id: string
  quantity_liters: number
  price_per_liter: number
  min_stock_liters?: number
  product_categories: {
    name: string
  }
}

type FactoryWarehouseItem = {
  id: string
  stock_inventory_id: string
  product_id: string
  quantity: number
  min_stock_level: number
  variant_id: string
  variant_name: string
  category_id: string
  category_name: string
  product_name: string
}

export default function StockInventoryPage() {
  const router = useRouter()
  const [stockData, setStockData] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [hideEmpty, setHideEmpty] = useState(true)
  const [editingCell, setEditingCell] = useState<{ id: string; value: number } | null>(null)

  // Management dialogs state
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [manageTab, setManageTab] = useState<"categories" | "variants" | "materials">("categories")

  // Categories state
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null)
  const [categoryName, setCategoryName] = useState("")
  const [deletingCategory, setDeletingCategory] = useState<ProductCategory | null>(null)

  // Variants state
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [variantName, setVariantName] = useState("")
  const [variantCategoryId, setVariantCategoryId] = useState("")
  const [deletingVariant, setDeletingVariant] = useState<ProductVariant | null>(null)

  // Materials state
  const [materials, setMaterials] = useState<PackagingMaterial[]>([])
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<PackagingMaterial | null>(null)
  const [materialName, setMaterialName] = useState("")
  const [deletingMaterial, setDeletingMaterial] = useState<PackagingMaterial | null>(null)

  // Comments state
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [currentStockItem, setCurrentStockItem] = useState<StockItem | null>(null)
  const [pendingQuantity, setPendingQuantity] = useState<number>(0)
  const [comment, setComment] = useState("")
  const [showCommentsDialog, setShowCommentsDialog] = useState(false)
  const [stockComments, setStockComments] = useState<StockComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map())
  const [showAllCommentsDialog, setShowAllCommentsDialog] = useState(false)
  const [allComments, setAllComments] = useState<(StockComment & { stock_item?: StockItem })[]>([])
  const [loadingAllComments, setLoadingAllComments] = useState(false)

  const [saving, setSaving] = useState(false)

  // Loose stock state
  const [looseStocks, setLooseStocks] = useState<LooseStock[]>([])
  const [loadingLooseStock, setLoadingLooseStock] = useState(false)

  // Product counts state
  const [productCounts, setProductCounts] = useState({
    buffaloGhee: 0,
    cowGhee: 0,
    cowBelonaGhee: 0,
    groundnutOil: 0,
  })

  // Order quantities by product_id
  const [orderQuantities, setOrderQuantities] = useState<Map<string, number>>(new Map())

  // Factory warehouse stock
  const [factoryStock, setFactoryStock] = useState<FactoryWarehouseItem[]>([])

  useEffect(() => {
    fetchStockData()
    fetchCurrentUser()
    fetchLooseStock()
    fetchProductCounts()
    fetchVariantsWithProducts()
    fetchOrderQuantities()
    fetchFactoryWarehouseStock()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const fetchLooseStock = async () => {
    setLoadingLooseStock(true)
    try {
      const { data, error } = await supabase
        .from("loose_stock")
        .select(`
          *,
          product_categories!inner (
            name
          )
        `)
        .order("product_categories(name)")

      if (error) throw error
      setLooseStocks(data || [])
    } catch (error) {
      console.error("Error fetching loose stock:", error)
    } finally {
      setLoadingLooseStock(false)
    }
  }

  const fetchProductCounts = async () => {
    try {
      const { data, error } = await supabase.rpc('get_product_counts_by_category')

      if (error) {
        // Fallback to manual query if RPC doesn't exist
        const { data: manualData, error: manualError } = await supabase
          .from("product_categories")
          .select(`
            name,
            product_variants!inner (
              product_id,
              products!inner (
                id,
                is_active
              )
            )
          `)
          .in("name", ["Buffalo Ghee", "Cow Ghee", "Valona Ghee", "Groundnut Oil"])

        if (manualError) throw manualError

        // Process manual data
        const counts = {
          buffaloGhee: 0,
          cowGhee: 0,
          cowBelonaGhee: 0,
          groundnutOil: 0,
        }

        manualData?.forEach((category: any) => {
          const uniqueProducts = new Set(
            category.product_variants
              ?.filter((v: any) => v.product_id && v.products?.is_active)
              .map((v: any) => v.product_id)
          )
          const count = uniqueProducts.size

          if (category.name === "Buffalo Ghee") counts.buffaloGhee = count
          else if (category.name === "Cow Ghee") counts.cowGhee = count
          else if (category.name === "Valona Ghee") counts.cowBelonaGhee = count
          else if (category.name === "Groundnut Oil") counts.groundnutOil = count
        })

        setProductCounts(counts)
      } else {
        setProductCounts(data)
      }
    } catch (error) {
      console.error("Error fetching product counts:", error)
    }
  }

  const fetchVariantsWithProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select(`
          id,
          variant_name,
          category_id,
          created_at,
          product_id,
          product_categories (
            name
          ),
          products (
            name,
            stock
          )
        `)
        .order("variant_name")

      if (error) throw error

      const transformedVariants = (data || []).map((v: any) => ({
        id: v.id,
        category_id: v.category_id,
        variant_name: v.variant_name,
        category_name: v.product_categories?.name,
        product_id: v.product_id,
        product_name: v.products?.name || null,
        product_stock: v.products?.stock || 0,
        created_at: v.created_at,
      }))

      setVariants(transformedVariants)
    } catch (error) {
      console.error("Error fetching variants:", error)
    }
  }

  const fetchOrderQuantities = async () => {
    try {
      // Fetch order items from distributor proforma orders only
      // (distributor_id is not null AND no invoice number assigned yet)
      const { data, error } = await supabase
        .from("order_items")
        .select(`
          product_id,
          quantity,
          orders!inner (
            order_status,
            distributor_id,
            invoice_number_gst,
            invoice_number_non_gst
          )
        `)
        .not("orders.distributor_id", "is", null)
        .is("orders.invoice_number_gst", null)
        .is("orders.invoice_number_non_gst", null)
        .in("orders.order_status", ["pending", "confirmed", "processing", "shipped"])

      if (error) throw error

      // Aggregate quantities by product_id
      const quantitiesMap = new Map<string, number>()
      data?.forEach((item: any) => {
        const currentQty = quantitiesMap.get(item.product_id) || 0
        quantitiesMap.set(item.product_id, currentQty + item.quantity)
      })

      setOrderQuantities(quantitiesMap)
    } catch (error) {
      console.error("Error fetching order quantities:", error)
    }
  }

  const fetchFactoryWarehouseStock = async () => {
    try {
      const { data, error } = await supabase
        .from("factory_warehouse_stock")
        .select(`
          id,
          stock_inventory_id,
          product_id,
          quantity,
          min_stock_level,
          stock_inventory!inner (
            product_variants!inner (
              id,
              variant_name,
              category_id,
              product_categories!inner (
                name
              )
            )
          ),
          products!inner (
            name
          )
        `)

      if (error) throw error

      const transformed: FactoryWarehouseItem[] = (data || []).map((item: any) => ({
        id: item.id,
        stock_inventory_id: item.stock_inventory_id,
        product_id: item.product_id,
        quantity: item.quantity || 0,
        min_stock_level: item.min_stock_level || 0,
        variant_id: item.stock_inventory?.product_variants?.id || "",
        variant_name: item.stock_inventory?.product_variants?.variant_name || "Default",
        category_id: item.stock_inventory?.product_variants?.category_id || "",
        category_name: item.stock_inventory?.product_variants?.product_categories?.name || "Uncategorized",
        product_name: item.products?.name || "Unknown",
      }))

      setFactoryStock(transformed)
    } catch (error) {
      console.error("Error fetching factory warehouse stock:", error)
    }
  }

  const fetchStockData = async () => {
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
            name,
            material_type
          )
        `)
        .order("updated_at", { ascending: false })

      if (error) throw error

      // Transform the data to match our StockItem type
      // Filter out content materials (Ghee, oil) as they're tracked in loose_stock
      const transformedData: StockItem[] = (data || [])
        .filter((item: any) => item.packaging_materials.material_type !== 'content')
        .map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          min_stock: item.min_stock,
          price: item.price || 0,
          updated_at: item.updated_at,
          category: item.product_variants.product_categories.name,
          variant: item.product_variants.variant_name,
          material: item.packaging_materials.name,
          material_type: item.packaging_materials.material_type,
        }))

      setStockData(transformedData)
    } catch (error) {
      console.error("Error fetching stock data:", error)
      toast.error("Failed to fetch stock data")
    } finally {
      setLoading(false)
    }
  }

  const fetchManagementData = async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("product_categories")
        .select("*")
        .order("name")

      if (categoriesError) throw categoriesError
      setCategories(categoriesData || [])

      // Fetch variants with category names
      const { data: variantsData, error: variantsError } = await supabase
        .from("product_variants")
        .select(`
          id,
          variant_name,
          category_id,
          created_at,
          product_id,
          product_categories (
            name
          ),
          products (
            name,
            stock
          )
        `)
        .order("variant_name")

      if (variantsError) throw variantsError
      const transformedVariants = (variantsData || []).map((v: any) => ({
        id: v.id,
        category_id: v.category_id,
        variant_name: v.variant_name,
        category_name: v.product_categories?.name,
        created_at: v.created_at,
        product_id: v.product_id,
        product_name: v.products?.name,
        product_stock: v.products?.stock || 0,
      }))
      setVariants(transformedVariants)

      // Fetch materials
      const { data: materialsData, error: materialsError } = await supabase
        .from("packaging_materials")
        .select("*")
        .order("name")

      if (materialsError) throw materialsError
      setMaterials(materialsData || [])
    } catch (error) {
      console.error("Error fetching management data:", error)
      toast.error("Failed to fetch management data")
    }
  }

  const fetchComments = async (stockId: string) => {
    setLoadingComments(true)
    try {
      const { data, error } = await supabase
        .from("stock_comments")
        .select("*")
        .eq("stock_inventory_id", stockId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setStockComments(data || [])
    } catch (error) {
      console.error("Error fetching comments:", error)
      toast.error("Failed to fetch comments")
    } finally {
      setLoadingComments(false)
    }
  }

  const fetchAllComments = async () => {
    setLoadingAllComments(true)
    try {
      const { data, error } = await supabase
        .from("stock_comments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100) // Limit to last 100 comments for performance

      if (error) throw error

      // Map comments with stock item details
      const commentsWithStockInfo = (data || []).map((comment: any) => {
        const stockItem = stockData.find(item => item.id === comment.stock_inventory_id)
        return {
          ...comment,
          stock_item: stockItem
        }
      })

      setAllComments(commentsWithStockInfo)
    } catch (error) {
      console.error("Error fetching all comments:", error)
      toast.error("Failed to fetch comments")
    } finally {
      setLoadingAllComments(false)
    }
  }

  const handleViewAllComments = () => {
    setShowAllCommentsDialog(true)
    fetchAllComments()
  }

  const handleQuantityUpdate = async (id: string, newQuantity: number, commentText?: string) => {
    if (newQuantity < 0) {
      toast.error("Quantity cannot be negative")
      return
    }

    const item = stockData.find((i) => i.id === id)
    if (!item) return

    try {
      // Update stock quantity
      const { error: stockError } = await supabase
        .from("stock_inventory")
        .update({ quantity: newQuantity })
        .eq("id", id)

      if (stockError) throw stockError

      // Insert comment record
      const { error: commentError } = await supabase
        .from("stock_comments")
        .insert([{
          stock_inventory_id: id,
          user_id: currentUser?.id || null,
          user_email: currentUser?.email || null,
          previous_quantity: item.quantity,
          new_quantity: newQuantity,
          quantity_change: newQuantity - item.quantity,
          comment: commentText || null,
        }])

      if (commentError) throw commentError

      // Update local state
      setStockData((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, quantity: newQuantity, updated_at: new Date().toISOString() }
            : item
        )
      )
      toast.success("Stock quantity updated")
    } catch (error) {
      console.error("Error updating stock:", error)
      toast.error("Failed to update stock quantity")
    } finally {
      setEditingCell(null)
      setCommentDialogOpen(false)
      setComment("")
    }
  }

  const handleQuantityChange = (id: string, delta: number) => {
    const item = stockData.find((i) => i.id === id)
    if (!item) return

    const currentPending = pendingChanges.get(id) ?? item.quantity
    const newQuantity = Math.max(0, currentPending + delta)

    setPendingChanges(new Map(pendingChanges.set(id, newQuantity)))
  }

  const handleSaveClick = (item: StockItem) => {
    const newQuantity = pendingChanges.get(item.id)
    if (newQuantity === undefined || newQuantity === item.quantity) {
      toast.error("No changes to save")
      return
    }

    setCurrentStockItem(item)
    setPendingQuantity(newQuantity)
    setCommentDialogOpen(true)
  }

  const handleCancelChanges = (id: string) => {
    const newPending = new Map(pendingChanges)
    newPending.delete(id)
    setPendingChanges(newPending)
  }

  const handlePriceUpdate = async (id: string, newPrice: number) => {
    try {
      const { error } = await supabase
        .from("stock_inventory")
        .update({ price: newPrice })
        .eq("id", id)

      if (error) throw error

      // Update local state
      setStockData((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, price: newPrice, updated_at: new Date().toISOString() }
            : item
        )
      )
      toast.success("Price updated successfully")
    } catch (error) {
      console.error("Error updating price:", error)
      toast.error("Failed to update price")
    }
  }

  const handleMinStockUpdate = async (id: string, newMinStock: number) => {
    try {
      const { error } = await supabase
        .from("stock_inventory")
        .update({ min_stock: newMinStock })
        .eq("id", id)

      if (error) throw error

      // Update local state
      setStockData((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, min_stock: newMinStock, updated_at: new Date().toISOString() }
            : item
        )
      )
      toast.success("Minimum stock updated successfully")
    } catch (error) {
      console.error("Error updating minimum stock:", error)
      toast.error("Failed to update minimum stock")
    }
  }

  const handleCommentSubmit = () => {
    if (!comment.trim()) {
      toast.error("Comment is required")
      return
    }

    if (currentStockItem) {
      handleQuantityUpdate(currentStockItem.id, pendingQuantity, comment)
      // Clear pending change
      const newPending = new Map(pendingChanges)
      newPending.delete(currentStockItem.id)
      setPendingChanges(newPending)
    }
  }

  const handleViewComments = (item: StockItem) => {
    setCurrentStockItem(item)
    fetchComments(item.id)
    setShowCommentsDialog(true)
  }

  // Export functions
  const exportToCSV = () => {
    const headers = ["Category", "Variant", "Material", "Quantity", "Price", "Min Stock", "Status", "Last Updated"]
    const rows = filteredStock.map((item) => {
      const status = getStockStatus(item.quantity, item.min_stock)
      return [
        item.category,
        item.variant,
        item.material,
        item.quantity,
        item.price,
        item.min_stock,
        status.status === "out" ? "Out of Stock" : status.status === "low" ? "Low Stock" : "In Stock",
        new Date(item.updated_at).toLocaleDateString("en-IN"),
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `stock-inventory-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    toast.success("CSV exported successfully")
  }

  const exportToExcel = async () => {
    try {
      const XLSX = await import("xlsx")
      const headers = ["Category", "Variant", "Material", "Quantity", "Price", "Min Stock", "Status", "Last Updated"]
      const rows = filteredStock.map((item) => {
        const status = getStockStatus(item.quantity, item.min_stock)
        return {
          Category: item.category,
          Variant: item.variant,
          Material: item.material,
          Quantity: item.quantity,
          Price: item.price,
          "Min Stock": item.min_stock,
          Status: status.status === "out" ? "Out of Stock" : status.status === "low" ? "Low Stock" : "In Stock",
          "Last Updated": new Date(item.updated_at).toLocaleDateString("en-IN"),
        }
      })

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Inventory")
      XLSX.writeFile(workbook, `stock-inventory-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Excel file exported successfully")
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast.error("Failed to export Excel file")
    }
  }

  const exportToPDF = async () => {
    try {
      const jsPDF = (await import("jspdf")).default
      const autoTable = (await import("jspdf-autotable")).default

      const doc = new jsPDF()

      // Add title
      doc.setFontSize(18)
      doc.text("Factory Stock Inventory", 14, 20)

      // Add date
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN")}`, 14, 28)

      // Add summary
      doc.setFontSize(12)
      doc.text(`Total Items: ${stats.totalItems}`, 14, 36)
      doc.text(`In Stock: ${stats.inStock}`, 14, 42)
      doc.text(`Low Stock: ${stats.lowStock}`, 80, 42)
      doc.text(`Out of Stock: ${stats.outOfStock}`, 140, 42)

      // Prepare table data
      const headers = [["Category", "Variant", "Material", "Qty", "Price", "Min", "Status", "Updated"]]
      const rows = filteredStock.map((item) => {
        const status = getStockStatus(item.quantity, item.min_stock)
        return [
          item.category,
          item.variant,
          item.material,
          item.quantity,
          item.price,
          item.min_stock,
          status.status === "out" ? "Out" : status.status === "low" ? "Low" : "Good",
          new Date(item.updated_at).toLocaleDateString("en-IN"),
        ]
      })

      // Add table
      autoTable(doc, {
        head: headers,
        body: rows,
        startY: 50,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [71, 85, 105] },
      })

      doc.save(`stock-inventory-${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("PDF exported successfully")
    } catch (error) {
      console.error("Error exporting to PDF:", error)
      toast.error("Failed to export PDF")
    }
  }

  // Category management
  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Category name is required")
      return
    }

    setSaving(true)
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("product_categories")
          .update({ name: categoryName })
          .eq("id", editingCategory.id)

        if (error) throw error
        toast.success("Category updated successfully")
      } else {
        const { error } = await supabase
          .from("product_categories")
          .insert([{ name: categoryName }])

        if (error) throw error
        toast.success("Category created successfully")
      }

      setCategoryDialogOpen(false)
      setCategoryName("")
      setEditingCategory(null)
      fetchManagementData()
      fetchStockData()
    } catch (error: any) {
      console.error("Error saving category:", error)
      if (error.code === "23505") {
        toast.error("A category with this name already exists")
      } else {
        toast.error("Failed to save category")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return

    try {
      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", deletingCategory.id)

      if (error) throw error

      toast.success("Category deleted successfully")
      setDeletingCategory(null)
      fetchManagementData()
      fetchStockData()
    } catch (error: any) {
      console.error("Error deleting category:", error)
      if (error.code === "23503") {
        toast.error("Cannot delete category with existing variants")
      } else {
        toast.error("Failed to delete category")
      }
    }
  }

  // Variant management
  const handleSaveVariant = async () => {
    if (!variantName.trim() || !variantCategoryId) {
      toast.error("Variant name and category are required")
      return
    }

    setSaving(true)
    try {
      if (editingVariant) {
        const { error } = await supabase
          .from("product_variants")
          .update({
            variant_name: variantName,
            category_id: variantCategoryId,
          })
          .eq("id", editingVariant.id)

        if (error) throw error
        toast.success("Variant updated successfully")
      } else {
        const { error } = await supabase
          .from("product_variants")
          .insert([{
            variant_name: variantName,
            category_id: variantCategoryId,
          }])

        if (error) throw error
        toast.success("Variant created successfully")
      }

      setVariantDialogOpen(false)
      setVariantName("")
      setVariantCategoryId("")
      setEditingVariant(null)
      fetchManagementData()
      fetchStockData()
    } catch (error: any) {
      console.error("Error saving variant:", error)
      if (error.code === "23505") {
        toast.error("A variant with this name already exists for this category")
      } else {
        toast.error("Failed to save variant")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVariant = async () => {
    if (!deletingVariant) return

    try {
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", deletingVariant.id)

      if (error) throw error

      toast.success("Variant deleted successfully")
      setDeletingVariant(null)
      fetchManagementData()
      fetchStockData()
    } catch (error: any) {
      console.error("Error deleting variant:", error)
      if (error.code === "23503") {
        toast.error("Cannot delete variant with existing stock entries")
      } else {
        toast.error("Failed to delete variant")
      }
    }
  }

  // Material management
  const handleSaveMaterial = async () => {
    if (!materialName.trim()) {
      toast.error("Material name is required")
      return
    }

    setSaving(true)
    try {
      if (editingMaterial) {
        const { error } = await supabase
          .from("packaging_materials")
          .update({ name: materialName })
          .eq("id", editingMaterial.id)

        if (error) throw error
        toast.success("Material updated successfully")
      } else {
        const { error } = await supabase
          .from("packaging_materials")
          .insert([{ name: materialName }])

        if (error) throw error
        toast.success("Material created successfully")
      }

      setMaterialDialogOpen(false)
      setMaterialName("")
      setEditingMaterial(null)
      fetchManagementData()
      fetchStockData()
    } catch (error: any) {
      console.error("Error saving material:", error)
      if (error.code === "23505") {
        toast.error("A material with this name already exists")
      } else {
        toast.error("Failed to save material")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMaterial = async () => {
    if (!deletingMaterial) return

    try {
      const { error} = await supabase
        .from("packaging_materials")
        .delete()
        .eq("id", deletingMaterial.id)

      if (error) throw error

      toast.success("Material deleted successfully")
      setDeletingMaterial(null)
      fetchManagementData()
      fetchStockData()
    } catch (error: any) {
      console.error("Error deleting material:", error)
      if (error.code === "23503") {
        toast.error("Cannot delete material with existing stock entries")
      } else {
        toast.error("Failed to delete material")
      }
    }
  }

  const getStockStatus = (quantity: number, minStock: number): {
    status: string
    badge: "default" | "destructive" | "outline"
    icon: React.ComponentType<{ className?: string }>
  } => {
    if (quantity === 0) return { status: "out", badge: "destructive" as const, icon: TrendingDown }
    if (quantity < minStock) return { status: "low", badge: "outline" as const, icon: AlertTriangle }
    return { status: "good", badge: "default" as const, icon: TrendingUp }
  }

  // Get unique categories for filtering
  const uniqueCategories = Array.from(new Set(stockData.map((item) => item.category)))

  // Filter stock data
  const filteredStock = stockData.filter((item) => {
    const matchesSearch =
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.variant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.material.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  // Apply the "Hide empty (0-qty)" toggle for the All / Low / In views.
  // The Out-of-stock tab intentionally shows 0/negative rows, so it always
  // uses `filteredStock` directly and is never affected by `hideEmpty`.
  const visibleStock = hideEmpty
    ? filteredStock.filter((item) => item.quantity > 0)
    : filteredStock

  // Calculate statistics
  const stats = {
    totalItems: stockData.length,
    outOfStock: stockData.filter((item) => item.quantity === 0).length,
    lowStock: stockData.filter((item) => item.quantity > 0 && item.quantity < item.min_stock).length,
    inStock: stockData.filter((item) => item.quantity >= item.min_stock).length,
    totalQuantity: stockData.reduce((sum, item) => sum + item.quantity, 0),
    totalValue: stockData.reduce((sum, item) => sum + (item.quantity * item.price), 0),
  }

  // Calculate filtered totals
  const filteredTotals = {
    totalQuantity: filteredStock.reduce((sum, item) => sum + item.quantity, 0),
    totalValue: filteredStock.reduce((sum, item) => sum + (item.quantity * item.price), 0),
  }

  // Calculate category-specific totals (from factory warehouse stock)
  const categoryTotals = {
    buffaloGhee: factoryStock
      .filter((item) => item.category_name === "Buffalo Ghee")
      .reduce((sum, item) => sum + item.quantity, 0),
    cowGhee: factoryStock
      .filter((item) => item.category_name === "Cow Ghee")
      .reduce((sum, item) => sum + item.quantity, 0),
    cowBelonaGhee: factoryStock
      .filter((item) => item.category_name === "Valona Ghee")
      .reduce((sum, item) => sum + item.quantity, 0),
    groundnutOil: factoryStock
      .filter((item) => item.category_name === "Groundnut Oil")
      .reduce((sum, item) => sum + item.quantity, 0),
  }

  // Calculate variant breakdowns for each category (from factory warehouse stock)
  const getVariantBreakdown = (categoryName: string) => {
    const categoryItems = factoryStock.filter((item) => item.category_name === categoryName)
    const variantMap = new Map<string, { quantity: number; minStock: number; productName: string | null; orderQuantity: number; variantId: string; categoryId: string }>()

    categoryItems.forEach((item) => {
      const current = variantMap.get(item.variant_name) || { quantity: 0, minStock: 0, productName: null, orderQuantity: 0, variantId: item.variant_id, categoryId: item.category_id }

      // Get order quantity for this product
      const orderQty = orderQuantities.get(item.product_id) || 0

      variantMap.set(item.variant_name, {
        quantity: current.quantity + item.quantity,
        minStock: current.minStock + item.min_stock_level,
        productName: item.product_name,
        orderQuantity: orderQty,
        variantId: item.variant_id,
        categoryId: item.category_id,
      })
    })

    // Convert to array and sort by quantity (descending)
    return Array.from(variantMap.entries())
      .map(([variant, data]) => ({
        variant,
        quantity: data.quantity,
        minStock: data.minStock,
        productName: data.productName,
        productStock: data.quantity,
        orderQuantity: data.orderQuantity,
        variantId: data.variantId,
        categoryId: data.categoryId,
      }))
      .sort((a, b) => b.quantity - a.quantity)
  }

  // Function to convert variant to liters
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

  // Calculate total liters for a category (from factory warehouse stock)
  const getCategoryTotalLiters = (categoryName: string): number => {
    const categoryItems = factoryStock.filter((item) => item.category_name === categoryName)
    return categoryItems.reduce((total, item) => {
      return total + convertToLiters(item.variant_name, item.quantity)
    }, 0)
  }

  const categoryVariants = {
    buffaloGhee: getVariantBreakdown("Buffalo Ghee"),
    cowGhee: getVariantBreakdown("Cow Ghee"),
    cowBelonaGhee: getVariantBreakdown("Valona Ghee"),
    groundnutOil: getVariantBreakdown("Groundnut Oil"),
  }

  const categoryLiters = {
    buffaloGhee: getCategoryTotalLiters("Buffalo Ghee"),
    cowGhee: getCategoryTotalLiters("Cow Ghee"),
    cowBelonaGhee: getCategoryTotalLiters("Valona Ghee"),
    groundnutOil: getCategoryTotalLiters("Groundnut Oil"),
  }

  // Calculate order totals per category
  const categoryOrderTotals = {
    buffaloGhee: categoryVariants.buffaloGhee.reduce((sum, v) => sum + v.orderQuantity, 0),
    cowGhee: categoryVariants.cowGhee.reduce((sum, v) => sum + v.orderQuantity, 0),
    cowBelonaGhee: categoryVariants.cowBelonaGhee.reduce((sum, v) => sum + v.orderQuantity, 0),
    groundnutOil: categoryVariants.groundnutOil.reduce((sum, v) => sum + v.orderQuantity, 0),
  }

  // Get loose stock by category name
  const getLooseStockByCategory = (categoryName: string): LooseStock | undefined => {
    return looseStocks.find((ls) => ls.product_categories.name === categoryName)
  }

  const looseStockByCategory = {
    buffaloGhee: getLooseStockByCategory("Buffalo Ghee"),
    cowGhee: getLooseStockByCategory("Cow Ghee"),
    cowBelonaGhee: getLooseStockByCategory("Valona Ghee"),
    groundnutOil: getLooseStockByCategory("Groundnut Oil"),
  }

  // Calculate total stock (loose + package) in liters
  const totalStockLiters = {
    cowGhee: (looseStockByCategory.cowGhee?.quantity_liters || 0) + categoryLiters.cowGhee,
    buffaloGhee: (looseStockByCategory.buffaloGhee?.quantity_liters || 0) + categoryLiters.buffaloGhee,
    cowBelonaGhee: (looseStockByCategory.cowBelonaGhee?.quantity_liters || 0) + categoryLiters.cowBelonaGhee,
    groundnutOil: (looseStockByCategory.groundnutOil?.quantity_liters || 0) + categoryLiters.groundnutOil,
  }

  // Calculate loose stock value (quantity × price_per_liter)
  const looseStockValue = {
    cowGhee: (looseStockByCategory.cowGhee?.quantity_liters || 0) * (looseStockByCategory.cowGhee?.price_per_liter || 0),
    buffaloGhee: (looseStockByCategory.buffaloGhee?.quantity_liters || 0) * (looseStockByCategory.buffaloGhee?.price_per_liter || 0),
    cowBelonaGhee: (looseStockByCategory.cowBelonaGhee?.quantity_liters || 0) * (looseStockByCategory.cowBelonaGhee?.price_per_liter || 0),
    groundnutOil: (looseStockByCategory.groundnutOil?.quantity_liters || 0) * (looseStockByCategory.groundnutOil?.price_per_liter || 0),
  }

  // Calculate min stock needed for loose stock (deficit)
  const looseStockDeficit = {
    cowGhee: Math.max(0, (looseStockByCategory.cowGhee?.min_stock_liters || 0) - (looseStockByCategory.cowGhee?.quantity_liters || 0)),
    buffaloGhee: Math.max(0, (looseStockByCategory.buffaloGhee?.min_stock_liters || 0) - (looseStockByCategory.buffaloGhee?.quantity_liters || 0)),
    cowBelonaGhee: Math.max(0, (looseStockByCategory.cowBelonaGhee?.min_stock_liters || 0) - (looseStockByCategory.cowBelonaGhee?.quantity_liters || 0)),
    groundnutOil: Math.max(0, (looseStockByCategory.groundnutOil?.min_stock_liters || 0) - (looseStockByCategory.groundnutOil?.quantity_liters || 0)),
  }

  // Calculate purchase amount needed (deficit × price_per_liter)
  const looseStockPurchaseAmount = {
    cowGhee: looseStockDeficit.cowGhee * (looseStockByCategory.cowGhee?.price_per_liter || 0),
    buffaloGhee: looseStockDeficit.buffaloGhee * (looseStockByCategory.buffaloGhee?.price_per_liter || 0),
    cowBelonaGhee: looseStockDeficit.cowBelonaGhee * (looseStockByCategory.cowBelonaGhee?.price_per_liter || 0),
    groundnutOil: looseStockDeficit.groundnutOil * (looseStockByCategory.groundnutOil?.price_per_liter || 0),
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Package className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Factory Stock Inventory</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Package className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Factory Stock Inventory</h1>
            <p className="text-sm text-muted-foreground">
              Manage ghee and oil products with packaging materials
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button
            onClick={handleViewAllComments}
            variant="outline"
            size="sm"
            className="h-8"
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Comments</span>
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm" className="h-8">
            <Download className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          <Button onClick={exportToExcel} variant="outline" size="sm" className="h-8">
            <Download className="mr-1.5 h-4 w-4" />
            Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm" className="h-8">
            <Download className="mr-1.5 h-4 w-4" />
            PDF
          </Button>
          <Button
            onClick={() => {
              setManageDialogOpen(true)
              fetchManagementData()
            }}
            variant="outline"
            size="sm"
            className="h-8"
          >
            <Settings className="mr-1.5 h-4 w-4" />
            <span className="hidden md:inline">Manage Setup</span>
            <span className="md:hidden">Setup</span>
          </Button>
          <Button
            onClick={() => router.push("/dashboard/stock/factory-warehouse")}
            variant="outline"
            size="sm"
            className="h-8"
          >
            <Package className="mr-1.5 h-4 w-4" />
            <span className="hidden md:inline">Factory Warehouse</span>
            <span className="md:hidden">Warehouse</span>
          </Button>
          <Button
            onClick={() => router.push("/dashboard/stock/dispatch")}
            size="sm"
            className="h-8"
          >
            <Truck className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Dispatch to Warehouse</span>
            <span className="sm:hidden">Dispatch</span>
          </Button>
        </div>
      </div>



      {/* Summary Cards - Total stock per category (loose + packed) with purchase value */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[
          { key: 'cowGhee' as const, label: 'Cow Ghee', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { key: 'buffaloGhee' as const, label: 'Buffalo Ghee', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
          { key: 'cowBelonaGhee' as const, label: 'Valona Ghee', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
          { key: 'groundnutOil' as const, label: 'Groundnut Oil', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
        ].map(({ key, label, color, bg }) => {
          const looseLiters = looseStockByCategory[key]?.quantity_liters || 0
          const packedLiters = categoryLiters[key]
          const totalLiters = looseLiters + packedLiters
          const purchaseRate = looseStockByCategory[key]?.price_per_liter || 0
          const totalValue = totalLiters * purchaseRate
          return (
            <Card key={key} className={`${bg} gap-0 py-0`}>
              <CardContent className="py-3 px-4">
                <p className={`text-xs font-semibold ${color} mb-1`}>{label}</p>
                <p className="text-lg font-bold">{totalLiters.toFixed(1)} L</p>
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <p>Loose: {looseLiters.toFixed(1)} L</p>
                  <p>Packed: {packedLiters.toFixed(1)} L</p>
                </div>
                <p className="text-sm font-semibold mt-1">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-[10px] text-muted-foreground">@ ₹{purchaseRate.toFixed(0)}/L (purchase)</p>
              </CardContent>
            </Card>
          )
        })}
        {/* 5th card - Grand Total */}
        {(() => {
          const keys = ['cowGhee', 'buffaloGhee', 'cowBelonaGhee', 'groundnutOil'] as const
          const grandTotalLiters = keys.reduce((sum, key) => {
            return sum + (looseStockByCategory[key]?.quantity_liters || 0) + categoryLiters[key]
          }, 0)
          const grandTotalValue = keys.reduce((sum, key) => {
            const looseLiters = looseStockByCategory[key]?.quantity_liters || 0
            const packedLiters = categoryLiters[key]
            const purchaseRate = looseStockByCategory[key]?.price_per_liter || 0
            return sum + ((looseLiters + packedLiters) * purchaseRate)
          }, 0)
          return (
            <Card className="bg-blue-50 border-blue-200 gap-0 py-0 col-span-2 lg:col-span-1">
              <CardContent className="py-3 px-4">
                <p className="text-xs font-semibold text-blue-700 mb-1">Grand Total</p>
                <p className="text-lg font-bold">{grandTotalLiters.toFixed(1)} L</p>
                <p className="text-sm font-semibold mt-1">₹{grandTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Purchase value (all categories)</p>
              </CardContent>
            </Card>
          )
        })()}
      </div>

      {/* Category-Specific Quantities */}
      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium">Cow Ghee</CardTitle>
            <div className="text-sm flex items-center gap-2">
              {looseStockByCategory.cowGhee && looseStockByCategory.cowGhee.min_stock_liters &&
               looseStockByCategory.cowGhee.quantity_liters < looseStockByCategory.cowGhee.min_stock_liters && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-red-600 cursor-help">
                        -{(looseStockByCategory.cowGhee.min_stock_liters - looseStockByCategory.cowGhee.quantity_liters).toFixed(2)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Loose stock deficit - liters needed to reach minimum</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-muted-foreground">|</span>
                </>
              )}
              <span className="text-muted-foreground">Loose Stock: </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-semibold text-orange-600 cursor-help">
                    {looseStockByCategory.cowGhee
                      ? `${looseStockByCategory.cowGhee.quantity_liters.toFixed(2)} L`
                      : '0.00 L'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current loose stock available in liters</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 pb-2 border-b space-y-1">
              {/* Total Stock (Loose + Package) */}
              <div className="flex justify-between text-sm bg-accent/30 rounded px-2 py-1.5">
                <span className="font-semibold">Total Stock:</span>
                <span className="font-bold text-lg">{totalStockLiters.cowGhee.toFixed(2)} L</span>
              </div>
              {/* Loose Stock with Amount */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Loose Stock:</span>
                <div className="text-right">
                  <span className="font-semibold text-orange-600">{looseStockByCategory.cowGhee?.quantity_liters.toFixed(2) || '0.00'} L</span>
                  <span className="text-muted-foreground ml-2">(₹{looseStockValue.cowGhee.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                </div>
              </div>
              {/* Loose Stock Min Needed */}
              {looseStockDeficit.cowGhee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Loose Min Needed:</span>
                  <div className="text-right">
                    <span className="font-semibold text-red-600">-{looseStockDeficit.cowGhee.toFixed(2)} L</span>
                    <span className="text-red-600 ml-2">(₹{looseStockPurchaseAmount.cowGhee.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                  </div>
                </div>
              )}
              {/* Packaged Stock */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Packaged:</span>
                <div className="text-right">
                  <span className="font-bold text-primary">{categoryLiters.cowGhee.toFixed(2)} L</span>
                  <span className="text-muted-foreground ml-2">({categoryTotals.cowGhee} pcs)</span>
                </div>
              </div>
              {(() => {
                const totalNeeded = categoryVariants.cowGhee.reduce((sum, { minStock, quantity }) => {
                  const needed = Math.max(0, minStock - quantity)
                  return sum + needed
                }, 0)
                return totalNeeded > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Package Min Needed:</span>
                    <span className="font-medium text-red-600">-{totalNeeded} pcs</span>
                  </div>
                ) : null
              })()}
              <div className="flex justify-between text-sm hidden">
                <span className="text-muted-foreground font-medium">Orders:</span>
                <span className="font-bold text-green-600">{categoryOrderTotals.cowGhee} Units</span>
              </div>
            </div>
            <div className="space-y-0 rounded-md border overflow-hidden">
              {/* Table Header */}
              <div className="flex justify-between bg-muted text-[10px] uppercase tracking-widest text-foreground font-bold border-b">
                <div className="flex-1 py-1.5 px-2">Variant</div>
                <div className="flex items-stretch">
                  <div className="w-20 text-right py-1 px-2 border-l">Orders</div>
                  <div className="w-20 text-right py-1 px-2 border-l tabular-nums text-[10px]">Order - Needed</div>
                  <div className="w-20 text-right py-1 px-2 border-l">Min</div>
                  <div className="w-20 text-right py-1 px-2 border-l tabular-nums text-[10px]">Min - Stock</div>
                  <div className="w-20 text-right py-1 px-2 border-l">Actual</div>
                </div>
              </div>
              {categoryVariants.cowGhee.map(({ variant, quantity, minStock, orderQuantity, variantId, categoryId }, index) => {
                const needed = Math.max(0, orderQuantity - quantity)
                return (
                  <div
                    key={variant}
                    className="flex justify-between text-sm border-b last:border-0 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                    onClick={() => router.push(`/dashboard/main-stock/transfer?categoryId=${categoryId}&variantId=${variantId}`)}
                    title="Click to transfer"
                  >
                    <div className="text-muted-foreground flex-1 py-1.5 px-1">{variant}</div>
                    <div className="flex items-stretch">
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums ${orderQuantity > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {orderQuantity > 0 ? orderQuantity : '-'}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums ${needed > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {needed > 0 ? `-${needed}` : '-'}
                      </div>
                      <div className="w-20 text-right py-1.5 px-2 border-l tabular-nums text-muted-foreground">
                        {minStock > 0 ? minStock : '-'}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums font-semibold ${(minStock - quantity) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {minStock - quantity}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums font-semibold ${quantity === 0 ? 'text-red-500' : ''}`}>
                        {quantity}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Cow Ghee stock overview - shows loose stock, packaged quantity, and pending orders</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium">Buffalo Ghee</CardTitle>
            <div className="text-sm flex items-center gap-2">
              {looseStockByCategory.buffaloGhee && looseStockByCategory.buffaloGhee.min_stock_liters &&
               looseStockByCategory.buffaloGhee.quantity_liters < looseStockByCategory.buffaloGhee.min_stock_liters && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-red-600 cursor-help">
                        -{(looseStockByCategory.buffaloGhee.min_stock_liters - looseStockByCategory.buffaloGhee.quantity_liters).toFixed(2)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Loose stock deficit - liters needed to reach minimum</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-muted-foreground">|</span>
                </>
              )}
              <span className="text-muted-foreground">Loose Stock: </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-semibold text-orange-600 cursor-help">
                    {looseStockByCategory.buffaloGhee
                      ? `${looseStockByCategory.buffaloGhee.quantity_liters.toFixed(2)} L`
                      : '0.00 L'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current loose stock available in liters</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 pb-2 border-b space-y-1">
              {/* Total Stock (Loose + Package) */}
              <div className="flex justify-between text-sm bg-accent/30 rounded px-2 py-1.5">
                <span className="font-semibold">Total Stock:</span>
                <span className="font-bold text-lg">{totalStockLiters.buffaloGhee.toFixed(2)} L</span>
              </div>
              {/* Loose Stock with Amount */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Loose Stock:</span>
                <div className="text-right">
                  <span className="font-semibold text-orange-600">{looseStockByCategory.buffaloGhee?.quantity_liters.toFixed(2) || '0.00'} L</span>
                  <span className="text-muted-foreground ml-2">(₹{looseStockValue.buffaloGhee.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                </div>
              </div>
              {/* Loose Stock Min Needed */}
              {looseStockDeficit.buffaloGhee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Loose Min Needed:</span>
                  <div className="text-right">
                    <span className="font-semibold text-red-600">-{looseStockDeficit.buffaloGhee.toFixed(2)} L</span>
                    <span className="text-red-600 ml-2">(₹{looseStockPurchaseAmount.buffaloGhee.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                  </div>
                </div>
              )}
              {/* Packaged Stock */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Packaged:</span>
                <div className="text-right">
                  <span className="font-bold text-primary">{categoryLiters.buffaloGhee.toFixed(2)} L</span>
                  <span className="text-muted-foreground ml-2">({categoryTotals.buffaloGhee} pcs)</span>
                </div>
              </div>
              {(() => {
                const totalNeeded = categoryVariants.buffaloGhee.reduce((sum, { minStock, quantity }) => {
                  const needed = Math.max(0, minStock - quantity)
                  return sum + needed
                }, 0)
                return totalNeeded > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Package Min Needed:</span>
                    <span className="font-medium text-red-600">-{totalNeeded} pcs</span>
                  </div>
                ) : null
              })()}
              <div className="flex justify-between text-sm hidden">
                <span className="text-muted-foreground font-medium">Orders:</span>
                <span className="font-bold text-green-600">{categoryOrderTotals.buffaloGhee} Units</span>
              </div>
            </div>
            <div className="space-y-0 rounded-md border overflow-hidden">
              {/* Table Header */}
              <div className="flex justify-between bg-muted text-[10px] uppercase tracking-widest text-foreground font-bold border-b">
                <div className="flex-1 py-1.5 px-2">Variant</div>
                <div className="flex items-stretch">
                  <div className="w-20 text-right py-1 px-2 border-l">Orders</div>
                  <div className="w-20 text-right py-1 px-2 border-l tabular-nums text-[10px]">Order - Needed</div>
                  <div className="w-20 text-right py-1 px-2 border-l">Min</div>
                  <div className="w-20 text-right py-1 px-2 border-l tabular-nums text-[10px]">Min - Stock</div>
                  <div className="w-20 text-right py-1 px-2 border-l">Actual</div>
                </div>
              </div>
              {categoryVariants.buffaloGhee.map(({ variant, quantity, minStock, orderQuantity, variantId, categoryId }, index) => {
                const needed = Math.max(0, orderQuantity - quantity)
                return (
                  <div
                    key={variant}
                    className="flex justify-between text-sm border-b last:border-0 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                    onClick={() => router.push(`/dashboard/main-stock/transfer?categoryId=${categoryId}&variantId=${variantId}`)}
                    title="Click to transfer"
                  >
                    <div className="text-muted-foreground flex-1 py-1.5 px-1">{variant}</div>
                    <div className="flex items-stretch">
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums ${orderQuantity > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {orderQuantity > 0 ? orderQuantity : '-'}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums ${needed > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {needed > 0 ? `-${needed}` : '-'}
                      </div>
                      <div className="w-20 text-right py-1.5 px-2 border-l tabular-nums text-muted-foreground">
                        {minStock > 0 ? minStock : '-'}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums font-semibold ${(minStock - quantity) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {minStock - quantity}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums font-semibold ${quantity === 0 ? 'text-red-500' : ''}`}>
                        {quantity}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Buffalo Ghee stock overview - shows loose stock, packaged quantity, and pending orders</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium">Cow Valona Ghee</CardTitle>
            <div className="text-sm flex items-center gap-2">
              {looseStockByCategory.cowBelonaGhee && looseStockByCategory.cowBelonaGhee.min_stock_liters &&
               looseStockByCategory.cowBelonaGhee.quantity_liters < looseStockByCategory.cowBelonaGhee.min_stock_liters && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-red-600 cursor-help">
                        -{(looseStockByCategory.cowBelonaGhee.min_stock_liters - looseStockByCategory.cowBelonaGhee.quantity_liters).toFixed(2)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Loose stock deficit - liters needed to reach minimum</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-muted-foreground">|</span>
                </>
              )}
              <span className="text-muted-foreground">Loose Stock: </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-semibold text-orange-600 cursor-help">
                    {looseStockByCategory.cowBelonaGhee
                      ? `${looseStockByCategory.cowBelonaGhee.quantity_liters.toFixed(2)} L`
                      : '0.00 L'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current loose stock available in liters</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 pb-2 border-b space-y-1">
              {/* Total Stock (Loose + Package) */}
              <div className="flex justify-between text-sm bg-accent/30 rounded px-2 py-1.5">
                <span className="font-semibold">Total Stock:</span>
                <span className="font-bold text-lg">{totalStockLiters.cowBelonaGhee.toFixed(2)} L</span>
              </div>
              {/* Loose Stock with Amount */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Loose Stock:</span>
                <div className="text-right">
                  <span className="font-semibold text-orange-600">{looseStockByCategory.cowBelonaGhee?.quantity_liters.toFixed(2) || '0.00'} L</span>
                  <span className="text-muted-foreground ml-2">(₹{looseStockValue.cowBelonaGhee.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                </div>
              </div>
              {/* Loose Stock Min Needed */}
              {looseStockDeficit.cowBelonaGhee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Loose Min Needed:</span>
                  <div className="text-right">
                    <span className="font-semibold text-red-600">-{looseStockDeficit.cowBelonaGhee.toFixed(2)} L</span>
                    <span className="text-red-600 ml-2">(₹{looseStockPurchaseAmount.cowBelonaGhee.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                  </div>
                </div>
              )}
              {/* Packaged Stock */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Packaged:</span>
                <div className="text-right">
                  <span className="font-bold text-primary">{categoryLiters.cowBelonaGhee.toFixed(2)} L</span>
                  <span className="text-muted-foreground ml-2">({categoryTotals.cowBelonaGhee} pcs)</span>
                </div>
              </div>
              {(() => {
                const totalNeeded = categoryVariants.cowBelonaGhee.reduce((sum, { minStock, quantity }) => {
                  const needed = Math.max(0, minStock - quantity)
                  return sum + needed
                }, 0)
                return totalNeeded > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Package Min Needed:</span>
                    <span className="font-medium text-red-600">-{totalNeeded} pcs</span>
                  </div>
                ) : null
              })()}
              <div className="flex justify-between text-sm hidden">
                <span className="text-muted-foreground font-medium">Orders:</span>
                <span className="font-bold text-green-600">{categoryOrderTotals.cowBelonaGhee} Units</span>
              </div>
            </div>
            <div className="space-y-0 rounded-md border overflow-hidden">
              {/* Table Header */}
              <div className="flex justify-between bg-muted text-[10px] uppercase tracking-widest text-foreground font-bold border-b">
                <div className="flex-1 py-1.5 px-2">Variant</div>
                <div className="flex items-stretch">
                  <div className="w-20 text-right py-1 px-2 border-l">Orders</div>
                  <div className="w-20 text-right py-1 px-2 border-l tabular-nums text-[10px]">Order - Needed</div>
                  <div className="w-20 text-right py-1 px-2 border-l">Min</div>
                  <div className="w-20 text-right py-1 px-2 border-l tabular-nums text-[10px]">Min - Stock</div>
                  <div className="w-20 text-right py-1 px-2 border-l">Actual</div>
                </div>
              </div>
              {categoryVariants.cowBelonaGhee.map(({ variant, quantity, minStock, orderQuantity, variantId, categoryId }, index) => {
                const needed = Math.max(0, orderQuantity - quantity)
                return (
                  <div
                    key={variant}
                    className="flex justify-between text-sm border-b last:border-0 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                    onClick={() => router.push(`/dashboard/main-stock/transfer?categoryId=${categoryId}&variantId=${variantId}`)}
                    title="Click to transfer"
                  >
                    <div className="text-muted-foreground flex-1 py-1.5 px-1">{variant}</div>
                    <div className="flex items-stretch">
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums ${orderQuantity > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {orderQuantity > 0 ? orderQuantity : '-'}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums ${needed > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {needed > 0 ? `-${needed}` : '-'}
                      </div>
                      <div className="w-20 text-right py-1.5 px-2 border-l tabular-nums text-muted-foreground">
                        {minStock > 0 ? minStock : '-'}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums font-semibold ${(minStock - quantity) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {minStock - quantity}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums font-semibold ${quantity === 0 ? 'text-red-500' : ''}`}>
                        {quantity}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Cow Valona Ghee stock overview - shows loose stock, packaged quantity, and pending orders</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium">Groundnut Oil</CardTitle>
            <div className="text-sm flex items-center gap-2">
              {looseStockByCategory.groundnutOil && looseStockByCategory.groundnutOil.min_stock_liters &&
               looseStockByCategory.groundnutOil.quantity_liters < looseStockByCategory.groundnutOil.min_stock_liters && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-red-600 cursor-help">
                        -{(looseStockByCategory.groundnutOil.min_stock_liters - looseStockByCategory.groundnutOil.quantity_liters).toFixed(2)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Loose stock deficit - liters needed to reach minimum</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-muted-foreground">|</span>
                </>
              )}
              <span className="text-muted-foreground">Loose Stock: </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-semibold text-orange-600 cursor-help">
                    {looseStockByCategory.groundnutOil
                      ? `${looseStockByCategory.groundnutOil.quantity_liters.toFixed(2)} L`
                      : '0.00 L'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current loose stock available in liters</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 pb-2 border-b space-y-1">
              {/* Total Stock (Loose + Package) */}
              <div className="flex justify-between text-sm bg-accent/30 rounded px-2 py-1.5">
                <span className="font-semibold">Total Stock:</span>
                <span className="font-bold text-lg">{totalStockLiters.groundnutOil.toFixed(2)} L</span>
              </div>
              {/* Loose Stock with Amount */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Loose Stock:</span>
                <div className="text-right">
                  <span className="font-semibold text-orange-600">{looseStockByCategory.groundnutOil?.quantity_liters.toFixed(2) || '0.00'} L</span>
                  <span className="text-muted-foreground ml-2">(₹{looseStockValue.groundnutOil.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                </div>
              </div>
              {/* Loose Stock Min Needed */}
              {looseStockDeficit.groundnutOil > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Loose Min Needed:</span>
                  <div className="text-right">
                    <span className="font-semibold text-red-600">-{looseStockDeficit.groundnutOil.toFixed(2)} L</span>
                    <span className="text-red-600 ml-2">(₹{looseStockPurchaseAmount.groundnutOil.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                  </div>
                </div>
              )}
              {/* Packaged Stock */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Packaged:</span>
                <div className="text-right">
                  <span className="font-bold text-primary">{categoryLiters.groundnutOil.toFixed(2)} L</span>
                  <span className="text-muted-foreground ml-2">({categoryTotals.groundnutOil} pcs)</span>
                </div>
              </div>
              {(() => {
                const totalNeeded = categoryVariants.groundnutOil.reduce((sum, { minStock, quantity }) => {
                  const needed = Math.max(0, minStock - quantity)
                  return sum + needed
                }, 0)
                return totalNeeded > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Package Min Needed:</span>
                    <span className="font-medium text-red-600">-{totalNeeded} pcs</span>
                  </div>
                ) : null
              })()}
              <div className="flex justify-between text-sm hidden">
                <span className="text-muted-foreground font-medium">Orders:</span>
                <span className="font-bold text-green-600">{categoryOrderTotals.groundnutOil} Units</span>
              </div>
            </div>
            <div className="space-y-0 rounded-md border overflow-hidden">
              {/* Table Header */}
              <div className="flex justify-between bg-muted text-[10px] uppercase tracking-widest text-foreground font-bold border-b">
                <div className="flex-1 py-1.5 px-2">Variant</div>
                <div className="flex items-stretch">
                  <div className="w-20 text-right py-1 px-2 border-l">Orders</div>
                  <div className="w-20 text-right py-1 px-2 border-l tabular-nums text-[10px]">Order - Needed</div>
                  <div className="w-20 text-right py-1 px-2 border-l">Min</div>
                  <div className="w-20 text-right py-1 px-2 border-l tabular-nums text-[10px]">Min - Stock</div>
                  <div className="w-20 text-right py-1 px-2 border-l">Actual</div>
                </div>
              </div>
              {categoryVariants.groundnutOil.map(({ variant, quantity, minStock, orderQuantity, variantId, categoryId }, index) => {
                const needed = Math.max(0, orderQuantity - quantity)
                return (
                  <div
                    key={variant}
                    className="flex justify-between text-sm border-b last:border-0 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                    onClick={() => router.push(`/dashboard/main-stock/transfer?categoryId=${categoryId}&variantId=${variantId}`)}
                    title="Click to transfer"
                  >
                    <div className="text-muted-foreground flex-1 py-1.5 px-1">{variant}</div>
                    <div className="flex items-stretch">
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums ${orderQuantity > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {orderQuantity > 0 ? orderQuantity : '-'}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums ${needed > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {needed > 0 ? `-${needed}` : '-'}
                      </div>
                      <div className="w-20 text-right py-1.5 px-2 border-l tabular-nums text-muted-foreground">
                        {minStock > 0 ? minStock : '-'}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums font-semibold ${(minStock - quantity) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {minStock - quantity}
                      </div>
                      <div className={`w-20 text-right py-1.5 px-2 border-l tabular-nums font-semibold ${quantity === 0 ? 'text-red-500' : ''}`}>
                        {quantity}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Groundnut Oil stock overview - shows loose stock, packaged quantity, and pending orders</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Inventory</CardTitle>
          <CardDescription>
            Track all products and packaging materials inventory
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Input
              placeholder="Search by category, variant, or material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                onClick={() => setSelectedCategory("all")}
                size="sm"
              >
                All
              </Button>
              {uniqueCategories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                >
                  {category}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Checkbox
                id="hide-empty"
                checked={hideEmpty}
                onCheckedChange={(c) => setHideEmpty(c as boolean)}
              />
              <Label htmlFor="hide-empty" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                Hide empty (0-qty) items
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger value="all" className="flex-col sm:flex-row gap-1 py-2 data-[state=active]:bg-background">
                <span>All Items</span>
                <Badge variant="secondary" className="rounded-full text-[10px] h-4 px-1.5">
                  {visibleStock.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="low" className="flex-col sm:flex-row gap-1 py-2 data-[state=active]:bg-background">
                <span>Low Stock</span>
                <Badge variant="secondary" className="rounded-full text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  {visibleStock.filter((item) => item.quantity > 0 && item.quantity < item.min_stock).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="out" className="flex-col sm:flex-row gap-1 py-2 data-[state=active]:bg-background">
                <span>Out of Stock</span>
                <Badge variant="secondary" className="rounded-full text-[10px] h-4 px-1.5 bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                  {filteredStock.filter((item) => item.quantity === 0).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="good" className="flex-col sm:flex-row gap-1 py-2 data-[state=active]:bg-background">
                <span>In Stock</span>
                <Badge variant="secondary" className="rounded-full text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {visibleStock.filter((item) => item.quantity >= item.min_stock).length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <StockTable
                data={visibleStock}
                editingCell={editingCell}
                setEditingCell={setEditingCell}
                onQuantityUpdate={handleQuantityUpdate}
                onQuantityChange={handleQuantityChange}
                onViewComments={handleViewComments}
                onSaveClick={handleSaveClick}
                onCancelChanges={handleCancelChanges}
                onPriceUpdate={handlePriceUpdate}
                onMinStockUpdate={handleMinStockUpdate}
                pendingChanges={pendingChanges}
                getStockStatus={getStockStatus}
              />
            </TabsContent>

            <TabsContent value="low" className="mt-4">
              <StockTable
                data={visibleStock.filter((item) => item.quantity > 0 && item.quantity < item.min_stock)}
                editingCell={editingCell}
                setEditingCell={setEditingCell}
                onQuantityUpdate={handleQuantityUpdate}
                onQuantityChange={handleQuantityChange}
                onViewComments={handleViewComments}
                onSaveClick={handleSaveClick}
                onCancelChanges={handleCancelChanges}
                onPriceUpdate={handlePriceUpdate}
                onMinStockUpdate={handleMinStockUpdate}
                pendingChanges={pendingChanges}
                getStockStatus={getStockStatus}
              />
            </TabsContent>

            <TabsContent value="out" className="mt-4">
              <StockTable
                data={filteredStock.filter((item) => item.quantity === 0)}
                editingCell={editingCell}
                setEditingCell={setEditingCell}
                onQuantityUpdate={handleQuantityUpdate}
                onQuantityChange={handleQuantityChange}
                onViewComments={handleViewComments}
                onSaveClick={handleSaveClick}
                onCancelChanges={handleCancelChanges}
                onPriceUpdate={handlePriceUpdate}
                onMinStockUpdate={handleMinStockUpdate}
                pendingChanges={pendingChanges}
                getStockStatus={getStockStatus}
              />
            </TabsContent>

            <TabsContent value="good" className="mt-4">
              <StockTable
                data={visibleStock.filter((item) => item.quantity >= item.min_stock)}
                editingCell={editingCell}
                setEditingCell={setEditingCell}
                onQuantityUpdate={handleQuantityUpdate}
                onQuantityChange={handleQuantityChange}
                onViewComments={handleViewComments}
                onSaveClick={handleSaveClick}
                onCancelChanges={handleCancelChanges}
                onPriceUpdate={handlePriceUpdate}
                onMinStockUpdate={handleMinStockUpdate}
                pendingChanges={pendingChanges}
                getStockStatus={getStockStatus}
              />
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {visibleStock.length} of {filteredStock.length} items
            {hideEmpty && filteredStock.length > visibleStock.length && (
              <> ({filteredStock.length - visibleStock.length} empty hidden)</>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <TooltipProvider>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="h-full">
                <CardHeader>
                  <CardDescription>Total Items</CardDescription>
                  <CardTitle className="text-2xl font-bold tabular-nums">{stats.totalItems}</CardTitle>
                  <CardAction>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Package className="h-4 w-4" />
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Unique SKUs</CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Total number of unique stock items tracked in inventory</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
                <CardHeader>
                  <CardDescription>In Stock</CardDescription>
                  <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{stats.inStock}</CardTitle>
                  <CardAction>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Items above minimum</CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Items with quantity above minimum stock level</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push('/dashboard/stock/low-stock')}
              >
                <CardHeader>
                  <CardDescription>Low Stock</CardDescription>
                  <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{stats.lowStock}</CardTitle>
                  <CardAction>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Below minimum • Click to view</CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Items running low - below minimum threshold but not out of stock. Click to view details.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40 cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push('/dashboard/stock/low-stock')}
              >
                <CardHeader>
                  <CardDescription>Out of Stock</CardDescription>
                  <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{stats.outOfStock}</CardTitle>
                  <CardAction>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                      <TrendingDown className="h-4 w-4" />
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Require restocking • Click to view</CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Items completely out of stock - require immediate restocking. Click to view details.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Management Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Stock Setup</DialogTitle>
            <DialogDescription>
              Add, edit, or delete categories, variants, and packaging materials
            </DialogDescription>
          </DialogHeader>

          <Tabs value={manageTab} onValueChange={(v) => setManageTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
            </TabsList>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {categories.length} categories
                </p>
                <Button
                  onClick={() => {
                    setEditingCategory(null)
                    setCategoryName("")
                    setCategoryDialogOpen(true)
                  }}
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>
                          {new Date(category.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingCategory(category)
                                setCategoryName(category.name)
                                setCategoryDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingCategory(category)}
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
            </TabsContent>

            {/* Variants Tab */}
            <TabsContent value="variants" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {variants.length} variants
                </p>
                <Button
                  onClick={() => {
                    setEditingVariant(null)
                    setVariantName("")
                    setVariantCategoryId("")
                    setVariantDialogOpen(true)
                  }}
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variant
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-medium">{variant.variant_name}</TableCell>
                        <TableCell>{variant.category_name}</TableCell>
                        <TableCell>
                          {new Date(variant.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingVariant(variant)
                                setVariantName(variant.variant_name)
                                setVariantCategoryId(variant.category_id)
                                setVariantDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingVariant(variant)}
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
            </TabsContent>

            {/* Materials Tab */}
            <TabsContent value="materials" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {materials.length} materials
                </p>
                <Button
                  onClick={() => {
                    setEditingMaterial(null)
                    setMaterialName("")
                    setMaterialDialogOpen(true)
                  }}
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Material
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell>
                          {new Date(material.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingMaterial(material)
                                setMaterialName(material.name)
                                setMaterialDialogOpen(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingMaterial(material)}
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
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Category Add/Edit Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the category name" : "Create a new product category"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., Cow Ghee"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={saving}>
              {saving ? "Saving..." : editingCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Add/Edit Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVariant ? "Edit Variant" : "Add Variant"}</DialogTitle>
            <DialogDescription>
              {editingVariant ? "Update the variant details" : "Create a new product variant"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="variant-category">Category</Label>
              <Select value={variantCategoryId} onValueChange={setVariantCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="variant-name">Variant Name</Label>
              <Input
                id="variant-name"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="e.g., 500ml"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariantDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVariant} disabled={saving}>
              {saving ? "Saving..." : editingVariant ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Add/Edit Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMaterial ? "Edit Material" : "Add Material"}</DialogTitle>
            <DialogDescription>
              {editingMaterial ? "Update the material name" : "Create a new packaging material"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="material-name">Material Name</Label>
              <Input
                id="material-name"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="e.g., Bottle"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMaterial} disabled={saving}>
              {saving ? "Saving..." : editingMaterial ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category <strong>{deletingCategory?.name}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingVariant} onOpenChange={() => setDeletingVariant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the variant <strong>{deletingVariant?.variant_name}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVariant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingMaterial} onOpenChange={() => setDeletingMaterial(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the material <strong>{deletingMaterial?.name}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMaterial} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock Quantity</DialogTitle>
            <DialogDescription>
              {currentStockItem && (
                <>
                  {currentStockItem.category} - {currentStockItem.variant} - {currentStockItem.material}
                  <br />
                  Changing from <strong>{currentStockItem.quantity}</strong> to <strong>{pendingQuantity}</strong>
                  <br />
                  Change: <strong>{pendingQuantity - currentStockItem.quantity > 0 ? '+' : ''}{pendingQuantity - currentStockItem.quantity}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comment">Comment (Required)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note about this change (required)..."
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCommentDialogOpen(false)
              setComment("")
            }}>
              Cancel
            </Button>
            <Button onClick={handleCommentSubmit}>
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Comments Dialog */}
      <Dialog open={showCommentsDialog} onOpenChange={setShowCommentsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock History</DialogTitle>
            <DialogDescription>
              {currentStockItem && (
                <>
                  {currentStockItem.category} - {currentStockItem.variant} - {currentStockItem.material}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingComments ? (
              <p className="text-center text-muted-foreground">Loading history...</p>
            ) : stockComments.length === 0 ? (
              <p className="text-center text-muted-foreground">No history available</p>
            ) : (
              stockComments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{comment.user_email || 'Unknown User'}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant={comment.quantity_change > 0 ? "default" : "destructive"}>
                      {comment.quantity_change > 0 ? '+' : ''}{comment.quantity_change}
                    </Badge>
                  </div>
                  <div className="text-sm mb-2">
                    <span className="text-muted-foreground">Changed from </span>
                    <strong>{comment.previous_quantity}</strong>
                    <span className="text-muted-foreground"> to </span>
                    <strong>{comment.new_quantity}</strong>
                  </div>
                  {comment.comment && (
                    <p className="text-sm bg-muted p-2 rounded mt-2">{comment.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* All Comments Dialog */}
      <Dialog open={showAllCommentsDialog} onOpenChange={setShowAllCommentsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Stock Changes</DialogTitle>
            <DialogDescription>
              Recent stock quantity changes across all items (last 100 entries)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingAllComments ? (
              <p className="text-center text-muted-foreground">Loading comments...</p>
            ) : allComments.length === 0 ? (
              <p className="text-center text-muted-foreground">No comments available</p>
            ) : (
              allComments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{comment.user_email || 'Unknown User'}</p>
                        <Badge variant={comment.quantity_change > 0 ? "default" : "destructive"} className="text-xs">
                          {comment.quantity_change > 0 ? '+' : ''}{comment.quantity_change}
                        </Badge>
                      </div>
                      {comment.stock_item && (
                        <p className="text-sm font-medium text-muted-foreground">
                          {comment.stock_item.category} - {comment.stock_item.variant} - {comment.stock_item.material}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm mb-2">
                    <span className="text-muted-foreground">Changed from </span>
                    <strong>{comment.previous_quantity}</strong>
                    <span className="text-muted-foreground"> to </span>
                    <strong>{comment.new_quantity}</strong>
                  </div>
                  {comment.comment && (
                    <p className="text-sm bg-muted p-2 rounded mt-2">{comment.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Stock Table Component
function StockTable({
  data,
  editingCell,
  setEditingCell,
  onQuantityUpdate,
  onQuantityChange,
  onViewComments,
  onSaveClick,
  onCancelChanges,
  onPriceUpdate,
  onMinStockUpdate,
  pendingChanges,
  getStockStatus,
}: {
  data: StockItem[]
  editingCell: { id: string; value: number } | null
  setEditingCell: (cell: { id: string; value: number } | null) => void
  onQuantityUpdate: (id: string, quantity: number) => void
  onQuantityChange: (id: string, delta: number) => void
  onViewComments: (item: StockItem) => void
  onSaveClick: (item: StockItem) => void
  onCancelChanges: (id: string) => void
  onPriceUpdate: (id: string, price: number) => void
  onMinStockUpdate: (id: string, minStock: number) => void
  pendingChanges: Map<string, number>
  getStockStatus: (quantity: number, minStock: number) => {
    status: string
    badge: "default" | "destructive" | "outline"
    icon: React.ComponentType<{ className?: string }>
  }
}) {
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: number } | null>(null)
  const [editingMinStock, setEditingMinStock] = useState<{ id: string; value: number } | null>(null)
  
  const handlePriceUpdate = (id: string, newPrice: number) => {
    if (newPrice < 0) {
      toast.error("Price cannot be negative")
      return
    }
    onPriceUpdate(id, newPrice)
    setEditingPrice(null)
  }

  const handleMinStockUpdate = (id: string, newMinStock: number) => {
    if (newMinStock < 0) {
      toast.error("Minimum stock cannot be negative")
      return
    }
    onMinStockUpdate(id, newMinStock)
    setEditingMinStock(null)
  }

  const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0)
  const totalValue = data.reduce((sum, item) => sum + (item.quantity * item.price), 0)

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="w-full max-w-full overflow-x-auto">
      <Table className="min-w-[1100px] w-full">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Product Category</TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Variant</TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Material</TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Quantity</TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Price (₹)</TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Min Stock</TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Last Updated</TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[11px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center">
                No items found
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => {
              const stockStatus = getStockStatus(item.quantity, item.min_stock)
              const StatusIcon = stockStatus.icon
              const isEditing = editingCell?.id === item.id
              const isPriceEditing = editingPrice?.id === item.id
              const isMinStockEditing = editingMinStock?.id === item.id
              const hasPendingChange = pendingChanges.has(item.id)
              const displayQuantity = pendingChanges.get(item.id) ?? item.quantity

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.category}</TableCell>
                  <TableCell>{item.variant}</TableCell>
                  <TableCell>{item.material}</TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        value={editingCell.value}
                        onChange={(e) =>
                          setEditingCell({ id: item.id, value: parseInt(e.target.value) || 0 })
                        }
                        onBlur={() => onQuantityUpdate(item.id, editingCell.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onQuantityUpdate(item.id, editingCell.value)
                          } else if (e.key === "Escape") {
                            setEditingCell(null)
                          }
                        }}
                        autoFocus
                        className="w-24"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onQuantityChange(item.id, -1)}
                          disabled={displayQuantity === 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className={`font-semibold min-w-[2rem] text-center ${hasPendingChange ? 'text-orange-600' : ''}`}>
                          {displayQuantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onQuantityChange(item.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        {hasPendingChange && (
                          <>
                            <Button
                              variant="default"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onSaveClick(item)}
                              title="Save changes"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onCancelChanges(item.id)}
                              title="Cancel changes"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {isPriceEditing ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingPrice.value}
                        onChange={(e) =>
                          setEditingPrice({ id: item.id, value: parseFloat(e.target.value) || 0 })
                        }
                        onBlur={() => handlePriceUpdate(item.id, editingPrice.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handlePriceUpdate(item.id, editingPrice.value)
                          } else if (e.key === "Escape") {
                            setEditingPrice(null)
                          }
                        }}
                        autoFocus
                        className="w-24"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                        onClick={() => setEditingPrice({ id: item.id, value: item.price })}
                        title="Click to edit"
                      >
                        ₹{item.price.toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isMinStockEditing ? (
                      <Input
                        type="number"
                        min="0"
                        value={editingMinStock.value}
                        onChange={(e) =>
                          setEditingMinStock({ id: item.id, value: parseInt(e.target.value) || 0 })
                        }
                        onBlur={() => handleMinStockUpdate(item.id, editingMinStock.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleMinStockUpdate(item.id, editingMinStock.value)
                          } else if (e.key === "Escape") {
                            setEditingMinStock(null)
                          }
                        }}
                        autoFocus
                        className="w-24"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                        onClick={() => setEditingMinStock({ id: item.id, value: item.min_stock })}
                        title="Click to edit"
                      >
                        {item.min_stock}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stockStatus.badge} className="flex items-center gap-1 w-fit">
                      <StatusIcon className="h-3 w-3" />
                      {stockStatus.status === "out" && "Out of Stock"}
                      {stockStatus.status === "low" && "Low Stock"}
                      {stockStatus.status === "good" && "In Stock"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(item.updated_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewComments(item)}
                        title="View History"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingCell({ id: item.id, value: item.quantity })}
                        title="Edit Quantity"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
          {data.length > 0 && (
            <TableRow className="bg-muted/50 font-bold border-t-2">
              <TableCell colSpan={3} className="text-right text-base">Total:</TableCell>
              <TableCell className="text-base">{totalQuantity.toLocaleString()}</TableCell>
              <TableCell className="text-base">₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              <TableCell colSpan={4}></TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
