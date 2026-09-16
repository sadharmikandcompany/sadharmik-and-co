// Ozonetel Voice Callback Payload (exact field names from Ozonetel docs)
export interface OzonetelCallbackPayload {
  AgentID: string;
  AgentName: string;
  AgentPhoneNumber: string;
  AgentStatus: 'answered' | 'not_answered';
  AgentUniqueID: string;
  Apikey: string;
  AudioFile?: string; // URL to call recording
  CallDuration: string; // Format: HH:MM:SS
  CallerID: string; // Customer phone number
  CampaignName: string;
  CampaignStatus: 'ONLINE' | 'OFFLINE';
  DialedNumber: string;
  DID: string; // Direct Inward Dialing number
  Disposition?: string;
  EndTime: string; // Format: YYYY:MM:DD HH:MM:SS
  HangupBy: 'UserHangup' | 'Agent Hangup';
  monitorUCID: string; // Unique Call ID
  PhoneName: string;
  Skill: string;
  StartTime: string; // Format: YYYY:MM:DD HH:MM:SS
  Status: 'Answered' | 'NotAnswered';
  TimeToAnswer: string; // Format: HH:MM:SS
  Type: 'Progressive' | 'Inbound' | 'Manual'; // Call type
  UserName: string;
}

export interface OzonetelCallEvent {
  phoneNumber: string;
  callId: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'answered' | 'ended';
  duration?: number;
}

export interface CustomerInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile_primary: string;
  whatsapp_number: string | null;
  whatsapp_same_as_primary: boolean | null;
  mobile_secondary_1: string | null;
  mobile_secondary_2: string | null;
  company_name: string | null;
  gst_number: string | null;
  is_vip: boolean;
  is_defaulter: boolean;
  is_mandir: boolean;
  vip_number: string | null;
  full_address: string | null;
  shipping_room_number: string | null;
  shipping_floor: string | null;
  shipping_wing: string | null;
  shipping_flat_number: string | null;
  shipping_floor_wing: string | null;
  shipping_building_name: string;
  shipping_street_area: string;
  shipping_landmark: string | null;
  shipping_pincode: string;
  shipping_country: string | null;
  shipping_state: string;
  shipping_city: string;
  billing_same_as_shipping: boolean | null;
  billing_room_number: string | null;
  billing_floor: string | null;
  billing_wing: string | null;
  billing_flat_number: string | null;
  billing_floor_wing: string | null;
  billing_building_name: string | null;
  billing_street_area: string | null;
  billing_landmark: string | null;
  billing_pincode: string | null;
  billing_country: string | null;
  billing_state: string | null;
  billing_city: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderInfo {
  id: string;
  order_number: string;
  invoice_number_gst: string | null;
  invoice_number_non_gst: string | null;
  is_gst_invoice: boolean;
  order_status: string;
  payment_status: string;
  total_amount: number;
  order_date: string;
  shipping_city: string;
  shipping_pincode: string;
  items: OrderItem[];
  // Delivery information
  delivery_status: string | null;
  delivery_partner_id: string | null;
  delivery_partner_name?: string | null;
  delivery_partner_mobile?: string | null;
  // Distributor information
  serviceable_distributor_id?: string | null;
  serviceable_distributor_name?: string | null;
  serviceable_distributor_phone?: string | null;
  // Warehouse/Godown manager information
  source_godown_id?: string | null;
  godown_name?: string | null;
  godown_manager_name?: string | null;
  godown_manager_phone?: string | null;
}

export interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface SupportTicketInfo {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}
