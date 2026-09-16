import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/myoperator/recent-calls
 * Get recent call history from database
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const agentName = searchParams.get('agentName');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = supabase
      .from('myoperator_call_logs')
      .select(`
        id,
        call_id,
        caller_number,
        called_number,
        direction,
        status,
        duration,
        start_time,
        end_time,
        agent_name,
        agent_id,
        recording_url,
        disposition,
        customer_id
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by agent ID or name if specified
    if (agentId) {
      query = query.eq('agent_id', agentId);
    } else if (agentName) {
      query = query.ilike('agent_name', agentName);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MyOperator Recent Calls] Error:', error);
      return NextResponse.json({ calls: [], error: error.message });
    }

    return NextResponse.json({
      calls: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('[MyOperator Recent Calls] Error:', error);
    return NextResponse.json({ calls: [], error: 'Failed to fetch recent calls' });
  }
}
