import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage, getMyOperatorConfig } from '@/lib/services/myoperator';

/**
 * POST /api/myoperator/whatsapp/send
 * Send WhatsApp message via MyOperator Chat API
 *
 * Request body:
 * - customerNumber: string (required) - Customer phone number
 * - countryCode: string (optional) - Country code, default '91'
 * - type: 'text' | 'template' | 'image' | 'video' | 'document' (optional)
 * - message: string - For text messages
 * - templateName: string - For template messages
 * - templateParams: object - Template variable values
 * - mediaUrl: string - For media messages
 * - mediaFilename: string - For media messages
 * - mediaCaption: string - For media messages
 * - replyTo: string - Message ID to reply to
 * - myopRefId: string - Custom reference ID for tracking
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function POST(request: NextRequest) {
  try {
    const config = getMyOperatorConfig();

    if (!config.whatsappApiKey) {
      return NextResponse.json(
        { error: 'MyOperator WhatsApp API key not configured. Set MYOPERATOR_WHATSAPP_API_KEY' },
        { status: 500 }
      );
    }

    if (!config.whatsappPhoneNumberId) {
      return NextResponse.json(
        { error: 'MyOperator WhatsApp Phone Number ID not configured. Set MYOPERATOR_WHATSAPP_PHONE_NUMBER_ID' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      customerNumber,
      countryCode,
      type,
      message,
      templateName,
      templateParams,
      mediaUrl,
      mediaFilename,
      mediaCaption,
      mediaMimeType,
      replyTo,
      myopRefId,
      // Legacy parameter support
      to,
      template_name,
      template_params,
    } = body;

    // Support both new and legacy parameter names
    const phoneNumber = customerNumber || to;
    const tmplName = templateName || template_name;
    const tmplParams = templateParams || template_params;

    // Validation
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Customer phone number (customerNumber) is required' },
        { status: 400 }
      );
    }

    const messageType = type || (tmplName ? 'template' : 'text');

    if (messageType === 'template' && !tmplName) {
      return NextResponse.json(
        { error: 'Template name is required for template messages' },
        { status: 400 }
      );
    }

    if (messageType === 'text' && !message) {
      return NextResponse.json(
        { error: 'Message text is required for text messages' },
        { status: 400 }
      );
    }

    if (['image', 'video', 'document'].includes(messageType) && !mediaUrl) {
      return NextResponse.json(
        { error: 'Media URL is required for media messages' },
        { status: 400 }
      );
    }

    console.log('[MyOperator WhatsApp] Sending message:', {
      customerNumber: phoneNumber,
      type: messageType,
      templateName: tmplName,
    });

    const result = await sendWhatsAppMessage(config, {
      customerNumber: phoneNumber,
      countryCode,
      type: messageType,
      message,
      templateName: tmplName,
      templateParams: tmplParams,
      mediaUrl,
      mediaFilename,
      mediaCaption,
      mediaMimeType,
      replyTo,
      myopRefId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      conversationId: result.conversationId,
      message: 'WhatsApp message sent successfully',
    });
  } catch (error) {
    console.error('[MyOperator WhatsApp] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    );
  }
}
