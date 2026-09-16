"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Search, Plus, X, Truck, RefreshCw, AlertCircle, QrCode, Link } from "lucide-react"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface EWayBillItem {
  productName: string
  hsnCode: string
  quantity: number
  qtyUnit: string
  taxableAmount: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  cessRate: number
}

interface EWayBillData {
  supplyType: string
  subSupplyType: string
  docType: string
  docNo: string
  docDate: string
  fromGstin: string
  fromTrdName: string
  fromAddr1: string
  fromAddr2: string
  fromPlace: string
  fromPincode: string
  fromStateCode: string
  toGstin: string
  toTrdName: string
  toAddr1: string
  toAddr2: string
  toPlace: string
  toPincode: string
  toStateCode: string
  transactionType: string
  totalValue: number
  cgstValue: number
  sgstValue: number
  igstValue: number
  cessValue: number
  transporterId: string
  transporterName: string
  transDocNo: string
  transMode: string
  transDistance: string
  vehicleNo: string
  vehicleType: string
  items: EWayBillItem[]
}

interface EInvoiceData {
  id: string
  invoice_number: string
  irn: string
  buyer_name: string
  buyer_gstin: string
  total_invoice_value: number
  doc_date: string
  status: string
  ewb_no?: string
}

export default function EWayBillPage() {
  const [activeTab, setActiveTab] = useState("generate")
  const [loading, setLoading] = useState(false)
  const [ewayBillNo, setEwayBillNo] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [einvoices, setEInvoices] = useState<EInvoiceData[]>([])
  const [showIRNDialog, setShowIRNDialog] = useState(false)
  const [selectedIRN, setSelectedIRN] = useState("")
  const [generationType, setGenerationType] = useState<"manual" | "irn">("manual")

  const [formData, setFormData] = useState<EWayBillData>({
    supplyType: "O", // O = Outward, I = Inward
    subSupplyType: "1", // Supply
    docType: "INV", // Tax Invoice
    docNo: "",
    docDate: new Date().toISOString().split('T')[0],
    fromGstin: "",
    fromTrdName: "",
    fromAddr1: "",
    fromAddr2: "",
    fromPlace: "",
    fromPincode: "",
    fromStateCode: "",
    toGstin: "",
    toTrdName: "",
    toAddr1: "",
    toAddr2: "",
    toPlace: "",
    toPincode: "",
    toStateCode: "",
    transactionType: "1", // Regular
    totalValue: 0,
    cgstValue: 0,
    sgstValue: 0,
    igstValue: 0,
    cessValue: 0,
    transporterId: "",
    transporterName: "",
    transDocNo: "",
    transMode: "1", // Road
    transDistance: "",
    vehicleNo: "",
    vehicleType: "R", // Regular
    items: []
  })

  const [currentItem, setCurrentItem] = useState<EWayBillItem>({
    productName: "",
    hsnCode: "",
    quantity: 0,
    qtyUnit: "PCS",
    taxableAmount: 0,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    cessRate: 0
  })

  // Fetch e-invoices without e-way bills
  const fetchEInvoices = async () => {
    try {
      const response = await fetch("/api/einvoice/list?status=GENERATED")
      if (response.ok) {
        const data = await response.json()
        // Filter only those without e-way bill
        const invoicesWithoutEWB = data.filter((inv: EInvoiceData) => !inv.ewb_no)
        setEInvoices(invoicesWithoutEWB)
      } else {
        toast.error("Failed to fetch e-invoices")
      }
    } catch (error) {
      console.error("Error fetching e-invoices:", error)
      toast.error("Error fetching e-invoices")
    }
  }

  useEffect(() => {
    if (generationType === "irn") {
      fetchEInvoices()
    }
  }, [generationType])

  const handleGenerateFromIRN = async () => {
    if (!selectedIRN) {
      toast.error("Please enter IRN")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/einvoice/generate-ewaybill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          irn: selectedIRN,
          distance: formData.transDistance || 100,
          trans_mode: formData.transMode,
          vehicle_no: formData.vehicleNo,
          vehicle_type: formData.vehicleType,
          trans_id: formData.transporterId,
          trans_name: formData.transporterName,
          trans_doc_no: formData.transDocNo
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(`E-Way Bill generated successfully! Bill No: ${data.ewb_no}`)
        setEwayBillNo(data.ewb_no)
        setActiveTab("search")
        setShowIRNDialog(false)
        setSelectedIRN("")
        fetchEInvoices() // Refresh list
      } else {
        toast.error(data.error || "Failed to generate E-Way Bill from IRN")
      }
    } catch (error) {
      toast.error("An error occurred while generating E-Way Bill")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = () => {
    if (!currentItem.productName || !currentItem.hsnCode || currentItem.quantity <= 0) {
      toast.error("Please fill in all item details")
      return
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, currentItem]
    }))

    setCurrentItem({
      productName: "",
      hsnCode: "",
      quantity: 0,
      qtyUnit: "PCS",
      taxableAmount: 0,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      cessRate: 0
    })

    toast.success("Item added successfully")
  }

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
    toast.success("Item removed")
  }

  const handleGenerateEWayBill = async () => {
    if (formData.items.length === 0) {
      toast.error("Please add at least one item")
      return
    }

    if (!formData.fromGstin || !formData.toGstin) {
      toast.error("Please fill in supplier and recipient GSTIN")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/ewaybill/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`E-Way Bill generated successfully! Bill No: ${data.ewayBillNo}`)
        setEwayBillNo(data.ewayBillNo)
        setActiveTab("search")
      } else {
        toast.error(data.error || "Failed to generate E-Way Bill")
      }
    } catch (error) {
      toast.error("An error occurred while generating E-Way Bill")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchEWayBill = async () => {
    if (!ewayBillNo) {
      toast.error("Please enter E-Way Bill number")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/ewaybill/get?ewbNo=${ewayBillNo}`)
      const data = await response.json()

      if (response.ok) {
        setSearchResults([data])
        toast.success("E-Way Bill found")
      } else {
        toast.error(data.error || "E-Way Bill not found")
        setSearchResults([])
      }
    } catch (error) {
      toast.error("An error occurred while searching")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateVehicle = async (ewbNo: string, vehicleNo: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/ewaybill/update-vehicle", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ewbNo, vehicleNo }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Vehicle details updated successfully")
        handleSearchEWayBill()
      } else {
        toast.error(data.error || "Failed to update vehicle details")
      }
    } catch (error) {
      toast.error("An error occurred while updating")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEWayBill = async (ewbNo: string, cancelReason: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/ewaybill/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ewbNo, cancelRsnCode: cancelReason }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("E-Way Bill cancelled successfully")
        handleSearchEWayBill()
      } else {
        toast.error(data.error || "Failed to cancel E-Way Bill")
      }
    } catch (error) {
      toast.error("An error occurred while cancelling")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">E-Way Bill Management</h1>
            <p className="text-sm text-muted-foreground">Generate and manage E-Way Bills for GST compliance</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate">
            <Plus className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="from-irn">
            <QrCode className="h-4 w-4 mr-2" />
            From IRN
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="update">
            <Truck className="h-4 w-4 mr-2" />
            Update Vehicle
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate E-Way Bill</CardTitle>
              <CardDescription>Create a new E-Way Bill for goods transportation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Document Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Document Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplyType">Supply Type</Label>
                    <Select
                      value={formData.supplyType}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, supplyType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="O">Outward</SelectItem>
                        <SelectItem value="I">Inward</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docType">Document Type</Label>
                    <Select
                      value={formData.docType}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, docType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INV">Tax Invoice</SelectItem>
                        <SelectItem value="BIL">Bill of Supply</SelectItem>
                        <SelectItem value="CHL">Delivery Challan</SelectItem>
                        <SelectItem value="BOE">Bill of Entry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docNo">Document Number</Label>
                    <Input
                      id="docNo"
                      value={formData.docNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, docNo: e.target.value }))}
                      placeholder="Invoice/Bill No"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docDate">Document Date</Label>
                    <Input
                      id="docDate"
                      type="date"
                      value={formData.docDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, docDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Supplier Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Supplier Details (From)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromGstin">GSTIN</Label>
                    <Input
                      id="fromGstin"
                      value={formData.fromGstin}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromGstin: e.target.value }))}
                      placeholder="15 digit GSTIN"
                      maxLength={15}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromTrdName">Trade Name</Label>
                    <Input
                      id="fromTrdName"
                      value={formData.fromTrdName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromTrdName: e.target.value }))}
                      placeholder="Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromAddr1">Address Line 1</Label>
                    <Input
                      id="fromAddr1"
                      value={formData.fromAddr1}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromAddr1: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromPlace">Place</Label>
                    <Input
                      id="fromPlace"
                      value={formData.fromPlace}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromPlace: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromPincode">Pincode</Label>
                    <Input
                      id="fromPincode"
                      value={formData.fromPincode}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromPincode: e.target.value }))}
                      maxLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromStateCode">State Code</Label>
                    <Input
                      id="fromStateCode"
                      value={formData.fromStateCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromStateCode: e.target.value }))}
                      placeholder="e.g., 29 for Karnataka"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Recipient Details (To)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="toGstin">GSTIN</Label>
                    <Input
                      id="toGstin"
                      value={formData.toGstin}
                      onChange={(e) => setFormData(prev => ({ ...prev, toGstin: e.target.value }))}
                      placeholder="15 digit GSTIN"
                      maxLength={15}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toTrdName">Trade Name</Label>
                    <Input
                      id="toTrdName"
                      value={formData.toTrdName}
                      onChange={(e) => setFormData(prev => ({ ...prev, toTrdName: e.target.value }))}
                      placeholder="Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toAddr1">Address Line 1</Label>
                    <Input
                      id="toAddr1"
                      value={formData.toAddr1}
                      onChange={(e) => setFormData(prev => ({ ...prev, toAddr1: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toPlace">Place</Label>
                    <Input
                      id="toPlace"
                      value={formData.toPlace}
                      onChange={(e) => setFormData(prev => ({ ...prev, toPlace: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toPincode">Pincode</Label>
                    <Input
                      id="toPincode"
                      value={formData.toPincode}
                      onChange={(e) => setFormData(prev => ({ ...prev, toPincode: e.target.value }))}
                      maxLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toStateCode">State Code</Label>
                    <Input
                      id="toStateCode"
                      value={formData.toStateCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, toStateCode: e.target.value }))}
                      placeholder="e.g., 27 for Maharashtra"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              {/* Transport Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Transport Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="transMode">Transport Mode</Label>
                    <Select
                      value={formData.transMode}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, transMode: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Road</SelectItem>
                        <SelectItem value="2">Rail</SelectItem>
                        <SelectItem value="3">Air</SelectItem>
                        <SelectItem value="4">Ship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleNo">Vehicle Number</Label>
                    <Input
                      id="vehicleNo"
                      value={formData.vehicleNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleNo: e.target.value.toUpperCase() }))}
                      placeholder="KA01AB1234"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transDistance">Distance (km)</Label>
                    <Input
                      id="transDistance"
                      type="number"
                      value={formData.transDistance}
                      onChange={(e) => setFormData(prev => ({ ...prev, transDistance: e.target.value }))}
                      placeholder="Approx distance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transporterId">Transporter ID (Optional)</Label>
                    <Input
                      id="transporterId"
                      value={formData.transporterId}
                      onChange={(e) => setFormData(prev => ({ ...prev, transporterId: e.target.value }))}
                      placeholder="Transporter GSTIN"
                    />
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Add Items</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product Name</Label>
                    <Input
                      id="productName"
                      value={currentItem.productName}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, productName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hsnCode">HSN Code</Label>
                    <Input
                      id="hsnCode"
                      value={currentItem.hsnCode}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, hsnCode: e.target.value }))}
                      placeholder="4 or 8 digits"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={currentItem.quantity || ""}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxableAmount">Taxable Amount</Label>
                    <Input
                      id="taxableAmount"
                      type="number"
                      value={currentItem.taxableAmount || ""}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, taxableAmount: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cgstRate">CGST Rate (%)</Label>
                    <Input
                      id="cgstRate"
                      type="number"
                      value={currentItem.cgstRate || ""}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, cgstRate: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sgstRate">SGST Rate (%)</Label>
                    <Input
                      id="sgstRate"
                      type="number"
                      value={currentItem.sgstRate || ""}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, sgstRate: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="igstRate">IGST Rate (%)</Label>
                    <Input
                      id="igstRate"
                      type="number"
                      value={currentItem.igstRate || ""}
                      onChange={(e) => setCurrentItem(prev => ({ ...prev, igstRate: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <Button onClick={handleAddItem} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>

                {/* Items Table */}
                {formData.items.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>HSN</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>CGST%</TableHead>
                          <TableHead>SGST%</TableHead>
                          <TableHead>IGST%</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.hsnCode}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>₹{item.taxableAmount}</TableCell>
                            <TableCell>{item.cgstRate}%</TableCell>
                            <TableCell>{item.sgstRate}%</TableCell>
                            <TableCell>{item.igstRate}%</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleGenerateEWayBill}
                  disabled={loading || formData.items.length === 0}
                  size="lg"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {loading ? "Generating..." : "Generate E-Way Bill"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generate from IRN Tab */}
        <TabsContent value="from-irn" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate E-Way Bill from E-Invoice</CardTitle>
              <CardDescription>Create E-Way Bill using Invoice Reference Number (IRN)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* E-Invoices List */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Available E-Invoices</h3>
                <div className="flex gap-4">
                  <Button onClick={fetchEInvoices} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh List
                  </Button>
                </div>

                {einvoices.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>IRN</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead>GSTIN</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {einvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">
                              {invoice.invoice_number}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs truncate max-w-[150px] inline-block">
                                {invoice.irn.substring(0, 15)}...
                              </span>
                            </TableCell>
                            <TableCell>{invoice.buyer_name}</TableCell>
                            <TableCell>{invoice.buyer_gstin}</TableCell>
                            <TableCell>₹{invoice.total_invoice_value}</TableCell>
                            <TableCell>
                              {new Date(invoice.doc_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedIRN(invoice.irn)
                                  setShowIRNDialog(true)
                                }}
                              >
                                <Truck className="h-4 w-4 mr-1" />
                                Generate
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p>No E-Invoices available without E-Way Bill</p>
                        <p className="text-sm mt-2">
                          Generate E-Invoices first or refresh to check for new ones
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Manual IRN Entry */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Or Enter IRN Manually</h3>
                <div className="flex gap-4">
                  <Input
                    placeholder="Enter Invoice Reference Number (IRN)"
                    value={selectedIRN}
                    onChange={(e) => setSelectedIRN(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => setShowIRNDialog(true)}
                    disabled={!selectedIRN || loading}
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Enter Transport Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search E-Way Bill</CardTitle>
              <CardDescription>Find E-Way Bill details by number</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Enter E-Way Bill Number"
                  value={ewayBillNo}
                  onChange={(e) => setEwayBillNo(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSearchEWayBill} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-4 mt-6">
                  {searchResults.map((result, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium">E-Way Bill No:</p>
                            <p className="text-lg">{result.ewayBillNo}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Status:</p>
                            <Badge>{result.status}</Badge>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Generated Date:</p>
                            <p>{result.ewayBillDate}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Valid Until:</p>
                            <p>{result.validUpto}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Update Vehicle Tab */}
        <TabsContent value="update" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Update Vehicle Details</CardTitle>
              <CardDescription>Update vehicle number for existing E-Way Bill</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="updateEwbNo">E-Way Bill Number</Label>
                <Input
                  id="updateEwbNo"
                  placeholder="Enter E-Way Bill Number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newVehicleNo">New Vehicle Number</Label>
                <Input
                  id="newVehicleNo"
                  placeholder="KA01AB1234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="updateReason">Reason for Update</Label>
                <Textarea
                  id="updateReason"
                  placeholder="Enter reason for vehicle update"
                />
              </div>
              <Button disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Update Vehicle
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Important Information:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>E-Way Bill is mandatory for goods worth more than ₹50,000</li>
                <li>Valid for distance-based duration (100km = 1 day)</li>
                <li>Can be cancelled within 24 hours of generation</li>
                <li>Vehicle details can be updated during transit</li>
                <li>Keep the E-Way Bill number handy for tracking</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IRN Transport Details Dialog */}
      <Dialog open={showIRNDialog} onOpenChange={setShowIRNDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enter Transport Details</DialogTitle>
            <DialogDescription>
              Provide transport information for generating E-Way Bill from IRN
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>IRN (Invoice Reference Number)</Label>
              <Input
                value={selectedIRN}
                readOnly
                className="bg-gray-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="irnTransMode">Transport Mode</Label>
                <Select
                  value={formData.transMode}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, transMode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Road</SelectItem>
                    <SelectItem value="2">Rail</SelectItem>
                    <SelectItem value="3">Air</SelectItem>
                    <SelectItem value="4">Ship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="irnDistance">Distance (km)</Label>
                <Input
                  id="irnDistance"
                  type="number"
                  value={formData.transDistance}
                  onChange={(e) => setFormData(prev => ({ ...prev, transDistance: e.target.value }))}
                  placeholder="Enter distance"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="irnVehicleNo">Vehicle Number</Label>
                <Input
                  id="irnVehicleNo"
                  value={formData.vehicleNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleNo: e.target.value.toUpperCase() }))}
                  placeholder="KA01AB1234"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="irnVehicleType">Vehicle Type</Label>
                <Select
                  value={formData.vehicleType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, vehicleType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R">Regular</SelectItem>
                    <SelectItem value="O">Over Dimensional Cargo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="irnTransporterId">Transporter ID (Optional)</Label>
                <Input
                  id="irnTransporterId"
                  value={formData.transporterId}
                  onChange={(e) => setFormData(prev => ({ ...prev, transporterId: e.target.value }))}
                  placeholder="Transporter GSTIN"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="irnTransporterName">Transporter Name (Optional)</Label>
                <Input
                  id="irnTransporterName"
                  value={formData.transporterName}
                  onChange={(e) => setFormData(prev => ({ ...prev, transporterName: e.target.value }))}
                  placeholder="Transporter company name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="irnTransDocNo">Transport Document No (Optional)</Label>
                <Input
                  id="irnTransDocNo"
                  value={formData.transDocNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, transDocNo: e.target.value }))}
                  placeholder="LR/RR/Airway bill no"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowIRNDialog(false)
                  setSelectedIRN("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateFromIRN}
                disabled={loading || !selectedIRN || !formData.transDistance}
              >
                <Truck className="h-4 w-4 mr-2" />
                {loading ? "Generating..." : "Generate E-Way Bill"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
