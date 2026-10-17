"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { PartyCombobox, PARTY_TYPE_LABEL, type Party } from "@/components/ui/party-combobox"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { fetchAllParties, matchParty } from "@/lib/party-match"
import { insertNoteWithShippingFallback } from "@/lib/notes-shipping-insert"
import { useUserRole } from "@/hooks/use-user-role"
import { useSaveShortcut } from "@/hooks/use-save-shortcut"
import {
  NoteItemTable,
  calculateNoteItemAmount,
  makeEmptyNoteItem,
  type NoteItem,
} from "@/components/notes/note-item-table"
import type { ParsedNoteScreenshot } from "@/app/api/notes/parse-screenshot/route"
import {
  Plus,
  CalendarIcon,
  ArrowLeft,
  FileMinus2,
  Package,
  Filter,
  User,
  Truck,
  CreditCard,
  Calculator,
  Upload,
  FileImage,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Link2,
  Unlink,
  Receipt,
} from "lucide-react"
import { applyOrderReturnEffects, type OrderForReturn, type OrderReturnLine } from "@/lib/accounting/apply-order-return"
import { restoreKgStockForOrder } from "@/lib/stock/deduct-kg-stock"

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

const PAYMENT_TYPES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Credit"]

type CatalogProduct = {
  id: string
  name: string
  hsn_code: string | null
  gst_percentage: number | null
  customer_price: number | null
  parent_category_id: string | null
  sub_category_id: string | null
}

type Category = {
  id: string
  category_name: string
  parent_category_id: string | null
}

type BillOption = {
  id: string
  label: string
  order_date: string | null
  total_amount: number
  paid_amount: number
}

function NewCreditNotePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnOrderId = searchParams.get("orderId")
  const { role } = useUserRole()
  const [saving, setSaving] = useState(false)
  // Set when this credit note is being created against one of our own sales
  // (opened via the "Process Return" button on an order) — carries what's
  // needed to shrink that order and restock the warehouse once the note is
  // saved. itemOrderMeta maps each pre-filled NoteItem's id back to its
  // source order_items row, so edits to quantity in the form (returning
  // less than what was originally sold) still return the right amount.
  const [returnOrderMeta, setReturnOrderMeta] = useState<OrderForReturn | null>(null)
  const [itemOrderMeta, setItemOrderMeta] = useState<Record<string, { orderItemId: string; productId: string | null; weightGrams: number | null; originalQty: number }>>({})
  const [selectedPartyId, setSelectedPartyId] = useState<string>("")
  const [selectedParty, setSelectedParty] = useState<Party | null>(null)
  const [showPartyDetails, setShowPartyDetails] = useState(false)
  const [returnNo, setReturnNo] = useState<number>(1)

  // The party a linked bill belongs to — used to auto-unlink if the user
  // changes the party after already picking a bill, so the note never ends
  // up referencing a bill that doesn't match who it's being issued to.
  const linkedBillPartyIdRef = useRef<string | null>(null)
  const [billPickerOpen, setBillPickerOpen] = useState(false)
  const [billSearchQuery, setBillSearchQuery] = useState("")
  const [billOptions, setBillOptions] = useState<BillOption[]>([])
  const [billSearchLoading, setBillSearchLoading] = useState(false)

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(undefined)
  const [noteDate, setNoteDate] = useState<Date>(new Date())
  const [stateOfSupply, setStateOfSupply] = useState("Maharashtra")

  // Items
  const [items, setItems] = useState<NoteItem[]>([])
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all")

  // Draft row: the row currently being built, not yet committed to `items`
  const [draftItem, setDraftItem] = useState<NoteItem>(makeEmptyNoteItem())
  const [selectedProductId, setSelectedProductId] = useState<string>("")

  const qtyRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const discRef = useRef<HTMLInputElement>(null)
  const taxRef = useRef<HTMLInputElement>(null)

  // Transport details
  const [transportName, setTransportName] = useState("")
  const [deliveryLocation, setDeliveryLocation] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined)

  // Payment
  const [paymentType, setPaymentType] = useState("Cash")

  // Totals
  const [roundOff, setRoundOff] = useState(true)
  const [shippingCharges, setShippingCharges] = useState("")
  const [description, setDescription] = useState("")

  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  useEffect(() => {
    fetchNextReturnNo()
    fetchCatalog()
  }, [])

  // Sadharmik & Company's own factory/manufacturing registration is in Gujarat (see the
  // COMPANY constant on the credit note print page) — a credit note created
  // under the Factory role is being issued from that Gujarat GSTIN, so it
  // should default to Gujarat instead of the generic Maharashtra default.
  useEffect(() => {
    if (role === "factories") setStateOfSupply("Gujarat")
  }, [role])

  const fetchNextReturnNo = async () => {
    try {
      const { data } = await supabase
        .from("credit_notes")
        .select("note_number")
        .order("created_at", { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        const lastNumber = parseInt(data[0].note_number.replace(/\D/g, "")) || 0
        setReturnNo(lastNumber + 1)
      }
    } catch (error) {
      console.error("Error fetching return number:", error)
    }
  }

  const fetchCatalog = async () => {
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, hsn_code, gst_percentage, customer_price, parent_category_id, sub_category_id")
      .eq("is_active", true)
      .order("name")

    const { data: categoriesData } = await supabase
      .from("categories")
      .select("id, category_name, parent_category_id")
      .eq("is_active", true)
      .order("category_name")

    setCatalogProducts(productsData || [])
    setCategories(categoriesData || [])
  }

  const parentCategories = categories.filter((cat) => !cat.parent_category_id)
  const subCategories =
    selectedCategory && selectedCategory !== "all"
      ? categories.filter((cat) => cat.parent_category_id === selectedCategory)
      : []

  const handlePartyChange = (partyId: string, party: Party | null) => {
    setSelectedPartyId(partyId)
    setSelectedParty(party)
  }

  // Pre-fill from a specific bill (order) this credit note is against —
  // either opened via "Process Return" on an order (?orderId= in the URL)
  // or picked from the bill-search once a party is selected below. Either
  // way, linking a bill is what makes saving this note actually shrink that
  // order's total (and therefore the amount still owed on it) the same way
  // Vyapar nets a credit note off its linked bill — see handleSave's
  // returnOrderMeta branch.
  const loadOrderForReturn = async (orderId: string) => {
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, invoice_number_gst, invoice_number_non_gst, order_date, total_amount, subtotal, gst_amount, cgst_amount, sgst_amount, source_godown_id, payment_status, payment_method, customer_id, distributor_id, retailer_id")
      .eq("id", orderId)
      .single()
    if (!order) return

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, product_id, product_name, quantity, unit_price, weight_grams, hsn_code, gst_percentage, subtotal, discount_amount, gst_amount, cgst_amount, sgst_amount, total")
      .eq("order_id", order.id)

    setReturnOrderMeta({
      id: order.id,
      order_number: order.order_number,
      total_amount: Number(order.total_amount) || 0,
      subtotal: Number(order.subtotal) || 0,
      gst_amount: Number(order.gst_amount) || 0,
      cgst_amount: Number(order.cgst_amount) || 0,
      sgst_amount: Number(order.sgst_amount) || 0,
      source_godown_id: order.source_godown_id,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
    })

    setInvoiceNumber(order.invoice_number_gst || order.invoice_number_non_gst || order.order_number)
    if (order.order_date) setInvoiceDate(new Date(order.order_date))

    const linkedPartyId = order.distributor_id || order.retailer_id || order.customer_id || null
    linkedBillPartyIdRef.current = linkedPartyId

    if (order.distributor_id) {
      const { data: d } = await supabase.from("distributors").select("id, name, phone_primary, email, company_name, gst_number").eq("id", order.distributor_id).single()
      if (d) handlePartyChange(d.id, { id: d.id, name: d.name, phone: d.phone_primary, email: d.email, company_name: d.company_name, gst_number: d.gst_number, type: "distributor" })
    } else if (order.retailer_id) {
      const { data: r } = await supabase.from("retailers").select("id, name, phone_primary, email, company_name, gst_number").eq("id", order.retailer_id).single()
      if (r) handlePartyChange(r.id, { id: r.id, name: r.name, phone: r.phone_primary, email: r.email, company_name: r.company_name, gst_number: r.gst_number, type: "retailer" })
    } else if (order.customer_id) {
      const { data: c } = await supabase.from("customers").select("id, first_name, last_name, mobile_primary, email, company_name, gst_number").eq("id", order.customer_id).single()
      if (c) handlePartyChange(c.id, { id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), phone: c.mobile_primary, email: c.email, company_name: c.company_name, gst_number: c.gst_number, type: "customer" })
    }

    const meta: typeof itemOrderMeta = {}
    const noteItems: NoteItem[] = (orderItems || []).map((item: any) => {
      const id = Math.random().toString(36).substring(2, 9)
      meta[id] = {
        orderItemId: item.id,
        productId: item.product_id,
        weightGrams: item.weight_grams,
        originalQty: Number(item.quantity) || 0,
      }
      const gstPct = Number(item.gst_percentage) || 0
      // order_items.unit_price is GST-inclusive; NoteItem's price_per_unit
      // is the excl.-tax rate calculateNoteItemAmount expects, so back
      // the tax out before handing it off.
      const priceExclTax = gstPct > 0 ? Number(item.unit_price) / (1 + gstPct / 100) : Number(item.unit_price)
      return calculateNoteItemAmount({
        id,
        product_id: item.product_id || "",
        item_name: item.product_name,
        hsn_code: item.hsn_code || "",
        description: "",
        quantity: Number(item.quantity) || 0,
        unit: "PCS",
        price_per_unit: priceExclTax,
        discount_percent: 0,
        discount_amount: 0,
        tax_percent: gstPct,
        tax_amount: 0,
        amount: 0,
      })
    })
    setItemOrderMeta(meta)
    setItems(noteItems)
    setDescription(`Return against order ${order.order_number}`)
  }

  // Direct ID lookup for distributor/retailer/customer orders; guest orders
  // (no linked party) are left for the user to pick manually rather than
  // risk a wrong fuzzy name match on a real sale.
  useEffect(() => {
    if (!returnOrderId) return
    let cancelled = false
    loadOrderForReturn(returnOrderId).catch((err) => {
      if (!cancelled) console.error("Error loading order for return:", err)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnOrderId])

  // Unlink the bill if the user changes the party after a bill was already
  // picked — a linked bill that no longer matches the selected party would
  // silently shrink the wrong party's order.
  useEffect(() => {
    if (returnOrderMeta && linkedBillPartyIdRef.current && selectedPartyId !== linkedBillPartyIdRef.current) {
      setReturnOrderMeta(null)
      setItemOrderMeta({})
      setItems([])
      setInvoiceNumber("")
      setDescription("")
      linkedBillPartyIdRef.current = null
      toast.info("Bill link removed — party changed")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartyId])

  const searchPartyBills = async (query: string) => {
    if (!selectedPartyId || !selectedParty) {
      setBillOptions([])
      return
    }
    setBillSearchLoading(true)
    try {
      const column =
        selectedParty.type === "distributor"
          ? "distributor_id"
          : selectedParty.type === "retailer"
          ? "retailer_id"
          : selectedParty.type === "customer"
          ? "customer_id"
          : null
      if (!column) {
        setBillOptions([])
        return
      }

      let q = supabase
        .from("orders")
        .select("id, order_number, invoice_number_gst, invoice_number_non_gst, order_date, total_amount, paid_amount")
        .eq(column, selectedPartyId)
        .neq("order_status", "cancelled")
        .order("order_date", { ascending: false })
        .limit(25)

      if (query.trim()) {
        const pattern = `%${query.trim()}%`
        q = q.or(`order_number.ilike.${pattern},invoice_number_gst.ilike.${pattern},invoice_number_non_gst.ilike.${pattern}`)
      }

      const { data } = await q
      setBillOptions(
        (data || []).map((o) => ({
          id: o.id,
          label: o.invoice_number_gst || o.invoice_number_non_gst || o.order_number,
          order_date: o.order_date,
          total_amount: Number(o.total_amount) || 0,
          paid_amount: Number(o.paid_amount) || 0,
        }))
      )
    } finally {
      setBillSearchLoading(false)
    }
  }

  useEffect(() => {
    if (billPickerOpen) searchPartyBills(billSearchQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billPickerOpen, billSearchQuery, selectedPartyId])

  const handlePickBill = async (billId: string) => {
    setBillPickerOpen(false)
    setBillSearchQuery("")
    await loadOrderForReturn(billId)
  }

  const handleUnlinkBill = () => {
    setReturnOrderMeta(null)
    setItemOrderMeta({})
    setItems([])
    setInvoiceNumber("")
    setDescription("")
    linkedBillPartyIdRef.current = null
  }

  const filteredCatalogProducts = catalogProducts.filter((p) => {
    if (selectedCategory !== "all" && p.parent_category_id !== selectedCategory) return false
    if (selectedSubCategory !== "all" && p.sub_category_id !== selectedSubCategory) return false
    return true
  })

  const selectProduct = (productId: string) => {
    const product = catalogProducts.find((p) => p.id === productId)
    if (!product) return
    setSelectedProductId(productId)
    setDraftItem((prev) =>
      calculateNoteItemAmount({
        ...prev,
        product_id: product.id,
        item_name: product.name,
        hsn_code: product.hsn_code || "",
        price_per_unit: product.customer_price || 0,
        tax_percent: product.gst_percentage ?? 18,
      })
    )
    requestAnimationFrame(() => {
      qtyRef.current?.focus()
      qtyRef.current?.select()
    })
  }

  const updateDraft = (field: keyof NoteItem, value: string | number) => {
    setDraftItem((prev) => calculateNoteItemAmount({ ...prev, [field]: value }))
  }

  const focusOnEnter = (ref: React.RefObject<HTMLInputElement | null>) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      ref.current?.focus()
      ref.current?.select()
    }
  }

  const commitDraftRow = () => {
    if (!draftItem.item_name || draftItem.quantity <= 0) {
      toast.error("Select a product and enter a valid quantity first")
      return
    }
    setItems((prev) => [...prev, { ...draftItem, id: Math.random().toString(36).substring(2, 9) }])
    setDraftItem(makeEmptyNoteItem())
    setSelectedProductId("")
  }

  const updateItem = (id: string, field: keyof NoteItem, value: string | number) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          return calculateNoteItemAmount(updatedItem)
        }
        return item
      })
    )
  }

  const removeRow = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  // Upload — or paste (Ctrl+V) — a screenshot of the Tally credit-note voucher
  // to auto-fill party, reference invoice, dates, and line items. Mirrors the
  // Purchases Tally-screenshot feature (app/dashboard/purchases/new) but
  // items here are free text (no stock/catalog matching needed — product_id
  // is optional on credit_note_items), so there's no review-queue step:
  // everything lands directly in the form for you to check before saving.
  const handleScreenshotUpload = async (file: File) => {
    setUploadingScreenshot(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/notes/parse-screenshot", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to read the screenshot")

      const note = data.note as ParsedNoteScreenshot
      const warnings: string[] = []

      const parties = await fetchAllParties()
      const matched = matchParty(note.partyName, note.partyGstin, parties)
      if (matched) {
        setSelectedPartyId(matched.id)
        setSelectedParty(matched)
      } else if (note.partyName) {
        warnings.push(`Couldn't find a matching party for "${note.partyName}" — select the party manually.`)
      }

      if (note.referenceNumber) setInvoiceNumber(note.referenceNumber)
      if (note.referenceDate && !isNaN(new Date(note.referenceDate).getTime())) {
        setInvoiceDate(new Date(note.referenceDate))
      }
      if (note.noteDate && !isNaN(new Date(note.noteDate).getTime())) {
        setNoteDate(new Date(note.noteDate))
      }
      if (note.partyState) {
        const stateMatch = INDIAN_STATES.find((s) => s.toLowerCase() === note.partyState.toLowerCase())
        if (stateMatch) setStateOfSupply(stateMatch)
      }

      if (note.items.length > 0) {
        setItems(
          note.items.map((item) =>
            calculateNoteItemAmount({
              id: Math.random().toString(36).substring(2, 9),
              product_id: "",
              item_name: item.description,
              hsn_code: item.hsnCode,
              description: "",
              quantity: item.quantity,
              unit: item.unit || "PCS",
              price_per_unit: item.ratePerUnitExclTax || (item.quantity > 0 ? item.amount / item.quantity : 0),
              discount_percent: 0,
              discount_amount: 0,
              tax_percent: item.gstPercent || 18,
              tax_amount: 0,
              amount: 0,
            })
          )
        )
      } else {
        warnings.push("No line items could be read from the screenshot — add them manually.")
      }

      if (warnings.length > 0) warnings.forEach((w) => toast.warning(w))
      toast.message("Please review the party, items, and totals before saving — auto-extracted data may need correction.")
    } catch (err) {
      console.error("Error uploading note screenshot:", err)
      toast.error(err instanceof Error ? err.message : "Failed to read the screenshot")
    } finally {
      setUploadingScreenshot(false)
    }
  }

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

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price_per_unit), 0)
    const totalDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0)
    const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0)
    const total = items.reduce((sum, item) => sum + item.amount, 0)
    const shipping = Number(shippingCharges) || 0
    const totalWithShipping = total + shipping

    let finalTotal = totalWithShipping
    let roundOffAmt = 0

    if (roundOff) {
      roundOffAmt = Math.round(totalWithShipping) - totalWithShipping
      finalTotal = Math.round(totalWithShipping)
    }

    return { subtotal, totalDiscount, totalTax, total, shipping, roundOffAmt, finalTotal }
  }

  const totals = calculateTotals()

  const handleSave = async () => {
    if (!selectedPartyId) {
      toast.error("Please select a party")
      return
    }

    const validItems = items.filter((item) => item.item_name && item.quantity > 0)
    if (validItems.length === 0) {
      toast.error("Please add at least one item")
      return
    }

    setSaving(true)

    try {
      // Note numbers follow the invoice-code series of the invoice being
      // returned against (e.g. invoice A2248 → CN-A-3) so every invoice code
      // gets its own separate series. No linked invoice → global CN sequence.
      let noteNumber = `CN-${returnNo}`
      const prefixMatch = (invoiceNumber || "").trim().match(/^([A-Za-z]+)/)
      if (prefixMatch) {
        const code = prefixMatch[1].toUpperCase()
        const { data: lastNote } = await supabase
          .from("credit_notes")
          .select("note_number")
          .ilike("note_number", `CN-${code}-%`)
          .order("created_at", { ascending: false })
          .limit(1)
        const lastSeq =
          lastNote && lastNote.length > 0
            ? parseInt(lastNote[0].note_number.split("-").pop() || "0", 10) || 0
            : 0
        noteNumber = `CN-${code}-${lastSeq + 1}`
      }

      const noteData = {
        note_number: noteNumber,
        party_type: selectedParty?.type || "customer",
        party_id: selectedPartyId,
        party_name: selectedParty?.name || "",
        party_phone: selectedParty?.phone || "",
        return_no: returnNo.toString(),
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate ? format(invoiceDate, "yyyy-MM-dd") : null,
        note_date: format(noteDate, "yyyy-MM-dd"),
        state_of_supply: stateOfSupply,
        transport_name: transportName,
        delivery_location: deliveryLocation,
        vehicle_number: vehicleNumber,
        delivery_date: deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : null,
        payment_type: paymentType,
        subtotal: totals.subtotal,
        discount_amount: totals.totalDiscount,
        tax_amount: totals.totalTax,
        shipping_charges: totals.shipping,
        round_off: roundOff ? totals.roundOffAmt : 0,
        total_amount: totals.finalTotal,
        description: description,
        status: "draft",
      }

      const { data: creditNote, shippingSaveSkipped } = await insertNoteWithShippingFallback(
        supabase,
        "credit_notes",
        noteData
      )
      if (shippingSaveSkipped) {
        toast.warning("Shipping charges couldn't be saved yet — ask an admin to run the pending database migration.")
      }

      const itemsData = validItems.map((item) => ({
        credit_note_id: creditNote.id,
        product_id: item.product_id || null,
        item_name: item.item_name,
        hsn_code: item.hsn_code,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        price_per_unit: item.price_per_unit,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        tax_percent: item.tax_percent,
        tax_amount: item.tax_amount,
        amount: item.amount,
      }))

      const { error: itemsError } = await supabase
        .from("credit_note_items")
        .insert(itemsData)

      if (itemsError) throw itemsError

      // This credit note is against one of our own sales — shrink that
      // order to match what's actually being returned, restock the
      // warehouse, and reverse the payment in Reconciliation if it was
      // already marked paid.
      if (returnOrderMeta) {
        const returnLines: OrderReturnLine[] = validItems
          .map((item) => {
            const meta = itemOrderMeta[item.id]
            if (!meta) return null
            return {
              orderItemId: meta.orderItemId,
              productId: meta.productId,
              weightGrams: meta.weightGrams,
              returnQty: Math.min(item.quantity, meta.originalQty),
            }
          })
          .filter((l): l is OrderReturnLine => l !== null)

        const returnedValue = await applyOrderReturnEffects(supabase, returnOrderMeta, returnLines)
        if (returnedValue > 0) {
          // Marks this note as already baked into the order's total, so
          // Customers V2's balance/spend aggregates (which separately
          // subtract every credit note) know to skip it instead of
          // subtracting the same amount twice.
          await supabase
            .from("credit_notes")
            .update({ linked_order_id: returnOrderMeta.id })
            .eq("id", creditNote.id)
          toast.success(`Order ${returnOrderMeta.order_number} reduced by ₹${returnedValue.toFixed(2)} and stock restocked`)
        }
      } else {
        // Freeform credit note (not opened from a specific order) — still
        // restock whatever items have a real catalog product, since a
        // credit note always means goods physically came back. There's no
        // order to reduce or payment to reverse without one, so only the
        // warehouse side applies — into the factory's own godown, same
        // default Add Production uses.
        const itemsWithProduct = validItems.filter((item) => item.product_id)
        if (itemsWithProduct.length > 0) {
          const { data: companyGodown } = await supabase
            .from("godowns")
            .select("id")
            .eq("godown_type", "company")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle()
          if (companyGodown) {
            const productIds = [...new Set(itemsWithProduct.map((item) => item.product_id))]
            const { data: products } = await supabase
              .from("products")
              .select("id, net_weight_grams")
              .in("id", productIds)
            const weightByProduct = new Map((products || []).map((p) => [p.id, p.net_weight_grams]))
            await restoreKgStockForOrder(
              supabase,
              companyGodown.id,
              itemsWithProduct.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
                weight_grams: weightByProduct.get(item.product_id) ?? null,
              }))
            )
            toast.success("Stock restocked at the factory warehouse")
          }
        }
      }

      toast.success("Credit Note created successfully")
      router.push("/dashboard/credit-notes")
    } catch (error) {
      console.error("Error saving credit note:", error)
      toast.error("Failed to save credit note")
    } finally {
      setSaving(false)
    }
  }

  useSaveShortcut(handleSave, saving)

  return (
    <div className="space-y-6">
      {returnOrderMeta && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span>
            Returning against order <strong>{returnOrderMeta.order_number}</strong> — saving this note will reduce
            that order&apos;s total, add the returned stock back to its warehouse, and reverse the payment in
            Reconciliation if it was already paid.
          </span>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/credit-notes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileMinus2 className="h-8 w-8" />
            Create Credit Note
          </h1>
          <p className="text-muted-foreground">
            Create a new credit note for returns or adjustments
          </p>
        </div>
      </div>

      <div className="grid gap-6">
          {/* Tally Screenshot Auto-fill */}
          <Card className="border-dashed">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileImage className="h-4 w-4" />
                Auto-fill from Tally Screenshot
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload — or just paste (Ctrl+V) — a screenshot of the Tally credit note voucher to auto-fill the party, reference invoice, and items below. Always review everything before saving — nothing is saved automatically.
              </p>
            </CardHeader>
            <CardContent>
              <input
                id="credit_note_screenshot"
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
                onClick={() => document.getElementById("credit_note_screenshot")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadingScreenshot ? "Reading screenshot..." : "Upload Screenshot"}
              </Button>
            </CardContent>
          </Card>

          {/* Party & Invoice Details */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Party & Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Party <span className="text-red-500">*</span></Label>
                  <PartyCombobox
                    value={selectedPartyId}
                    onValueChange={handlePartyChange}
                    placeholder="Search customers or vendors..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={selectedParty?.phone || ""} readOnly className="bg-muted" />
                </div>
              </div>

              {selectedParty && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPartyDetails((v) => !v)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showPartyDetails ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {showPartyDetails ? "Hide" : "Show"} party details
                    {!showPartyDetails && (
                      <span className="text-xs">
                        ({PARTY_TYPE_LABEL[selectedParty.type]}
                        {selectedParty.gst_number ? ` · GST: ${selectedParty.gst_number}` : ""})
                      </span>
                    )}
                  </button>
                  {showPartyDetails && (
                    <div className="flex gap-2">
                      <Badge variant={selectedParty.type === "customer" ? "default" : "secondary"}>
                        {PARTY_TYPE_LABEL[selectedParty.type]}
                      </Badge>
                      {selectedParty.gst_number && (
                        <Badge variant="outline">GST: {selectedParty.gst_number}</Badge>
                      )}
                      {selectedParty.company_name && (
                        <Badge variant="outline">{selectedParty.company_name}</Badge>
                      )}
                    </div>
                  )}
                </>
              )}

              {selectedParty && selectedParty.type !== "vendor" && (
                <div className="space-y-2">
                  <Label>Linked Bill</Label>
                  {returnOrderMeta ? (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                      <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>
                        Linked to <strong>{returnOrderMeta.order_number}</strong> — current total{" "}
                        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(returnOrderMeta.total_amount)}
                      </span>
                      <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 gap-1" onClick={handleUnlinkBill}>
                        <Unlink className="h-3.5 w-3.5" />
                        Unlink
                      </Button>
                    </div>
                  ) : (
                    <Popover open={billPickerOpen} onOpenChange={setBillPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="gap-2">
                          <Link2 className="h-4 w-4" />
                          Link to a bill
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[420px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search this party's bills..."
                            value={billSearchQuery}
                            onValueChange={setBillSearchQuery}
                          />
                          <CommandList>
                            {billSearchLoading ? (
                              <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
                            ) : billOptions.length === 0 ? (
                              <CommandEmpty>No bills found for this party.</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {billOptions.map((bill) => (
                                  <CommandItem key={bill.id} value={bill.id} onSelect={() => handlePickBill(bill.id)} className="cursor-pointer">
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">{bill.label}</span>
                                        <span className="text-sm">
                                          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(bill.total_amount)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                        <span>{bill.order_date ? format(new Date(bill.order_date), "PPP") : ""}</span>
                                        <span>{bill.paid_amount >= bill.total_amount ? "Paid" : "Unpaid/partial"}</span>
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Linking a bill reduces that bill&apos;s own total by this note&apos;s amount, so the amount still
                    owed on it goes down right away — same as entering a credit note against a bill in Vyapar.
                  </p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Original Invoice #</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-001"
                    readOnly={!!returnOrderMeta}
                    className={returnOrderMeta ? "bg-muted" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !invoiceDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {invoiceDate ? format(invoiceDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={invoiceDate} onSelect={setInvoiceDate} /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Credit Note Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(noteDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={noteDate} onSelect={(d) => d && setNoteDate(d)} /></PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>State of Supply</Label>
                <Select value={stateOfSupply} onValueChange={setStateOfSupply}>
                  <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Line Items
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Pick a product below, Tab/Enter through Qty → Rate → Disc % → Tax % — Enter on the last field adds the row. Every added row is directly editable in the table, including the item name.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Filters — narrow the product search below */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Filter className="h-4 w-4" />
                    Filter by Category
                  </Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(v) => {
                      setSelectedCategory(v)
                      setSelectedSubCategory("all")
                    }}
                  >
                    <SelectTrigger className="w-full !h-11 px-4 text-sm">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {parentCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Filter className="h-4 w-4" />
                    Filter by Sub-Category
                  </Label>
                  <Select
                    value={selectedSubCategory}
                    onValueChange={setSelectedSubCategory}
                    disabled={selectedCategory === "all" || subCategories.length === 0}
                  >
                    <SelectTrigger className="w-full !h-11 px-4 text-sm">
                      <SelectValue placeholder="All Sub-Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub-Categories</SelectItem>
                      {subCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <NoteItemTable items={items} onUpdateItem={updateItem} onRemoveItem={removeRow} />

              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No items added yet — add one using the row below.
                </p>
              )}

              {/* Add Item — picks from the catalog; every field carries over
                  into the row above and stays editable there afterward. */}
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <Label className="text-xs font-medium text-muted-foreground">Add Item</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Product</Label>
                    <Select value={selectedProductId} onValueChange={selectProduct}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={`Select (${filteredCatalogProducts.length} available)`} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCatalogProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{product.name}</span>
                              <span className="text-sm text-muted-foreground ml-4">₹{product.customer_price}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">HSN</Label>
                    <Input
                      value={draftItem.hsn_code}
                      onChange={(e) => updateDraft("hsn_code", e.target.value)}
                      placeholder="HSN"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      ref={qtyRef}
                      type="number"
                      min="1"
                      value={draftItem.quantity}
                      onChange={(e) => updateDraft("quantity", parseFloat(e.target.value) || 0)}
                      onKeyDown={focusOnEnter(priceRef)}
                      className="h-9 text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rate (Excl. Tax)</Label>
                    <Input
                      ref={priceRef}
                      type="number"
                      min="0"
                      step="0.01"
                      value={draftItem.price_per_unit || ""}
                      onChange={(e) => updateDraft("price_per_unit", parseFloat(e.target.value) || 0)}
                      onKeyDown={focusOnEnter(discRef)}
                      className="h-9 text-right"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Disc %</Label>
                    <Input
                      ref={discRef}
                      type="number"
                      min="0"
                      max="100"
                      value={draftItem.discount_percent || ""}
                      onChange={(e) => updateDraft("discount_percent", parseFloat(e.target.value) || 0)}
                      onKeyDown={focusOnEnter(taxRef)}
                      className="h-9 text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tax %</Label>
                    <Input
                      ref={taxRef}
                      type="number"
                      min="0"
                      max="100"
                      value={draftItem.tax_percent}
                      onChange={(e) => updateDraft("tax_percent", parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          commitDraftRow()
                        }
                      }}
                      className="h-9 text-center"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Rate (Incl. of Tax) and Unit can be adjusted directly in the table above once added.
                  </p>
                  <Button type="button" size="sm" onClick={commitDraftRow}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transport Details */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Transport Details
                <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Transport Name</Label>
                  <Input value={transportName} onChange={(e) => setTransportName(e.target.value)} placeholder="Transporter" />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Location</Label>
                  <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="Location" />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Number</Label>
                  <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="MH-12-AB-1234" />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deliveryDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deliveryDate ? format(deliveryDate, "PPP") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={deliveryDate} onSelect={setDeliveryDate} /></PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any notes or reason for this credit note..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Payment & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Payment */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{totals.subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-green-600">-{totals.totalDiscount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">Tax</span>
                <span className="font-semibold">{totals.totalTax.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="shipping_charges" className="text-sm text-muted-foreground shrink-0">Shipping Charges</Label>
                <Input
                  id="shipping_charges"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCharges}
                  onChange={(e) => setShippingCharges(e.target.value)}
                  placeholder="0.00"
                  className="h-8 w-32 text-right"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox id="roundoff" checked={roundOff} onCheckedChange={(c) => setRoundOff(c as boolean)} />
                  <Label htmlFor="roundoff" className="text-sm text-muted-foreground">Round Off</Label>
                </div>
                <span className="text-sm">{totals.roundOffAmt.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>

              <div className="flex justify-between items-center rounded-lg bg-muted px-4 py-3 text-base font-bold">
                <span>Total Amount:</span>
                <span className="text-xl">{totals.finalTotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? "Saving..." : "Create Credit Note"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/credit-notes")}
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

export default function NewCreditNotePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <NewCreditNotePageContent />
    </Suspense>
  )
}
