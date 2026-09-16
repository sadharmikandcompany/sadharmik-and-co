import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/myoperator/latest-call
 * Get the latest incoming call for polling (like Ozonetel support page)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    // Get latest call from cache table
    const { data, error } = await supabase
      .from('myoperator_latest_call')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('[MyOperator Latest Call] Error:', error);
      return NextResponse.json({ phoneNumber: null });
    }

    // Check if call is recent (within last 5 minutes)
    if (data?.timestamp) {
      const callTime = new Date(data.timestamp).getTime();
      const now = Date.now();
      const ageInSeconds = (now - callTime) / 1000;

      // Only return if within 5 minutes
      if (ageInSeconds <= 300) {
        // Filter by agent if specified
        if (agentId && data.agent_id && data.agent_id !== agentId) {
          return NextResponse.json({ phoneNumber: null });
        }

        return NextResponse.json({
          phoneNumber: data.phone_number,
          callId: data.call_id,
          agentId: data.agent_id,
          agentName: data.agent_name,
          direction: data.direction,
          timestamp: data.timestamp,
          ageSeconds: ageInSeconds,
        });
      }
    }

    return NextResponse.json({ phoneNumber: null });
  } catch (error) {
    console.error('[MyOperator Latest Call] Error:', error);
    return NextResponse.json({ phoneNumber: null });
  }
}

/**
 * POST /api/myoperator/latest-call
 * Update the latest call (called by webhook)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, callId, agentId, agentName, direction, timestamp } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Update the single-row cache table
    const { error } = await supabase
      .from('myoperator_latest_call')
      .update({
        phone_number: phoneNumber,
        call_id: callId,
        agent_id: agentId,
        agent_name: agentName,
        direction: direction || 'inbound',
        timestamp: timestamp || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) {
      console.error('[MyOperator Latest Call] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update latest call' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MyOperator Latest Call] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update latest call' },
      { status: 500 }
    );
  }
}
