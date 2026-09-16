import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ozonetelService } from '@/lib/services/ozonetel';

/**
 * Webhook endpoint for Ozonetel Voice Callbacks
 *
 * ⚠️ IMPORTANT: Configure this URL in your Ozonetel CloudAgent dashboard:
 * 1. Login to Ozonetel CloudAgent
 * 2. Go to: Admin Settings → System Settings → Callback URL
 * 3. Set URL: https://your-domain.vercel.app/api/webhooks/ozonetel
 * 4. Method: POST
 * 5. Content-Type: application/x-www-form-urlencoded
 *
 * Ozonetel sends call summary details via POST with these call types:
 * - Type: "Inbound" - Incoming calls from customers
 * - Type: "Manual" - Manual dial by agent
 * - Type: "Progressive" - Outbound/automated calls
 *
 * Call Status values:
 * - Status: "Answered" - Call was answered
 * - Status: "NotAnswered" - Call was not answered
 *
 * The webhook receives complete call details including:
 * - CallerID (customer phone number)
 * - monitorUCID (unique call ID)
 * - AgentID, AgentName
 * - StartTime, EndTime, CallDuration
 * - AudioFile (recording URL)
 * - Disposition
 *
 * Payload is sent as application/x-www-form-urlencoded (form-data).
 */
