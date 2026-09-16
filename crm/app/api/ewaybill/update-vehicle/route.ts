import { NextRequest, NextResponse } from 'next/server'
import { getEWayBillClient } from '@/lib/ewaybill/client'
import { supabase } from '@/lib/supabase'

/**
 * Update Vehicle Details for E-Way Bill
 * PUT /api/ewaybill/update-vehicle
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.ewbNo) {
      return NextResponse.json(
        { error: 'E-Way Bill number is required' },
        { status: 400 }
      )
    }

    if (!body.vehicleNo) {
      return NextResponse.json(
        { error: 'New vehicle number is required' },
        { status: 400 }
      )
    }

    // Get current E-Way Bill record
    const { data: currentRecord } = await supabase
      .from('ewaybills')
      .select('vehicle_number, vehicle_update_history')
      .eq('ewaybill_number', body.ewbNo)
      .single()

    // Call E-Way Bill API
    const client = getEWayBillClient()
    const result = await client.updateVehicle(
      body.ewbNo,
      body.vehicleNo,
      body.reasonCode || '1', // 1 = Due to Break Down
      body.reasonRem || 'Vehicle changed'
    )

    // Prepare update history
    const updateHistory = currentRecord?.vehicle_update_history || []
    updateHistory.push({
      old_vehicle: currentRecord?.vehicle_number,
      new_vehicle: body.vehicleNo,
      reason_code: body.reasonCode || '1',
      reason: body.reasonRem || 'Vehicle changed',
      updated_at: new Date().toISOString(),
    })

    // Update database
    const { error: dbError } = await supabase
      .from('ewaybills')
      .update({
        vehicle_number: body.vehicleNo,
        vehicle_update_history: updateHistory,
        valid_upto: result.validUpto ? new Date(result.validUpto).toISOString() : undefined,
      })
      .eq('ewaybill_number', body.ewbNo)

    if (dbError) {
      console.error('Database update error:', dbError)
    }

    return NextResponse.json({
      success: true,
      message: 'Vehicle details updated successfully',
      validUpto: result.validUpto,
    })
  } catch (error: any) {
    console.error('Update vehicle error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update vehicle details' },
      { status: 500 }
    )
  }
}
