import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  parseMyOperatorCallLog,
  isLongNamePayload,
  convertLongNameToRaw,
  type MyOperatorRawCallLog,
  type MyOperatorLongNamePayload,
  type ParsedCallLog,
} from '@/lib/services/myoperator';

// Create Supabase client for webhook handling
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Find customer by phone number
 */
async function findCustomerByPhone(phoneNumber: string) {
  // Normalize phone number (remove +91 or 91 prefix, keep last 10 digits)
  const normalized = phoneNumber.replace(/^\+?91/, '').slice(-10);

  const { data } = await supabase
    .from('customers')
    .select('id, first_name, last_name')
    .or(`mobile_primary.eq.${normalized},mobile_secondary_1.eq.${normalized},mobile_secondary_2.eq.${normalized},whatsapp_number.eq.${normalized}`)
    .limit(1)
    .single();

  return data;
}

/**
 * Extract the MyOperator raw call log from the request
 *
 * MyOperator sends data in one of these formats:
 * 1. POST body with form-encoded: myoperator=<JSON string>
 * 2. POST body with JSON (if configured differently)
 * 3. GET with query parameters (for specific mapped fields)
 *
 * @see After Call Webhook documentation
 */
async function extractPayload(request: NextRequest): Promise<{
  raw: MyOperatorRawCallLog | null;
  queryParams: Record<string, string>;
}> {
  const queryParams: Record<string, string> = {};
  const { searchParams } = new URL(request.url);
  searchParams.forEach((value, key) => {
    if (key !== 'type') {
      queryParams[key] = value;
    }
  });

  const contentType = request.headers.get('content-type') || '';

  // Form-encoded: myoperator=<JSON string>
  if (contentType.includes('form')) {
    const formData = await request.formData();
    const myoperatorData = formData.get('myoperator');

    if (myoperatorData) {
      try {
        const raw = JSON.parse(myoperatorData.toString()) as MyOperatorRawCallLog;
        return { raw, queryParams };
      } catch (e) {
        console.error('[MyOperator Webhook] Failed to parse myoperator form field:', e);
      }
    }

    // Fallback: check if data is in a 'data' field
    const dataField = formData.get('data');
    if (dataField) {
      try {
        const raw = JSON.parse(dataField.toString()) as MyOperatorRawCallLog;
        return { raw, queryParams };
      } catch (e) {
        console.error('[MyOperator Webhook] Failed to parse data form field:', e);
      }
    }
  }

  // JSON body
  if (contentType.includes('json')) {
    try {
      const body = await request.json();

      // Check if the body IS the raw call log (has _ai field)
      if (body._ai) {
        return { raw: body as MyOperatorRawCallLog, queryParams };
      }

      // Check if it's wrapped in a myoperator key
      if (body.myoperator) {
        const raw = typeof body.myoperator === 'string'
          ? JSON.parse(body.myoperator)
          : body.myoperator;
        return { raw: raw as MyOperatorRawCallLog, queryParams };
      }

      // Return as-is if it has short field names
      if (body._cl || body._cr || body._su !== undefined) {
        return { raw: body as MyOperatorRawCallLog, queryParams };
      }

      // Check for long-name format (id, clid, clid_raw, call_state, etc.)
      if (isLongNamePayload(body as Record<string, unknown>)) {
        const raw = convertLongNameToRaw(body as unknown as MyOperatorLongNamePayload);
        return { raw, queryParams };
      }

      console.warn('[MyOperator Webhook] JSON body does not match expected format:', Object.keys(body));
      return { raw: null, queryParams };
    } catch (e) {
      console.error('[MyOperator Webhook] Failed to parse JSON body:', e);
    }
  }

  // Try raw text body as JSON
  try {
    const text = await request.text();
    if (text.startsWith('myoperator=')) {
      const jsonStr = decodeURIComponent(text.substring('myoperator='.length));
      const raw = JSON.parse(jsonStr) as MyOperatorRawCallLog;
      return { raw, queryParams };
    }
    // Try parsing as plain JSON
    const raw = JSON.parse(text) as MyOperatorRawCallLog;
    return { raw, queryParams };
  } catch {
    // Ignore
  }

  return { raw: null, queryParams };
}

