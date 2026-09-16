import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export type DeliveryRouteData = {
  routeName: string
  partnerName: string
  partnerPhone: string
  assignmentDate: string
  orders: {
    sequenceNumber: number
    orderNumber: string
    invoiceNumber?: string
    customerName: string
    customerVipNumber?: string
    customerPhone: string
    customerPhoneSecondary1?: string
    customerPhoneSecondary2?: string
    amount: number
    address: {
      fullAddress?: string
      buildingName?: string
      streetArea?: string
      landmark?: string
      city?: string
      state?: string
      pincode?: string
    }
    items: {
      product_name: string
      quantity: number
    }[]
  }[]
}

// Helper function to mask last 3 digits of order number
function maskOrderNumber(orderNumber: string): string {
  if (orderNumber.length <= 3) {
    return "***"
  }
  return orderNumber.slice(0, -3) + "***"
}

export function generateDeliveryRoutePDF(data: DeliveryRouteData) {
  const doc = new jsPDF()

  // Add route information (without title) on left
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(`Route: ${data.routeName}`, 8, 12)
  doc.text(`Delivery Partner: ${data.partnerName} | Phone: ${data.partnerPhone}`, 8, 18)
  doc.text(`Assignment Date: ${data.assignmentDate}`, 8, 24)
  doc.text(`Total Orders: ${data.orders.length}`, 8, 30)

  // Calculate total items across all orders
  const totalItems = data.orders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
  }, 0)
  doc.text(`Total Items: ${totalItems}`, 8, 36)

  // Add signature fields on the right
  const rightX = 130
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")

  // Delivery Partner Signature
  doc.text("Delivery Partner:", rightX, 12)
  doc.line(rightX, 18, rightX + 70, 18) // Signature line

  // Received/Verified By
  doc.text("Received/Verified By:", rightX, 26)
  doc.line(rightX, 32, rightX + 70, 32) // Signature line

  // Add a line separator
  doc.setLineWidth(0.5)
  doc.line(8, 40, 202, 40)

  // Prepare table data with product details as sub-rows
  const tableData: any[] = []

  data.orders.forEach((order) => {
    let fullAddress: string

    // Use shipping_full_address if available, otherwise build from parts
    if (order.address.fullAddress && order.address.fullAddress.trim() !== '' && order.address.fullAddress !== 'N/A') {
      fullAddress = order.address.fullAddress
    } else {
      const addressParts: string[] = []

      if (order.address.buildingName && order.address.buildingName !== 'N/A') {
        addressParts.push(order.address.buildingName)
      }
      if (order.address.streetArea && order.address.streetArea !== 'N/A') {
        addressParts.push(order.address.streetArea)
      }
      if (order.address.landmark && order.address.landmark !== 'N/A') {
        addressParts.push(`Near ${order.address.landmark}`)
      }

      const addressLine1 = addressParts.join(", ")
      const addressLine2 = `${order.address.city}, ${order.address.state} - ${order.address.pincode}`
      fullAddress = addressLine1 ? `${addressLine1}\n${addressLine2}` : addressLine2
    }

    // Build phone numbers display with all available numbers
    const phoneNumbers = [order.customerPhone]
    if (order.customerPhoneSecondary1) {
      phoneNumbers.push(order.customerPhoneSecondary1)
    }
    if (order.customerPhoneSecondary2) {
      phoneNumbers.push(order.customerPhoneSecondary2)
    }
    const phoneDisplay = phoneNumbers.filter(Boolean).join("\n")

    // Build customer name with VIP number if available
    const customerNameDisplay = order.customerVipNumber
      ? `${order.customerName} (${order.customerVipNumber})`
      : order.customerName

    // Build order number display with invoice number
    const orderNumberDisplay = order.invoiceNumber && order.invoiceNumber !== "-"
      ? `${maskOrderNumber(order.orderNumber)}\nInv: ${order.invoiceNumber}`
      : maskOrderNumber(order.orderNumber)

    // Add main order row
    tableData.push([
      order.sequenceNumber.toString(),
      orderNumberDisplay,
      customerNameDisplay,
      phoneDisplay,
      `Rs. ${order.amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
      fullAddress,
    ])

    // Add product details and signature row
    if (order.items.length > 0) {
      const productDetails = order.items.map(item =>
        `${item.product_name} (${item.quantity})`
      ).join("\n")

      const paymentCheckboxes = "[ ] Cash  [ ] Cheque  [ ] Balance\n[ ] QR Online"

      tableData.push([
        { content: paymentCheckboxes, colSpan: 2, styles: { fontSize: 7, textColor: [100, 100, 100], cellPadding: 1, halign: 'left' } },
        { content: productDetails, colSpan: 3, styles: { fontSize: 7, textColor: [100, 100, 100], cellPadding: 1, halign: 'left' } },
        { content: "Customer Signature: ___________", colSpan: 1, styles: { fontSize: 7, textColor: [100, 100, 100], cellPadding: 1, halign: 'right' } }
      ])
    } else {
      // If no items, still add signature row
      const paymentCheckboxes = "[ ] Cash  [ ] Cheque  [ ] Balance\n[ ] QR Online"

      tableData.push([
        { content: paymentCheckboxes, colSpan: 2, styles: { fontSize: 7, textColor: [100, 100, 100], cellPadding: 1, halign: 'left' } },
        { content: "", colSpan: 3, styles: { fontSize: 7, cellPadding: 1 } },
        { content: "Customer Signature: ___________", colSpan: 1, styles: { fontSize: 7, textColor: [100, 100, 100], cellPadding: 1, halign: 'right' } }
      ])
    }
  })

  // Calculate total amount and total items
  const totalAmount = data.orders.reduce((sum, order) => sum + order.amount, 0)
  const totalItemsCount = data.orders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
  }, 0)

  // Aggregate all items across all orders
  const itemsMap = new Map<string, number>()
  data.orders.forEach((order) => {
    order.items.forEach((item) => {
      const currentQty = itemsMap.get(item.product_name) || 0
      itemsMap.set(item.product_name, currentQty + item.quantity)
    })
  })

  // Add total row
  tableData.push([
    data.orders.length.toString(),
    "",
    "",
    "",
    `Rs. ${totalAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
    `Total Items: ${totalItemsCount}`,
  ])

  // Add items summary row
  const itemsSummary = Array.from(itemsMap.entries())
    .map(([name, qty]) => `${name} (${qty})`)
    .join("\n")

  tableData.push([
    { content: itemsSummary, colSpan: 6, styles: { fontSize: 6, textColor: [100, 100, 100], cellPadding: 1, halign: 'left' } }
  ])

  // Add table
  autoTable(doc, {
    startY: 43,
    margin: { left: 8, right: 8 },
    head: [
      ["#", "Order No.", "Customer", "Phone", "Amount", "Delivery Address"],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" }, // Sequence
      1: { cellWidth: 33 }, // Order No
      2: { cellWidth: 27 }, // Customer
      3: { cellWidth: 23, fontStyle: "bold" }, // Phone
      4: { cellWidth: 21, halign: "right", fontStyle: "bold" }, // Amount
      5: { cellWidth: 80 }, // Address
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      overflow: "linebreak",
    },
    didParseCell: (data) => {
      // Style the total row (last row)
      if (data.section === "body" && data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [240, 240, 240]
        data.cell.styles.fontStyle = "bold"
        data.cell.styles.fontSize = 8
      }
    },
    didDrawPage: (data) => {
      // Add page numbers
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const pageText = `Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`
      doc.text(pageText, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, {
        align: "center",
      })
    },
  })

  // Generate filename
  const filename = `delivery-route-${data.routeName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`

  // Save the PDF
  doc.save(filename)
}
