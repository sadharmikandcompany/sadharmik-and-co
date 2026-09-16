import { NextRequest, NextResponse } from 'next/server';

/**
 * Agent State Management API
 *
 * Change agent state (Ready, Pause) for offline agents
 * Based on Ozonetel Change Agent State API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      phoneName,
      state,
      pauseReason
    } = body;

    // Validation
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    if (!phoneName) {
      return NextResponse.json(
        { error: 'Phone name is required' },
        { status: 400 }
      );
    }

    if (!state) {
      return NextResponse.json(
        { error: 'State is required' },
        { status: 400 }
      );
    }

    const validStates = ['Ready', 'Pause'];
    if (!validStates.includes(state)) {
      return NextResponse.json(
        { error: 'Invalid state. Must be "Ready" or "Pause"' },
        { status: 400 }
      );
    }

    // Pause requires a reason
    if (state === 'Pause' && !pauseReason) {
      return NextResponse.json(
        { error: 'Pause reason is required when state is "Pause"' },
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

    // Generate token for authentication
    const tokenUrl = `https://${domain}/ca_apis/CAToken/generateToken`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKey
      },
      body: JSON.stringify({ userName })
    });

    const tokenData = await tokenResponse.json();
    const token = tokenData.token || tokenData.jwt || tokenData.accessToken;

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to generate authentication token' },
        { status: 500 }
      );
    }

    // Call Ozonetel Change Agent State API
    const ozonetelUrl = `https://${domain}/ca_apis/changeAgentState`;

    const ozonetelPayload: any = {
      userName,
      phoneName,
      agentId,
      state
    };

    if (state === 'Pause') {
      ozonetelPayload.pauseReason = pauseReason;
    }

    console.log('[Agent State] Calling Ozonetel:', {
      url: ozonetelUrl,
      agentId,
      phoneName,
      state,
      pauseReason
    });

    const response = await fetch(ozonetelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(ozonetelPayload)
    });

    const responseData = await response.json();

    console.log('[Agent State] Ozonetel response:', responseData);

    if (!response.ok || responseData.status === 'error') {
      return NextResponse.json(
        {
          error: responseData.message || 'Failed to change agent state',
          details: responseData
        },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json({
      success: true,
      state,
      agentId,
      message: `Agent state changed to ${state}`,
      data: responseData
    });

  } catch (error) {
    console.error('[Agent State] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to change agent state',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
