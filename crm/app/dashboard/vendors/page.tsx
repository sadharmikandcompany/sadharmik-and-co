"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, Store, ShoppingBag, Eye, Droplets } from "lucide-react"
import { toast } from "sonner"
import { VendorLooseStockDialog } from "@/components/ui/vendor-loose-stock-dialog"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"

// Indian States
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

type Vendor = {
  id: string
  vendor_name: string
  contact_person: string | null
  email: string | null
  mobile_primary: string
  whatsapp_number: string | null
  mobile_secondary_1: string | null
  mobile_secondary_2: string | null
  company_name: string | null
  gst_number: string | null
  pan_number: string | null
  vendor_type: string | null
  is_verified: boolean
  is_preferred: boolean
  credit_days: number
  credit_limit: number
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  pincode: string
  country: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  bank_account_holder_name: string | null
  bank_branch: string | null
  transport_vehicle: string | null
  transporter_name: string | null
  transporter_number: string | null
  vendor_notes: string | null
  internal_notes: string | null
  is_active: boolean
  user_id: string | null
  created_at: string
  updated_at: string | null
  stock_count?: number
}

type VendorFormData = {
  vendor_name: string
  contact_person: string
  email: string
  mobile_primary: string
  whatsapp_number: string
  whatsapp_same_as_primary: boolean
  mobile_secondary_1: string
  mobile_secondary_2: string
  company_name: string
  gst_number: string
  pan_number: string
  vendor_type: string
  credit_days: string
  credit_limit: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  pincode: string
  country: string
  bank_name: string
  bank_account_number: string
  bank_ifsc_code: string
  bank_account_holder_name: string
  bank_branch: string
  transport_vehicle: string
  transporter_name: string
  transporter_number: string
  vendor_notes: string
  internal_notes: string
  is_verified: boolean
  is_preferred: boolean
  is_active: boolean
  user_id: string
}

type Purchase = {
  id: string
  purchase_number: string | null
  vendor_id: string | null
  purchase_status: string | null
  payment_status: string | null
  total_amount: number | null
  created_at: string
}

type StockItem = {
  id: string
  variant_name: string
  category_name: string
  material_name: string
}

type ProductOption = {
  id: string
  name: string
  brand: string | null
  parent_category_name?: string
}

type VendorStock = {
  id: string
  stock_inventory_id: string
  vendor_price: number | null
  is_primary_supplier: boolean
}

type User = {
  id: string
  full_name: string | null
  email: string
  role: string
}

