import { NextRequest, NextResponse } from 'next/server';

/**
 * Call Control API - Manage active calls
 *
 * Supports: HOLD, UNHOLD, MUTE, UNMUTE, CONFERENCE, KICK_CALL (disconnect)
 * Based on Ozonetel Call Control API documentation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      ucid,
      conferenceNumber,
      did,
      agentPhoneName
    } = body;

    // Validation
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    if (!ucid) {
      return NextResponse.json(
        { error: 'UCID (call ID) is required' },
        { status: 400 }
      );
    }

    const validActions = ['HOLD', 'UNHOLD', 'MUTE', 'UNMUTE', 'CONFERENCE', 'KICK_CALL'];
    if (!validActions.includes(action.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // For CONFERENCE action, validate additional params
    if (action.toUpperCase() === 'CONFERENCE' && !conferenceNumber) {
      return NextResponse.json(
        { error: 'Conference number is required for CONFERENCE action' },
        { status: 400 }
      );
    }

    // Get credentials from env
    const apiKey = process.env.OZONETEL_API_KEY;
    const userName = process.env.OZONETEL_USERNAME;
    const domain = process.env.OZONETEL_DOMAIN || 'in1-ccaas-api.ozonetel.com';

    if (!apiKey || !userName) {
      return NextResponse.json(
        { error: 'Ozonetel credentials not configured' },
        { status: 500 }
      );
    }

    // Call Ozonetel Call Control API
    const ozonetelUrl = `https://${domain}/ca_apis/CallControl_V4`;

    const ozonetelPayload = {
      apiKey,
      userName,
      action: action.toUpperCase(),
      ucid,
      ...(conferenceNumber && { conferenceNumber }),
      ...(did && { did }),
      ...(agentPhoneName && { agentPhoneName })
    };

    console.log('[Call Control] Calling Ozonetel:', {
      url: ozonetelUrl,
      action: action.toUpperCase(),
      ucid
    });

    const response = await fetch(ozonetelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ozonetelPayload)
    });

    const responseData = await response.json();

    console.log('[Call Control] Ozonetel response:', responseData);

    if (!response.ok || responseData.status === 'Fail' || responseData.status === 'Error') {
      return NextResponse.json(
        {
          error: responseData.message || 'Call control action failed',
          details: responseData
        },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json({
      success: true,
      action: action.toUpperCase(),
      message: responseData.message || 'Action completed successfully',
      ucid,
      data: responseData
    });

  } catch (error) {
    console.error('[Call Control] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute call control action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
