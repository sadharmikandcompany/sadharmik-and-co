/**
 * MyOperator API Service
 *
 * Provides integration with MyOperator for:
 * - Click-to-call functionality
 * - Call logs retrieval
 * - Recording links
 * - WhatsApp messaging
 */

// API Configuration
const MYOPERATOR_API_BASE = 'https://developers.myoperator.co';
const MYOPERATOR_OBD_API_BASE = 'https://obd-api.myoperator.co';
const MYOPERATOR_WHATSAPP_BASE = 'https://publicapi.myoperator.co';

// Environment variables (set in .env.local)
// MYOPERATOR_TOKEN - API token for calling APIs
// MYOPERATOR_SECRET - Secret token for OBD API
// MYOPERATOR_API_KEY - X-API-Key header
// MYOPERATOR_COMPANY_ID - Company ID
// MYOPERATOR_PUBLIC_IVR_ID - Public IVR ID for click-to-call routing
// MYOPERATOR_WHATSAPP_API_KEY - WhatsApp API key

export interface MyOperatorConfig {
  token: string;
  secret: string;
  apiKey: string;
  companyId: string;
  publicIvrId?: string;
  // WhatsApp API credentials
  whatsappApiKey?: string;
  whatsappPhoneNumberId?: string;
  whatsappWabaId?: string;
}

export interface CallLog {
  id: string;
  caller_number: string;
  called_number: string;
  direction: 'inbound' | 'outbound';
  status: string;
  duration: number;
  start_time: string;
  end_time: string;
  agent_name: string;
  agent_number: string;
  recording_file: string | null;
  disposition: string | null;
  department: string | null;
}

export interface CallLogSearchParams {
  from?: number; // Unix timestamp
  to?: number; // Unix timestamp
  log_from?: number; // Pagination offset
  page_size?: number; // Max 100
  search_key?: string;
  filters?: string; // Filter IDs with AND/OR
}

export interface WhatsAppMessage {
  customerNumber: string;
  countryCode?: string; // Default: '91' for India
  templateName?: string;
  templateParams?: Record<string, string>;
  message?: string;
  type?: 'template' | 'text' | 'image' | 'video' | 'document';
  // For media messages
  mediaUrl?: string;
  mediaFilename?: string;
  mediaCaption?: string;
  mediaMimeType?: string;
  // Optional fields
  replyTo?: string; // Message ID to reply to
  myopRefId?: string; // Custom reference ID for tracking
}

export interface ClickToCallParams {
  customerNumber: string; // Customer number to call (with country code e.g. +919212992129)
  userId?: string; // MyOperator user ID (for User Dial - type 1)
  number2?: string; // Second number for Anonymous Dial (type 1 without user_id)
  referenceId?: string; // Unique reference ID for tracking
  type?: '1' | '2'; // 1=Peer-to-Peer (User Dial or Anonymous Dial), 2=IVR-based
  maxCallDuration?: number; // Max call duration in seconds (max 5400)
  region?: string; // Dedicated DID region filter
  group?: string; // Dedicated DID group filter
  callerId?: string; // Dedicated DID caller ID filter
  callHold?: boolean; // Retry call if UDC unavailable (default: true)
}

/**
 * Get MyOperator configuration from environment
 */
export function getMyOperatorConfig(): MyOperatorConfig {
  return {
    token: process.env.MYOPERATOR_TOKEN || '',
    secret: process.env.MYOPERATOR_SECRET || '',
    apiKey: process.env.MYOPERATOR_API_KEY || '',
    companyId: process.env.MYOPERATOR_COMPANY_ID || '',
    publicIvrId: process.env.MYOPERATOR_PUBLIC_IVR_ID || '',
    // WhatsApp API credentials
    whatsappApiKey: process.env.MYOPERATOR_WHATSAPP_API_KEY || '',
    whatsappPhoneNumberId: process.env.MYOPERATOR_WHATSAPP_PHONE_NUMBER_ID || '',
    whatsappWabaId: process.env.MYOPERATOR_WHATSAPP_WABA_ID || '',
  };
}

/**
 * Search call logs
 */
