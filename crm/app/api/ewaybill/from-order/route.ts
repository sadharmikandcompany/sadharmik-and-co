import { NextRequest, NextResponse } from 'next/server'
import { prepareEWayBillFromOrder } from '@/lib/ewaybill/helpers'

/**
 * Prepare E-Way Bill data from Order
 * POST /api/ewaybill/from-order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const ewaybillData = await prepareEWayBillFromOrder({
      orderId: body.orderId,
      customerGstin: body.customerGstin,
      vehicleNo: body.vehicleNo,
      transportDistance: body.transportDistance,
    })

    return NextResponse.json({
      success: true,
      data: ewaybillData,
    })
  } catch (error: any) {
    console.error('Prepare E-Way Bill from order error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to prepare E-Way Bill data' },
      { status: 500 }
    )
  }
}
