import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CRM domain for order page redirect
const CRM_DOMAIN = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'https://crm.sadharmikandcompany.com';

// Handle POST callback from Easebuzz after payment (success or failure)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log('Easebuzz CRM callback received:', params);

    const status = params.status;
    const txnid = params.txnid || ''; // This is the order_number (e.g., ORD-1234567890)
    const udf1 = params.udf1 || ''; // Order ID (UUID)
    const udf2 = params.udf2 || ''; // Source identifier ('crm_invoice')
    const easepayid = params.easepayid || '';

    // Verify this is a CRM payment
    if (udf2 !== 'crm_invoice' || !udf1) {
      console.error('Invalid CRM callback - missing udf1 or udf2');
      return NextResponse.redirect(`${CRM_DOMAIN}/dashboard/orders?error=invalid_callback`, { status: 303 });
    }

    if (status === 'success') {
      try {
        // Update order payment status using order ID (udf1)
        const { data: orderData, error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'completed',
            payment_method: 'upi',
            easebuzz_txn_id: easepayid || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', udf1)
          .select('order_number')
          .single();

        if (updateError) {
          console.error('Failed to update order payment status:', updateError);
          // Fallback to txnid which is the order_number
          return NextResponse.redirect(`${CRM_DOMAIN}/order/${txnid}?payment=error`, { status: 303 });
        }

        console.log('Order payment status updated successfully:', udf1);

        // Redirect to order page using order_number (the page expects order_number in URL)
        const orderNumber = orderData?.order_number || txnid;
        return NextResponse.redirect(`${CRM_DOMAIN}/order/${orderNumber}?payment=success`, { status: 303 });
      } catch (dbError) {
        console.error('Database error updating order:', dbError);
        return NextResponse.redirect(`${CRM_DOMAIN}/order/${txnid}?payment=error`, { status: 303 });
      }
    } else {
      // Payment failed or cancelled - use txnid (order_number) for redirect
      const reason = encodeURIComponent(params.error_Message || status || 'Payment failed');
      return NextResponse.redirect(`${CRM_DOMAIN}/order/${txnid}?payment=failed&reason=${reason}`, { status: 303 });
    }
  } catch (error) {
    console.error('Easebuzz CRM callback error:', error);
    return NextResponse.redirect(`${CRM_DOMAIN}/dashboard/orders?error=callback_error`, { status: 303 });
  }
}
