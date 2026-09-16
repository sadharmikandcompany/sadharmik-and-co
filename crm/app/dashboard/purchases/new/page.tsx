"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { ArrowLeft, ShoppingBag, Plus, Trash2, Droplets, AlertCircle, ChevronDown, ChevronUp, Upload, FileImage } from "lucide-react"
import { useUserRole } from "@/hooks/use-user-role"
import { useEntityData } from "@/hooks/use-entity-data"
import { useSaveShortcut } from "@/hooks/use-save-shortcut"

// Default GST % applied to every line, added on top of the excl.-tax rate; editable per line.
const DEFAULT_GST = 5

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

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
  company_name: string | null
  gst_number: string | null
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  pincode: string
  country: string | null
  transport_vehicle?: string | null
  transporter_name?: string | null
  transporter_number?: string | null
}

type StockItem = {
  id: string
  category: string
  variant: string
  material: string
  quantity: number
  min_stock: number
  price: number
  is_loose_stock?: boolean // Flag to identify loose stock items
  quantity_liters?: number // For loose stock, quantity in liters
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

type PurchaseItem = {
  id: string
  stock_inventory_id: string
  stock_name: string
  quantity: number
  unit_price: number
  total: number
  is_loose_stock?: boolean
  loose_stock_category_id?: string // For loose stock, the actual category ID
  product_id?: string // For catalog-product line items (admin/factory)
  hsn_code?: string | null
  gst_percentage?: number | null
  // Whether this line's GST counts toward Input Tax Credit. Milk (0% GST) never
  // generates ITC; this is an explicit safety-net flag independent of the GST%
  // in case a rate is left non-zero by mistake on an exempt item.
  is_itc_eligible?: boolean
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

export default function NewPurchasePage() {
  const router = useRouter()
  const { role } = useUserRole()
  const { entityId } = useEntityData()
  const isDistributor = role === "main_distributor" || role === "sub_distributor"
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  // Vendor detail fields are read-only (just a confirmation preview) — collapsed
  // by default so picking a vendor doesn't push the rest of the form down.
  const [showVendorDetails, setShowVendorDetails] = useState(false)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  // Screenshot line items that need a human to confirm (or correct) which
  // stock/product they resolve to before they're added — nothing from a
  // screenshot gets added to the order silently. suggestedKey is a best-guess
  // pre-selection ("stock:<id>" / "product:<id>"), empty if no guess at all.
  const [pendingScreenshotItems, setPendingScreenshotItems] = useState<{
    id: string
    description: string
    hsnCode: string
    quantity: number
    unit: string
    ratePerUnitExclTax: number
    gstPercent: number
    suggestedKey: string
  }[]>([])
  const [screenshotStockPool, setScreenshotStockPool] = useState<StockItem[]>([])
  const [screenshotProductPool, setScreenshotProductPool] = useState<VendorProduct[]>([])
  const [screenshotVendorId, setScreenshotVendorId] = useState<string>("")

  // Stock Items
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string>("")
  const [itemQuantity, setItemQuantity] = useState<string>("")
  const [itemPrice, setItemPrice] = useState<string>("")
  // Carries over between adds (most lines in an invoice share a batch);
  // change it mid-way through adding items when a second batch starts.
  const [itemBatchNumber, setItemBatchNumber] = useState<string>("")
  // Per-line category override, carries over between adds like batch number.
  // "" means "same as the purchase's own category" (formData.purchase_category)
  // — only set when a line genuinely differs, e.g. a Transportation line on
  // an otherwise Direct Expense invoice.
  const [itemCategory, setItemCategory] = useState<PurchaseCategory | "">("")
  // Alternative entry point when only the GST-inclusive rate is known instead
  // of the excl.-tax rate — typing here back-computes itemPrice (excl. tax).
  const [itemTaxableValue, setItemTaxableValue] = useState<string>("")
  const [itemGstPercentage, setItemGstPercentage] = useState<string>(String(DEFAULT_GST))
  // Shown under Unit Price when it was auto-filled from this vendor's own
  // purchase history, so it's clear where the number came from.
  const [lastPriceHint, setLastPriceHint] = useState<string>("")
  const [manualItemName, setManualItemName] = useState<string>("")
  const [entryMode, setEntryMode] = useState<"stock" | "manual" | "product">("stock")
  const useManualEntry = entryMode === "manual"
  const canPurchaseProducts = role === "admin" || role === "factories"

  // Vendor catalog products (admin/factory only)
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
    purchase_date: new Date().toISOString().slice(0, 10),
    // Classifies the purchase itself (no separate expenses-table record):
    //  - "material"        → raw material/stock purchase, counts toward Total Purchase/COGS
    //  - "direct_expense"   → non-material GST purchase, shown as a Direct Expense in P&L
    //  - "indirect_expense" → non-material GST purchase, shown as an Indirect Expense in P&L
    //  - "fixed_asset"      → capitalized asset (machinery/vehicles/equipment), excluded from P&L entirely
    //  - "other"            → non-material purchase that doesn't clearly fit direct/indirect, booked as indirect
    purchase_category: "material" as PurchaseCategory,
  })

  // Fetch vendors on mount (wait for entity data if distributor)
  useEffect(() => {
    if (isDistributor && !entityId) return
    fetchVendors()
  }, [entityId])

  const fetchVendors = async () => {
    let query = supabase
      .from("vendors")
      .select("*")
      .eq("is_active", true)
      .order("vendor_name")

    // Distributors only see their own vendors
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

  const fetchStockItems = async (vendorId: string) => {
    try {
      // Fetch regular stock items available from this vendor
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
              product_categories!inner (
                name
              )
            ),
            packaging_materials!inner (
              name
            )
          )
        `)
        .eq("vendor_id", vendorId)

      if (stockError) throw stockError

      const regularStockItems: StockItem[] = (stockData || []).map((item: any) => ({
        id: item.stock_inventory.id,
        quantity: item.stock_inventory.quantity,
        min_stock: item.stock_inventory.min_stock || 0,
        price: item.stock_inventory.price || 0,
        category: item.stock_inventory.product_variants.product_categories.name,
        variant: item.stock_inventory.product_variants.variant_name,
        material: item.stock_inventory.packaging_materials.name,
        is_loose_stock: false,
      }))

      // Fetch loose stock categories available from this vendor
      const { data: looseStockData, error: looseError } = await supabase
        .from("vendor_loose_stock")
        .select(`
          category_id,
          product_categories!inner (
            id,
            name
          )
        `)
        .eq("vendor_id", vendorId)

      if (looseError) throw looseError

      // Get current loose stock quantities
      const categoryIds = (looseStockData || []).map((item: any) => item.category_id)

      let looseStockItems: StockItem[] = []

      if (categoryIds.length > 0) {
        const { data: looseInventory, error: looseInvError } = await supabase
          .from("loose_stock")
          .select(`
            id,
            category_id,
            quantity_liters,
            price_per_liter,
            product_categories!inner (
              name
            )
          `)
          .in("category_id", categoryIds)

        if (looseInvError) throw looseInvError

        looseStockItems = (looseInventory || []).map((item: any) => ({
          id: `loose_${item.id}`, // Prefix with 'loose_' to distinguish from regular stock
          quantity: 0, // Not used for loose stock
          min_stock: 0, // Not used for loose stock
          price: item.price_per_liter,
          category: item.product_categories.name,
          variant: "Loose/Bulk", // Special variant name for loose stock
          material: "Loose Stock", // Special material name
          is_loose_stock: true,
          quantity_liters: item.quantity_liters,
        }))
      }

      // Combine regular stock and loose stock
      const allItems = [...regularStockItems, ...looseStockItems]
      setStockItems(allItems)
      return allItems
    } catch (error) {
      console.error("Error fetching stock items:", error)
      toast.error("Failed to fetch stock items")
      return []
    }
  }

  const fetchVendorProducts = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from("vendor_products")
        .select(`
          product_id,
          products!inner (
            id,
            name,
            brand,
            hsn_code,
            gst_percentage,
            customer_price,
            is_active
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
      return transformed
    } catch (error) {
      console.error("Error fetching vendor products:", error)
      toast.error("Failed to fetch vendor products")
      return []
    }
  }

  // Handle vendor selection
  const handleVendorSelect = (vendorId: string) => {
    setSelectedVendorId(vendorId)

    // Clear existing purchase items when switching vendors
    setPurchaseItems([])
    setSelectedStockId("")
    setSelectedProductId("")
    setVendorProducts([])
    setItemQuantity("")
    setItemPrice("")
    setItemTaxableValue("")
    setItemBatchNumber("")
    setLastPriceHint("")

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
      // Fetch stock items specific to this vendor
      fetchStockItems(vendor.id)
      // Admin/factory: also fetch catalog products linked to this vendor
      if (canPurchaseProducts) {
        fetchVendorProducts(vendor.id)
      }
    }
  }

  // Best-effort match of a parsed screenshot line description against this
  // vendor's known stock/products, so it lands as the right catalog/stock
  // item instead of always falling back to a free-text manual line.
  const normalizeDescription = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase()

  // Word-overlap similarity for vendor names, tolerant of small OCR/typing
  // differences (e.g. "FOOD PRODUCT" vs "FOOD PRODUCTS", extra trailing
  // space, punctuation) that would fail a strict exact-string match.
  const nameTokens = (s: string) =>
    normalizeDescription(s)
      .split(/[^A-Z0-9]+/)
      .filter(Boolean)
      .map((w) => (w.length > 3 && w.endsWith("S") ? w.slice(0, -1) : w))
  const vendorNameSimilarity = (a: string, b: string) => {
    const tokensA = nameTokens(a)
    const tokensB = nameTokens(b)
    if (tokensA.length === 0 || tokensB.length === 0) return 0
    const setB = new Set(tokensB)
    const overlap = tokensA.filter((t) => setB.has(t)).length
    return overlap / Math.max(tokensA.length, tokensB.length)
  }
  // Directional word-overlap score: "how much of the Tally description's own
  // words are found in this candidate's name". Deliberately NOT symmetric —
  // catalog/stock names carry brand-prefix noise ("Sadharmik & Company Natural A2 Desi
  // ...") that a plain Tally line ("10 COW GHEE 15 LTR TIN") never has, so
  // penalizing candidates for extra (brand) words would wrongly tank every
  // real match. Scored against the description's own token count instead.
  const descriptionMatchScore = (description: string, candidateLabel: string) => {
    const queryTokens = nameTokens(description)
    const candidateTokens = new Set(nameTokens(candidateLabel))
    if (queryTokens.length === 0) return 0
    const overlap = queryTokens.filter((t) => candidateTokens.has(t)).length
    return overlap / queryTokens.length
  }

  const matchStockOrProduct = (
    description: string,
    stockCandidates: StockItem[],
    productCandidates: VendorProduct[]
  ):
    | { status: "match"; kind: "stock"; item: StockItem }
    | { status: "match"; kind: "product"; item: VendorProduct }
    | { status: "ambiguous" }
    | { status: "none" } => {
    type Scored = { score: number; hit: { kind: "stock"; item: StockItem } | { kind: "product"; item: VendorProduct } }
    const scored: Scored[] = []
    for (const s of stockCandidates) {
      const label = `${s.category} ${s.variant} ${s.material}`
      scored.push({ score: descriptionMatchScore(description, label), hit: { kind: "stock", item: s } })
    }
    for (const p of productCandidates) {
      scored.push({ score: descriptionMatchScore(description, p.name), hit: { kind: "product", item: p } })
    }
    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]
    // Genuinely nothing in this vendor's catalog resembles this description —
    // distinct from "ambiguous" below, so callers can skip straight to a
    // manual line instead of making the user browse an irrelevant dropdown.
    if (!best || best.score < 0.6) return { status: "none" }
    // Require a clear single best match — if a second candidate ties, this
    // description is genuinely ambiguous (e.g. two near-identical catalog
    // variants), so don't guess between them.
    if (scored[1] && scored[1].score === best.score) return { status: "ambiguous" }
    return { status: "match", ...best.hit }
  }

  // Builds a real PurchaseItem from a "stock:<id>" / "product:<id>" key,
  // looked up against the given candidate pools. Shared by both the initial
  // screenshot-upload pass and confirming a pending item from the review UI.
  const buildItemFromKey = (
    key: string,
    item: { quantity: number; ratePerUnitExclTax: number; gstPercent: number; amount?: number },
    stockPool: StockItem[],
    productPool: VendorProduct[]
  ): PurchaseItem | null => {
    const [kind, id] = key.split(":")
    // ratePerUnitExclTax is already the unit_price we store (excl.-tax rate) — no conversion needed.
    const unitPrice = item.ratePerUnitExclTax || (item.amount && item.quantity > 0 ? item.amount / item.quantity : 0)
    const gstPct = item.gstPercent || DEFAULT_GST
    if (kind === "stock") {
      const s = stockPool.find((x) => x.id === id)
      if (!s) return null
      const isLooseStock = s.is_loose_stock || false
      const actualId = isLooseStock ? s.id.replace("loose_", "") : s.id
      return {
        id: Math.random().toString(36).substr(2, 9),
        stock_inventory_id: actualId,
        stock_name: `${s.category} - ${s.variant} - ${s.material}`,
        quantity: item.quantity,
        unit_price: unitPrice,
        total: item.quantity * unitPrice,
        is_loose_stock: isLooseStock,
        loose_stock_category_id: isLooseStock ? actualId : undefined,
        gst_percentage: gstPct,
        is_itc_eligible: true,
      }
    }
    if (kind === "product") {
      const p = productPool.find((x) => x.id === id)
      if (!p) return null
      return {
        id: Math.random().toString(36).substr(2, 9),
        stock_inventory_id: "",
        product_id: p.id,
        stock_name: p.brand ? `${p.name} (${p.brand})` : p.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total: item.quantity * unitPrice,
        hsn_code: p.hsn_code,
        gst_percentage: gstPct,
        is_itc_eligible: true,
      }
    }
    return null
  }

  // Auto-fills the whole form (vendor, invoice #, date, round-off, line items)
  // from a screenshot of a vendor's Tally purchase bill, via Gemini vision —
  // purchase bills vary vendor to vendor, so this can't be a fixed-template
  // regex parser like the Order-from-Factory Tally PDF feature. Everything
  // extracted lands in the form for review — nothing is auto-saved.
  const handleScreenshotUpload = async (file: File) => {
    setUploadingScreenshot(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/purchases/parse-screenshot", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to read the screenshot")

      const invoice = data.invoice as {
        vendorName: string
        vendorGstin: string
        vendorState: string
        invoiceNumber: string
        invoiceDate: string
        items: { description: string; hsnCode: string; quantity: number; unit: string; ratePerUnitExclTax: number; gstPercent: number; amount: number }[]
        cgstAmount: number
        sgstAmount: number
        igstAmount: number
        roundOff: number
        totalAmount: number
      }

      const warnings: string[] = []

      // Match vendor: GSTIN first (authoritative), then fuzzy name fallback —
      // tolerant of minor differences (singular/plural, spacing, punctuation)
      // between what's on the bill and what's saved in the vendor record.
      let matchedVendor = invoice.vendorGstin
        ? vendors.find((v) => (v.gst_number || "").toUpperCase() === invoice.vendorGstin)
        : undefined
      if (!matchedVendor && invoice.vendorName) {
        const scored = vendors
          .map((v) => ({ v, score: vendorNameSimilarity(invoice.vendorName, v.vendor_name) }))
          .filter((x) => x.score >= 0.6)
          .sort((a, b) => b.score - a.score)
        // Only accept if there's a single best match — don't guess between
        // two similarly-scored vendors.
        if (scored.length > 0 && (scored.length === 1 || scored[0].score > scored[1].score)) {
          matchedVendor = scored[0].v
        }
      }

      let stockForMatching: StockItem[] = []
      let productsForMatching: VendorProduct[] = []
      // Previously-confirmed description -> "stock:<id>" / "product:<id>"
      // mappings for this vendor — authoritative, skips asking again.
      let savedMappings: Record<string, string> = {}

      if (matchedVendor) {
        const vendor = matchedVendor
        setSelectedVendorId(vendor.id)
        setScreenshotVendorId(vendor.id)
        setPurchaseItems([])
        setFormData((prev) => ({
          ...prev,
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
        }))
        stockForMatching = await fetchStockItems(vendor.id)
        if (canPurchaseProducts) {
          productsForMatching = await fetchVendorProducts(vendor.id)
        }
        setScreenshotStockPool(stockForMatching)
        setScreenshotProductPool(productsForMatching)

        const { data: mapRows } = await supabase
          .from("purchase_tally_mappings")
          .select("tally_description, stock_inventory_id, product_id, loose_stock_category_id")
          .eq("vendor_id", vendor.id)
        ;(mapRows || []).forEach((m: any) => {
          if (m.stock_inventory_id) savedMappings[m.tally_description] = `stock:${m.stock_inventory_id}`
          else if (m.loose_stock_category_id) savedMappings[m.tally_description] = `stock:loose_${m.loose_stock_category_id}`
          else if (m.product_id) savedMappings[m.tally_description] = `product:${m.product_id}`
        })
      } else {
        warnings.push(
          `Couldn't find a matching vendor for "${invoice.vendorName || "unknown vendor"}"${invoice.vendorGstin ? ` (GSTIN: ${invoice.vendorGstin})` : ""} — select the vendor manually, then resolve the items below.`
        )
      }

      if (invoice.invoiceNumber) {
        setFormData((prev) => ({ ...prev, invoice_number: invoice.invoiceNumber }))
      }
      if (invoice.invoiceDate) {
        setFormData((prev) => ({ ...prev, purchase_date: invoice.invoiceDate }))
      }
      if (invoice.roundOff) {
        setFormData((prev) => ({ ...prev, round_off: String(invoice.roundOff) }))
      }

      const autoItems: PurchaseItem[] = []
      const manualItems: PurchaseItem[] = []
      const pending: typeof pendingScreenshotItems = []

      invoice.items.forEach((item) => {
        const normalized = normalizeDescription(item.description)
        const savedKey = matchedVendor ? savedMappings[normalized] : undefined
        if (savedKey) {
          const built = buildItemFromKey(savedKey, item, stockForMatching, productsForMatching)
          if (built) {
            autoItems.push(built)
            return
          }
        }
        const guess = matchStockOrProduct(item.description, stockForMatching, productsForMatching)
        if (guess.status === "none") {
          // Nothing in this vendor's catalog even resembles this line — no
          // candidate to confirm, so don't make the user browse the full
          // stock/product list for nothing. Land it straight in the order as
          // a manual line using Tally's own description; they can still
          // delete and re-add it against a real product/stock item later.
          const rate = item.ratePerUnitExclTax || (item.quantity > 0 ? item.amount / item.quantity : 0)
          manualItems.push({
            id: Math.random().toString(36).substr(2, 9),
            stock_inventory_id: "",
            stock_name: item.description,
            quantity: item.quantity,
            unit_price: rate,
            total: item.quantity * rate,
            is_loose_stock: false,
            gst_percentage: item.gstPercent || DEFAULT_GST,
            is_itc_eligible: true,
          })
          return
        }
        // A real (if uncertain) candidate exists — queue for review instead
        // of guessing. Pre-select it if it's a confident single match, but
        // never auto-add an unconfirmed guess.
        const suggestedKey = guess.status === "match" ? `${guess.kind}:${guess.item.id}` : ""
        pending.push({
          id: Math.random().toString(36).substr(2, 9),
          description: item.description,
          hsnCode: item.hsnCode,
          quantity: item.quantity,
          unit: item.unit,
          ratePerUnitExclTax: item.ratePerUnitExclTax || (item.quantity > 0 ? item.amount / item.quantity : 0),
          gstPercent: item.gstPercent || DEFAULT_GST,
          suggestedKey,
        })
      })

      if (autoItems.length > 0) {
        setPurchaseItems((prev) => [...prev, ...autoItems])
        toast.success(`Added ${autoItems.length} item${autoItems.length === 1 ? "" : "s"} already known from a previous invoice.`)
      }
      if (manualItems.length > 0) {
        setPurchaseItems((prev) => [...prev, ...manualItems])
        warnings.push(
          `${manualItems.length} item(s) weren't found in this vendor's catalog — added as manual line${manualItems.length === 1 ? "" : "s"} using the Tally description. Edit or replace ${manualItems.length === 1 ? "it" : "them"} if needed.`
        )
      }
      if (pending.length > 0) {
        setPendingScreenshotItems((prev) => [...prev, ...pending])
        warnings.push(`${pending.length} item(s) need you to confirm which product/stock they are — see below.`)
      }
      if (autoItems.length === 0 && manualItems.length === 0 && pending.length === 0) {
        warnings.push("No line items could be read from the screenshot — add them manually.")
      }

      if (warnings.length > 0) {
        warnings.forEach((w) => toast.warning(w))
      }
      toast.message("Please review the vendor, items, rates and totals before saving — auto-extracted data may need correction.")
    } catch (err) {
      console.error("Error uploading purchase screenshot:", err)
      toast.error(err instanceof Error ? err.message : "Failed to read the screenshot")
    } finally {
      setUploadingScreenshot(false)
    }
  }

  // User confirms (or corrects) which stock/product a screenshot line is.
  // Adds it to the order and remembers the mapping for this vendor so the
  // same description auto-resolves next time, without asking again.
  const confirmPendingScreenshotItem = async (pendingId: string, pickedKey: string) => {
    const pending = pendingScreenshotItems.find((p) => p.id === pendingId)
    if (!pending || !pickedKey) return

    const built = buildItemFromKey(
      pickedKey,
      pending,
      screenshotStockPool,
      screenshotProductPool
    )
    if (!built) {
      toast.error("Couldn't add that item — please pick again.")
      return
    }

    setPurchaseItems((prev) => [...prev, built])
    setPendingScreenshotItems((prev) => prev.filter((p) => p.id !== pendingId))

    if (screenshotVendorId) {
      const [kind, id] = pickedKey.split(":")
      const isLoose = kind === "stock" && id.startsWith("loose_")
      const { error } = await supabase
        .from("purchase_tally_mappings")
        .upsert(
          {
            vendor_id: screenshotVendorId,
            tally_description: normalizeDescription(pending.description),
            stock_inventory_id: kind === "stock" && !isLoose ? id : null,
            product_id: kind === "product" ? id : null,
            is_loose_stock: isLoose,
            loose_stock_category_id: isLoose ? id.replace("loose_", "") : null,
          },
          { onConflict: "vendor_id,tally_description" }
        )
      if (error) {
        console.error("Error saving purchase Tally mapping:", error)
        toast.warning(`Added "${built.stock_name}", but couldn't remember this match (${error.message}) — it'll ask again next time.`)
        return
      }
    }
    toast.success(`Added "${built.stock_name}" — remembered for this vendor's future invoices.`)
  }

  // Skips matching entirely — lands the raw Tally text as a manual line, for
  // when the item genuinely isn't in the catalog yet.
  const addPendingItemAsManual = (pendingId: string) => {
    const pending = pendingScreenshotItems.find((p) => p.id === pendingId)
    if (!pending) return
    const newItem: PurchaseItem = {
      id: Math.random().toString(36).substr(2, 9),
      stock_inventory_id: "",
      stock_name: pending.description,
      quantity: pending.quantity,
      unit_price: pending.ratePerUnitExclTax,
      total: pending.quantity * pending.ratePerUnitExclTax,
      is_loose_stock: false,
      gst_percentage: pending.gstPercent,
      is_itc_eligible: true,
    }
    setPurchaseItems((prev) => [...prev, newItem])
    setPendingScreenshotItems((prev) => prev.filter((p) => p.id !== pendingId))
  }

  // Lets you paste a screenshot (Ctrl+V, e.g. straight from Snipping Tool)
  // instead of having to save it and use the file picker. Only triggers when
  // the clipboard actually contains an image — a normal text paste into any
  // field has no image items, so this never interferes with typing.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (uploadingScreenshot) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            handleScreenshotUpload(file)
          }
          break
        }
      }
    }
    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [uploadingScreenshot, handleScreenshotUpload])

  // Looks up the price this vendor was actually paid last time for the same
  // item, so the form defaults to real history instead of a generic cached
  // stock/catalog price. Falls back to null if there's no prior purchase
  // from this vendor for this exact item.
  const fetchLastVendorPrice = async (
    params:
      | { kind: "product"; id: string }
      | { kind: "stock"; id: string }
      | { kind: "loose"; id: string }
  ): Promise<{ price: number; date: string } | null> => {
    if (!selectedVendorId) return null
    try {
      if (params.kind === "loose") {
        const { data } = await supabase
          .from("loose_stock_transactions")
          .select("price_per_liter, transaction_date")
          .eq("loose_stock_id", params.id)
          .eq("vendor_id", selectedVendorId)
          .eq("transaction_type", "purchase")
          .order("transaction_date", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (data?.price_per_liter != null) {
          return { price: Number(data.price_per_liter), date: data.transaction_date }
        }
        return null
      }

      const column = params.kind === "product" ? "product_id" : "stock_inventory_id"
      const { data } = await supabase
        .from("purchase_items")
        .select("unit_price, purchases!inner(purchase_date, vendor_id)")
        .eq(column, params.id)
        .eq("purchases.vendor_id", selectedVendorId)
        .order("purchase_date", { foreignTable: "purchases", ascending: false })
        .limit(1)
        .maybeSingle()
      if (data?.unit_price != null) {
        return { price: Number(data.unit_price), date: (data as any).purchases?.purchase_date }
      }
      return null
    } catch {
      return null
    }
  }

  // Handle product selection (admin/factory) — auto-fill price from catalog
  const handleProductSelect = async (productId: string) => {
    setSelectedProductId(productId)
    const product = vendorProducts.find((p) => p.id === productId)
    if (product) {
      setItemTaxableValue("")
      setItemQuantity("")
      setItemGstPercentage(String(product.gst_percentage ?? DEFAULT_GST))
      setItemPrice(product.default_price ? product.default_price.toString() : "")
      setLastPriceHint("")

      const last = await fetchLastVendorPrice({ kind: "product", id: product.id })
      if (last) {
        setItemPrice(last.price.toString())
        setLastPriceHint(`Last paid to this vendor: ₹${last.price.toFixed(2)} on ${formatShortDate(last.date)}`)
      }
    }
  }

  // Handle stock item selection - auto-fill price and suggest quantity
  const handleStockItemSelect = async (stockId: string) => {
    setSelectedStockId(stockId)
    const stockItem = stockItems.find((item) => item.id === stockId)
    if (stockItem) {
      setItemPrice(stockItem.price.toString())
      setItemTaxableValue("")
      setLastPriceHint("")

      // For loose stock, don't auto-suggest quantity (they need to specify liters)
      if (stockItem.is_loose_stock) {
        setItemQuantity("")
      } else {
        // Auto-suggest quantity to reach minimum stock level for regular stock
        if (stockItem.quantity < stockItem.min_stock) {
          const suggestedQty = stockItem.min_stock - stockItem.quantity
          setItemQuantity(suggestedQty.toString())
        } else {
          // If stock is already at or above minimum, clear quantity for manual entry
          setItemQuantity("")
        }
      }

      const isLooseStock = stockItem.is_loose_stock || false
      const actualId = isLooseStock ? stockId.replace("loose_", "") : stockId
      const last = await fetchLastVendorPrice(
        isLooseStock ? { kind: "loose", id: actualId } : { kind: "stock", id: actualId }
      )
      if (last) {
        setItemPrice(last.price.toString())
        setLastPriceHint(`Last paid to this vendor: ₹${last.price.toFixed(2)} on ${formatShortDate(last.date)}`)
      }
    }
  }

  // Add purchase item
  const handleAddItem = () => {
    if (entryMode === "product") {
      if (!selectedProductId) {
        toast.error("Please select a product")
        return
      }
      if (!itemQuantity || Number(itemQuantity) <= 0) {
        toast.error("Please enter a valid quantity")
        return
      }
      if (!itemPrice || Number(itemPrice) <= 0) {
        toast.error("Please enter a valid unit price")
        return
      }

      const product = vendorProducts.find((p) => p.id === selectedProductId)
      if (!product) return

      const gstPct =
        itemGstPercentage.trim() !== ""
          ? Number(itemGstPercentage)
          : product.gst_percentage ?? DEFAULT_GST

      const newItem: PurchaseItem = {
        id: Math.random().toString(36).substr(2, 9),
        stock_inventory_id: "",
        product_id: product.id,
        stock_name: product.brand ? `${product.name} (${product.brand})` : product.name,
        quantity: Number(itemQuantity),
        unit_price: Number(itemPrice),
        total: Number(itemQuantity) * Number(itemPrice),
        is_loose_stock: false,
        hsn_code: product.hsn_code,
        gst_percentage: gstPct,
        batch_number: itemBatchNumber || "",
        purchase_category: itemCategory || null,
      }

      setPurchaseItems([...purchaseItems, newItem])
      setSelectedProductId("")
      setItemQuantity("")
      setItemPrice("")
      setItemTaxableValue("")
      setItemGstPercentage(String(DEFAULT_GST))
      setLastPriceHint("")
      return
    }

    if (useManualEntry) {
      // Manual entry mode
      if (!manualItemName.trim()) {
        toast.error("Please enter a product name")
        return
      }
      if (!itemQuantity || Number(itemQuantity) <= 0) {
        toast.error("Please enter a valid quantity")
        return
      }
      if (!itemPrice || Number(itemPrice) <= 0) {
        toast.error("Please enter a valid unit price")
        return
      }

      const newItem: PurchaseItem = {
        id: Math.random().toString(36).substr(2, 9),
        stock_inventory_id: "",
        stock_name: manualItemName.trim(),
        quantity: Number(itemQuantity),
        unit_price: Number(itemPrice),
        total: Number(itemQuantity) * Number(itemPrice),
        is_loose_stock: false,
        gst_percentage:
          itemGstPercentage.trim() !== "" ? Number(itemGstPercentage) : DEFAULT_GST,
        batch_number: itemBatchNumber || "",
        purchase_category: itemCategory || null,
      }

      setPurchaseItems([...purchaseItems, newItem])
      setManualItemName("")
      setItemQuantity("1")
      setItemPrice("")
      setItemTaxableValue("")
      setItemGstPercentage(String(DEFAULT_GST))
      setLastPriceHint("")
      return
    }

    // Stock item selection mode
    if (!selectedStockId) {
      toast.error("Please select a stock item")
      return
    }
    if (!itemQuantity || Number(itemQuantity) <= 0) {
      toast.error("Please enter a valid quantity")
      return
    }
    if (!itemPrice || Number(itemPrice) <= 0) {
      toast.error("Please enter a valid unit price")
      return
    }

    const stockItem = stockItems.find((item) => item.id === selectedStockId)
    if (!stockItem) return

    // For loose stock, extract the real ID by removing "loose_" prefix
    const isLooseStock = stockItem.is_loose_stock || false
    const actualId = isLooseStock ? selectedStockId.replace("loose_", "") : selectedStockId

    const newItem: PurchaseItem = {
      id: Math.random().toString(36).substr(2, 9),
      stock_inventory_id: actualId, // Store the real ID without prefix
      stock_name: `${stockItem.category} - ${stockItem.variant} - ${stockItem.material}`,
      quantity: Number(itemQuantity),
      unit_price: Number(itemPrice),
      total: Number(itemQuantity) * Number(itemPrice),
      is_loose_stock: isLooseStock,
      loose_stock_category_id: isLooseStock ? actualId : undefined,
      hsn_code: null,
      gst_percentage:
        itemGstPercentage.trim() !== "" ? Number(itemGstPercentage) : DEFAULT_GST,
      batch_number: itemBatchNumber || "",
      purchase_category: itemCategory || null,
    }

    setPurchaseItems([...purchaseItems, newItem])
    setSelectedStockId("")
    setItemQuantity("")
    setItemPrice("")
    setItemTaxableValue("")
    setItemGstPercentage(String(DEFAULT_GST))
    setLastPriceHint("")
  }

  // Remove purchase item
  const handleRemoveItem = (id: string) => {
    setPurchaseItems(purchaseItems.filter((item) => item.id !== id))
  }

  // Calculate totals — rates entered are excl.-tax (matches vendor bills/Tally); GST is added on top, not extracted.
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
      // Rate/Unit (Excl. Tax) is the primary entered value on real vendor
      // bills — item.total is that taxable (pre-tax) extended amount, so GST
      // is ADDED on top here, never extracted back out of it.
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

  // Fills the Round Off field with the delta needed to reach the nearest rupee.
  const handleAutoRoundOff = () => {
    const delta = Math.round(totals.preRoundTotal) - totals.preRoundTotal
    setFormData((prev) => ({ ...prev, round_off: delta.toFixed(2) }))
  }

  const totals = calculateTotals()

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!selectedVendorId) {
      errors.vendor = "Please select a vendor"
      toast.error("Please select a vendor")
    }

    if (purchaseItems.length === 0) {
      errors.items = "Please add at least one stock item"
      toast.error("Please add at least one stock item")
    }

    // "Mixed" means there's deliberately no purchase-level default — every
    // line has to say what it actually is, or it'd have nothing to fall
    // back to when saved (and would silently vanish from the P&L/Expenses page).
    if (formData.purchase_category === "mixed") {
      const uncategorized = purchaseItems.filter((item) => !item.purchase_category)
      if (uncategorized.length > 0) {
        errors.items_category = `Purchase Category is set to "None — set per item", but ${uncategorized.length} item${uncategorized.length === 1 ? " hasn't" : "s haven't"} been given a category. Set one for every item, or pick a single category for the whole purchase instead.`
        toast.error(errors.items_category)
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Next sequential purchase_number for the current calendar year, e.g.
  // PO-2026-0093 following the highest existing PO-2026-XXXX on file.
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
    if (!validateForm()) {
      toast.error("Please fix the validation errors before saving")
      return
    }

    setSaving(true)

    try {
      const vendorId = formData.vendor_id || null

      const { data: { user: authUser } } = await supabase.auth.getUser()
      const purchaseNumber = await generatePurchaseNumber()

      const purchaseData: Record<string, any> = {
        purchase_number: purchaseNumber,
        vendor_id: vendorId,
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
        created_by_user_id: authUser?.id || null,
        // Quick purchase-level indicator; per-item is_itc_eligible on
        // purchase_items is the actual source of truth for GST-payable ITC.
        is_itc_eligible: purchaseItems.every((item) => item.is_itc_eligible !== false),
        purchase_category: formData.purchase_category,
      }

      // Attach distributor_id when a distributor creates the purchase
      if (isDistributor && entityId) {
        purchaseData.distributor_id = entityId
      }

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert([purchaseData])
        .select()
        .single()

      if (purchaseError) throw purchaseError

      // Set true if purchase_items.purchase_category doesn't exist in the DB
      // yet (migration not run) — items still save, just without their
      // per-item category override, so a mixed-category invoice needs
      // re-categorizing per line once the migration has run.
      let categorySaveSkipped = false

      // Separate manual, catalog product, regular stock, and loose stock items
      const productItems = purchaseItems.filter(item => !item.is_loose_stock && item.product_id)
      const manualItems = purchaseItems.filter(item => !item.is_loose_stock && !item.stock_inventory_id && !item.product_id)
      const regularItems = purchaseItems.filter(item => !item.is_loose_stock && item.stock_inventory_id)
      const looseItems = purchaseItems.filter(item => item.is_loose_stock)

      // Insert manual purchase items (no stock_inventory_id)
      if (manualItems.length > 0) {
        const manualItemsData = manualItems.map((item) => {
          const pct = Number(item.gst_percentage) || 0
          const itemGst = pct > 0 ? (item.total * pct) / 100 : 0
          return {
            purchase_id: purchase.id,
            product_name: item.stock_name,
            hsn_code: item.hsn_code || null,
            gst_percentage: item.gst_percentage ?? null,
            gst_amount: itemGst,
            cgst_amount: totals.isInterState ? 0 : itemGst / 2,
            sgst_amount: totals.isInterState ? 0 : itemGst / 2,
            igst_amount: totals.isInterState ? itemGst : 0,
            is_itc_eligible: item.is_itc_eligible !== false,
            batch_number: item.batch_number || null,
            purchase_category: item.purchase_category || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.total,
            total: item.total,
            received_quantity: 0,
          }
        })

        const { categorySaveSkipped: skipped } = await insertPurchaseItems(supabase, manualItemsData)
        if (skipped) categorySaveSkipped = true
      }

      // Insert catalog product purchase items (links via product_id; does NOT
      // touch product stock quantities here — receiving flow handles that)
      if (productItems.length > 0) {
        const productItemsData = productItems.map((item) => {
          const pct = Number(item.gst_percentage) || 0
          const itemGst = pct > 0 ? (item.total * pct) / 100 : 0
          return {
            purchase_id: purchase.id,
            product_id: item.product_id,
            product_name: item.stock_name,
            hsn_code: item.hsn_code || null,
            gst_percentage: item.gst_percentage ?? null,
            gst_amount: itemGst,
            cgst_amount: totals.isInterState ? 0 : itemGst / 2,
            sgst_amount: totals.isInterState ? 0 : itemGst / 2,
            igst_amount: totals.isInterState ? itemGst : 0,
            is_itc_eligible: item.is_itc_eligible !== false,
            batch_number: item.batch_number || null,
            purchase_category: item.purchase_category || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.total,
            total: item.total,
            received_quantity: 0,
          }
        })

        const { categorySaveSkipped: skipped } = await insertPurchaseItems(supabase, productItemsData)
        if (skipped) categorySaveSkipped = true
      }

      // Insert regular stock purchase items
      if (regularItems.length > 0) {
        const regularItemsData = regularItems.map((item) => {
          const pct = Number(item.gst_percentage) || 0
          const itemGst = pct > 0 ? (item.total * pct) / 100 : 0
          return {
            purchase_id: purchase.id,
            stock_inventory_id: item.stock_inventory_id,
            product_name: item.stock_name,
            hsn_code: item.hsn_code || null,
            gst_percentage: item.gst_percentage ?? null,
            gst_amount: itemGst,
            cgst_amount: totals.isInterState ? 0 : itemGst / 2,
            sgst_amount: totals.isInterState ? 0 : itemGst / 2,
            igst_amount: totals.isInterState ? itemGst : 0,
            is_itc_eligible: item.is_itc_eligible !== false,
            batch_number: item.batch_number || null,
            purchase_category: item.purchase_category || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.total,
            total: item.total,
            received_quantity: 0,
          }
        })

        const { categorySaveSkipped: skipped } = await insertPurchaseItems(supabase, regularItemsData)
        if (skipped) categorySaveSkipped = true
      }

      // Process loose stock items separately
      if (looseItems.length > 0) {
        for (const looseItem of looseItems) {
          // Update loose_stock quantity
          const { data: currentStock, error: fetchError } = await supabase
            .from("loose_stock")
            .select("quantity_liters")
            .eq("id", looseItem.stock_inventory_id)
            .single()

          if (fetchError) throw fetchError

          const newQuantity = (currentStock?.quantity_liters || 0) + looseItem.quantity

          const { error: updateError } = await supabase
            .from("loose_stock")
            .update({ quantity_liters: newQuantity })
            .eq("id", looseItem.stock_inventory_id)

          if (updateError) throw updateError

          // Create loose_stock_transaction record
          const pct = Number(looseItem.gst_percentage) || 0
          const itemGst = pct > 0 ? (looseItem.total * pct) / 100 : 0
          const transactionData = {
            loose_stock_id: looseItem.stock_inventory_id,
            transaction_type: "purchase",
            quantity_liters: looseItem.quantity,
            price_per_liter: looseItem.unit_price,
            total_amount: looseItem.total,
            vendor_id: vendorId,
            purchase_id: purchase.id,
            invoice_number: formData.invoice_number || null,
            batch_number: looseItem.batch_number || formData.batch_number || null,
            transaction_notes: formData.purchase_notes || null,
            transaction_date: formData.purchase_date
              ? new Date(formData.purchase_date + "T00:00:00").toISOString()
              : new Date().toISOString(),
            gst_percentage: looseItem.gst_percentage ?? null,
            gst_amount: itemGst,
            cgst_amount: totals.isInterState ? 0 : itemGst / 2,
            sgst_amount: totals.isInterState ? 0 : itemGst / 2,
            igst_amount: totals.isInterState ? itemGst : 0,
            is_itc_eligible: looseItem.is_itc_eligible !== false,
          }

          const { error: transactionError } = await supabase
            .from("loose_stock_transactions")
            .insert([transactionData])

          if (transactionError) throw transactionError
        }
      }

      if (categorySaveSkipped) {
        toast.warning(
          "Purchase saved, but per-item categories weren't — the database hasn't been updated for that yet. Ask to run migrations/add_purchase_item_category.sql, then re-set each item's category on this purchase."
        )
      } else {
        toast.success("Purchase order created successfully")
      }
      router.push("/dashboard/purchases")
    } catch (error: unknown) {
      console.error("Error saving purchase:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save purchase"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  // Alt+A finishes and creates the purchase order, same as clicking "Create Purchase Order".
  useSaveShortcut(handleSave, saving)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-8 w-8" />
            Create Purchase Order
          </h1>
          <p className="text-muted-foreground">
            Create a new purchase order from supplier
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Tally Screenshot Auto-fill */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileImage className="h-4 w-4" />
              Auto-fill from Tally Screenshot
            </CardTitle>
            <CardDescription>
              Upload — or just paste (Ctrl+V) — a screenshot of the vendor&apos;s Tally purchase bill to auto-fill the vendor, invoice details, and items below. Always review everything before saving — nothing is saved automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              id="purchase_screenshot"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (file) handleScreenshotUpload(file)
              }}
              disabled={uploadingScreenshot}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadingScreenshot}
              onClick={() => document.getElementById("purchase_screenshot")?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingScreenshot ? "Reading screenshot..." : "Upload Screenshot"}
            </Button>
          </CardContent>
        </Card>

        {/* Screenshot items needing confirmation */}
        {pendingScreenshotItems.length > 0 && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="text-base">Confirm Items from Screenshot</CardTitle>
              <CardDescription>
                {pendingScreenshotItems.length} item{pendingScreenshotItems.length === 1 ? "" : "s"} couldn&apos;t be confidently matched — pick the right stock/product below. Once confirmed, the same description is remembered for this vendor&apos;s future invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingScreenshotItems.map((pending) => (
                <div key={pending.id} className="flex flex-col md:flex-row md:items-center gap-3 rounded-md border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{pending.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {pending.hsnCode ? `HSN ${pending.hsnCode} · ` : ""}Qty {pending.quantity}
                      {pending.unit ? ` ${pending.unit}` : ""} · Rate ₹{pending.ratePerUnitExclTax.toFixed(2)}
                    </p>
                  </div>
                  <div className="w-full md:w-72">
                    <Select
                      value={pending.suggestedKey || undefined}
                      onValueChange={(v) =>
                        setPendingScreenshotItems((prev) =>
                          prev.map((p) => (p.id === pending.id ? { ...p, suggestedKey: v } : p))
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select the matching stock/product" />
                      </SelectTrigger>
                      <SelectContent>
                        {screenshotStockPool.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Stock</SelectLabel>
                            {screenshotStockPool.map((s) => (
                              <SelectItem key={`stock:${s.id}`} value={`stock:${s.id}`}>
                                {s.category} - {s.variant} - {s.material}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {screenshotProductPool.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Products</SelectLabel>
                            {screenshotProductPool.map((p) => (
                              <SelectItem key={`product:${p.id}`} value={`product:${p.id}`}>
                                {p.brand ? `${p.name} (${p.brand})` : p.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {screenshotStockPool.length === 0 && screenshotProductPool.length === 0 && (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            Select a vendor first
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!pending.suggestedKey}
                      onClick={() => confirmPendingScreenshotItem(pending.id, pending.suggestedKey)}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addPendingItemAsManual(pending.id)}
                    >
                      Use as-is
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Supplier Information */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
            <CardDescription>Select a vendor from your database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vendor Selection */}
            <div className="space-y-2">
              <Label htmlFor="vendor_select">Select Vendor *</Label>
              <VendorCombobox
                vendors={vendors}
                value={selectedVendorId}
                onValueChange={handleVendorSelect}
                placeholder="Search by name, phone, company..."
              />
              {vendors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No vendors found. Please add vendors first from the Vendors page.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Can&apos;t find a vendor? Add them from the <Link href="/dashboard/vendors" className="text-blue-600 hover:underline">Vendors page</Link> first.
                </p>
              )}
            </div>

            {/* Show supplier fields if vendor selected */}
            {selectedVendorId && (
              <>
                <button
                  type="button"
                  onClick={() => setShowVendorDetails((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  {showVendorDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {showVendorDetails ? "Hide" : "Show"} vendor details
                  {!showVendorDetails && (formData.supplier_gst_number || formData.supplier_phone) && (
                    <span className="text-xs">
                      ({[formData.supplier_gst_number, formData.supplier_phone].filter(Boolean).join(" · ")})
                    </span>
                  )}
                </button>
              </>
            )}
            {selectedVendorId && showVendorDetails && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplier_name">Supplier Name</Label>
                    <Input
                      id="supplier_name"
                      value={formData.supplier_name}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supplier_email">Email</Label>
                    <Input
                      id="supplier_email"
                      type="email"
                      value={formData.supplier_email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplier_phone">Phone</Label>
                    <Input
                      id="supplier_phone"
                      value={formData.supplier_phone}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supplier_gst_number">GST Number</Label>
                    <Input
                      id="supplier_gst_number"
                      value={formData.supplier_gst_number}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier_address_line1">Address Line 1</Label>
                  <Input
                    id="supplier_address_line1"
                    value={formData.supplier_address_line1}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier_address_line2">Address Line 2</Label>
                  <Input
                    id="supplier_address_line2"
                    value={formData.supplier_address_line2}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier_city">City</Label>
                    <Input
                      id="supplier_city"
                      value={formData.supplier_city}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supplier_state">State</Label>
                    <Input
                      id="supplier_state"
                      value={formData.supplier_state}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supplier_pincode">Pincode</Label>
                    <Input
                      id="supplier_pincode"
                      value={formData.supplier_pincode}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supplier_country">Country</Label>
                    <Input
                      id="supplier_country"
                      value={formData.supplier_country}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Purchase Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Purchase Items</CardTitle>
                <CardDescription>Add items to this purchase order</CardDescription>
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
                      setLastPriceHint("")
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
                        setLastPriceHint("")
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
                      setLastPriceHint("")
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
                <p className="text-muted-foreground">
                  Please select a vendor first to add items
                </p>
              </div>
            ) : (
              <>
                {/* Add Item Form */}
                <div className="grid gap-4 md:grid-cols-7">
                  {entryMode === "manual" ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="manual_item_name">Product Name</Label>
                      <Input
                        id="manual_item_name"
                        value={manualItemName}
                        onChange={(e) => setManualItemName(e.target.value)}
                        placeholder="e.g. Mobile Oil, Engine Oil..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Type any product name manually
                      </p>
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
                                : "Search & select a catalog product..."
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
                      {vendorProducts.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Catalog products linked to this vendor (no stock change on add)
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Link products to this vendor from the{" "}
                          <Link href="/dashboard/vendors" className="text-blue-600 hover:underline">
                            Vendors page
                          </Link>
                          .
                        </p>
                      )}
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
                      {stockItems.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Showing only stock items available from selected vendor
                        </p>
                      )}
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
                      Carries over to the next item — change it when a second batch starts.
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
                    {useManualEntry && (
                      <p className="text-xs text-muted-foreground">
                        Lump-sum expense with no real quantity? Leave this as 1 and put the full amount in Unit Price / Taxable Value.
                      </p>
                    )}
                    {!useManualEntry && selectedStockId && (() => {
                      const stockItem = stockItems.find((item) => item.id === selectedStockId)

                      // For loose stock, show current availability
                      if (stockItem?.is_loose_stock) {
                        return (
                          <p className="text-xs text-orange-600 flex items-center gap-1">
                            <Droplets className="h-3 w-3" />
                            Available: {stockItem.quantity_liters?.toFixed(2)}L
                          </p>
                        )
                      }

                      // For regular stock, show existing logic
                      if (itemQuantity && stockItem && stockItem.quantity < stockItem.min_stock) {
                        const suggestedQty = stockItem.min_stock - stockItem.quantity
                        const afterPurchase = stockItem.quantity + Number(itemQuantity)
                        const isOptimal = Number(itemQuantity) === suggestedQty

                        return (
                          <p className={`text-xs ${isOptimal ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {isOptimal ? (
                              <>✓ Optimal: Brings stock to minimum level ({afterPurchase} units)</>
                            ) : (
                              <>After purchase: {afterPurchase} units (Min: {stockItem.min_stock})</>
                            )}
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="item_price">
                      {useManualEntry ? "Rate/Unit (Excl. Tax) (₹)" : (() => {
                        const stockItem = stockItems.find((item) => item.id === selectedStockId)
                        return stockItem?.is_loose_stock ? "Price per Liter (Excl. Tax) (₹)" : "Rate/Unit (Excl. Tax) (₹)"
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
                        setLastPriceHint("")
                      }}
                      placeholder={useManualEntry ? "Enter rate" : "Auto-filled from stock"}
                    />
                    {lastPriceHint && (
                      <p className="text-xs text-emerald-600">{lastPriceHint}</p>
                    )}
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
                        // Keep the excl.-tax rate in sync if it was derived from an incl.-tax value.
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

                {/* Items Table */}
                {purchaseItems.length > 0 && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stock Item</TableHead>
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
                        {purchaseItems.map((item, index) => {
                          // item.unit_price / item.total are the excl.-tax rate and its
                          // extension (what's actually written on a vendor bill) — GST is
                          // added on top here, never extracted back out of them.
                          const pct = Number(item.gst_percentage) || 0
                          const taxableAmt = item.total
                          const gstAmt = pct > 0 ? (taxableAmt * pct) / 100 : 0
                          const totalInclTax = taxableAmt + gstAmt
                          const ratePerUnitInclTax = item.quantity > 0 ? totalInclTax / item.quantity : 0
                          const itcEligible = item.is_itc_eligible !== false

                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                <Input
                                  value={item.stock_name}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setPurchaseItems((prev) =>
                                      prev.map((p, i) =>
                                        i === index ? { ...p, stock_name: val } : p
                                      )
                                    )
                                  }}
                                  placeholder="Item name"
                                  className="min-w-[180px] h-8 font-medium"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={item.purchase_category || "__default__"}
                                  onValueChange={(v) =>
                                    setPurchaseItems((prev) =>
                                      prev.map((p, i) =>
                                        i === index
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
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.batch_number ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setPurchaseItems((prev) =>
                                      prev.map((p, i) =>
                                        i === index ? { ...p, batch_number: val } : p
                                      )
                                    )
                                  }}
                                  placeholder="e.g. B-12"
                                  className="w-24 h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const qty = Number(e.target.value) || 0
                                    setPurchaseItems((prev) =>
                                      prev.map((p, i) =>
                                        i === index
                                          ? { ...p, quantity: qty, total: qty * p.unit_price }
                                          : p
                                      )
                                    )
                                  }}
                                  className="w-20 h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={ratePerUnitInclTax.toFixed(2)}
                                  onChange={(e) => {
                                    const inclRate = Number(e.target.value) || 0
                                    setPurchaseItems((prev) =>
                                      prev.map((p, i) => {
                                        if (i !== index) return p
                                        const rowPct = Number(p.gst_percentage) || 0
                                        const exclPrice = inclRate / (1 + rowPct / 100)
                                        return { ...p, unit_price: exclPrice, total: p.quantity * exclPrice }
                                      })
                                    )
                                  }}
                                  className="w-24 h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unit_price}
                                  onChange={(e) => {
                                    const price = Number(e.target.value) || 0
                                    setPurchaseItems((prev) =>
                                      prev.map((p, i) =>
                                        i === index
                                          ? { ...p, unit_price: price, total: p.quantity * price }
                                          : p
                                      )
                                    )
                                  }}
                                  className="w-24 h-8 text-right"
                                />
                              </TableCell>
                              <TableCell className="font-semibold">₹{totalInclTax.toFixed(2)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                ₹{taxableAmt.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.gst_percentage ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value
                                    setPurchaseItems((prev) =>
                                      prev.map((p, i) =>
                                        i === index
                                          ? { ...p, gst_percentage: raw === "" ? 0 : Number(raw) }
                                          : p
                                      )
                                    )
                                  }}
                                  className="w-20 h-8 text-center mx-auto"
                                />
                              </TableCell>
                              <TableCell className="text-right">₹{gstAmt.toFixed(2)}</TableCell>
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={itcEligible}
                                  onChange={(e) => {
                                    const checked = e.target.checked
                                    setPurchaseItems((prev) =>
                                      prev.map((p, i) =>
                                        i === index ? { ...p, is_itc_eligible: checked } : p
                                      )
                                    )
                                  }}
                                  title={itcEligible ? "Counts toward Input Tax Credit" : "Excluded from Input Tax Credit (e.g. exempt milk purchase)"}
                                  className="h-4 w-4"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.id)}
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

        {/* Financial Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Additional Charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-4 items-end">
              <div className="space-y-1">
                <Label htmlFor="discount_amount" className="text-xs">Discount</Label>
                <Input
                  id="discount_amount"
                  type="number"
                  step="0.01"
                  className="h-8 w-full"
                  value={formData.discount_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_amount: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="shipping_charges" className="text-xs">Shipping</Label>
                <Input
                  id="shipping_charges"
                  type="number"
                  step="0.01"
                  className="h-8 w-full"
                  value={formData.shipping_charges}
                  onChange={(e) =>
                    setFormData({ ...formData, shipping_charges: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs invisible">Round Off</Label>
                <Button type="button" variant="outline" className="h-8 w-full" onClick={handleAutoRoundOff}>
                  Round Off
                </Button>
              </div>
              <div className="space-y-1">
                <Label htmlFor="round_off" className="text-xs">Round Off Amount</Label>
                <Input
                  id="round_off"
                  type="number"
                  step="0.01"
                  className="h-8 w-full"
                  value={formData.round_off}
                  onChange={(e) =>
                    setFormData({ ...formData, round_off: e.target.value })
                  }
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

        {/* Status and Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Status & Additional Information</CardTitle>
            <CardDescription>Set status and add notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="purchase_status">Purchase Status</Label>
                <Select
                  value={formData.purchase_status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, purchase_status: value })
                  }
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
                <Label htmlFor="payment_status">Payment Status</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, payment_status: value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, payment_method: e.target.value })
                  }
                  placeholder="e.g., Bank Transfer, Cash"
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
                  onChange={(e) =>
                    setFormData({ ...formData, purchase_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_number: e.target.value })
                  }
                  placeholder="e.g., INV-2024-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch_number">Batch Number</Label>
                <Input
                  id="batch_number"
                  value={formData.batch_number}
                  onChange={(e) =>
                    setFormData({ ...formData, batch_number: e.target.value })
                  }
                  placeholder="e.g., BATCH-001, LOT-2024-01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_notes">Purchase Notes</Label>
              <Textarea
                id="purchase_notes"
                value={formData.purchase_notes}
                onChange={(e) =>
                  setFormData({ ...formData, purchase_notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_notes">Internal Notes</Label>
              <Textarea
                id="internal_notes"
                value={formData.internal_notes}
                onChange={(e) =>
                  setFormData({ ...formData, internal_notes: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_urgent}
                  onChange={(e) =>
                    setFormData({ ...formData, is_urgent: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">Mark as Urgent</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? "Saving..." : "Create Purchase Order"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
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
