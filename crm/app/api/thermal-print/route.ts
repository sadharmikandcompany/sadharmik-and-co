import { NextRequest, NextResponse } from "next/server"

// ESC/POS Commands
const ESC = "\x1B"
const GS = "\x1D"
const COMMANDS = {
  INIT: ESC + "@",                    // Initialize printer
  ALIGN_CENTER: ESC + "a" + "\x01",   // Center align
  ALIGN_LEFT: ESC + "a" + "\x00",     // Left align
  ALIGN_RIGHT: ESC + "a" + "\x02",    // Right align
  BOLD_ON: ESC + "E" + "\x01",        // Bold on
  BOLD_OFF: ESC + "E" + "\x00",       // Bold off
  DOUBLE_HEIGHT_ON: GS + "!" + "\x10", // Double height
  DOUBLE_HEIGHT_OFF: GS + "!" + "\x00", // Normal size
  FONT_SMALL: ESC + "M" + "\x01",     // Small font
  FONT_NORMAL: ESC + "M" + "\x00",    // Normal font
  CUT_PAPER: GS + "V" + "\x00",       // Full cut
  CUT_PARTIAL: GS + "V" + "\x01",     // Partial cut
  FEED_LINES: (n: number) => ESC + "d" + String.fromCharCode(n), // Feed n lines
  LINE: "------------------------------------------------",
  DASHED_LINE: "- - - - - - - - - - - - - - - - - - - - - - - -",
}

// Default Company Info (fallback)
const DEFAULT_COMPANY_INFO = {
  name: "Sadharmik & Company",
  address: "G2, Mahadev Nagar - A CHS Ltd, Nr Bank of Maharashtra, B P Road, Nr Mahadev Mandir",
  city: "Bhayandar (East)",
  pincode: "101105",
  phone: "8777600400",
  gst: "",
}

interface CompanyInfo {
  name: string
  address: string
  city: string
  pincode: string
  phone: string
  gst: string
}

interface ThermalPrintRequest {
  orders: Array<{
    order: {
      order_number: string
      invoice_number_gst?: string | null
      invoice_number_non_gst?: string | null
      is_gst_invoice?: boolean
      order_date: string
      payment_method?: string | null
      payment_status: string
      subtotal: number
      discount_amount: number
      total_amount: number
      shipping_full_address?: string | null
      is_priority?: boolean
      order_notes?: string | null
      customer_notes?: string | null
    }
    customer: {
      first_name: string
      last_name: string
      mobile_primary: string
      mobile_secondary_1?: string | null
      vip_number?: string | null
      full_address?: string | null
    }
    items: Array<{
      product_name: string
      hsn_code?: string | null
      quantity: number
      unit_price: number
      discount_amount: number
      gst_percentage: number
      total: number
    }>
    companyInfo?: CompanyInfo
  }>
  printerIp?: string
  printerPort?: number
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2)
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? " " : "") + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function padRight(str: string, len: number): string {
  return str.slice(0, len).padEnd(len)
}

function padLeft(str: string, len: number): string {
  return str.slice(0, len).padStart(len)
}

