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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VendorCombobox } from "@/components/ui/vendor-combobox"
import { toast } from "sonner"
import { ArrowLeft, Droplets, ShoppingBag } from "lucide-react"

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

type ProductCategory = {
  id: string
  name: string
}

type LooseStock = {
  id: string
  category_id: string
  category_name: string
  quantity_liters: number
  price_per_liter: number
}

const MAIN_STOCK_CATEGORIES = [
  "Buffalo Ghee",
  "Cow Ghee",
  "Valona Ghee",
  "Groundnut Oil"
]

export default function LooseStockPurchasePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [looseStock, setLooseStock] = useState<LooseStock[]>([])

  // Form state
  const [selectedVendorId, setSelectedVendorId] = useState("")
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [quantityLiters, setQuantityLiters] = useState("")
  const [pricePerLiter, setPricePerLiter] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [batchNumber, setBatchNumber] = useState("")
  const [notes, setNotes] = useState("")
  // Rate entered is excl.-tax; ghee/loose purchases are taxable (default 5%), not exempt.
  const [gstPercentage, setGstPercentage] = useState("5")
  const [itcEligible, setItcEligible] = useState(true)

  // Vendor's available loose stock categories
  const [vendorLooseStockCategories, setVendorLooseStockCategories] = useState<string[]>([])

  useEffect(() => {
    fetchVendors()
    fetchCategories()
    fetchLooseStock()
  }, [])

  const fetchVendors = async () => {
    const { data, error } = await supabase
      .from("vendors")
      .select("id, vendor_name, contact_person, email, mobile_primary, company_name, gst_number, address_line1, address_line2, city, state, pincode, country")
      .eq("is_active", true)
      .order("vendor_name")

    if (error) {
      console.error("Error fetching vendors:", error)
    } else {
      setVendors(data || [])
    }
  }

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("product_categories")
      .select("id, name")
      .in("name", MAIN_STOCK_CATEGORIES)
      .order("name")

    if (error) {
      console.error("Error fetching categories:", error)
    } else {
      setCategories(data || [])
    }
  }

  const fetchLooseStock = async () => {
    const { data, error } = await supabase
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

    if (error) {
      console.error("Error fetching loose stock:", error)
      return
    }

    const transformedData: LooseStock[] = (data || []).map((item: any) => ({
      id: item.id,
      category_id: item.category_id,
      category_name: item.product_categories.name,
      quantity_liters: item.quantity_liters,
      price_per_liter: item.price_per_liter,
    }))

    setLooseStock(transformedData)
  }

  const fetchVendorLooseStock = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from("vendor_loose_stock")
        .select("category_id")
        .eq("vendor_id", vendorId)

      if (error) throw error

      const categoryIds = (data || []).map((item: any) => item.category_id)
      setVendorLooseStockCategories(categoryIds)
    } catch (error) {
      console.error("Error fetching vendor loose stock:", error)
      setVendorLooseStockCategories([])
    }
  }

  const handleVendorSelect = (vendorId: string) => {
    setSelectedVendorId(vendorId)
    const vendor = vendors.find((v) => v.id === vendorId)
    setSelectedVendor(vendor || null)

    // Reset category when vendor changes
    setSelectedCategory("")

    // Fetch vendor's loose stock categories
    if (vendorId) {
      fetchVendorLooseStock(vendorId)
    } else {
      setVendorLooseStockCategories([])
    }
  }

  const getCurrentStock = () => {
    if (!selectedCategory) return null
    return looseStock.find((ls) => ls.category_id === selectedCategory)
  }

  // Loose purchases (milk, packaging, etc.) are received at the Gujarat factory.
  const COMPANY_STATE = "Gujarat"

  const calculateTotals = () => {
    const quantity = parseFloat(quantityLiters) || 0
    const price = parseFloat(pricePerLiter) || 0
    const total = quantity * price

    const currentStock = getCurrentStock()
    const newTotal = (currentStock?.quantity_liters || 0) + quantity

    const pct = Number(gstPercentage) || 0
    // Rate entered is excl.-tax (matches vendor bills/Tally) — GST is added on top, not extracted.
    const gstAmount = pct > 0 ? (total * pct) / 100 : 0
    const supplierState = (selectedVendor?.state || "").trim()
    const isInterState = !!supplierState && supplierState.toLowerCase() !== COMPANY_STATE.toLowerCase()

    return {
      totalAmount: total,
      grandTotal: total + gstAmount,
      newTotalLiters: newTotal,
      gstAmount,
      cgstAmount: isInterState ? 0 : gstAmount / 2,
      sgstAmount: isInterState ? 0 : gstAmount / 2,
      igstAmount: isInterState ? gstAmount : 0,
      isInterState,
    }
  }

  const totals = calculateTotals()

  const validateForm = () => {
    if (!selectedVendorId) {
      toast.error("Please select a vendor")
      return false
    }
    if (!selectedCategory) {
      toast.error("Please select a category")
      return false
    }
    if (!quantityLiters || parseFloat(quantityLiters) <= 0) {
      toast.error("Please enter a valid quantity in liters")
      return false
    }
    if (!pricePerLiter || parseFloat(pricePerLiter) <= 0) {
      toast.error("Please enter a valid price per liter")
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const quantity = parseFloat(quantityLiters)
      const price = parseFloat(pricePerLiter)
      const totalAmount = quantity * price

      // Get or create loose_stock record
      let looseStockRecord = getCurrentStock()

      if (!looseStockRecord) {
        // Create new loose_stock record
        const { data: newLooseStock, error: createError } = await supabase
          .from("loose_stock")
          .insert({
            category_id: selectedCategory,
            quantity_liters: quantity,
            price_per_liter: price,
          })
          .select()
          .single()

        if (createError) throw createError
        looseStockRecord = {
          id: newLooseStock.id,
          category_id: newLooseStock.category_id,
          category_name: categories.find(c => c.id === selectedCategory)?.name || "",
          quantity_liters: newLooseStock.quantity_liters,
          price_per_liter: newLooseStock.price_per_liter,
        }
      } else {
        // Update existing loose_stock record
        const newQuantity = looseStockRecord.quantity_liters + quantity
        const { error: updateError } = await supabase
          .from("loose_stock")
          .update({
            quantity_liters: newQuantity,
            price_per_liter: price, // Update to latest price
          })
          .eq("id", looseStockRecord.id)

        if (updateError) throw updateError
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from("loose_stock_transactions")
        .insert({
          loose_stock_id: looseStockRecord.id,
          transaction_type: "purchase",
          quantity_liters: quantity,
          price_per_liter: price,
          total_amount: totalAmount,
          vendor_id: selectedVendorId,
          vendor_name: selectedVendor?.vendor_name || "",
          invoice_number: invoiceNumber || null,
          batch_number: batchNumber || null,
          transaction_notes: notes || null,
          user_id: user?.id || null,
          user_email: user?.email || null,
          gst_percentage: gstPercentage.trim() !== "" ? Number(gstPercentage) : null,
          gst_amount: totals.gstAmount,
          cgst_amount: totals.cgstAmount,
          sgst_amount: totals.sgstAmount,
          igst_amount: totals.igstAmount,
          is_itc_eligible: itcEligible,
        })

      if (transactionError) throw transactionError

      toast.success(`Successfully purchased ${quantity}L of loose stock`)
      router.push("/dashboard/purchases")
    } catch (error: unknown) {
      console.error("Error saving loose stock purchase:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save purchase"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const currentStock = getCurrentStock()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Droplets className="h-8 w-8" />
            Purchase Loose Stock
          </h1>
          <p className="text-muted-foreground">
            Record purchase of bulk/loose quantities from vendors
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Purchase Form */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Details</CardTitle>
            <CardDescription>
              Enter details of loose stock purchase
            </CardDescription>
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

            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="category">Product Category *</Label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                disabled={!selectedVendorId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!selectedVendorId ? "Select vendor first" : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(category =>
                      vendorLooseStockCategories.length === 0 ||
                      vendorLooseStockCategories.includes(category.id)
                    )
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedVendorId && vendorLooseStockCategories.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  This vendor has no loose stock categories configured. Contact admin to set up vendor&apos;s loose stock categories.
                </p>
              )}
              {selectedVendorId && vendorLooseStockCategories.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Showing {vendorLooseStockCategories.length} categor{vendorLooseStockCategories.length === 1 ? 'y' : 'ies'} available from this vendor
                </p>
              )}
            </div>

            {/* Current Stock Display */}
            {currentStock && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Stock:</span>
                    <span className="font-bold">{currentStock.quantity_liters.toFixed(2)} L</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Price/L:</span>
                    <span className="font-medium">₹{currentStock.price_per_liter.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity in Liters */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (Liters) *</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantityLiters}
                onChange={(e) => setQuantityLiters(e.target.value)}
                placeholder="Enter quantity in liters"
              />
            </div>

            {/* Price per Liter */}
            <div className="space-y-2">
              <Label htmlFor="price">Price per Liter, Excl. Tax (₹) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(e.target.value)}
                placeholder="Enter price per liter"
              />
              <p className="text-xs text-muted-foreground">GST is added on top of this rate.</p>
            </div>

            {/* GST % */}
            <div className="space-y-2">
              <Label htmlFor="gst_percentage">GST %</Label>
              <Input
                id="gst_percentage"
                type="number"
                min="0"
                step="0.01"
                value={gstPercentage}
                onChange={(e) => setGstPercentage(e.target.value)}
                placeholder="GST %"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="itc_eligible"
                checked={itcEligible}
                onChange={(e) => setItcEligible(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="itc_eligible" className="text-sm font-normal">
                Counts toward Input Tax Credit
              </Label>
            </div>

            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="invoice">Invoice Number</Label>
              <Input
                id="invoice"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g., INV-2024-001"
              />
            </div>

            {/* Batch Number */}
            <div className="space-y-2">
              <Label htmlFor="batch">Batch Number</Label>
              <Input
                id="batch"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g., BATCH-001"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Purchase Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this purchase..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Purchase Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Summary</CardTitle>
            <CardDescription>
              Review the purchase details before confirming
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Vendor:</span>
                <span className="font-medium">{selectedVendor?.vendor_name || "-"}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium">
                  {categories.find(c => c.id === selectedCategory)?.name || "-"}
                </span>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-muted-foreground">Purchase Quantity:</span>
                  <span className="font-bold text-lg">{quantityLiters || 0} L</span>
                </div>

                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-muted-foreground">Price per Liter (Excl. Tax):</span>
                  <span className="font-medium">₹{parseFloat(pricePerLiter || "0").toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-sm mb-2 text-muted-foreground">
                  <span>Taxable Value:</span>
                  <span>₹{totals.totalAmount.toFixed(2)}</span>
                </div>

                {totals.gstAmount > 0 && (
                  <div className="flex justify-between items-center text-sm mb-2 text-muted-foreground">
                    <span>GST (added on top, {gstPercentage}%):</span>
                    <span>
                      {totals.isInterState
                        ? `IGST ₹${totals.igstAmount.toFixed(2)}`
                        : `CGST ₹${totals.cgstAmount.toFixed(2)} + SGST ₹${totals.sgstAmount.toFixed(2)}`}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center border-t pt-2 mb-4">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-2xl font-bold text-green-600">
                    ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {currentStock && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Current Stock:</span>
                      <span className="font-medium">{currentStock.quantity_liters.toFixed(2)} L</span>
                    </div>
                    <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                      <span>Adding:</span>
                      <span className="font-bold">+{parseFloat(quantityLiters || "0").toFixed(2)} L</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2 border-blue-200 dark:border-blue-800">
                      <span className="font-bold">New Total:</span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {totals.newTotalLiters.toFixed(2)} L
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {invoiceNumber && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Invoice:</span>
                  <span className="font-medium">{invoiceNumber}</span>
                </div>
              )}

              {batchNumber && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Batch:</span>
                  <span className="font-medium">{batchNumber}</span>
                </div>
              )}
            </div>

            <div className="pt-4 space-y-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
                size="lg"
              >
                {saving ? "Saving..." : "Record Purchase"}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
