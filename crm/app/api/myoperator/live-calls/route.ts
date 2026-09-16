import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/myoperator/live-calls
 * Get current live/ringing calls from MyOperator
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    // Get live calls from last 2 minutes (calls older are likely ended)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    let query = supabase
      .from('myoperator_live_calls')
      .select('*')
      .gte('updated_at', twoMinutesAgo)
      .order('updated_at', { ascending: false });

    // Filter by agent if specified
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MyOperator Live Calls] Error:', error);
      return NextResponse.json({ liveCalls: [] });
    }

    // Transform to match expected format
    const liveCalls = (data || []).map((call) => ({
      call_id: call.call_id,
      phone_number: call.caller_number,
      direction: call.direction,
      call_state: call.status,
      agent_id: call.agent_id,
      agent_name: call.agent_name,
      department: call.department,
      timestamp: call.timestamp,
    }));

    return NextResponse.json({
      liveCalls,
      count: liveCalls.length,
    });
  } catch (error) {
    console.error('[MyOperator Live Calls] Error:', error);
    return NextResponse.json({ liveCalls: [] });
  }
}

/**
 * DELETE /api/myoperator/live-calls
 * Clean up old live calls (called periodically or when call ends)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

    if (callId) {
      // Delete specific call
      await supabase
        .from('myoperator_live_calls')
        .delete()
        .eq('call_id', callId);
    } else {
      // Clean up calls older than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      await supabase
        .from('myoperator_live_calls')
        .delete()
        .lt('updated_at', fiveMinutesAgo);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MyOperator Live Calls] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to clean up live calls' },
      { status: 500 }
    );
  }
}
