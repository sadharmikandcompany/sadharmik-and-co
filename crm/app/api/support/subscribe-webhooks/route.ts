import { NextRequest, NextResponse } from 'next/server';
import { ozonetelService } from '@/lib/services/ozonetel';

/**
 * Subscribe to Ozonetel Webhook Events
 *
 * This endpoint helps you register your application's webhook URLs with Ozonetel
 * to receive real-time call and agent events.
 *
 * Usage:
 * POST /api/support/subscribe-webhooks
 *
 * Optional body:
 * {
 *   "webhookUrl": "https://your-domain.com/api/webhooks/ozonetel/realtime" (optional - uses default if not provided)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Use provided webhook URL or construct default from request origin
    const webhookUrl = body.webhookUrl || `${request.nextUrl.origin}/api/webhooks/ozonetel/realtime`;

    console.log('[Subscribe] Registering webhook with Ozonetel:', webhookUrl);

    // Subscribe to both Call and Agent events
    const success = await ozonetelService.subscribeToEvents(webhookUrl, ['Call', 'Agent']);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Successfully subscribed to Ozonetel webhooks',
        webhookUrl,
        eventTypes: ['Call', 'Agent'],
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to subscribe to webhooks',
          message: 'Check server logs for details'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Subscribe] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to subscribe to webhooks',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get current webhook subscriptions from Ozonetel
 *
 * Usage:
 * GET /api/support/subscribe-webhooks
 */
export async function GET() {
  try {
    console.log('[Subscribe] Fetching current subscriptions from Ozonetel');

    const subscriptions = await ozonetelService.getSubscriptions();

    if (subscriptions) {
      return NextResponse.json({
        success: true,
        subscriptions,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch subscriptions',
          message: 'Check server logs for details'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Subscribe] Error:', error);
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
