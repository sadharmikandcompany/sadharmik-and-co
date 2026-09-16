import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppTemplates, getMyOperatorConfig } from '@/lib/services/myoperator';

/**
 * GET /api/myoperator/whatsapp/templates
 * Get available WhatsApp templates from MyOperator
 *
 * Query params:
 * - status: 'approved' | 'pending' | 'rejected' (optional)
 * - category: 'marketing' | 'utility' | 'authentication' (optional)
 * - limit: number (optional, default 50)
 * - offset: number (optional, default 0)
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function GET(request: NextRequest) {
  try {
    const config = getMyOperatorConfig();

    if (!config.whatsappApiKey) {
      return NextResponse.json(
        { error: 'MyOperator WhatsApp API key not configured. Set MYOPERATOR_WHATSAPP_API_KEY' },
        { status: 500 }
      );
    }

    if (!config.whatsappWabaId) {
      return NextResponse.json(
        { error: 'MyOperator WhatsApp WABA ID not configured. Set MYOPERATOR_WHATSAPP_WABA_ID' },
        { status: 500 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'approved' | 'pending' | 'rejected' | null;
    const category = searchParams.get('category') as 'marketing' | 'utility' | 'authentication' | null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    console.log('[MyOperator WhatsApp Templates] Fetching templates', { status, category, limit, offset });

    const result = await getWhatsAppTemplates(config, {
      status: status || undefined,
      category: category || undefined,
      limit,
      offset,
    });

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
    console.error('[MyOperator WhatsApp Templates] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
