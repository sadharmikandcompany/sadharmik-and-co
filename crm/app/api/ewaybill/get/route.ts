import { NextRequest, NextResponse } from 'next/server'
import { getEWayBillClient } from '@/lib/ewaybill/client'

/**
 * Get E-Way Bill Details
 * GET /api/ewaybill/get?ewbNo=123456789012
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ewbNo = searchParams.get('ewbNo')

    if (!ewbNo) {
      return NextResponse.json(
        { error: 'E-Way Bill number is required' },
        { status: 400 }
      )
    }

    // Call E-Way Bill API
    const client = getEWayBillClient()
    const result = await client.getEWayBill(ewbNo)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Get E-Way Bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch E-Way Bill details' },
      { status: 500 }
    )
  }
}
