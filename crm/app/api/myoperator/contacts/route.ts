import { NextRequest, NextResponse } from 'next/server';
import {
  createContact,
  fetchContacts,
  getMyOperatorConfig,
} from '@/lib/services/myoperator';

/**
 * GET /api/myoperator/contacts
 * Fetch contacts from MyOperator
 *
 * Query params:
 * - limit: number (optional, max 100, default 100)
 * - offset: number (optional, default 0)
 * - includeCustomFields: boolean (optional)
 * - phoneNumber: string (optional) - Filter by phone number
 * - countryCode: string (optional, default '91') - Country code for phone filter
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function GET(request: NextRequest) {
  try {
    const config = getMyOperatorConfig();

    if (!config.whatsappApiKey) {
      return NextResponse.json(
        { error: 'MyOperator API key not configured. Set MYOPERATOR_WHATSAPP_API_KEY' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const includeCustomFields = searchParams.get('includeCustomFields') === 'true';
    const phoneNumber = searchParams.get('phoneNumber') || undefined;
    const countryCode = searchParams.get('countryCode') || undefined;

    console.log('[MyOperator Contacts] Fetching contacts', { limit, offset, includeCustomFields, phoneNumber });

    const result = await fetchContacts(config, {
      limit,
      offset,
      includeCustomFields,
      phoneNumber,
      countryCode,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      contacts: result.contacts,
      total: result.total,
    });
  } catch (error) {
    console.error('[MyOperator Contacts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/myoperator/contacts
 * Create a new contact in MyOperator
 *
 * Request body:
 * - name: string (required)
 * - phoneNumber: string (required)
 * - countryCode: string (optional, default '91')
 * - emailId: string (optional)
 * - marketingOptIn: boolean (optional)
 * - customFields: object (optional)
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function POST(request: NextRequest) {
  try {
    const config = getMyOperatorConfig();

    if (!config.whatsappApiKey) {
      return NextResponse.json(
        { error: 'MyOperator API key not configured. Set MYOPERATOR_WHATSAPP_API_KEY' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { name, phoneNumber, countryCode, emailId, marketingOptIn, customFields } = body;

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    console.log('[MyOperator Contacts] Creating contact:', { name, phoneNumber });

    const result = await createContact(config, {
      name,
      phoneNumber,
      countryCode,
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
      message: 'Contact created successfully',
    });
  } catch (error) {
    console.error('[MyOperator Contacts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contact' },
      { status: 500 }
    );
  }
}
