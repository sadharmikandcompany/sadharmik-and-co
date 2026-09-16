import { NextRequest, NextResponse } from 'next/server';

/**
 * Manual Dial API - Click-to-call functionality
 *
 * Based on Ozonetel Agent Manual Dial API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      campaignName,
      customerNumber,
      returnUCID = true
    } = body;

    // Validation
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    if (!campaignName) {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 }
      );
    }

    if (!customerNumber) {
      return NextResponse.json(
        { error: 'Customer number is required' },
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

    // Call Ozonetel Manual Dial API
    const ozonetelUrl = `https://${domain}/ca_apis/AgentManualDial`;

    const ozonetelPayload = {
      userName,
      agentID: agentId,
      campaignName,
      customerNumber,
      UCID: returnUCID ? 'true' : 'false'
    };

    console.log('[Manual Dial] Calling Ozonetel:', {
      url: ozonetelUrl,
      agentId,
      campaignName,
      customerNumber
    });

    const response = await fetch(ozonetelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKey
      },
      body: JSON.stringify(ozonetelPayload)
    });

    const responseData = await response.json();

    console.log('[Manual Dial] Ozonetel response:', responseData);

    if (!response.ok || responseData.status === 'Fail') {
      return NextResponse.json(
        {
          error: responseData.message || 'Failed to initiate call',
          details: responseData
        },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json({
      success: true,
      status: responseData.status || 'queued successfully',
      ucid: responseData.ucid,
      customerNumber,
      message: 'Call initiated successfully'
    });

  } catch (error) {
    console.error('[Manual Dial] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate call',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
