import { NextRequest, NextResponse } from 'next/server';
import { ozonetelService } from '@/lib/services/ozonetel';

/**
 * Register webhook with Ozonetel Subscribe API
 *
 * This endpoint allows you to register your realtime webhook URL
 * to receive live call events from Ozonetel.
 *
 * Usage:
 * POST /api/ozonetel/subscribe
 *
 * Optional body:
 * {
 *   "eventTypes": ["Call", "Agent"]  // Optional, defaults to both
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventTypes = body.eventTypes || ['Call', 'Agent'];

    // Construct the webhook URL
    const webhookUrl = `${request.nextUrl.origin}/api/webhooks/ozonetel/realtime`;

    console.log('[Subscribe] Registering webhook:', {
      url: webhookUrl,
      eventTypes
    });

    // Call Ozonetel Subscribe API
    const success = await ozonetelService.subscribeToEvents(webhookUrl, eventTypes);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Successfully subscribed to Ozonetel events',
        webhookUrl,
        eventTypes,
        note: 'Ozonetel will now send real-time events to your webhook'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to subscribe to events',
          message: 'Check server logs for details',
          webhookUrl,
          eventTypes
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Subscribe] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process subscription request',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get current webhook subscriptions from Ozonetel
 */
export async function GET() {
  try {
    const subscriptions = await ozonetelService.getSubscriptions();

    return NextResponse.json({
      success: true,
      subscriptions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Subscribe] Error fetching subscriptions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch subscriptions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