/**
 * POST /api/webhooks/myoperator
 * Handle After Call Webhook from MyOperator
 *
 * Configure in MyOperator Panel:
 * - Go to: Manage → API Integration → After Call Webhook
 * - Target URL: https://yourdomain.com/api/webhooks/myoperator
 * - Method: POST (recommended)
 * - Headers: Optional secret token for verification
 *
 * MyOperator sends data as form-encoded POST: myoperator=<JSON string>
 * The JSON uses short field names (_ai, _cl, _cr, _su, etc.)
 *
 * @see After Call Webhook documentation PDF
 */
export async function POST(request: NextRequest) {
  const webhookStartTime = Date.now();

  try {
    // Optional: Verify webhook secret header
    const webhookSecret = process.env.MYOPERATOR_WEBHOOK_SECRET;
    if (webhookSecret) {
      const secretHeader = request.headers.get('x-myoperator-secret')
        || request.headers.get('my-super-secret-token');
      if (secretHeader !== webhookSecret) {
        console.warn('[MyOperator Webhook] Invalid secret header');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Extract and parse payload
    const { raw, queryParams } = await extractPayload(request);

    if (!raw) {
      console.warn('[MyOperator Webhook] No valid payload found');
      return NextResponse.json(
        { success: false, error: 'No valid MyOperator payload found' },
        { status: 400 }
      );
    }

    // Parse raw payload into human-readable format
    const parsed = parseMyOperatorCallLog(raw);

    console.log('[MyOperator Webhook] Received call:', {
      callId: parsed.callId,
      caller: parsed.callerNumberFormatted,
      callerName: parsed.callerName,
      direction: parsed.direction,
      status: parsed.status,
      duration: parsed.duration,
      agent: parsed.agentName,
      department: parsed.departmentName,
      notificationType: parsed.notificationType,
    });

    // Also log any query params sent alongside
    if (Object.keys(queryParams).length > 0) {
      console.log('[MyOperator Webhook] Query params:', queryParams);
    }

    // Route: live (in-progress) call vs ended call
    // Live calls have no duration and no end time (catches 0, NaN, undefined)
    const isLiveCall = !parsed.durationSeconds && !parsed.endTime;

    if (isLiveCall) {
      await handleLiveCallWebhook(parsed);
    } else {
      await handleAfterCallWebhook(parsed);
    }

    const processingTime = Date.now() - webhookStartTime;
    console.log(`[MyOperator Webhook] Processed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      received: true,
      callId: parsed.callId,
      processingTimeMs: processingTime,
    });
  } catch (error) {
    console.error('[MyOperator Webhook] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    });
  }
}

/**
 * Handle real-time / in-progress call webhook (call is ringing or just connected)
 * Stores in myoperator_live_calls so the frontend shows it instantly.
 */
async function handleLiveCallWebhook(data: ParsedCallLog) {
  if (!data.callId) {
    console.warn('[MyOperator Webhook] Live call missing call ID');
    return;
  }

  const phoneNumber = data.callerNumber || data.callerNumberFormatted;
  if (!phoneNumber) {
    console.warn('[MyOperator Webhook] Live call missing caller number');
    return;
  }

  // Find customer early for latest_call update
  const customer = await findCustomerByPhone(phoneNumber);
  if (customer) {
    console.log('[MyOperator Webhook] Live call matched customer:', customer.first_name, customer.last_name);
  }

  const startTimeISO = data.startTime
    ? new Date(data.startTime * 1000).toISOString()
    : new Date().toISOString();

  // Determine the call state string for the frontend
  // Frontend checks for call_state === 'ringing' via the live-calls API
  // which maps status column → call_state
  const liveStatus = data.status === 'connected' ? 'connected' : 'ringing';

  // Upsert into myoperator_live_calls (instant visibility)
  const { error: liveError } = await supabase
    .from('myoperator_live_calls')
    .upsert({
      call_id: data.callId,
      caller_number: phoneNumber,
      direction: data.direction,
      status: liveStatus,
      agent_name: data.agentName || null,
      agent_id: data.agentId || null,
      agent_number: data.agentNumber || null,
      department: data.departmentName || null,
      timestamp: startTimeISO,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'call_id',
    });

  if (liveError) {
    console.error('[MyOperator Webhook] Failed to store live call:', liveError);
  } else {
    console.log('[MyOperator Webhook] Live call stored:', data.callId, liveStatus);
  }

  // Update latest call for polling (so support page picks it up immediately)
  await supabase
    .from('myoperator_latest_call')
    .update({
      phone_number: phoneNumber,
      call_id: data.callId,
      agent_id: data.agentId,
      agent_name: data.agentName,
      direction: data.direction,
      timestamp: startTimeISO,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
}

/**
 * Handle the parsed after-call webhook data
 */
async function handleAfterCallWebhook(data: ParsedCallLog) {
  if (!data.callId) {
    console.warn('[MyOperator Webhook] Missing call ID (_ai)');
    return;
  }

  if (!data.callerNumber && !data.callerNumberFormatted) {
    console.warn('[MyOperator Webhook] Missing caller number (_cr/_cl)');
    return;
  }

  // Find customer by phone number
  let customerId = null;
  const phoneToSearch = data.callerNumber || data.callerNumberFormatted;
  if (phoneToSearch) {
    const customer = await findCustomerByPhone(phoneToSearch);
    customerId = customer?.id || null;
    if (customer) {
      console.log('[MyOperator Webhook] Matched customer:', customer.first_name, customer.last_name);
    }
  }

  // Convert epoch timestamps to ISO strings
  const startTimeISO = data.startTime ? new Date(data.startTime * 1000).toISOString() : null;
  const endTimeISO = data.endTime ? new Date(data.endTime * 1000).toISOString() : null;
  const logTimeISO = data.logTimestamp ? new Date(data.logTimestamp * 1000).toISOString() : null;

  // Store in call_logs
  const { error: logError } = await supabase
    .from('myoperator_call_logs')
    .upsert({
      call_id: data.callId,
      caller_number: data.callerNumber,
      caller_number_formatted: data.callerNumberFormatted,
      caller_name: data.callerName || null,
      caller_country_code: data.callerCountryCode || null,
      caller_location: data.callerLocation || null,
      direction: data.direction,
      status: data.status,
      status_code: data.statusCode,
      duration: data.durationSeconds,
      duration_minutes: data.durationMinutes,
      start_time: startTimeISO,
      end_time: endTimeISO,
      log_timestamp: logTimeISO,
      agent_name: data.agentName || null,
      agent_id: data.agentId || null,
      agent_number: data.agentNumber || null,
      agent_email: data.agentEmail || null,
      recording_url: data.recordingUrl || null,
      recording_file_name: data.recordingFileName || null,
      department: data.departmentName || null,
      department_id: data.departmentId || null,
      call_type: data.callType,
      source: data.source,
      notification_type: data.notificationType,
      uid: data.uid || null,
      is_anonymous: data.isAnonymous,
      reference_id: data.referenceId || null,
      obd_job_id: data.obdJobId || null,
      client_reference_id: data.clientReferenceId || null,
      customer_id: customerId,
      raw_payload: data.rawPayload,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'call_id',
    });

  if (logError) {
    console.error('[MyOperator Webhook] Failed to store call log:', logError);
  }

  // Remove from live_calls (call ended)
  await supabase
    .from('myoperator_live_calls')
    .delete()
    .eq('call_id', data.callId);

  // Update customer's last contact time
  if (customerId) {
    await supabase
      .from('customers')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', customerId);
  }

  // Update latest call for polling
  if (data.status === 'connected') {
    await supabase
      .from('myoperator_latest_call')
      .update({
        phone_number: data.callerNumber,
        call_id: data.callId,
        agent_id: data.agentId,
        agent_name: data.agentName,
        direction: data.direction,
        timestamp: startTimeISO || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
  }
}

/**
 * GET /api/webhooks/myoperator
 * Verification endpoint for webhook setup + supports GET method webhooks
 *
 * MyOperator can also send webhooks via GET with query parameters.
 * If query params are present (besides 'type'), process them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Check if this is a real webhook call with query params
  const hasCallData = searchParams.has('caller_number')
    || searchParams.has('call_id')
    || searchParams.has('uid');

  if (hasCallData) {
    // This is a GET-based webhook call with query string parameters
    console.log('[MyOperator Webhook GET] Received with params:', Object.fromEntries(searchParams));

    // For GET webhooks, data comes as configured query params (not short names)
    // Store raw query params for now
    const queryData: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryData[key] = value;
    });

    return NextResponse.json({
      success: true,
      received: true,
      note: 'GET webhook received. For full call data, use POST method.',
    });
  }

  // Verification/status endpoint
  return NextResponse.json({
    status: 'ok',
    message: 'MyOperator After Call Webhook endpoint is active',
    configuration: {
      url: 'https://yourdomain.com/api/webhooks/myoperator',
      method: 'POST (recommended)',
      format: 'Form-encoded with myoperator=<JSON> key',
      headerVerification: process.env.MYOPERATOR_WEBHOOK_SECRET ? 'enabled' : 'disabled',
    },
  });
}
