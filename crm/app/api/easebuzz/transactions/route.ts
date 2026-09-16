import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const EASEBUZZ_KEY = process.env.EASEBUZZ_MERCHANT_KEY || '2RKNJJS8IN';
const EASEBUZZ_SALT = process.env.EASEBUZZ_MERCHANT_SALT || '31C4327MT3';
const EASEBUZZ_ENV = process.env.EASEBUZZ_ENV || 'test';
const EASEBUZZ_MERCHANT_EMAIL = process.env.EASEBUZZ_MERCHANT_EMAIL || '';

const EASEBUZZ_DASHBOARD_URL = EASEBUZZ_ENV === 'prod'
  ? 'https://dashboard.easebuzz.in'
  : 'https://testdashboard.easebuzz.in';

// POST: Fetch all transactions by date range (auto-paginates all pages)
export async function POST(request: NextRequest) {
  try {
    if (!EASEBUZZ_MERCHANT_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'EASEBUZZ_MERCHANT_EMAIL env variable is not set' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { start_date, end_date } = body;

    if (!start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: 'start_date and end_date are required (DD-MM-YYYY format)' },
        { status: 400 }
      );
    }

    // Hash sequence: key|merchant_email|start_date|end_date|salt
    const hashString = `${EASEBUZZ_KEY}|${EASEBUZZ_MERCHANT_EMAIL}|${start_date}|${end_date}|${EASEBUZZ_SALT}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const allTransactions: any[] = [];
    let nextPage: string | null = null;

    // Fetch first page
    const firstResult = await fetchPage(hash, start_date, end_date, undefined);
    if (!firstResult.status) {
      return NextResponse.json({ success: false, error: firstResult.data || 'Easebuzz API error', raw: firstResult });
    }

    allTransactions.push(...(firstResult.data || []));
    nextPage = firstResult.next || null;

    // Auto-paginate through all pages
    let pageCount = 0;
    const maxPages = 100;
    while (nextPage && pageCount < maxPages) {
      const pageResult = await fetchPage(hash, start_date, end_date, nextPage);
      if (!pageResult.status || !pageResult.data?.length) break;
      allTransactions.push(...pageResult.data);
      nextPage = pageResult.next || null;
      pageCount++;
    }

    return NextResponse.json({
      success: true,
      count: allTransactions.length,
      data: allTransactions,
    });
  } catch (error) {
    console.error('Easebuzz transactions fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions from Easebuzz' },
      { status: 500 }
    );
  }
}

async function fetchPage(hash: string, start_date: string, end_date: string, page?: string) {
  const requestBody: Record<string, unknown> = {
    key: EASEBUZZ_KEY,
    merchant_email: EASEBUZZ_MERCHANT_EMAIL,
    date_range: { start_date, end_date },
    hash,
  };
  if (page) {
    requestBody.page = page;
  }

  const response = await fetch(`${EASEBUZZ_DASHBOARD_URL}/transaction/v2/retrieve/date`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  return response.json();
}

// GET: Fetch single transaction details by txnid (V2.1 API)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txnid = searchParams.get('txnid');

    if (!txnid) {
      return NextResponse.json(
        { success: false, error: 'txnid is required' },
        { status: 400 }
      );
    }

    // Hash sequence: key|txnid|salt
    const hashString = `${EASEBUZZ_KEY}|${txnid}|${EASEBUZZ_SALT}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const formData = new URLSearchParams();
    formData.append('key', EASEBUZZ_KEY);
    formData.append('txnid', txnid);
    formData.append('hash', hash);

    const response = await fetch(`${EASEBUZZ_DASHBOARD_URL}/transaction/v2.1/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formData.toString(),
    });

    const result = await response.json();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Easebuzz transaction detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transaction details' },
      { status: 500 }
    );
  }
}
