import { NextRequest, NextResponse } from 'next/server';

/**
 * Recording Control API - Pause/Resume call recordings
 *
 * Based on Ozonetel Call Recording pause/unPause API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ucid } = body;

    // Validation
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required (pause or unPause)' },
        { status: 400 }
      );
    }

    if (!ucid) {
      return NextResponse.json(
        { error: 'UCID (call ID) is required' },
        { status: 400 }
      );
    }

    const validActions = ['pause', 'unPause'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pause" or "unPause"' },
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

    // Call Ozonetel Recording Control API
    const ozonetelUrl = `https://${domain}/CAServices/Call/Record.php?userName=${encodeURIComponent(userName)}&apiKey=${encodeURIComponent(apiKey)}&action=${action}&ucid=${ucid}`;

    console.log('[Recording Control] Calling Ozonetel:', {
      action,
      ucid
    });

    const response = await fetch(ozonetelUrl, {
      method: 'GET',
    });

    const responseData = await response.json();

    console.log('[Recording Control] Ozonetel response:', responseData);

    if (!response.ok || responseData.status === 'Error') {
      return NextResponse.json(
        {
          error: responseData.message || 'Recording control action failed',
          details: responseData
        },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      message: action === 'pause' ? 'Recording paused' : 'Recording resumed',
      ucid,
      data: responseData
    });

  } catch (error) {
    console.error('[Recording Control] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to control recording',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
