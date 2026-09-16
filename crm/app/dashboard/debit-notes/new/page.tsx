"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
  FilePlus2,
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
} from "lucide-react"

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

export default function NewDebitNotePage() {
  const router = useRouter()
  const { role } = useUserRole()
  const [saving, setSaving] = useState(false)
  const [selectedPartyId, setSelectedPartyId] = useState<string>("")
  const [selectedParty, setSelectedParty] = useState<Party | null>(null)
  // Collapsed by default, like Purchases' "Show vendor details" — party info
  // is a confirmation preview, not something worth pushing the rest of the
  // form down for.
  const [showPartyDetails, setShowPartyDetails] = useState(false)
  const [returnNo, setReturnNo] = useState<number>(1)
  // Live preview of the note number this will be saved as — recomputed
  // whenever the bill number changes, since the real sequence is derived
  // from its prefix (see computeNoteNumber). Purely informational: handleSave
  // always recomputes fresh right before saving so a concurrent save by
  // someone else can't leave this stale value actually persisted.
  const [previewNoteNumber, setPreviewNoteNumber] = useState("DN-1")

  // Form state - Debit Note uses Bill Number/Date
  const [billNumber, setBillNumber] = useState("")
  const [billDate, setBillDate] = useState<Date | undefined>(undefined)
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
  // COMPANY constant on the debit note print page) — a debit note created
  // under the Factory role is being issued from that Gujarat GSTIN, so it
  // should default to Gujarat instead of the generic Maharashtra default.
  useEffect(() => {
    if (role === "factories") setStateOfSupply("Gujarat")
  }, [role])

  const fetchNextReturnNo = async () => {
    try {
      const { data } = await supabase
        .from("debit_notes")
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

  // Note numbers follow the invoice-code series of the bill being returned
  // against (e.g. bill T-23 → DN-T-2) so every code gets its own separate
  // series. No linked bill → global DN sequence. Shared by the live preview
  // below and by handleSave, which always calls this fresh right before
  // saving rather than trusting the preview.
  const computeNoteNumber = async (bill: string, fallbackReturnNo: number) => {
    const prefixMatch = (bill || "").trim().match(/^([A-Za-z]+)/)
    if (!prefixMatch) return `DN-${fallbackReturnNo}`
    const code = prefixMatch[1].toUpperCase()
    const { data: lastNote } = await supabase
      .from("debit_notes")
      .select("note_number")
      .ilike("note_number", `DN-${code}-%`)
      .order("created_at", { ascending: false })
      .limit(1)
    const lastSeq =
      lastNote && lastNote.length > 0
        ? parseInt(lastNote[0].note_number.split("-").pop() || "0", 10) || 0
        : 0
    return `DN-${code}-${lastSeq + 1}`
  }

  // Recompute the preview whenever the bill number settles (debounced so it
  // doesn't fire a query on every keystroke).
  useEffect(() => {
    const timer = setTimeout(() => {
      computeNoteNumber(billNumber, returnNo).then(setPreviewNoteNumber)
    }, 400)
    return () => clearTimeout(timer)
  }, [billNumber, returnNo])

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

  // Upload — or paste (Ctrl+V) — a screenshot of the Tally debit-note voucher
  // to auto-fill party, reference bill, dates, and line items. Mirrors the
  // Purchases Tally-screenshot feature (app/dashboard/purchases/new) but
  // items here are free text (no stock/catalog matching needed — product_id
  // is optional on debit_note_items), so there's no review-queue step:
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

      if (note.referenceNumber) setBillNumber(note.referenceNumber)
      if (note.referenceDate && !isNaN(new Date(note.referenceDate).getTime())) {
        setBillDate(new Date(note.referenceDate))
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
      // Recomputed fresh here (not read from the preview state) so a note
      // created by someone else in the meantime can't leave a stale number.
      const noteNumber = await computeNoteNumber(billNumber, returnNo)

      const noteData = {
        note_number: noteNumber,
        party_type: selectedParty?.type || "customer",
        party_id: selectedPartyId,
        party_name: selectedParty?.name || "",
        party_phone: selectedParty?.phone || "",
        return_no: returnNo.toString(),
        bill_number: billNumber,
        bill_date: billDate ? format(billDate, "yyyy-MM-dd") : null,
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

      const { data: debitNote, shippingSaveSkipped } = await insertNoteWithShippingFallback(
        supabase,
        "debit_notes",
        noteData
      )
      if (shippingSaveSkipped) {
        toast.warning("Shipping charges couldn't be saved yet — ask an admin to run the pending database migration.")
      }

      const itemsData = validItems.map((item) => ({
        debit_note_id: debitNote.id,
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
        .from("debit_note_items")
        .insert(itemsData)

      if (itemsError) throw itemsError

      toast.success("Debit Note created successfully")
      router.push("/dashboard/debit-notes")
    } catch (error) {
      console.error("Error saving debit note:", error)
      toast.error("Failed to save debit note")
    } finally {
      setSaving(false)
    }
  }

  useSaveShortcut(handleSave, saving)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/debit-notes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FilePlus2 className="h-8 w-8" />
              Create Debit Note
            </h1>
            <p className="text-muted-foreground">
              Create a new debit note for additional charges or adjustments
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Badge variant="outline" className="text-base px-3 py-1 font-mono">
            {previewNoteNumber}
          </Badge>
          <span className="text-xs text-muted-foreground">Will be saved as this number</span>
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
                Upload — or just paste (Ctrl+V) — a screenshot of the Tally debit note voucher to auto-fill the party, reference bill, and items below. Always review everything before saving — nothing is saved automatically.
              </p>
            </CardHeader>
            <CardContent>
              <input
                id="debit_note_screenshot"
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
                onClick={() => document.getElementById("debit_note_screenshot")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadingScreenshot ? "Reading screenshot..." : "Upload Screenshot"}
              </Button>
            </CardContent>
          </Card>

          {/* Party & Bill Details */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Party & Bill Details
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

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Original Bill #</Label>
                  <Input
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    placeholder="BILL-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bill Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !billDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {billDate ? format(billDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={billDate} onSelect={setBillDate} /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Debit Note Date</Label>
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
                placeholder="Add any notes or reason for this debit note..."
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
              {saving ? "Saving..." : "Create Debit Note"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/debit-notes")}
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
