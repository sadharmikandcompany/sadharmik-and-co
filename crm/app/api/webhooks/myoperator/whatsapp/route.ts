import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { WhatsAppWebhookPayload } from '@/lib/services/myoperator';

// Create Supabase client for webhook handling
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/webhooks/myoperator/whatsapp
 * Handle WhatsApp message webhooks from MyOperator
 *
 * Configure in MyOperator:
 * - Dashboard → WhatsApp → Webhooks
 * - Add webhook URL: https://yourdomain.com/api/webhooks/myoperator/whatsapp
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log('[MyOperator WhatsApp Webhook] Received:', JSON.stringify(payload, null, 2));

    // Handle different message types
    if (payload.statuses) {
      // Status update (sent, delivered, read, failed)
      await handleStatusUpdate(payload.statuses);
    } else if (payload.messages) {
      // Incoming message
      await handleIncomingMessage(payload.messages);
    } else if (payload.message_id) {
      // Single message/status
      await handleSingleEvent(payload as WhatsAppWebhookPayload);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error('[MyOperator WhatsApp Webhook] Error:', error);
    // Always return 200 to prevent retries
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    });
  }
}

/**
 * Handle message status updates
 */
async function handleStatusUpdate(statuses: any[]) {
  for (const status of statuses) {
    console.log('[MyOperator WhatsApp] Status update:', {
      message_id: status.id || status.message_id,
      status: status.status,
      recipient: status.recipient_id || status.to,
    });

    try {
      const { error } = await supabase
        .from('myoperator_whatsapp_messages')
        .update({
          status: status.status,
          status_timestamp: status.timestamp || new Date().toISOString(),
          error_code: status.errors?.[0]?.code,
          error_message: status.errors?.[0]?.title,
        })
        .eq('message_id', status.id || status.message_id);

      if (error) {
        console.error('[MyOperator WhatsApp] Failed to update status:', error);
      }
    } catch (err) {
      console.error('[MyOperator WhatsApp] Database error:', err);
    }
  }
}

/**
 * Handle incoming messages
 */
async function handleIncomingMessage(messages: any[]) {
  for (const message of messages) {
    console.log('[MyOperator WhatsApp] Incoming message:', {
      from: message.from,
      type: message.type,
      timestamp: message.timestamp,
    });

    // Extract message content based on type
    let content = '';
    if (message.type === 'text') {
      content = message.text?.body || '';
    } else if (message.type === 'image') {
      content = `[Image: ${message.image?.caption || 'No caption'}]`;
    } else if (message.type === 'document') {
      content = `[Document: ${message.document?.filename || 'Unknown'}]`;
    } else if (message.type === 'audio') {
      content = '[Audio message]';
    } else if (message.type === 'video') {
      content = `[Video: ${message.video?.caption || 'No caption'}]`;
    }

    try {
      // Store incoming message
      const { error } = await supabase.from('myoperator_whatsapp_messages').insert({
        message_id: message.id,
        direction: 'incoming',
        from_number: message.from,
        to_number: message.to || process.env.MYOPERATOR_WHATSAPP_NUMBER,
        message_type: message.type,
        content: content,
        raw_payload: message,
        status: 'received',
        created_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      });

      if (error) {
        console.error('[MyOperator WhatsApp] Failed to store message:', error);
      }

      // Try to match customer
      const phoneNumber = message.from.replace(/^\+?91/, '');
      const { data: customer } = await supabase
        .from('customers')
        .select('id, first_name, last_name')
        .or(`mobile_primary.eq.${phoneNumber},whatsapp_number.eq.${phoneNumber}`)
        .single();

      if (customer) {
        // Update customer's last WhatsApp contact
        await supabase
          .from('customers')
          .update({ last_whatsapp_at: new Date().toISOString() })
          .eq('id', customer.id);

        console.log('[MyOperator WhatsApp] Matched customer:', customer.first_name, customer.last_name);
      }
    } catch (err) {
      console.error('[MyOperator WhatsApp] Database error:', err);
    }
  }
}

/**
 * Handle single event (status or message)
 */
async function handleSingleEvent(payload: WhatsAppWebhookPayload) {
  console.log('[MyOperator WhatsApp] Single event:', {
    message_id: payload.message_id,
    status: payload.status,
    from: payload.from,
    to: payload.to,
  });

  if (payload.status) {
    // Status update
    try {
      const { error } = await supabase
        .from('myoperator_whatsapp_messages')
        .update({
          status: payload.status,
          status_timestamp: payload.timestamp,
        })
        .eq('message_id', payload.message_id);

      if (error) {
        console.error('[MyOperator WhatsApp] Failed to update status:', error);
      }
    } catch (err) {
      console.error('[MyOperator WhatsApp] Database error:', err);
    }
  } else if (payload.from) {
    // Incoming message
    try {
      const content = payload.text?.body || '';

      const { error } = await supabase.from('myoperator_whatsapp_messages').insert({
        message_id: payload.message_id,
        direction: 'incoming',
        from_number: payload.from,
        to_number: payload.to,
        message_type: payload.type,
        content: content,
        raw_payload: payload,
        status: 'received',
        created_at: payload.timestamp,
      });

      if (error) {
        console.error('[MyOperator WhatsApp] Failed to store message:', error);
      }
    } catch (err) {
      console.error('[MyOperator WhatsApp] Database error:', err);
    }
  }
}

/**
 * GET /api/webhooks/myoperator/whatsapp
 * Verification endpoint for webhook setup
 */
export async function GET(request: NextRequest) {
  // Handle Meta webhook verification if needed
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // If this is a Meta verification request
  if (mode === 'subscribe' && token) {
    const verifyToken = process.env.MYOPERATOR_WHATSAPP_VERIFY_TOKEN;
    if (token === verifyToken) {
      console.log('[MyOperator WhatsApp] Webhook verified');
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Verification failed', { status: 403 });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'MyOperator WhatsApp webhook endpoint is active',
    endpoint: '/api/webhooks/myoperator/whatsapp',
  });
}
