/**
 * Invoice generation utilities for Orders and Purchases
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { formatCurrency, formatDate } from './export-utils';
import { numberToWords } from './number-to-words';

// Company details type
interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  gst: string;
  state: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
}

// TODO(manufacturing-unit phase): this used to be the previous business's
// real Gujarat factory (its own GST/bank details, since removed). Sadharmik
// & Company doesn't have a separate factory entity yet — replace this with
// real details once that's set up. Until then it mirrors DEFAULT_COMPANY_INFO
// so "Order from Factory" invoices don't print blank/wrong seller info.
export const FACTORY_COMPANY_INFO: CompanyInfo = {
  name: 'Sadharmik & Company',
  address: 'G2, Mahadev Nagar - A CHS Ltd, Nr Bank of Maharashtra, B P Road, Nr Mahadev Mandir',
  city: 'Bhayandar (East)',
  pincode: '101105',
  phone: '8777600400',
  email: 'info@sadharmikandcompany.com',
  gst: '',
  state: '27-Maharashtra',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branch: '',
};

// Default company details (can be moved to config)
const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'Sadharmik & Company',
  address: 'G2, Mahadev Nagar - A CHS Ltd, Nr Bank of Maharashtra, B P Road, Nr Mahadev Mandir',
  city: 'Bhayandar (East)',
  pincode: '101105',
  phone: '8777600400',
  email: 'info@sadharmikandcompany.com',
  gst: '',
  state: '27-Maharashtra',
  // Bank details intentionally left blank for now.
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branch: ''
};

interface OrderInvoiceData {
  order: {
    id: string;
    order_number: string;
    invoice_number_gst?: string | null;
    invoice_number_non_gst?: string | null;
    is_gst_invoice?: boolean;
    order_date: string;
    order_status: string;
    payment_status: string;
    payment_method: string;
    subtotal: number;
    discount_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;

    shipping_charges?: number;
    total_amount: number;
    shipping_room_number?: string;
    shipping_floor?: string;
    shipping_wing?: string;
    shipping_flat_number?: string;
    shipping_floor_wing?: string;
    shipping_building_name: string;
    shipping_street_area: string;
    shipping_landmark?: string;
    shipping_city: string;
    shipping_state: string;
    shipping_pincode: string;
    shipping_country?: string;
    shipping_full_address?: string;
    billing_room_number?: string;
    billing_floor?: string;
    billing_wing?: string;
    billing_flat_number?: string;
    billing_floor_wing?: string;
    billing_building_name: string;
    billing_street_area: string;
    billing_landmark?: string;
    billing_city: string;
    billing_state: string;
    billing_pincode: string;
    billing_country?: string;
    is_priority?: boolean;
    order_notes?: string | null;
    customer_notes?: string | null;
  };
  customer: {
    first_name: string;
    last_name: string;
    email?: string;
    mobile_primary: string;
    mobile_secondary_1?: string | null;
    mobile_secondary_2?: string | null;
    whatsapp_number?: string | null;
    company_name?: string;
    gst_number?: string;
    full_address?: string;
    vip_number?: string;
  };
  items: Array<{
    product_name: string;
    product_sku?: string;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    discount_amount: number;
    gst_percentage: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total: number;
    hsn_code?: string;
    item_description?: string;
  }>;
  companyInfo?: CompanyInfo;
}

interface PurchaseInvoiceData {
  purchase: {
    id: string;
    purchase_number: string;
    purchase_date: string;
    purchase_status: string;
    payment_status: string;
    payment_method: string;
    supplier_name: string;
    supplier_address?: string;
    supplier_city?: string;
    supplier_state?: string;
    supplier_pincode?: string;
    supplier_gst?: string;
    subtotal: number;
    discount_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total_amount: number;
    invoice_number?: string;
    invoice_date?: string;
  };
  items: Array<{
    product_name: string;
    product_sku?: string;
    quantity: number;
    unit_price: number;
    discount_amount: number;
    gst_percentage: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total: number;
    hsn_code?: string;
  }>;
  companyInfo?: CompanyInfo;
}

/**
 * Generate Order Invoice PDF
 * @param data - Invoice data
 * @param customerName - Optional customer/distributor name for filename
 */
export function generateOrderInvoice(data: OrderInvoiceData, customerName?: string): void {
  const doc = new jsPDF();
  generateInvoiceContent(doc, data);

  // Use invoice number for filename if available
  const isGstInvoice = data.order.is_gst_invoice ?? true;
  const invoiceNumber = isGstInvoice
    ? (data.order.invoice_number_gst || data.order.order_number)
    : (data.order.invoice_number_non_gst || data.order.order_number);

  // Build filename with optional customer name
  let filename = `Invoice_${invoiceNumber}`;
  if (customerName) {
    // Clean customer name for filename (remove special characters, spaces to underscores)
    const cleanName = customerName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    filename = `Invoice_${invoiceNumber}_${cleanName}`;
  }

  // Save PDF with proper invoice number
  doc.save(`${filename}.pdf`);
}

/**
 * Generate Bulk Order Invoices in a single PDF
 */
export function generateBulkOrderInvoices(invoicesData: OrderInvoiceData[]): void {
  if (invoicesData.length === 0) {
    throw new Error('No invoices to generate');
  }

  const doc = new jsPDF();

  invoicesData.forEach((invoiceData, index) => {
    // Add page separator for all invoices except the first one
    if (index > 0) {
      doc.addPage();
    }

    // Generate invoice content for this order
    generateInvoiceContent(doc, invoiceData);
  });

  // Save with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  doc.save(`Bulk_Invoices_${timestamp}.pdf`);
}

/**
 * Generate Purchase Order/Invoice PDF
 */