export async function POST(request: NextRequest) {
  const webhookStartTime = Date.now();
  
  try {
    // Log incoming webhook request
    console.log('=== OZONETEL WEBHOOK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    
    // Ozonetel sends data as form-data (application/x-www-form-urlencoded)
    const formData = await request.formData();

    // Convert FormData to JSON object
    const rawData: Record<string, string> = {};
    formData.forEach((value, key) => {
      rawData[key] = value.toString();
    });

    console.log('Ozonetel Webhook Raw Data:', JSON.stringify(rawData, null, 2));

    // Ozonetel sends the actual payload as a JSON string in the "data" field
    let payload: Record<string, string>;
    if (rawData.data) {
      try {
        payload = JSON.parse(rawData.data);
        console.log('Ozonetel Webhook Parsed Payload:', JSON.stringify(payload, null, 2));
      } catch (parseError) {
        console.error('Failed to parse data field:', parseError);
        payload = rawData; // Fallback to raw data
      }
    } else {
      payload = rawData;
    }

    // Extract call information using Ozonetel's actual field names
    const eventType = payload.Type || payload.type; // Type: Progressive/InBound/Manual
    const rawPhoneNumber = payload.CallerID || payload.customerNumber; // CallerID: Customer phone number (with country code)
    const phoneNumber = rawPhoneNumber?.replace(/^\+91/, '').replace(/^91/, ''); // Normalize: remove +91 or 91 prefix
    const callId = payload.monitorUCID || payload.ucid; // monitorUCID: Unique call ID

    // Clean agent ID: "Ronit -> Ronit -> Ronit" => "Ronit"
    const rawAgentId = payload.AgentID || '';
    const agentId = rawAgentId.includes('->')
      ? rawAgentId.split('->')[0].trim() // Take first value before " -> "
      : rawAgentId;

    const agentName = payload.AgentName;
    const callStatus = payload.Status; // Status: Answered/NotAnswered
    const startTime = payload.StartTime;
    const endTime = payload.EndTime;

    // Convert empty duration strings to null for PostgreSQL interval columns
    const duration = payload.CallDuration && payload.CallDuration !== '' ? payload.CallDuration : null;
    const timeToAnswer = payload.TimeToAnswer && payload.TimeToAnswer !== '' ? payload.TimeToAnswer : null;

    const disposition = payload.Disposition;
    const did = payload.Did || payload.DID || payload.did; // DID field (case-insensitive)

    // Clean agent status: "NormalUnspecified -> answered" => "answered"
    const rawAgentStatus = payload.AgentStatus || '';
    const agentStatus = rawAgentStatus.includes('->')
      ? rawAgentStatus.split('->')[1].trim()
      : rawAgentStatus;

    // Clean agent phone number: "72412 -> 72412" => "72412"
    const rawAgentPhone = payload.AgentPhoneNumber || '';
    const agentPhoneNumber = rawAgentPhone.includes('->')
      ? rawAgentPhone.split('->')[1].trim()
      : rawAgentPhone;

    // Clean phone name: "72412 -> 72412" => "72412"
    const rawPhoneName = payload.PhoneName || '';
    const phoneName = rawPhoneName.includes('->')
      ? rawPhoneName.split('->')[1].trim()
      : rawPhoneName;

    // Find customer by phone number (do this once before switch)
    let customerId = null;
    if (phoneNumber) {
      const customer = await ozonetelService.findCustomerByPhone(phoneNumber);
      customerId = customer?.id || null;
    }

    // Handle different call types
    // Type can be: Progressive (outbound), Inbound, InBound, Manual
    switch (eventType) {
      case 'Inbound':
      case 'InBound':
      case 'inbound':
        // Log incoming call
        console.log(`Inbound call from ${phoneNumber} (Call ID: ${callId})`);
        console.log(`Agent: ${agentName} (${agentId}), Status: ${callStatus}`);
        console.log(`Customer ID: ${customerId || 'Not found'}`);


        // Store call in database
        if (phoneNumber) {
          try {
            const { error: dbError } = await supabase
              .from('call_history')
              .insert({
                monitor_ucid: callId,
                caller_id: phoneNumber,
                type: eventType,
                status: callStatus,
                agent_id: agentId,
                agent_name: agentName,
                agent_phone_number: agentPhoneNumber,
                agent_status: agentStatus,
                agent_unique_id: payload.AgentUniqueID,
                start_time: startTime,
                end_time: endTime,
                call_duration: duration,
                time_to_answer: timeToAnswer,
                campaign_name: payload.CampaignName,
                campaign_status: payload.CampaignStatus,
                skill: payload.Skill,
                dialed_number: payload.DialedNumber,
                did: did,
                phone_name: phoneName,
                disposition: disposition,
                hangup_by: payload.HangupBy,
                audio_file_url: payload.AudioFile,
                api_key: payload.Apikey,
                username: payload.UserName,
                customer_id: customerId,
                raw_payload: payload
              });

            if (dbError) {
              console.error('Failed to store call in database:', dbError);
            } else {
              console.log('Call stored in database successfully');
              // Note: live_calls is managed by real-time webhook (/api/webhooks/ozonetel/realtime)
              // This post-call webhook only stores to call_history for permanent records
            }
          } catch (dbError) {
            console.error('Database error:', dbError);
          }
        }

        // Store latest call for polling - only for answered calls
        if (phoneNumber && callStatus === 'Answered') {
          await fetch(`${request.nextUrl.origin}/api/support/latest-call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber,
              callId,
              agentId,
              agentName,
              timestamp: startTime || new Date().toISOString()
            })
          });
        }

        break;

      case 'Manual':
      case 'manual':
        console.log(`Manual dial to ${phoneNumber} by agent ${agentName} (Call ID: ${callId})`);
        break;

      case 'Progressive':
      case 'progressive':
        console.log(`Outbound call to ${phoneNumber} (Call ID: ${callId})`);
        break;

      default:
        console.log(`Call type: ${eventType || 'Unknown'}`);
        console.log(`Status: ${callStatus}, Duration: ${duration}`);
        console.log(`Customer ID: ${customerId || 'Not found'}`);

        // Store call in database for all call types
        if (phoneNumber) {
          try {
            const { error: dbError } = await supabase
              .from('call_history')
              .insert({
                monitor_ucid: callId,
                caller_id: phoneNumber,
                type: eventType || 'Unknown',
                status: callStatus,
                agent_id: agentId,
                agent_name: agentName,
                agent_phone_number: agentPhoneNumber,
                agent_status: agentStatus,
                agent_unique_id: payload.AgentUniqueID,
                start_time: startTime,
                end_time: endTime,
                call_duration: duration,
                time_to_answer: timeToAnswer,
                campaign_name: payload.CampaignName,
                campaign_status: payload.CampaignStatus,
                skill: payload.Skill,
                dialed_number: payload.DialedNumber,
                did: did,
                phone_name: phoneName,
                disposition: disposition,
                hangup_by: payload.HangupBy,
                audio_file_url: payload.AudioFile,
                api_key: payload.Apikey,
                username: payload.UserName,
                customer_id: customerId,
                raw_payload: payload
              });

            if (dbError) {
              console.error('Failed to store call in database:', dbError);
            } else {
              console.log('Call stored in database successfully');
              // Note: live_calls is managed by real-time webhook (/api/webhooks/ozonetel/realtime)
              // This post-call webhook only stores to call_history for permanent records
            }
          } catch (dbError) {
            console.error('Database error:', dbError);
          }
        }

        // Store any call with a valid phone number and answered status
        if (phoneNumber && callStatus === 'Answered') {
          await fetch(`${request.nextUrl.origin}/api/support/latest-call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber,
              callId,
              agentId,
              agentName,
              timestamp: startTime || new Date().toISOString()
            })
          });
        }
    }

    // Log call summary for all calls
    console.log('Call Summary:', {
      callId,
      phoneNumber,
      agentName,
      status: callStatus,
      duration,
      disposition,
      startTime,
      endTime,
      customerId
    });

    const processingTime = Date.now() - webhookStartTime;
    console.log(`=== WEBHOOK PROCESSED SUCCESSFULLY in ${processingTime}ms ===\n`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      received: new Date().toISOString(),
      callId,
      phoneNumber,
      customerId: customerId || null,
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('=== WEBHOOK PROCESSING ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('===================================\n');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests for webhook verification
 * Some webhook providers send GET requests to verify the endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('challenge');

  if (challenge) {
    // Respond to verification challenge
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    status: 'active',
    endpoint: 'Ozonetel webhook receiver',
    timestamp: new Date().toISOString()
  });
}