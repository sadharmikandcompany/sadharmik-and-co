import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import GSTNApiClient from '@/lib/gstn/api-client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Initialize GSTN client with credentials from environment
const gstnClient = new GSTNApiClient({
  baseUrl: process.env.GSTN_BASE_URL || 'https://einv-apisandbox.nic.in',
  clientId: process.env.GSTN_CLIENT_ID || '',
  clientSecret: process.env.GSTN_CLIENT_SECRET || '',
  gstin: process.env.COMPANY_GSTIN || '',
  username: process.env.GSTN_USERNAME || '',
  password: process.env.GSTN_PASSWORD || '',
  isSandbox: process.env.GSTN_SANDBOX === 'true'
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_id, purchase_id, invoice_type = 'INV' } = body

    if (!order_id && !purchase_id) {
      return NextResponse.json(
        { success: false, error: 'Either order_id or purchase_id is required' },
        { status: 400 }
      )
    }

    // Fetch order or purchase details
    let documentData: any = null
    let items: any[] = []
    let customerData: any = null

    if (order_id) {
      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single()

      if (orderError || !order) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        )
      }

      // Fetch order items
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order_id)

      if (itemsError || !orderItems || orderItems.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No items found for this order' },
          { status: 404 }
        )
      }

      // Fetch customer details
      if (order.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', order.customer_id)
          .single()

        customerData = customer
      }

      documentData = order
      items = orderItems
    } else if (purchase_id) {
      // Fetch purchase details
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchase_id)
        .single()

      if (purchaseError || !purchase) {
        return NextResponse.json(
          { success: false, error: 'Purchase not found' },
          { status: 404 }
        )
      }

      // Fetch purchase items
      const { data: purchaseItems, error: itemsError } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', purchase_id)

      if (itemsError || !purchaseItems || purchaseItems.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No items found for this purchase' },
          { status: 404 }
        )
      }

      documentData = purchase
      items = purchaseItems

      // For purchase, buyer details come from purchase record
      customerData = {
        company_name: purchase.supplier_name,
        gst_number: purchase.supplier_gst_number,
        email: purchase.supplier_email,
        mobile_primary: purchase.supplier_phone,
        billing_building_name: purchase.supplier_address_line1,
        billing_street_area: purchase.supplier_address_line2,
        billing_city: purchase.supplier_city,
        billing_state: purchase.supplier_state,
        billing_pincode: purchase.supplier_pincode
      }
    }

    // Check if GST number exists
    if (!customerData?.gst_number) {
      return NextResponse.json(
        { success: false, error: 'Customer/Supplier GST number is required for e-invoice generation' },
        { status: 400 }
      )
    }

    // Prepare e-invoice data
    const einvoiceData = gstnClient.formatEInvoiceFromOrder(
      documentData,
      customerData,
      items
    )

    // Generate e-invoice through GSTN API
    const gstnResponse = await gstnClient.generateEInvoice(einvoiceData)

    if (!gstnResponse.success || !gstnResponse.result) {
      // Save failed attempt to database
      await supabase.from('einvoices').insert({
        order_id: order_id || null,
        purchase_id: purchase_id || null,
        invoice_type,
        invoice_number: documentData.invoice_number_gst || documentData.order_number || documentData.purchase_number,
        doc_date: new Date().toISOString().split('T')[0],
        buyer_gstin: customerData.gst_number,
        buyer_name: customerData.company_name || `${customerData.first_name} ${customerData.last_name}`,
        buyer_address: {
          building: customerData.billing_building_name,
          street: customerData.billing_street_area,
          city: customerData.billing_city,
          state: customerData.billing_state,
          pincode: customerData.billing_pincode
        },
        buyer_state_code: customerData.billing_state?.substring(0, 2) || '',
        total_items: items.length,
        assessed_value: parseFloat(documentData.subtotal),
        cgst_value: parseFloat(documentData.cgst_amount || '0'),
        sgst_value: parseFloat(documentData.sgst_amount || '0'),
        igst_value: parseFloat(documentData.igst_amount || '0'),
        total_invoice_value: parseFloat(documentData.total_amount),
        status: 'FAILED',
        request_payload: einvoiceData,
        response_payload: gstnResponse,
        error_details: gstnResponse.error
      })

      return NextResponse.json(
        {
          success: false,
          error: gstnResponse.error?.error_message || 'Failed to generate e-invoice'
        },
        { status: 400 }
      )
    }

    // Save successful e-invoice to database
    const { data: savedInvoice, error: saveError } = await supabase
      .from('einvoices')
      .insert({
        order_id: order_id || null,
        purchase_id: purchase_id || null,
        invoice_type,
        invoice_number: documentData.invoice_number_gst || documentData.order_number || documentData.purchase_number,
        irn: gstnResponse.result.Irn,
        ack_no: gstnResponse.result.AckNo,
        ack_dt: gstnResponse.result.AckDt,
        signed_invoice: gstnResponse.result.SignedInvoice,
        signed_qr_code: gstnResponse.result.SignedQRCode,
        ewb_no: gstnResponse.result.EwbNo,
        ewb_dt: gstnResponse.result.EwbDt,
        ewb_valid_till: gstnResponse.result.EwbValidTill,
        doc_date: new Date().toISOString().split('T')[0],
        supply_type: 'B2B',
        seller_gstin: process.env.COMPANY_GSTIN,
        seller_name: process.env.COMPANY_NAME,
        seller_address: {
          building: process.env.COMPANY_ADDRESS_LINE1,
          street: process.env.COMPANY_ADDRESS_LINE2,
          city: process.env.COMPANY_CITY,
          state: process.env.COMPANY_STATE,
          pincode: process.env.COMPANY_PINCODE
        },
        buyer_gstin: customerData.gst_number,
        buyer_name: customerData.company_name || `${customerData.first_name} ${customerData.last_name}`,
        buyer_address: {
          building: customerData.billing_building_name,
          street: customerData.billing_street_area,
          city: customerData.billing_city,
          state: customerData.billing_state,
          pincode: customerData.billing_pincode
        },
        buyer_state_code: customerData.billing_state?.substring(0, 2) || '',
        total_items: items.length,
        assessed_value: parseFloat(documentData.subtotal),
        cgst_value: parseFloat(documentData.cgst_amount || '0'),
        sgst_value: parseFloat(documentData.sgst_amount || '0'),
        igst_value: parseFloat(documentData.igst_amount || '0'),
        total_invoice_value: parseFloat(documentData.total_amount),
        status: 'GENERATED',
        request_payload: einvoiceData,
        response_payload: gstnResponse.result
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving e-invoice:', saveError)
      return NextResponse.json(
        {
          success: false,
          error: 'E-invoice generated but failed to save to database'
        },
        { status: 500 }
      )
    }

    // Save invoice items
    const invoiceItems = items.map((item, index) => ({
      einvoice_id: savedInvoice.id,
      sl_no: index + 1,
      product_name: item.product_name,
      product_desc: item.product_desc,
      is_service: false,
      hsn_code: item.hsn_code,
      quantity: item.quantity,
      unit: 'PCS',
      unit_price: parseFloat(item.unit_price),
      gross_amount: parseFloat(item.subtotal),
      discount_amount: parseFloat(item.discount_amount || '0'),
      taxable_value: parseFloat(item.subtotal),
      gst_rate: parseFloat(item.gst_percentage || '18'),
      igst_amount: parseFloat(item.igst_amount || '0'),
      cgst_amount: parseFloat(item.cgst_amount || '0'),
      sgst_amount: parseFloat(item.sgst_amount || '0'),
      total_item_value: parseFloat(item.total)
    }))

    await supabase.from('einvoice_items').insert(invoiceItems)

    // Update order/purchase with IRN
    if (order_id) {
      await supabase
        .from('orders')
        .update({ invoice_number_gst: savedInvoice.invoice_number })
        .eq('id', order_id)
    }

    return NextResponse.json({
      success: true,
      message: 'E-Invoice generated successfully',
      irn: gstnResponse.result.Irn,
      ack_no: gstnResponse.result.AckNo,
      ack_dt: gstnResponse.result.AckDt,
      ewb_no: gstnResponse.result.EwbNo,
      invoice_id: savedInvoice.id
    })

  } catch (error) {
    console.error('Error generating e-invoice:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}