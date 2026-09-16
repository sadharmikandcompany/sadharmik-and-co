import { NextRequest, NextResponse } from 'next/server';
import { clickToCall, getMyOperatorConfig } from '@/lib/services/myoperator';

/**
 * POST /api/myoperator/click-to-call
 * Initiate an outbound call using MyOperator Campaigns API (OBD API)
 *
 * Request body:
 * - customerNumber: string (required) - Customer phone number with country code (e.g. +919212992129)
 * - userId: string (optional) - MyOperator user/agent ID for User Dial (type 1)
 * - number2: string (optional) - Second number for Anonymous Dial (type 1, requires anonymous feature)
 * - type: '1' | '2' (optional, default '1')
 *   - 1: Peer-to-Peer (User Dial with user_id, or Anonymous Dial with number_2)
 *   - 2: IVR-based (customer connected to free agent in IVR department)
 * - referenceId: string (optional) - Unique reference for tracking (returned in webhook)
 * - maxCallDuration: number (optional) - Max call duration in seconds (max 5400)
 * - region: string (optional) - Dedicated DID region filter
 * - group: string (optional) - Dedicated DID group filter
 * - callerId: string (optional) - Dedicated DID caller ID filter
 * - callHold: boolean (optional) - Retry call if UDC unavailable (default: true)
 *
 * @see MyOperator Campaigns API documentation
 */
export async function POST(request: NextRequest) {
  try {
    const config = getMyOperatorConfig();

    if (!config.companyId || !config.secret) {
      return NextResponse.json(
        { error: 'MyOperator credentials not configured. Required: MYOPERATOR_COMPANY_ID, MYOPERATOR_SECRET' },
        { status: 500 }
      );
    }

    if (!config.publicIvrId) {
      return NextResponse.json(
        { error: 'MyOperator Public IVR ID not configured. Set MYOPERATOR_PUBLIC_IVR_ID' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      customerNumber,
      userId,
      number2,
      type,
      referenceId,
      maxCallDuration,
      region,
      group,
      callerId,
      callHold,
    } = body;

    // Validation
    if (!customerNumber) {
      return NextResponse.json(
        { error: 'Customer phone number (customerNumber) is required' },
        { status: 400 }
      );
    }

    // For type 1 (Peer-to-Peer), either userId or number2 is needed
    const callType = type || '1';
    if (callType === '1' && !userId && !number2) {
      return NextResponse.json(
        { error: 'For Peer-to-Peer calls (type 1), provide either userId (User Dial) or number2 (Anonymous Dial)' },
        { status: 400 }
      );
    }

    // Cannot provide both userId and number2
    if (userId && number2) {
      return NextResponse.json(
        { error: 'Provide either userId or number2, not both' },
        { status: 400 }
      );
    }

    console.log('[MyOperator Click-to-Call] Initiating call:', {
      customerNumber,
      type: callType,
      userId: userId || undefined,
      number2: number2 || undefined,
    });

    const result = await clickToCall(config, {
      customerNumber,
      userId,
      number2,
      type: callType,
      referenceId,
      maxCallDuration,
      region,
      group,
      callerId,
      callHold,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      uniqueId: result.uniqueId,
      referenceId: result.referenceId,
      message: 'Call initiated successfully',
    });
  } catch (error) {
    console.error('[MyOperator Click-to-Call] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate call' },
      { status: 500 }
    );
  }
}
