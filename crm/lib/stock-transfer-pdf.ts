import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export type StockTransferData = {
  transferNumber: string
  fromWarehouse: {
    name: string
    code: string
    city?: string
    state?: string
  }
  toWarehouse: {
    name: string
    code: string
    city?: string
    state?: string
  }
  status: string
  requestedDate: string
  requestedBy?: string
  shippedDate?: string
  completedDate?: string
  expectedDeliveryDate?: string
  transferReason?: string
  isUrgent: boolean
  items: {
    productName: string
    variantOrBrand?: string
    quantity: number
  }[]
  vehicleNumber?: string
  driverName?: string
  driverPhone?: string
  notes?: string
}

export function generateStockTransferPDF(data: StockTransferData) {
  const doc = new jsPDF()

  // Title
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("STOCK TRANSFER CHALLAN", 105, 15, { align: "center" })

  // Add urgent badge if applicable
  if (data.isUrgent) {
    doc.setFontSize(10)
    doc.setTextColor(220, 38, 38)
    doc.text("[ URGENT ]", 105, 22, { align: "center" })
    doc.setTextColor(0, 0, 0)
  }

  // Transfer Number and Status
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(`Transfer #: ${data.transferNumber}`, 14, 32)

  const statusText = data.status.toUpperCase().replace("_", " ")
  doc.setFont("helvetica", "normal")
  doc.text(`Status: ${statusText}`, 14, 38)

  // Date information on the right
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  const rightX = 140
  doc.text(`Requested Date:`, rightX, 32)
  doc.setFont("helvetica", "bold")
  doc.text(new Date(data.requestedDate).toLocaleDateString(), rightX + 35, 32)

  if (data.shippedDate) {
    doc.setFont("helvetica", "normal")
    doc.text(`Shipped Date:`, rightX, 38)
    doc.setFont("helvetica", "bold")
    doc.text(new Date(data.shippedDate).toLocaleDateString(), rightX + 35, 38)
  }

  // Separator line
  doc.setLineWidth(0.5)
  doc.line(14, 43, 196, 43)

  // From and To Warehouse Section
  let yPos = 50

  // From Warehouse (Left)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("FROM WAREHOUSE", 14, yPos)

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text(data.fromWarehouse.name, 14, yPos + 6)

  doc.setFont("helvetica", "normal")
  doc.text(`Code: ${data.fromWarehouse.code}`, 14, yPos + 11)

  if (data.fromWarehouse.city && data.fromWarehouse.state) {
    doc.text(`${data.fromWarehouse.city}, ${data.fromWarehouse.state}`, 14, yPos + 16)
  }

  // To Warehouse (Right)
  const toX = 110
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("TO WAREHOUSE", toX, yPos)

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text(data.toWarehouse.name, toX, yPos + 6)

  doc.setFont("helvetica", "normal")
  doc.text(`Code: ${data.toWarehouse.code}`, toX, yPos + 11)

  if (data.toWarehouse.city && data.toWarehouse.state) {
    doc.text(`${data.toWarehouse.city}, ${data.toWarehouse.state}`, toX, yPos + 16)
  }

  yPos += 22

  // Separator line
  doc.setLineWidth(0.3)
  doc.line(14, yPos, 196, yPos)

  yPos += 6

  // Transfer Reason (if available)
  if (data.transferReason) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text("Transfer Reason:", 14, yPos)
    doc.setFont("helvetica", "normal")
    const reasonLines = doc.splitTextToSize(data.transferReason, 170)
    doc.text(reasonLines, 14, yPos + 5)
    yPos += 5 + (reasonLines.length * 4)
  }

  // Items Table
  yPos += 3
  const tableData: any[] = data.items.map(item => [
    item.productName,
    item.variantOrBrand || "—",
    item.quantity.toString()
  ])

  // Add total row
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0)
  tableData.push([
    { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold", halign: "right" } },
    { content: totalQty.toString(), styles: { fontStyle: "bold" } }
  ] as any)

  autoTable(doc, {
    startY: yPos,
    head: [["Product Name", "Variant/Brand", "Quantity"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 10
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 60 },
      2: { cellWidth: 30, halign: "center", fontStyle: "bold" }
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    didParseCell: (hookData) => {
      // Style the total row
      if (hookData.section === "body" && hookData.row.index === tableData.length - 1) {
        hookData.cell.styles.fillColor = [240, 240, 240]
      }
    }
  })

  // Get the final Y position after the table
  yPos = (doc as any).lastAutoTable.finalY + 10

  // Transport Details (if available)
  if (data.vehicleNumber || data.driverName || data.driverPhone) {
    doc.setLineWidth(0.3)
    doc.line(14, yPos, 196, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("TRANSPORT DETAILS", 14, yPos)
    yPos += 6

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")

    if (data.vehicleNumber) {
      doc.text(`Vehicle Number: ${data.vehicleNumber}`, 14, yPos)
      yPos += 5
    }
    if (data.driverName) {
      doc.text(`Driver Name: ${data.driverName}`, 14, yPos)
      yPos += 5
    }
    if (data.driverPhone) {
      doc.text(`Driver Phone: ${data.driverPhone}`, 14, yPos)
      yPos += 5
    }
    yPos += 2
  }

  // Additional Notes (if available)
  if (data.notes) {
    doc.setLineWidth(0.3)
    doc.line(14, yPos, 196, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("NOTES", 14, yPos)
    yPos += 6

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    const notesLines = doc.splitTextToSize(data.notes, 180)
    doc.text(notesLines, 14, yPos)
    yPos += notesLines.length * 5 + 5
  }

  // Signatures Section at bottom
  const bottomY = doc.internal.pageSize.getHeight() - 50

  // Use the lower of current yPos or calculated bottom position
  const signatureY = Math.max(yPos + 10, bottomY)

  doc.setLineWidth(0.3)
  doc.line(14, signatureY, 196, signatureY)

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("AUTHORIZED SIGNATURES", 105, signatureY + 7, { align: "center" })

  // Sent By (Left)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text("Sent By (From Warehouse):", 14, signatureY + 15)
  doc.line(14, signatureY + 30, 90, signatureY + 30) // Signature line

  if (data.requestedBy) {
    doc.setFontSize(7)
    doc.text(`Requested by: ${data.requestedBy}`, 14, signatureY + 33)
  }

  // Received By (Right)
  doc.setFontSize(9)
  doc.text("Received By (To Warehouse):", 120, signatureY + 15)
  doc.line(120, signatureY + 30, 196, signatureY + 30) // Signature line

  if (data.completedDate) {
    doc.setFontSize(7)
    doc.text(`Date: ${new Date(data.completedDate).toLocaleDateString()}`, 120, signatureY + 33)
  }

  // Footer
  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.text(
    "This is a computer-generated document and requires authorized signatures to be valid.",
    105,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  )

  // Generate filename
  const filename = `stock-transfer-${data.transferNumber.replace(/\//g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`

  // Save the PDF
  doc.save(filename)
}
