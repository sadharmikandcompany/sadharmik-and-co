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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, X, ShoppingBag, ArrowDownCircle, Upload, Loader2, MoreHorizontal, Edit, DollarSign, Trash2, PackageCheck, Search, ListChecks, Clock, CheckCircle2, IndianRupee, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"

type Purchase = {
  id: string
  purchase_number: string
  invoice_number: string | null
  supplier_name: string
  distributor_id: string | null
  distributor_name?: string
  purchase_status: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  supplier_city: string | null
  supplier_state: string | null
  is_urgent: boolean
  purchase_date: string
  created_at: string
  is_loose?: boolean
  loose_quantity_liters?: number
  loose_category_name?: string
  loose_stock_id?: string
  is_factory?: boolean
  purchase_category?: string
}

type Vendor = {
  id: string
  vendor_name: string
  company_name: string | null
  mobile_primary: string
}

export default function PurchasesPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const { entityId, loading: entityLoading } = useEntityData()
  const isDistributor = role === "main_distributor" || role === "sub_distributor"
  const isFactory = role === "factories"
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<string>("all")
  const [purchaseCategoryFilter, setPurchaseCategoryFilter] = useState<string>("all")
  const [totalValueScope, setTotalValueScope] = useState<"material" | "all">("material")
  const [sortField, setSortField] = useState<"date" | "po_number" | "supplier" | "amount">("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection(field === "date" || field === "amount" ? "desc" : "asc")
    }
  }

  const renderSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  // Payment Out Modal States
  const [isPaymentOutOpen, setIsPaymentOutOpen] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendor, setSelectedVendor] = useState("")
  const [paymentType, setPaymentType] = useState("")
  const [paymentDescription, setPaymentDescription] = useState("")
  const [paidAmount, setPaidAmount] = useState("")
  const [discountPercent, setDiscountPercent] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Edit Payment Modal States
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [editPaymentStatus, setEditPaymentStatus] = useState("")
  const [editPaymentMethod, setEditPaymentMethod] = useState("")
  const [editPaidAmount, setEditPaidAmount] = useState("")
  const [editPaymentNotes, setEditPaymentNotes] = useState("")
  const [updatingPayment, setUpdatingPayment] = useState(false)

  // Delete Confirmation Modal States
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Picks up ?from=&to= from links like the Factory Dashboard's Monthly
  // Summary table, so clicking a month's purchase figure lands here pre-filtered.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get("from")
    const to = params.get("to")
    if (from) setDateFrom(new Date(from))
    if (to) setDateTo(new Date(to))
  }, [])

  useEffect(() => {
    // Wait for role to resolve so role-based filters are correct
    if (roleLoading) return
    // For distributors, also wait until entityId is resolved
    if (isDistributor && entityLoading) return
    fetchPurchases()
    fetchVendors()
  }, [entityId, entityLoading, role, roleLoading])

  const fetchVendors = async () => {
    let query = supabase
      .from("vendors")
      .select("id, vendor_name, company_name, mobile_primary")
      .eq("is_active", true)
      .order("vendor_name")

    // Distributors only see their own vendors
    if (isDistributor && entityId) {
      query = query.eq("distributor_id", entityId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching vendors:", error)
      toast.error("Failed to fetch vendors")
      return
    }

    setVendors(data || [])
  }

  const fetchPurchases = async () => {
    setLoading(true)

    let purchasesData: any[] = []

    {
      let query = supabase
        .from("purchases")
        .select("*")
        .order("created_at", { ascending: false })

      // Distributors only see their own purchases
      if (isDistributor && entityId) {
        query = query.eq("distributor_id", entityId)
      }

      // Factory role only sees purchases they created themselves
      if (isFactory) {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          setPurchases([])
          setLoading(false)
          return
        }
        query = query.eq("created_by_user_id", authUser.id)
      }

      const { data, error: purchasesError } = await query

      if (purchasesError) {
        console.error("Error fetching purchases:", purchasesError)
        toast.error("Failed to fetch purchases")
        setLoading(false)
        return
      }

      purchasesData = data || []
    }

    // Fetch distributor names if distributor_id is present
    const distributorIds = purchasesData
      ?.filter((p) => p.distributor_id)
      .map((p) => p.distributor_id)
      .filter((id): id is string => id !== null)

    const distributorMap = new Map<string, string>()

    if (distributorIds && distributorIds.length > 0) {
      const { data: distributorsData, error: distributorsError } = await supabase
        .from("distributors")
        .select("id, name")
        .in("id", distributorIds)

      if (distributorsError) {
        console.error("Error fetching distributors:", distributorsError)
      } else {
        distributorsData?.forEach((distributor) => {
          distributorMap.set(distributor.id, distributor.name)
        })
      }
    }

    const purchasesWithDistributors = purchasesData?.map((purchase) => ({
      ...purchase,
      distributor_name: purchase.distributor_id
        ? distributorMap.get(purchase.distributor_id) || "Unknown"
        : undefined,
    })) || []

    // Fetch factory orders (orders where is_factory_order = true) to show as purchases for the distributor.
    // Factory role users do NOT see these — they only manage their own purchases in this view.
    let factoryOrdersData: any[] | null = []
    if (!isFactory) {
      let factoryOrdersQuery = supabase
        .from("orders")
        .select("id, order_number, invoice_number_gst, invoice_number_non_gst, distributor_id, order_status, payment_status, payment_method, total_amount, is_priority, order_date, created_at")
        .eq("is_factory_order", true)
        .order("created_at", { ascending: false })

      if (isDistributor && entityId) {
        factoryOrdersQuery = factoryOrdersQuery.eq("distributor_id", entityId)
      }

      const { data, error: factoryOrdersError } = await factoryOrdersQuery

      if (factoryOrdersError) {
        console.error("Error fetching factory orders:", factoryOrdersError)
      }
      factoryOrdersData = data
    }

    const factoryPurchases: Purchase[] = (factoryOrdersData || []).map((ord: any) => ({
      id: ord.id,
      purchase_number: ord.order_number,
      invoice_number: ord.invoice_number_gst || ord.invoice_number_non_gst || null,
      supplier_name: "Factory",
      distributor_id: ord.distributor_id,
      distributor_name: ord.distributor_id ? distributorMap.get(ord.distributor_id) : undefined,
      purchase_status: ord.order_status || "pending",
      payment_status: ord.payment_status || "pending",
      payment_method: ord.payment_method || null,
      total_amount: Number(ord.total_amount || 0),
      supplier_city: null,
      supplier_state: null,
      is_urgent: Boolean(ord.is_priority),
      purchase_date: ord.order_date || ord.created_at,
      created_at: ord.created_at,
      is_factory: true,
    }))

    // Ensure distributor names for factory orders are resolved (distributorMap may not contain them if not referenced by a regular purchase)
    const missingFactoryDistributorIds = factoryPurchases
      .map((fp) => fp.distributor_id)
      .filter((id): id is string => !!id && !distributorMap.has(id))

    if (missingFactoryDistributorIds.length > 0) {
      const { data: extraDistributors } = await supabase
        .from("distributors")
        .select("id, name")
        .in("id", missingFactoryDistributorIds)

      extraDistributors?.forEach((d) => distributorMap.set(d.id, d.name))

      factoryPurchases.forEach((fp) => {
        if (fp.distributor_id) {
          fp.distributor_name = distributorMap.get(fp.distributor_id) || "Unknown"
        }
      })
    }

    // Also fetch loose stock purchase transactions — visible to admin and factory role only
    // (loose_stock_transactions has no distributor_id, so distributors can't see them).
    // Only STANDALONE loose transactions (no purchase_id) get their own row here —
    // ones already attached to a purchases order are already shown (and totaled)
    // via that order's row, so including them again here would double-count them.
    const { data: looseTransactions, error: looseError } = isDistributor
      ? { data: [], error: null }
      : await supabase
          .from("loose_stock_transactions")
          .select(`
            *,
            loose_stock!inner (
              product_categories!inner (
                name
              )
            )
          `)
          .eq("transaction_type", "purchase")
          .is("purchase_id", null)
          .order("transaction_date", { ascending: false })

    if (looseError) {
      console.error("Error fetching loose stock transactions:", looseError)
    }

    // Resolve vendor_id -> vendor_name for rows where vendor_name is null
    const missingVendorIds = Array.from(new Set(
      (looseTransactions || [])
        .filter((t: any) => !t.vendor_name && t.vendor_id)
        .map((t: any) => t.vendor_id)
    )) as string[]
    const vendorNameMap = new Map<string, string>()
    if (missingVendorIds.length > 0) {
      const { data: vendorRows } = await supabase
        .from("vendors")
        .select("id, vendor_name")
        .in("id", missingVendorIds)
      ;(vendorRows || []).forEach((v: any) => {
        if (v.vendor_name) vendorNameMap.set(v.id, v.vendor_name)
      })
    }

    // Map loose stock transactions to Purchase format
    const loosePurchases: Purchase[] = (looseTransactions || []).map((txn: any) => ({
      id: txn.id,
      purchase_number: `LOOSE-${txn.invoice_number || txn.id.substring(0, 8).toUpperCase()}`,
      invoice_number: txn.invoice_number || null,
      supplier_name: txn.vendor_name || (txn.vendor_id && vendorNameMap.get(txn.vendor_id)) || "Unknown Vendor",
      distributor_id: null,
      purchase_status: "received",
      payment_status: "completed",
      payment_method: null,
      total_amount: txn.total_amount || (txn.quantity_liters * txn.price_per_liter),
      supplier_city: null,
      supplier_state: null,
      is_urgent: false,
      purchase_date: txn.transaction_date || txn.created_at,
      created_at: txn.created_at,
      is_loose: true,
      loose_quantity_liters: txn.quantity_liters,
      loose_category_name: txn.loose_stock?.product_categories?.name || "Unknown",
      loose_stock_id: txn.loose_stock_id || undefined,
    }))

    // Merge and sort by date
    const allPurchases = [...purchasesWithDistributors, ...factoryPurchases, ...loosePurchases]
      .sort((a, b) => new Date(b.purchase_date || b.created_at).getTime() - new Date(a.purchase_date || a.created_at).getTime())

    setPurchases(allPurchases)
    setLoading(false)
  }

  const filteredPurchases = purchases.filter((purchase) => {
    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      purchase.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (purchase.distributor_name &&
        purchase.distributor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      purchase.purchase_status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.payment_status.toLowerCase().includes(searchTerm.toLowerCase())

    // Date range filter
    const purchaseDate = new Date(purchase.purchase_date || purchase.created_at)
    const matchesDateFrom = !dateFrom || purchaseDate >= dateFrom
    const matchesDateTo = !dateTo || purchaseDate <= dateTo

    // Purchase status filter
    const matchesPurchaseStatus =
      purchaseStatusFilter === "all" ||
      purchase.purchase_status.toLowerCase() === purchaseStatusFilter.toLowerCase()

    // Purchase category filter (material / direct_expense / indirect_expense)
    const matchesPurchaseCategory =
      purchaseCategoryFilter === "all" ||
      (purchase.purchase_category || "material") === purchaseCategoryFilter

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesPurchaseStatus &&
      matchesPurchaseCategory
    )
  }).sort((a, b) => {
    let cmp = 0
    if (sortField === "amount") {
      cmp = a.total_amount - b.total_amount
    } else if (sortField === "po_number") {
      cmp = a.purchase_number.localeCompare(b.purchase_number, undefined, { numeric: true })
    } else if (sortField === "supplier") {
      cmp = (a.supplier_name || "").localeCompare(b.supplier_name || "")
    } else {
      const aTime = new Date(a.purchase_date || a.created_at).getTime()
      const bTime = new Date(b.purchase_date || b.created_at).getTime()
      cmp = aTime - bTime
    }
    return sortDirection === "asc" ? cmp : -cmp
  })

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setPurchaseStatusFilter("all")
    setPurchaseCategoryFilter("all")
    setSearchTerm("")
    setSortField("date")
    setSortDirection("desc")
  }

  const hasActiveFilters =
    dateFrom ||
    dateTo ||
    purchaseStatusFilter !== "all" ||
    purchaseCategoryFilter !== "all" ||
    searchTerm !== ""

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "completed" || lowerStatus === "received") {
      return "default"
    }
    if (lowerStatus === "pending" || lowerStatus === "processing" || lowerStatus === "shipped") {
      return "outline"
    }
    if (lowerStatus === "cancelled" || lowerStatus === "failed") {
      return "destructive"
    }
    if (lowerStatus === "partially_received") {
      return "secondary"
    }
    return "secondary"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `payment-proofs/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error("Error uploading image:", error)
      toast.error("Failed to upload image")
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handlePaymentOutSubmit = async () => {
    // Validation
    if (!selectedVendor) {
      toast.error("Please select a vendor")
      return
    }
    if (!paymentType) {
      toast.error("Please select a payment type")
      return
    }
    if (!paidAmount || parseFloat(paidAmount) <= 0) {
      toast.error("Please enter a valid paid amount")
      return
    }

    setSubmittingPayment(true)

    try {
      let imageUrl = null
      if (imageFile) {
        imageUrl = await handleImageUpload(imageFile)
        if (!imageUrl) {
          setSubmittingPayment(false)
          return
        }
      }

      // Create payment out record
      const paymentData = {
        vendor_id: selectedVendor,
        payment_type: paymentType,
        description: paymentDescription,
        paid_amount: parseFloat(paidAmount),
        discount_percent: discountPercent ? parseFloat(discountPercent) : 0,
        image_proof_url: imageUrl,
        payment_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("payment_outs")
        .insert([paymentData])

      if (error) {
        throw error
      }

      toast.success("Payment recorded successfully")
      
      // Reset form
      setSelectedVendor("")
      setPaymentType("")
      setPaymentDescription("")
      setPaidAmount("")
      setDiscountPercent("")
      setImageFile(null)
      setIsPaymentOutOpen(false)

    } catch (error) {
      console.error("Error recording payment:", error)
      toast.error("Failed to record payment")
    } finally {
      setSubmittingPayment(false)
    }
  }

  const calculateFinalAmount = () => {
    const amount = parseFloat(paidAmount) || 0
    const discount = parseFloat(discountPercent) || 0
    const discountAmount = (amount * discount) / 100
    return amount - discountAmount
  }

  const openEditPaymentModal = (purchase: Purchase) => {
    setSelectedPurchase(purchase)
    setEditPaymentStatus(purchase.payment_status)
    setEditPaymentMethod(purchase.payment_method || "")
    setEditPaidAmount("")
    setEditPaymentNotes("")
    setIsEditPaymentOpen(true)
  }

  const handleUpdatePayment = async () => {
    if (!selectedPurchase) return

    // Validation
    if (!editPaymentStatus) {
      toast.error("Please select a payment status")
      return
    }

    setUpdatingPayment(true)

    try {
      const updateData: any = {
        payment_status: editPaymentStatus,
        payment_method: editPaymentMethod || null,
        updated_at: new Date().toISOString(),
      }

      // If partial payment status and amount provided, update the paid amount
      if (editPaymentStatus === "partial" && editPaidAmount) {
        const paidAmountNum = parseFloat(editPaidAmount)
        if (paidAmountNum <= 0) {
          toast.error("Paid amount must be greater than 0")
          setUpdatingPayment(false)
          return
        }
        if (paidAmountNum > selectedPurchase.total_amount) {
          toast.error("Paid amount cannot exceed total amount")
          setUpdatingPayment(false)
          return
        }
        // Store paid amount in internal notes or a new field
        updateData.internal_notes = `Paid: ₹${paidAmountNum} / ₹${selectedPurchase.total_amount}${
          editPaymentNotes ? `\nNotes: ${editPaymentNotes}` : ""
        }`
      } else if (editPaymentNotes) {
        updateData.internal_notes = editPaymentNotes
      }

      const { error } = await supabase
        .from("purchases")
        .update(updateData)
        .eq("id", selectedPurchase.id)

      if (error) {
        throw error
      }

      toast.success("Payment updated successfully")
      setIsEditPaymentOpen(false)
      setSelectedPurchase(null)
      fetchPurchases() // Refresh the list

    } catch (error) {
      console.error("Error updating payment:", error)
      toast.error("Failed to update payment")
    } finally {
      setUpdatingPayment(false)
    }
  }

  const getRemainingAmount = () => {
    if (!selectedPurchase || !editPaidAmount) return 0
    const totalAmount = selectedPurchase.total_amount
    const paidAmount = parseFloat(editPaidAmount) || 0
    return Math.max(0, totalAmount - paidAmount)
  }

  const openDeleteDialog = (purchase: Purchase) => {
    setPurchaseToDelete(purchase)
    setIsDeleteDialogOpen(true)
  }

  const handleDeletePurchase = async () => {
    if (!purchaseToDelete) return

    setDeleting(true)

    try {
      if (purchaseToDelete.is_loose) {
        // Loose purchases live in loose_stock_transactions, not `purchases`.
        // Deleting one must reverse its full quantity out of the loose_stock
        // running balance — it was added once when this purchase was made.
        if (purchaseToDelete.loose_stock_id) {
          const { data: currentStock, error: stockFetchError } = await supabase
            .from("loose_stock")
            .select("quantity_liters")
            .eq("id", purchaseToDelete.loose_stock_id)
            .maybeSingle()

          if (stockFetchError) throw stockFetchError

          const newBalance = Math.max(
            0,
            Number(currentStock?.quantity_liters || 0) - (purchaseToDelete.loose_quantity_liters || 0)
          )

          const { error: stockUpdateError } = await supabase
            .from("loose_stock")
            .update({ quantity_liters: newBalance })
            .eq("id", purchaseToDelete.loose_stock_id)

          if (stockUpdateError) throw stockUpdateError
        }

        const { error: txnError } = await supabase
          .from("loose_stock_transactions")
          .delete()
          .eq("id", purchaseToDelete.id)

        if (txnError) throw txnError
      } else {
        // A regular (non-is_loose) purchase can still include loose-stock
        // line items — those get their own loose_stock_transactions row
        // (see purchases/new/page.tsx) on top of whatever's in
        // purchase_items, linked back via purchase_id. Deleting the purchase
        // without unwinding those first violates the
        // loose_stock_transactions_purchase_id_fkey foreign key (Postgres
        // error 23503) — this was silently failing every delete on any
        // purchase that had a loose-stock line, with only a generic "Failed
        // to delete purchase" toast to show for it.
        const { data: looseTxns, error: looseFetchError } = await supabase
          .from("loose_stock_transactions")
          .select("id, loose_stock_id, quantity_liters")
          .eq("purchase_id", purchaseToDelete.id)

        if (looseFetchError) throw looseFetchError

        for (const looseTxn of looseTxns || []) {
          if (looseTxn.loose_stock_id) {
            const { data: currentStock, error: stockFetchError } = await supabase
              .from("loose_stock")
              .select("quantity_liters")
              .eq("id", looseTxn.loose_stock_id)
              .maybeSingle()
            if (stockFetchError) throw stockFetchError

            const revertedQuantity = Math.max(
              0,
              Number(currentStock?.quantity_liters || 0) - Number(looseTxn.quantity_liters || 0)
            )
            const { error: stockUpdateError } = await supabase
              .from("loose_stock")
              .update({ quantity_liters: revertedQuantity })
              .eq("id", looseTxn.loose_stock_id)
            if (stockUpdateError) throw stockUpdateError
          }

          const { error: looseDeleteError } = await supabase
            .from("loose_stock_transactions")
            .delete()
            .eq("id", looseTxn.id)
          if (looseDeleteError) throw looseDeleteError
        }

        // Then delete related purchase items
        const { error: itemsError } = await supabase
          .from("purchase_items")
          .delete()
          .eq("purchase_id", purchaseToDelete.id)

        if (itemsError) {
          throw itemsError
        }

        // Then delete the purchase
        const { error: purchaseError } = await supabase
          .from("purchases")
          .delete()
          .eq("id", purchaseToDelete.id)

        if (purchaseError) {
          throw purchaseError
        }
      }

      toast.success("Purchase deleted successfully")
      setIsDeleteDialogOpen(false)
      setPurchaseToDelete(null)
      fetchPurchases() // Refresh the list

    } catch (error) {
      console.error("Error deleting purchase:", error)
      // Surface the real reason (e.g. a foreign-key constraint, an RLS
      // rejection) instead of a generic message — this exact case (a
      // 23503 foreign-key violation from loose_stock_transactions) went
      // unnoticed for a while because the toast gave no hint of the actual
      // cause.
      const message = (error && typeof error === "object" && "message" in error)
        ? String((error as { message?: unknown }).message)
        : "Failed to delete purchase"
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const handleMarkAsReceived = async (purchase: Purchase) => {
    if (purchase.purchase_status === "received") {
      toast.info("This purchase is already marked as received")
      return
    }

    try {
      const { error } = await supabase
        .from("purchases")
        .update({
          purchase_status: "received",
          received_date: new Date().toISOString(),
        })
        .eq("id", purchase.id)

      if (error) throw error

      toast.success("Purchase marked as received! Stock has been updated automatically.")
      fetchPurchases() // Refresh the list

    } catch (error) {
      console.error("Error marking purchase as received:", error)
      toast.error("Failed to mark purchase as received")
    }
  }

  // Prepare export data
  const exportData = filteredPurchases.map(purchase => ({
    'Purchase Number': purchase.purchase_number,
    'Invoice Number': purchase.invoice_number || '',
    'Supplier': purchase.supplier_name,
    'Distributor': purchase.distributor_name || 'N/A',
    'Status': purchase.purchase_status,
    'Payment Status': purchase.payment_status,
    'Payment Method': purchase.payment_method || 'N/A',
    'Total': `₹${purchase.total_amount.toFixed(2)}`,
    'Urgent': purchase.is_urgent ? 'Yes' : 'No',
    'Purchase Date': format(new Date(purchase.purchase_date || purchase.created_at), 'PPP')
  }))

  const exportColumns = [
    { header: 'PO #', dataKey: 'Purchase Number' },
    { header: 'Invoice #', dataKey: 'Invoice Number' },
    { header: 'Supplier', dataKey: 'Supplier' },
    { header: 'Status', dataKey: 'Status' },
    { header: 'Payment', dataKey: 'Payment Status' },
    { header: 'Total', dataKey: 'Total' },
    { header: 'Date', dataKey: 'Purchase Date' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Purchases</h1>
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
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Purchases</h1>
            <p className="text-sm text-muted-foreground">
              {isFactory
                ? "View and create your own purchase orders from vendors"
                : isDistributor
                ? "View and create your purchase orders"
                : "Manage purchases from suppliers and track inventory"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {!isDistributor && !isFactory && <Dialog open={isPaymentOutOpen} onOpenChange={setIsPaymentOutOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowDownCircle className="mr-2 h-4 w-4" />
                Payment Out
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Payment Out</DialogTitle>
                <DialogDescription>
                  Record a payment made to vendor/supplier
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Vendor Selection */}
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor/Supplier *</Label>
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger id="vendor">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.vendor_name}
                          {vendor.company_name && ` (${vendor.company_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Type */}
                <div className="space-y-2">
                  <Label htmlFor="paymentType">Payment Type *</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger id="paymentType">
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="balance">Balance</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="net_banking">Net Banking</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Paid Amount */}
                <div className="space-y-2">
                  <Label htmlFor="paidAmount">Paid Amount (₹) *</Label>
                  <Input
                    id="paidAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter paid amount"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </div>

                {/* Discount Percent */}
                <div className="space-y-2">
                  <Label htmlFor="discountPercent">Discount %</Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Enter discount percentage"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                  />
                </div>

                {/* Final Amount Display */}
                {paidAmount && parseFloat(paidAmount) > 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Final Amount:</span>
                      <span className="text-2xl font-bold">
                        {formatCurrency(calculateFinalAmount())}
                      </span>
                    </div>
                    {discountPercent && parseFloat(discountPercent) > 0 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Discount: {formatCurrency(
                          (parseFloat(paidAmount) * parseFloat(discountPercent)) / 100
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter payment description or notes"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Image Proof Upload */}
                <div className="space-y-2">
                  <Label htmlFor="imageProof">Payment Proof Image</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="imageProof"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setImageFile(file)
                        }
                      }}
                      disabled={uploadingImage}
                    />
                    {imageFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setImageFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {imageFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {imageFile.name}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPaymentOutOpen(false)}
                    disabled={submittingPayment}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePaymentOutSubmit}
                    disabled={submittingPayment || uploadingImage}
                  >
                    {submittingPayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <ArrowDownCircle className="mr-2 h-4 w-4" />
                        Record Payment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>}

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Purchase Order</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this purchase order? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              {purchaseToDelete && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Purchase Order:</span>
                    <span className="font-bold">{purchaseToDelete.purchase_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Supplier:</span>
                    <span>{purchaseToDelete.supplier_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Amount:</span>
                    <span className="font-bold">
                      {formatCurrency(purchaseToDelete.total_amount)}
                    </span>
                  </div>
                  {purchaseToDelete.is_loose && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 pt-1 border-t">
                      This will also remove {purchaseToDelete.loose_quantity_liters?.toFixed(2)}L from the{" "}
                      {purchaseToDelete.loose_category_name} stock balance.
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeletePurchase}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Purchase
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Payment Modal */}
          <Dialog open={isEditPaymentOpen} onOpenChange={setIsEditPaymentOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Payment Details</DialogTitle>
                <DialogDescription>
                  Update payment status and amount for {selectedPurchase?.purchase_number}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Purchase Info */}
                {selectedPurchase && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Purchase Order:</span>
                      <span className="font-bold">{selectedPurchase.purchase_number}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Supplier:</span>
                      <span>{selectedPurchase.supplier_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Amount:</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(selectedPurchase.total_amount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment Status */}
                <div className="space-y-2">
                  <Label htmlFor="editPaymentStatus">Payment Status *</Label>
                  <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                    <SelectTrigger id="editPaymentStatus">
                      <SelectValue placeholder="Select payment status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial Paid</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label htmlFor="editPaymentMethod">Payment Method</Label>
                  <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                    <SelectTrigger id="editPaymentMethod">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="balance">Balance</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="net_banking">Net Banking</SelectItem>
                      <SelectItem value="credit">Credit/Due</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Paid Amount (shown for partial payment) */}
                {editPaymentStatus === "partial" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="editPaidAmount">Paid Amount (₹) *</Label>
                      <Input
                        id="editPaidAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        max={selectedPurchase?.total_amount}
                        placeholder="Enter amount paid"
                        value={editPaidAmount}
                        onChange={(e) => setEditPaidAmount(e.target.value)}
                      />
                      {editPaidAmount && parseFloat(editPaidAmount) > 0 && selectedPurchase && (
                        <div className="text-sm text-muted-foreground">
                          Remaining: {formatCurrency(getRemainingAmount())}
                        </div>
                      )}
                    </div>

                    {/* Payment Summary */}
                    {editPaidAmount && parseFloat(editPaidAmount) > 0 && selectedPurchase && (
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">Total Amount:</span>
                            <span>{formatCurrency(selectedPurchase.total_amount)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">Paid Amount:</span>
                            <span className="text-green-600 dark:text-green-400">
                              {formatCurrency(parseFloat(editPaidAmount))}
                            </span>
                          </div>
                          <div className="border-t pt-2 flex justify-between items-center">
                            <span className="font-bold">Remaining:</span>
                            <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                              {formatCurrency(getRemainingAmount())}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Payment Notes */}
                <div className="space-y-2">
                  <Label htmlFor="editPaymentNotes">Payment Notes</Label>
                  <Textarea
                    id="editPaymentNotes"
                    placeholder="Add notes about this payment update..."
                    value={editPaymentNotes}
                    onChange={(e) => setEditPaymentNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditPaymentOpen(false)}
                  disabled={updatingPayment}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdatePayment}
                  disabled={updatingPayment}
                >
                  {updatingPayment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Update Payment
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ExportButtons
            data={exportData}
            filename="purchases"
            columns={exportColumns}
            pdfTitle="Purchases Report"
          />
          <Button onClick={() => router.push("/dashboard/purchases/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Purchase Order
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Purchases</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{filteredPurchases.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{hasActiveFilters ? "Across current filters" : "All purchase orders"}</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">
              {filteredPurchases.filter((p) => p.purchase_status === "pending").length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Clock className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Awaiting receipt</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Received</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
              {filteredPurchases.filter((p) => p.purchase_status === "received").length}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Goods received</CardContent>
        </Card>
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
              {formatCurrency(
                filteredPurchases
                  .filter((p) => totalValueScope === "all" || (p.purchase_category || "material") === "material")
                  .reduce((sum, p) => sum + Number(p.total_amount || 0), 0)
              )}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{totalValueScope === "material" ? "Material purchases only" : "All purchases (incl. expenses)"}</span>
            <div className="flex items-center gap-0.5 rounded-full border bg-background p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setTotalValueScope("material")}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                  totalValueScope === "material"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Material
              </button>
              <button
                type="button"
                onClick={() => setTotalValueScope("all")}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                  totalValueScope === "all"
                    ? "bg-blue-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Everything
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900/50">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Purchase Orders</CardTitle>
                <CardDescription className="mt-0.5">A list of all purchase orders with their status and details</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredPurchases.length} {filteredPurchases.length === 1 ? "order" : "orders"}
              </Badge>
              {hasActiveFilters && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search purchases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>

              {/* Purchase Status */}
              <Select value={purchaseStatusFilter} onValueChange={setPurchaseStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Purchase Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="partially_received">Partially Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Purchase Category */}
              <Select value={purchaseCategoryFilter} onValueChange={setPurchaseCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Purchase Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="material">Material Purchase</SelectItem>
                  <SelectItem value="direct_expense">Direct Expense</SelectItem>
                  <SelectItem value="indirect_expense">Indirect Expense</SelectItem>
                  <SelectItem value="fixed_asset">Fixed Asset</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="mixed">Mixed (per item)</SelectItem>
                </SelectContent>
              </Select>

              {/* Date range */}
              <DateRangePresetFilter
                preset={datePreset}
                onPresetChange={(p, range) => {
                  setDatePreset(p)
                  setDateFrom(range.from)
                  setDateTo(range.to)
                }}
                customFrom={dateFrom}
                customTo={dateTo}
                onCustomRangeChange={(from, to) => {
                  setDatePreset("custom")
                  setDateFrom(from)
                  setDateTo(to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999) : undefined)
                }}
              />

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1100px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead
                    className="font-semibold uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("date")}
                  >
                    <div className="flex items-center gap-1">Date {renderSortIcon("date")}</div>
                  </TableHead>
                  <TableHead
                    className="font-semibold uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("po_number")}
                  >
                    <div className="flex items-center gap-1">PO Number {renderSortIcon("po_number")}</div>
                  </TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Invoice #</TableHead>
                  <TableHead
                    className="font-semibold uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("supplier")}
                  >
                    <div className="flex items-center gap-1">Supplier/Distributor {renderSortIcon("supplier")}</div>
                  </TableHead>
                  <TableHead
                    className="text-right font-semibold uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("amount")}
                  >
                    <div className="flex items-center justify-end gap-1">Amount {renderSortIcon("amount")}</div>
                  </TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Purchase Status</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Payment Status</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No purchases found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((purchase) => (
                    <TableRow key={purchase.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap">
                        {new Date(
                          purchase.purchase_date || purchase.created_at
                        ).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {purchase.purchase_number}
                        {purchase.is_urgent && (
                          <Badge variant="destructive" className="ml-2 rounded-full capitalize">
                            Urgent
                          </Badge>
                        )}
                        {purchase.is_loose && (
                          <Badge variant="outline" className="ml-2 rounded-full capitalize text-orange-600 border-orange-300">
                            Loose
                          </Badge>
                        )}
                        {purchase.is_factory && (
                          <Badge variant="outline" className="ml-2 rounded-full capitalize text-blue-600 border-blue-300">
                            Factory
                          </Badge>
                        )}
                        {purchase.purchase_category === "direct_expense" && (
                          <Badge variant="outline" className="ml-2 rounded-full text-purple-600 border-purple-300">
                            Direct Expense
                          </Badge>
                        )}
                        {purchase.purchase_category === "indirect_expense" && (
                          <Badge variant="outline" className="ml-2 rounded-full text-pink-600 border-pink-300">
                            Indirect Expense
                          </Badge>
                        )}
                        {purchase.purchase_category === "fixed_asset" && (
                          <Badge variant="outline" className="ml-2 rounded-full text-indigo-600 border-indigo-300">
                            Fixed Asset
                          </Badge>
                        )}
                        {purchase.purchase_category === "other" && (
                          <Badge variant="outline" className="ml-2 rounded-full text-slate-600 border-slate-300">
                            Other
                          </Badge>
                        )}
                        {purchase.purchase_category === "mixed" && (
                          <Badge variant="outline" className="ml-2 rounded-full text-fuchsia-600 border-fuchsia-300">
                            Mixed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {purchase.invoice_number || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{purchase.supplier_name}</div>
                          {purchase.distributor_name && (
                            <div className="text-xs text-muted-foreground">
                              {purchase.distributor_name}
                            </div>
                          )}
                          {purchase.is_loose && purchase.loose_category_name && (
                            <div className="text-xs text-orange-600">
                              {purchase.loose_category_name} - {purchase.loose_quantity_liters?.toFixed(1)} L
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(Number(purchase.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(purchase.purchase_status)} className="rounded-full capitalize">
                          {purchase.purchase_status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(purchase.payment_status)} className="rounded-full capitalize">
                          {purchase.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {!isDistributor && !purchase.is_factory && !purchase.is_loose && purchase.purchase_status !== "received" && (
                              <DropdownMenuItem onClick={() => handleMarkAsReceived(purchase)}>
                                <PackageCheck className="mr-2 h-4 w-4" />
                                Mark as Received
                              </DropdownMenuItem>
                            )}
                            {!isDistributor && !purchase.is_factory && !purchase.is_loose && (
                              <DropdownMenuItem onClick={() => openEditPaymentModal(purchase)}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Edit Payment
                              </DropdownMenuItem>
                            )}
                            {!purchase.is_factory && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/dashboard/purchases/${purchase.id}/edit`)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Purchase
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  purchase.is_factory
                                    ? `/dashboard/orders/${purchase.id}`
                                    : `/dashboard/purchases/${purchase.id}`
                                )
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {!isDistributor && !purchase.is_factory && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(purchase)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Purchase
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredPurchases.length} of {purchases.length} purchase orders
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
