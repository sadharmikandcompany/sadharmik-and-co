"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ArrowLeft, Download, Loader2 } from "lucide-react"
import { numberToWords, formatStateWithCode, formatINR } from "@/lib/number-to-words"
import { format } from "date-fns"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import QRCode from "qrcode"

// Company details
const COMPANY = {
  name: "Kalapurna Private Limited",
  address: "Plot No. 20 Survey No. 495 Bhuj Nagor Road Bhuj",
  phone: "8097474222",
  email: "info@kalapurna.com",
  gstin: "24AALCK8835H1Z6",
  state: "Gujarat",
  bankName: "Saraswat Bank",
  accountNo: "610000000056857",
  ifscCode: "SRCB0000471",
}

type DebitNote = {
  id: string
  note_number: string
  party_type: string
  party_id: string
  party_name: string
  party_phone: string
  return_no: string
  bill_number: string | null
  bill_date: string | null
  note_date: string
  state_of_supply: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  shipping_charges: number | null
  round_off: number
  total_amount: number
  description: string | null
  status: string
}

type DebitNoteItem = {
  id: string
  item_name: string
  hsn_code: string
  description: string | null
  quantity: number
  unit: string
  price_per_unit: number
  discount_percent: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  amount: number
}

type PartyDetails = {
  name: string
  address: string
  contact: string
  gstin: string | null
  state: string
}

