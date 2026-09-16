"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
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
import { VendorCombobox } from "@/components/ui/vendor-combobox"
import { StockItemCombobox } from "@/components/ui/stock-item-combobox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { insertPurchaseItems } from "@/lib/purchase-items-insert"
import { ArrowLeft, ShoppingBag, Plus, Trash2, AlertCircle } from "lucide-react"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { useSaveShortcut } from "@/hooks/use-save-shortcut"

// Default GST % applied to every line, added on top of the excl.-tax rate; editable per line.
const DEFAULT_GST = 5

type Vendor = {
  id: string
  vendor_name: string
  contact_person: string | null
  email: string | null
  mobile_primary: string
  company_name: string | null
  gst_number: string | null
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  pincode: string
  country: string | null
}

type PurchaseCategory = "material" | "direct_expense" | "indirect_expense" | "fixed_asset" | "other" | "mixed"

function purchaseCategoryHint(category: PurchaseCategory): string {
  switch (category) {
    case "material":
      return "Raw material/stock purchase — counts toward Total Purchase in P&L."
    case "direct_expense":
      return "Non-material GST purchase — shown as a Direct Expense in P&L instead of Total Purchase."
    case "indirect_expense":
      return "Non-material GST purchase — shown as an Indirect Expense in P&L instead of Total Purchase."
    case "fixed_asset":
      return "Capitalized asset (machinery/vehicles/equipment) — excluded from P&L entirely, not expensed."
    case "other":
      return "Doesn't clearly fit another category — booked as an Indirect Expense in P&L so it's still accounted for."
    case "mixed":
      return "No single category for this invoice — every line item below must have its own category set."
  }
}

// Label for the per-item category selector's "inherit" option. When the
// purchase itself is "mixed" there's nothing to inherit — every item must
// pick a real category, so the option is shown as a warning instead.
function defaultCategoryOptionLabel(purchaseCategory: PurchaseCategory): string {
  return purchaseCategory === "mixed"
    ? "⚠ Choose a category (required)"
    : `Same as purchase (${purchaseCategory.replace(/_/g, " ")})`
}

