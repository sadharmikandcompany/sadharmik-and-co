import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Call Disposition API
 *
 * Add disposition and notes to completed calls
 * Stores in call_history table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      callId,           // monitor_ucid from call_history
      disposition,      // Selected disposition (e.g., "Resolved", "Follow-up Required")
      notes,            // Agent notes
      customerId        // Optional customer ID
    } = body;

    // Validation
    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      );
    }

    if (!disposition) {
      return NextResponse.json(
        { error: 'Disposition is required' },
        { status: 400 }
      );
    }

    console.log('[Disposition] Updating call:', {
      callId,
      disposition,
      hasNotes: !!notes,
      customerId
    });

    // Update call_history with disposition and notes
    const { data, error } = await supabase
      .from('call_history')
      .update({
        disposition,
        agent_notes: notes || null,
        ...(customerId && { customer_id: customerId }),
        updated_at: new Date().toISOString()
      })
      .eq('monitor_ucid', callId)
      .select()
      .single();

    if (error) {
      console.error('[Disposition] Database error:', error);
      return NextResponse.json(
        {
          error: 'Failed to save disposition',
          message: error.message
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    console.log('[Disposition] Saved successfully:', {
      callId,
      disposition
    });

    return NextResponse.json({
      success: true,
      message: 'Disposition saved successfully',
      callId,
      disposition,
      data
    });

  } catch (error) {
    console.error('[Disposition] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save disposition',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Fetch call disposition
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('call_history')
      .select('monitor_ucid, disposition, agent_notes, customer_id')
      .eq('monitor_ucid', callId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      callId: data.monitor_ucid,
      disposition: data.disposition,
      notes: data.agent_notes,
      customerId: data.customer_id
    });

  } catch (error) {
    console.error('[Disposition] Error fetching disposition:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch disposition',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
