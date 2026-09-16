// Tally XML Generator Utility
// Generates XML files compatible with Tally ERP 9 / TallyPrime import

import * as XLSX from 'xlsx'

export type TallyExportType = 'sales' | 'purchases' | 'masters' | 'all'

export interface OrderItem {
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  hsn_code: string | null
  gst_percentage: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  subtotal: number
  total: number
}

export interface SalesOrder {
  id: string
  order_number: string
  invoice_number_gst: string | null
  customer_name: string
  customer_gst_number: string | null
  customer_pan_number: string | null
  customer_state: string | null
  customer_city: string | null
  customer_address: string | null
  order_date: string
  subtotal: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  is_interstate: boolean
  items: OrderItem[]
}

export interface PurchaseItem {
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  hsn_code: string | null
  gst_percentage: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  subtotal: number
  total: number
}

export interface Purchase {
  id: string
  purchase_number: string
  invoice_number: string | null
  supplier_name: string
  supplier_gst_number: string | null
  supplier_state: string | null
  supplier_city: string | null
  supplier_address: string | null
  purchase_date: string
  subtotal: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  is_interstate: boolean
  items: PurchaseItem[]
}

export interface Customer {
  id: string
  name: string
  company_name: string | null
  gst_number: string | null
  pan_number: string | null
  email: string | null
  mobile: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
}

export interface Vendor {
  id: string
  name: string
  company_name: string | null
  gst_number: string | null
  email: string | null
  mobile: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
}

export interface Product {
  id: string
  name: string
  sku: string | null
  hsn_code: string | null
  unit: string
  category: string | null
}

