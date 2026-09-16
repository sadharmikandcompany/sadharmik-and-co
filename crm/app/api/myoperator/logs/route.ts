import { NextRequest, NextResponse } from 'next/server';
import { searchCallLogs, getMyOperatorConfig } from '@/lib/services/myoperator';

/**
 * GET /api/myoperator/logs
 * Search and retrieve call logs from MyOperator
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

    // Parse query parameters
    const params = {
      from: searchParams.get('from') ? parseInt(searchParams.get('from')!) : undefined,
      to: searchParams.get('to') ? parseInt(searchParams.get('to')!) : undefined,
      log_from: searchParams.get('log_from') ? parseInt(searchParams.get('log_from')!) : undefined,
      page_size: searchParams.get('page_size') ? parseInt(searchParams.get('page_size')!) : 20,
      search_key: searchParams.get('search_key') || undefined,
      filters: searchParams.get('filters') || undefined,
    };

    console.log('[MyOperator Logs] Fetching with params:', params);

    const result = await searchCallLogs(config, params);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
    });
  } catch (error) {
    console.error('[MyOperator Logs] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/myoperator/logs
 * Search call logs with body parameters
 */
export async function POST(request: NextRequest) {
  try {
    const config = getMyOperatorConfig();

    if (!config.token) {
      return NextResponse.json(
        { error: 'MyOperator credentials not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();

    const params = {
      from: body.from,
      to: body.to,
      log_from: body.log_from || 0,
      page_size: body.page_size || 20,
      search_key: body.search_key,
      filters: body.filters,
    };

    console.log('[MyOperator Logs] Searching with params:', params);

    const result = await searchCallLogs(config, params);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
    });
  } catch (error) {
    console.error('[MyOperator Logs] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search logs' },
      { status: 500 }
    );
  }
}
