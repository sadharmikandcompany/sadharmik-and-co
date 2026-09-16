import { NextRequest, NextResponse } from 'next/server';
import { getUsers, getMyOperatorConfig } from '@/lib/services/myoperator';

/**
 * GET /api/myoperator/users
 * Get list of users/agents from MyOperator
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

    const params = {
      keyword: searchParams.get('keyword') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : undefined,
      all: searchParams.get('all') === 'true',
    };

    console.log('[MyOperator Users] Fetching with params:', params);

    const result = await getUsers(config, params);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[MyOperator Users] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