export function generatePurchaseInvoice(data: PurchaseInvoiceData): void {
  const doc = new jsPDF();
  let yPos = 15;

  // Use provided company info or default
  const COMPANY_INFO = data.companyInfo || DEFAULT_COMPANY_INFO;

  // Header - Company Info
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 14, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.address, 14, yPos);
  yPos += 5;
  doc.text(COMPANY_INFO.city, 14, yPos);
  yPos += 5;
  doc.text(`Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`, 14, yPos);
  yPos += 5;
  doc.text(`GST: ${COMPANY_INFO.gst}`, 14, yPos);

  // Purchase Order Title
  yPos += 10;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', 105, yPos, { align: 'center' });

  // PO Details (Right side)
  yPos = 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`PO No: ${data.purchase.purchase_number}`, 140, yPos);
  yPos += 5;
  doc.text(`Date: ${formatDate(data.purchase.purchase_date)}`, 140, yPos);
  yPos += 5;
  doc.text(`Status: ${data.purchase.purchase_status}`, 140, yPos);

  if (data.purchase.invoice_number) {
    yPos += 5;
    doc.text(`Invoice No: ${data.purchase.invoice_number}`, 140, yPos);
  }

  // Supplier Details
  yPos = 55;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Supplier:', 14, yPos);

  yPos += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.purchase.supplier_name, 14, yPos);

  if (data.purchase.supplier_address) {
    yPos += 5;
    doc.text(data.purchase.supplier_address, 14, yPos);
  }

  if (data.purchase.supplier_city) {
    yPos += 5;
    doc.text(`${data.purchase.supplier_city}, ${data.purchase.supplier_state} - ${data.purchase.supplier_pincode}`, 14, yPos);
  }

  if (data.purchase.supplier_gst) {
    yPos += 5;
    doc.text(`GST: ${data.purchase.supplier_gst}`, 14, yPos);
  }

  // Items Table
  const tableStartY = 95;
  const tableData = data.items.map((item, index) => [
    index + 1,
    item.product_name,
    item.hsn_code || '-',
    item.quantity,
    formatCurrency(item.unit_price),
    formatCurrency(item.discount_amount),
    `${item.gst_percentage}%`,
    formatCurrency(item.cgst_amount + item.sgst_amount + item.igst_amount),
    formatCurrency(item.total)
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Item', 'HSN', 'Qty', 'Rate', 'Disc.', 'GST%', 'Tax', 'Total']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [41, 128, 185], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 50 },
      2: { cellWidth: 20 },
      3: { cellWidth: 15 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: 15 },
      7: { cellWidth: 20 },
      8: { cellWidth: 25 }
    }
  });

  // Get Y position after table
  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 50;

  // Summary Section
  let summaryY = finalY + 10;
  const summaryX = 130;

  doc.setFontSize(10);
  doc.text('Subtotal:', summaryX, summaryY);
  doc.text(formatCurrency(data.purchase.subtotal), 190, summaryY, { align: 'right' });

  summaryY += 6;
  doc.text('Discount:', summaryX, summaryY);
  doc.text(formatCurrency(data.purchase.discount_amount), 190, summaryY, { align: 'right' });

  // Tax breakdown
  if (data.purchase.cgst_amount > 0) {
    summaryY += 6;
    doc.text('CGST:', summaryX, summaryY);
    doc.text(formatCurrency(data.purchase.cgst_amount), 190, summaryY, { align: 'right' });
  }

  if (data.purchase.sgst_amount > 0) {
    summaryY += 6;
    doc.text('SGST:', summaryX, summaryY);
    doc.text(formatCurrency(data.purchase.sgst_amount), 190, summaryY, { align: 'right' });
  }

  if (data.purchase.igst_amount > 0) {
    summaryY += 6;
    doc.text('IGST:', summaryX, summaryY);
    doc.text(formatCurrency(data.purchase.igst_amount), 190, summaryY, { align: 'right' });
  }

  // Total
  summaryY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', summaryX, summaryY);
  doc.text(formatCurrency(data.purchase.total_amount), 190, summaryY, { align: 'right' });

  // Payment Info
  summaryY += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Payment Method: ${data.purchase.payment_method}`, 14, summaryY);
  summaryY += 5;
  doc.text(`Payment Status: ${data.purchase.payment_status}`, 14, summaryY);

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(9);
  doc.text('Thank you for your business!', 105, pageHeight - 20, { align: 'center' });
  doc.text('This is a computer generated document.', 105, pageHeight - 15, { align: 'center' });

  // Save PDF
  doc.save(`PO_${data.purchase.purchase_number}.pdf`);
}

/**
 * Print invoice (opens print dialog)
 */
export function printInvoice(type: 'order' | 'purchase', data: OrderInvoiceData | PurchaseInvoiceData): void {
  // Generate PDF as blob
  const doc = new jsPDF();

  // Generate the invoice content based on type
  if (type === 'order') {
    generateInvoiceContent(doc, data as OrderInvoiceData);
  } else {
    generatePurchaseContent(doc, data as PurchaseInvoiceData);
  }

  // Convert PDF to blob and open in new window for printing
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank');
  if (!printWindow) {
    alert('Please allow popups to print invoices');
    URL.revokeObjectURL(url);
    return;
  }

  // Wait for PDF to load, then trigger print dialog
  printWindow.onload = () => {
    printWindow.print();
    // Clean up the URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}

/**
 * Generate invoice content (extracted logic for reuse) - New Format
 */
function generateInvoiceContent(doc: jsPDF, data: OrderInvoiceData): void {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Use provided company info or default
  const COMPANY_INFO = data.companyInfo || DEFAULT_COMPANY_INFO;

  // Determine invoice type and number
  const isGstInvoice = data.order.is_gst_invoice ?? true;
  const invoiceNumber = isGstInvoice
    ? (data.order.invoice_number_gst || data.order.order_number)
    : (data.order.invoice_number_non_gst || data.order.order_number);

  let yPos = 10;

  // ==================== TITLE ====================
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(isGstInvoice ? 'Tax Invoice' : 'Retail Invoice', pageWidth / 2, yPos, { align: 'center' });

  yPos += 2;

  // ==================== HEADER TABLE ====================
  // Company info and invoice details in a table
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        {
          content: `${COMPANY_INFO.name}\n${COMPANY_INFO.address}\n${COMPANY_INFO.city} (${COMPANY_INFO.pincode})\nPhone no.: ${COMPANY_INFO.phone}\nEmail: ${COMPANY_INFO.email}\nGSTIN: ${COMPANY_INFO.gst}\nState: ${COMPANY_INFO.state}`,
          styles: { cellPadding: 3, fontSize: 9, fontStyle: 'normal', lineColor: [0, 0, 0], lineWidth: 0.5 }
        },
        {
          content: `Invoice No.\n${invoiceNumber}\n\nDate\n${formatDate(data.order.order_date)}`,
          styles: { cellPadding: 3, fontSize: 9, halign: 'left', fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 }
        }
      ]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 60, halign: 'center' }
    }
  });

  // ==================== BILL TO SECTION ====================
  yPos = (doc as any).lastAutoTable.finalY || yPos;

  // Build customer address - use shipping_full_address if available, then fall back to customer.full_address
  let customerAddress = '';

  if (data.order.shipping_full_address) {
    // Use shipping_full_address from order (delivery address)
    customerAddress = data.order.shipping_full_address;
  } else if (data.customer.full_address) {
    // Use full_address from customer table
    customerAddress = data.customer.full_address;
  } else {
    // Fallback to building from order billing fields
    customerAddress = data.customer.company_name
      ? `${data.customer.company_name}\n${data.order.billing_building_name || ''}, ${data.order.billing_street_area || ''}, ${data.order.billing_city}, ${data.order.billing_state} - ${data.order.billing_pincode}`
      : `${data.order.billing_building_name || ''}, ${data.order.billing_street_area || ''}, ${data.order.billing_city}, ${data.order.billing_state} - ${data.order.billing_pincode}`;
  }

  autoTable(doc, {
    startY: yPos,
    head: [[{ content: 'Bill To', styles: { fontStyle: 'bold', fontSize: 9 } }]],
    body: [
      [{
        content: `${data.customer.first_name} ${data.customer.last_name}${data.customer.vip_number ? ` (${data.customer.vip_number})` : ''}\n${customerAddress}\nContact No. : ${data.customer.mobile_primary}${data.customer.whatsapp_number && data.customer.whatsapp_number !== data.customer.mobile_primary ? `\nWhatsApp: ${data.customer.whatsapp_number}` : ''}${data.customer.mobile_secondary_1 ? `\nPh2: ${data.customer.mobile_secondary_1}` : ''}${data.customer.mobile_secondary_2 ? `\nPh3: ${data.customer.mobile_secondary_2}` : ''}`,
        styles: { fontSize: 9, cellPadding: 3 }
      }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 190 }
    }
  });

  // ==================== ITEMS TABLE ====================
  yPos = (doc as any).lastAutoTable.finalY || yPos;

  const itemsTableData = data.items.map((item, index) => {
    const itemSubtotal = item.quantity * item.unit_price;

    // Calculate GST amount - if DB values are 0, calculate from total
    let gstAmount = item.cgst_amount + item.sgst_amount + item.igst_amount;

    if (gstAmount === 0 && item.gst_percentage > 0) {
      // Calculate GST from total (total includes GST)
      const taxableAmount = item.total / (1 + item.gst_percentage / 100);
      gstAmount = item.total - taxableAmount;
    }

    return [
      index + 1,
      item.item_description ? `${item.product_name}\n${item.item_description}` : item.product_name,
      item.hsn_code || '-',
      item.quantity,
      formatCurrency(item.unit_price),
      `${formatCurrency(gstAmount)}\n(${item.gst_percentage}%)`,
      formatCurrency(item.total)
    ];
  });

  // Add total row
  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalGst = data.items.reduce((sum, item) => {
    let gstAmount = item.cgst_amount + item.sgst_amount + item.igst_amount;

    if (gstAmount === 0 && item.gst_percentage > 0) {
      // Calculate GST from total (total includes GST)
      const taxableAmount = item.total / (1 + item.gst_percentage / 100);
      gstAmount = item.total - taxableAmount;
    }

    return sum + gstAmount;
  }, 0);
  const totalAmount = data.order.total_amount;

  itemsTableData.push([
    { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } } as any,
    totalQty,
    '',
    formatCurrency(totalGst),
    formatCurrency(totalAmount)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Item name', 'HSN/SAC', 'Qty', 'Price', 'GST', 'Amount']],
    body: itemsTableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 70, halign: 'left' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 32, halign: 'right' }
    }
  });

  // ==================== AMOUNT IN WORDS & SUMMARY ====================
  yPos = (doc as any).lastAutoTable.finalY || yPos;

  // Calculate amounts
  const receivedAmount = data.order.payment_status.toLowerCase() === 'paid' ? data.order.total_amount : 0;
  const balanceAmount = data.order.total_amount - receivedAmount;
  const amountInWords = numberToWords(data.order.total_amount);

  // Create table with amount in words on left, amounts on right
  autoTable(doc, {
    startY: yPos,
    body: [
      [
        {
          content: `Invoice Amount in Words\n\n${amountInWords}`,
          styles: { fontSize: 9, fontStyle: 'bold', cellPadding: 3 }
        },
        {
          content: `Amounts\n\nSub Total\n\nTotal\n\nReceived\n\nBalance`,
          styles: { fontSize: 9, cellPadding: 3, halign: 'left' }
        },
        {
          content: `\n\n${formatCurrency(data.order.total_amount)}\n\n${formatCurrency(data.order.total_amount)}\n\n${formatCurrency(receivedAmount)}\n\n${formatCurrency(balanceAmount)}`,
          styles: { fontSize: 9, cellPadding: 3, halign: 'right', fontStyle: 'bold' }
        }
      ]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 48 },
      2: { cellWidth: 47 }
    }
  });

  // ==================== HSN/SAC WISE TAX SUMMARY ====================
  yPos = (doc as any).lastAutoTable.finalY || yPos;

  // Group items by HSN code and calculate tax
  const hsnSummary = new Map<string, { taxableAmount: number; cgst: number; sgst: number; igst: number; rate: number }>();

  data.items.forEach(item => {
    const hsn = item.hsn_code || '0000';
    const taxableAmount = (item.quantity * item.unit_price) - item.discount_amount;

    if (!hsnSummary.has(hsn)) {
      hsnSummary.set(hsn, { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, rate: item.gst_percentage });
    }

    const summary = hsnSummary.get(hsn)!;
    summary.taxableAmount += taxableAmount;

    // Calculate GST amounts - if DB values are 0, calculate from total
    let cgst = item.cgst_amount;
    let sgst = item.sgst_amount;
    let igst = item.igst_amount;

    if ((cgst + sgst + igst) === 0 && item.gst_percentage > 0) {
      // Calculate GST from total
      const itemTaxableAmount = item.total / (1 + item.gst_percentage / 100);
      const totalGstForItem = item.total - itemTaxableAmount;

      // Assume intra-state (CGST + SGST), split 50-50
      cgst = totalGstForItem / 2;
      sgst = totalGstForItem / 2;
      igst = 0;
    }

    summary.cgst += cgst;
    summary.sgst += sgst;
    summary.igst += igst;
  });

  const taxTableData: any[] = [];
  let totalTaxableAmount = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalTax = 0;

  hsnSummary.forEach((summary, hsn) => {
    const taxAmount = summary.cgst + summary.sgst + summary.igst;
    totalTaxableAmount += summary.taxableAmount;
    totalCGST += summary.cgst;
    totalSGST += summary.sgst;
    totalIGST += summary.igst;
    totalTax += taxAmount;

    taxTableData.push([
      hsn,
      formatCurrency(summary.taxableAmount),
      summary.cgst > 0 ? `${(summary.rate / 2).toFixed(1)}%` : '-',
      summary.cgst > 0 ? formatCurrency(summary.cgst) : '-',
      summary.sgst > 0 ? `${(summary.rate / 2).toFixed(1)}%` : '-',
      summary.sgst > 0 ? formatCurrency(summary.sgst) : '-',
      formatCurrency(taxAmount)
    ]);
  });

  // Add total row
  taxTableData.push([
    { content: 'Total', styles: { fontStyle: 'bold' } },
    { content: formatCurrency(totalTaxableAmount), styles: { fontStyle: 'bold' } },
    '',
    { content: formatCurrency(totalCGST), styles: { fontStyle: 'bold' } },
    '',
    { content: formatCurrency(totalSGST), styles: { fontStyle: 'bold' } },
    { content: formatCurrency(totalTax), styles: { fontStyle: 'bold' } }
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [[
      { content: 'HSN/ SAC', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      { content: 'Taxable amount', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
      { content: 'CGST', colSpan: 2, styles: { halign: 'center' } },
      { content: 'SGST', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Total Tax Amount', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } }
    ],
    ['Rate', 'Amount', 'Rate', 'Amount']],
    body: taxTableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 38, halign: 'right' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 37, halign: 'right' }
    }
  });

  // ==================== BANK DETAILS ====================
  yPos = (doc as any).lastAutoTable.finalY || yPos;

  autoTable(doc, {
    startY: yPos,
    head: [[{ content: 'Bank Details', styles: { fontStyle: 'bold', fontSize: 9, halign: 'left' } }]],
    body: [
      [{
        content: `Bank Name: ${COMPANY_INFO.bankName}\nAccount Number: ${COMPANY_INFO.accountNumber}\nIFSC Code: ${COMPANY_INFO.ifscCode}\nBranch: ${COMPANY_INFO.branch}`,
        styles: { fontSize: 8, cellPadding: 3, halign: 'left' }
      }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 190 }
    }
  });

  // ==================== FOOTER ====================
  yPos = (doc as any).lastAutoTable.finalY || yPos;

  // Create footer table with terms on left, signatory on right
  autoTable(doc, {
    startY: yPos,
    body: [
      [
        {
          content: `Terms and conditions\n\nThanks for doing business with us!`,
          styles: { fontSize: 9, cellPadding: 3, halign: 'left' }
        },
        {
          content: `For : ${COMPANY_INFO.name}\n\n\n\n\n\nAuthorized Signatory`,
          styles: { fontSize: 9, cellPadding: 3, halign: 'right' }
        }
      ]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 95 }
    }
  });
}

/**
 * Generate purchase content (for purchase invoices)
 */
function generatePurchaseContent(doc: jsPDF, data: PurchaseInvoiceData): void {
  // Similar logic as generatePurchaseInvoice but without the save
  // For brevity, keeping it simple

  // Use provided company info or default
  const COMPANY_INFO = data.companyInfo || DEFAULT_COMPANY_INFO;

  let yPos = 15;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 14, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.address, 14, yPos);
  yPos += 5;
  doc.text(COMPANY_INFO.city, 14, yPos);
  yPos += 5;
  doc.text(`Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`, 14, yPos);
  yPos += 5;
  doc.text(`GST: ${COMPANY_INFO.gst}`, 14, yPos);

  yPos += 10;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', 105, yPos, { align: 'center' });

  // Add remaining purchase invoice content...
  // (Keeping it brief for now)
}

/**
 * Customer Ledger Data Interface
 */
interface CustomerLedgerData {
  customer: {
    first_name: string;
    last_name: string;
    mobile_primary: string;
    mobile_secondary_1?: string | null;
    mobile_secondary_2?: string | null;
    whatsapp_number?: string | null;
    email?: string;
    company_name?: string;
    gst_number?: string;
    vip_number?: string;
  };
  orders: Array<{
    order_number: string;
    invoice_number_gst?: string | null;
    invoice_number_non_gst?: string | null;
    is_gst_invoice?: boolean;
    order_date: string;
    total_amount: number;
    payment_status: string;
    order_status: string;
  }>;
  totalSpent: number;
}

/**
 * Generate Thermal Receipt (58mm/80mm width)
 * Optimized for thermal printers with smaller paper width
 * @param data - Order invoice data
 * @param customerName - Optional customer name for filename
 * @param paymentQrUrl - Optional payment URL for QR code (shown for pending payments)
 */
export async function generateThermalReceipt(data: OrderInvoiceData, customerName?: string, paymentQrUrl?: string): Promise<void> {
  // Create PDF with thermal printer dimensions (80mm width = ~3.15 inches = ~227 points)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 297] // 80mm wide, variable height (A4 height in mm)
  });

  const pageWidth = 80; // mm
  const margin = 3; // mm
  const contentWidth = pageWidth - (margin * 2);

  // Use provided company info or default
  const COMPANY_INFO = data.companyInfo || DEFAULT_COMPANY_INFO;

  // Determine invoice type and number
  const isGstInvoice = data.order.is_gst_invoice ?? true;
  const invoiceNumber = isGstInvoice
    ? (data.order.invoice_number_gst || data.order.order_number)
    : (data.order.invoice_number_non_gst || data.order.order_number);

  let yPos = 5;

  // ==================== HEADER ====================
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, pageWidth / 2, yPos, { align: 'center' });

  yPos += 5.5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Split address into lines if too long
  const addressLines = doc.splitTextToSize(COMPANY_INFO.address, contentWidth);
  addressLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4.5;
  });

  doc.text(`${COMPANY_INFO.city} - ${COMPANY_INFO.pincode}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 4.5;
  doc.text(`Ph: ${COMPANY_INFO.phone}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 4.5;
  doc.text(`GSTIN: ${COMPANY_INFO.gst}`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 4.5;

  // Draw separator line
  doc.setLineWidth(0.2);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // ==================== INVOICE INFO ====================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth / 2, yPos, { align: 'center' });

  yPos += 5.5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice: ${invoiceNumber}`, margin, yPos);
  yPos += 4.5;
  doc.text(`Date: ${formatDate(data.order.order_date)}`, margin, yPos);
  yPos += 4.5;
  doc.text(`Order: ${data.order.order_number}`, margin, yPos);

  yPos += 4;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // ==================== CUSTOMER INFO ====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Bill To:', margin, yPos);
  yPos += 4.5;

  doc.setFont('helvetica', 'bold');
  const custName = `${data.customer.first_name} ${data.customer.last_name}`;
  const vipNumber = data.customer.vip_number;

  if (vipNumber) {
    doc.text(`${custName} (Sd: ${vipNumber})`, margin, yPos);
  } else {
    doc.text(custName, margin, yPos);
  }
  yPos += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Ph: ${data.customer.mobile_primary}`, margin, yPos);
  yPos += 4.5;
  if (data.customer.whatsapp_number && data.customer.whatsapp_number !== data.customer.mobile_primary) {
    doc.text(`WA: ${data.customer.whatsapp_number}`, margin, yPos);
    yPos += 4.5;
  }
  if (data.customer.mobile_secondary_1) {
    doc.text(`Ph2: ${data.customer.mobile_secondary_1}`, margin, yPos);
    yPos += 4.5;
  }
  if (data.customer.mobile_secondary_2) {
    doc.text(`Ph3: ${data.customer.mobile_secondary_2}`, margin, yPos);
    yPos += 4.5;
  }

  // Customer address - use shipping_full_address if available, then fall back to customer.full_address
  const customerAddress = data.order.shipping_full_address ||
    data.customer.full_address ||
    `${data.order.billing_city}, ${data.order.billing_state} - ${data.order.billing_pincode}`;

  const addressSplit = doc.splitTextToSize(customerAddress, contentWidth);
  addressSplit.forEach((line: string) => {
    doc.text(line, margin, yPos);
    yPos += 4.5;
  });

  yPos += 1.5;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // ==================== PRIORITY & NOTES ====================
  if (data.order.is_priority || data.order.order_notes || data.order.customer_notes) {
    if (data.order.is_priority) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('*** PRIORITY ORDER ***', pageWidth / 2, yPos, { align: 'center' });
      yPos += 4.5;
    }

    if (data.order.customer_notes) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Notes:', margin, yPos);
      yPos += 4.5;
      doc.setFont('helvetica', 'normal');
      const custNotesLines = doc.splitTextToSize(data.order.customer_notes, contentWidth);
      custNotesLines.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 4;
      });
    }

    if (data.order.order_notes) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Order Notes:', margin, yPos);
      yPos += 4.5;
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(data.order.order_notes, contentWidth);
      notesLines.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 4;
      });
    }

    yPos += 1.5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;
  }

  // ==================== ITEMS ====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Item', margin, yPos);
  doc.text('Qty', pageWidth - margin - 35, yPos, { align: 'right' });
  doc.text('Rate', pageWidth - margin - 20, yPos, { align: 'right' });
  doc.text('Amount', pageWidth - margin, yPos, { align: 'right' });

  yPos += 4;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  data.items.forEach(item => {
    // Calculate item subtotal (qty × rate, before discount)
    const itemSubtotal = item.quantity * item.unit_price;

    // Item name
    const itemLines = doc.splitTextToSize(item.product_name, contentWidth - 40);
    itemLines.forEach((line: string, idx: number) => {
      doc.text(line, margin, yPos);
      if (idx === 0) {
        // Show qty, rate, amount (subtotal before discount) on first line (no rupee symbol)
        doc.text(item.quantity.toString(), pageWidth - margin - 35, yPos, { align: 'right' });
        doc.text(item.unit_price.toFixed(2), pageWidth - margin - 20, yPos, { align: 'right' });
        doc.text(itemSubtotal.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
      }
      yPos += 4;
    });

    // Show HSN code if available
    if (item.hsn_code) {
      doc.setFontSize(7);
      doc.text(`  HSN: ${item.hsn_code}`, margin, yPos);
      yPos += 3.5;
      doc.setFontSize(8);
    }

    // Show item description if available
    if (item.item_description) {
      doc.setFontSize(7);
      const descLines = doc.splitTextToSize(`  ${item.item_description}`, contentWidth - 10);
      descLines.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 3.5;
      });
      doc.setFontSize(8);
    }

    // Calculate GST amounts
    let cgst = item.cgst_amount;
    let sgst = item.sgst_amount;
    let igst = item.igst_amount;

    if ((cgst + sgst + igst) === 0 && item.gst_percentage > 0) {
      const taxableAmount = item.total / (1 + item.gst_percentage / 100);
      const totalGstForItem = item.total - taxableAmount;
      // Assume intra-state (CGST + SGST), split 50-50
      cgst = totalGstForItem / 2;
      sgst = totalGstForItem / 2;
    }

    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    yPos += 0.5;
  });

  yPos += 0.5;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // ==================== SUMMARY ====================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Subtotal (from order data - before discount, before GST)
  doc.text('Subtotal:', margin, yPos);
  doc.text(data.order.subtotal.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
  yPos += 4.5;

  // Calculate total item discounts
  const totalItemDiscount = data.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  const totalDiscount = totalItemDiscount + (data.order.discount_amount || 0);

  // Show discount if present
  if (totalDiscount > 0) {
    doc.text('Discount:', margin, yPos);
    doc.text(`-${totalDiscount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 4.5;
  }

  // Calculate taxable amount (subtotal - total discount)
  const taxableAmount = data.order.subtotal - totalDiscount;
  doc.text('Taxable Amount:', margin, yPos);
  doc.text(taxableAmount.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
  yPos += 4.5;

  // Show CGST if present
  if (totalCgst > 0) {
    const firstItemRate = data.items[0]?.gst_percentage || 0;
    const cgstRate = firstItemRate / 2;
    doc.text(`CGST @ ${cgstRate.toFixed(1)}%:`, margin, yPos);
    doc.text(totalCgst.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
    yPos += 4.5;
  }

  // Show SGST if present
  if (totalSgst > 0) {
    const firstItemRate = data.items[0]?.gst_percentage || 0;
    const sgstRate = firstItemRate / 2;
    doc.text(`SGST @ ${sgstRate.toFixed(1)}%:`, margin, yPos);
    doc.text(totalSgst.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
    yPos += 4.5;
  }

  // Show IGST if present
  if (totalIgst > 0) {
    const firstItemRate = data.items[0]?.gst_percentage || 0;
    doc.text(`IGST @ ${firstItemRate.toFixed(1)}%:`, margin, yPos);
    doc.text(totalIgst.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
    yPos += 4.5;
  }

  // Show shipping if present
  if (data.order.shipping_charges && data.order.shipping_charges > 0) {
    doc.text('Shipping:', margin, yPos);
    doc.text(data.order.shipping_charges.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
    yPos += 4.5;
  }

  yPos += 0.5;
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', margin, yPos);
  doc.text(data.order.total_amount.toFixed(2), pageWidth - margin, yPos, { align: 'right' });

  yPos += 4.5;
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4.5;

  // ==================== PAYMENT INFO ====================
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Payment: ${data.order.payment_method || 'N/A'}`, margin, yPos);
  yPos += 4.5;
  doc.text(`Status: ${data.order.payment_status}`, margin, yPos);

  yPos += 4.5;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // ==================== PAYMENT QR CODE (for pending payments) ====================
  if (paymentQrUrl && data.order.payment_status.toLowerCase() === 'pending') {
    try {
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(paymentQrUrl, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M',
      });

      // Add QR code section
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('SCAN TO PAY', pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;

      // Add QR code image (centered, 32mm x 32mm)
      const qrSize = 32;
      const qrX = (pageWidth - qrSize) / 2;
      doc.addImage(qrDataUrl, 'PNG', qrX, yPos, qrSize, qrSize);
      yPos += qrSize + 3;

      // Add amount to pay
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Pay: Rs. ${data.order.total_amount.toFixed(2)}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4.5;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Scan QR code with any UPI app', pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;

      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;
    } catch (qrError) {
      console.error('Failed to generate QR code:', qrError);
    }
  }

  // ==================== FOOTER ====================
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for doing business with us!', pageWidth / 2, yPos, { align: 'center' });
  yPos += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Visit again!', pageWidth / 2, yPos, { align: 'center' });

  // Build filename
  let filename = `Thermal_${invoiceNumber}`;
  if (customerName) {
    const cleanName = customerName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    filename = `Thermal_${invoiceNumber}_${cleanName}`;
  }

  // Save PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Generate Bulk Thermal Receipts PDF
 * Creates multiple thermal receipts in a single PDF file
 */
export async function generateBulkThermalReceipts(invoicesData: Array<{ data: OrderInvoiceData; customerName?: string; paymentQrUrl?: string }>): Promise<void> {
  if (invoicesData.length === 0) return;

  // Create PDF with thermal printer dimensions (80mm width = ~3.15 inches = ~227 points)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 297] // 80mm wide, A4 height in mm
  });

  const pageWidth = 80; // mm
  const margin = 3; // mm
  const contentWidth = pageWidth - (margin * 2);

  for (let invoiceIndex = 0; invoiceIndex < invoicesData.length; invoiceIndex++) {
    const invoice = invoicesData[invoiceIndex];
    const data = invoice.data;
    const customerName = invoice.customerName;
    const paymentQrUrl = invoice.paymentQrUrl;

    // Add a new page for each receipt after the first one
    if (invoiceIndex > 0) {
      doc.addPage([80, 297]);
    }

    // Use provided company info or default
    const COMPANY_INFO = data.companyInfo || DEFAULT_COMPANY_INFO;

    // Determine invoice type and number
    const isGstInvoice = data.order.is_gst_invoice ?? true;
    const invoiceNumber = isGstInvoice
      ? (data.order.invoice_number_gst || data.order.order_number)
      : (data.order.invoice_number_non_gst || data.order.order_number);

    let yPos = 5;

    // ==================== HEADER ====================
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(COMPANY_INFO.name, pageWidth / 2, yPos, { align: 'center' });

    yPos += 5.5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Split address into lines if too long
    const addressLines = doc.splitTextToSize(COMPANY_INFO.address, contentWidth);
    addressLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4.5;
    });

    doc.text(`${COMPANY_INFO.city} - ${COMPANY_INFO.pincode}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4.5;
    doc.text(`Ph: ${COMPANY_INFO.phone}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4.5;
    doc.text(`GSTIN: ${COMPANY_INFO.gst}`, pageWidth / 2, yPos, { align: 'center' });

    yPos += 4.5;

    // Draw separator line
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // ==================== INVOICE INFO ====================
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth / 2, yPos, { align: 'center' });

    yPos += 5.5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice: ${invoiceNumber}`, margin, yPos);
    yPos += 4.5;
    doc.text(`Date: ${formatDate(data.order.order_date)}`, margin, yPos);
    yPos += 4.5;
    doc.text(`Order: ${data.order.order_number}`, margin, yPos);

    yPos += 4;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // ==================== CUSTOMER INFO ====================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Bill To:', margin, yPos);
    yPos += 4.5;

    doc.setFont('helvetica', 'bold');
    const custName = `${data.customer.first_name} ${data.customer.last_name}`;
    const vipNumber = data.customer.vip_number;

    if (vipNumber) {
      doc.text(`${custName} (Sd: ${vipNumber})`, margin, yPos);
    } else {
      doc.text(custName, margin, yPos);
    }
    yPos += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Ph: ${data.customer.mobile_primary}`, margin, yPos);
    yPos += 4.5;
    if (data.customer.whatsapp_number && data.customer.whatsapp_number !== data.customer.mobile_primary) {
      doc.text(`WA: ${data.customer.whatsapp_number}`, margin, yPos);
      yPos += 4.5;
    }
    if (data.customer.mobile_secondary_1) {
      doc.text(`Ph2: ${data.customer.mobile_secondary_1}`, margin, yPos);
      yPos += 4.5;
    }
    if (data.customer.mobile_secondary_2) {
      doc.text(`Ph3: ${data.customer.mobile_secondary_2}`, margin, yPos);
      yPos += 4.5;
    }

    // Customer address - use shipping_full_address if available, then fall back to customer.full_address
    const customerAddress = data.order.shipping_full_address ||
      data.customer.full_address ||
      `${data.order.billing_city}, ${data.order.billing_state} - ${data.order.billing_pincode}`;

    const addressSplit = doc.splitTextToSize(customerAddress, contentWidth);
    addressSplit.forEach((line: string) => {
      doc.text(line, margin, yPos);
      yPos += 4.5;
    });

    yPos += 1.5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // ==================== PRIORITY & NOTES ====================
    if (data.order.is_priority || data.order.order_notes || data.order.customer_notes) {
      if (data.order.is_priority) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('*** PRIORITY ORDER ***', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4.5;
      }

      if (data.order.customer_notes) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Customer Notes:', margin, yPos);
        yPos += 4.5;
        doc.setFont('helvetica', 'normal');
        const custNotesLines = doc.splitTextToSize(data.order.customer_notes, contentWidth);
        custNotesLines.forEach((line: string) => {
          doc.text(line, margin, yPos);
          yPos += 4;
        });
      }

      if (data.order.order_notes) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Order Notes:', margin, yPos);
        yPos += 4.5;
        doc.setFont('helvetica', 'normal');
        const notesLines = doc.splitTextToSize(data.order.order_notes, contentWidth);
        notesLines.forEach((line: string) => {
          doc.text(line, margin, yPos);
          yPos += 4;
        });
      }

      yPos += 1.5;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;
    }

    // ==================== ITEMS ====================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Item', margin, yPos);
    doc.text('Qty', pageWidth - margin - 35, yPos, { align: 'right' });
    doc.text('Rate', pageWidth - margin - 20, yPos, { align: 'right' });
    doc.text('Amount', pageWidth - margin, yPos, { align: 'right' });

    yPos += 4;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    data.items.forEach(item => {
      // Calculate item subtotal (qty × rate, before discount)
      const itemSubtotal = item.quantity * item.unit_price;

      // Item name
      const itemLines = doc.splitTextToSize(item.product_name, contentWidth - 40);
      itemLines.forEach((line: string, idx: number) => {
        doc.text(line, margin, yPos);
        if (idx === 0) {
          // Show qty, rate, amount (subtotal before discount) on first line (no rupee symbol)
          doc.text(item.quantity.toString(), pageWidth - margin - 35, yPos, { align: 'right' });
          doc.text(item.unit_price.toFixed(2), pageWidth - margin - 20, yPos, { align: 'right' });
          doc.text(itemSubtotal.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
        }
        yPos += 4;
      });

      // Show HSN code if available
      if (item.hsn_code) {
        doc.setFontSize(7);
        doc.text(`  HSN: ${item.hsn_code}`, margin, yPos);
        yPos += 3.5;
        doc.setFontSize(8);
      }

      // Show item description if available
      if (item.item_description) {
        doc.setFontSize(7);
        const descLines = doc.splitTextToSize(`  ${item.item_description}`, contentWidth - 10);
        descLines.forEach((line: string) => {
          doc.text(line, margin, yPos);
          yPos += 3.5;
        });
        doc.setFontSize(8);
      }

      // Calculate GST amounts
      let cgst = item.cgst_amount;
      let sgst = item.sgst_amount;
      let igst = item.igst_amount;

      if ((cgst + sgst + igst) === 0 && item.gst_percentage > 0) {
        const taxableAmount = item.total / (1 + item.gst_percentage / 100);
        const totalGstForItem = item.total - taxableAmount;
        // Assume intra-state (CGST + SGST), split 50-50
        cgst = totalGstForItem / 2;
        sgst = totalGstForItem / 2;
      }

      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      yPos += 0.5;
    });

    yPos += 0.5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // ==================== SUMMARY ====================
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Subtotal (from order data - before discount, before GST)
    doc.text('Subtotal:', margin, yPos);
    doc.text(data.order.subtotal.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
    yPos += 4.5;

    // Calculate total item discounts
    const totalItemDiscount = data.items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
    const totalDiscount = totalItemDiscount + (data.order.discount_amount || 0);

    // Show discount if present
    if (totalDiscount > 0) {
      doc.text('Discount:', margin, yPos);
      doc.text(`-${totalDiscount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 4.5;
    }

    // Calculate taxable amount (subtotal - total discount)
    const taxableAmount = data.order.subtotal - totalDiscount;
    doc.text('Taxable Amount:', margin, yPos);
    doc.text(taxableAmount.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
    yPos += 4.5;

    // Show CGST if present
    if (totalCgst > 0) {
      const firstItemRate = data.items[0]?.gst_percentage || 0;
      const cgstRate = firstItemRate / 2;
      doc.text(`CGST @ ${cgstRate.toFixed(1)}%:`, margin, yPos);
      doc.text(totalCgst.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
      yPos += 4.5;
    }

    // Show SGST if present
    if (totalSgst > 0) {
      const firstItemRate = data.items[0]?.gst_percentage || 0;
      const sgstRate = firstItemRate / 2;
      doc.text(`SGST @ ${sgstRate.toFixed(1)}%:`, margin, yPos);
      doc.text(totalSgst.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
      yPos += 4.5;
    }

    // Show IGST if present
    if (totalIgst > 0) {
      const firstItemRate = data.items[0]?.gst_percentage || 0;
      doc.text(`IGST @ ${firstItemRate.toFixed(1)}%:`, margin, yPos);
      doc.text(totalIgst.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
      yPos += 4.5;
    }

    // Show shipping if present
    if (data.order.shipping_charges && data.order.shipping_charges > 0) {
      doc.text('Shipping:', margin, yPos);
      doc.text(data.order.shipping_charges.toFixed(2), pageWidth - margin, yPos, { align: 'right' });
      yPos += 4.5;
    }

    yPos += 0.5;
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', margin, yPos);
    doc.text(data.order.total_amount.toFixed(2), pageWidth - margin, yPos, { align: 'right' });

    yPos += 4.5;
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4.5;

    // ==================== PAYMENT INFO ====================
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment: ${data.order.payment_method || 'N/A'}`, margin, yPos);
    yPos += 4.5;
    doc.text(`Status: ${data.order.payment_status}`, margin, yPos);

    yPos += 4.5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // ==================== PAYMENT QR CODE (for pending payments) ====================
    if (paymentQrUrl && data.order.payment_status.toLowerCase() === 'pending') {
      try {
        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(paymentQrUrl, {
          width: 200,
          margin: 1,
          errorCorrectionLevel: 'M',
        });

        // Add QR code section
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('SCAN TO PAY', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;

        // Add QR code image (centered, 32mm x 32mm)
        const qrSize = 32;
        const qrX = (pageWidth - qrSize) / 2;
        doc.addImage(qrDataUrl, 'PNG', qrX, yPos, qrSize, qrSize);
        yPos += qrSize + 3;

        // Add amount to pay
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Pay: Rs. ${data.order.total_amount.toFixed(2)}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4.5;

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Scan QR code with any UPI app', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;

        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4;
      } catch (qrError) {
        console.error('Failed to generate QR code:', qrError);
      }
    }

    // ==================== FOOTER ====================
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for doing business with us!', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Visit again!', pageWidth / 2, yPos, { align: 'center' });
  }

  // Build filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `Thermal_Receipts_Bulk_${invoicesData.length}_${timestamp}`;

  // Save PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Generate Customer Ledger PDF
 * Shows all orders for a customer with totals
 */
export function generateCustomerLedger(data: CustomerLedgerData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Use default company info
  const COMPANY_INFO = DEFAULT_COMPANY_INFO;

  let yPos = 15;

  // ==================== HEADER ====================
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Ledger', pageWidth / 2, yPos, { align: 'center' });

  yPos += 10;

  // ==================== COMPANY INFO ====================
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        {
          content: `${COMPANY_INFO.name}\n${COMPANY_INFO.address}\n${COMPANY_INFO.city} (${COMPANY_INFO.pincode})\nPhone: ${COMPANY_INFO.phone}\nGSTIN: ${COMPANY_INFO.gst}`,
          styles: { cellPadding: 3, fontSize: 9, fontStyle: 'normal' }
        }
      ]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 190 }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY || yPos;

  // ==================== CUSTOMER INFO ====================
  const customerName = `${data.customer.first_name} ${data.customer.last_name}`;
  let customerDetails = `${customerName}\nMobile: ${data.customer.mobile_primary}`;

  if (data.customer.whatsapp_number && data.customer.whatsapp_number !== data.customer.mobile_primary) {
    customerDetails += `\nWhatsApp: ${data.customer.whatsapp_number}`;
  }

  if (data.customer.mobile_secondary_1) {
    customerDetails += `\nPh2: ${data.customer.mobile_secondary_1}`;
  }

  if (data.customer.mobile_secondary_2) {
    customerDetails += `\nPh3: ${data.customer.mobile_secondary_2}`;
  }

  if (data.customer.email) {
    customerDetails += `\nEmail: ${data.customer.email}`;
  }

  if (data.customer.company_name) {
    customerDetails += `\nCompany: ${data.customer.company_name}`;
  }

  if (data.customer.gst_number) {
    customerDetails += `\nGST: ${data.customer.gst_number}`;
  }

  if (data.customer.vip_number) {
    customerDetails += `\nSd #: ${data.customer.vip_number}`;
  }

  autoTable(doc, {
    startY: yPos,
    head: [[{ content: 'Customer Details', styles: { fontStyle: 'bold', fontSize: 10 } }]],
    body: [
      [{
        content: customerDetails,
        styles: { fontSize: 9, cellPadding: 3 }
      }]
    ],
    theme: 'grid',
    styles: { lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 190 }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY || yPos;
  yPos += 5;

  // ==================== ORDERS TABLE ====================
  const ordersTableData = data.orders.map((order, index) => {
    const invoiceNumber = order.is_gst_invoice
      ? (order.invoice_number_gst || order.order_number)
      : (order.invoice_number_non_gst || order.order_number);

    return [
      index + 1,
      formatDate(order.order_date),
      order.order_number,
      invoiceNumber,
      order.order_status,
      order.payment_status,
      formatCurrency(order.total_amount)
    ];
  });

  // Add total row
  ordersTableData.push([
    { content: 'Total', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right' } } as any,
    { content: formatCurrency(data.totalSpent), styles: { fontStyle: 'bold' } }
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Date', 'Order #', 'Invoice #', 'Order Status', 'Payment', 'Amount']],
    body: ordersTableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25, halign: 'left' },
      2: { cellWidth: 35, halign: 'left' },
      3: { cellWidth: 35, halign: 'left' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 30, halign: 'right' }
    }
  });

  // ==================== FOOTER ====================
  yPos = (doc as any).lastAutoTable.finalY || yPos;
  yPos += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generated on: ${formatDate(new Date().toISOString())}`, 14, yPos);

  // Save PDF
  const cleanName = customerName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Customer_Ledger_${cleanName}_${timestamp}.pdf`);
}
