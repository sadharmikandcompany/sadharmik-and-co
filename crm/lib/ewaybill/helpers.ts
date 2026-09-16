/**
 * E-Way Bill Helper Functions
 * Utilities for integrating E-Way Bills with Orders and Purchases
 */

import { supabase } from '@/lib/supabase'

export interface EWayBillFromOrder {
  orderId: string
  customerGstin?: string
  vehicleNo?: string
  transportDistance?: string
}

export interface EWayBillFromPurchase {
  purchaseId: string
  supplierGstin?: string
  vehicleNo?: string
  transportDistance?: string
}

/**
 * Get company GSTIN and details from environment or settings
 */
export function getCompanyDetails() {
  return {
    gstin: process.env.COMPANY_GSTIN || '',
    tradeName: process.env.COMPANY_NAME || 'Sadharmik & Company',
    address1: process.env.COMPANY_ADDRESS_LINE1 || '',
    address2: process.env.COMPANY_ADDRESS_LINE2 || '',
    place: process.env.COMPANY_CITY || '',
    pincode: process.env.COMPANY_PINCODE || '',
    stateCode: process.env.COMPANY_STATE_CODE || '',
  }
}

/**
 * Get state code from state name
 */
export function getStateCode(stateName: string): string {
  const stateCodes: Record<string, string> = {
    'Andhra Pradesh': '37',
    'Arunachal Pradesh': '12',
    'Assam': '18',
    'Bihar': '10',
    'Chhattisgarh': '22',
    'Goa': '30',
    'Gujarat': '24',
    'Haryana': '06',
    'Himachal Pradesh': '02',
    'Jharkhand': '20',
    'Karnataka': '29',
    'Kerala': '32',
    'Madhya Pradesh': '23',
    'Maharashtra': '27',
    'Manipur': '14',
    'Meghalaya': '17',
    'Mizoram': '15',
    'Nagaland': '13',
    'Odisha': '21',
    'Punjab': '03',
    'Rajasthan': '08',
    'Sikkim': '11',
    'Tamil Nadu': '33',
    'Telangana': '36',
    'Tripura': '16',
    'Uttar Pradesh': '09',
    'Uttarakhand': '05',
    'West Bengal': '19',
    'Andaman and Nicobar Islands': '35',
    'Chandigarh': '04',
    'Dadra and Nagar Haveli and Daman and Diu': '26',
    'Delhi': '07',
    'Jammu and Kashmir': '01',
    'Ladakh': '38',
    'Lakshadweep': '31',
    'Puducherry': '34',
  }

  return stateCodes[stateName] || ''
}

/**
 * Prepare E-Way Bill data from Order
 */
export async function prepareEWayBillFromOrder(params: EWayBillFromOrder) {
  const { orderId, customerGstin, vehicleNo, transportDistance } = params

  // Fetch order details with items and customer
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      customers (*)
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error('Order not found')
  }

  const company = getCompanyDetails()
  const customer = order.customers

  // Prepare items for E-Way Bill
  const items = order.order_items.map((item: any) => ({
    productName: item.product_name,
    hsnCode: item.hsn_code || '9999', // Default HSN if not available
    quantity: item.quantity,
    qtyUnit: 'PCS',
    taxableAmount: parseFloat(item.subtotal || 0),
    cgstRate: item.cgst_amount ? (parseFloat(item.cgst_amount) / parseFloat(item.subtotal) * 100) : 0,
    sgstRate: item.sgst_amount ? (parseFloat(item.sgst_amount) / parseFloat(item.subtotal) * 100) : 0,
    igstRate: item.igst_amount ? (parseFloat(item.igst_amount) / parseFloat(item.subtotal) * 100) : 0,
    cessRate: 0,
  }))

  // Determine if inter-state or intra-state
  const fromStateCode = getStateCode(company.place) || company.stateCode
  const toStateCode = getStateCode(order.shipping_state) || order.billing_state

  return {
    orderId: order.id,
    supplyType: 'O', // Outward
    subSupplyType: '1', // Supply
    docType: order.is_gst_invoice ? 'INV' : 'BIL',
    docNo: order.invoice_number_gst || order.invoice_number_non_gst || order.order_number,
    docDate: new Date(order.order_date || order.created_at).toISOString().split('T')[0],

    // From (Company)
    fromGstin: company.gstin,
    fromTrdName: company.tradeName,
    fromAddr1: company.address1,
    fromAddr2: company.address2,
    fromPlace: company.place,
    fromPincode: company.pincode,
    fromStateCode: fromStateCode,

    // To (Customer)
    toGstin: customerGstin || customer?.gst_number || 'URP', // URP = Unregistered Person
    toTrdName: customer?.company_name || `${customer?.first_name} ${customer?.last_name}`,
    toAddr1: order.shipping_building_name || order.billing_building_name,
    toAddr2: order.shipping_street_area || order.billing_street_area,
    toPlace: order.shipping_city || order.billing_city,
    toPincode: order.shipping_pincode || order.billing_pincode,
    toStateCode: toStateCode,

    // Transport
    transMode: '1', // Road
    vehicleNo: vehicleNo || '',
    transDistance: transportDistance || '100',

    // Items
    items: items,
  }
}

