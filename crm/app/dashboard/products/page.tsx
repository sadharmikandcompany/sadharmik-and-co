"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, Upload, X, Image as ImageIcon, Eye, List, Loader2, Package, Search } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import { ExportButtons } from "@/components/export-buttons"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type Category = {
  id: string
  category_name: string
}

type Product = {
  id: string
  name: string
  brand: string | null
  hsn_code: string | null
  gst_percentage: number | null
  net_weight_grams: number | null
  parent_category_id: string | null
  sub_category_id: string | null
  parent_category?: Category
  sub_category?: Category
  stock: number | null
  customer_price: number
  customer_sale_price: number | null
  customer_discount_percent: number | null
  retailer_price: number | null
  retailer_sale_price: number | null
  retailer_discount_percent: number | null
  distributor_price: number | null
  distributor_sale_price: number | null
  distributor_discount_percent: number | null
  sub_distributor_price: number | null
  sub_distributor_sale_price: number | null
  sub_distributor_discount_percent: number | null
  short_description: string | null
  long_description: string | null
  images: string[] | null
  specifications: Record<string, unknown> | null
  available_offers: Record<string, unknown> | null
  questions_answers: Record<string, unknown> | null
  meta_title: string | null
  meta_description: string | null
  meta_content: string | null
  is_active: boolean
  is_featured: boolean
  show_on_website: boolean
  created_at: string
  updated_at: string | null
}

type ProductFormData = {
  name: string
  brand: string
  hsn_code: string
  gst_percentage: number
  net_weight_grams: string
  parent_category_id: string | null
  sub_category_id: string | null
  stock: number
  customer_price: number
  customer_sale_price: number
  customer_discount_percent: number
  retailer_price: number
  retailer_sale_price: number
  retailer_discount_percent: number
  distributor_price: number
  distributor_sale_price: number
  distributor_discount_percent: number
  sub_distributor_price: number
  sub_distributor_sale_price: number
  sub_distributor_discount_percent: number
  short_description: string
  long_description: string
  meta_title: string
  meta_description: string
  meta_content: string
  is_active: boolean
  is_featured: boolean
  show_on_website: boolean
}

type PincodePricingEntry = {
  id?: string // Optional for new entries
  pincode: string
  customer_price: string
  customer_sale_price: string
  retailer_price: string
  retailer_sale_price: string
  distributor_price: string
  distributor_sale_price: string
  sub_distributor_price: string
  sub_distributor_sale_price: string
}

type SaleTransaction = {
  id: string
  order_id: string
  quantity: number
  unit_price: number
  total: number
  subtotal: number
  created_at: string
  customer_name?: string
  customer_is_vip?: boolean
  customer_vip_number?: string | null
  order: {
    order_number: string
    order_status: string
    customer_full_name: string | null
    customer_id: string | null
    order_date: string
  }
}

