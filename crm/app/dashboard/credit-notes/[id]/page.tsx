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

type CreditNote = {
  id: string
  note_number: string
  party_type: string
  party_id: string
  party_name: string
  party_phone: string
  return_no: string
  invoice_number: string | null
  invoice_date: string | null
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

type CreditNoteItem = {
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

export default function CreditNotePrintPage() {
  const params = useParams()
  const router = useRouter()
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null)
  const [items, setItems] = useState<CreditNoteItem[]>([])
  const [party, setParty] = useState<PartyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchCreditNote(params.id as string)
    }
  }, [params.id])

  const fetchCreditNote = async (id: string) => {
    try {
      const { data: noteData, error: noteError } = await supabase
        .from("credit_notes")
        .select("*")
        .eq("id", id)
        .single()

      if (noteError) throw noteError
      setCreditNote(noteData)

      const { data: itemsData, error: itemsError } = await supabase
        .from("credit_note_items")
        .select("*")
        .eq("credit_note_id", id)
        .order("created_at")

      if (itemsError) throw itemsError
      setItems(itemsData || [])

      if (noteData.party_type === "customer") {
        const { data: customerData } = await supabase
          .from("customers")
          .select("first_name, last_name, mobile_primary, address, city, state, pincode, gst_number, company_name")
          .eq("id", noteData.party_id)
          .single()

        if (customerData) {
          setParty({
            name: customerData.company_name || `${customerData.first_name} ${customerData.last_name}`.trim(),
            address: [customerData.address, customerData.city, customerData.pincode].filter(Boolean).join(", "),
            contact: customerData.mobile_primary || "",
            gstin: customerData.gst_number,
            state: customerData.state || "Maharashtra",
          })
        }
      } else {
        const { data: vendorData } = await supabase
          .from("vendors")
          .select("vendor_name, mobile_primary, address, city, state, pincode, gst_number, company_name")
          .eq("id", noteData.party_id)
          .single()

        if (vendorData) {
          setParty({
            name: vendorData.company_name || vendorData.vendor_name,
            address: [vendorData.address, vendorData.city, vendorData.pincode].filter(Boolean).join(", "),
            contact: vendorData.mobile_primary || "",
            gstin: vendorData.gst_number,
            state: vendorData.state || "Maharashtra",
          })
        }
      }
    } catch (error) {
      console.error("Error fetching credit note:", error)
      toast.error("Failed to load credit note")
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = () => {
    if (!creditNote) return

    setGenerating(true)

    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 15

      // Title
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      doc.text("Credit Note", pageWidth / 2, y, { align: "center" })
      y += 10

      // Main border box
      const boxStartY = y
      const boxHeight = 35
      doc.setDrawColor(100)
      doc.setLineWidth(0.5)
      doc.rect(10, boxStartY, pageWidth - 20, boxHeight)

      // Vertical line to split company and return info
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

      // Return No & Date (Right)
      doc.setFontSize(9)
      doc.text("Return No.", 142, y + 5)
      doc.setFont("helvetica", "bold")
      doc.text(creditNote.return_no || "1", 142, y + 10)
      doc.setFont("helvetica", "normal")
      doc.text("Date", 175, y + 5)
      doc.setFont("helvetica", "bold")
      doc.text(format(new Date(creditNote.note_date), "dd-MM-yyyy"), 175, y + 10)

      // Place of supply
      doc.setFont("helvetica", "normal")
      doc.text("Place of supply", 142, y + 18)
      doc.setFont("helvetica", "bold")
      doc.text(formatStateWithCode(creditNote.state_of_supply), 142, y + 23)

      y += boxHeight + 5

      // Party Details Box
      const partyBoxY = y
      const partyBoxHeight = 25
      doc.setDrawColor(100)
      doc.rect(10, partyBoxY, pageWidth - 20, partyBoxHeight)

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text("Return From", 12, y + 5)
      doc.setFont("helvetica", "bold")
      doc.text(party?.name || creditNote.party_name, 12, y + 10)
      doc.setFont("helvetica", "normal")
      if (party?.address) {
        doc.text(party.address, 12, y + 15)
      }
      doc.text(`Contact No. : ${party?.contact || creditNote.party_phone}`, 12, y + 20)

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

      // Add total row
      itemsTableData.push([
        "",
        "Total",
        "",
        totalQuantity.toString(),
        "",
        "",
        `Rs. ${formatINR(totalTaxableValue)}`,
        `Rs. ${formatINR(totalTax)}`,
        `Rs. ${formatINR(creditNote.total_amount)}`,
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
      const hasShipping = Number(creditNote.shipping_charges || 0) > 0
      const summaryBoxY = y
      const summaryBoxHeight = hasShipping ? 48 : 42
      doc.rect(10, summaryBoxY, pageWidth - 20, summaryBoxHeight)
      doc.line(pageWidth / 2, summaryBoxY, pageWidth / 2, summaryBoxY + summaryBoxHeight)

      // Amount in Words (Left)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text("Amount in Words", 12, y + 5)
      doc.setFont("helvetica", "bold")
      doc.text(numberToWords(creditNote.total_amount), 12, y + 10)

      if (creditNote.description) {
        doc.setFont("helvetica", "normal")
        doc.text("Description", 12, y + 18)
        doc.setFont("helvetica", "bold")
        doc.text(creditNote.description, 12, y + 23)
      }

      // Amounts Summary (Right)
      const rightX = pageWidth / 2 + 5
      doc.setFont("helvetica", "bold")
      doc.text("Amounts", rightX, y + 5)
      doc.setFont("helvetica", "normal")

      doc.text("Sub Total", rightX, y + 11)
      doc.text(`Rs. ${formatINR(creditNote.subtotal)}`, pageWidth - 12, y + 11, { align: "right" })

      doc.text("Taxable Value", rightX, y + 17)
      doc.text(`Rs. ${formatINR(totalTaxableValue)}`, pageWidth - 12, y + 17, { align: "right" })

      doc.text("GST", rightX, y + 23)
      doc.text(`Rs. ${formatINR(totalTax)}`, pageWidth - 12, y + 23, { align: "right" })

      let rowY = 29
      if (hasShipping) {
        doc.text("Shipping", rightX, y + rowY)
        doc.text(`Rs. ${formatINR(creditNote.shipping_charges || 0)}`, pageWidth - 12, y + rowY, { align: "right" })
        rowY += 6
      }

      doc.setFont("helvetica", "bold")
      doc.text("Total", rightX, y + rowY)
      doc.text(`Rs. ${formatINR(creditNote.total_amount)}`, pageWidth - 12, y + rowY, { align: "right" })
      rowY += 6

      doc.setFont("helvetica", "normal")
      doc.text("Paid", rightX, y + rowY)
      doc.text(`Rs. ${formatINR(creditNote.total_amount)}`, pageWidth - 12, y + rowY, { align: "right" })
      rowY += 6

      doc.text("Balance", rightX, y + rowY)
      doc.text("Rs. 0.00", pageWidth - 12, y + rowY, { align: "right" })

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

      y = (doc as any).lastAutoTable.finalY + 10

      // Footer
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(`For : ${COMPANY.name}`, pageWidth - 12, y, { align: "right" })

      y += 25
      doc.setFont("helvetica", "bold")
      doc.text("Authorized Signatory", pageWidth - 12, y, { align: "right" })

      // Save PDF
      doc.save(`Credit-Note-${creditNote.note_number}.pdf`)
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

  if (!creditNote) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Credit note not found</p>
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
        <h1 className="text-xl font-bold text-center mb-4">Credit Note</h1>

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
                  <p className="text-gray-600">Return No.</p>
                  <p className="font-bold">{creditNote.return_no}</p>
                </div>
                <div>
                  <p className="text-gray-600">Date</p>
                  <p className="font-bold">{format(new Date(creditNote.note_date), "dd-MM-yyyy")}</p>
                </div>
              </div>
              <div className="mt-2 text-sm">
                <p className="text-gray-600">Place of supply</p>
                <p className="font-bold">{formatStateWithCode(creditNote.state_of_supply)}</p>
              </div>
            </div>
          </div>

          {/* Party Details */}
          <div className="p-3 border-b border-gray-400">
            <p className="text-sm text-gray-600">Return From</p>
            <p className="font-bold">{party?.name || creditNote.party_name}</p>
            {party?.address && <p className="text-sm">{party.address}</p>}
            <p className="text-sm">Contact No. : {party?.contact || creditNote.party_phone}</p>
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
                <td className="border-b border-gray-400 p-2 text-right">₹ {formatINR(creditNote.total_amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words & Summary */}
          <div className="grid grid-cols-2 border-b border-gray-400">
            <div className="p-3 border-r border-gray-400">
              <p className="text-sm text-gray-600">Amount in Words</p>
              <p className="font-bold text-sm">{numberToWords(creditNote.total_amount)}</p>
              {creditNote.description && (
                <>
                  <p className="text-sm text-gray-600 mt-2">Description</p>
                  <p className="text-sm font-bold">{creditNote.description}</p>
                </>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-600 font-bold">Amounts</p>
              <div className="flex justify-between text-sm mt-1">
                <span>Sub Total</span>
                <span>₹ {formatINR(creditNote.subtotal)}</span>
              </div>
              {creditNote.discount_amount > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span>Discount</span>
                  <span>- ₹ {formatINR(creditNote.discount_amount)}</span>
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
              {Number(creditNote.shipping_charges || 0) > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span>Shipping</span>
                  <span>₹ {formatINR(creditNote.shipping_charges || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold mt-1">
                <span>Total</span>
                <span>₹ {formatINR(creditNote.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Paid</span>
                <span>₹ {formatINR(creditNote.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Balance</span>
                <span>₹ 0.00</span>
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
                <td className="border-r border-gray-400 p-2 text-right">₹ {formatINR(creditNote.subtotal - creditNote.discount_amount)}</td>
                <td className="border-r border-gray-400 p-2"></td>
                <td className="border-r border-gray-400 p-2 text-right">₹ {formatINR(totalTaxAmount)}</td>
                <td className="p-2 text-right">₹ {formatINR(totalTaxAmount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div className="p-3 text-right">
            <p className="text-sm">For : {COMPANY.name}</p>
            <div className="mt-12">
              <p className="font-bold text-sm">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
