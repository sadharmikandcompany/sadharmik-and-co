import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const EASEBUZZ_KEY = process.env.EASEBUZZ_MERCHANT_KEY || '2RKNJJS8IN';
const EASEBUZZ_SALT = process.env.EASEBUZZ_MERCHANT_SALT || '31C4327MT3';
const EASEBUZZ_ENV = process.env.EASEBUZZ_ENV || 'test'; // 'test' or 'prod'

const EASEBUZZ_URL = EASEBUZZ_ENV === 'prod'
  ? 'https://pay.easebuzz.in/payment/initiateLink'
  : 'https://testpay.easebuzz.in/payment/initiateLink';

const EASEBUZZ_PAY_URL = EASEBUZZ_ENV === 'prod'
  ? 'https://pay.easebuzz.in/pay'
  : 'https://testpay.easebuzz.in/pay';

// Callback URL for CRM payments (use CRM domain)
const CALLBACK_BASE_URL = process.env.EASEBUZZ_CALLBACK_URL || 'https://sadharmikandcompany.com';

interface GeneratePaymentLinkRequest {
  orderId: string;
  orderNumber: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  productInfo?: string;
}

function generateHash(
  key: string,
  txnid: string,
  amount: string,
  productinfo: string,
  firstname: string,
  email: string,
  udf1: string,
  udf2: string,
  udf3: string,
  udf4: string,
  udf5: string,
  salt: string
): string {
  // Hash sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body: GeneratePaymentLinkRequest = await request.json();

    // Validate required fields
    if (!body.orderId || !body.orderNumber || !body.amount || !body.customerName || !body.customerPhone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use order number as transaction ID
    const txnid = body.orderNumber.replace(/[^a-zA-Z0-9_|\-\/]/g, '').substring(0, 40);

    // Sanitize inputs
    const productinfo = (body.productInfo || 'Sadharmik & Company Order').replace(/[^a-zA-Z0-9\s\-|]/g, '').trim().substring(0, 45) || 'Order';
    const firstname = body.customerName.replace(/[^a-zA-Z0-9&\-._\s()/,@]/g, '').substring(0, 150) || 'Customer';
    const phone = body.customerPhone.replace(/\D/g, '').substring(0, 20);
    const email = body.customerEmail || `${phone}@sadharmikandcompany.com`;

    // Format amount
    const amountStr = body.amount.toFixed(2);

    // UDF fields - store order ID for reference
    const udf1 = body.orderId;
    const udf2 = 'crm_invoice';
    const udf3 = '';
    const udf4 = '';
    const udf5 = '';

    // Generate hash
    const hash = generateHash(
      EASEBUZZ_KEY,
      txnid,
      amountStr,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      EASEBUZZ_SALT
    );

    // Prepare form data for Easebuzz
    const formData = new URLSearchParams();
    formData.append('key', EASEBUZZ_KEY);
    formData.append('txnid', txnid);
    formData.append('amount', amountStr);
    formData.append('productinfo', productinfo);
    formData.append('firstname', firstname);
    formData.append('phone', phone);
    formData.append('email', email);
    formData.append('surl', `${CALLBACK_BASE_URL}/api/easebuzz/callback`);
    formData.append('furl', `${CALLBACK_BASE_URL}/api/easebuzz/callback`);
    formData.append('hash', hash);
    formData.append('udf1', udf1);
    formData.append('udf2', udf2);
    formData.append('udf3', udf3);
    formData.append('udf4', udf4);
    formData.append('udf5', udf5);

    console.log('Easebuzz payment link request:', {
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      phone,
    });

    // Call Easebuzz Initiate API
    const response = await fetch(EASEBUZZ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await response.json();
    console.log('Easebuzz response:', result);

    if (result.status === 1) {
      // Success - return payment URL
      const paymentUrl = `${EASEBUZZ_PAY_URL}/${result.data}`;

      return NextResponse.json({
        success: true,
        accessKey: result.data,
        paymentUrl: paymentUrl,
        txnid: txnid,
      });
    } else {
      console.error('Easebuzz error:', result);
      return NextResponse.json(
        { success: false, error: result.data || 'Payment link generation failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Easebuzz generate-link error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
