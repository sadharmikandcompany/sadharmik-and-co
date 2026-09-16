import { NextRequest, NextResponse } from 'next/server'
import { getEWayBillClient } from '@/lib/ewaybill/client'
import { supabase } from '@/lib/supabase'

/**
 * Cancel E-Way Bill
 * POST /api/ewaybill/cancel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.ewbNo) {
      return NextResponse.json(
        { error: 'E-Way Bill number is required' },
        { status: 400 }
      )
    }

    if (!body.cancelRsnCode) {
      return NextResponse.json(
        { error: 'Cancel reason code is required' },
        { status: 400 }
      )
    }

    // Call E-Way Bill API
    const client = getEWayBillClient()
    const result = await client.cancelEWayBill(
      body.ewbNo,
      body.cancelRsnCode,
      body.cancelRmrk || 'Cancelled by user'
    )

    // Update database
    const { error: dbError } = await supabase
      .from('ewaybills')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason_code: body.cancelRsnCode,
        cancel_remarks: body.cancelRmrk || 'Cancelled by user',
      })
      .eq('ewaybill_number', body.ewbNo)

    if (dbError) {
      console.error('Database update error:', dbError)
    }

    return NextResponse.json({
      success: true,
      message: 'E-Way Bill cancelled successfully',
      cancelDate: result.cancelDate,
    })
  } catch (error: any) {
    console.error('Cancel E-Way Bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel E-Way Bill' },
      { status: 500 }
    )
  }
}
