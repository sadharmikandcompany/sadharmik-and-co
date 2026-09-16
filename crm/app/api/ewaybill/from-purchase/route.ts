import { NextRequest, NextResponse } from 'next/server'
import { prepareEWayBillFromPurchase } from '@/lib/ewaybill/helpers'

/**
 * Prepare E-Way Bill data from Purchase
 * POST /api/ewaybill/from-purchase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.purchaseId) {
      return NextResponse.json(
        { error: 'Purchase ID is required' },
        { status: 400 }
      )
    }

    const ewaybillData = await prepareEWayBillFromPurchase({
      purchaseId: body.purchaseId,
      supplierGstin: body.supplierGstin,
      vehicleNo: body.vehicleNo,
      transportDistance: body.transportDistance,
    })

    return NextResponse.json({
      success: true,
      data: ewaybillData,
    })
  } catch (error: any) {
    console.error('Prepare E-Way Bill from purchase error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to prepare E-Way Bill data' },
      { status: 500 }
    )
  }
}
