import { NextRequest, NextResponse } from 'next/server';
import {
  fetchContactById,
  updateContact,
  getMyOperatorConfig,
} from '@/lib/services/myoperator';

/**
 * GET /api/myoperator/contacts/:id
 * Fetch a single contact by ID
 *
 * Query params:
 * - includeCustomFields: boolean (optional)
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const config = getMyOperatorConfig();
    const { id } = await params;

    if (!config.whatsappApiKey) {
      return NextResponse.json(
        { error: 'MyOperator API key not configured. Set MYOPERATOR_WHATSAPP_API_KEY' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeCustomFields = searchParams.get('includeCustomFields') === 'true';

    console.log('[MyOperator Contacts] Fetching contact:', id);

    const result = await fetchContactById(config, id, { includeCustomFields });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      contact: result.contact,
    });
  } catch (error) {
    console.error('[MyOperator Contacts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/myoperator/contacts/:id
 * Update a contact by phone number (with country code)
 *
 * The :id param should be the phone number with country code (e.g., 919876543210)
 * Per MyOperator API docs: PATCH /contacts/:phone_number_with_country_code
 *
 * Request body (all optional):
 * - name: string
 * - emailId: string
 * - marketingOptIn: boolean
 * - customFields: object
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const config = getMyOperatorConfig();
    const { id } = await params;

    if (!config.whatsappApiKey) {
      return NextResponse.json(
        { error: 'MyOperator API key not configured. Set MYOPERATOR_WHATSAPP_API_KEY' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { name, emailId, marketingOptIn, customFields } = body;

    console.log('[MyOperator Contacts] Updating contact by phone:', id);

    const result = await updateContact(config, id, {
      name,
      emailId,
      marketingOptIn,
      customFields,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      contact: result.contact,
      message: 'Contact updated successfully',
    });
  } catch (error) {
    console.error('[MyOperator Contacts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contact' },
      { status: 500 }
    );
  }
}