function generateReceiptData(orderData: ThermalPrintRequest["orders"][0]): string {
  const { order, customer, items, companyInfo } = orderData
  const maxWidth = 48 // 80mm printer typically has 48 characters per line

  // Use provided company info or default
  const COMPANY_INFO = companyInfo || DEFAULT_COMPANY_INFO

  const invoiceNumber = order.is_gst_invoice
    ? (order.invoice_number_gst || order.order_number)
    : (order.invoice_number_non_gst || order.order_number)

  let receipt = ""

  // Initialize printer
  receipt += COMMANDS.INIT

  // Header - Company Name (centered, bold, double height)
  receipt += COMMANDS.ALIGN_CENTER
  receipt += COMMANDS.BOLD_ON
  receipt += COMMANDS.DOUBLE_HEIGHT_ON
  receipt += COMPANY_INFO.name + "\n"
  receipt += COMMANDS.DOUBLE_HEIGHT_OFF

  // Company Address
  receipt += COMMANDS.FONT_SMALL
  const addressLines = wrapText(COMPANY_INFO.address, maxWidth)
  addressLines.forEach(line => {
    receipt += line + "\n"
  })
  receipt += `${COMPANY_INFO.city} - ${COMPANY_INFO.pincode}\n`
  receipt += `Ph: ${COMPANY_INFO.phone}\n`
  receipt += `GSTIN: ${COMPANY_INFO.gst}\n`
  receipt += COMMANDS.FONT_NORMAL

  // Separator
  receipt += COMMANDS.LINE + "\n"

  // Invoice Title
  receipt += "TAX INVOICE\n"

  // Invoice Details (left aligned)
  receipt += COMMANDS.ALIGN_LEFT
  receipt += `Invoice: ${invoiceNumber}\n`
  receipt += `Date: ${formatDate(order.order_date)}\n`
  receipt += `Order: ${order.order_number}\n`

  receipt += COMMANDS.LINE + "\n"

  // Customer Info
  receipt += "Bill To:\n"

  const customerName = `${customer.first_name} ${customer.last_name}`
  if (customer.vip_number) {
    receipt += `${customerName} (VIP: ${customer.vip_number})\n`
  } else {
    receipt += `${customerName}\n`
  }
  receipt += `Ph: ${customer.mobile_primary}\n`
  if (customer.mobile_secondary_1) {
    receipt += `Ph2: ${customer.mobile_secondary_1}\n`
  }

  // Customer Address
  const customerAddress = order.shipping_full_address || customer.full_address || ""
  if (customerAddress) {
    const addrLines = wrapText(customerAddress, maxWidth)
    addrLines.forEach(line => {
      receipt += line + "\n"
    })
  }

  receipt += COMMANDS.LINE + "\n"

  // Priority & Notes
  if (order.is_priority || order.order_notes || order.customer_notes) {
    if (order.is_priority) {
      receipt += COMMANDS.ALIGN_CENTER
      receipt += COMMANDS.DOUBLE_HEIGHT_ON
      receipt += "*** PRIORITY ORDER ***\n"
      receipt += COMMANDS.DOUBLE_HEIGHT_OFF
      receipt += COMMANDS.ALIGN_LEFT
    }

    if (order.customer_notes) {
      receipt += "Customer Notes:\n"
      const custNotesLines = wrapText(order.customer_notes, maxWidth)
      custNotesLines.forEach(line => {
        receipt += line + "\n"
      })
    }

    if (order.order_notes) {
      receipt += "Order Notes:\n"
      const notesLines = wrapText(order.order_notes, maxWidth)
      notesLines.forEach(line => {
        receipt += line + "\n"
      })
    }

    receipt += COMMANDS.LINE + "\n"
  }

  // Items Header
  receipt += COMMANDS.FONT_SMALL
  receipt += padRight("Item", 24) + padLeft("Qty", 4) + padLeft("Rate", 10) + padLeft("Amt", 10) + "\n"
  receipt += COMMANDS.DASHED_LINE + "\n"

  // Items (bold for better readability)
  let totalCgst = 0
  let totalSgst = 0

  items.forEach(item => {
    const itemSubtotal = item.quantity * item.unit_price

    // Product name (may wrap)
    const nameLines = wrapText(item.product_name, 24)
    nameLines.forEach((line, idx) => {
      if (idx === 0) {
        receipt += padRight(line, 24) +
          padLeft(item.quantity.toString(), 4) +
          padLeft(formatCurrency(item.unit_price), 10) +
          padLeft(formatCurrency(itemSubtotal), 10) + "\n"
      } else {
        receipt += line + "\n"
      }
    })

    // HSN code if available
    if (item.hsn_code) {
      receipt += `  HSN: ${item.hsn_code}\n`
    }

    // Calculate GST
    if (item.gst_percentage > 0) {
      const taxableAmount = item.total / (1 + item.gst_percentage / 100)
      const gstAmount = item.total - taxableAmount
      totalCgst += gstAmount / 2
      totalSgst += gstAmount / 2
    }
  })

  receipt += COMMANDS.DASHED_LINE + "\n"
  receipt += COMMANDS.FONT_NORMAL

  // Summary (keep bold for better readability)
  receipt += padRight("Subtotal:", 28) + padLeft(formatCurrency(order.subtotal), 20) + "\n"

  // Discount
  const totalItemDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0)
  const totalDiscount = totalItemDiscount + (order.discount_amount || 0)
  if (totalDiscount > 0) {
    receipt += padRight("Discount:", 28) + padLeft("-" + formatCurrency(totalDiscount), 20) + "\n"
  }

  // Taxable Amount
  const taxableAmount = order.subtotal - totalDiscount
  receipt += padRight("Taxable Amount:", 28) + padLeft(formatCurrency(taxableAmount), 20) + "\n"

  // CGST & SGST
  if (totalCgst > 0) {
    const gstRate = items[0]?.gst_percentage || 0
    receipt += padRight(`CGST @ ${(gstRate / 2).toFixed(1)}%:`, 28) + padLeft(formatCurrency(totalCgst), 20) + "\n"
    receipt += padRight(`SGST @ ${(gstRate / 2).toFixed(1)}%:`, 28) + padLeft(formatCurrency(totalSgst), 20) + "\n"
  }

  receipt += COMMANDS.LINE + "\n"

  // Total (larger)
  receipt += COMMANDS.DOUBLE_HEIGHT_ON
  receipt += padRight("TOTAL:", 20) + padLeft(formatCurrency(order.total_amount), 28) + "\n"
  receipt += COMMANDS.DOUBLE_HEIGHT_OFF

  receipt += COMMANDS.LINE + "\n"

  // Payment Info
  receipt += `Payment: ${order.payment_method || "N/A"}\n`
  receipt += `Status: ${order.payment_status}\n`

  receipt += COMMANDS.LINE + "\n"

  // Footer
  receipt += COMMANDS.ALIGN_CENTER
  receipt += "Thank you for doing business with us!\n"
  receipt += "Visit again!\n"

  // Feed lines before cut
  receipt += COMMANDS.FEED_LINES(4)

  // Cut paper
  receipt += COMMANDS.CUT_PAPER

  return receipt
}

