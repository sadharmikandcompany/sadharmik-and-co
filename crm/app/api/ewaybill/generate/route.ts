import { NextRequest, NextResponse } from 'next/server'
import { getEWayBillClient } from '@/lib/ewaybill/client'
import { supabase } from '@/lib/supabase'

/**
 * Generate E-Way Bill
 * POST /api/ewaybill/generate
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['supplyType', 'docType', 'docNo', 'docDate', 'fromGstin', 'toGstin']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      )
    }

    // Calculate totals
    let totalValue = 0
    let cgstValue = 0
    let sgstValue = 0
    let igstValue = 0
    let cessValue = 0

    const itemList = body.items.map((item: any) => {
      const cgst = (item.taxableAmount * item.cgstRate) / 100
      const sgst = (item.taxableAmount * item.sgstRate) / 100
      const igst = (item.taxableAmount * item.igstRate) / 100
      const cess = (item.taxableAmount * (item.cessRate || 0)) / 100

      totalValue += item.taxableAmount
      cgstValue += cgst
      sgstValue += sgst
      igstValue += igst
      cessValue += cess

      return {
        productName: item.productName,
        productDesc: item.productName,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        qtyUnit: item.qtyUnit || 'PCS',
        cgstRate: item.cgstRate,
        sgstRate: item.sgstRate,
        igstRate: item.igstRate,
        cessRate: item.cessRate || 0,
        taxableAmount: item.taxableAmount,
      }
    })

    // Prepare E-Way Bill payload
    const ewaybillPayload = {
      supplyType: body.supplyType,
      subSupplyType: body.subSupplyType || '1',
      subSupplyDesc: body.subSupplyDesc || '', // Required when subSupplyType is 'others'
      docType: body.docType,
      docNo: body.docNo,
      docDate: body.docDate,
      fromGstin: body.fromGstin,
      fromTrdName: body.fromTrdName,
      fromAddr1: body.fromAddr1,
      fromAddr2: body.fromAddr2 || '',
      fromPlace: body.fromPlace,
      fromPincode: body.fromPincode,
      fromStateCode: body.fromStateCode,
      actFromStateCode: body.fromStateCode,
      toGstin: body.toGstin,
      toTrdName: body.toTrdName,
      toAddr1: body.toAddr1,
      toAddr2: body.toAddr2 || '',
      toPlace: body.toPlace,
      toPincode: body.toPincode,
      toStateCode: body.toStateCode,
      actToStateCode: body.toStateCode,
      transactionType: body.transactionType || '1',
      totalValue: totalValue,
      cgstValue: cgstValue,
      sgstValue: sgstValue,
      igstValue: igstValue,
      cessValue: cessValue,
      totInvValue: totalValue + cgstValue + sgstValue + igstValue + cessValue,
      transporterId: body.transporterId || '',
      transporterName: body.transporterName || '',
      transDocNo: body.transDocNo || '',
      transMode: body.transMode || '1',
      transDistance: body.transDistance || '0',
      transDocDate: body.transDocDate || body.docDate,
      vehicleNo: body.vehicleNo || '',
      vehicleType: body.vehicleType || 'R',
      itemList: itemList,
    }

    // Call E-Way Bill API
    const client = getEWayBillClient()
    const result = await client.generateEWayBill(ewaybillPayload)

    // Save to database
    const { data: ewaybillRecord, error: dbError } = await supabase
      .from('ewaybills')
      .insert({
        ewaybill_number: result.ewayBillNo.toString(),
        ewaybill_date: new Date(result.ewayBillDate).toISOString(),
        valid_upto: new Date(result.validUpto).toISOString(),
        status: 'active',
        order_id: body.orderId || null,
        purchase_id: body.purchaseId || null,
        supply_type: body.supplyType,
        sub_supply_type: body.subSupplyType || '1',
        sub_supply_desc: body.subSupplyDesc || '',
        doc_type: body.docType,
        doc_number: body.docNo,
        doc_date: body.docDate,
        from_gstin: body.fromGstin,
        from_trade_name: body.fromTrdName,
        from_address1: body.fromAddr1,
        from_address2: body.fromAddr2 || '',
        from_place: body.fromPlace,
        from_pincode: body.fromPincode,
        from_state_code: body.fromStateCode,
        to_gstin: body.toGstin,
        to_trade_name: body.toTrdName,
        to_address1: body.toAddr1,
        to_address2: body.toAddr2 || '',
        to_place: body.toPlace,
        to_pincode: body.toPincode,
        to_state_code: body.toStateCode,
        transporter_id: body.transporterId || '',
        transporter_name: body.transporterName || '',
        trans_doc_number: body.transDocNo || '',
        trans_mode: body.transMode || '1',
        trans_distance: body.transDistance || '0',
        vehicle_number: body.vehicleNo || '',
        vehicle_type: body.vehicleType || 'R',
        total_value: totalValue,
        cgst_amount: cgstValue,
        sgst_amount: sgstValue,
        igst_amount: igstValue,
        cess_amount: cessValue,
        total_invoice_value: totalValue + cgstValue + sgstValue + igstValue + cessValue,
        api_response: result,
        created_by_user_id: body.userId || null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Don't fail the request if DB insert fails, but log it
    }

    return NextResponse.json({
      success: true,
      ewayBillNo: result.ewayBillNo,
      ewayBillDate: result.ewayBillDate,
      validUpto: result.validUpto,
      alert: result.alert,
      recordId: ewaybillRecord?.id,
    })
  } catch (error: any) {
    console.error('Generate E-Way Bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate E-Way Bill' },
      { status: 500 }
    )
  }
}
