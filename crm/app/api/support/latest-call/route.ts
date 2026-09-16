import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Get the latest live call information from database
 * This checks the live_calls table for active calls (ringing or connected)
 * Updated to use real-time webhook data instead of post-call webhook
 * Supports server-side filtering by agentId to prevent showing other agents' calls.
 */
export async function GET(request: NextRequest) {
  try {
    // Get agentId from query parameters for server-side filtering
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

    // Query live_calls table for recent calls (last 1 minute)
    // Only show calls that are truly "live" (ringing or connected)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    let query = supabase
      .from('live_calls')
      .select('phone_number, call_id, agent_name, agent_id, call_state, updated_at')
      .in('call_state', ['ringing', 'connected']) // Only active calls, not disconnected
      .gte('updated_at', oneMinuteAgo);

    // Add server-side filtering by agent_id if provided
    if (agentId) {
      query = query.eq('agent_id', agentId);
      console.log('[Latest Call] Filtering by agent_id:', agentId);
    } else {
      console.log('[Latest Call] No agent filter - returning latest call from any agent');
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('[Latest Call] No live calls found:', error?.message);
      return NextResponse.json({ phoneNumber: null });
    }

    console.log('[Latest Call] Found live call:', {
      phone: data.phone_number,
      callId: data.call_id,
      agentId: data.agent_id,
      state: data.call_state,
      updated: data.updated_at
    });

    return NextResponse.json({
      phoneNumber: data.phone_number,
      callId: data.call_id,
      timestamp: data.updated_at,
      agentName: data.agent_name,
      agentId: data.agent_id,
      callState: data.call_state
    });
  } catch (error) {
    console.error('[Latest Call] Failed to fetch live call:', error);
    return NextResponse.json({ phoneNumber: null });
  }
}

/**
 * Update the latest call information (called by webhook)
 * This endpoint is kept for backward compatibility but now relies on database
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Just return success as the webhook already stores to database
    return NextResponse.json({
      success: true,
      message: 'Latest call updated',
      note: 'Call data is stored in call_history table'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to update latest call',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
