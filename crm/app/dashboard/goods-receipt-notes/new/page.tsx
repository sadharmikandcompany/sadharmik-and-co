"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, CalendarIcon, Loader2, Save, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"

type Purchase = { id: string; purchase_number: string; supplier_name: string | null }
type Product = { id: string; name: string }

type GRNLine = {
  id: string
  product_id: string
  expected_qty: string
  received_qty: string
  accepted_qty: string
  rejected_qty: string
  rate: string
  remarks: string
}

export default function NewGRNPage() {
  const router = useRouter()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>("")
  const [vendorName, setVendorName] = useState("")
  const [receivedDate, setReceivedDate] = useState<Date>(new Date())
  const [discrepancyNotes, setDiscrepancyNotes] = useState("")
  const [remarks, setRemarks] = useState("")
  const [lines, setLines] = useState<GRNLine[]>([
    { id: "1", product_id: "", expected_qty: "", received_qty: "", accepted_qty: "", rejected_qty: "0", rate: "", remarks: "" },
  ])

  useEffect(() => {
    const load = async () => {
      const [purchasesRes, productsRes] = await Promise.all([
        supabase.from("purchases").select("id, purchase_number, supplier_name").order("created_at", { ascending: false }).limit(100),
        supabase.from("products").select("id, name").eq("is_active", true).order("name"),
      ])
      setPurchases(purchasesRes.data || [])
      setProducts(productsRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const onPurchaseSelect = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId)
    const purchase = purchases.find(p => p.id === purchaseId)
    if (purchase) setVendorName(purchase.supplier_name || "")
  }

  const addLine = () => {
    setLines(prev => [...prev, { id: Date.now().toString(), product_id: "", expected_qty: "", received_qty: "", accepted_qty: "", rejected_qty: "0", rate: "", remarks: "" }])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 1) return
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const updateLine = (id: string, field: keyof GRNLine, value: string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      if (field === "received_qty") {
        updated.accepted_qty = value
        updated.rejected_qty = "0"
      }
      return updated
    }))
  }

  const handleSubmit = async () => {
    if (!receivedDate) { toast.error("Select received date"); return }
    const validLines = lines.filter(l => l.product_id && parseFloat(l.received_qty) > 0)
    if (validLines.length === 0) { toast.error("Add at least one item"); return }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const grnNumber = `GRN-${format(receivedDate, "yyyyMMdd")}-${Date.now().toString().slice(-4)}`

      const { data: grn, error: grnError } = await supabase.from("goods_receipt_notes").insert([{
        grn_number: grnNumber,
        purchase_id: selectedPurchaseId || null,
        vendor_name: vendorName || null,
        received_date: format(receivedDate, "yyyy-MM-dd"),
        status: "pending",
        discrepancy_notes: discrepancyNotes || null,
        remarks: remarks || null,
        created_by: user?.id || null,
      }]).select().single()

      if (grnError) throw grnError

      const itemData = validLines.map(l => ({
        grn_id: grn.id,
        product_id: l.product_id,
        expected_qty: parseFloat(l.expected_qty) || 0,
        received_qty: parseFloat(l.received_qty) || 0,
        accepted_qty: parseFloat(l.accepted_qty) || 0,
        rejected_qty: parseFloat(l.rejected_qty) || 0,
        rate: parseFloat(l.rate) || 0,
        remarks: l.remarks || null,
      }))

      const { error: itemsError } = await supabase.from("grn_items").insert(itemData)
      if (itemsError) throw itemsError

      toast.success("GRN created successfully")
      router.push("/dashboard/goods-receipt-notes")
    } catch (error: any) {
      console.error("Error:", error)
      toast.error(error.message || "Failed to create GRN")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="space-y-6"><h1 className="text-3xl font-bold">New GRN</h1><p>Loading...</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/goods-receipt-notes"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <div>
          <h1 className="text-3xl font-bold">New Goods Receipt Note</h1>
          <p className="text-muted-foreground">Record physical receipt of goods</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Receipt Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Purchase Order (optional)</Label>
              <Select value={selectedPurchaseId} onValueChange={onPurchaseSelect}>
                <SelectTrigger><SelectValue placeholder="Link to PO" /></SelectTrigger>
                <SelectContent>
                  {purchases.map(p => <SelectItem key={p.id} value={p.id}>{p.purchase_number} - {p.supplier_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendor Name</Label>
              <Input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor / Supplier" />
            </div>
            <div className="space-y-2">
              <Label>Received Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(receivedDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={receivedDate} onSelect={d => d && setReceivedDate(d)} initialFocus /></PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Discrepancy Notes</Label>
              <Textarea value={discrepancyNotes} onChange={e => setDiscrepancyNotes(e.target.value)} placeholder="Note any discrepancies..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="General remarks" rows={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Items Received</CardTitle>
            <Button variant="outline" onClick={addLine}><Plus className="mr-2 h-4 w-4" />Add Item</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground px-1">
              <div className="col-span-3">Product</div>
              <div className="col-span-1">Expected</div>
              <div className="col-span-1">Received</div>
              <div className="col-span-1">Accepted</div>
              <div className="col-span-1">Rejected</div>
              <div className="col-span-2">Rate (₹)</div>
              <div className="col-span-2">Remarks</div>
              <div className="col-span-1" />
            </div>
            {lines.map(line => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <Select value={line.product_id} onValueChange={v => updateLine(line.id, "product_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-1"><Input type="number" min="0" value={line.expected_qty} onChange={e => updateLine(line.id, "expected_qty", e.target.value)} /></div>
                <div className="col-span-1"><Input type="number" min="0" value={line.received_qty} onChange={e => updateLine(line.id, "received_qty", e.target.value)} /></div>
                <div className="col-span-1"><Input type="number" min="0" value={line.accepted_qty} onChange={e => updateLine(line.id, "accepted_qty", e.target.value)} /></div>
                <div className="col-span-1"><Input type="number" min="0" value={line.rejected_qty} onChange={e => updateLine(line.id, "rejected_qty", e.target.value)} /></div>
                <div className="col-span-2"><Input type="number" step="0.01" min="0" value={line.rate} onChange={e => updateLine(line.id, "rate", e.target.value)} /></div>
                <div className="col-span-2"><Input value={line.remarks} onChange={e => updateLine(line.id, "remarks", e.target.value)} placeholder="Note" /></div>
                <div className="col-span-1 flex justify-center">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeLine(line.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/dashboard/goods-receipt-notes"><Button variant="outline">Cancel</Button></Link>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : <><Save className="mr-2 h-4 w-4" />Create GRN</>}
        </Button>
      </div>
    </div>
  )
}