/**
 * Prepare E-Way Bill data from Purchase
 */
export async function prepareEWayBillFromPurchase(params: EWayBillFromPurchase) {
  const { purchaseId, supplierGstin, vehicleNo, transportDistance } = params

  // Fetch purchase details with items and vendor
  const { data: purchase, error } = await supabase
    .from('purchases')
    .select(`
      *,
      purchase_items (*),
      vendors (*)
    `)
    .eq('id', purchaseId)
    .single()

  if (error || !purchase) {
    throw new Error('Purchase not found')
  }

  const company = getCompanyDetails()
  const vendor = purchase.vendors

  // Prepare items for E-Way Bill
  const items = purchase.purchase_items.map((item: any) => ({
    productName: item.product_name,
    hsnCode: item.hsn_code || '9999',
    quantity: item.quantity,
    qtyUnit: 'PCS',
    taxableAmount: parseFloat(item.subtotal || 0),
    cgstRate: item.cgst_amount ? (parseFloat(item.cgst_amount) / parseFloat(item.subtotal) * 100) : 0,
    sgstRate: item.sgst_amount ? (parseFloat(item.sgst_amount) / parseFloat(item.subtotal) * 100) : 0,
    igstRate: item.igst_amount ? (parseFloat(item.igst_amount) / parseFloat(item.subtotal) * 100) : 0,
    cessRate: 0,
  }))

  // Determine state codes
  const fromStateCode = getStateCode(purchase.supplier_state || vendor?.state || '')
  const toStateCode = getStateCode(company.place) || company.stateCode

  return {
    purchaseId: purchase.id,
    supplyType: 'I', // Inward
    subSupplyType: '1', // Supply
    docType: 'INV',
    docNo: purchase.invoice_number || purchase.purchase_number,
    docDate: new Date(purchase.invoice_date || purchase.purchase_date || purchase.created_at).toISOString().split('T')[0],

    // From (Supplier/Vendor)
    fromGstin: supplierGstin || vendor?.gst_number || purchase.supplier_gst_number || 'URP',
    fromTrdName: purchase.supplier_name || vendor?.vendor_name,
    fromAddr1: purchase.supplier_address_line1 || vendor?.address_line1 || '',
    fromAddr2: purchase.supplier_address_line2 || vendor?.address_line2 || '',
    fromPlace: purchase.supplier_city || vendor?.city || '',
    fromPincode: purchase.supplier_pincode || vendor?.pincode || '',
    fromStateCode: fromStateCode,

    // To (Company)
    toGstin: company.gstin,
    toTrdName: company.tradeName,
    toAddr1: company.address1,
    toAddr2: company.address2,
    toPlace: company.place,
    toPincode: company.pincode,
    toStateCode: toStateCode,

    // Transport
    transMode: '1', // Road
    vehicleNo: vehicleNo || vendor?.transport_vehicle || '',
    transDistance: transportDistance || '100',

    // Items
    items: items,
  }
}

/**
 * Get E-Way Bills for an Order
 */
export async function getEWayBillsForOrder(orderId: string) {
  const { data, error } = await supabase
    .from('ewaybills')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching E-Way Bills:', error)
    return []
  }

  return data || []
}

/**
 * Get E-Way Bills for a Purchase
 */
export async function getEWayBillsForPurchase(purchaseId: string) {
  const { data, error } = await supabase
    .from('ewaybills')
    .select('*')
    .eq('purchase_id', purchaseId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching E-Way Bills:', error)
    return []
  }

  return data || []
}

/**
 * Check if E-Way Bill is expired
 */
export function isEWayBillExpired(validUpto: string): boolean {
  return new Date(validUpto) < new Date()
}

/**
 * Get E-Way Bill status with validity check
 */
export function getEWayBillStatus(ewaybill: any): string {
  if (ewaybill.status === 'cancelled') {
    return 'cancelled'
  }

  if (isEWayBillExpired(ewaybill.valid_upto)) {
    return 'expired'
  }

  return 'active'
}

/**
 * Format E-Way Bill number for display
 */
export function formatEWayBillNumber(ewbNo: string): string {
  // E-Way Bill numbers are 12 digits, format as XXX XXX XXX XXX
  if (ewbNo.length === 12) {
    return ewbNo.match(/.{1,3}/g)?.join(' ') || ewbNo
  }
  return ewbNo
}