async function sendToPrinter(data: string, printerIp: string, printerPort: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Dynamic import for net module (Node.js only)
    import("net").then((netModule) => {
      const net = netModule
      const client = new net.Socket()

      client.setTimeout(10000) // 10 second timeout

      client.connect(printerPort, printerIp, () => {
        client.write(data, "binary", (err) => {
          if (err) {
            client.destroy()
            reject(err)
          } else {
            client.end()
            resolve()
          }
        })
      })

      client.on("error", (err) => {
        client.destroy()
        reject(err)
      })

      client.on("timeout", () => {
        client.destroy()
        reject(new Error("Connection timeout"))
      })

      client.on("close", () => {
        resolve()
      })
    }).catch(reject)
  })
}

export async function POST(request: NextRequest) {
  try {
    const body: ThermalPrintRequest = await request.json()

    if (!body.orders || body.orders.length === 0) {
      return NextResponse.json(
        { success: false, error: "No orders provided" },
        { status: 400 }
      )
    }

    // Get printer configuration from environment or request
    const printerIp = body.printerIp || process.env.THERMAL_PRINTER_IP || "192.168.1.100"
    const printerPort = body.printerPort || parseInt(process.env.THERMAL_PRINTER_PORT || "9100")

    // Generate all receipts
    let allReceiptsData = ""
    for (const orderData of body.orders) {
      allReceiptsData += generateReceiptData(orderData)
    }

    // Send to printer
    await sendToPrinter(allReceiptsData, printerIp, printerPort)

    return NextResponse.json({
      success: true,
      message: `Successfully printed ${body.orders.length} receipt(s)`,
      printedCount: body.orders.length,
    })
  } catch (error) {
    console.error("Thermal print error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to print",
      },
      { status: 500 }
    )
  }
}