// Helper function to format date as YYYYMMDD for Tally
function formatTallyDate(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

// Helper function to escape XML special characters
function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Helper function to format amount (2 decimal places)
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

// Get GST rate from percentage for ledger name
function getGstLedgerName(percentage: number, type: 'cgst' | 'sgst' | 'igst', isOutput: boolean = true): string {
  const direction = isOutput ? 'Output' : 'Input'
  const rate = percentage / 2 // CGST and SGST are half of total GST

  if (type === 'igst') {
    return `IGST ${direction} @${percentage}%`
  }
  return `${type.toUpperCase()} ${direction} @${rate}%`
}

// Generate Sales Voucher XML for a single order
function generateSalesVoucherEntry(order: SalesOrder): string {
  const invoiceNumber = order.invoice_number_gst || order.order_number
  const partyName = escapeXml(order.customer_name)
  const date = formatTallyDate(order.order_date)

  // Build inventory entries for each item
  let inventoryEntries = ''
  let salesAmount = 0

  for (const item of order.items) {
    salesAmount += item.subtotal
    inventoryEntries += `
            <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>${escapeXml(item.product_name)}</STOCKITEMNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <RATE>${formatAmount(item.unit_price)}/Nos</RATE>
                <AMOUNT>${formatAmount(item.subtotal)}</AMOUNT>
                <ACTUALQTY>${item.quantity} Nos</ACTUALQTY>
                <BILLEDQTY>${item.quantity} Nos</BILLEDQTY>
                <BATCHALLOCATIONS.LIST>
                    <GODOWNNAME>Main Location</GODOWNNAME>
                    <BATCHNAME>Primary Batch</BATCHNAME>
                    <AMOUNT>${formatAmount(item.subtotal)}</AMOUNT>
                    <ACTUALQTY>${item.quantity} Nos</ACTUALQTY>
                    <BILLEDQTY>${item.quantity} Nos</BILLEDQTY>
                </BATCHALLOCATIONS.LIST>
                <ACCOUNTINGALLOCATIONS.LIST>
                    <LEDGERNAME>Sales</LEDGERNAME>
                    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                    <AMOUNT>${formatAmount(item.subtotal)}</AMOUNT>
                </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>`
  }

  // Build GST ledger entries
  let gstEntries = ''

  if (order.is_interstate && order.igst_amount > 0) {
    // Interstate - IGST
    const gstRate = order.items[0]?.gst_percentage || 18
    gstEntries = `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>${getGstLedgerName(gstRate, 'igst', true)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${formatAmount(order.igst_amount)}</AMOUNT>
            </LEDGERENTRIES.LIST>`
  } else {
    // Intrastate - CGST + SGST
    const gstRate = order.items[0]?.gst_percentage || 18
    if (order.cgst_amount > 0) {
      gstEntries += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>${getGstLedgerName(gstRate, 'cgst', true)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${formatAmount(order.cgst_amount)}</AMOUNT>
            </LEDGERENTRIES.LIST>`
    }
    if (order.sgst_amount > 0) {
      gstEntries += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>${getGstLedgerName(gstRate, 'sgst', true)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${formatAmount(order.sgst_amount)}</AMOUNT>
            </LEDGERENTRIES.LIST>`
    }
  }

  return `
        <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${date}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(invoiceNumber)}</VOUCHERNUMBER>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <ISINVOICE>Yes</ISINVOICE>
            <OBJVIEW>Invoice Voucher View</OBJVIEW>
            <NARRATION>Sales Invoice ${escapeXml(invoiceNumber)}</NARRATION>
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>${partyName}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
                <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
                <AMOUNT>-${formatAmount(order.total_amount)}</AMOUNT>
                <BILLALLOCATIONS.LIST>
                    <NAME>${escapeXml(invoiceNumber)}</NAME>
                    <BILLTYPE>New Ref</BILLTYPE>
                    <AMOUNT>-${formatAmount(order.total_amount)}</AMOUNT>
                </BILLALLOCATIONS.LIST>
            </LEDGERENTRIES.LIST>${gstEntries}${inventoryEntries}
        </VOUCHER>`
}

// Generate Purchase Voucher XML for a single purchase
function generatePurchaseVoucherEntry(purchase: Purchase): string {
  const invoiceNumber = purchase.invoice_number || purchase.purchase_number
  const partyName = escapeXml(purchase.supplier_name)
  const date = formatTallyDate(purchase.purchase_date)

  // Build inventory entries for each item
  let inventoryEntries = ''

  for (const item of purchase.items) {
    inventoryEntries += `
            <ALLINVENTORYENTRIES.LIST>
                <STOCKITEMNAME>${escapeXml(item.product_name)}</STOCKITEMNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <RATE>${formatAmount(item.unit_price)}/Nos</RATE>
                <AMOUNT>-${formatAmount(item.subtotal)}</AMOUNT>
                <ACTUALQTY>${item.quantity} Nos</ACTUALQTY>
                <BILLEDQTY>${item.quantity} Nos</BILLEDQTY>
                <BATCHALLOCATIONS.LIST>
                    <GODOWNNAME>Main Location</GODOWNNAME>
                    <BATCHNAME>Primary Batch</BATCHNAME>
                    <AMOUNT>-${formatAmount(item.subtotal)}</AMOUNT>
                    <ACTUALQTY>${item.quantity} Nos</ACTUALQTY>
                    <BILLEDQTY>${item.quantity} Nos</BILLEDQTY>
                </BATCHALLOCATIONS.LIST>
                <ACCOUNTINGALLOCATIONS.LIST>
                    <LEDGERNAME>Purchase</LEDGERNAME>
                    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                    <AMOUNT>-${formatAmount(item.subtotal)}</AMOUNT>
                </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>`
  }

  // Build GST ledger entries
  let gstEntries = ''

  if (purchase.is_interstate && purchase.igst_amount > 0) {
    // Interstate - IGST Input
    const gstRate = purchase.items[0]?.gst_percentage || 18
    gstEntries = `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>${getGstLedgerName(gstRate, 'igst', false)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${formatAmount(purchase.igst_amount)}</AMOUNT>
            </LEDGERENTRIES.LIST>`
  } else {
    // Intrastate - CGST + SGST Input
    const gstRate = purchase.items[0]?.gst_percentage || 18
    if (purchase.cgst_amount > 0) {
      gstEntries += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>${getGstLedgerName(gstRate, 'cgst', false)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${formatAmount(purchase.cgst_amount)}</AMOUNT>
            </LEDGERENTRIES.LIST>`
    }
    if (purchase.sgst_amount > 0) {
      gstEntries += `
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>${getGstLedgerName(gstRate, 'sgst', false)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${formatAmount(purchase.sgst_amount)}</AMOUNT>
            </LEDGERENTRIES.LIST>`
    }
  }

  return `
        <VOUCHER VCHTYPE="Purchase" ACTION="Create">
            <DATE>${date}</DATE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(invoiceNumber)}</VOUCHERNUMBER>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <ISINVOICE>Yes</ISINVOICE>
            <OBJVIEW>Invoice Voucher View</OBJVIEW>
            <NARRATION>Purchase Invoice ${escapeXml(invoiceNumber)}</NARRATION>
            <LEDGERENTRIES.LIST>
                <LEDGERNAME>${partyName}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
                <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
                <AMOUNT>${formatAmount(purchase.total_amount)}</AMOUNT>
                <BILLALLOCATIONS.LIST>
                    <NAME>${escapeXml(invoiceNumber)}</NAME>
                    <BILLTYPE>New Ref</BILLTYPE>
                    <AMOUNT>${formatAmount(purchase.total_amount)}</AMOUNT>
                </BILLALLOCATIONS.LIST>
            </LEDGERENTRIES.LIST>${gstEntries}${inventoryEntries}
        </VOUCHER>`
}

// Generate Customer Ledger Master XML
function generateCustomerLedgerEntry(customer: Customer): string {
  const name = escapeXml(customer.name)
  const address = [
    customer.address,
    customer.city,
    customer.state,
    customer.pincode
  ].filter(Boolean).join(', ')

  let gstInfo = ''
  if (customer.gst_number) {
    gstInfo = `
                <PARTYGSTIN>${escapeXml(customer.gst_number)}</PARTYGSTIN>
                <GSTIN>${escapeXml(customer.gst_number)}</GSTIN>`
  }

  return `
            <LEDGER Action="Create">
                <NAME>${name}</NAME>
                <PARENT>Sundry Debtors</PARENT>
                <ISBILLWISEON>Yes</ISBILLWISEON>
                <MAILINGNAME.LIST TYPE="String">
                    <MAILINGNAME>${name}</MAILINGNAME>
                </MAILINGNAME.LIST>
                <ADDRESS.LIST TYPE="String">
                    <ADDRESS>${escapeXml(address)}</ADDRESS>
                </ADDRESS.LIST>
                <LEDSTATENAME>${escapeXml(customer.state || '')}</LEDSTATENAME>
                <PINCODE>${escapeXml(customer.pincode || '')}</PINCODE>
                <COUNTRYNAME>India</COUNTRYNAME>
                <EMAIL>${escapeXml(customer.email || '')}</EMAIL>
                <LEDGERMOBILE>${escapeXml(customer.mobile || '')}</LEDGERMOBILE>${gstInfo}
            </LEDGER>`
}

// Generate Vendor Ledger Master XML
function generateVendorLedgerEntry(vendor: Vendor): string {
  const name = escapeXml(vendor.name)
  const address = [
    vendor.address,
    vendor.city,
    vendor.state,
    vendor.pincode
  ].filter(Boolean).join(', ')

  let gstInfo = ''
  if (vendor.gst_number) {
    gstInfo = `
                <PARTYGSTIN>${escapeXml(vendor.gst_number)}</PARTYGSTIN>
                <GSTIN>${escapeXml(vendor.gst_number)}</GSTIN>`
  }

  return `
            <LEDGER Action="Create">
                <NAME>${name}</NAME>
                <PARENT>Sundry Creditors</PARENT>
                <ISBILLWISEON>Yes</ISBILLWISEON>
                <MAILINGNAME.LIST TYPE="String">
                    <MAILINGNAME>${name}</MAILINGNAME>
                </MAILINGNAME.LIST>
                <ADDRESS.LIST TYPE="String">
                    <ADDRESS>${escapeXml(address)}</ADDRESS>
                </ADDRESS.LIST>
                <LEDSTATENAME>${escapeXml(vendor.state || '')}</LEDSTATENAME>
                <PINCODE>${escapeXml(vendor.pincode || '')}</PINCODE>
                <COUNTRYNAME>India</COUNTRYNAME>
                <EMAIL>${escapeXml(vendor.email || '')}</EMAIL>
                <LEDGERMOBILE>${escapeXml(vendor.mobile || '')}</LEDGERMOBILE>${gstInfo}
            </LEDGER>`
}

// Generate Stock Item Master XML
function generateStockItemEntry(product: Product): string {
  return `
            <STOCKITEM Action="Create">
                <NAME>${escapeXml(product.name)}</NAME>
                <PARENT>${escapeXml(product.category || 'Primary')}</PARENT>
                <BASEUNITS>Nos</BASEUNITS>
                <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
                <HSNCODE>${escapeXml(product.hsn_code || '')}</HSNCODE>
                <NAME.LIST TYPE="String">
                    <NAME>${escapeXml(product.name)}</NAME>
                    ${product.sku ? `<NAME>${escapeXml(product.sku)}</NAME>` : ''}
                </NAME.LIST>
            </STOCKITEM>`
}

// Generate Sales Vouchers XML
export function generateSalesVouchersXML(orders: SalesOrder[]): string {
  if (orders.length === 0) return ''

  const vouchers = orders.map(order => generateSalesVoucherEntry(order)).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">${vouchers}
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`
}

// Generate Purchase Vouchers XML
export function generatePurchaseVouchersXML(purchases: Purchase[]): string {
  if (purchases.length === 0) return ''

  const vouchers = purchases.map(purchase => generatePurchaseVoucherEntry(purchase)).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">${vouchers}
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`
}

// Generate Ledger Masters XML (Customers + Vendors)
export function generateLedgerMastersXML(customers: Customer[], vendors: Vendor[]): string {
  const customerLedgers = customers.map(c => generateCustomerLedgerEntry(c)).join('')
  const vendorLedgers = vendors.map(v => generateVendorLedgerEntry(v)).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>All Masters</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">${customerLedgers}${vendorLedgers}
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`
}

// Generate Stock Item Masters XML
export function generateStockItemMastersXML(products: Product[]): string {
  if (products.length === 0) return ''

  const stockItems = products.map(p => generateStockItemEntry(p)).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>All Masters</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">${stockItems}
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`
}

// Generate combined XML with all data
export function generateAllDataXML(
  orders: SalesOrder[],
  purchases: Purchase[],
  customers: Customer[],
  vendors: Vendor[],
  products: Product[]
): string {
  // First generate masters
  const customerLedgers = customers.map(c => generateCustomerLedgerEntry(c)).join('')
  const vendorLedgers = vendors.map(v => generateVendorLedgerEntry(v)).join('')
  const stockItems = products.map(p => generateStockItemEntry(p)).join('')

  // Then generate vouchers
  const salesVouchers = orders.map(order => generateSalesVoucherEntry(order)).join('')
  const purchaseVouchers = purchases.map(purchase => generatePurchaseVoucherEntry(purchase)).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>All Masters</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">${customerLedgers}${vendorLedgers}${stockItems}
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">${salesVouchers}${purchaseVouchers}
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`
}

// Download XML file helper
export function downloadTallyXML(xml: string, filename: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.xml`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============================================
// Excel Export Functions
// ============================================

// Helper to format date for Excel
function formatExcelDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Export Sales Orders to Excel
export function exportSalesOrdersToExcel(orders: SalesOrder[], filename: string): void {
  // Create main orders sheet data
  const ordersData = orders.map(order => ({
    'Voucher Type': 'Sales',
    'Invoice No': order.invoice_number_gst || order.order_number,
    'Order No': order.order_number,
    'Date': formatExcelDate(order.order_date),
    'Customer Name': order.customer_name,
    'GST Number': order.customer_gst_number || '',
    'PAN Number': order.customer_pan_number || '',
    'State': order.customer_state || '',
    'City': order.customer_city || '',
    'Address': order.customer_address || '',
    'Subtotal': order.subtotal,
    'CGST': order.cgst_amount,
    'SGST': order.sgst_amount,
    'IGST': order.igst_amount,
    'Total GST': order.cgst_amount + order.sgst_amount + order.igst_amount,
    'Total Amount': order.total_amount,
    'Interstate': order.is_interstate ? 'Yes' : 'No',
    'Items Count': order.items.length
  }))

  // Create items sheet data
  const itemsData: any[] = []
  orders.forEach(order => {
    order.items.forEach(item => {
      itemsData.push({
        'Voucher Type': 'Sales',
        'Invoice No': order.invoice_number_gst || order.order_number,
        'Order No': order.order_number,
        'Date': formatExcelDate(order.order_date),
        'Customer Name': order.customer_name,
        'Product Name': item.product_name,
        'SKU': item.product_sku || '',
        'HSN Code': item.hsn_code || '',
        'Quantity': item.quantity,
        'Unit Price': item.unit_price,
        'Subtotal': item.subtotal,
        'GST %': item.gst_percentage,
        'CGST': item.cgst_amount,
        'SGST': item.sgst_amount,
        'IGST': item.igst_amount,
        'Total': item.total
      })
    })
  })

  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new()

  const ordersSheet = XLSX.utils.json_to_sheet(ordersData)
  XLSX.utils.book_append_sheet(wb, ordersSheet, 'Sales Orders')

  if (itemsData.length > 0) {
    const itemsSheet = XLSX.utils.json_to_sheet(itemsData)
    XLSX.utils.book_append_sheet(wb, itemsSheet, 'Order Items')
  }

  // Download
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export Purchases to Excel
export function exportPurchasesToExcel(purchases: Purchase[], filename: string): void {
  // Create main purchases sheet data
  const purchasesData = purchases.map(purchase => ({
    'Voucher Type': 'Purchase',
    'Invoice No': purchase.invoice_number || '',
    'PO No': purchase.purchase_number,
    'Date': formatExcelDate(purchase.purchase_date),
    'Supplier Name': purchase.supplier_name,
    'GST Number': purchase.supplier_gst_number || '',
    'State': purchase.supplier_state || '',
    'City': purchase.supplier_city || '',
    'Address': purchase.supplier_address || '',
    'Subtotal': purchase.subtotal,
    'CGST': purchase.cgst_amount,
    'SGST': purchase.sgst_amount,
    'IGST': purchase.igst_amount,
    'Total GST': purchase.cgst_amount + purchase.sgst_amount + purchase.igst_amount,
    'Total Amount': purchase.total_amount,
    'Interstate': purchase.is_interstate ? 'Yes' : 'No',
    'Items Count': purchase.items.length
  }))

  // Create items sheet data
  const itemsData: any[] = []
  purchases.forEach(purchase => {
    purchase.items.forEach(item => {
      itemsData.push({
        'Voucher Type': 'Purchase',
        'Invoice No': purchase.invoice_number || '',
        'PO No': purchase.purchase_number,
        'Date': formatExcelDate(purchase.purchase_date),
        'Supplier Name': purchase.supplier_name,
        'Product Name': item.product_name,
        'SKU': item.product_sku || '',
        'HSN Code': item.hsn_code || '',
        'Quantity': item.quantity,
        'Unit Price': item.unit_price,
        'Subtotal': item.subtotal,
        'GST %': item.gst_percentage,
        'CGST': item.cgst_amount,
        'SGST': item.sgst_amount,
        'IGST': item.igst_amount,
        'Total': item.total
      })
    })
  })

  // Create workbook with multiple sheets
  const wb = XLSX.utils.book_new()

  const purchasesSheet = XLSX.utils.json_to_sheet(purchasesData)
  XLSX.utils.book_append_sheet(wb, purchasesSheet, 'Purchases')

  if (itemsData.length > 0) {
    const itemsSheet = XLSX.utils.json_to_sheet(itemsData)
    XLSX.utils.book_append_sheet(wb, itemsSheet, 'Purchase Items')
  }

  // Download
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export Customers to Excel
export function exportCustomersToExcel(customers: Customer[], filename: string): void {
  const data = customers.map(customer => ({
    'Name': customer.name,
    'Company Name': customer.company_name || '',
    'GST Number': customer.gst_number || '',
    'PAN Number': customer.pan_number || '',
    'Email': customer.email || '',
    'Mobile': customer.mobile || '',
    'Address': customer.address || '',
    'City': customer.city || '',
    'State': customer.state || '',
    'Pincode': customer.pincode || '',
    'Ledger Group': 'Sundry Debtors'
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Customers')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export Vendors to Excel
export function exportVendorsToExcel(vendors: Vendor[], filename: string): void {
  const data = vendors.map(vendor => ({
    'Name': vendor.name,
    'Company Name': vendor.company_name || '',
    'GST Number': vendor.gst_number || '',
    'Email': vendor.email || '',
    'Mobile': vendor.mobile || '',
    'Address': vendor.address || '',
    'City': vendor.city || '',
    'State': vendor.state || '',
    'Pincode': vendor.pincode || '',
    'Ledger Group': 'Sundry Creditors'
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Vendors')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export Products to Excel
export function exportProductsToExcel(products: Product[], filename: string): void {
  const data = products.map(product => ({
    'Name': product.name,
    'SKU': product.sku || '',
    'HSN Code': product.hsn_code || '',
    'Unit': product.unit,
    'Category': product.category || ''
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export All Masters to Excel (Customers, Vendors, Products in one file)
export function exportMastersToExcel(
  customers: Customer[],
  vendors: Vendor[],
  products: Product[],
  filename: string
): void {
  const wb = XLSX.utils.book_new()

  // Customers sheet
  const customersData = customers.map(customer => ({
    'Name': customer.name,
    'Company Name': customer.company_name || '',
    'GST Number': customer.gst_number || '',
    'PAN Number': customer.pan_number || '',
    'Email': customer.email || '',
    'Mobile': customer.mobile || '',
    'Address': customer.address || '',
    'City': customer.city || '',
    'State': customer.state || '',
    'Pincode': customer.pincode || '',
    'Ledger Group': 'Sundry Debtors'
  }))
  const customersSheet = XLSX.utils.json_to_sheet(customersData)
  XLSX.utils.book_append_sheet(wb, customersSheet, 'Customers')

  // Vendors sheet
  const vendorsData = vendors.map(vendor => ({
    'Name': vendor.name,
    'Company Name': vendor.company_name || '',
    'GST Number': vendor.gst_number || '',
    'Email': vendor.email || '',
    'Mobile': vendor.mobile || '',
    'Address': vendor.address || '',
    'City': vendor.city || '',
    'State': vendor.state || '',
    'Pincode': vendor.pincode || '',
    'Ledger Group': 'Sundry Creditors'
  }))
  const vendorsSheet = XLSX.utils.json_to_sheet(vendorsData)
  XLSX.utils.book_append_sheet(wb, vendorsSheet, 'Vendors')

  // Products sheet
  const productsData = products.map(product => ({
    'Name': product.name,
    'SKU': product.sku || '',
    'HSN Code': product.hsn_code || '',
    'Unit': product.unit,
    'Category': product.category || ''
  }))
  const productsSheet = XLSX.utils.json_to_sheet(productsData)
  XLSX.utils.book_append_sheet(wb, productsSheet, 'Products')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export All Data to Excel (Sales, Purchases, Masters in one file)
export function exportAllDataToExcel(
  orders: SalesOrder[],
  purchases: Purchase[],
  customers: Customer[],
  vendors: Vendor[],
  products: Product[],
  filename: string
): void {
  const wb = XLSX.utils.book_new()

  // Sales Orders sheet
  const ordersData = orders.map(order => ({
    'Voucher Type': 'Sales',
    'Invoice No': order.invoice_number_gst || order.order_number,
    'Order No': order.order_number,
    'Date': formatExcelDate(order.order_date),
    'Customer Name': order.customer_name,
    'GST Number': order.customer_gst_number || '',
    'Subtotal': order.subtotal,
    'CGST': order.cgst_amount,
    'SGST': order.sgst_amount,
    'IGST': order.igst_amount,
    'Total Amount': order.total_amount
  }))
  const ordersSheet = XLSX.utils.json_to_sheet(ordersData)
  XLSX.utils.book_append_sheet(wb, ordersSheet, 'Sales Orders')

  // Sales Items sheet
  const salesItemsData: any[] = []
  orders.forEach(order => {
    order.items.forEach(item => {
      salesItemsData.push({
        'Voucher Type': 'Sales',
        'Invoice No': order.invoice_number_gst || order.order_number,
        'Customer': order.customer_name,
        'Product': item.product_name,
        'HSN': item.hsn_code || '',
        'Qty': item.quantity,
        'Rate': item.unit_price,
        'GST %': item.gst_percentage,
        'Total': item.total
      })
    })
  })
  if (salesItemsData.length > 0) {
    const salesItemsSheet = XLSX.utils.json_to_sheet(salesItemsData)
    XLSX.utils.book_append_sheet(wb, salesItemsSheet, 'Sales Items')
  }

  // Purchases sheet
  const purchasesData = purchases.map(purchase => ({
    'Voucher Type': 'Purchase',
    'Invoice No': purchase.invoice_number || '',
    'PO No': purchase.purchase_number,
    'Date': formatExcelDate(purchase.purchase_date),
    'Supplier Name': purchase.supplier_name,
    'GST Number': purchase.supplier_gst_number || '',
    'Subtotal': purchase.subtotal,
    'CGST': purchase.cgst_amount,
    'SGST': purchase.sgst_amount,
    'IGST': purchase.igst_amount,
    'Total Amount': purchase.total_amount
  }))
  const purchasesSheet = XLSX.utils.json_to_sheet(purchasesData)
  XLSX.utils.book_append_sheet(wb, purchasesSheet, 'Purchases')

  // Purchase Items sheet
  const purchaseItemsData: any[] = []
  purchases.forEach(purchase => {
    purchase.items.forEach(item => {
      purchaseItemsData.push({
        'Voucher Type': 'Purchase',
        'Invoice No': purchase.invoice_number || '',
        'Supplier': purchase.supplier_name,
        'Product': item.product_name,
        'HSN': item.hsn_code || '',
        'Qty': item.quantity,
        'Rate': item.unit_price,
        'GST %': item.gst_percentage,
        'Total': item.total
      })
    })
  })
  if (purchaseItemsData.length > 0) {
    const purchaseItemsSheet = XLSX.utils.json_to_sheet(purchaseItemsData)
    XLSX.utils.book_append_sheet(wb, purchaseItemsSheet, 'Purchase Items')
  }

  // Customers sheet
  const customersData = customers.map(c => ({
    'Name': c.name,
    'Company': c.company_name || '',
    'GST': c.gst_number || '',
    'Mobile': c.mobile || '',
    'State': c.state || ''
  }))
  const customersSheet = XLSX.utils.json_to_sheet(customersData)
  XLSX.utils.book_append_sheet(wb, customersSheet, 'Customers')

  // Vendors sheet
  const vendorsData = vendors.map(v => ({
    'Name': v.name,
    'Company': v.company_name || '',
    'GST': v.gst_number || '',
    'Mobile': v.mobile || '',
    'State': v.state || ''
  }))
  const vendorsSheet = XLSX.utils.json_to_sheet(vendorsData)
  XLSX.utils.book_append_sheet(wb, vendorsSheet, 'Vendors')

  // Products sheet
  const productsData = products.map(p => ({
    'Name': p.name,
    'HSN': p.hsn_code || '',
    'Unit': p.unit,
    'Category': p.category || ''
  }))
  const productsSheet = XLSX.utils.json_to_sheet(productsData)
  XLSX.utils.book_append_sheet(wb, productsSheet, 'Products')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}
