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
import {
  FileText,
  Search,
  Plus,
  Download,
  Eye,
  XCircle,
  CheckCircle,
  AlertCircle,
  QrCode,
  Truck,
  RefreshCw,
  Copy
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface EInvoiceData {
  id?: string
  order_id?: string
  purchase_id?: string
  invoice_type: string
  invoice_number: string
  irn?: string
  ack_no?: string
  ack_dt?: string
  signed_qr_code?: string
  ewb_no?: string
  ewb_dt?: string
  ewb_valid_till?: string
  status: string
  total_invoice_value: number
  buyer_name: string
  buyer_gstin: string
  doc_date: string
}

interface OrderData {
  id: string
  order_number: string
  customer_name: string
  customer_gst_number?: string
  total_amount: number
  order_date: string
  order_status: string
  invoice_number_gst?: string
}

export default function EInvoicePage() {
  const [activeTab, setActiveTab] = useState("generate")
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<OrderData[]>([])
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null)
  const [einvoices, setEInvoices] = useState<EInvoiceData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [currentQRCode, setCurrentQRCode] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<EInvoiceData | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelRemarks, setCancelRemarks] = useState("")

  // Fetch orders that need e-invoice
  const fetchOrders = async () => {
    try {
      const response = await fetch("/api/orders/pending-einvoice")
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast.error("Failed to fetch orders")
    }
  }

  // Fetch existing e-invoices
  const fetchEInvoices = async () => {
    try {
      const response = await fetch("/api/einvoice/list")
      if (response.ok) {
        const data = await response.json()
        setEInvoices(data)
      }
    } catch (error) {
      console.error("Error fetching e-invoices:", error)
      toast.error("Failed to fetch e-invoices")
    }
  }

  useEffect(() => {
    fetchOrders()
    fetchEInvoices()
  }, [])

  const handleGenerateEInvoice = async (order: OrderData) => {
    setLoading(true)
    try {
      const response = await fetch("/api/einvoice/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
          invoice_type: "INV"
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(`E-Invoice generated successfully! IRN: ${data.irn}`)

        // Refresh lists
        fetchOrders()
        fetchEInvoices()

        // Switch to list tab
        setActiveTab("list")
      } else {
        toast.error(data.error || "Failed to generate E-Invoice")
      }
    } catch (error) {
      toast.error("An error occurred while generating E-Invoice")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateEWayBill = async (invoice: EInvoiceData) => {
    setLoading(true)
    try {
      const response = await fetch("/api/einvoice/generate-ewaybill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          irn: invoice.irn,
          distance: 100, // You might want to calculate actual distance
          trans_mode: "1",
          vehicle_no: "" // Will be updated later
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(`E-Way Bill generated! No: ${data.ewb_no}`)
        fetchEInvoices()
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

  const handleCancelEInvoice = async () => {
    if (!selectedInvoice || !cancelReason) {
      toast.error("Please select cancellation reason")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/einvoice/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          irn: selectedInvoice.irn,
          reason: cancelReason,
          remarks: cancelRemarks
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success("E-Invoice cancelled successfully")
        setShowCancelDialog(false)
        fetchEInvoices()
      } else {
        toast.error(data.error || "Failed to cancel E-Invoice")
      }
    } catch (error) {
      toast.error("An error occurred while cancelling E-Invoice")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewQRCode = (qrCode: string) => {
    setCurrentQRCode(qrCode)
    setShowQRDialog(true)
  }

  const handleCopyIRN = (irn: string) => {
    navigator.clipboard.writeText(irn)
    toast.success("IRN copied to clipboard")
  }

  const handleDownloadInvoice = async (invoice: EInvoiceData) => {
    try {
      const response = await fetch(`/api/einvoice/download/${invoice.id}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `einvoice_${invoice.invoice_number}.pdf`
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        toast.error("Failed to download invoice")
      }
    } catch (error) {
      toast.error("Error downloading invoice")
      console.error(error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return <Badge className="bg-green-100 text-green-800">Generated</Badge>
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      case 'DRAFT':
        return <Badge className="bg-gray-100 text-gray-800">Draft</Badge>
      case 'FAILED':
        return <Badge className="bg-orange-100 text-orange-800">Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const filteredEInvoices = einvoices.filter(invoice =>
    invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.buyer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.irn?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">E-Invoice Management</h1>
        <p className="text-muted-foreground">Generate and manage GST E-Invoices</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total E-Invoices</p>
                <p className="text-2xl font-bold">{einvoices.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {einvoices.filter(i => i.status === 'GENERATED').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With E-Way Bill</p>
                <p className="text-2xl font-bold">
                  {einvoices.filter(i => i.ewb_no).length}
                </p>
              </div>
              <Truck className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cancelled</p>
                <p className="text-2xl font-bold">
                  {einvoices.filter(i => i.status === 'CANCELLED').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">
            <Plus className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="list">
            <FileText className="h-4 w-4 mr-2" />
            E-Invoices
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate E-Invoice</CardTitle>
              <CardDescription>Select an order to generate E-Invoice</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="Search orders..."
                    className="flex-1"
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Button onClick={fetchOrders} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>GST Number</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{order.customer_name}</TableCell>
                          <TableCell>{order.customer_gst_number || 'N/A'}</TableCell>
                          <TableCell>₹{order.total_amount}</TableCell>
                          <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.order_status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleGenerateEInvoice(order)}
                              disabled={loading || !order.customer_gst_number}
                            >
                              Generate E-Invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>E-Invoices List</CardTitle>
              <CardDescription>View and manage generated E-Invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="Search by invoice number, IRN, or buyer name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No</TableHead>
                        <TableHead>IRN</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>E-Way Bill</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-xs truncate max-w-[100px]">
                                {invoice.irn ? `${invoice.irn.substring(0, 8)}...` : 'N/A'}
                              </span>
                              {invoice.irn && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyIRN(invoice.irn!)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{invoice.buyer_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {invoice.buyer_gstin}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>₹{invoice.total_invoice_value}</TableCell>
                          <TableCell>{new Date(invoice.doc_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {invoice.ewb_no ? (
                              <Badge className="bg-purple-100 text-purple-800">
                                {invoice.ewb_no}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateEWayBill(invoice)}
                                disabled={invoice.status !== 'GENERATED'}
                              >
                                <Truck className="h-3 w-3 mr-1" />
                                Generate
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {invoice.signed_qr_code && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewQRCode(invoice.signed_qr_code!)}
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadInvoice(invoice)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {invoice.status === 'GENERATED' && !invoice.ewb_no && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => {
                                    setSelectedInvoice(invoice)
                                    setShowCancelDialog(true)
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search E-Invoice</CardTitle>
              <CardDescription>Search for E-Invoice by IRN or Invoice Number</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="searchIRN">Enter IRN or Invoice Number</Label>
                <div className="flex gap-4">
                  <Input
                    id="searchIRN"
                    placeholder="Enter IRN or Invoice Number"
                    className="flex-1"
                  />
                  <Button disabled={loading}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>E-Invoice QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to verify the e-invoice
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4">
            <div className="bg-white p-4 rounded-lg">
              <img
                src={`data:image/png;base64,${currentQRCode}`}
                alt="QR Code"
                className="w-64 h-64"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel E-Invoice</DialogTitle>
            <DialogDescription>
              Please select a reason for cancellation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancelReason">Cancellation Reason</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Duplicate</SelectItem>
                  <SelectItem value="2">Data Entry Mistake</SelectItem>
                  <SelectItem value="3">Order Cancelled</SelectItem>
                  <SelectItem value="4">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancelRemarks">Remarks (Optional)</Label>
              <Textarea
                id="cancelRemarks"
                value={cancelRemarks}
                onChange={(e) => setCancelRemarks(e.target.value)}
                placeholder="Additional remarks..."
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelEInvoice}
                disabled={!cancelReason || loading}
              >
                Cancel E-Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> E-Invoices once generated cannot be modified.
          They can only be cancelled within 24 hours of generation.
          E-Way Bill can be generated along with E-Invoice or separately using the IRN.
        </AlertDescription>
      </Alert>
    </div>
  )
}