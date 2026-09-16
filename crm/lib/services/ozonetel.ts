import { supabase } from '@/lib/supabase';
import type { CustomerInfo, OrderInfo, SupportTicketInfo } from '@/lib/types/ozonetel';

export class OzonetelService {
  private apiKey: string;
  private userName: string;
  private domain: string;
  private subscriptionDomain: string;
  private kookooId: string;
  private whatsappApiUrl: string;
  private cachedToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.apiKey = process.env.OZONETEL_API_KEY || '';
    this.userName = process.env.OZONETEL_USERNAME || '';
    this.domain = process.env.OZONETEL_DOMAIN || 'in1-ccaas-api.ozonetel.com';
    this.subscriptionDomain = process.env.OZONETEL_SUBSCRIPTION_DOMAIN || 'subscription.ozonetel.com';
    this.kookooId = process.env.OZONETEL_KOOKOO_ID || '';
    this.whatsappApiUrl = process.env.OZONETEL_WHATSAPP_API_URL || '';
  }

  /**
   * Generate authentication token from Ozonetel
   * Token is valid for 60 minutes
   */
  private async generateToken(): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
      return this.cachedToken;
    }

    // Validate required credentials
    if (!this.apiKey) {
      throw new Error('OZONETEL_API_KEY is not configured in environment variables');
    }
    if (!this.userName) {
      throw new Error('OZONETEL_USERNAME is not configured in environment variables');
    }

    try {
      const url = `https://${this.domain}/ca_apis/CAToken/generateToken`;
      console.log('[Ozonetel] Generating token with:', {
        url,
        userName: this.userName,
        hasApiKey: !!this.apiKey
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apiKey': this.apiKey
        },
        body: JSON.stringify({
          userName: this.userName
        })
      });

      console.log('[Ozonetel] Token generation response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Ozonetel] Token generation failed with response:', errorText);
        throw new Error(`Token generation failed: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[Ozonetel] Token generation data:', {
        hasToken: !!(data.token || data.jwt || data.accessToken),
        hasMessage: !!data.message,
        message: data.message,
        keys: Object.keys(data)
      });

      // Extract token first
      this.cachedToken = data.token || data.jwt || data.accessToken;

      if (!this.cachedToken) {
        // Only throw error if we don't have a token
        const errorMessage = data.message || 'No token found in response';
        throw new Error(`${errorMessage}. Response keys: ${Object.keys(data).join(', ')}`);
      }

      // If we have a token but also a warning message, just log it
      if (data.message) {
        console.warn('[Ozonetel] Token generated with warning:', data.message);
      }

      this.tokenExpiry = Date.now() + 60 * 60 * 1000;

      return this.cachedToken;
    } catch (error) {
      console.error('[Ozonetel] Failed to generate token:', error);
      throw error;
    }
  }

  /**
   * Normalize phone number to match format in database
   * Indian mobile numbers are 10 digits
   * With country code: +91 or 91 prefix (12-13 characters total)
   */
  normalizePhoneNumber(phone: string): string {
    // Remove any non-digit characters first
    let normalized = phone.replace(/\D/g, '');

    // Only remove country code "91" if the number is longer than 10 digits
    // This prevents removing "91" from numbers like 9167055388 that naturally start with 91
    if (normalized.length > 10 && normalized.startsWith('91')) {
      normalized = normalized.substring(2);
    }

    return normalized;
  }

  /**
   * Find customer by phone number
   * Searches across primary, secondary, and WhatsApp numbers
   * If multiple customers have the same number, returns the first one
   */
  async findCustomerByPhone(phoneNumber: string): Promise<CustomerInfo | null> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(
        `mobile_primary.eq.${normalizedPhone},mobile_secondary_1.eq.${normalizedPhone},mobile_secondary_2.eq.${normalizedPhone},whatsapp_number.eq.${normalizedPhone}`
      )
      .limit(1);

    if (error) {
      console.error('[Ozonetel] Error finding customer by phone:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('[Ozonetel] No customer found with phone:', normalizedPhone);
      return null;
    }

    // Log if multiple customers have this number (for debugging duplicate data)
    const { count } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .or(
        `mobile_primary.eq.${normalizedPhone},mobile_secondary_1.eq.${normalizedPhone},mobile_secondary_2.eq.${normalizedPhone},whatsapp_number.eq.${normalizedPhone}`
      );

    if (count && count > 1) {
      console.warn(`[Ozonetel] ⚠ Found ${count} customers with phone ${normalizedPhone}. Returning first match.`);
    }

    return data[0] as CustomerInfo;
  }

  /**
   * Get customer's order history
   */
  async getCustomerOrders(customerId: string, limit: number = 10): Promise<OrderInfo[]> {

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        invoice_number_gst,
        invoice_number_non_gst,
        is_gst_invoice,
        order_status,
        payment_status,
        total_amount,
        order_date,
        shipping_city,
        shipping_pincode,
        shipping_state,
        delivery_status,
        delivery_partner_id,
        source_godown_id,
        order_items (
          product_name,
          quantity,
          unit_price,
          total
        )
      `)
      .eq('customer_id', customerId)
      .order('order_date', { ascending: false })
      .limit(limit);

    if (error || !orders) {
      return [];
    }

    // Get unique delivery partner IDs, godown IDs, and shipping pincodes
    const deliveryPartnerIds = [...new Set(orders.filter(o => o.delivery_partner_id).map(o => o.delivery_partner_id))];
    const godownIds = [...new Set(orders.filter(o => o.source_godown_id).map(o => o.source_godown_id))];
    const shippingPincodes = [...new Set(orders.filter(o => o.shipping_pincode).map(o => o.shipping_pincode))];

    // Fetch delivery partners, godowns, and distributors in parallel
    const [deliveryPartnersResult, godownsResult, distributorsResult] = await Promise.all([
      deliveryPartnerIds.length > 0
        ? supabase
            .from('delivery_partners')
            .select('id, name, mobile')
            .in('id', deliveryPartnerIds)
        : Promise.resolve({ data: [], error: null }),
      godownIds.length > 0
        ? supabase
            .from('godowns')
            .select('id, name, manager_name, manager_phone, distributor_id')
            .in('id', godownIds)
        : Promise.resolve({ data: [], error: null }),
      shippingPincodes.length > 0
        ? supabase
            .from('distributors')
            .select('id, name, phone_primary, serviceable_pincodes')
            .not('serviceable_pincodes', 'is', null)
        : Promise.resolve({ data: [], error: null })
    ]);

    // Create lookup maps
    const deliveryPartnersMap = new Map(
      (deliveryPartnersResult.data || []).map((dp: any) => [dp.id, dp])
    );

    const godownsMap = new Map(
      (godownsResult.data || []).map((g: any) => [g.id, g])
    );

    // Get distributor IDs from godowns for additional lookup
    const godownDistributorIds = [...new Set(
      (godownsResult.data || [])
        .filter((g: any) => g.distributor_id)
        .map((g: any) => g.distributor_id)
    )];

    // Fetch distributors for godowns if needed
    let godownDistributorsMap = new Map();
    if (godownDistributorIds.length > 0) {
      const { data: godownDistributors } = await supabase
        .from('distributors')
        .select('id, name, phone_primary')
        .in('id', godownDistributorIds);

      godownDistributorsMap = new Map(
        (godownDistributors || []).map((d: any) => [d.id, d])
      );
    }

    // Create pincode to distributor mapping
    const pincodeToDistributorMap = new Map<string, { id: string; name: string; phone: string }>();
    (distributorsResult.data || []).forEach((dist: any) => {
      if (dist.serviceable_pincodes && Array.isArray(dist.serviceable_pincodes)) {
        dist.serviceable_pincodes.forEach((pincode: string) => {
          if (!pincodeToDistributorMap.has(pincode)) {
            pincodeToDistributorMap.set(pincode, {
              id: dist.id,
              name: dist.name,
              phone: dist.phone_primary
            });
          }
        });
      }
    });

    return orders.map(order => {
      const deliveryPartner = order.delivery_partner_id
        ? deliveryPartnersMap.get(order.delivery_partner_id)
        : undefined;

      const godown = order.source_godown_id
        ? godownsMap.get(order.source_godown_id)
        : undefined;

      const serviceableDistributor = order.shipping_pincode
        ? pincodeToDistributorMap.get(order.shipping_pincode)
        : undefined;

      // If godown has a distributor, use that instead of pincode-based lookup
      let distributorInfo = serviceableDistributor;
      if (godown?.distributor_id) {
        const godownDistributor = godownDistributorsMap.get(godown.distributor_id);
        if (godownDistributor) {
          distributorInfo = {
            id: godownDistributor.id,
            name: godownDistributor.name,
            phone: godownDistributor.phone_primary
          };
        }
      }

      return {
        ...order,
        items: order.order_items || [],
        delivery_partner_name: deliveryPartner?.name || null,
        delivery_partner_mobile: deliveryPartner?.mobile || null,
        serviceable_distributor_id: distributorInfo?.id || null,
        serviceable_distributor_name: distributorInfo?.name || null,
        serviceable_distributor_phone: distributorInfo?.phone || null,
        godown_name: godown?.name || null,
        godown_manager_name: godown?.manager_name || null,
        godown_manager_phone: godown?.manager_phone || null,
      };
    }) as OrderInfo[];
  }

  /**
   * Get customer's support tickets
   */
  async getCustomerTickets(customerId: string, limit: number = 5): Promise<SupportTicketInfo[]> {

    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, ticket_number, subject, category, priority, status, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data as SupportTicketInfo[];
  }

  /**
   * Get live/active calls from Ozonetel
   * Fetches from live_calls table in database which is populated by webhooks
   * Returns only active calls (ringing, connected, on_hold) - excludes ended/disconnected calls
   */
  async getLiveCalls(): Promise<any[]> {
    try {
      // Query live_calls table for recent calls in the last 2 minutes
      // Only return calls that are NOT disconnected or ended
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('live_calls')
        .select('*')
        .gte('updated_at', twoMinutesAgo) // Use updated_at (when saved) not started_at (call time)
        .not('call_state', 'in', '(disconnected,ended)') // Exclude disconnected and ended calls
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[Ozonetel] Failed to fetch live calls from database:', error);
        return [];
      }

      console.log('[Ozonetel] Live calls from database (active only):', {
        count: data?.length || 0,
        calls: data
      });

      return data || [];
    } catch (error) {
      console.error('[Ozonetel] Failed to fetch live calls - exception:', error);
      return [];
    }
  }

  /**
   * Subscribe to Ozonetel webhook events
   * This registers your webhook URL to receive real-time call events
   *
   * Event types:
   * - Call events: Calling, Answered, Disconnect
   * - Agent events: login, AUX, release, IDLE, calling, incall, ACW, pause, logout
   */
  async subscribeToEvents(webhookUrl: string, eventTypes: string[] = ['Call', 'Agent']): Promise<boolean> {
    try {
      // Ozonetel Subscribe API - based on official documentation
      // Domain: subscription.ozonetel.com (for In-CcaaS)
      // No token needed - uses api_key and username in headers
      const url = `https://${this.subscriptionDomain}/events/subscribe`;

      // Build request body based on Ozonetel documentation
      // Only includes the webhook URLs, no token needed
      const requestBody: any = {};

      // Add URLs based on event types requested
      if (eventTypes.includes('Call')) {
        requestBody.callEventsURL = webhookUrl;
      }
      if (eventTypes.includes('Agent')) {
        requestBody.agentEventsURL = webhookUrl;
      }

      console.log('[Ozonetel] Subscribing to events:', {
        url,
        requestBody,
        userName: this.userName,
        hasApiKey: !!this.apiKey
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_key': this.apiKey,       // Lowercase with underscore
          'username': this.userName      // Lowercase, no camelCase
        },
        body: JSON.stringify(requestBody)
      });

      console.log('[Ozonetel] Subscribe response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const responseText = await response.text();
      console.log('[Ozonetel] Subscribe response body:', responseText);

      if (!response.ok) {
        console.error('[Ozonetel] Failed to subscribe to events:', responseText);
        return false;
      }

      try {
        const data = JSON.parse(responseText);
        console.log('[Ozonetel] Subscription successful:', data);
      } catch {
        console.log('[Ozonetel] Subscription response (non-JSON):', responseText);
      }

      return true;
    } catch (error) {
      console.error('[Ozonetel] Failed to subscribe to events:', error);
      if (error instanceof Error) {
        console.error('[Ozonetel] Error details:', error.message, error.stack);
      }
      return false;
    }
  }

  /**
   * Get list of current webhook subscriptions
   */
  async getSubscriptions(): Promise<any> {
    try {
      // Use the subscription domain and correct headers format
      const url = `https://${this.subscriptionDomain}/events/subscriptions/list`;
      console.log('[Ozonetel] Fetching subscriptions from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api_key': this.apiKey,      // Lowercase with underscore
          'username': this.userName     // Lowercase, no token needed
        }
      });

      console.log('[Ozonetel] Subscriptions response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const responseText = await response.text();
      console.log('[Ozonetel] Subscriptions response body:', responseText);

      if (!response.ok) {
        console.error('[Ozonetel] Failed to fetch subscriptions:', responseText);
        return null;
      }

      try {
        const data = JSON.parse(responseText);
        console.log('[Ozonetel] Current subscriptions:', data);
        return data;
      } catch {
        console.log('[Ozonetel] Subscriptions response (non-JSON):', responseText);
        return { message: responseText };
      }
    } catch (error) {
      console.error('[Ozonetel] Failed to fetch subscriptions:', error);
      if (error instanceof Error) {
        console.error('[Ozonetel] Error details:', error.message, error.stack);
      }
      return null;
    }
  }

  /**
   * Get agent status and current call information
   * This can help identify which agent is on a call
   */
  async getAgentStatus(agentId?: string): Promise<any> {
    try {
      const token = await this.generateToken();

      const url = agentId
        ? `https://${this.domain}/ca_apis/v2/agents/${agentId}/status`
        : `https://${this.domain}/ca_apis/v2/agents/status`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apiKey': this.apiKey,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch agent status:', response.statusText);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
      return null;
    }
  }

  /**
   * Get all logged-in agents and their status (READY, ACW, IDLE, etc.)
   * Uses Ozonetel's Get Agent Logins API with Token Authentication
   * Rate limit: 5 requests per minute
   *
   * Returns list of agents with their current state:
   * - AgentId: string
   * - AgentName: string
   * - PhoneNumber: string
   * - AgentState: "READY" | "ACW" | "IDLE" | "BUSY" | etc.
   * - SkillName: string (comma-separated skills)
   */
  async getAgentLogins(): Promise<any> {
    try {
      // Generate token for authentication (account uses token auth, not basic auth)
      const token = await this.generateToken();

      const url = `https://${this.domain}/ca_apis/getAgentLogins`;

      console.log('[Ozonetel] Fetching agent logins (Token Auth - no Bearer prefix):', {
        url,
        userName: this.userName,
        hasToken: !!token,
        tokenLength: token?.length
      });

      // Try without "Bearer" prefix - some Ozonetel APIs expect just the token
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token // No "Bearer" prefix
        },
        body: JSON.stringify({
          userName: this.userName
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Ozonetel] Get agent logins failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        return null;
      }

      const data = await response.json();

      console.log('[Ozonetel] Agent logins response:', {
        status: data.status,
        agentCount: data.message?.length || 0,
        agents: data.message
      });

      return data;
    } catch (error) {
      console.error('[Ozonetel] Failed to get agent logins:', error);
      if (error instanceof Error) {
        console.error('[Ozonetel] Error details:', error.message);
      }
      return null;
    }
  }

  /**
   * Check if any agents are available (in READY state) to take calls
   * Returns true if at least one agent is READY, false otherwise
   *
   * TEMPORARY WORKAROUND: If getAgentLogins fails due to auth issues,
   * we default to TRUE (always show calls) until Ozonetel admin settings are fixed
   */
  async areAgentsAvailable(): Promise<boolean> {
    try {
      const agentData = await this.getAgentLogins();

      if (!agentData || agentData.status !== 'success' || !Array.isArray(agentData.message)) {
        console.warn('[Ozonetel] Agent availability check failed - API auth not configured properly');
        console.warn('[Ozonetel] WORKAROUND: Defaulting to TRUE (showing all calls)');
        console.warn('[Ozonetel] To fix: Contact Ozonetel support to enable API Authentication setting in admin panel');

        // TEMPORARY: Return true to show all calls when we can't check agent status
        // This way the system still works, just without the agent availability filter
        return true;
      }

      const readyAgents = agentData.message.filter(
        (agent: any) => agent.AgentState === 'READY'
      );

      const isAvailable = readyAgents.length > 0;

      console.log('[Ozonetel] Agent availability check:', {
        totalAgents: agentData.message.length,
        readyAgents: readyAgents.length,
        isAvailable,
        readyAgentIds: readyAgents.map((a: any) => a.AgentId)
      });

      return isAvailable;
    } catch (error) {
      console.error('[Ozonetel] Failed to check agent availability:', error);
      console.warn('[Ozonetel] WORKAROUND: Defaulting to TRUE (showing all calls)');
      return true; // Changed to true so calls still show when API fails
    }
  }

  /**
   * Send WhatsApp message via Ozonetel
   * Note: Verify the exact endpoint and payload format with Ozonetel support
   */
  async sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const token = await this.generateToken();

      const response = await fetch(this.whatsappApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apiKey': this.apiKey,
          'Authorization': token
        },
        body: JSON.stringify({
          kookooId: this.kookooId,
          phoneNumber: phoneNumber,
          message: message
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      return false;
    }
  }
}

export const ozonetelService = new OzonetelService();
