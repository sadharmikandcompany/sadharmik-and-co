import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Get live/active calls from database
 * This endpoint fetches all ongoing calls (ringing or connected) from the live_calls table
 * which is populated by the realtime webhook.
 * Supports server-side filtering by agentId to prevent showing other agents' calls.
 */
export async function GET(request: NextRequest) {
  try {
    // Get agentId from query parameters for server-side filtering
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

    // Query live_calls table for recent calls in the last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    let query = supabaseServer
      .from('live_calls')
      .select('*')
      .gte('updated_at', twoMinutesAgo)
      .not('call_state', 'in', '(disconnected,ended)');

    // Add server-side filtering by agent_id if provided
    if (agentId) {
      query = query.eq('agent_id', agentId);
      console.log('[Live Calls API] Filtering by agent_id:', agentId);
    } else {
      console.log('[Live Calls API] No agent filter - returning all calls (admin mode)');
    }

    const { data: recentCalls, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('[Live Calls API] Database error:', error);
      throw error;
    }

    // Calculate age for each call to determine if it's "live" (< 30 seconds)
    const now = Date.now();
    const liveCalls = recentCalls.filter((call: any) => {
      const callTime = new Date(call.updated_at).getTime();
      const ageInSeconds = (now - callTime) / 1000;
      return ageInSeconds <= 30; // Show as "live" if less than 30 seconds old
    });

    console.log('[Live Calls API] Calls fetched:', {
      agentFilter: agentId || 'none (all agents)',
      total: recentCalls.length,
      live: liveCalls.length,
      timestamp: new Date().toISOString(),
      calls: recentCalls.map((c: any) => ({
        phone: c.phone_number,
        agent_id: c.agent_id,
        call_state: c.call_state,
        age: ((now - new Date(c.updated_at).getTime()) / 1000).toFixed(1) + 's'
      }))
    });

    return NextResponse.json({
      success: true,
      liveCalls: liveCalls, // Calls < 30 seconds old
      recentCalls: recentCalls, // All calls from last 2 minutes
      liveCount: liveCalls.length,
      totalCalls: recentCalls.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Live Calls API] Failed to fetch live calls:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch live calls',
        message: error instanceof Error ? error.message : 'Unknown error',
        liveCalls: [],
        recentCalls: []
      },
      { status: 500 }
    );
  }
}