type StockItem = {
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

type PurchaseItem = {
  id: string
  existing_id?: string // DB id if loaded from server
  stock_inventory_id: string
  stock_name: string
  quantity: number
  unit_price: number
  total: number
  is_loose_stock?: boolean
  product_id?: string
  hsn_code?: string | null
  gst_percentage?: number | null
  received_quantity?: number
  is_locked?: boolean // Loose-stock items aren't editable here
  is_itc_eligible?: boolean
  loose_stock_category_id?: string
  // Per-line batch number — a single invoice can bundle items from two
  // different manufacturing batches, which the purchase-level batch number
  // field can't represent.
  batch_number?: string
  // Per-line override of the purchase-level category — a single invoice can
  // mix e.g. a Direct Expense line and an Indirect Expense line (a "RO
  // Material Purchase" line and a "Transportation" line on the same Tally
  // voucher). Undefined/null means "inherit formData.purchase_category".
  purchase_category?: PurchaseCategory | null
}

type VendorProduct = {
  id: string
  name: string
  brand: string | null
  hsn_code: string | null
  gst_percentage: number | null
  default_price: number
}

export default function EditPurchasePage() {
  const router = useRouter()
  const params = useParams()
  const purchaseId = params?.id as string
  const { role } = useUserRole()
  const { entityId } = useEntityData()
  const isDistributor = role === "main_distributor" || role === "sub_distributor"
  const canPurchaseProducts = role === "admin" || role === "factories"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  const [purchaseNumber, setPurchaseNumber] = useState<string>("")

  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string>("")
  const [itemQuantity, setItemQuantity] = useState<string>("")
  const [itemPrice, setItemPrice] = useState<string>("")
  // Alternative entry point when only the GST-inclusive rate is known instead
  // of the excl.-tax rate — typing here back-computes itemPrice (excl. tax).
  const [itemTaxableValue, setItemTaxableValue] = useState<string>("")
  const [itemGstPercentage, setItemGstPercentage] = useState<string>(String(DEFAULT_GST))
  // Carries over between adds (most lines in an invoice share a batch);
  // change it mid-way through adding items when a second batch starts.
  const [itemBatchNumber, setItemBatchNumber] = useState<string>("")
  // Per-line category override, carries over between adds like batch number.
  // "" means "same as the purchase's own category" (formData.purchase_category).
  const [itemCategory, setItemCategory] = useState<PurchaseCategory | "">("")
  const [manualItemName, setManualItemName] = useState<string>("")
  const [entryMode, setEntryMode] = useState<"stock" | "manual" | "product">("stock")
  const useManualEntry = entryMode === "manual"

  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>("")

  const [formData, setFormData] = useState({
    vendor_id: "",
    supplier_name: "",
    supplier_email: "",
    supplier_phone: "",
    supplier_gst_number: "",
    supplier_address_line1: "",
    supplier_address_line2: "",
    supplier_city: "",
    supplier_state: "",
    supplier_pincode: "",
    supplier_country: "India",
    purchase_status: "pending",
    payment_status: "pending",
    payment_method: "",
    discount_amount: "0",
    shipping_charges: "0",
    round_off: "0",
    purchase_notes: "",
    internal_notes: "",
    terms_and_conditions: "",
    invoice_number: "",
    batch_number: "",
    is_urgent: false,
    purchase_date: "",
    purchase_category: "material" as PurchaseCategory,
  })

  const isReceived = formData.purchase_status === "received"

  // Standalone loose-stock purchases (loose_stock_transactions with no linked
  // `purchases` row) are edited through the exact same full form as every
  // other purchase. On save, a real purchases+purchase_items order gets
  // created ("graduating" it) if one doesn't already exist.
  const [graduatingLooseTxnId, setGraduatingLooseTxnId] = useState<string | null>(null)

  // Every existing loose_stock_transactions row loaded into the form (whether
  // it's the one graduating, or an existing loose item on a normal purchase)
  // is editable — but loose_stock.quantity_liters is a maintained running
  // balance, not derived live, so on save we must apply only the DELTA
  // between old and new quantity, not the new value outright. Keyed by the
  // transaction's own id (PurchaseItem.existing_id).
  const [originalLooseQuantities, setOriginalLooseQuantities] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (isDistributor && !entityId) return
    const init = async () => {
      await fetchVendors()
      await loadPurchase()
    }
    init()
  }, [purchaseId, entityId])

  const fetchVendors = async () => {
    let query = supabase
      .from("vendors")
      .select("*")
      .eq("is_active", true)
      .order("vendor_name")

    if (isDistributor && entityId) {
      query = query.eq("distributor_id", entityId)
    }

    const { data, error } = await query
    if (error) {
      console.error("Error fetching vendors:", error)
    } else {
      setVendors(data || [])
    }
  }

  const loadPurchase = async () => {
    if (!purchaseId) return
    setLoading(true)
    try {
      const { data: purchase, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseId)
        .maybeSingle()

      if (error) {
        console.error("Edit purchase load error:", error?.message, error)
        toast.error(error?.message || "Failed to load purchase")
        router.push("/dashboard/purchases")
        return
      }

      // If not in purchases, this id might belong to a standalone loose-stock
      // transaction (created via the loose-stock page, never linked to a real
      // purchase order). Load it into the exact same form as a normal
      // purchase — on save it "graduates" into a real purchases record.
      if (!purchase) {
        const { data: looseRow } = await supabase
          .from("loose_stock_transactions")
          .select("*")
          .eq("id", purchaseId)
          .eq("transaction_type", "purchase")
          .maybeSingle()

        if (!looseRow) {
          toast.error("Purchase not found")
          router.push("/dashboard/purchases")
          return
        }

        // This loose item already belongs to a real purchase order — edit
        // that instead of graduating (which would create a duplicate order).
        if (looseRow.purchase_id) {
          router.replace(`/dashboard/purchases/${looseRow.purchase_id}/edit`)
          return
        }

        // Category (plain selects, not embedded joins — RLS/embed quirks
        // can return null with !inner, same as the view page).
        let categoryName = "Unknown"
        if (looseRow.loose_stock_id) {
          const { data: ls } = await supabase
            .from("loose_stock")
            .select("category_id")
            .eq("id", looseRow.loose_stock_id)
            .maybeSingle()
          if (ls?.category_id) {
            const { data: pc } = await supabase
              .from("product_categories")
              .select("name")
              .eq("id", ls.category_id)
              .maybeSingle()
            if (pc?.name) categoryName = pc.name
          }
        }

        let vendor: Vendor | null = null
        if (looseRow.vendor_id) {
          const { data: v } = await supabase
            .from("vendors")
            .select("*")
            .eq("id", looseRow.vendor_id)
            .maybeSingle()
          if (v) vendor = v
        }

        setPurchaseNumber(`LOOSE-${looseRow.invoice_number || looseRow.id.substring(0, 8).toUpperCase()}`)
        setGraduatingLooseTxnId(looseRow.id)
        setOriginalLooseQuantities(new Map([[looseRow.id, Number(looseRow.quantity_liters) || 0]]))

        setFormData({
          vendor_id: vendor?.id || "",
          supplier_name: vendor?.vendor_name || looseRow.vendor_name || "Unknown Vendor",
          supplier_email: vendor?.email || "",
          supplier_phone: vendor?.mobile_primary || "",
          supplier_gst_number: vendor?.gst_number || "",
          supplier_address_line1: vendor?.address_line1 || "",
          supplier_address_line2: vendor?.address_line2 || "",
          supplier_city: vendor?.city || "",
          supplier_state: vendor?.state || "",
          supplier_pincode: vendor?.pincode || "",
          supplier_country: vendor?.country || "India",
          purchase_status: "received",
          payment_status: "completed",
          payment_method: "",
          discount_amount: "0",
          shipping_charges: "0",
          round_off: "0",
          purchase_notes: looseRow.transaction_notes || "",
          internal_notes: "",
          terms_and_conditions: "",
          invoice_number: looseRow.invoice_number || "",
          batch_number: looseRow.batch_number || "",
          is_urgent: false,
          purchase_date: looseRow.transaction_date
            ? new Date(looseRow.transaction_date).toISOString().slice(0, 10)
            : "",
          purchase_category: "material",
        })

        setPurchaseItems([{
          id: Math.random().toString(36).substr(2, 9),
          existing_id: looseRow.id,
          stock_inventory_id: looseRow.loose_stock_id || "",
          stock_name: `${categoryName} - Loose/Bulk - Loose Stock`,
          quantity: Number(looseRow.quantity_liters) || 0,
          unit_price: Number(looseRow.price_per_liter) || 0,
          total: Number(looseRow.total_amount) || (Number(looseRow.quantity_liters) || 0) * (Number(looseRow.price_per_liter) || 0),
          is_loose_stock: true,
          loose_stock_category_id: looseRow.loose_stock_id || undefined,
          is_locked: false,
          gst_percentage: looseRow.gst_percentage ?? DEFAULT_GST,
          is_itc_eligible: looseRow.is_itc_eligible !== false,
          batch_number: looseRow.batch_number || "",
        }])

        if (vendor) {
          setSelectedVendorId(vendor.id)
          await Promise.all([
            fetchStockItems(vendor.id),
            canPurchaseProducts ? fetchVendorProducts(vendor.id) : Promise.resolve(),
          ])
        }

        setLoading(false)
        return
      }

      setPurchaseNumber(purchase.purchase_number || "")

      setFormData({
        vendor_id: purchase.vendor_id || "",
        supplier_name: purchase.supplier_name || "",
        supplier_email: purchase.supplier_email || "",
        supplier_phone: purchase.supplier_phone || "",
        supplier_gst_number: purchase.supplier_gst_number || "",
        supplier_address_line1: purchase.supplier_address_line1 || "",
        supplier_address_line2: purchase.supplier_address_line2 || "",
        supplier_city: purchase.supplier_city || "",
        supplier_state: purchase.supplier_state || "",
        supplier_pincode: purchase.supplier_pincode || "",
        supplier_country: purchase.supplier_country || "India",
        purchase_status: purchase.purchase_status || "pending",
        payment_status: purchase.payment_status || "pending",
        payment_method: purchase.payment_method || "",
        discount_amount: String(purchase.discount_amount ?? "0"),
        shipping_charges: String(purchase.shipping_charges ?? "0"),
        round_off: String(purchase.round_off ?? "0"),
        purchase_notes: purchase.purchase_notes || "",
        internal_notes: purchase.internal_notes || "",
        terms_and_conditions: purchase.terms_and_conditions || "",
        invoice_number: purchase.invoice_number || "",
        batch_number: purchase.batch_number || "",
        is_urgent: !!purchase.is_urgent,
        purchase_date: purchase.purchase_date
          ? new Date(purchase.purchase_date).toISOString().slice(0, 10)
          : "",
        purchase_category: (purchase.purchase_category || "material") as PurchaseCategory,
      })

      if (purchase.vendor_id) {
        setSelectedVendorId(purchase.vendor_id)
        await Promise.all([
          fetchStockItems(purchase.vendor_id),
          canPurchaseProducts ? fetchVendorProducts(purchase.vendor_id) : Promise.resolve(),
        ])
      }

      const { data: items } = await supabase
        .from("purchase_items")
        .select("*")
        .eq("purchase_id", purchaseId)
        .order("created_at")

      // Loose items on a purchase live entirely in loose_stock_transactions
      // (linked via purchase_id) — they never get a purchase_items row, so
      // they need to be loaded and shown as their own line items here.
      const { data: looseTx } = await supabase
        .from("loose_stock_transactions")
        .select("*")
        .eq("purchase_id", purchaseId)
        .eq("transaction_type", "purchase")
      const looseIds = new Set((looseTx || []).map((t: any) => t.loose_stock_id))

      const looseCategoryNames = new Map<string, string>()
      const looseStockIds = Array.from(looseIds) as string[]
      if (looseStockIds.length > 0) {
        const { data: looseStockRows } = await supabase
          .from("loose_stock")
          .select("id, category_id")
          .in("id", looseStockIds)
        const categoryIds = (looseStockRows || []).map((r: any) => r.category_id).filter(Boolean)
        const categoryNameById = new Map<string, string>()
        if (categoryIds.length > 0) {
          const { data: categories } = await supabase
            .from("product_categories")
            .select("id, name")
            .in("id", categoryIds)
          ;(categories || []).forEach((c: any) => categoryNameById.set(c.id, c.name))
        }
        ;(looseStockRows || []).forEach((r: any) => {
          looseCategoryNames.set(r.id, categoryNameById.get(r.category_id) || "Unknown")
        })
      }

      const looseMapped: PurchaseItem[] = (looseTx || []).map((t: any) => ({
        id: t.id,
        existing_id: t.id,
        stock_inventory_id: t.loose_stock_id || "",
        stock_name: `${looseCategoryNames.get(t.loose_stock_id) || "Unknown"} - Loose/Bulk - Loose Stock`,
        quantity: Number(t.quantity_liters) || 0,
        unit_price: Number(t.price_per_liter) || 0,
        total: Number(t.total_amount) || (Number(t.quantity_liters) || 0) * (Number(t.price_per_liter) || 0),
        is_loose_stock: true,
        loose_stock_category_id: t.loose_stock_id || undefined,
        is_locked: false,
        gst_percentage: t.gst_percentage ?? DEFAULT_GST,
        is_itc_eligible: t.is_itc_eligible !== false,
        batch_number: t.batch_number || "",
      }))

      setOriginalLooseQuantities((prev) => {
        const next = new Map(prev)
        ;(looseTx || []).forEach((t: any) => next.set(t.id, Number(t.quantity_liters) || 0))
        return next
      })

      const mapped: PurchaseItem[] = [
        ...(items || []).map((it: any) => {
        const isLoose = looseIds.has(it.stock_inventory_id)
        return {
          id: it.id,
          existing_id: it.id,
          stock_inventory_id: it.stock_inventory_id || "",
          stock_name: it.product_name,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          total: Number(it.total) || 0,
          is_loose_stock: isLoose,
          product_id: it.product_id || undefined,
          hsn_code: it.hsn_code,
          gst_percentage: it.gst_percentage,
          received_quantity: Number(it.received_quantity) || 0,
          is_locked: isLoose, // Loose stock not editable on this page
          is_itc_eligible: it.is_itc_eligible !== false,
          batch_number: it.batch_number || "",
          purchase_category: it.purchase_category || null,
        }
      }),
        ...looseMapped,
      ]

      setPurchaseItems(mapped)
    } catch (error) {
      console.error("Error loading purchase:", error)
      toast.error("Failed to load purchase")
    } finally {
      setLoading(false)
    }
  }

  const fetchStockItems = async (vendorId: string) => {
    try {
      const { data: stockData, error: stockError } = await supabase
        .from("vendor_stock")
        .select(`
          stock_inventory_id,
          stock_inventory!inner (
            id,
            quantity,
            min_stock,
            price,
            product_variants!inner (
              variant_name,
              product_categories!inner ( name )
            ),
            packaging_materials!inner ( name )
          )
        `)
        .eq("vendor_id", vendorId)

      if (stockError) throw stockError

      const regular: StockItem[] = (stockData || []).map((item: any) => ({
        id: item.stock_inventory.id,
        quantity: item.stock_inventory.quantity,
        min_stock: item.stock_inventory.min_stock || 0,
        price: item.stock_inventory.price || 0,
        category: item.stock_inventory.product_variants.product_categories.name,
        variant: item.stock_inventory.product_variants.variant_name,
        material: item.stock_inventory.packaging_materials.name,
        is_loose_stock: false,
      }))

      // Loose stock categories available from this vendor, same as New Purchase
      const { data: looseStockData, error: looseError } = await supabase
        .from("vendor_loose_stock")
        .select(`
          category_id,
          product_categories!inner ( id, name )
        `)
        .eq("vendor_id", vendorId)

      if (looseError) throw looseError

      const categoryIds = (looseStockData || []).map((item: any) => item.category_id)
      let loose: StockItem[] = []

      if (categoryIds.length > 0) {
        const { data: looseInventory, error: looseInvError } = await supabase
          .from("loose_stock")
          .select(`
            id,
            category_id,
            quantity_liters,
            price_per_liter,
            product_categories!inner ( name )
          `)
          .in("category_id", categoryIds)

        if (looseInvError) throw looseInvError

        loose = (looseInventory || []).map((item: any) => ({
          id: `loose_${item.id}`, // Prefix to distinguish from regular stock ids
          quantity: 0,
          min_stock: 0,
          price: item.price_per_liter,
          category: item.product_categories.name,
          variant: "Loose/Bulk",
          material: "Loose Stock",
          is_loose_stock: true,
          quantity_liters: item.quantity_liters,
        }))
      }

      setStockItems([...regular, ...loose])
    } catch (error) {
      console.error("Error fetching stock items:", error)
      toast.error("Failed to fetch stock items")
    }
  }

  const fetchVendorProducts = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from("vendor_products")
        .select(`
          product_id,
          products!inner (
            id, name, brand, hsn_code, gst_percentage, customer_price, is_active
          )
        `)
        .eq("vendor_id", vendorId)

      if (error) throw error

      const transformed: VendorProduct[] = (data || [])
        .map((row: any) => row.products)
        .filter((p: any) => p && p.is_active)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          hsn_code: p.hsn_code,
          gst_percentage: p.gst_percentage,
          default_price: Number(p.customer_price) || 0,
        }))

      setVendorProducts(transformed)
    } catch (error) {
      console.error("Error fetching vendor products:", error)
    }
  }

  const handleVendorSelect = (vendorId: string) => {
    setSelectedVendorId(vendorId)
    setSelectedStockId("")
    setSelectedProductId("")
    setVendorProducts([])
    setItemQuantity("")
    setItemPrice("")
    setItemTaxableValue("")

    const vendor = vendors.find((v) => v.id === vendorId)
    if (vendor) {
      setFormData({
        ...formData,
        vendor_id: vendor.id,
        supplier_name: vendor.vendor_name,
        supplier_email: vendor.email || "",
        supplier_phone: vendor.mobile_primary,
        supplier_gst_number: vendor.gst_number || "",
        supplier_address_line1: vendor.address_line1,
        supplier_address_line2: vendor.address_line2 || "",
        supplier_city: vendor.city,
        supplier_state: vendor.state,
        supplier_pincode: vendor.pincode,
        supplier_country: vendor.country || "India",
      })
      fetchStockItems(vendor.id)
      if (canPurchaseProducts) fetchVendorProducts(vendor.id)
    }
  }

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId)
    const product = vendorProducts.find((p) => p.id === productId)
    if (product) {
      setItemPrice(product.default_price ? product.default_price.toString() : "")
      setItemTaxableValue("")
      setItemQuantity("")
      setItemGstPercentage(String(product.gst_percentage ?? DEFAULT_GST))
    }
  }

  const handleStockItemSelect = (stockId: string) => {
    setSelectedStockId(stockId)
    const stockItem = stockItems.find((item) => item.id === stockId)
    if (stockItem) {
      setItemPrice(stockItem.price.toString())
      setItemTaxableValue("")
      setItemQuantity("")
    }
  }

  const handleAddItem = () => {
    if (entryMode === "product") {
      if (!selectedProductId) return toast.error("Please select a product")
      if (!itemQuantity || Number(itemQuantity) <= 0) return toast.error("Please enter a valid quantity")
      if (!itemPrice || Number(itemPrice) <= 0) return toast.error("Please enter a valid unit price")

      const product = vendorProducts.find((p) => p.id === selectedProductId)
      if (!product) return

      const gstPct =
        itemGstPercentage.trim() !== ""
          ? Number(itemGstPercentage)
          : product.gst_percentage ?? DEFAULT_GST

      setPurchaseItems([
        ...purchaseItems,
        {
          id: Math.random().toString(36).substr(2, 9),
          stock_inventory_id: "",
          product_id: product.id,
          stock_name: product.brand ? `${product.name} (${product.brand})` : product.name,
          quantity: Number(itemQuantity),
          unit_price: Number(itemPrice),
          total: Number(itemQuantity) * Number(itemPrice),
          hsn_code: product.hsn_code,
          gst_percentage: gstPct,
          is_itc_eligible: true,
          batch_number: itemBatchNumber || "",
          purchase_category: itemCategory || null,
        },
      ])
      setSelectedProductId("")
      setItemQuantity("")
      setItemPrice("")
      setItemTaxableValue("")
      setItemGstPercentage(String(DEFAULT_GST))
      return
    }

    if (useManualEntry) {
      if (!manualItemName.trim()) return toast.error("Please enter a product name")
      if (!itemQuantity || Number(itemQuantity) <= 0) return toast.error("Please enter a valid quantity")
      if (!itemPrice || Number(itemPrice) <= 0) return toast.error("Please enter a valid unit price")

      setPurchaseItems([
        ...purchaseItems,
        {
          id: Math.random().toString(36).substr(2, 9),
          stock_inventory_id: "",
          stock_name: manualItemName.trim(),
          quantity: Number(itemQuantity),
          unit_price: Number(itemPrice),
          total: Number(itemQuantity) * Number(itemPrice),
          gst_percentage:
            itemGstPercentage.trim() !== "" ? Number(itemGstPercentage) : DEFAULT_GST,
          is_itc_eligible: true,
          batch_number: itemBatchNumber || "",
          purchase_category: itemCategory || null,
        },
      ])
      setManualItemName("")
      setItemQuantity("1")
      setItemPrice("")
      setItemTaxableValue("")
      setItemGstPercentage(String(DEFAULT_GST))
      return
    }

    if (!selectedStockId) return toast.error("Please select a stock item")
    if (!itemQuantity || Number(itemQuantity) <= 0) return toast.error("Please enter a valid quantity")
    if (!itemPrice || Number(itemPrice) <= 0) return toast.error("Please enter a valid unit price")

    const stockItem = stockItems.find((item) => item.id === selectedStockId)
    if (!stockItem) return

    // For loose stock, extract the real loose_stock.id by removing the "loose_" prefix
    const isLooseStock = stockItem.is_loose_stock || false
    const actualId = isLooseStock ? selectedStockId.replace("loose_", "") : selectedStockId

    setPurchaseItems([
      ...purchaseItems,
      {
        id: Math.random().toString(36).substr(2, 9),
        stock_inventory_id: actualId,
        stock_name: `${stockItem.category} - ${stockItem.variant} - ${stockItem.material}`,
        quantity: Number(itemQuantity),
        unit_price: Number(itemPrice),
        total: Number(itemQuantity) * Number(itemPrice),
        is_loose_stock: isLooseStock,
        loose_stock_category_id: isLooseStock ? actualId : undefined,
        gst_percentage:
          itemGstPercentage.trim() !== "" ? Number(itemGstPercentage) : DEFAULT_GST,
        is_itc_eligible: true,
        batch_number: itemBatchNumber || "",
        purchase_category: itemCategory || null,
      },
    ])
    setSelectedStockId("")
    setItemQuantity("")
    setItemPrice("")
    setItemTaxableValue("")
    setItemGstPercentage(String(DEFAULT_GST))
  }

  const handleRemoveItem = (id: string) => {
    const item = purchaseItems.find((p) => p.id === id)
    if (item?.is_locked) {
      toast.error("Loose-stock items cannot be removed from this page")
      return
    }
    setPurchaseItems(purchaseItems.filter((item) => item.id !== id))
  }

  // Inline edits to existing line items (completed/received purchases included)
  const handleItemFieldChange = (
    id: string,
    field: "quantity" | "unit_price",
    value: number
  ) => {
    setPurchaseItems((prev) =>
      prev.map((it) => {
        if (it.id !== id || it.is_locked) return it
        const quantity = field === "quantity" ? value : it.quantity
        const unit_price = field === "unit_price" ? value : it.unit_price
        return { ...it, quantity, unit_price, total: quantity * unit_price }
      })
    )
  }

  const calculateTotals = () => {
    // Purchases (milk, packaging, etc.) are received at the Gujarat factory.
    const COMPANY_STATE = "Gujarat"
    const supplierState = (formData.supplier_state || "").trim()
    const supplierStateMissing = !supplierState
    const isInterState =
      !supplierStateMissing &&
      supplierState.toLowerCase() !== COMPANY_STATE.toLowerCase()

    let subtotal = 0
    let totalGst = 0
    let cgstAmount = 0
    let sgstAmount = 0
    let igstAmount = 0

    purchaseItems.forEach((item) => {
      // item.unit_price / item.total are the excl.-tax rate and its extension
      // (what's actually written on a vendor bill) — GST is added on top,
      // never extracted back out of them.
      subtotal += item.total
      const pct = Number(item.gst_percentage) || 0
      if (pct <= 0) return
      const itemGst = (item.total * pct) / 100
      totalGst += itemGst
      if (isInterState) {
        igstAmount += itemGst
      } else {
        cgstAmount += itemGst / 2
        sgstAmount += itemGst / 2
      }
    })

    const discount = Number(formData.discount_amount) || 0
    const shipping = Number(formData.shipping_charges) || 0
    const roundOff = Number(formData.round_off) || 0
    // GST is added on top of the taxable subtotal (matches Tally: subtotal +
    // CGST/SGST/IGST = grand total, then round off).
    const preRoundTotal = subtotal - discount + shipping + totalGst
    const total = preRoundTotal + roundOff
    return {
      subtotal,
      total,
      preRoundTotal,
      totalGst,
      cgstAmount,
      sgstAmount,
      igstAmount,
      isInterState,
      supplierStateMissing,
    }
  }

  const totals = calculateTotals()

  // Fills the Round Off field with the delta needed to reach the nearest rupee.
  const handleAutoRoundOff = () => {
    const delta = Math.round(totals.preRoundTotal) - totals.preRoundTotal
    setFormData((prev) => ({ ...prev, round_off: delta.toFixed(2) }))
  }

  // Next sequential purchase_number for the current calendar year — used when
  // graduating a standalone loose transaction into a real purchases row,
  // which otherwise has no purchase_number and would violate its NOT NULL.
  const generatePurchaseNumber = async () => {
    const year = new Date().getFullYear()
    const prefix = `PO-${year}-`
    const { data, error } = await supabase
      .from("purchases")
      .select("purchase_number")
      .ilike("purchase_number", `${prefix}%`)
      .order("purchase_number", { ascending: false })
      .limit(1)

    if (error) throw error

    let nextSeq = 1
    const match = data?.[0]?.purchase_number?.match(/(\d+)$/)
    if (match) nextSeq = parseInt(match[1], 10) + 1

    return `${prefix}${String(nextSeq).padStart(4, "0")}`
  }

  const handleSave = async () => {
    if (!selectedVendorId) {
      toast.error("Please select a vendor")
      return
    }
    if (purchaseItems.length === 0) {
      toast.error("Please add at least one item")
      return
    }
    // "Mixed" means there's deliberately no purchase-level default — every
    // line has to say what it actually is, or it'd have nothing to fall
    // back to when saved (and would silently vanish from the P&L/Expenses page).
    if (formData.purchase_category === "mixed") {
      const uncategorized = purchaseItems.filter((item) => !item.is_locked && !item.purchase_category)
      if (uncategorized.length > 0) {
        toast.error(
          `Purchase Category is set to "None — set per item", but ${uncategorized.length} item${uncategorized.length === 1 ? " hasn't" : "s haven't"} been given a category. Set one for every item, or pick a single category for the whole purchase instead.`
        )
        return
      }
    }

    setSaving(true)
    try {
      const purchaseData: Record<string, any> = {
        vendor_id: formData.vendor_id || null,
        supplier_name: formData.supplier_name,
        supplier_email: formData.supplier_email || null,
        supplier_phone: formData.supplier_phone || null,
        supplier_gst_number: formData.supplier_gst_number || null,
        supplier_address_line1: formData.supplier_address_line1 || null,
        supplier_address_line2: formData.supplier_address_line2 || null,
        supplier_city: formData.supplier_city || null,
        supplier_state: formData.supplier_state || null,
        supplier_pincode: formData.supplier_pincode || null,
        supplier_country: formData.supplier_country,
        purchase_status: formData.purchase_status,
        payment_status: formData.payment_status,
        payment_method: formData.payment_method || null,
        subtotal: totals.subtotal,
        discount_amount: Number(formData.discount_amount),
        gst_amount: totals.totalGst,
        cgst_amount: totals.cgstAmount,
        sgst_amount: totals.sgstAmount,
        igst_amount: totals.igstAmount,
        shipping_charges: Number(formData.shipping_charges),
        round_off: Number(formData.round_off) || 0,
        total_amount: totals.total,
        purchase_notes: formData.purchase_notes || null,
        internal_notes: formData.internal_notes || null,
        terms_and_conditions: formData.terms_and_conditions || null,
        invoice_number: formData.invoice_number || null,
        batch_number: formData.batch_number || null,
        is_urgent: formData.is_urgent,
        purchase_date: formData.purchase_date
          ? new Date(formData.purchase_date + "T00:00:00").toISOString()
          : null,
        purchase_category: formData.purchase_category,
        // Quick purchase-level indicator; per-item is_itc_eligible on
        // purchase_items is the actual source of truth for GST-payable ITC.
        is_itc_eligible: purchaseItems.every((item) => item.is_itc_eligible !== false),
      }

      // Standalone loose transactions have no purchases row yet — create one
      // (graduating it into a real purchase order) instead of updating.
      let actualPurchaseId: string
      if (graduatingLooseTxnId) {
        const purchaseNumber = await generatePurchaseNumber()
        const { data: newPurchase, error: insertPurchaseError } = await supabase
          .from("purchases")
          .insert([{ ...purchaseData, purchase_number: purchaseNumber }])
          .select()
          .single()
        if (insertPurchaseError) throw insertPurchaseError
        actualPurchaseId = newPurchase.id
      } else {
        const { error: updateError } = await supabase
          .from("purchases")
          .update(purchaseData)
          .eq("id", purchaseId)
        if (updateError) throw updateError
        actualPurchaseId = purchaseId
      }

      // Replace non-loose purchase_items. Loose items remain untouched
      // because their loose_stock side effects shouldn't be re-applied.
      const looseExistingIds = purchaseItems
        .filter((p) => p.is_locked && p.existing_id)
        .map((p) => p.existing_id as string)

      let deleteQuery = supabase
        .from("purchase_items")
        .delete()
        .eq("purchase_id", actualPurchaseId)

      if (looseExistingIds.length > 0) {
        deleteQuery = deleteQuery.not("id", "in", `(${looseExistingIds.join(",")})`)
      }

      const { error: deleteError } = await deleteQuery
      if (deleteError) throw deleteError

      const editableItems = purchaseItems.filter((p) => !p.is_locked)

      const productItems = editableItems.filter((i) => i.product_id)
      const looseItems = editableItems.filter((i) => i.is_loose_stock)
      const regularItems = editableItems.filter((i) => !i.product_id && !i.is_loose_stock && i.stock_inventory_id)
      const manualItems = editableItems.filter((i) => !i.product_id && !i.is_loose_stock && !i.stock_inventory_id)

      const inserts: any[] = []

      manualItems.forEach((item) => {
        const pct = Number(item.gst_percentage) || 0
        const itemGst = pct > 0 ? (item.total * pct) / 100 : 0
        inserts.push({
          purchase_id: actualPurchaseId,
          product_name: item.stock_name,
          gst_percentage: item.gst_percentage ?? null,
          gst_amount: itemGst,
          cgst_amount: totals.isInterState ? 0 : itemGst / 2,
          sgst_amount: totals.isInterState ? 0 : itemGst / 2,
          igst_amount: totals.isInterState ? itemGst : 0,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.total,
          total: item.total,
          received_quantity: item.received_quantity ?? 0,
          is_itc_eligible: item.is_itc_eligible !== false,
          batch_number: item.batch_number || null,
          purchase_category: item.purchase_category || null,
        })
      })

      productItems.forEach((item) => {
        const pct = Number(item.gst_percentage) || 0
        const itemGst = pct > 0 ? (item.total * pct) / 100 : 0
        inserts.push({
          purchase_id: actualPurchaseId,
          product_id: item.product_id,
          product_name: item.stock_name,
          hsn_code: item.hsn_code || null,
          gst_percentage: item.gst_percentage ?? null,
          gst_amount: itemGst,
          cgst_amount: totals.isInterState ? 0 : itemGst / 2,
          sgst_amount: totals.isInterState ? 0 : itemGst / 2,
          igst_amount: totals.isInterState ? itemGst : 0,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.total,
          total: item.total,
          received_quantity: item.received_quantity ?? 0,
          is_itc_eligible: item.is_itc_eligible !== false,
          batch_number: item.batch_number || null,
          purchase_category: item.purchase_category || null,
        })
      })

      regularItems.forEach((item) => {
        const pct = Number(item.gst_percentage) || 0
        const itemGst = pct > 0 ? (item.total * pct) / 100 : 0
        inserts.push({
          purchase_id: actualPurchaseId,
          stock_inventory_id: item.stock_inventory_id,
          product_name: item.stock_name,
          gst_percentage: item.gst_percentage ?? null,
          gst_amount: itemGst,
          cgst_amount: totals.isInterState ? 0 : itemGst / 2,
          sgst_amount: totals.isInterState ? 0 : itemGst / 2,
          igst_amount: totals.isInterState ? itemGst : 0,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.total,
          total: item.total,
          received_quantity: item.received_quantity ?? 0,
          is_itc_eligible: item.is_itc_eligible !== false,
          batch_number: item.batch_number || null,
          purchase_category: item.purchase_category || null,
        })
      })

      const { categorySaveSkipped } = await insertPurchaseItems(supabase, inserts)

      // Existing loose items (loaded from loose_stock_transactions, whether
      // graduating from standalone or already part of this purchase): update
      // the ORIGINAL row in place — never insert a new one for these — and
      // apply only the quantity DELTA to the loose_stock balance, since the
      // original quantity was already added to it once before.
      const existingLooseItems = looseItems.filter((i) => i.existing_id)
      const newLooseItems = looseItems.filter((i) => !i.existing_id)

      for (const item of existingLooseItems) {
        const pct = Number(item.gst_percentage) || 0
        const itemGst = pct > 0 ? (item.total * pct) / 100 : 0
        const updatePayload: Record<string, any> = {
          quantity_liters: item.quantity,
          price_per_liter: item.unit_price,
          total_amount: item.total,
          purchase_id: actualPurchaseId,
          batch_number: item.batch_number || null,
          gst_percentage: item.gst_percentage ?? null,
          gst_amount: itemGst,
          cgst_amount: totals.isInterState ? 0 : itemGst / 2,
          sgst_amount: totals.isInterState ? 0 : itemGst / 2,
          igst_amount: totals.isInterState ? itemGst : 0,
          is_itc_eligible: item.is_itc_eligible !== false,
          // Loose items have no date field of their own in this form — they
          // always follow the purchase's own date, same as regular
          // purchase_items (which have no date column at all, only the join).
          transaction_date: formData.purchase_date
            ? new Date(formData.purchase_date + "T00:00:00").toISOString()
            : new Date().toISOString(),
        }
        // The header's invoice/notes were sourced from this exact transaction
        // only when it's the one graduating from standalone — other existing
        // loose items on a mixed purchase keep their own.
        if (item.existing_id === graduatingLooseTxnId) {
          updatePayload.vendor_id = formData.vendor_id || null
          updatePayload.invoice_number = formData.invoice_number || null
          updatePayload.transaction_notes = formData.purchase_notes || null
        }

        const { error: txnUpdateError } = await supabase
          .from("loose_stock_transactions")
          .update(updatePayload)
          .eq("id", item.existing_id)

        if (txnUpdateError) throw txnUpdateError

        const originalQuantity = originalLooseQuantities.get(item.existing_id as string) ?? item.quantity
        const delta = item.quantity - originalQuantity
        if (delta !== 0) {
          const { data: currentStock, error: stockFetchError } = await supabase
            .from("loose_stock")
            .select("quantity_liters")
            .eq("id", item.stock_inventory_id)
            .maybeSingle()

          if (stockFetchError) throw stockFetchError

          const newBalance = Math.max(0, Number(currentStock?.quantity_liters || 0) + delta)

          const { error: stockUpdateError } = await supabase
            .from("loose_stock")
            .update({ quantity_liters: newBalance })
            .eq("id", item.stock_inventory_id)

          if (stockUpdateError) throw stockUpdateError
        }
      }

      // Any brand-new loose-stock items added during this edit: create the
      // ledger transaction and adjust the loose_stock running balance, same
      // as when a loose item is added on the New Purchase page.
      for (const item of newLooseItems) {
        const { data: currentStock, error: fetchError } = await supabase
          .from("loose_stock")
          .select("quantity_liters")
          .eq("id", item.stock_inventory_id)
          .single()

        if (fetchError) throw fetchError

        const newQuantity = (currentStock?.quantity_liters || 0) + item.quantity

        const { error: stockUpdateError } = await supabase
          .from("loose_stock")
          .update({ quantity_liters: newQuantity })
          .eq("id", item.stock_inventory_id)

        if (stockUpdateError) throw stockUpdateError

        const pct = Number(item.gst_percentage) || 0
        const itemGst = pct > 0 ? (item.total * pct) / 100 : 0

        const { error: transactionError } = await supabase
          .from("loose_stock_transactions")
          .insert([{
            loose_stock_id: item.stock_inventory_id,
            transaction_type: "purchase",
            quantity_liters: item.quantity,
            price_per_liter: item.unit_price,
            total_amount: item.total,
            vendor_id: formData.vendor_id || null,
            purchase_id: actualPurchaseId,
            invoice_number: formData.invoice_number || null,
            batch_number: item.batch_number || formData.batch_number || null,
            transaction_notes: formData.purchase_notes || null,
            transaction_date: formData.purchase_date
              ? new Date(formData.purchase_date + "T00:00:00").toISOString()
              : new Date().toISOString(),
            gst_percentage: item.gst_percentage ?? null,
            gst_amount: itemGst,
            cgst_amount: totals.isInterState ? 0 : itemGst / 2,
            sgst_amount: totals.isInterState ? 0 : itemGst / 2,
            igst_amount: totals.isInterState ? itemGst : 0,
            is_itc_eligible: item.is_itc_eligible !== false,
          }])

        if (transactionError) throw transactionError
      }

      if (categorySaveSkipped) {
        toast.warning(
          "Purchase saved, but per-item categories weren't — the database hasn't been updated for that yet. Ask to run migrations/add_purchase_item_category.sql, then re-set each item's category on this purchase."
        )
      } else {
        toast.success(graduatingLooseTxnId ? "Purchase order created" : "Purchase order updated")
      }
      router.push(`/dashboard/purchases/${actualPurchaseId}`)
    } catch (error: unknown) {
      console.error("Error updating purchase:", error)
      const msg = error instanceof Error ? error.message : "Failed to update purchase"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Alt+A finishes and saves the edit, same as clicking "Save Changes".
  useSaveShortcut(handleSave, saving)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Loading...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-8 w-8" />
            Edit Purchase Order
          </h1>
          <p className="text-muted-foreground">
            {purchaseNumber ? `Editing ${purchaseNumber}` : "Editing purchase order"}
          </p>
        </div>
      </div>

      {isReceived && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This purchase is marked as <strong>received</strong>. Editing line items
          here will not adjust stock that has already been moved by the receive
          trigger. Update header fields freely; change line items with caution.
        </div>
      )}

      <div className="grid gap-6">
        {/* Supplier */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
            <CardDescription>Select a vendor from your database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_select">Select Vendor *</Label>
              <VendorCombobox
                vendors={vendors}
                value={selectedVendorId}
                onValueChange={handleVendorSelect}
                placeholder="Search by name, phone, company..."
              />
              {vendors.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No vendors found. Please add vendors first from the{" "}
                  <Link href="/dashboard/vendors" className="text-blue-600 hover:underline">
                    Vendors page
                  </Link>
                  .
                </p>
              )}
            </div>

            {selectedVendorId && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Supplier Name</Label>
                    <Input value={formData.supplier_name} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={formData.supplier_email} disabled className="bg-muted" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={formData.supplier_phone} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <Input value={formData.supplier_gst_number} disabled className="bg-muted" />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Purchase Items</CardTitle>
                <CardDescription>Add or remove items on this purchase</CardDescription>
              </div>
              {selectedVendorId && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={entryMode === "stock" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setEntryMode("stock")
                      setSelectedStockId("")
                      setSelectedProductId("")
                      setManualItemName("")
                      setItemQuantity("")
                      setItemPrice("")
                      setItemTaxableValue("")
                      setItemGstPercentage(String(DEFAULT_GST))
                    }}
                  >
                    Stock
                  </Button>
                  {canPurchaseProducts && (
                    <Button
                      type="button"
                      variant={entryMode === "product" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setEntryMode("product")
                        setSelectedStockId("")
                        setSelectedProductId("")
                        setManualItemName("")
                        setItemQuantity("")
                        setItemPrice("")
                        setItemTaxableValue("")
                        setItemGstPercentage(String(DEFAULT_GST))
                      }}
                    >
                      Products
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={entryMode === "manual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setEntryMode("manual")
                      setSelectedStockId("")
                      setSelectedProductId("")
                      setManualItemName("")
                      // Manual lines are usually a lump-sum expense (e.g. "Repairing
                      // Expense") with no real quantity concept — default to 1 so
                      // Unit Price / Taxable Value can just be the full amount.
                      setItemQuantity("1")
                      setItemPrice("")
                      setItemTaxableValue("")
                      setItemGstPercentage(String(DEFAULT_GST))
                    }}
                  >
                    Manual
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedVendorId ? (
              <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
                <p className="text-muted-foreground">Please select a vendor first</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-7">
                  {entryMode === "manual" ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="manual_item_name">Product Name</Label>
                      <Input
                        id="manual_item_name"
                        value={manualItemName}
                        onChange={(e) => setManualItemName(e.target.value)}
                        placeholder="e.g. Mobile Oil"
                      />
                    </div>
                  ) : entryMode === "product" ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="vendor_product">Select Product</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={handleProductSelect}
                        disabled={vendorProducts.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              vendorProducts.length === 0
                                ? "No products linked to this vendor"
                                : "Select a catalog product..."
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {vendorProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                              {product.brand ? ` (${product.brand})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="stock_item">Select Stock Item</Label>
                      <StockItemCombobox
                        stockItems={stockItems}
                        value={selectedStockId}
                        onValueChange={handleStockItemSelect}
                        placeholder="Search stock items..."
                        disabled={stockItems.length === 0}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="item_batch_number">Batch No.</Label>
                    <Input
                      id="item_batch_number"
                      value={itemBatchNumber}
                      onChange={(e) => setItemBatchNumber(e.target.value)}
                      placeholder="e.g. B-12"
                    />
                    <p className="text-xs text-muted-foreground">
                      Carries over to the next item.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="item_quantity">
                      Quantity
                      {!useManualEntry && (() => {
                        const stockItem = stockItems.find((item) => item.id === selectedStockId)
                        return stockItem?.is_loose_stock ? " (Liters)" : ""
                      })()}
                    </Label>
                    <Input
                      id="item_quantity"
                      type="number"
                      min="0.01"
                      step={useManualEntry ? "1" : (() => {
                        const stockItem = stockItems.find((item) => item.id === selectedStockId)
                        return stockItem?.is_loose_stock ? "0.01" : "1"
                      })()}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      placeholder={useManualEntry ? "Enter quantity" : (() => {
                        const stockItem = stockItems.find((item) => item.id === selectedStockId)
                        return stockItem?.is_loose_stock ? "Enter liters" : "Enter quantity"
                      })()}
                    />
                    {!useManualEntry && selectedStockId && (() => {
                      const stockItem = stockItems.find((item) => item.id === selectedStockId)
                      if (stockItem?.is_loose_stock) {
                        return (
                          <p className="text-xs text-orange-600">
                            Available: {stockItem.quantity_liters?.toFixed(2)}L
                          </p>
                        )
                      }
                      return null
                    })()}
                    {useManualEntry && (
                      <p className="text-xs text-muted-foreground">
                        Lump-sum expense with no real quantity? Leave this as 1 and put the full amount in Rate/Unit (Excl. Tax).
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="item_price">
                      {(() => {
                        const stockItem = stockItems.find((item) => item.id === selectedStockId)
                        return !useManualEntry && stockItem?.is_loose_stock ? "Price per Liter (Excl. Tax) (₹)" : "Rate/Unit (Excl. Tax) (₹)"
                      })()}
                    </Label>
                    <Input
                      id="item_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemPrice}
                      onChange={(e) => {
                        setItemPrice(e.target.value)
                        // Typing the excl.-tax rate directly makes it the source
                        // of truth again — the incl.-tax shortcut no longer applies.
                        setItemTaxableValue("")
                      }}
                      placeholder={useManualEntry ? "Enter rate" : "Auto-filled"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="item_taxable_value">Rate (Incl. of Tax) (₹)</Label>
                    <Input
                      id="item_taxable_value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemTaxableValue}
                      onChange={(e) => {
                        const val = e.target.value
                        setItemTaxableValue(val)
                        if (val.trim() !== "" && !isNaN(Number(val))) {
                          const pct = Number(itemGstPercentage) || 0
                          setItemPrice((Number(val) / (1 + pct / 100)).toFixed(2))
                        }
                      }}
                      placeholder="Know the incl.-tax rate instead?"
                    />
                    <p className="text-xs text-muted-foreground">
                      Only know the incl.-tax rate? Enter it here — the excl.-tax rate is calculated for you.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="item_gst">GST %</Label>
                    <Input
                      id="item_gst"
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemGstPercentage}
                      onChange={(e) => {
                        const val = e.target.value
                        setItemGstPercentage(val)
                        if (itemTaxableValue.trim() !== "" && !isNaN(Number(itemTaxableValue))) {
                          const pct = Number(val) || 0
                          setItemPrice((Number(itemTaxableValue) / (1 + pct / 100)).toFixed(2))
                        }
                      }}
                      placeholder="GST %"
                    />
                    <p className="text-xs text-muted-foreground">
                      Applied on top of the excl.-tax rate. Default {DEFAULT_GST}%.
                    </p>
                  </div>
                </div>

                {/* Only matters when a single invoice mixes categories across
                    lines (e.g. a Direct Expense line + an Indirect Expense
                    line on the same voucher) — leave on "Same as purchase" otherwise. */}
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="item_category" className="text-xs text-muted-foreground shrink-0">
                    This item&apos;s category:
                  </Label>
                  <Select value={itemCategory || "__default__"} onValueChange={(v) => setItemCategory(v === "__default__" ? "" : (v as PurchaseCategory))}>
                    <SelectTrigger id="item_category" className="w-full sm:w-[260px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">{defaultCategoryOptionLabel(formData.purchase_category)}</SelectItem>
                      <SelectItem value="material">Material Purchase</SelectItem>
                      <SelectItem value="direct_expense">Direct Expense</SelectItem>
                      <SelectItem value="indirect_expense">Indirect Expense</SelectItem>
                      <SelectItem value="fixed_asset">Fixed Asset</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full"
                  disabled={
                    (entryMode === "stock" && stockItems.length === 0) ||
                    (entryMode === "product" && vendorProducts.length === 0)
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>

                {purchaseItems.length > 0 && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Batch No.</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Rate (Incl. of Tax)</TableHead>
                          <TableHead className="text-right">Rate/Unit (Excl. Tax)</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="text-right">Taxable Amt</TableHead>
                          <TableHead className="text-center">GST %</TableHead>
                          <TableHead className="text-right">GST Amt</TableHead>
                          <TableHead className="text-center">ITC</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseItems.map((item) => {
                          // item.unit_price / item.total are the excl.-tax rate and its
                          // extension (what's actually written on a vendor bill) — GST is
                          // added on top here, never extracted back out of them.
                          const pct = Number(item.gst_percentage) || 0
                          const taxableAmt = item.total
                          const gstAmt = pct > 0 ? (taxableAmt * pct) / 100 : 0
                          const totalInclTax = taxableAmt + gstAmt
                          const ratePerUnitInclTax = item.quantity > 0 ? totalInclTax / item.quantity : 0

                          return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.is_locked ? (
                                <>
                                  {item.stock_name}
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (loose stock — read-only)
                                  </span>
                                </>
                              ) : (
                                <Input
                                  value={item.stock_name}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setPurchaseItems((prev) =>
                                      prev.map((p) => (p.id === item.id ? { ...p, stock_name: val } : p))
                                    )
                                  }}
                                  placeholder="Item name"
                                  className="min-w-[180px] h-8 font-medium"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {item.is_locked ? (
                                <span className="text-xs text-muted-foreground">Material</span>
                              ) : (
                                <Select
                                  value={item.purchase_category || "__default__"}
                                  onValueChange={(v) =>
                                    setPurchaseItems((prev) =>
                                      prev.map((p) =>
                                        p.id === item.id
                                          ? { ...p, purchase_category: v === "__default__" ? null : (v as PurchaseCategory) }
                                          : p
                                      )
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-[150px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__default__">
                                      {defaultCategoryOptionLabel(formData.purchase_category)}
                                    </SelectItem>
                                    <SelectItem value="material">Material Purchase</SelectItem>
                                    <SelectItem value="direct_expense">Direct Expense</SelectItem>
                                    <SelectItem value="indirect_expense">Indirect Expense</SelectItem>
                                    <SelectItem value="fixed_asset">Fixed Asset</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.is_locked ? (
                                "—"
                              ) : (
                                <Input
                                  value={item.batch_number ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setPurchaseItems((prev) =>
                                      prev.map((p) => (p.id === item.id ? { ...p, batch_number: val } : p))
                                    )
                                  }}
                                  placeholder="e.g. B-12"
                                  className="w-24 h-8"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {item.is_locked ? (
                                item.quantity
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="h-8 w-24"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleItemFieldChange(item.id, "quantity", parseFloat(e.target.value) || 0)
                                  }
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {item.is_locked ? (
                                <>₹{ratePerUnitInclTax.toFixed(2)}</>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-8 w-28"
                                  value={ratePerUnitInclTax.toFixed(2)}
                                  onChange={(e) => {
                                    const inclRate = Number(e.target.value) || 0
                                    setPurchaseItems((prev) =>
                                      prev.map((p) => {
                                        if (p.id !== item.id) return p
                                        const rowPct = Number(p.gst_percentage) || 0
                                        const exclPrice = inclRate / (1 + rowPct / 100)
                                        return { ...p, unit_price: exclPrice, total: p.quantity * exclPrice }
                                      })
                                    )
                                  }}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {item.is_locked ? (
                                <span className="text-muted-foreground">₹{item.unit_price.toFixed(2)}</span>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-8 w-24 text-right"
                                  value={item.unit_price}
                                  onChange={(e) =>
                                    handleItemFieldChange(item.id, "unit_price", parseFloat(e.target.value) || 0)
                                  }
                                />
                              )}
                            </TableCell>
                            <TableCell className="font-semibold">₹{totalInclTax.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              ₹{taxableAmt.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.is_locked ? (
                                pct
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.gst_percentage ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value
                                    setPurchaseItems((prev) =>
                                      prev.map((p) =>
                                        p.id === item.id
                                          ? { ...p, gst_percentage: raw === "" ? 0 : Number(raw) }
                                          : p
                                      )
                                    )
                                  }}
                                  className="w-20 h-8 text-center mx-auto"
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-right">₹{gstAmt.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={item.is_itc_eligible !== false}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setPurchaseItems((prev) =>
                                    prev.map((p) => (p.id === item.id ? { ...p, is_itc_eligible: checked } : p))
                                  )
                                }}
                                title={
                                  item.is_itc_eligible !== false
                                    ? "Counts toward Input Tax Credit"
                                    : "Excluded from Input Tax Credit (e.g. exempt milk purchase)"
                                }
                                className="h-4 w-4"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={item.is_locked}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          )
                        })}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={5} className="text-right">Subtotal:</TableCell>
                          <TableCell className="font-bold">₹{(totals.subtotal + totals.totalGst).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">
                            ₹{totals.subtotal.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center"></TableCell>
                          <TableCell className="text-right font-bold">₹{totals.totalGst.toFixed(2)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Charges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Additional Charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="discount_amount" className="text-xs">Discount</Label>
                <Input
                  id="discount_amount"
                  type="number"
                  step="0.01"
                  className="h-8 w-24"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="shipping_charges" className="text-xs">Shipping</Label>
                <Input
                  id="shipping_charges"
                  type="number"
                  step="0.01"
                  className="h-8 w-24"
                  value={formData.shipping_charges}
                  onChange={(e) => setFormData({ ...formData, shipping_charges: e.target.value })}
                />
              </div>

              <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleAutoRoundOff}>
                Round Off
              </Button>
              <div className="space-y-1">
                <Label htmlFor="round_off" className="text-xs">Round Off Amount</Label>
                <Input
                  id="round_off"
                  type="number"
                  step="0.01"
                  className="h-8 w-24"
                  value={formData.round_off}
                  onChange={(e) => setFormData({ ...formData, round_off: e.target.value })}
                />
              </div>
            </div>

            {totals.supplierStateMissing && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Supplier has no state on file — GST split defaults to CGST+SGST,
                  which may be wrong if this is an inter-state purchase.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">GST (added on top)</span>
              <span className="text-muted-foreground">
                {totals.isInterState
                  ? `IGST ₹${totals.igstAmount.toFixed(2)}`
                  : `CGST ₹${totals.cgstAmount.toFixed(2)} + SGST ₹${totals.sgstAmount.toFixed(2)}`}
              </span>
              <span className="font-semibold">₹{totals.totalGst.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center rounded-lg bg-muted px-4 py-3 text-base font-bold">
              <span>Total Amount:</span>
              <span className="text-xl">₹{totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status & Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Purchase Status</Label>
                <Select
                  value={formData.purchase_status}
                  onValueChange={(v) => setFormData({ ...formData, purchase_status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(v) => setFormData({ ...formData, payment_status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Input
                  id="payment_method"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  placeholder="e.g. Bank Transfer"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="purchase_category">Purchase Category</Label>
                <Select
                  value={formData.purchase_category}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      purchase_category: value as PurchaseCategory,
                    })
                  }
                >
                  <SelectTrigger id="purchase_category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material Purchase</SelectItem>
                    <SelectItem value="direct_expense">Direct Expense</SelectItem>
                    <SelectItem value="indirect_expense">Indirect Expense</SelectItem>
                    <SelectItem value="fixed_asset">Fixed Asset</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="mixed">None — set per item</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {purchaseCategoryHint(formData.purchase_category)}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch_number">Batch Number</Label>
                <Input
                  id="batch_number"
                  value={formData.batch_number}
                  onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase_notes">Purchase Notes</Label>
              <Textarea
                id="purchase_notes"
                value={formData.purchase_notes}
                onChange={(e) => setFormData({ ...formData, purchase_notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Internal Notes</Label>
              <Textarea
                id="internal_notes"
                value={formData.internal_notes}
                onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_urgent}
                  onChange={(e) => setFormData({ ...formData, is_urgent: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">Mark as Urgent</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/purchases/${purchaseId}`)}
            disabled={saving}
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