export default function DebitNotePrintPage() {
  const params = useParams()
  const router = useRouter()
  const [debitNote, setDebitNote] = useState<DebitNote | null>(null)
  const [items, setItems] = useState<DebitNoteItem[]>([])
  const [party, setParty] = useState<PartyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null)
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchDebitNote(params.id as string)
    }
  }, [params.id])

  const fetchDebitNote = async (id: string) => {
    try {
      const { data: noteData, error: noteError } = await supabase
        .from("debit_notes")
        .select("*")
        .eq("id", id)
        .single()

      if (noteError) throw noteError
      setDebitNote(noteData)

      const { data: itemsData, error: itemsError } = await supabase
        .from("debit_note_items")
        .select("*")
        .eq("debit_note_id", id)
        .order("created_at")

      if (itemsError) throw itemsError
      setItems(itemsData || [])

      let partyDetails: PartyDetails | null = null

      if (noteData.party_type === "customer") {
        const { data: customerData } = await supabase
          .from("customers")
          .select("first_name, last_name, mobile_primary, address, city, state, pincode, gst_number, company_name")
          .eq("id", noteData.party_id)
          .single()

        if (customerData) {
          partyDetails = {
            name: customerData.company_name || `${customerData.first_name} ${customerData.last_name}`.trim(),
            address: [customerData.address, customerData.city, customerData.pincode].filter(Boolean).join(", "),
            contact: customerData.mobile_primary || "",
            gstin: customerData.gst_number,
            state: customerData.state || "Maharashtra",
          }
          setParty(partyDetails)
        }
      } else {
        const { data: vendorData } = await supabase
          .from("vendors")
          .select("vendor_name, mobile_primary, address, city, state, pincode, gst_number, company_name")
          .eq("id", noteData.party_id)
          .single()

        if (vendorData) {
          partyDetails = {
            name: vendorData.company_name || vendorData.vendor_name,
            address: [vendorData.address, vendorData.city, vendorData.pincode].filter(Boolean).join(", "),
            contact: vendorData.mobile_primary || "",
            gstin: vendorData.gst_number,
            state: vendorData.state || "Maharashtra",
          }
          setParty(partyDetails)
        }
      }

      // Generate payment QR code
      generatePaymentQR(noteData, partyDetails)
    } catch (error) {
      console.error("Error fetching debit note:", error)
      toast.error("Failed to load debit note")
    } finally {
      setLoading(false)
    }
  }

  // Generate payment QR code
  const generatePaymentQR = async (note: DebitNote, partyDetails: PartyDetails | null) => {
    try {
      // Only generate if balance > 0
      if (note.total_amount <= 0) return

      const response = await fetch("/api/easebuzz/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: note.id,
          orderNumber: note.note_number,
          amount: note.total_amount,
          customerName: partyDetails?.name || note.party_name,
          customerPhone: note.party_phone,
          productInfo: `Debit Note ${note.note_number}`,
        }),
      })

      const result = await response.json()
      if (result.success && result.paymentUrl) {
        setPaymentQrUrl(result.paymentUrl)
        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(result.paymentUrl, {
          width: 150,
          margin: 1,
          errorCorrectionLevel: "M",
        })
        setPaymentQrDataUrl(qrDataUrl)
      }
    } catch (error) {
      console.error("Error generating payment QR:", error)
    }
  }

  const generatePDF = async () => {
    if (!debitNote) return

    setGenerating(true)

    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 15

      // Title
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      doc.text("Debit Note", pageWidth / 2, y, { align: "center" })
      y += 10

      // Main border box
      const boxStartY = y
      const boxHeight = 35
      doc.setDrawColor(100)
      doc.setLineWidth(0.5)
      doc.rect(10, boxStartY, pageWidth - 20, boxHeight)

      // Vertical line to split company and date info
      doc.line(140, boxStartY, 140, boxStartY + boxHeight)

      // Company Details (Left)
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(COMPANY.name, 12, y + 5)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text(COMPANY.address, 12, y + 10)
      doc.text(`Phone no.: ${COMPANY.phone}`, 12, y + 15)
      doc.text(`Email: ${COMPANY.email}`, 12, y + 20)
      doc.text(`GSTIN: ${COMPANY.gstin}`, 12, y + 25)
      doc.text(`State: ${formatStateWithCode(COMPANY.state)}`, 12, y + 30)

      // Date & Place of supply (Right)
      doc.setFontSize(9)
      doc.text("Date", 142, y + 5)
      doc.setFont("helvetica", "bold")
      doc.text(format(new Date(debitNote.note_date), "dd-MM-yyyy"), 142, y + 10)

      doc.setFont("helvetica", "normal")
      doc.text("Place of supply", 175, y + 5)
      doc.setFont("helvetica", "bold")
      doc.text(formatStateWithCode(debitNote.state_of_supply), 165, y + 10)

      y += boxHeight + 5

      // Party Details Box
      const partyBoxY = y
      const partyBoxHeight = 22
      doc.setDrawColor(100)
      doc.rect(10, partyBoxY, pageWidth - 20, partyBoxHeight)

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text("Return To", 12, y + 5)
      doc.setFont("helvetica", "bold")
      doc.text(party?.name || debitNote.party_name, 12, y + 10)
      doc.setFont("helvetica", "normal")
      if (party?.address) {
        doc.text(party.address, 12, y + 15)
      }

      // Right side party info
      if (party?.gstin) {
        doc.text(`GSTIN : ${party.gstin}`, 120, y + 10)
      }
      doc.text(`State: ${formatStateWithCode(party?.state || "Maharashtra")}`, 120, y + 15)

      y += partyBoxHeight + 2

      // Items Table
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
      const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0)

      const totalTaxableValue = items.reduce(
        (sum, item) => sum + (item.quantity * item.price_per_unit - item.discount_amount),
        0
      )

      const itemsTableData = items.map((item, index) => [
        (index + 1).toString(),
        item.item_name,
        item.hsn_code || "",
        item.quantity.toString(),
        item.unit,
        `Rs. ${formatINR(item.price_per_unit)}`,
        `Rs. ${formatINR(item.quantity * item.price_per_unit - item.discount_amount)}`,
        `Rs. ${formatINR(item.tax_amount)}\n(${item.tax_percent}%)`,
        `Rs. ${formatINR(item.amount)}`,
      ])

      itemsTableData.push([
        "",
        "Total",
        "",
        totalQuantity.toString(),
        "",
        "",
        `Rs. ${formatINR(totalTaxableValue)}`,
        `Rs. ${formatINR(totalTax)}`,
        `Rs. ${formatINR(debitNote.total_amount)}`,
      ])

      autoTable(doc, {
        startY: y,
        head: [["#", "Item name", "HSN/SAC", "Qty", "Unit", "Price/Unit", "Taxable Value", "GST", "Amount"]],
        body: itemsTableData,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 42 },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 12, halign: "center" },
          4: { cellWidth: 12, halign: "center" },
          5: { cellWidth: 22, halign: "right" },
          6: { cellWidth: 24, halign: "right" },
          7: { cellWidth: 22, halign: "right" },
          8: { cellWidth: 25, halign: "right" },
        },
        margin: { left: 10, right: 10 },
      })

      y = (doc as any).lastAutoTable.finalY + 2

      // Amount in Words and Amounts Summary Box
      const hasShipping = Number(debitNote.shipping_charges || 0) > 0
      const summaryBoxY = y
      const summaryBoxHeight = hasShipping ? 46 : 40
      doc.rect(10, summaryBoxY, pageWidth - 20, summaryBoxHeight)
      doc.line(pageWidth / 2, summaryBoxY, pageWidth / 2, summaryBoxY + summaryBoxHeight)

      // Amount in Words (Left)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text("Amount in Words", 12, y + 5)
      doc.setFont("helvetica", "bold")
      doc.text(numberToWords(debitNote.total_amount), 12, y + 10)

      // Amounts Summary (Right)
      const rightX = pageWidth / 2 + 5
      doc.setFont("helvetica", "bold")
      doc.text("Amounts", rightX, y + 5)
      doc.setFont("helvetica", "normal")

      doc.text("Sub Total", rightX, y + 11)
      doc.text(`Rs. ${formatINR(debitNote.subtotal)}`, pageWidth - 12, y + 11, { align: "right" })

      doc.text("Taxable Value", rightX, y + 17)
      doc.text(`Rs. ${formatINR(totalTaxableValue)}`, pageWidth - 12, y + 17, { align: "right" })

      doc.text("GST", rightX, y + 23)
      doc.text(`Rs. ${formatINR(totalTax)}`, pageWidth - 12, y + 23, { align: "right" })

      let rowY = 29
      if (hasShipping) {
        doc.text("Shipping", rightX, y + rowY)
        doc.text(`Rs. ${formatINR(debitNote.shipping_charges || 0)}`, pageWidth - 12, y + rowY, { align: "right" })
        rowY += 6
      }

      doc.setFont("helvetica", "bold")
      doc.text("Total", rightX, y + rowY)
      doc.text(`Rs. ${formatINR(debitNote.total_amount)}`, pageWidth - 12, y + rowY, { align: "right" })
      rowY += 6

      doc.setFont("helvetica", "normal")
      doc.text("Received", rightX, y + rowY)
      doc.text("Rs. 0.00", pageWidth - 12, y + rowY, { align: "right" })
      rowY += 6

      doc.text("Balance", rightX, y + rowY)
      doc.text(`Rs. ${formatINR(debitNote.total_amount)}`, pageWidth - 12, y + rowY, { align: "right" })

      y += summaryBoxHeight + 2

      // Tax Breakdown Table
      const taxBreakdown: Record<string, { taxable: number; rate: number; igst: number }> = {}
      items.forEach((item) => {
        const hsn = item.hsn_code || "N/A"
        const taxableAmount = (item.quantity * item.price_per_unit) - item.discount_amount
        if (!taxBreakdown[hsn]) {
          taxBreakdown[hsn] = { taxable: 0, rate: item.tax_percent, igst: 0 }
        }
        taxBreakdown[hsn].taxable += taxableAmount
        taxBreakdown[hsn].igst += item.tax_amount
      })

      const taxTableData = Object.entries(taxBreakdown).map(([hsn, data]) => [
        hsn,
        `Rs. ${formatINR(data.taxable)}`,
        `${data.rate}%`,
        `Rs. ${formatINR(data.igst)}`,
        `Rs. ${formatINR(data.igst)}`,
      ])

      const totalTaxable = Object.values(taxBreakdown).reduce((sum, d) => sum + d.taxable, 0)
      taxTableData.push([
        "Total",
        `Rs. ${formatINR(totalTaxable)}`,
        "",
        `Rs. ${formatINR(totalTax)}`,
        `Rs. ${formatINR(totalTax)}`,
      ])

      autoTable(doc, {
        startY: y,
        head: [["HSN/SAC", "Taxable amount", "IGST Rate", "IGST Amount", "Total Tax Amount"]],
        body: taxTableData,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 40, halign: "right" },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 35, halign: "right" },
          4: { cellWidth: 40, halign: "right" },
        },
        margin: { left: 10, right: 10 },
      })

      y = (doc as any).lastAutoTable.finalY + 5

      // Bank Details & Footer with QR Code
      const footerBoxY = y
      const footerBoxHeight = paymentQrDataUrl ? 50 : 35
      doc.rect(10, footerBoxY, pageWidth - 20, footerBoxHeight)
      doc.line(pageWidth / 2, footerBoxY, pageWidth / 2, footerBoxY + footerBoxHeight)

      // Bank Details (Left)
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.text("Bank Details", 12, y + 5)
      doc.setFont("helvetica", "normal")
      doc.text(`Name : ${COMPANY.bankName}`, 12, y + 11)
      doc.text(`Account No. : ${COMPANY.accountNo}`, 12, y + 17)
      doc.text(`IFSC code : ${COMPANY.ifscCode}`, 12, y + 23)

      // Payment QR Code (if available)
      if (paymentQrDataUrl) {
        doc.setFont("helvetica", "bold")
        doc.text("Scan to Pay", 12, y + 30)
        doc.addImage(paymentQrDataUrl, "PNG", 12, y + 32, 35, 35)
      }

      // Authorized Signatory (Right)
      doc.setFont("helvetica", "normal")
      doc.text(`For : ${COMPANY.name}`, pageWidth - 12, y + 8, { align: "right" })

      doc.setFont("helvetica", "bold")
      doc.text("Authorized Signatory", pageWidth - 12, y + footerBoxHeight - 5, { align: "right" })

      // Save PDF
      doc.save(`Debit-Note-${debitNote.note_number}.pdf`)
      toast.success("PDF downloaded successfully")
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (!debitNote) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Debit note not found</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalTaxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0)
  const totalTaxableValue = items.reduce(
    (sum, item) => sum + (item.quantity * item.price_per_unit - item.discount_amount),
    0
  )

  // Tax breakdown for display
  const taxBreakdown: Record<string, { taxable: number; rate: number; igst: number }> = {}
  items.forEach((item) => {
    const hsn = item.hsn_code || "N/A"
    const taxableAmount = (item.quantity * item.price_per_unit) - item.discount_amount
    if (!taxBreakdown[hsn]) {
      taxBreakdown[hsn] = { taxable: 0, rate: item.tax_percent, igst: 0 }
    }
    taxBreakdown[hsn].taxable += taxableAmount
    taxBreakdown[hsn].igst += item.tax_amount
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={generatePDF} disabled={generating}>
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {generating ? "Generating..." : "Download PDF"}
        </Button>
      </div>

      {/* Preview */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        {/* Title */}
        <h1 className="text-xl font-bold text-center mb-4">Debit Note</h1>

        {/* Main Container */}
        <div className="border border-gray-400">
          {/* Header Row */}
          <div className="grid grid-cols-3 border-b border-gray-400">
            <div className="col-span-2 p-3 border-r border-gray-400">
              <h2 className="font-bold text-lg">{COMPANY.name}</h2>
              <p className="text-sm">{COMPANY.address}</p>
              <p className="text-sm">Phone no.: {COMPANY.phone}</p>
              <p className="text-sm">Email: {COMPANY.email}</p>
              <p className="text-sm">GSTIN: {COMPANY.gstin}</p>
              <p className="text-sm">State: {formatStateWithCode(COMPANY.state)}</p>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Date</p>
                  <p className="font-bold">{format(new Date(debitNote.note_date), "dd-MM-yyyy")}</p>
                </div>
                <div>
                  <p className="text-gray-600">Place of supply</p>
                  <p className="font-bold">{formatStateWithCode(debitNote.state_of_supply)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Party Details */}
          <div className="p-3 border-b border-gray-400">
            <p className="text-sm text-gray-600">Return To</p>
            <p className="font-bold">{party?.name || debitNote.party_name}</p>
            {party?.address && <p className="text-sm">{party.address}</p>}
            {party?.gstin && <p className="text-sm">GSTIN : {party.gstin}</p>}
            <p className="text-sm">State: {formatStateWithCode(party?.state || "Maharashtra")}</p>
          </div>

          {/* Items Table */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-r border-gray-400 p-2 text-left w-8">#</th>
                <th className="border-b border-r border-gray-400 p-2 text-left">Item name</th>
                <th className="border-b border-r border-gray-400 p-2 text-left w-20">HSN/SAC</th>
                <th className="border-b border-r border-gray-400 p-2 text-center w-16">Qty</th>
                <th className="border-b border-r border-gray-400 p-2 text-center w-12">Unit</th>
                <th className="border-b border-r border-gray-400 p-2 text-right w-24">Price/Unit</th>
                <th className="border-b border-r border-gray-400 p-2 text-right w-24">Taxable Value</th>
                <th className="border-b border-r border-gray-400 p-2 text-right w-20">GST</th>
                <th className="border-b border-gray-400 p-2 text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border-b border-r border-gray-400 p-2">{index + 1}</td>
                  <td className="border-b border-r border-gray-400 p-2">{item.item_name}</td>
                  <td className="border-b border-r border-gray-400 p-2">{item.hsn_code}</td>
                  <td className="border-b border-r border-gray-400 p-2 text-center">{item.quantity}</td>
                  <td className="border-b border-r border-gray-400 p-2 text-center">{item.unit}</td>
                  <td className="border-b border-r border-gray-400 p-2 text-right">₹ {formatINR(item.price_per_unit)}</td>
                  <td className="border-b border-r border-gray-400 p-2 text-right">
                    ₹ {formatINR(item.quantity * item.price_per_unit - item.discount_amount)}
                  </td>
                  <td className="border-b border-r border-gray-400 p-2 text-right">
                    <div>₹ {formatINR(item.tax_amount)}</div>
                    <div className="text-xs text-gray-500">({item.tax_percent}%)</div>
                  </td>
                  <td className="border-b border-gray-400 p-2 text-right">₹ {formatINR(item.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border-b border-r border-gray-400 p-2"></td>
                <td className="border-b border-r border-gray-400 p-2">Total</td>
                <td className="border-b border-r border-gray-400 p-2"></td>
                <td className="border-b border-r border-gray-400 p-2 text-center">{totalQuantity}</td>
                <td className="border-b border-r border-gray-400 p-2"></td>
                <td className="border-b border-r border-gray-400 p-2"></td>
                <td className="border-b border-r border-gray-400 p-2 text-right">₹ {formatINR(totalTaxableValue)}</td>
                <td className="border-b border-r border-gray-400 p-2 text-right">₹ {formatINR(totalTaxAmount)}</td>
                <td className="border-b border-gray-400 p-2 text-right">₹ {formatINR(debitNote.total_amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words & Summary */}
          <div className="grid grid-cols-2 border-b border-gray-400">
            <div className="p-3 border-r border-gray-400">
              <p className="text-sm text-gray-600">Amount in Words</p>
              <p className="font-bold text-sm">{numberToWords(debitNote.total_amount)}</p>
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-600 font-bold">Amounts</p>
              <div className="flex justify-between text-sm mt-1">
                <span>Sub Total</span>
                <span>₹ {formatINR(debitNote.subtotal)}</span>
              </div>
              {debitNote.discount_amount > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span>Discount</span>
                  <span>- ₹ {formatINR(debitNote.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm mt-1">
                <span>Taxable Value</span>
                <span>₹ {formatINR(totalTaxableValue)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>GST</span>
                <span>₹ {formatINR(totalTaxAmount)}</span>
              </div>
              {Number(debitNote.shipping_charges || 0) > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span>Shipping</span>
                  <span>₹ {formatINR(debitNote.shipping_charges || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold mt-1">
                <span>Total</span>
                <span>₹ {formatINR(debitNote.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Received</span>
                <span>₹ 0.00</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Balance</span>
                <span>₹ {formatINR(debitNote.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Tax Breakdown Table */}
          <table className="w-full text-sm border-collapse border-b border-gray-400">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-r border-gray-400 p-2 text-left">HSN/SAC</th>
                <th className="border-b border-r border-gray-400 p-2 text-right">Taxable amount</th>
                <th className="border-b border-r border-gray-400 p-2 text-center">IGST Rate</th>
                <th className="border-b border-r border-gray-400 p-2 text-right">IGST Amount</th>
                <th className="border-b border-gray-400 p-2 text-right">Total Tax Amount</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(taxBreakdown).map(([hsn, data]) => (
                <tr key={hsn}>
                  <td className="border-b border-r border-gray-400 p-2">{hsn}</td>
                  <td className="border-b border-r border-gray-400 p-2 text-right">₹ {formatINR(data.taxable)}</td>
                  <td className="border-b border-r border-gray-400 p-2 text-center">{data.rate}%</td>
                  <td className="border-b border-r border-gray-400 p-2 text-right">₹ {formatINR(data.igst)}</td>
                  <td className="border-b border-gray-400 p-2 text-right">₹ {formatINR(data.igst)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border-r border-gray-400 p-2">Total</td>
                <td className="border-r border-gray-400 p-2 text-right">₹ {formatINR(debitNote.subtotal - debitNote.discount_amount)}</td>
                <td className="border-r border-gray-400 p-2"></td>
                <td className="border-r border-gray-400 p-2 text-right">₹ {formatINR(totalTaxAmount)}</td>
                <td className="p-2 text-right">₹ {formatINR(totalTaxAmount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Bank Details & Footer */}
          <div className="grid grid-cols-2">
            <div className="p-3 border-r border-gray-400">
              <p className="font-bold text-sm border-b border-gray-300 pb-1 mb-2">Bank Details</p>
              <p className="text-sm">Name : {COMPANY.bankName}</p>
              <p className="text-sm">Account No. : {COMPANY.accountNo}</p>
              <p className="text-sm">IFSC code : {COMPANY.ifscCode}</p>

              {/* Payment QR Code */}
              {paymentQrDataUrl && (
                <div className="mt-4">
                  <p className="font-bold text-sm mb-2">Scan to Pay</p>
                  <img src={paymentQrDataUrl} alt="Payment QR" className="w-24 h-24" />
                  {paymentQrUrl && (
                    <a
                      href={paymentQrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 block"
                    >
                      Click to pay online
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 text-right">
              <p className="text-sm">For : {COMPANY.name}</p>
              <div className="mt-12">
                <p className="font-bold text-sm">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