type PurchaseTransaction = {
  id: string
  purchase_id: string
  quantity: number
  unit_price: number
  total: number
  subtotal: number
  received_quantity: number | null
  created_at: string
  purchase: {
    purchase_number: string
    purchase_status: string
    supplier_name: string | null
    vendor_id: string | null
    purchase_date: string
  }
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [pincodePricing, setPincodePricing] = useState<PincodePricingEntry[]>([])

  // Transaction drawer state
  const [transactionDrawerOpen, setTransactionDrawerOpen] = useState(false)
  const [transactionProduct, setTransactionProduct] = useState<Product | null>(null)
  const [salesData, setSalesData] = useState<SaleTransaction[]>([])
  const [purchasesData, setPurchasesData] = useState<PurchaseTransaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)

  // Helper function to check if image URL is valid
  const isValidImageUrl = (url: string): boolean => {
    if (!url || url.trim() === '') return false
    // Check if it's a full URL (starts with http:// or https://)
    return url.startsWith('http://') || url.startsWith('https://')
  }

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    brand: "",
    hsn_code: "",
    gst_percentage: 0,
    net_weight_grams: "",
    parent_category_id: null,
    sub_category_id: null,
    stock: 0,
    customer_price: 0,
    customer_sale_price: 0,
    customer_discount_percent: 0,
    retailer_price: 0,
    retailer_sale_price: 0,
    retailer_discount_percent: 0,
    distributor_price: 0,
    distributor_sale_price: 0,
    distributor_discount_percent: 0,
    sub_distributor_price: 0,
    sub_distributor_sale_price: 0,
    sub_distributor_discount_percent: 0,
    short_description: "",
    long_description: "",
    meta_title: "",
    meta_description: "",
    meta_content: "",
    is_active: true,
    is_featured: false,
    show_on_website: true,
  })

  useEffect(() => {
    fetchCategories()
    fetchProducts()
  }, [])

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, category_name")
      .order("category_name", { ascending: true })

    if (error) {
      console.error("Error fetching categories:", error)
      toast.error("Failed to fetch categories")
    } else {
      setCategories(data || [])
    }
  }

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        parent_category:parent_category_id(id, category_name),
        sub_category:sub_category_id(id, category_name)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching products:", error)
      toast.error("Failed to fetch products")
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  const fetchTransactions = async (product: Product) => {
    setTransactionsLoading(true)
    setTransactionProduct(product)
    setTransactionDrawerOpen(true)
    setSalesData([])
    setPurchasesData([])

    // Fetch sales (order_items for this product with order details)
    const { data: sales, error: salesError } = await supabase
      .from("order_items")
      .select(`
        id,
        order_id,
        quantity,
        unit_price,
        total,
        subtotal,
        created_at,
        order:order_id(
          order_number,
          order_status,
          customer_full_name,
          customer_id,
          order_date
        )
      `)
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })

    if (salesError) {
      console.error("Error fetching sales:", salesError)
      toast.error("Failed to fetch sales data")
    } else {
      const salesList = (sales as unknown as SaleTransaction[]) || []

      // Fetch customer names in batches for orders that have customer_id
      const customerIds = [...new Set(
        salesList
          .filter((s) => s.order?.customer_id)
          .map((s) => s.order.customer_id!)
      )]

      if (customerIds.length > 0) {
        const customerMap = new Map<string, { name: string; is_vip: boolean; vip_number: string | null }>()
        // Batch in groups of 50 to avoid URL length limits
        for (let i = 0; i < customerIds.length; i += 50) {
          const batch = customerIds.slice(i, i + 50)
          const { data: customers } = await supabase
            .from("customers")
            .select("id, first_name, last_name, is_vip, vip_number")
            .in("id", batch)

          if (customers) {
            customers.forEach((c: { id: string; first_name: string | null; last_name: string | null; is_vip: boolean; vip_number: string | null }) => {
              customerMap.set(c.id, {
                name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
                is_vip: c.is_vip || false,
                vip_number: c.vip_number,
              })
            })
          }
        }

        salesList.forEach((s) => {
          if (s.order?.customer_id) {
            const customer = customerMap.get(s.order.customer_id)
            s.customer_name = s.order.customer_full_name || customer?.name || undefined
            s.customer_is_vip = customer?.is_vip || false
            s.customer_vip_number = customer?.vip_number || null
          }
        })
      }

      setSalesData(salesList)
    }

    // Fetch purchases (purchase_items for this product with purchase details)
    const { data: purchases, error: purchasesError } = await supabase
      .from("purchase_items")
      .select(`
        id,
        purchase_id,
        quantity,
        unit_price,
        total,
        subtotal,
        received_quantity,
        created_at,
        purchase:purchase_id(
          purchase_number,
          purchase_status,
          supplier_name,
          vendor_id,
          purchase_date
        )
      `)
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })

    if (purchasesError) {
      console.error("Error fetching purchases:", purchasesError)
      toast.error("Failed to fetch purchase data")
    } else {
      setPurchasesData((purchases as unknown as PurchaseTransaction[]) || [])
    }

    setTransactionsLoading(false)
  }

  const handleOpenDialog = async (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      const allImages = product.images || []
      const validImages = allImages.filter(isValidImageUrl)

      // Warn if some images are invalid
      if (allImages.length > 0 && validImages.length < allImages.length) {
        toast.warning(`${allImages.length - validImages.length} image(s) have invalid URLs and won't be displayed. Please re-upload images.`)
      }

      setImageUrls(validImages)
      setFormData({
        name: product.name,
        brand: product.brand || "",
        hsn_code: product.hsn_code || "",
        gst_percentage: product.gst_percentage || 0,
        net_weight_grams: product.net_weight_grams != null ? String(product.net_weight_grams) : "",
        parent_category_id: product.parent_category_id || null,
        sub_category_id: product.sub_category_id || null,
        stock: product.stock || 0,
        customer_price: product.customer_price,
        customer_sale_price: product.customer_sale_price || 0,
        customer_discount_percent: product.customer_discount_percent || 0,
        retailer_price: product.retailer_price || 0,
        retailer_sale_price: product.retailer_sale_price || 0,
        retailer_discount_percent: product.retailer_discount_percent || 0,
        distributor_price: product.distributor_price || 0,
        distributor_sale_price: product.distributor_sale_price || 0,
        distributor_discount_percent: product.distributor_discount_percent || 0,
        sub_distributor_price: product.sub_distributor_price || 0,
        sub_distributor_sale_price: product.sub_distributor_sale_price || 0,
        sub_distributor_discount_percent: product.sub_distributor_discount_percent || 0,
        short_description: product.short_description || "",
        long_description: product.long_description || "",
        meta_title: product.meta_title || "",
        meta_description: product.meta_description || "",
        meta_content: product.meta_content || "",
        is_active: product.is_active,
        is_featured: product.is_featured,
        show_on_website: product.show_on_website,
      })

      // Fetch pincode pricing for this product
      const { data: pincodeData } = await supabase
        .from("product_pincode_pricing")
        .select("*")
        .eq("product_id", product.id)
        .order("pincode", { ascending: true })

      if (pincodeData && pincodeData.length > 0) {
        // Group pincodes with the same pricing
        const grouped = new Map<string, string[]>()

        pincodeData.forEach((p) => {
          const key = JSON.stringify({
            customer_price: p.customer_price,
            customer_sale_price: p.customer_sale_price,
            retailer_price: p.retailer_price,
            retailer_sale_price: p.retailer_sale_price,
            distributor_price: p.distributor_price,
            distributor_sale_price: p.distributor_sale_price,
            sub_distributor_price: p.sub_distributor_price,
            sub_distributor_sale_price: p.sub_distributor_sale_price,
          })

          if (!grouped.has(key)) {
            grouped.set(key, [])
          }
          grouped.get(key)!.push(p.pincode)
        })

        // Convert grouped data back to PincodePricingEntry format
        const groupedPricing: PincodePricingEntry[] = []
        pincodeData.forEach((p) => {
          const key = JSON.stringify({
            customer_price: p.customer_price,
            customer_sale_price: p.customer_sale_price,
            retailer_price: p.retailer_price,
            retailer_sale_price: p.retailer_sale_price,
            distributor_price: p.distributor_price,
            distributor_sale_price: p.distributor_sale_price,
            sub_distributor_price: p.sub_distributor_price,
            sub_distributor_sale_price: p.sub_distributor_sale_price,
          })

          // Check if this pricing group is already added
          if (grouped.has(key)) {
            const pincodes = grouped.get(key)!
            groupedPricing.push({
              pincode: pincodes.join(', '),
              customer_price: p.customer_price?.toString() || "",
              customer_sale_price: p.customer_sale_price?.toString() || "",
              retailer_price: p.retailer_price?.toString() || "",
              retailer_sale_price: p.retailer_sale_price?.toString() || "",
              distributor_price: p.distributor_price?.toString() || "",
              distributor_sale_price: p.distributor_sale_price?.toString() || "",
              sub_distributor_price: p.sub_distributor_price?.toString() || "",
              sub_distributor_sale_price: p.sub_distributor_sale_price?.toString() || "",
            })
            grouped.delete(key) // Remove so we don't add duplicates
          }
        })

        setPincodePricing(groupedPricing)
      } else {
        setPincodePricing([])
      }
    } else {
      setEditingProduct(null)
      setImageUrls([])
      setPincodePricing([])
      setFormData({
        name: "",
        brand: "",
        hsn_code: "",
        gst_percentage: 0,
        net_weight_grams: "",
        parent_category_id: null,
        sub_category_id: null,
        stock: 0,
        customer_price: 0,
        customer_sale_price: 0,
        customer_discount_percent: 0,
        retailer_price: 0,
        retailer_sale_price: 0,
        retailer_discount_percent: 0,
        distributor_price: 0,
        distributor_sale_price: 0,
        distributor_discount_percent: 0,
        sub_distributor_price: 0,
        sub_distributor_sale_price: 0,
        sub_distributor_discount_percent: 0,
        short_description: "",
        long_description: "",
        meta_title: "",
        meta_description: "",
        meta_content: "",
        is_active: true,
        is_featured: false,
        show_on_website: true,
      })
    }
    setDialogOpen(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImage(true)

    try {
      const uploadedUrls: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `products/${fileName}`

        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (error) throw error

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(data.path)

        uploadedUrls.push(publicUrl)
      }

      setImageUrls([...imageUrls, ...uploadedUrls])
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully`)
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index))
  }

  const calculateDiscountPercent = (regularPrice: string, salePrice: string): string => {
    const regular = parseFloat(regularPrice)
    const sale = parseFloat(salePrice)

    if (!regular || !sale || regular <= 0 || sale >= regular) {
      return "0"
    }

    const discount = ((regular - sale) / regular) * 100
    return discount.toFixed(2)
  }

  const handleAddPincodePricing = () => {
    setPincodePricing([
      ...pincodePricing,
      {
        pincode: "",
        customer_price: "",
        customer_sale_price: "",
        retailer_price: "",
        retailer_sale_price: "",
        distributor_price: "",
        distributor_sale_price: "",
        sub_distributor_price: "",
        sub_distributor_sale_price: "",
      },
    ])
  }

  const handleRemovePincodePricing = (index: number) => {
    setPincodePricing(pincodePricing.filter((_, i) => i !== index))
  }

  const handleUpdatePincodePricing = (
    index: number,
    field: keyof PincodePricingEntry,
    value: string
  ) => {
    const updated = [...pincodePricing]
    updated[index] = { ...updated[index], [field]: value }
    setPincodePricing(updated)
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const productData = {
        ...formData,
        net_weight_grams: formData.net_weight_grams.trim() === "" ? null : parseFloat(formData.net_weight_grams),
        images: imageUrls.filter(isValidImageUrl)
      }

      let productId: string

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id)

        if (error) throw error
        productId = editingProduct.id
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert([productData])
          .select()
          .single()

        if (error) throw error
        if (!data) throw new Error("Product creation failed")
        productId = data.id
      }

      // Handle pincode pricing
      if (pincodePricing.length > 0) {
        // Filter out empty pincodes
        const validPincodePricing = pincodePricing.filter((p) => p.pincode.trim() !== "")

        if (validPincodePricing.length > 0) {
          // Delete existing pincode pricing for this product
          await supabase
            .from("product_pincode_pricing")
            .delete()
            .eq("product_id", productId)

          // Insert new pincode pricing - split comma-separated pincodes and deduplicate
          const pincodeMap = new Map<string, {
            customer_price: number | null
            customer_sale_price: number | null
            retailer_price: number | null
            retailer_sale_price: number | null
            distributor_price: number | null
            distributor_sale_price: number | null
            sub_distributor_price: number | null
            sub_distributor_sale_price: number | null
          }>()

          validPincodePricing.forEach((p) => {
            // Split by comma and trim each pincode
            const pincodes = p.pincode.split(',').map(pc => pc.trim()).filter(pc => pc.length > 0)

            pincodes.forEach((pincode) => {
              // If pincode already exists, it will be overwritten (last one wins)
              pincodeMap.set(pincode, {
                customer_price: p.customer_price ? parseFloat(p.customer_price) : null,
                customer_sale_price: p.customer_sale_price ? parseFloat(p.customer_sale_price) : null,
                retailer_price: p.retailer_price ? parseFloat(p.retailer_price) : null,
                retailer_sale_price: p.retailer_sale_price ? parseFloat(p.retailer_sale_price) : null,
                distributor_price: p.distributor_price ? parseFloat(p.distributor_price) : null,
                distributor_sale_price: p.distributor_sale_price ? parseFloat(p.distributor_sale_price) : null,
                sub_distributor_price: p.sub_distributor_price ? parseFloat(p.sub_distributor_price) : null,
                sub_distributor_sale_price: p.sub_distributor_sale_price ? parseFloat(p.sub_distributor_sale_price) : null,
              })
            })
          })

          // Convert map to insert array
          const pincodeInserts = Array.from(pincodeMap.entries()).map(([pincode, prices]) => ({
            product_id: productId,
            pincode: pincode,
            ...prices
          }))

          if (pincodeInserts.length > 0) {
            const { error: pincodeError } = await supabase
              .from("product_pincode_pricing")
              .insert(pincodeInserts)

            if (pincodeError) throw pincodeError

            // Show warning if duplicates were found
            const totalPincodes = validPincodePricing.reduce((sum, p) => {
              return sum + p.pincode.split(',').map(pc => pc.trim()).filter(pc => pc.length > 0).length
            }, 0)

            if (totalPincodes > pincodeInserts.length) {
              toast.warning(`Duplicate pincodes detected and merged. ${pincodeInserts.length} unique pincodes saved.`)
            }
          }
        }
      }

      toast.success(editingProduct ? "Product updated successfully" : "Product created successfully")
      setDialogOpen(false)
      setImageUrls([])
      setPincodePricing([])
      fetchProducts()
    } catch (error: unknown) {
      console.error("Error saving product:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save product"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingProduct) return

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", deletingProduct.id)

      if (error) throw error

      toast.success("Product deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingProduct(null)
      fetchProducts()
    } catch (error: unknown) {
      console.error("Error deleting product:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete product"
      toast.error(errorMessage)
    }
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.hsn_code && product.hsn_code.includes(searchTerm)) ||
      (product.parent_category?.category_name && product.parent_category.category_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Prepare export data
  const exportData = filteredProducts.map(product => ({
    'Product Name': product.name,
    'Brand': product.brand || '',
    'Category': product.parent_category?.category_name || '',
    'HSN Code': product.hsn_code || '',
    'Customer Price': `₹${product.customer_price?.toFixed(2) || '0.00'}`,
    'Customer Sale Price': `₹${product.customer_sale_price?.toFixed(2) || '0.00'}`,
    'Retailer Price': `₹${product.retailer_price?.toFixed(2) || '0.00'}`,
    'Distributor Price': `₹${product.distributor_price?.toFixed(2) || '0.00'}`,
    'Sub-Distributor Price': `₹${product.sub_distributor_price?.toFixed(2) || '0.00'}`,
    'Stock': product.stock || 0,
    'GST %': product.gst_percentage || 0,
    'Active': product.is_active ? 'Yes' : 'No',
    'Featured': product.is_featured ? 'Yes' : 'No'
  }))

  const exportColumns = [
    { header: 'Product', dataKey: 'Product Name' },
    { header: 'Brand', dataKey: 'Brand' },
    { header: 'Category', dataKey: 'Category' },
    { header: 'Customer Price', dataKey: 'Customer Price' },
    { header: 'Retailer Price', dataKey: 'Retailer Price' },
    { header: 'Distributor Price', dataKey: 'Distributor Price' },
    { header: 'Stock', dataKey: 'Stock' },
    { header: 'Active', dataKey: 'Active' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Package className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Products</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground">Manage your product catalog</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <ExportButtons
            data={exportData}
            filename="products"
            columns={exportColumns}
            pdfTitle="Products Report"
          />
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900/50">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Product List</CardTitle>
                <CardDescription className="mt-0.5">A list of all products with pricing and inventory</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
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
                  <TableHead className="w-16 font-semibold uppercase tracking-wider text-[11px]">Image</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Name</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Brand</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Category</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">HSN Code</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Price</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Stock</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        {product.images && product.images.length > 0 && isValidImageUrl(product.images[0]) ? (
                          <div className="w-12 h-12 relative rounded overflow-hidden border border-border">
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-muted rounded border border-border">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => router.push(`/dashboard/products/${product.id}`)}
                          className="text-left hover:text-primary hover:underline transition-colors"
                        >
                          {product.name}
                        </button>
                      </TableCell>
                      <TableCell>{product.brand || "-"}</TableCell>
                      <TableCell>
                        {product.parent_category?.category_name || "-"}
                        {product.sub_category?.category_name && ` > ${product.sub_category.category_name}`}
                      </TableCell>
                      <TableCell>{product.hsn_code || "-"}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">₹{product.customer_price}</span>
                          {product.customer_sale_price && (
                            <span className="ml-2 text-sm text-muted-foreground line-through">
                              ₹{product.customer_sale_price}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          product.stock === null ? "secondary" :
                          product.stock === 0 ? "destructive" :
                          product.stock < 10 ? "outline" :
                          "default"
                        } className="rounded-full tabular-nums">
                          {product.stock === null ? "N/A" : product.stock}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={product.is_active ? "default" : "secondary"} className="rounded-full capitalize">
                            {product.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {product.is_featured && (
                            <Badge variant="outline" className="rounded-full capitalize">Featured</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fetchTransactions(product)}
                            title="View sales & purchases"
                          >
                            <List className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/dashboard/products/${product.id}`)}
                            title="View product details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(product)}
                            title="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingProduct(product)
                              setDeleteDialogOpen(true)
                            }}
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
                <DialogDescription className="mt-0.5">
                  {editingProduct
                    ? "Update product information"
                    : "Enter product details to create a new product"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 px-4 pt-2 pb-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <p className="text-sm text-muted-foreground">Product name, brand, and identifiers</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) =>
                      setFormData({ ...formData, brand: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hsn_code">HSN Code</Label>
                  <Input
                    id="hsn_code"
                    value={formData.hsn_code}
                    onChange={(e) =>
                      setFormData({ ...formData, hsn_code: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst_percentage">GST %</Label>
                  <Input
                    id="gst_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.gst_percentage}
                    onChange={(e) =>
                      setFormData({ ...formData, gst_percentage: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Quantity</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="net_weight_grams">Net Weight (grams)</Label>
                  <Input
                    id="net_weight_grams"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 500"
                    value={formData.net_weight_grams}
                    onChange={(e) =>
                      setFormData({ ...formData, net_weight_grams: e.target.value })
                    }
                    title="Used to total up Kg on the Orders page. Leave blank if not applicable."
                  />
                </div>
              </div>
            </div>

            {/* Product Images */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Product Images</h3>
                <p className="text-sm text-muted-foreground">Upload product images (max 5MB per image)</p>
              </div>
              <div className="space-y-4">
                {/* Upload Button */}
                <div>
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-muted-foreground/50 transition-colors">
                      {uploadingImage ? (
                        <div className="text-center">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Click to upload images
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            JPEG, PNG, WebP, GIF (max 5MB)
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </Label>
                </div>

                {/* Image Preview Grid */}
                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-4">
                    {imageUrls.filter(isValidImageUrl).map((url, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square relative rounded-lg overflow-hidden border border-border">
                          <Image
                            src={url}
                            alt={`Product image ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {index === 0 && (
                          <Badge className="absolute bottom-2 left-2 text-xs">
                            Primary
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Category</h3>
                <p className="text-sm text-muted-foreground">Product categorization</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                      <SelectValue placeholder="Select parent category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sub_category_id">Sub Category</Label>
                  <Select
                    value={formData.sub_category_id || "none"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        sub_category_id: value === "none" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Customer Pricing */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Customer Pricing</h3>
                <p className="text-sm text-muted-foreground">Retail customer prices</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_price">Regular Price (₹) *</Label>
                  <Input
                    id="customer_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.customer_price}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_price: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_sale_price">Sale Price (₹)</Label>
                  <Input
                    id="customer_sale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.customer_sale_price}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_sale_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_discount_percent">Discount %</Label>
                  <Input
                    id="customer_discount_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.customer_discount_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_discount_percent: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Retailer Pricing */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Retailer Pricing</h3>
                <p className="text-sm text-muted-foreground">Price charged to retailers (shown in POS)</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="retailer_price">Regular Price (₹)</Label>
                  <Input
                    id="retailer_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.retailer_price}
                    onChange={(e) =>
                      setFormData({ ...formData, retailer_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retailer_sale_price">Sale Price (₹)</Label>
                  <Input
                    id="retailer_sale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.retailer_sale_price}
                    onChange={(e) =>
                      setFormData({ ...formData, retailer_sale_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retailer_discount_percent">Discount %</Label>
                  <Input
                    id="retailer_discount_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.retailer_discount_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, retailer_discount_percent: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Distributor Pricing */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Distributor Pricing</h3>
                <p className="text-sm text-muted-foreground">Wholesale distributor prices</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="distributor_price">Regular Price (₹)</Label>
                  <Input
                    id="distributor_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.distributor_price}
                    onChange={(e) =>
                      setFormData({ ...formData, distributor_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distributor_sale_price">Sale Price (₹)</Label>
                  <Input
                    id="distributor_sale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.distributor_sale_price}
                    onChange={(e) =>
                      setFormData({ ...formData, distributor_sale_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distributor_discount_percent">Discount %</Label>
                  <Input
                    id="distributor_discount_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.distributor_discount_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, distributor_discount_percent: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Sub-Distributor Pricing */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Sub-Distributor Pricing</h3>
                <p className="text-sm text-muted-foreground">Sub-distributor wholesale prices</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sub_distributor_price">Regular Price (₹)</Label>
                  <Input
                    id="sub_distributor_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.sub_distributor_price}
                    onChange={(e) =>
                      setFormData({ ...formData, sub_distributor_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sub_distributor_sale_price">Sale Price (₹)</Label>
                  <Input
                    id="sub_distributor_sale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.sub_distributor_sale_price}
                    onChange={(e) =>
                      setFormData({ ...formData, sub_distributor_sale_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sub_distributor_discount_percent">Discount %</Label>
                  <Input
                    id="sub_distributor_discount_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.sub_distributor_discount_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, sub_distributor_discount_percent: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Product Description</h3>
                <p className="text-sm text-muted-foreground">Product details and descriptions</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="short_description">Short Description</Label>
                <Textarea
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e) =>
                    setFormData({ ...formData, short_description: e.target.value })
                  }
                  rows={2}
                  placeholder="Brief product description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="long_description">Long Description</Label>
                <Textarea
                  id="long_description"
                  value={formData.long_description}
                  onChange={(e) =>
                    setFormData({ ...formData, long_description: e.target.value })
                  }
                  rows={4}
                  placeholder="Detailed product description"
                />
              </div>
            </div>

            {/* SEO Meta Information */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">SEO Meta Information</h3>
                <p className="text-sm text-muted-foreground">Search engine optimization details</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_title: e.target.value })
                  }
                  placeholder="SEO title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_description: e.target.value })
                  }
                  rows={2}
                  placeholder="SEO description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_content">Meta Keywords</Label>
                <Input
                  id="meta_content"
                  value={formData.meta_content}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_content: e.target.value })
                  }
                  placeholder="Comma-separated keywords"
                />
              </div>
            </div>

            {/* Pincode-Based Pricing */}
            <div className="space-y-4">
              <div className="border-b pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Pincode-Based Pricing</h3>
                  <p className="text-sm text-muted-foreground">
                    Set custom prices for specific pincodes (Optional)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPincodePricing}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pincode
                </Button>
              </div>

              {pincodePricing.length > 0 && (
                <div className="space-y-6">
                  {pincodePricing.map((pricing, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4 relative">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold">Pincode Group {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemovePincodePricing(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Pincode Input */}
                      <div className="space-y-2">
                        <Label>Pincode(s) *</Label>
                        <Input
                          placeholder="Enter pincode(s) separated by commas (e.g., 400001, 400002, 400003)"
                          value={pricing.pincode}
                          onChange={(e) =>
                            handleUpdatePincodePricing(index, "pincode", e.target.value)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Add multiple pincodes separated by commas to apply the same pricing
                        </p>
                      </div>

                      {/* Customer Pricing */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Customer Pricing</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Price (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Regular price"
                              value={pricing.customer_price}
                              onChange={(e) =>
                                handleUpdatePincodePricing(index, "customer_price", e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Sale Price (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Sale price"
                              value={pricing.customer_sale_price}
                              onChange={(e) =>
                                handleUpdatePincodePricing(
                                  index,
                                  "customer_sale_price",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Discount %</Label>
                            <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                              {calculateDiscountPercent(pricing.customer_price, pricing.customer_sale_price)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Retailer Pricing */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Retailer Pricing</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Price (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Regular price"
                              value={pricing.retailer_price}
                              onChange={(e) =>
                                handleUpdatePincodePricing(index, "retailer_price", e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Sale Price (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Sale price"
                              value={pricing.retailer_sale_price}
                              onChange={(e) =>
                                handleUpdatePincodePricing(
                                  index,
                                  "retailer_sale_price",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Discount %</Label>
                            <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                              {calculateDiscountPercent(pricing.retailer_price, pricing.retailer_sale_price)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Distributor Pricing */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Distributor Pricing</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Price (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Regular price"
                              value={pricing.distributor_price}
                              onChange={(e) =>
                                handleUpdatePincodePricing(index, "distributor_price", e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Sale Price (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Sale price"
                              value={pricing.distributor_sale_price}
                              onChange={(e) =>
                                handleUpdatePincodePricing(
                                  index,
                                  "distributor_sale_price",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Discount %</Label>
                            <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                              {calculateDiscountPercent(pricing.distributor_price, pricing.distributor_sale_price)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Distributor Pricing */}
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Sub-Distributor Pricing</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Price (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Regular price"
                              value={pricing.sub_distributor_price}
                              onChange={(e) =>
                                handleUpdatePincodePricing(
                                  index,
                                  "sub_distributor_price",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Sale Price (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Sale price"
                              value={pricing.sub_distributor_sale_price}
                              onChange={(e) =>
                                handleUpdatePincodePricing(
                                  index,
                                  "sub_distributor_sale_price",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Discount %</Label>
                            <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                              {calculateDiscountPercent(pricing.sub_distributor_price, pricing.sub_distributor_sale_price)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pincodePricing.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No pincode-specific pricing added yet.</p>
                  <p className="text-sm mt-1">
                    Click "Add Pincode" to set custom prices for specific locations.
                  </p>
                </div>
              )}
            </div>

            {/* Product Settings */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Product Settings</h3>
                <p className="text-sm text-muted-foreground">Status and visibility options</p>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Active (Visible to customers)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) =>
                      setFormData({ ...formData, is_featured: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Featured Product</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.show_on_website}
                    onChange={(e) =>
                      setFormData({ ...formData, show_on_website: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Show on Website</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                "Active" controls whether this product can be ordered in the CRM/POS. "Show on Website" only controls whether it appears on the public sadharmikandcompany.com product grid — turning it off never hides it from the CRM.
              </p>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur px-4 py-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
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
              This will permanently delete the product{" "}
              <strong>{deletingProduct?.name}</strong>. This action cannot be undone.
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

      {/* Sales & Purchases Drawer */}
      <Sheet open={transactionDrawerOpen} onOpenChange={setTransactionDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Sales & Purchases</SheetTitle>
            <SheetDescription>
              {transactionProduct?.name}
            </SheetDescription>
          </SheetHeader>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="sales" className="flex-1 overflow-hidden flex flex-col px-4">
              <TabsList className="w-full">
                <TabsTrigger value="sales" className="flex-1">
                  Sales (+) <Badge variant="secondary" className="ml-2">{salesData.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="purchases" className="flex-1">
                  Purchases (-) <Badge variant="secondary" className="ml-2">{purchasesData.length}</Badge>
                </TabsTrigger>
              </TabsList>

              {/* Sales Tab */}
              <TabsContent value="sales" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[calc(100vh-220px)]">
                  {salesData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No sales found for this product</p>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {salesData.map((sale) => (
                        <div key={sale.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-green-600 border-green-600">+ Sale</Badge>
                              <span className="font-medium text-sm">
                                {sale.order?.order_number || "N/A"}
                              </span>
                            </div>
                            <Badge variant={
                              sale.order?.order_status === "delivered" ? "default" :
                              sale.order?.order_status === "cancelled" ? "destructive" :
                              "secondary"
                            }>
                              {sale.order?.order_status || "N/A"}
                            </Badge>
                          </div>
                          <Separator className="my-2" />
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Customer:</span>{" "}
                              <span className="font-medium">
                                {sale.order?.customer_full_name || sale.customer_name || "N/A"}
                              </span>
                              {sale.customer_is_vip && (
                                <Badge variant="outline" className="ml-1 text-amber-600 border-amber-600 text-xs">
                                  Sd{sale.customer_vip_number ? ` #${sale.customer_vip_number}` : ""}
                                </Badge>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date:</span>{" "}
                              <span>{sale.order?.order_date ? new Date(sale.order.order_date).toLocaleDateString("en-IN") : "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Qty:</span>{" "}
                              <span className="font-medium">{sale.quantity}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Unit Price:</span>{" "}
                              <span>₹{Number(sale.unit_price).toFixed(2)}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Total:</span>{" "}
                              <span className="font-semibold text-green-600">₹{Number(sale.subtotal || sale.total || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Purchases Tab */}
              <TabsContent value="purchases" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[calc(100vh-220px)]">
                  {purchasesData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No purchases found for this product</p>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {purchasesData.map((purchase) => (
                        <div key={purchase.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-red-600 border-red-600">- Purchase</Badge>
                              <span className="font-medium text-sm">
                                {purchase.purchase?.purchase_number || "N/A"}
                              </span>
                            </div>
                            <Badge variant={
                              purchase.purchase?.purchase_status === "received" ? "default" :
                              purchase.purchase?.purchase_status === "cancelled" ? "destructive" :
                              "secondary"
                            }>
                              {purchase.purchase?.purchase_status || "N/A"}
                            </Badge>
                          </div>
                          <Separator className="my-2" />
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Supplier:</span>{" "}
                              <span className="font-medium">{purchase.purchase?.supplier_name || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date:</span>{" "}
                              <span>{purchase.purchase?.purchase_date ? new Date(purchase.purchase.purchase_date).toLocaleDateString("en-IN") : "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Qty:</span>{" "}
                              <span className="font-medium">{purchase.quantity}</span>
                              {purchase.received_quantity !== null && purchase.received_quantity !== undefined && (
                                <span className="text-muted-foreground ml-1">(Rcvd: {purchase.received_quantity})</span>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Unit Price:</span>{" "}
                              <span>₹{Number(purchase.unit_price).toFixed(2)}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Total:</span>{" "}
                              <span className="font-semibold text-red-600">₹{Number(purchase.subtotal || purchase.total || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
