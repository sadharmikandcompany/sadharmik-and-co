import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Fetch orders that:
    // 1. Have customer GST number
    // 2. Don't have an e-invoice generated yet
    // 3. Are in specific statuses (delivered, completed, etc.)

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_id,
        customer_first_name,
        customer_last_name,
        customer_full_name,
        customer_gst_number,
        customer_pan_number,
        total_amount,
        order_date,
        order_status,
        invoice_number_gst,
        invoice_number_non_gst
      `)
      .not('customer_gst_number', 'is', null)
      .in('order_status', ['delivered', 'completed', 'shipped'])
      .order('order_date', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Check which orders already have e-invoices
    const orderIds = orders?.map(o => o.id) || []

    const { data: existingInvoices } = await supabase
      .from('einvoices')
      .select('order_id')
      .in('order_id', orderIds)
      .eq('status', 'GENERATED')

    const existingOrderIds = new Set(existingInvoices?.map(i => i.order_id))

    // Filter out orders that already have e-invoices
    const pendingOrders = orders?.filter(order => !existingOrderIds.has(order.id)) || []

    // Format response
    const formattedOrders = pendingOrders.map(order => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_full_name ||
                     `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() ||
                     'Unknown Customer',
      customer_gst_number: order.customer_gst_number,
      total_amount: order.total_amount,
      order_date: order.order_date,
      order_status: order.order_status,
      invoice_number_gst: order.invoice_number_gst
    }))

    return NextResponse.json(formattedOrders)

  } catch (error) {
    console.error('Error fetching pending orders:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}