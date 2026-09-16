import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import GSTNApiClient from '@/lib/gstn/api-client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const {
      irn,
      distance = 100,
      trans_mode = '1',
      trans_id,
      trans_name,
      trans_doc_dt,
      trans_doc_no,
      vehicle_no,
      vehicle_type = 'R'
    } = body

    if (!irn) {
      return NextResponse.json(
        { success: false, error: 'IRN is required' },
        { status: 400 }
      )
    }

    // Check if invoice exists
    const { data: invoice, error: fetchError } = await supabase
      .from('einvoices')
      .select('*')
      .eq('irn', irn)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json(
        { success: false, error: 'E-Invoice not found' },
        { status: 404 }
      )
    }

    if (invoice.status !== 'GENERATED') {
      return NextResponse.json(
        { success: false, error: 'E-Invoice is not in valid status for e-way bill generation' },
        { status: 400 }
      )
    }

    if (invoice.ewb_no) {
      return NextResponse.json(
        { success: false, error: 'E-Way Bill already exists for this invoice' },
        { status: 400 }
      )
    }

    // Generate e-way bill through GSTN API
    const ewayBillData = {
      Irn: irn,
      Distance: distance,
      TransMode: trans_mode,
      TransId: trans_id,
      TransName: trans_name,
      TransDocDt: trans_doc_dt,
      TransDocNo: trans_doc_no,
      VehNo: vehicle_no,
      VehType: vehicle_type
    }

    const gstnResponse = await gstnClient.generateEWayBillByIRN(ewayBillData)

    if (gstnResponse.Status !== 'ACT' || !gstnResponse.EwbNo) {
      return NextResponse.json(
        {
          success: false,
          error: gstnResponse.ErrorDetails?.error_message || 'Failed to generate e-way bill'
        },
        { status: 400 }
      )
    }

    // Update e-invoice with e-way bill details
    const { error: updateInvoiceError } = await supabase
      .from('einvoices')
      .update({
        ewb_no: gstnResponse.EwbNo,
        ewb_dt: gstnResponse.EwbDt,
        ewb_valid_till: gstnResponse.EwbValidTill,
        response_payload: gstnResponse
      })
      .eq('id', invoice.id)

    if (updateInvoiceError) {
      console.error('Error updating e-invoice with e-way bill:', updateInvoiceError)
    }

    // Create e-way bill record
    const { error: insertError } = await supabase
      .from('ewaybills')
      .insert({
        order_id: invoice.order_id,
        purchase_id: invoice.purchase_id,
        einvoice_id: invoice.id,
        ewb_no: gstnResponse.EwbNo,
        ewb_date: gstnResponse.EwbDt,
        ewb_valid_till: gstnResponse.EwbValidTill,
        doc_type: 'INV',
        doc_no: invoice.invoice_number,
        doc_date: invoice.doc_date,
        trans_id,
        trans_name,
        trans_mode,
        trans_distance: distance,
        trans_doc_no,
        trans_doc_date: trans_doc_dt,
        vehicle_no,
        vehicle_type,
        from_gstin: invoice.seller_gstin,
        from_name: invoice.seller_name,
        from_address: invoice.seller_address,
        to_gstin: invoice.buyer_gstin,
        to_name: invoice.buyer_name,
        to_address: invoice.buyer_address,
        total_value: invoice.total_invoice_value,
        cgst_value: invoice.cgst_value,
        sgst_value: invoice.sgst_value,
        igst_value: invoice.igst_value,
        cess_value: invoice.cess_value,
        status: 'ACTIVE',
        request_payload: ewayBillData,
        response_payload: gstnResponse
      })

    if (insertError) {
      console.error('Error creating e-way bill record:', insertError)
    }

    return NextResponse.json({
      success: true,
      message: 'E-Way Bill generated successfully',
      ewb_no: gstnResponse.EwbNo,
      ewb_dt: gstnResponse.EwbDt,
      ewb_valid_till: gstnResponse.EwbValidTill
    })

  } catch (error) {
    console.error('Error generating e-way bill:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}