import { NextRequest, NextResponse } from 'next/server';
import { getRecordingLink, getMyOperatorConfig } from '@/lib/services/myoperator';

/**
 * GET /api/myoperator/recordings
 * Get recording link for a call (valid for 24 hours)
 */
export async function GET(request: NextRequest) {
  try {
    const config = getMyOperatorConfig();

    if (!config.token) {
      return NextResponse.json(
        { error: 'MyOperator credentials not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      return NextResponse.json(
        { error: 'Recording file name is required' },
        { status: 400 }
      );
    }

    console.log('[MyOperator Recordings] Getting link for:', fileName);

    const result = await getRecordingLink(config, fileName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      expiresIn: '24 hours',
    });
  } catch (error) {
    console.error('[MyOperator Recordings] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get recording' },
      { status: 500 }
    );
  }
}