export default function VendorsPage() {
  const { role } = useUserRole()
  const { entityId, loading: entityLoading } = useEntityData()
  const isDistributor = role === "main_distributor" || role === "sub_distributor"
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  
  // Purchase history modal states
  const [purchaseHistoryOpen, setPurchaseHistoryOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([])
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState(false)
  const [purchaseStats, setPurchaseStats] = useState({ totalPurchases: 0, totalAmount: 0 })

  // Stock inventory states
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [selectedStockItems, setSelectedStockItems] = useState<Set<string>>(new Set())
  const [loadingStock, setLoadingStock] = useState(false)
  const [stockSearchTerm, setStockSearchTerm] = useState("")
  const [selectedStockCategory, setSelectedStockCategory] = useState<string>("all")
  const [selectedStockMaterial, setSelectedStockMaterial] = useState<string>("all")

  // Product catalog states
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>("all")

  // Loose stock dialog states
  const [looseStockDialogOpen, setLooseStockDialogOpen] = useState(false)
  const [looseStockVendor, setLooseStockVendor] = useState<Vendor | null>(null)

  // User linking states
  const [users, setUsers] = useState<User[]>([])

  const [formData, setFormData] = useState<VendorFormData>({
    vendor_name: "",
    contact_person: "",
    email: "",
    mobile_primary: "",
    whatsapp_number: "",
    whatsapp_same_as_primary: false,
    mobile_secondary_1: "",
    mobile_secondary_2: "",
    company_name: "",
    gst_number: "",
    pan_number: "",
    vendor_type: "",
    credit_days: "0",
    credit_limit: "0",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    bank_name: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_account_holder_name: "",
    bank_branch: "",
    transport_vehicle: "",
    transporter_name: "",
    transporter_number: "",
    vendor_notes: "",
    internal_notes: "",
    is_verified: false,
    is_preferred: false,
    is_active: true,
    user_id: "",
  })

  useEffect(() => {
    if (isDistributor && entityLoading) return
    fetchVendors()
    fetchUsers()
  }, [entityId, entityLoading])

  const fetchVendors = async () => {
    setLoading(true)
    let query = supabase
      .from("vendors")
      .select("*")
      .order("created_at", { ascending: false })

    // Distributors only see their own vendors
    if (isDistributor && entityId) {
      query = query.eq("distributor_id", entityId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching vendors:", error)
      toast.error("Failed to fetch vendors")
    } else {
      // Fetch stock count for each vendor
      const vendorsWithCounts = await Promise.all(
        (data || []).map(async (vendor) => {
          const { count } = await supabase
            .from("vendor_stock")
            .select("*", { count: "exact", head: true })
            .eq("vendor_id", vendor.id)

          return { ...vendor, stock_count: count || 0 }
        })
      )
      setVendors(vendorsWithCounts)
    }
    setLoading(false)
  }

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("role", "vendors")
      .order("full_name")

    if (error) {
      console.error("Error fetching users:", error)
      toast.error("Failed to fetch users")
    } else {
      setUsers(data || [])
    }
  }

  const fetchPurchaseHistory = async (vendorId: string) => {
    setPurchaseHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })

      if (error) throw error

      setPurchaseHistory(data || [])

      // Calculate totals
      const totalPurchases = data?.length || 0
      const totalAmount = data?.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0) || 0
      setPurchaseStats({ totalPurchases, totalAmount })
    } catch (error) {
      console.error("Error fetching purchase history:", error)
      toast.error("Failed to fetch purchase history")
      setPurchaseHistory([])
      setPurchaseStats({ totalPurchases: 0, totalAmount: 0 })
    } finally {
      setPurchaseHistoryLoading(false)
    }
  }

  const fetchStockItems = async () => {
    setLoadingStock(true)
    try {
      const { data, error } = await supabase
        .from("stock_inventory")
        .select(`
          id,
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
        .order("id")

      if (error) throw error

      const transformedData: StockItem[] = (data || []).map((item: any) => ({
        id: item.id,
        variant_name: item.product_variants.variant_name,
        category_name: item.product_variants.product_categories.name,
        material_name: item.packaging_materials.name,
      }))

      setStockItems(transformedData)
    } catch (error) {
      console.error("Error fetching stock items:", error)
      toast.error("Failed to fetch stock items")
    } finally {
      setLoadingStock(false)
    }
  }

  const fetchVendorStock = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from("vendor_stock")
        .select("stock_inventory_id")
        .eq("vendor_id", vendorId)

      if (error) throw error

      const stockIds = new Set((data || []).map((item: any) => item.stock_inventory_id))
      setSelectedStockItems(stockIds)
    } catch (error) {
      console.error("Error fetching vendor stock:", error)
      toast.error("Failed to fetch vendor stock items")
    }
  }

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          brand,
          parent_category:parent_category_id(category_name)
        `)
        .eq("is_active", true)
        .order("name")

      if (error) throw error

      const transformed: ProductOption[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        parent_category_name: p.parent_category?.category_name,
      }))

      setProducts(transformed)
    } catch (error) {
      console.error("Error fetching products:", error)
      toast.error("Failed to fetch products")
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchVendorProducts = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from("vendor_products")
        .select("product_id")
        .eq("vendor_id", vendorId)

      if (error) throw error

      const productIds = new Set((data || []).map((item: any) => item.product_id))
      setSelectedProducts(productIds)
    } catch (error) {
      console.error("Error fetching vendor products:", error)
      toast.error("Failed to fetch vendor products")
    }
  }

  const handleViewPurchaseHistory = (vendor: Vendor) => {
    setSelectedVendor(vendor)
    setPurchaseHistoryOpen(true)
    fetchPurchaseHistory(vendor.id)
  }

  const handleOpenDialog = async (vendor?: Vendor) => {
    setFormErrors({})
    setStockSearchTerm("") // Reset stock search
    setSelectedStockCategory("all") // Reset category filter
    setSelectedStockMaterial("all") // Reset material filter
    setProductSearchTerm("")
    setSelectedProductCategory("all")

    // Fetch stock items and products in parallel
    await Promise.all([fetchStockItems(), fetchProducts()])

    if (vendor) {
      setEditingVendor(vendor)
      setFormData({
        vendor_name: vendor.vendor_name,
        contact_person: vendor.contact_person || "",
        email: vendor.email || "",
        mobile_primary: vendor.mobile_primary,
        whatsapp_number: vendor.whatsapp_number || "",
        whatsapp_same_as_primary: vendor.whatsapp_number === vendor.mobile_primary,
        mobile_secondary_1: vendor.mobile_secondary_1 || "",
        mobile_secondary_2: vendor.mobile_secondary_2 || "",
        company_name: vendor.company_name || "",
        gst_number: vendor.gst_number || "",
        pan_number: vendor.pan_number || "",
        vendor_type: vendor.vendor_type || "",
        credit_days: vendor.credit_days?.toString() || "0",
        credit_limit: vendor.credit_limit?.toString() || "0",
        address_line1: vendor.address_line1,
        address_line2: vendor.address_line2 || "",
        city: vendor.city,
        state: vendor.state,
        pincode: vendor.pincode,
        country: vendor.country || "India",
        bank_name: vendor.bank_name || "",
        bank_account_number: vendor.bank_account_number || "",
        bank_ifsc_code: vendor.bank_ifsc_code || "",
        bank_account_holder_name: vendor.bank_account_holder_name || "",
        bank_branch: vendor.bank_branch || "",
        transport_vehicle: vendor.transport_vehicle || "",
        transporter_name: vendor.transporter_name || "",
        transporter_number: vendor.transporter_number || "",
        vendor_notes: vendor.vendor_notes || "",
        internal_notes: vendor.internal_notes || "",
        is_verified: vendor.is_verified,
        is_preferred: vendor.is_preferred,
        is_active: vendor.is_active,
        user_id: vendor.user_id || "",
      })
      // Fetch vendor's stock items and product selections
      await Promise.all([fetchVendorStock(vendor.id), fetchVendorProducts(vendor.id)])
    } else {
      setEditingVendor(null)
      setSelectedStockItems(new Set())
      setSelectedProducts(new Set())
      setFormData({
        vendor_name: "",
        contact_person: "",
        email: "",
        mobile_primary: "",
        whatsapp_number: "",
        whatsapp_same_as_primary: false,
        mobile_secondary_1: "",
        mobile_secondary_2: "",
        company_name: "",
        gst_number: "",
        pan_number: "",
        vendor_type: "",
        credit_days: "0",
        credit_limit: "0",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        pincode: "",
        country: "India",
        bank_name: "",
        bank_account_number: "",
        bank_ifsc_code: "",
        bank_account_holder_name: "",
        bank_branch: "",
        transport_vehicle: "",
        transporter_name: "",
        transporter_number: "",
        vendor_notes: "",
        internal_notes: "",
        is_verified: false,
        is_preferred: false,
        is_active: true,
        user_id: "",
      })
    }
    setDialogOpen(true)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    // Vendor name validation (required, min length)
    if (!formData.vendor_name.trim()) {
      errors.vendor_name = "Vendor name is required"
    } else if (formData.vendor_name.trim().length < 2) {
      errors.vendor_name = "Vendor name must be at least 2 characters"
    }

    // Email validation - enhanced regex for better validation
    if (formData.email && formData.email.trim().length > 0) {
      const emailRegex = /^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}$/
      if (!formData.email.match(emailRegex)) {
        errors.email = "Please enter a valid email address"
      }
    }

    // GST validation - check pattern (2 digits + 10 alphanumeric + 1 digit + 1 alphabet + 1 digit)
    if (formData.gst_number && formData.gst_number.trim().length > 0) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
      if (formData.gst_number.trim().length !== 15) {
        errors.gst_number = "GST number must be exactly 15 characters"
      } else if (!formData.gst_number.toUpperCase().match(gstRegex)) {
        errors.gst_number = "Invalid GST number format (e.g., 22AAAAA0000A1Z5)"
      }
    }

    // PAN number validation (5 letters + 4 digits + 1 letter)
    if (formData.pan_number && formData.pan_number.trim().length > 0) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/
      if (formData.pan_number.trim().length !== 10) {
        errors.pan_number = "PAN number must be exactly 10 characters"
      } else if (!formData.pan_number.toUpperCase().match(panRegex)) {
        errors.pan_number = "Invalid PAN number format (e.g., AAAAA1234A)"
      }
    }

    // Mobile validations
    const mobileRegex = /^[6-9]\d{9}$/  // Indian mobile numbers start with 6-9

    // Primary mobile (required)
    if (!formData.mobile_primary) {
      errors.mobile_primary = "Primary mobile number is required"
    } else if (!formData.mobile_primary.match(mobileRegex)) {
      errors.mobile_primary = "Invalid mobile number (must be 10 digits starting with 6-9)"
    }

    // WhatsApp number (if provided and not same as primary)
    if (!formData.whatsapp_same_as_primary && formData.whatsapp_number && formData.whatsapp_number.trim().length > 0) {
      if (!formData.whatsapp_number.match(mobileRegex)) {
        errors.whatsapp_number = "Invalid WhatsApp number (must be 10 digits starting with 6-9)"
      }
    }

    // Secondary mobile 1 (if provided)
    if (formData.mobile_secondary_1 && formData.mobile_secondary_1.trim().length > 0) {
      if (!formData.mobile_secondary_1.match(mobileRegex)) {
        errors.mobile_secondary_1 = "Invalid mobile number (must be 10 digits starting with 6-9)"
      }
    }

    // Secondary mobile 2 (if provided)
    if (formData.mobile_secondary_2 && formData.mobile_secondary_2.trim().length > 0) {
      if (!formData.mobile_secondary_2.match(mobileRegex)) {
        errors.mobile_secondary_2 = "Invalid mobile number (must be 10 digits starting with 6-9)"
      }
    }

    // Credit days validation
    if (formData.credit_days) {
      const creditDays = parseInt(formData.credit_days)
      if (isNaN(creditDays) || creditDays < 0) {
        errors.credit_days = "Credit days must be a positive number"
      } else if (creditDays > 365) {
        errors.credit_days = "Credit days cannot exceed 365"
      }
    }

    // Credit limit validation
    if (formData.credit_limit) {
      const creditLimit = parseFloat(formData.credit_limit)
      if (isNaN(creditLimit) || creditLimit < 0) {
        errors.credit_limit = "Credit limit must be a positive number"
      } else if (creditLimit > 99999999) {
        errors.credit_limit = "Credit limit seems too high, please verify"
      }
    }

    // Required address fields
    if (!formData.address_line1.trim()) {
      errors.address_line1 = "Address is required"
    } else if (formData.address_line1.trim().length < 5) {
      errors.address_line1 = "Address must be at least 5 characters"
    }

    if (!formData.city.trim()) {
      errors.city = "City is required"
    } else if (formData.city.trim().length < 2) {
      errors.city = "City name must be at least 2 characters"
    } else if (!/^[a-zA-Z\s]+$/.test(formData.city.trim())) {
      errors.city = "City name should only contain letters and spaces"
    }

    if (!formData.state.trim()) {
      errors.state = "State is required"
    }

    // Pincode validation (6 digits for India)
    if (!formData.pincode.trim()) {
      errors.pincode = "Pincode is required"
    } else if (!/^[1-9]\d{5}$/.test(formData.pincode.trim())) {
      errors.pincode = "Invalid pincode (must be 6 digits, cannot start with 0)"
    }

    // Bank details validation (if provided)
    if (formData.bank_name && formData.bank_name.trim().length > 0 && formData.bank_name.trim().length < 3) {
      errors.bank_name = "Bank name must be at least 3 characters"
    }

    if (formData.bank_account_number && formData.bank_account_number.trim().length > 0) {
      const accountNumberRegex = /^[0-9]{9,18}$/
      if (!formData.bank_account_number.match(accountNumberRegex)) {
        errors.bank_account_number = "Invalid account number (9-18 digits only)"
      }
    }

    if (formData.bank_ifsc_code && formData.bank_ifsc_code.trim().length > 0) {
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
      if (!formData.bank_ifsc_code.toUpperCase().match(ifscRegex)) {
        errors.bank_ifsc_code = "Invalid IFSC code format (e.g., SBIN0000123)"
      }
    }

    if (formData.bank_account_holder_name && formData.bank_account_holder_name.trim().length > 0) {
      if (formData.bank_account_holder_name.trim().length < 2) {
        errors.bank_account_holder_name = "Account holder name must be at least 2 characters"
      } else if (!/^[a-zA-Z\s.]+$/.test(formData.bank_account_holder_name.trim())) {
        errors.bank_account_holder_name = "Account holder name should only contain letters, spaces, and dots"
      }
    }

    // Transport validation
    if (formData.transport_vehicle && formData.transport_vehicle.trim().length > 0 && formData.transport_vehicle.trim().length < 2) {
      errors.transport_vehicle = "Transport vehicle must be at least 2 characters"
    }

    if (formData.transporter_name && formData.transporter_name.trim().length > 0) {
      if (formData.transporter_name.trim().length < 2) {
        errors.transporter_name = "Transporter name must be at least 2 characters"
      } else if (!/^[a-zA-Z\s.]+$/.test(formData.transporter_name.trim())) {
        errors.transporter_name = "Transporter name should only contain letters, spaces, and dots"
      }
    }

    if (formData.transporter_number && formData.transporter_number.trim().length > 0) {
      if (!formData.transporter_number.match(mobileRegex)) {
        errors.transporter_number = "Invalid mobile number (must be 10 digits starting with 6-9)"
      }
    }

    // Validate that all bank fields are provided together if any one is filled
    const bankFields = [
      formData.bank_name,
      formData.bank_account_number,
      formData.bank_ifsc_code,
      formData.bank_account_holder_name
    ]
    const filledBankFields = bankFields.filter(field => field && field.trim().length > 0)

    if (filledBankFields.length > 0 && filledBankFields.length < 4) {
      if (!formData.bank_name || formData.bank_name.trim().length === 0) {
        errors.bank_name = "Bank name is required when providing bank details"
      }
      if (!formData.bank_account_number || formData.bank_account_number.trim().length === 0) {
        errors.bank_account_number = "Account number is required when providing bank details"
      }
      if (!formData.bank_ifsc_code || formData.bank_ifsc_code.trim().length === 0) {
        errors.bank_ifsc_code = "IFSC code is required when providing bank details"
      }
      if (!formData.bank_account_holder_name || formData.bank_account_holder_name.trim().length === 0) {
        errors.bank_account_holder_name = "Account holder name is required when providing bank details"
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix the validation errors before saving")
      return
    }

    setSaving(true)

    try {
      const vendorData: Record<string, any> = {
        vendor_name: formData.vendor_name,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        mobile_primary: formData.mobile_primary,
        whatsapp_number: formData.whatsapp_same_as_primary
          ? formData.mobile_primary
          : formData.whatsapp_number || null,
        whatsapp_same_as_primary: formData.whatsapp_same_as_primary,
        mobile_secondary_1: formData.mobile_secondary_1 || null,
        mobile_secondary_2: formData.mobile_secondary_2 || null,
        company_name: formData.company_name || null,
        gst_number: formData.gst_number || null,
        pan_number: formData.pan_number || null,
        vendor_type: formData.vendor_type || null,
        credit_days: parseInt(formData.credit_days) || 0,
        credit_limit: parseFloat(formData.credit_limit) || 0,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2 || null,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        country: formData.country,
        bank_name: formData.bank_name || null,
        bank_account_number: formData.bank_account_number || null,
        bank_ifsc_code: formData.bank_ifsc_code || null,
        bank_account_holder_name: formData.bank_account_holder_name || null,
        bank_branch: formData.bank_branch || null,
        transport_vehicle: formData.transport_vehicle || null,
        transporter_name: formData.transporter_name || null,
        transporter_number: formData.transporter_number || null,
        vendor_notes: formData.vendor_notes || null,
        internal_notes: formData.internal_notes || null,
        is_verified: formData.is_verified,
        is_preferred: formData.is_preferred,
        is_active: formData.is_active,
        user_id: formData.user_id || null,
      }

      // Attach distributor_id when a distributor creates a vendor
      if (isDistributor && entityId && !editingVendor) {
        vendorData.distributor_id = entityId
      }

      let vendorId: string

      if (editingVendor) {
        const { error } = await supabase
          .from("vendors")
          .update(vendorData)
          .eq("id", editingVendor.id)

        if (error) throw error
        vendorId = editingVendor.id
        toast.success("Vendor updated successfully")
      } else {
        const { data, error } = await supabase
          .from("vendors")
          .insert([vendorData])
          .select()
          .single()

        if (error) throw error
        vendorId = data.id
        toast.success("Vendor created successfully")
      }

      // Update vendor_stock relationships
      // Delete existing relationships
      await supabase
        .from("vendor_stock")
        .delete()
        .eq("vendor_id", vendorId)

      // Insert new relationships
      if (selectedStockItems.size > 0) {
        const vendorStockData = Array.from(selectedStockItems).map(stockId => ({
          vendor_id: vendorId,
          stock_inventory_id: stockId,
        }))

        const { error: stockError } = await supabase
          .from("vendor_stock")
          .insert(vendorStockData)

        if (stockError) throw stockError
      }

      // Update vendor_products relationships (admin & factories only;
      // link table only — does NOT modify product stock quantities)
      if (role === "admin" || role === "factories") {
        await supabase
          .from("vendor_products")
          .delete()
          .eq("vendor_id", vendorId)

        if (selectedProducts.size > 0) {
          const vendorProductData = Array.from(selectedProducts).map(productId => ({
            vendor_id: vendorId,
            product_id: productId,
          }))

          const { error: productError } = await supabase
            .from("vendor_products")
            .insert(vendorProductData)

          if (productError) throw productError
        }
      }

      setDialogOpen(false)
      fetchVendors()
    } catch (error: unknown) {
      console.error("Error saving vendor:", error)

      if (error && typeof error === "object" && "code" in error) {
        const dbError = error as { code: string; message: string }

        if (dbError.code === "23514") {
          if (dbError.message.includes("gst_number")) {
            toast.error("GST number must be exactly 15 characters or leave it empty")
          } else {
            toast.error("Invalid data format. Please check all fields and try again.")
          }
        } else if (dbError.code === "23505") {
          if (dbError.message.includes("email")) {
            toast.error("This email is already registered")
          } else {
            toast.error("A vendor with this information already exists")
          }
        } else {
          const errorMessage = error instanceof Error ? error.message : "Failed to save vendor"
          toast.error(errorMessage)
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : "Failed to save vendor"
        toast.error(errorMessage)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingVendor) return

    try {
      const { error } = await supabase
        .from("vendors")
        .delete()
        .eq("id", deletingVendor.id)

      if (error) {
        if (error.code === "23503") {
          toast.error("Cannot delete this vendor because they have associated purchases. Please delete or reassign their purchases first.")
          return
        }
        throw error
      }

      toast.success("Vendor deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingVendor(null)
      fetchVendors()
    } catch (error: unknown) {
      console.error("Error deleting vendor:", error)
      const errorMessage = error instanceof Error ? error.message : (error as any)?.message || "Failed to delete vendor"
      toast.error(errorMessage)
    }
  }

  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vendor.contact_person && vendor.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vendor.email && vendor.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      vendor.mobile_primary.includes(searchTerm) ||
      (vendor.company_name && vendor.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Vendors</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Vendors
          </h1>
          <p className="text-muted-foreground">Manage your supplier and vendor database</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor List</CardTitle>
          <CardDescription>A list of all vendors with their details</CardDescription>
          <div className="mt-4">
            <Input
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Transport</TableHead>
                  <TableHead>Stock Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      No vendors found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/vendors/${vendor.id}`}
                          className="hover:underline text-blue-600 hover:text-blue-800"
                        >
                          {vendor.vendor_name}
                        </Link>
                      </TableCell>
                      <TableCell>{vendor.contact_person || "-"}</TableCell>
                      <TableCell>{vendor.email || "-"}</TableCell>
                      <TableCell>{vendor.mobile_primary}</TableCell>
                      <TableCell>
                        {vendor.vendor_type ? (
                          <Badge variant="outline">
                            {vendor.vendor_type.charAt(0).toUpperCase() + vendor.vendor_type.slice(1)}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.transport_vehicle || vendor.transporter_name ? (
                          <div className="text-sm">
                            <div className="font-medium">{vendor.transport_vehicle || "-"}</div>
                            {vendor.transporter_name && (
                              <div className="text-xs text-muted-foreground">{vendor.transporter_name}</div>
                            )}
                            {vendor.transporter_number && (
                              <div className="text-xs text-muted-foreground">📱 {vendor.transporter_number}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-semibold">
                          {vendor.stock_count || 0} items
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={vendor.is_active ? "default" : "secondary"}>
                          {vendor.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {vendor.is_verified && <Badge variant="default">Verified</Badge>}
                          {vendor.is_preferred && <Badge variant="outline">Preferred</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewPurchaseHistory(vendor)}
                            title="View Purchase History"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setLooseStockVendor(vendor)
                              setLooseStockDialogOpen(true)
                            }}
                            title="Manage Loose Stock Categories"
                          >
                            <Droplets className="h-4 w-4 text-orange-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(vendor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingVendor(vendor)
                              setDeleteDialogOpen(true)
                            }}
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
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredVendors.length} of {vendors.length} vendors
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="!max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
            <DialogDescription>
              {editingVendor ? "Update vendor information" : "Enter vendor details to create a new vendor"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <p className="text-sm text-muted-foreground">Vendor and business details</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor_name">Vendor/Business Name *</Label>
                  <Input
                    id="vendor_name"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    required
                    className={formErrors.vendor_name ? "border-red-500" : ""}
                  />
                  {formErrors.vendor_name && (
                    <p className="text-sm text-red-500">{formErrors.vendor_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={formErrors.email ? "border-red-500" : ""}
                    placeholder="Optional"
                  />
                  {formErrors.email && <p className="text-sm text-red-500">{formErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor_type">Vendor Type</Label>
                  <Select value={formData.vendor_type} onValueChange={(value) => setFormData({ ...formData, vendor_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manufacturer">Manufacturer</SelectItem>
                      <SelectItem value="wholesaler">Wholesaler</SelectItem>
                      <SelectItem value="distributor">Distributor</SelectItem>
                      <SelectItem value="trader">Trader</SelectItem>
                      <SelectItem value="importer">Importer</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company/Firm Name</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user_id">Link User Account</Label>
                  <Select
                    value={formData.user_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, user_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No user linked" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No User Linked</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email} ({user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <p className="text-sm text-muted-foreground">Phone numbers and contact details</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile_primary">Mobile Primary *</Label>
                <Input
                  id="mobile_primary"
                  value={formData.mobile_primary}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "")
                    setFormData({ ...formData, mobile_primary: value })
                  }}
                  required
                  maxLength={10}
                  placeholder="10 digit mobile number"
                  className={formErrors.mobile_primary ? "border-red-500" : ""}
                />
                {formErrors.mobile_primary && (
                  <p className="text-sm text-red-500">{formErrors.mobile_primary}</p>
                )}
                {formData.mobile_primary && formData.mobile_primary.length > 0 && !formErrors.mobile_primary && (
                  <p className="text-sm text-muted-foreground">{formData.mobile_primary.length}/10 digits</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                  <Input
                    id="whatsapp_number"
                    value={formData.whatsapp_same_as_primary ? formData.mobile_primary : formData.whatsapp_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, whatsapp_number: value, whatsapp_same_as_primary: false })
                    }}
                    disabled={formData.whatsapp_same_as_primary}
                    maxLength={10}
                    placeholder="10 digit number"
                    className={formErrors.whatsapp_number ? "border-red-500" : ""}
                  />
                  {formErrors.whatsapp_number && (
                    <p className="text-sm text-red-500">{formErrors.whatsapp_number}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <label className="flex items-center gap-2 h-10">
                    <input
                      type="checkbox"
                      checked={formData.whatsapp_same_as_primary}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setFormData({
                          ...formData,
                          whatsapp_same_as_primary: checked,
                          whatsapp_number: checked ? formData.mobile_primary : formData.whatsapp_number,
                        })
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Same as Primary</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_1">Mobile Secondary 1</Label>
                  <Input
                    id="mobile_secondary_1"
                    value={formData.mobile_secondary_1}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, mobile_secondary_1: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                    className={formErrors.mobile_secondary_1 ? "border-red-500" : ""}
                  />
                  {formErrors.mobile_secondary_1 && (
                    <p className="text-sm text-red-500">{formErrors.mobile_secondary_1}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_2">Mobile Secondary 2</Label>
                  <Input
                    id="mobile_secondary_2"
                    value={formData.mobile_secondary_2}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, mobile_secondary_2: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                    className={formErrors.mobile_secondary_2 ? "border-red-500" : ""}
                  />
                  {formErrors.mobile_secondary_2 && (
                    <p className="text-sm text-red-500">{formErrors.mobile_secondary_2}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Business Details */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Business Details</h3>
                <p className="text-sm text-muted-foreground">Tax and business information</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input
                    id="gst_number"
                    value={formData.gst_number}
                    onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                    maxLength={15}
                    placeholder="15 characters"
                    className={formErrors.gst_number ? "border-red-500" : ""}
                  />
                  {formErrors.gst_number && (
                    <p className="text-sm text-red-500">{formErrors.gst_number}</p>
                  )}
                  {formData.gst_number && formData.gst_number.length > 0 && !formErrors.gst_number && (
                    <p className="text-sm text-muted-foreground">{formData.gst_number.length}/15 characters</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_number">PAN Number</Label>
                  <Input
                    id="pan_number"
                    value={formData.pan_number}
                    onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    maxLength={10}
                    placeholder="10 characters"
                    className={formErrors.pan_number ? "border-red-500" : ""}
                  />
                  {formErrors.pan_number && (
                    <p className="text-sm text-red-500">{formErrors.pan_number}</p>
                  )}
                  {formData.pan_number && formData.pan_number.length > 0 && !formErrors.pan_number && (
                    <p className="text-sm text-muted-foreground">{formData.pan_number.length}/10 characters</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="credit_days">Credit Days</Label>
                  <Input
                    id="credit_days"
                    type="number"
                    min="0"
                    max="365"
                    value={formData.credit_days}
                    onChange={(e) => setFormData({ ...formData, credit_days: e.target.value })}
                    className={formErrors.credit_days ? "border-red-500" : ""}
                  />
                  {formErrors.credit_days && (
                    <p className="text-sm text-red-500">{formErrors.credit_days}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit_limit">Credit Limit (₹)</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    className={formErrors.credit_limit ? "border-red-500" : ""}
                  />
                  {formErrors.credit_limit && (
                    <p className="text-sm text-red-500">{formErrors.credit_limit}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Address Information *</h3>
                <p className="text-sm text-muted-foreground">Vendor&apos;s business address</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_line1">Address Line 1 *</Label>
                <Input
                  id="address_line1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  required
                  className={formErrors.address_line1 ? "border-red-500" : ""}
                />
                {formErrors.address_line1 && (
                  <p className="text-sm text-red-500">{formErrors.address_line1}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                    className={formErrors.city ? "border-red-500" : ""}
                  />
                  {formErrors.city && <p className="text-xs text-red-500">{formErrors.city}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
                    <SelectTrigger className={formErrors.state ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.state && <p className="text-xs text-red-500">{formErrors.state}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    required
                    maxLength={6}
                    className={formErrors.pincode ? "border-red-500" : ""}
                  />
                  {formErrors.pincode && <p className="text-xs text-red-500">{formErrors.pincode}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Bank Details</h3>
                <p className="text-sm text-muted-foreground">Payment and banking information (optional)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className={formErrors.bank_name ? "border-red-500" : ""}
                  />
                  {formErrors.bank_name && (
                    <p className="text-sm text-red-500">{formErrors.bank_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_holder_name">Account Holder Name</Label>
                  <Input
                    id="bank_account_holder_name"
                    value={formData.bank_account_holder_name}
                    onChange={(e) => setFormData({ ...formData, bank_account_holder_name: e.target.value })}
                    className={formErrors.bank_account_holder_name ? "border-red-500" : ""}
                  />
                  {formErrors.bank_account_holder_name && (
                    <p className="text-sm text-red-500">{formErrors.bank_account_holder_name}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    className={formErrors.bank_account_number ? "border-red-500" : ""}
                    placeholder="9-18 digits"
                  />
                  {formErrors.bank_account_number && (
                    <p className="text-xs text-red-500">{formErrors.bank_account_number}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_ifsc_code">IFSC Code</Label>
                  <Input
                    id="bank_ifsc_code"
                    value={formData.bank_ifsc_code}
                    onChange={(e) => setFormData({ ...formData, bank_ifsc_code: e.target.value.toUpperCase() })}
                    className={formErrors.bank_ifsc_code ? "border-red-500" : ""}
                    maxLength={11}
                    placeholder="e.g., SBIN0000123"
                  />
                  {formErrors.bank_ifsc_code && (
                    <p className="text-xs text-red-500">{formErrors.bank_ifsc_code}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_branch">Branch</Label>
                  <Input
                    id="bank_branch"
                    value={formData.bank_branch}
                    onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Transport Information */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Transport Information</h3>
                <p className="text-sm text-muted-foreground">Delivery and transport details (optional)</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transport_vehicle">Transport Vehicle</Label>
                  <Input
                    id="transport_vehicle"
                    value={formData.transport_vehicle}
                    onChange={(e) => setFormData({ ...formData, transport_vehicle: e.target.value })}
                    placeholder="e.g., Truck, Tempo, Van"
                    className={formErrors.transport_vehicle ? "border-red-500" : ""}
                  />
                  {formErrors.transport_vehicle && (
                    <p className="text-xs text-red-500">{formErrors.transport_vehicle}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transporter_name">Transporter Name</Label>
                  <Input
                    id="transporter_name"
                    value={formData.transporter_name}
                    onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                    placeholder="Driver or transporter name"
                    className={formErrors.transporter_name ? "border-red-500" : ""}
                  />
                  {formErrors.transporter_name && (
                    <p className="text-xs text-red-500">{formErrors.transporter_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transporter_number">Transporter Number</Label>
                  <Input
                    id="transporter_number"
                    value={formData.transporter_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, transporter_number: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                    className={formErrors.transporter_number ? "border-red-500" : ""}
                  />
                  {formErrors.transporter_number && (
                    <p className="text-xs text-red-500">{formErrors.transporter_number}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Notes</h3>
                <p className="text-sm text-muted-foreground">Additional information</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_notes">Vendor Notes</Label>
                <Textarea
                  id="vendor_notes"
                  value={formData.vendor_notes}
                  onChange={(e) => setFormData({ ...formData, vendor_notes: e.target.value })}
                  rows={2}
                  placeholder="Notes visible to vendor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal_notes">Internal Notes</Label>
                <Textarea
                  id="internal_notes"
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  rows={2}
                  placeholder="Internal notes (not visible to vendor)"
                />
              </div>
            </div>

            {/* Status & Classification */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Status & Classification</h3>
                <p className="text-sm text-muted-foreground">Vendor status and tags</p>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_verified}
                    onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Verified Vendor</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_preferred}
                    onChange={(e) => setFormData({ ...formData, is_preferred: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Preferred Vendor</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>

            {/* Stock Items */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Stock Items Supplied</h3>
                <p className="text-sm text-muted-foreground">Select which stock items this vendor can supply</p>
              </div>
              {loadingStock ? (
                <p className="text-sm text-muted-foreground">Loading stock items...</p>
              ) : (
                (() => {
                  // Unique categories from loaded stock items
                  const uniqueStockCategories = Array.from(
                    new Set(stockItems.map((item) => item.category_name))
                  ).sort()

                  // Items in the active category (before material/search filter) —
                  // used to compute the list of available materials and their counts
                  const categoryScopedItems = stockItems.filter(
                    (item) =>
                      selectedStockCategory === "all" ||
                      item.category_name === selectedStockCategory
                  )
                  const uniqueStockMaterials = Array.from(
                    new Set(categoryScopedItems.map((item) => item.material_name))
                  ).sort()

                  const searchLower = stockSearchTerm.toLowerCase()
                  const filteredStockItems = stockItems.filter((item) => {
                    const matchesCategory =
                      selectedStockCategory === "all" ||
                      item.category_name === selectedStockCategory
                    const matchesMaterial =
                      selectedStockMaterial === "all" ||
                      item.material_name === selectedStockMaterial
                    const matchesSearch =
                      !stockSearchTerm ||
                      item.category_name.toLowerCase().includes(searchLower) ||
                      item.variant_name.toLowerCase().includes(searchLower) ||
                      item.material_name.toLowerCase().includes(searchLower)
                    return matchesCategory && matchesMaterial && matchesSearch
                  })

                  // Count selected within currently visible items (for "select visible" UI)
                  const visibleIds = filteredStockItems.map((i) => i.id)
                  const selectedVisibleCount = visibleIds.filter((id) =>
                    selectedStockItems.has(id)
                  ).length
                  const allVisibleSelected =
                    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length

                  const toggleVisible = (select: boolean) => {
                    const newSelected = new Set(selectedStockItems)
                    if (select) {
                      visibleIds.forEach((id) => newSelected.add(id))
                    } else {
                      visibleIds.forEach((id) => newSelected.delete(id))
                    }
                    setSelectedStockItems(newSelected)
                  }

                  // Group filtered items by category for sectioned display
                  const groupedByCategory = filteredStockItems.reduce<
                    Record<string, StockItem[]>
                  >((acc, item) => {
                    if (!acc[item.category_name]) acc[item.category_name] = []
                    acc[item.category_name].push(item)
                    return acc
                  }, {})
                  const orderedCategoryKeys = Object.keys(groupedByCategory).sort()

                  return (
                    <>
                      {/* Search Input for Stock Items */}
                      <div className="space-y-2">
                        <Input
                          placeholder="Search stock items by category, variant, or material..."
                          value={stockSearchTerm}
                          onChange={(e) => setStockSearchTerm(e.target.value)}
                          className="max-w-full"
                        />
                      </div>

                      {/* Category Filter Buttons (like /dashboard/stock) */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">
                          Category
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant={selectedStockCategory === "all" ? "default" : "outline"}
                            onClick={() => {
                              setSelectedStockCategory("all")
                              setSelectedStockMaterial("all")
                            }}
                            size="sm"
                          >
                            All ({stockItems.length})
                          </Button>
                          {uniqueStockCategories.map((category) => {
                            const count = stockItems.filter(
                              (i) => i.category_name === category
                            ).length
                            return (
                              <Button
                                key={category}
                                type="button"
                                variant={selectedStockCategory === category ? "default" : "outline"}
                                onClick={() => {
                                  setSelectedStockCategory(category)
                                  setSelectedStockMaterial("all")
                                }}
                                size="sm"
                              >
                                {category} ({count})
                              </Button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Material Filter Buttons (second-level) */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">
                          Material
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant={selectedStockMaterial === "all" ? "default" : "outline"}
                            onClick={() => setSelectedStockMaterial("all")}
                            size="sm"
                          >
                            All ({categoryScopedItems.length})
                          </Button>
                          {uniqueStockMaterials.map((material) => {
                            const count = categoryScopedItems.filter(
                              (i) => i.material_name === material
                            ).length
                            return (
                              <Button
                                key={material}
                                type="button"
                                variant={selectedStockMaterial === material ? "default" : "outline"}
                                onClick={() => setSelectedStockMaterial(material)}
                                size="sm"
                              >
                                {material} ({count})
                              </Button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Select/Clear visible shortcuts */}
                      {filteredStockItems.length > 0 && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => toggleVisible(!allVisibleSelected)}
                          >
                            {allVisibleSelected ? "Clear visible" : "Select visible"}
                          </Button>
                          <span className="text-xs text-muted-foreground self-center">
                            {selectedVisibleCount} of {filteredStockItems.length} visible selected
                          </span>
                        </div>
                      )}

                      <div className="max-h-96 overflow-y-auto border rounded-md p-4">
                        {stockItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No stock items available
                          </p>
                        ) : filteredStockItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No stock items found
                            {stockSearchTerm ? ` matching "${stockSearchTerm}"` : ""}
                            {selectedStockCategory !== "all"
                              ? ` in ${selectedStockCategory}`
                              : ""}
                            {selectedStockMaterial !== "all"
                              ? ` with material "${selectedStockMaterial}"`
                              : ""}
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {orderedCategoryKeys.map((categoryName) => (
                              <div key={categoryName} className="space-y-1">
                                <div className="sticky top-0 bg-background py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                                  {categoryName} ({groupedByCategory[categoryName].length})
                                </div>
                                {groupedByCategory[categoryName].map((item) => (
                                  <label
                                    key={item.id}
                                    className="flex items-start gap-3 p-2 hover:bg-muted rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedStockItems.has(item.id)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedStockItems)
                                        if (e.target.checked) {
                                          newSelected.add(item.id)
                                        } else {
                                          newSelected.delete(item.id)
                                        }
                                        setSelectedStockItems(newSelected)
                                      }}
                                      className="h-4 w-4 mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium">
                                        {item.variant_name} - {item.material_name}
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <div>
                          {stockSearchTerm ||
                          selectedStockCategory !== "all" ||
                          selectedStockMaterial !== "all" ? (
                            <>
                              Showing {filteredStockItems.length} of {stockItems.length} items
                            </>
                          ) : (
                            `${stockItems.length} total items`
                          )}
                        </div>
                        <div className="font-medium">
                          {selectedStockItems.size} item
                          {selectedStockItems.size !== 1 ? "s" : ""} selected
                        </div>
                      </div>
                    </>
                  )
                })()
              )}
            </div>

            {/* Products (admin & factories only) */}
            {(role === "admin" || role === "factories") && (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-lg font-semibold">Products Supplied</h3>
                  <p className="text-sm text-muted-foreground">
                    Select catalog products this vendor supplies. This is a reference link only —
                    product stock quantities are not modified.
                  </p>
                </div>
                {loadingProducts ? (
                  <p className="text-sm text-muted-foreground">Loading products...</p>
                ) : (
                  (() => {
                    const uniqueProductCategories = Array.from(
                      new Set(
                        products
                          .map((p) => p.parent_category_name)
                          .filter((n): n is string => Boolean(n))
                      )
                    ).sort()

                    const searchLower = productSearchTerm.toLowerCase()
                    const filteredProducts = products.filter((p) => {
                      const matchesCategory =
                        selectedProductCategory === "all" ||
                        p.parent_category_name === selectedProductCategory
                      const matchesSearch =
                        !productSearchTerm ||
                        p.name.toLowerCase().includes(searchLower) ||
                        (p.brand?.toLowerCase().includes(searchLower) ?? false) ||
                        (p.parent_category_name?.toLowerCase().includes(searchLower) ?? false)
                      return matchesCategory && matchesSearch
                    })

                    const visibleIds = filteredProducts.map((p) => p.id)
                    const selectedVisibleCount = visibleIds.filter((id) =>
                      selectedProducts.has(id)
                    ).length
                    const allVisibleSelected =
                      visibleIds.length > 0 && selectedVisibleCount === visibleIds.length

                    const toggleVisible = (select: boolean) => {
                      const newSelected = new Set(selectedProducts)
                      if (select) {
                        visibleIds.forEach((id) => newSelected.add(id))
                      } else {
                        visibleIds.forEach((id) => newSelected.delete(id))
                      }
                      setSelectedProducts(newSelected)
                    }

                    const groupedByCategory = filteredProducts.reduce<
                      Record<string, ProductOption[]>
                    >((acc, p) => {
                      const key = p.parent_category_name || "Uncategorized"
                      if (!acc[key]) acc[key] = []
                      acc[key].push(p)
                      return acc
                    }, {})
                    const orderedCategoryKeys = Object.keys(groupedByCategory).sort()

                    return (
                      <>
                        <div className="space-y-2">
                          <Input
                            placeholder="Search products by name, brand, or category..."
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            className="max-w-full"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Category</div>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              type="button"
                              variant={selectedProductCategory === "all" ? "default" : "outline"}
                              onClick={() => setSelectedProductCategory("all")}
                              size="sm"
                            >
                              All ({products.length})
                            </Button>
                            {uniqueProductCategories.map((category) => {
                              const count = products.filter(
                                (p) => p.parent_category_name === category
                              ).length
                              return (
                                <Button
                                  key={category}
                                  type="button"
                                  variant={
                                    selectedProductCategory === category ? "default" : "outline"
                                  }
                                  onClick={() => setSelectedProductCategory(category)}
                                  size="sm"
                                >
                                  {category} ({count})
                                </Button>
                              )
                            })}
                          </div>
                        </div>

                        {filteredProducts.length > 0 && (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleVisible(!allVisibleSelected)}
                            >
                              {allVisibleSelected ? "Clear visible" : "Select visible"}
                            </Button>
                            <span className="text-xs text-muted-foreground self-center">
                              {selectedVisibleCount} of {filteredProducts.length} visible selected
                            </span>
                          </div>
                        )}

                        <div className="max-h-96 overflow-y-auto border rounded-md p-4">
                          {products.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No products available</p>
                          ) : filteredProducts.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No products found
                              {productSearchTerm ? ` matching "${productSearchTerm}"` : ""}
                              {selectedProductCategory !== "all"
                                ? ` in ${selectedProductCategory}`
                                : ""}
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {orderedCategoryKeys.map((categoryName) => (
                                <div key={categoryName} className="space-y-1">
                                  <div className="sticky top-0 bg-background py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                                    {categoryName} ({groupedByCategory[categoryName].length})
                                  </div>
                                  {groupedByCategory[categoryName].map((product) => (
                                    <label
                                      key={product.id}
                                      className="flex items-start gap-3 p-2 hover:bg-muted rounded cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedProducts.has(product.id)}
                                        onChange={(e) => {
                                          const newSelected = new Set(selectedProducts)
                                          if (e.target.checked) {
                                            newSelected.add(product.id)
                                          } else {
                                            newSelected.delete(product.id)
                                          }
                                          setSelectedProducts(newSelected)
                                        }}
                                        className="h-4 w-4 mt-0.5"
                                      />
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{product.name}</div>
                                        {product.brand && (
                                          <div className="text-xs text-muted-foreground">
                                            {product.brand}
                                          </div>
                                        )}
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <div>
                            {productSearchTerm || selectedProductCategory !== "all" ? (
                              <>
                                Showing {filteredProducts.length} of {products.length} products
                              </>
                            ) : (
                              `${products.length} total products`
                            )}
                          </div>
                          <div className="font-medium">
                            {selectedProducts.size} product
                            {selectedProducts.size !== 1 ? "s" : ""} selected
                          </div>
                        </div>
                      </>
                    )
                  })()
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingVendor ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the vendor <strong>{deletingVendor?.vendor_name}</strong>. This action cannot be undone.
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

      {/* Purchase History Modal */}
      <Dialog open={purchaseHistoryOpen} onOpenChange={setPurchaseHistoryOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Purchase History - {selectedVendor?.vendor_name}
            </DialogTitle>
            <DialogDescription>
              Complete purchase history for this vendor
            </DialogDescription>
          </DialogHeader>

          {purchaseHistoryLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading purchase history...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total Purchases</CardDescription>
                    <CardTitle className="text-3xl">{purchaseStats.totalPurchases}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total Amount</CardDescription>
                    <CardTitle className="text-3xl">
                      ₹{purchaseStats.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Purchases Table */}
              {purchaseHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No purchases found for this vendor
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Purchase Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseHistory.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">
                            {purchase.purchase_number || "-"}
                          </TableCell>
                          <TableCell>
                            {new Date(purchase.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                purchase.purchase_status === "received"
                                  ? "default"
                                  : purchase.purchase_status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {purchase.purchase_status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                purchase.payment_status === "completed"
                                  ? "default"
                                  : purchase.payment_status === "failed"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {purchase.payment_status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{(purchase.total_amount || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loose Stock Dialog */}
      {looseStockVendor && (
        <VendorLooseStockDialog
          vendorId={looseStockVendor.id}
          vendorName={looseStockVendor.vendor_name}
          open={looseStockDialogOpen}
          onOpenChange={setLooseStockDialogOpen}
          onUpdate={fetchVendors}
        />
      )}
    </div>
  )
}
