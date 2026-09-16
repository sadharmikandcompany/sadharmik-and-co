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
    const { irn, reason, remarks } = body

    if (!irn || !reason) {
      return NextResponse.json(
        { success: false, error: 'IRN and cancellation reason are required' },
        { status: 400 }
      )
    }

    // Check if invoice exists and can be cancelled
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

    if (invoice.status === 'CANCELLED') {
      return NextResponse.json(
        { success: false, error: 'E-Invoice is already cancelled' },
        { status: 400 }
      )
    }

    // Check if within 24 hours of generation
    const generatedAt = new Date(invoice.ack_dt)
    const now = new Date()
    const hoursDiff = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60)

    if (hoursDiff > 24) {
      return NextResponse.json(
        { success: false, error: 'E-Invoice can only be cancelled within 24 hours of generation' },
        { status: 400 }
      )
    }

    // Cancel through GSTN API
    const gstnResponse = await gstnClient.cancelEInvoice(irn, reason, remarks)

    if (gstnResponse.Status !== 'CNL') {
      return NextResponse.json(
        {
          success: false,
          error: gstnResponse.ErrorDetails?.error_message || 'Failed to cancel e-invoice'
        },
        { status: 400 }
      )
    }

    // Update database
    const { error: updateError } = await supabase
      .from('einvoices')
      .update({
        status: 'CANCELLED',
        cancellation_reason: `${reason}: ${remarks || ''}`,
        cancellation_date: now.toISOString(),
        response_payload: gstnResponse
      })
      .eq('id', invoice.id)

    if (updateError) {
      console.error('Error updating e-invoice status:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: 'E-invoice cancelled but failed to update database'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'E-Invoice cancelled successfully',
      cancel_date: gstnResponse.CancelDate
    })

  } catch (error) {
    console.error('Error cancelling e-invoice:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}