export async function searchCallLogs(
  config: MyOperatorConfig,
  params: CallLogSearchParams = {}
): Promise<{ success: boolean; data?: CallLog[]; error?: string; total?: number }> {
  try {
    const url = new URL(`${MYOPERATOR_API_BASE}/search`);
    url.searchParams.append('token', config.token);

    // Add optional parameters
    if (params.from) url.searchParams.append('from', params.from.toString());
    if (params.to) url.searchParams.append('to', params.to.toString());
    if (params.log_from) url.searchParams.append('log_from', params.log_from.toString());
    if (params.page_size) url.searchParams.append('page_size', Math.min(params.page_size, 100).toString());
    if (params.search_key) url.searchParams.append('search_key', params.search_key);
    if (params.filters) url.searchParams.append('filters', params.filters);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
    });

    const data = await response.json();

    if (data.status === 'success') {
      return {
        success: true,
        data: data.data || [],
        total: data.total || 0,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to fetch call logs',
    };
  } catch (error) {
    console.error('[MyOperator] Search logs error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get log filters
 */
export async function getLogFilters(
  config: MyOperatorConfig
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const url = `${MYOPERATOR_API_BASE}/filters?token=${config.token}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    const data = await response.json();

    if (data.status === 'success') {
      return {
        success: true,
        data: data.data || [],
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to fetch filters',
    };
  } catch (error) {
    console.error('[MyOperator] Get filters error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get recording link (valid for 24 hours)
 */
export async function getRecordingLink(
  config: MyOperatorConfig,
  fileName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const url = `${MYOPERATOR_API_BASE}/recordings/link?token=${config.token}&file=${encodeURIComponent(fileName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    const data = await response.json();

    if (data.status === 'success') {
      return {
        success: true,
        url: data.data?.url || data.url,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to get recording link',
    };
  } catch (error) {
    console.error('[MyOperator] Get recording error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get users list
 */
export async function getUsers(
  config: MyOperatorConfig,
  params: { keyword?: string; page?: number; pageSize?: number; all?: boolean } = {}
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const url = new URL(`${MYOPERATOR_API_BASE}/user`);
    url.searchParams.append('token', config.token);

    if (params.keyword) url.searchParams.append('keyword', params.keyword);
    if (params.page) url.searchParams.append('page', params.page.toString());
    if (params.pageSize) url.searchParams.append('page-size', params.pageSize.toString());
    if (params.all) url.searchParams.append('_all', '1');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    const data = await response.json();

    if (data.status === 'success') {
      return {
        success: true,
        data: data.data || [],
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to fetch users',
    };
  } catch (error) {
    console.error('[MyOperator] Get users error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Click-to-call - Initiate outbound call using OBD API
 *
 * Campaign Types:
 * - Type 1 (User Dial): Uses user_id to dial the agent first, then connects to customer
 * - Type 2 (Anonymous/Peer-to-Peer): Both numbers passed directly, no user_id needed
 * - Type 3 (IVR-based): Bulk dial, customer connected to any free agent in department
 *
 * @see https://support.myoperator.com/portal/en/kb/articles/myoperator-outgoing-apis-guide
 */
export async function clickToCall(
  config: MyOperatorConfig,
  params: ClickToCallParams
): Promise<{ success: boolean; uniqueId?: string; referenceId?: string; error?: string }> {
  try {
    const url = `${MYOPERATOR_OBD_API_BASE}/obd-api-v1`;

    // Generate a unique reference ID if not provided
    const referenceId = params.referenceId || `call_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Format phone number with country code
    let customerNumber = params.customerNumber.replace(/\D/g, '');
    if (customerNumber.length === 10) {
      customerNumber = `+91${customerNumber}`;
    } else if (!customerNumber.startsWith('+')) {
      customerNumber = `+${customerNumber}`;
    }

    // Build payload based on call type
    // type "1" = Peer-to-Peer (User Dial or Anonymous Dial)
    // type "2" = IVR-based (customer connected to free agent in department)
    const payload: Record<string, string | number | boolean> = {
      company_id: config.companyId,
      secret_token: config.secret,
      type: params.type || '1', // Default to peer-to-peer
      number: customerNumber,
      public_ivr_id: config.publicIvrId || '',
      reference_id: referenceId,
    };

    // For Peer-to-Peer (type 1): User Dial vs Anonymous Dial
    if (params.type === '1' || !params.type) {
      if (params.userId) {
        // User Dial: user_id identifies the agent
        payload.user_id = params.userId;
      } else if (params.number2) {
        // Anonymous Dial: number_2 is the second party
        let number2 = params.number2.replace(/\D/g, '');
        if (number2.length === 10) {
          number2 = `+91${number2}`;
        } else if (!number2.startsWith('+')) {
          number2 = `+${number2}`;
        }
        payload.number_2 = number2;
      }
    }

    // Optional: Dedicated DID filters
    if (params.region) payload.region = params.region;
    if (params.group) payload.group = params.group;
    if (params.callerId) payload.caller_id = params.callerId;

    // Optional: Max call duration (in seconds, max 5400)
    if (params.maxCallDuration) {
      payload.max_call_duration = Math.min(params.maxCallDuration, 5400);
    }

    // Optional: Call hold (retry if UDC unavailable)
    if (params.callHold !== undefined) {
      payload.call_hold = params.callHold;
    }

    console.log('[MyOperator] Click-to-call request:', {
      url,
      type: payload.type,
      customerNumber: payload.number,
      referenceId: payload.reference_id,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('[MyOperator] Click-to-call response:', data);

    if (data.status === 'success') {
      return {
        success: true,
        uniqueId: data.unique_id,
        referenceId: data.reference_id || referenceId,
      };
    }

    return {
      success: false,
      error: data.details || data.message || 'Failed to initiate call',
    };
  } catch (error) {
    console.error('[MyOperator] Click-to-call error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send WhatsApp message
 *
 * Uses the MyOperator Chat API to send messages.
 * Endpoint: POST https://publicapi.myoperator.co/chat/messages
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function sendWhatsAppMessage(
  config: MyOperatorConfig,
  message: WhatsAppMessage
): Promise<{ success: boolean; messageId?: string; conversationId?: string; error?: string }> {
  try {
    if (!config.whatsappApiKey) {
      return {
        success: false,
        error: 'WhatsApp API key not configured',
      };
    }

    if (!config.whatsappPhoneNumberId) {
      return {
        success: false,
        error: 'WhatsApp Phone Number ID not configured',
      };
    }

    const url = `${MYOPERATOR_WHATSAPP_BASE}/chat/messages`;

    // Clean phone number (remove non-digits)
    const customerNumber = message.customerNumber.replace(/\D/g, '');
    const countryCode = message.countryCode || '91';

    // Build the payload according to MyOperator API documentation
    const payload: Record<string, unknown> = {
      phone_number_id: config.whatsappPhoneNumberId,
      customer_country_code: countryCode,
      customer_number: customerNumber,
      reply_to: message.replyTo || null,
      myop_ref_id: message.myopRefId || null,
    };

    // Build data object based on message type
    if (message.type === 'template' && message.templateName) {
      // Template message
      payload.data = {
        type: 'template',
        context: {
          template_name: message.templateName,
          language: 'en',
          // Template params as key-value pairs in body (e.g. { var_1: "value" })
          ...(message.templateParams && {
            body: message.templateParams,
          }),
        },
      };
    } else if (message.type === 'image' && message.mediaUrl) {
      // Image message
      payload.data = {
        type: 'image',
        context: {
          link: message.mediaUrl,
          filename: message.mediaFilename || 'image.jpg',
          caption: message.mediaCaption || '',
          mime_type: message.mediaMimeType || 'image/jpeg',
        },
      };
    } else if (message.type === 'video' && message.mediaUrl) {
      // Video message
      payload.data = {
        type: 'video',
        context: {
          link: message.mediaUrl,
          filename: message.mediaFilename || 'video.mp4',
          caption: message.mediaCaption || '',
          mime_type: message.mediaMimeType || 'video/mp4',
        },
      };
    } else if (message.type === 'document' && message.mediaUrl) {
      // Document message
      payload.data = {
        type: 'document',
        context: {
          link: message.mediaUrl,
          filename: message.mediaFilename || 'document.pdf',
          caption: message.mediaCaption || '',
          mime_type: message.mediaMimeType || 'application/pdf',
        },
      };
    } else {
      // Default: Text message
      payload.data = {
        type: 'text',
        context: {
          body: message.message || '',
          preview_url: false,
        },
      };
    }

    console.log('[MyOperator] WhatsApp send request:', JSON.stringify({ url, payload }, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${config.whatsappApiKey}`,
        'X-MYOP-COMPANY-ID': config.companyId,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('[MyOperator] WhatsApp send response:', JSON.stringify(data, null, 2));

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        messageId: data.data?.message_id,
        conversationId: data.data?.conversation_id,
      };
    }

    return {
      success: false,
      error: data.message || data.error?.message || 'Failed to send WhatsApp message',
    };
  } catch (error) {
    console.error('[MyOperator] WhatsApp send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get WhatsApp templates
 *
 * Endpoint: GET https://publicapi.myoperator.co/chat/templates
 * Query params: waba_id, waba_template_status, category, limit, offset
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function getWhatsAppTemplates(
  config: MyOperatorConfig,
  options?: {
    status?: 'approved' | 'pending' | 'rejected';
    category?: 'marketing' | 'utility' | 'authentication';
    limit?: number;
    offset?: number;
  }
): Promise<{ success: boolean; data?: WhatsAppTemplate[]; total?: number; error?: string }> {
  try {
    if (!config.whatsappApiKey) {
      return {
        success: false,
        error: 'WhatsApp API key not configured',
      };
    }

    if (!config.whatsappWabaId) {
      return {
        success: false,
        error: 'WhatsApp WABA ID not configured',
      };
    }

    // Build URL with query params
    const params = new URLSearchParams();
    params.append('waba_id', config.whatsappWabaId);

    if (options?.status) {
      params.append('waba_template_status', options.status);
    }
    if (options?.category) {
      params.append('category', options.category);
    }
    params.append('limit', String(options?.limit || 50));
    params.append('offset', String(options?.offset || 0));

    const url = `${MYOPERATOR_WHATSAPP_BASE}/chat/templates?${params.toString()}`;

    console.log('[MyOperator] Fetching WhatsApp templates:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${config.whatsappApiKey}`,
        'X-MYOP-COMPANY-ID': config.companyId,
      },
    });

    const data = await response.json();

    console.log('[MyOperator] Templates response:', data);

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        data: data.data?.results || [],
        total: data.data?.count || 0,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to fetch templates',
    };
  } catch (error) {
    console.error('[MyOperator] Get templates error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * WhatsApp template structure from API
 */
export interface WhatsAppTemplate {
  id: string;
  name: string;
  waba_template_id: string;
  language: string;
  category: 'marketing' | 'utility' | 'authentication';
  type: string;
  components: WhatsAppTemplateComponent[];
  quality: string;
  status: string;
  waba_template_status: 'approved' | 'pending' | 'rejected';
  failure_reason: string | null;
  created: string;
  modified: string;
}

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'MEDIA';
  text?: string;
  media_id?: string;
  example?: Record<string, string>;
  buttons?: WhatsAppTemplateButton[];
}

export interface WhatsAppTemplateButton {
  type: 'URL' | 'QUICK_REPLY' | 'PHONE_NUMBER';
  format?: 'STATIC' | 'DYNAMIC';
  index: number;
  text: string;
  url?: string;
  phone_number?: string;
}

// ============================================================================
// WEBHOOK PAYLOAD TYPES & PARSER
// ============================================================================

/**
 * Raw MyOperator After Call Webhook payload (short field names)
 *
 * MyOperator sends POST body as: myoperator=<JSON string>
 * The JSON uses abbreviated field names documented below.
 *
 * @see After Call Webhook documentation PDF
 */
export interface MyOperatorRawCallLog {
  _ai: string;        // Call log ID (unique)
  _cl: string;        // Caller number formatted (+919876543210)
  _cr: string;        // Caller number raw (919876543210)
  _cm: string;        // Caller contact name
  _cy: string;        // Caller country code
  _ev: number;        // Event type: 1=incoming, 2=outgoing
  _fu: string;        // Recording file URL
  _fn: string;        // Recording file name
  _ts: number;        // Log timestamp (unix epoch)
  _ms: number;        // Log timestamp (milliseconds)
  _st: number;        // Call start time (epoch)
  _et: number;        // Call end time (epoch)
  _ss: number;        // Diff between end and start (seconds)
  _ns: string;        // Notification status: 0=normal, 1=clickocall, 2=obd, 3=webrtc
  _se: string;        // Caller location (State, Country) e.g. "DL, IN"
  _su: number;        // Status: 1=connected, 2=missed, 3=voicemail
  _so: string;        // Source: 1=IVR, 2=Mobile
  _ci: string;        // Company ID
  _dr: string;        // Duration (hh:mm:ss)
  _drm: number;       // Duration (minutes)
  _di: string;        // Department ID
  _dn: string;        // Department name
  _ty: number;        // Log type: 1=call, 2=sms
  _ri: string;        // Reference ID (obd v2)
  _ji: string;        // OBD v2 job ID
  _ivid: string;      // Public IVR ID
  _cri: string;       // Client reference ID (obd v2)
  _an: number;        // Is anonymous: 1=yes, 0=no
  _cn: MyOperatorRawConnectedUser[];  // Connected users
  _ld: MyOperatorRawLegData[];        // Leg data (call routing)
  _pm: Array<{ ky: string; vl: string }>; // Parameters (UID, starred, etc.)
  _us: Array<{ ky: string; vl: string }>; // User statuses
  _tc: Array<{ ye: string; yf: number }>; // Talk counts
  _bp: any[];          // Billing parameters
}

export interface MyOperatorRawConnectedUser {
  _tx: string;   // Text
  _cd: string;   // Connected ID
  _ce: number;   // Connected epoch
  _id: string;   // User ID
  _na: string;   // User name
  _em: string;   // User email
  _ex: string;   // Extension
  _ct: string;   // Contact number
  _nr: string;   // Number with country code
}

export interface MyOperatorRawLegData {
  _rst: string;  // Ring start time (GMT)
  _ds: string;   // Dial string: ANSWER/NOANSWER/CANCEL
  _did: string;  // Last caller ID
  _su: string;   // Status: 1=connected, 2=missed, 3=voicemail, 4=success
  _st: number;   // Start time (epoch)
  _et: number;   // End time (epoch)
  _dr: string;   // Duration
  _ac: string;   // Call status: received/missed/transferred
  _rr: MyOperatorRawAgent[];  // Agents who received
  _tt: MyOperatorRawAgent[];  // Transferred agents
}

export interface MyOperatorRawAgent {
  _id: string;   // Agent ID
  _na: string;   // Agent name
  _em: string;   // Agent email
  _ex: string;   // Extension
  _ct: string;   // Contact number
  _nr: string;   // Number with country code
}

/**
 * Long-name format payload from MyOperator webhook
 *
 * Some MyOperator webhook configurations send data with human-readable
 * field names instead of the short abbreviated names.
 */
export interface MyOperatorLongNamePayload {
  id: string;              // Call log ID → _ai
  clid: string;            // Caller number formatted → _cl
  clid_raw: string;        // Caller number raw → _cr
  company_id: string;      // Company ID → _ci
  event: unknown;          // Event type → _ev (can be number, string, or object)
  status: unknown;         // Status code → _su (can be number, string, or object)
  call_state: unknown;     // Call state (e.g. "connected", "missed", or number)
  call_time: unknown;      // Duration (hh:mm:ss) → _dr
  notification_status: unknown; // → _ns
  department_name: unknown;     // → _dn
  department_extension: unknown; // Department ID → _di
  reference_id: unknown;   // → _ri
  job_id: unknown;         // → _ji
  public_ivr_id: unknown;  // → _ivid
  client_ref_id: unknown;  // → _cri
  uid: unknown;            // Call UID
  users: unknown;          // Connected users (array or other)
  created: unknown;        // Timestamp (epoch, ISO, or other)
  created_time: unknown;   // Formatted time
  rdnis: unknown;          // Dialed number / DID
  is_sent: unknown;
}

/**
 * Map status string to numeric code
 */
const STATUS_STRING_MAP: Record<string, number> = {
  connected: 1,
  missed: 2,
  voicemail: 3,
};

/**
 * Check if a payload uses the long-name format
 */
export function isLongNamePayload(body: Record<string, unknown>): boolean {
  return typeof body.id === 'string' && ('clid' in body || 'clid_raw' in body || 'call_state' in body);
}

/**
 * Safely convert any value to string (handles objects, arrays, null, undefined)
 */
function safeStr(val: unknown, fallback = ''): string {
  if (val == null) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
}

/**
 * Safely convert any value to number
 */
function safeNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

/**
 * Convert long-name format payload to short-name MyOperatorRawCallLog
 */
export function convertLongNameToRaw(body: MyOperatorLongNamePayload): MyOperatorRawCallLog {
  // Parse status: try numeric first, then map from call_state string
  const callStateStr = safeStr(body.call_state).toLowerCase();
  const statusCode = safeNum(body.status) || STATUS_STRING_MAP[callStateStr] || 0;

  // Parse event
  const event = safeNum(body.event);

  // Parse timestamps — both 'created' and 'call_time' can be epoch or ISO string
  const parseEpoch = (val: unknown): number => {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    const s = String(val);
    const n = Number(s);
    if (!isNaN(n) && !s.includes('-') && !s.includes('T')) return n; // pure numeric epoch
    const d = new Date(s);
    return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
  };

  const createdEpoch = parseEpoch(body.created);
  const callTimeEpoch = parseEpoch(body.call_time);
  // Use call_time as start time if available, fallback to created
  const startEpoch = callTimeEpoch || createdEpoch;

  // Convert users array to connected users format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectedUsers: MyOperatorRawConnectedUser[] = Array.isArray(body.users)
    ? (body.users as any[]).map((u) => ({
        _tx: safeStr(u._tx || u.text),
        _cd: safeStr(u._cd || u.connected_id),
        _ce: safeNum(u._ce || u.connected_epoch),
        _id: safeStr(u._id || u.id),
        _na: safeStr(u._na || u.name),
        _em: safeStr(u._em || u.email),
        _ex: safeStr(u._ex || u.extension),
        _ct: safeStr(u._ct || u.contact),
        _nr: safeStr(u._nr || u.number),
      } as MyOperatorRawConnectedUser))
    : [];

  return {
    _ai: safeStr(body.id),
    _cl: safeStr(body.clid),
    _cr: safeStr(body.clid_raw),
    _cm: '',
    _cy: '',
    _ev: event,
    _fu: '',
    _fn: '',
    _ts: createdEpoch,
    _ms: createdEpoch * 1000,
    _st: startEpoch,
    _et: 0,
    _ss: 0,
    _ns: safeStr(body.notification_status, '0'),
    _se: '',
    _su: statusCode,
    _so: '',
    _ci: safeStr(body.company_id),
    _dr: '00:00:00',
    _drm: 0,
    _di: safeStr(body.department_extension),
    _dn: safeStr(body.department_name),
    _ty: 1,
    _ri: safeStr(body.reference_id),
    _ji: safeStr(body.job_id),
    _ivid: safeStr(body.public_ivr_id),
    _cri: safeStr(body.client_ref_id),
    _an: 0,
    _cn: connectedUsers,
    _ld: [],
    _pm: body.uid ? [{ ky: 'ui', vl: safeStr(body.uid) }] : [],
    _us: [],
    _tc: [],
    _bp: [],
  } as MyOperatorRawCallLog;
}

/**
 * Parsed (human-readable) call log data from webhook
 */
export interface ParsedCallLog {
  callId: string;
  callerNumber: string;
  callerNumberFormatted: string;
  callerName: string;
  callerCountryCode: string;
  callerLocation: string;
  direction: 'inbound' | 'outbound';
  status: 'connected' | 'missed' | 'voicemail';
  statusCode: number;
  source: 'ivr' | 'mobile';
  notificationType: 'normal' | 'clicktocall' | 'obd' | 'webrtc';
  companyId: string;
  departmentId: string;
  departmentName: string;
  duration: string;
  durationSeconds: number;
  durationMinutes: number;
  startTime: number;
  endTime: number;
  logTimestamp: number;
  logTimestampMs: number;
  recordingFileName: string;
  recordingUrl: string;
  callType: 'call' | 'sms';
  isAnonymous: boolean;
  // OBD v2 fields
  referenceId: string;
  obdJobId: string;
  publicIvrId: string;
  clientReferenceId: string;
  // Call UID from _pm
  uid: string;
  // Agent info (first connected agent)
  agentName: string;
  agentId: string;
  agentEmail: string;
  agentNumber: string;
  agentNumberFormatted: string;
  // Leg data
  legs: Array<{
    ringStartTime: string;
    dialString: string;
    lastCallerId: string;
    status: string;
    startTime: number;
    endTime: number;
    duration: string;
    action: string;
    agents: Array<{
      id: string;
      name: string;
      email: string;
      number: string;
      numberFormatted: string;
    }>;
    transferredAgents: Array<{
      id: string;
      name: string;
      email: string;
      number: string;
      numberFormatted: string;
    }>;
  }>;
  // Raw payload for storage
  rawPayload: MyOperatorRawCallLog;
}

/**
 * Status code to string mapping
 */
const STATUS_MAP: Record<number, 'connected' | 'missed' | 'voicemail'> = {
  1: 'connected',
  2: 'missed',
  3: 'voicemail',
};

const NOTIFICATION_MAP: Record<string, 'normal' | 'clicktocall' | 'obd' | 'webrtc'> = {
  '0': 'normal',
  '1': 'clicktocall',
  '2': 'obd',
  '3': 'webrtc',
};

/**
 * Parse "HH:MM:SS" duration string to total seconds
 */
function parseDurationToSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  // Only parse HH:MM:SS or MM:SS format — reject ISO timestamps and other strings
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(duration)) return 0;
  const parts = duration.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/**
 * Parse the raw MyOperator webhook payload into a human-readable format
 *
 * MyOperator sends data as: POST body with `myoperator=<JSON string>`
 * The JSON uses short field names (_ai, _cl, _cr, etc.)
 */
export function parseMyOperatorCallLog(raw: MyOperatorRawCallLog): ParsedCallLog {
  // Extract first agent from leg data or connected users
  let agentName = '';
  let agentId = '';
  let agentEmail = '';
  let agentNumber = '';
  let agentNumberFormatted = '';

  // Try to get agent from leg data first
  if (raw._ld && raw._ld.length > 0) {
    const firstLeg = raw._ld[0];
    if (firstLeg._rr && firstLeg._rr.length > 0) {
      const agent = firstLeg._rr[0];
      agentName = agent._na || '';
      agentId = agent._id || '';
      agentEmail = agent._em || '';
      agentNumber = agent._ct || '';
      agentNumberFormatted = agent._nr || '';
    }
  }

  // Fallback to connected users
  if (!agentName && raw._cn && raw._cn.length > 0) {
    const user = raw._cn[0];
    agentName = user._na || '';
    agentId = user._id || '';
    agentEmail = user._em || '';
    agentNumber = user._ct || '';
    agentNumberFormatted = user._nr || '';
  }

  // Extract UID from _pm parameters
  let uid = '';
  if (raw._pm) {
    const uidParam = raw._pm.find(p => p.ky === 'ui');
    if (uidParam) uid = uidParam.vl;
  }

  // Parse leg data
  const legs = (raw._ld || []).map(leg => ({
    ringStartTime: leg._rst || '',
    dialString: leg._ds || '',
    lastCallerId: leg._did || '',
    status: leg._su || '',
    startTime: leg._st || 0,
    endTime: leg._et || 0,
    duration: leg._dr || '',
    action: leg._ac || '',
    agents: (leg._rr || []).map(a => ({
      id: a._id || '',
      name: a._na || '',
      email: a._em || '',
      number: a._ct || '',
      numberFormatted: a._nr || '',
    })),
    transferredAgents: (leg._tt || []).map(a => ({
      id: a._id || '',
      name: a._na || '',
      email: a._em || '',
      number: a._ct || '',
      numberFormatted: a._nr || '',
    })),
  }));

  return {
    callId: raw._ai || '',
    callerNumber: raw._cr || '',
    callerNumberFormatted: raw._cl || '',
    callerName: raw._cm || '',
    callerCountryCode: raw._cy || '',
    callerLocation: raw._se || '',
    direction: raw._ev === 2 ? 'outbound' : 'inbound',
    status: STATUS_MAP[raw._su] || 'missed',
    statusCode: raw._su || 0,
    source: raw._so === '2' ? 'mobile' : 'ivr',
    notificationType: NOTIFICATION_MAP[raw._ns] || 'normal',
    companyId: raw._ci || '',
    departmentId: raw._di || '',
    departmentName: raw._dn || '',
    duration: raw._dr || '00:00:00',
    durationSeconds: raw._ss || parseDurationToSeconds(raw._dr),
    durationMinutes: raw._drm || 0,
    startTime: raw._st || 0,
    endTime: raw._et || 0,
    logTimestamp: raw._ts || 0,
    logTimestampMs: raw._ms || 0,
    recordingFileName: raw._fn || '',
    recordingUrl: raw._fu || '',
    callType: raw._ty === 2 ? 'sms' : 'call',
    isAnonymous: raw._an === 1,
    referenceId: raw._ri || '',
    obdJobId: raw._ji || '',
    publicIvrId: raw._ivid || '',
    clientReferenceId: raw._cri || '',
    uid,
    agentName,
    agentId,
    agentEmail,
    agentNumber,
    agentNumberFormatted,
    legs,
    rawPayload: raw,
  };
}

export interface WhatsAppWebhookPayload {
  message_id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'document' | 'template';
  text?: { body: string };
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
}

// ============================================================================
// CONTACTS API
// ============================================================================

/**
 * Contact data structure for MyOperator
 */
export interface MyOperatorContact {
  id?: string;
  company_id?: string;
  name: string;
  country_code: string;
  phone_number: string;
  email_id?: string;
  marketing_opt_in?: boolean;
  status?: 'active' | 'inactive';
  custom_fields?: Record<string, unknown>;
  created?: string;
  modified?: string;
}

/**
 * Create contact params
 */
export interface CreateContactParams {
  name: string;
  countryCode?: string; // Default: '91'
  phoneNumber: string;
  emailId?: string;
  marketingOptIn?: boolean;
  customFields?: Record<string, unknown>;
}

/**
 * Create a contact in MyOperator
 *
 * Endpoint: POST https://publicapi.myoperator.co/contacts
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function createContact(
  config: MyOperatorConfig,
  params: CreateContactParams
): Promise<{ success: boolean; contact?: MyOperatorContact; error?: string }> {
  try {
    if (!config.whatsappApiKey) {
      return {
        success: false,
        error: 'MyOperator API key not configured',
      };
    }

    const url = `${MYOPERATOR_WHATSAPP_BASE}/contacts`;

    const payload: Record<string, unknown> = {
      name: params.name,
      country_code: params.countryCode || '91',
      phone_number: params.phoneNumber.replace(/\D/g, ''),
    };

    if (params.emailId) {
      payload.email_id = params.emailId;
    }

    if (params.marketingOptIn !== undefined) {
      payload.marketing_opt_in = params.marketingOptIn;
    }

    if (params.customFields) {
      payload.custom_fields = params.customFields;
    }

    console.log('[MyOperator] Creating contact:', { name: params.name, phone: params.phoneNumber });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsappApiKey}`,
        'X-MYOP-COMPANY-ID': config.companyId,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('[MyOperator] Create contact response:', data);

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        contact: data.data,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to create contact',
    };
  } catch (error) {
    console.error('[MyOperator] Create contact error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch contacts from MyOperator
 *
 * Endpoint: GET https://publicapi.myoperator.co/contacts
 * Supports filtering by phone number: ?country_code=91&phone_number=...
 * Supports custom fields: ?include=custom_fields
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function fetchContacts(
  config: MyOperatorConfig,
  options?: {
    limit?: number; // Max 100, default 10
    offset?: number;
    includeCustomFields?: boolean;
    // Filter by phone number
    phoneNumber?: string;
    countryCode?: string;
  }
): Promise<{ success: boolean; contacts?: MyOperatorContact[]; total?: number; error?: string }> {
  try {
    if (!config.whatsappApiKey) {
      return {
        success: false,
        error: 'MyOperator API key not configured',
      };
    }

    const params = new URLSearchParams();
    params.append('limit', String(options?.limit || 100));
    params.append('offset', String(options?.offset || 0));

    if (options?.includeCustomFields) {
      params.append('include', 'custom_fields');
    }

    // Filter by phone number
    if (options?.phoneNumber) {
      params.append('phone_number', options.phoneNumber.replace(/\D/g, ''));
      params.append('country_code', options.countryCode || '91');
    }

    const url = `${MYOPERATOR_WHATSAPP_BASE}/contacts?${params.toString()}`;

    console.log('[MyOperator] Fetching contacts:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsappApiKey}`,
        'X-MYOP-COMPANY-ID': config.companyId,
      },
    });

    const data = await response.json();

    console.log('[MyOperator] Fetch contacts response:', data);

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        contacts: data.data?.results || [],
        total: data.data?.count || 0,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to fetch contacts',
    };
  } catch (error) {
    console.error('[MyOperator] Fetch contacts error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch a single contact by ID
 *
 * Endpoint: GET https://publicapi.myoperator.co/contacts/:id
 * Supports: ?include=custom_fields
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function fetchContactById(
  config: MyOperatorConfig,
  contactId: string,
  options?: { includeCustomFields?: boolean }
): Promise<{ success: boolean; contact?: MyOperatorContact; error?: string }> {
  try {
    if (!config.whatsappApiKey) {
      return {
        success: false,
        error: 'MyOperator API key not configured',
      };
    }

    const params = new URLSearchParams();
    if (options?.includeCustomFields) {
      params.append('include', 'custom_fields');
    }

    const queryString = params.toString();
    const url = `${MYOPERATOR_WHATSAPP_BASE}/contacts/${contactId}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsappApiKey}`,
        'X-MYOP-COMPANY-ID': config.companyId,
      },
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        contact: data.data,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to fetch contact',
    };
  } catch (error) {
    console.error('[MyOperator] Fetch contact error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Filter contact by phone number
 *
 * Endpoint: GET https://publicapi.myoperator.co/contacts?country_code=91&phone_number=...
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function filterContactByPhone(
  config: MyOperatorConfig,
  phoneNumber: string,
  countryCode: string = '91'
): Promise<{ success: boolean; contact?: MyOperatorContact; error?: string }> {
  const result = await fetchContacts(config, {
    phoneNumber,
    countryCode,
    includeCustomFields: true,
    limit: 1,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (result.contacts && result.contacts.length > 0) {
    return { success: true, contact: result.contacts[0] };
  }

  return { success: false, error: 'Contact not found' };
}

/**
 * Update a contact in MyOperator by phone number (with country code)
 *
 * Endpoint: PATCH https://publicapi.myoperator.co/contacts/:phone_number_with_country_code
 * Example path: /contacts/919876543210
 *
 * @see https://documenter.getpostman.com/view/38426694/2sAXqy3evq
 */
export async function updateContact(
  config: MyOperatorConfig,
  phoneNumberWithCountryCode: string,
  params: Partial<CreateContactParams>
): Promise<{ success: boolean; contact?: MyOperatorContact; error?: string }> {
  try {
    if (!config.whatsappApiKey) {
      return {
        success: false,
        error: 'MyOperator API key not configured',
      };
    }

    // Ensure phone number includes country code (e.g., 919876543210)
    let phone = phoneNumberWithCountryCode.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = `91${phone}`; // Prepend India country code if only 10 digits
    }

    const url = `${MYOPERATOR_WHATSAPP_BASE}/contacts/${phone}`;

    const payload: Record<string, unknown> = {};

    if (params.name) payload.name = params.name;
    if (params.emailId) payload.email_id = params.emailId;
    if (params.marketingOptIn !== undefined) payload.marketing_opt_in = params.marketingOptIn;
    if (params.customFields) payload.custom_fields = params.customFields;

    console.log('[MyOperator] Updating contact by phone:', phone);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsappApiKey}`,
        'X-MYOP-COMPANY-ID': config.companyId,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('[MyOperator] Update contact response:', data);

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        contact: data.data,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to update contact',
    };
  } catch (error) {
    console.error('[MyOperator] Update contact error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
