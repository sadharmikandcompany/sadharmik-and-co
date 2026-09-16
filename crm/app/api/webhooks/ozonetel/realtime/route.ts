import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Webhook endpoint for Ozonetel REAL-TIME Call Events (Subscribe API)
 *
 * This endpoint receives events DURING the call lifecycle:
 * - "Calling" - Call is ringing
 * - "Answered" - Call was answered
 * - "Disconnect" - Call ended
 *
 * Setup Instructions:
 * 1. First register this webhook using the Subscribe API
 * 2. Call POST /api/ozonetel/subscribe to register
 * 3. Ozonetel will start sending real-time events to this endpoint
 *
 * Event Types:
 * - Call events: Calling, Answered, Disconnect
 * - Agent events: login, AUX, release, IDLE, calling, incall, ACW, pause, logout
 */
export async function POST(request: NextRequest) {
  const webhookStartTime = Date.now();

  try {
    console.log('=== OZONETEL REALTIME WEBHOOK RECEIVED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    // Clean up old live_calls entries (older than 5 minutes)
    // This prevents the table from growing indefinitely
    await cleanupOldLiveCalls();

    // Ozonetel Subscribe API sends JSON payload
    const payload = await request.json();

    console.log('Realtime Event Payload:', JSON.stringify(payload, null, 2));

    // Extract event information
    const eventType = payload.eventType || payload.EventType;
    const eventData = payload.data || {};
    const timestamp = payload.eventTime || new Date().toISOString();

    // Extract data from nested structure
    const callId = eventData.ucid || eventData.monitor_ucid;
    const phoneNumber = eventData.caller_id;
    const agentId = eventData.agentId || eventData.agent_id;
    const agentName = eventData.agentName || eventData.agent_id; // Fallback to agent_id as Ozonetel uses agent_id field
    const action = eventData.action; // Calling, Answered, Disconnect, login, logout, etc.
    const callType = eventData.call_type;

    console.log('[Realtime] Event:', {
      eventType,
      action,
      callId,
      phoneNumber,
      agentId,
      agentName,
      callType,
      timestamp
    });

    // Handle different event types
    switch (eventType) {
      case 'Call':
      case 'call':
        // Handle call events (Calling, Answered, Disconnect)
        await handleCallEvent(payload, eventData, callId, phoneNumber, agentId, agentName, action, timestamp);
        break;

      case 'Agent':
      case 'agent':
        // Handle agent events (login, logout, status changes, incall, etc.)
        await handleAgentEvent(eventData, agentId, agentName, action, timestamp);
        break;

      default:
        console.log('[Realtime] Unknown event type:', eventType);
    }

    const processingTime = Date.now() - webhookStartTime;
    console.log(`=== REALTIME WEBHOOK PROCESSED in ${processingTime}ms ===\n`);

    return NextResponse.json({
      success: true,
      message: 'Realtime event processed',
      eventType,
      callId,
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('=== REALTIME WEBHOOK ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('===================================\n');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process realtime event',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle call lifecycle events
 */
async function handleCallEvent(
  payload: any,
  eventData: any,
  callId: string,
  phoneNumber: string,
  agentId: string,
  agentName: string,
  action: string,
  timestamp: string
) {
  const normalizedPhone = phoneNumber?.replace(/^\+91/, '').replace(/^91/, '');

  // Map action to call state
  let mappedState = 'unknown';
  const actionLower = (action || '').toLowerCase();

  if (actionLower === 'calling') {
    mappedState = 'ringing';
  } else if (actionLower === 'answered') {
    mappedState = 'connected';
  } else if (actionLower === 'disconnect') {
    mappedState = 'disconnected';
  }

  console.log('[Realtime] Call event:', {
    callId,
    phone: normalizedPhone,
    state: mappedState,
    action: action,
    callType: eventData.call_type,
    agent: agentName,
    did: eventData.did,
    skill: eventData.skill
  });

  // Upsert to live_calls table
  try {
    const liveCallData: any = {
      call_id: callId,
      phone_number: normalizedPhone,
      agent_id: agentId,
      agent_name: agentName,
      call_state: mappedState,
      event_type: payload.eventType || 'realtime',
      raw_data: payload
    };

    // Set timestamps based on state
    if (mappedState === 'ringing') {
      liveCallData.started_at = timestamp;
    } else if (mappedState === 'connected') {
      liveCallData.connected_at = timestamp;
    } else if (mappedState === 'disconnected') {
      liveCallData.ended_at = timestamp;
    }

    // Upsert: update if call_id exists, insert if new
    const { error: upsertError } = await supabase
      .from('live_calls')
      .upsert(liveCallData, {
        onConflict: 'call_id'
      });

    if (upsertError) {
      console.error('[Realtime] Failed to upsert live_calls:', upsertError);
    } else {
      console.log('[Realtime] Live call updated:', {
        callId,
        state: mappedState
      });
    }

    // If call disconnected, we could move it to call_history
    // (but the post-call webhook will handle full details)

  } catch (dbError) {
    console.error('[Realtime] Database error:', dbError);
  }
}

/**
 * Handle agent status events
 * Updates agent_status table with real-time agent state changes
 *
 * Agent actions from webhooks:
 * - login: Agent logged in
 * - logout: Agent logged out
 * - READY/release: Agent ready to take calls
 * - IDLE: Agent idle
 * - AUX/pause: Agent on pause/break
 * - calling: Agent making/receiving call
 * - incall: Agent currently on call
 * - ACW: Agent in After Call Work
 */
async function handleAgentEvent(
  eventData: any,
  agentId: string,
  agentName: string,
  action: string,
  timestamp: string
) {
  try {
    console.log('[Realtime] Agent event received:', {
      agentId,
      agentName,
      action,
      agentMode: eventData.agentMode,
      phoneNumber: eventData.phoneNumber,
      skill: eventData.skill,
      timestamp
    });

    // Map webhook action to agent state
    let agentState = 'UNKNOWN';
    const actionUpper = (action || '').toUpperCase();

    // Map common actions to states
    if (actionUpper === 'LOGIN') {
      agentState = 'IDLE'; // Just logged in, not ready yet
    } else if (actionUpper === 'LOGOUT') {
      agentState = 'OFFLINE';
    } else if (actionUpper === 'RELEASE' || actionUpper === 'READY') {
      agentState = 'READY'; // Agent available to take calls
    } else if (actionUpper === 'IDLE') {
      agentState = 'IDLE';
    } else if (actionUpper === 'AUX' || actionUpper === 'PAUSE') {
      agentState = 'PAUSE';
    } else if (actionUpper === 'CALLING') {
      agentState = 'BUSY';
    } else if (actionUpper === 'INCALL') {
      agentState = 'BUSY';
    } else if (actionUpper === 'ACW') {
      agentState = 'ACW';
    } else {
      // Default to the action itself if not recognized
      agentState = actionUpper;
    }

    // If agent logged out, remove from agent_status
    if (agentState === 'OFFLINE') {
      const { error: deleteError } = await supabase
        .from('agent_status')
        .delete()
        .eq('agent_id', agentId);

      if (deleteError) {
        console.error('[Realtime] Failed to remove logged out agent:', deleteError);
      } else {
        console.log('[Realtime] Agent logged out and removed:', agentId);
      }
      return;
    }

    // Upsert agent status
    const agentStatusData = {
      agent_id: agentId,
      agent_name: agentName || agentId,
      agent_state: agentState,
      agent_mode: eventData.agentMode,
      phone_number: eventData.phoneNumber,
      skill_name: eventData.skill,
      last_action: action,
      last_event_time: timestamp,
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
      .from('agent_status')
      .upsert(agentStatusData, {
        onConflict: 'agent_id'
      });

    if (upsertError) {
      console.error('[Realtime] Failed to upsert agent status:', upsertError);
    } else {
      console.log('[Realtime] Agent status updated:', {
        agentId,
        state: agentState,
        action
      });
    }

  } catch (error) {
    console.error('[Realtime] Error handling agent event:', error);
  }
}

/**
 * Clean up old live_calls entries
 * Removes:
 * - All calls older than 5 minutes
 * - Disconnected/ended calls older than 30 seconds
 */
async function cleanupOldLiveCalls() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

    // Clean up all calls older than 5 minutes
    const { error: oldError, count: oldCount } = await supabase
      .from('live_calls')
      .delete()
      .lt('updated_at', fiveMinutesAgo);

    if (oldError) {
      console.error('[Cleanup] Failed to clean old live_calls:', oldError);
    } else if (oldCount && oldCount > 0) {
      console.log(`[Cleanup] Removed ${oldCount} calls older than 5 minutes`);
    }

    // Clean up disconnected/ended calls older than 30 seconds
    const { error: endedError, count: endedCount } = await supabase
      .from('live_calls')
      .delete()
      .in('call_state', ['disconnected', 'ended'])
      .lt('updated_at', thirtySecondsAgo);

    if (endedError) {
      console.error('[Cleanup] Failed to clean disconnected calls:', endedError);
    } else if (endedCount && endedCount > 0) {
      console.log(`[Cleanup] Removed ${endedCount} disconnected/ended calls`);
    }
  } catch (error) {
    console.error('[Cleanup] Exception during cleanup:', error);
  }
}

/**
 * Handle GET requests - returns live calls from database
 * Supports server-side filtering by agentId to prevent showing other agents' calls
 */
export async function GET(request: NextRequest) {
  try {
    // Get agentId from query parameters for server-side filtering
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

    // Query live_calls table for recent calls (last 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    let query = supabase
      .from('live_calls')
      .select('*')
      .gte('updated_at', twoMinutesAgo)
      .not('call_state', 'in', '(disconnected,ended)');

    // Add server-side filtering by agent_id if provided
    if (agentId) {
      query = query.eq('agent_id', agentId);
      console.log('[Realtime GET] Filtering by agent_id:', agentId);
    } else {
      console.log('[Realtime GET] No agent filter - returning all calls');
    }

    const { data: recentCalls, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('[Realtime GET] Database error:', error);
      throw error;
    }

    // Calculate age for each call to determine if it's "live" (< 30 seconds)
    const now = Date.now();
    const liveCalls = recentCalls.filter((call: any) => {
      const callTime = new Date(call.updated_at).getTime();
      const ageInSeconds = (now - callTime) / 1000;
      return ageInSeconds <= 30; // Show as "live" if less than 30 seconds old
    });

    console.log('[Realtime GET] Live calls fetched:', {
      agentFilter: agentId || 'none (all agents)',
      total: recentCalls.length,
      live: liveCalls.length,
      calls: liveCalls.map((c: any) => ({
        phone: c.phone_number,
        agent_id: c.agent_id,
        call_state: c.call_state
      }))
    });

    return NextResponse.json({
      success: true,
      liveCalls: liveCalls,
      recentCalls: recentCalls,
      liveCount: liveCalls.length,
      totalCalls: recentCalls.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Realtime GET] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch live calls',
      message: error instanceof Error ? error.message : 'Unknown error',
      liveCalls: [],
      recentCalls: []
    }, { status: 500 });
  }
}