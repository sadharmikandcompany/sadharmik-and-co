'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Search, User, Package, AlertCircle, Clock, DollarSign, RefreshCw, PhoneIncoming, MessageCircle, PhoneCall, MapPin, ShoppingCart, UserPlus, PhoneMissed, PhoneOff, Mic, MicOff, Pause, Play, Users, PhoneForwarded, FileText, Edit3, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { CustomerInfo, OrderInfo, SupportTicketInfo } from '@/lib/types/ozonetel';
import { supabase } from '@/lib/supabase';
import { generateOrderInvoice, generateCustomerLedger } from '@/lib/invoice-generator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';

// Disposition options
const DISPOSITION_OPTIONS = [
  "Resolved",
  "Follow-up Required",
  "Order Placed",
  "Complaint Registered",
  "Information Provided",
  "Callback Requested",
  "No Answer",
  "Wrong Number",
  "Other"
];

// Agent pause reasons
const PAUSE_REASONS = [
  "Break",
  "Lunch",
  "Meeting",
  "Training",
  "Technical Issue",
  "Other"
];

// Indian States and Union Territories
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

type CustomerFormData = {
  first_name: string;
  last_name: string;
  email: string;
  mobile_primary: string;
  whatsapp_number: string;
  whatsapp_same_as_primary: boolean;
  mobile_secondary_1: string;
  mobile_secondary_2: string;
  company_name: string;
  gst_number: string;
  pan_card_number: string;
  full_address: string;
  shipping_room_number: string;
  shipping_floor: string;
  shipping_wing: string;
  shipping_flat_number: string;
  shipping_floor_wing: string;
  shipping_building_name: string;
  shipping_street_area: string;
  shipping_landmark: string;
  shipping_pincode: string;
  shipping_country: string;
  shipping_city: string;
  shipping_state: string;
  billing_same_as_shipping: boolean;
  billing_room_number: string;
  billing_floor: string;
  billing_wing: string;
  billing_flat_number: string;
  billing_floor_wing: string;
  billing_building_name: string;
  billing_street_area: string;
  billing_landmark: string;
  billing_pincode: string;
  billing_country: string;
  billing_state: string;
  billing_city: string;
  is_vip: boolean;
  vip_number: string;
  is_defaulter: boolean;
  is_mandir: boolean;
  is_active: boolean;
};

interface CustomerLookupResponse {
  customer: CustomerInfo;
  orders: OrderInfo[];
  tickets: SupportTicketInfo[];
  stats: {
    totalOrders: number;
    totalSpent: number;
    activeTickets: number;
  };
}

interface CallHistoryItem {
  id: string;
  monitor_ucid: string;
  caller_id: string;
  type: string;
  status: string;
  agent_name: string;
  start_time: string;
  call_duration: string;
  disposition: string | null;
  audio_file_url: string | null;
}

type CustomerSearchResult = {
  id: string;
  first_name: string;
  last_name: string;
  mobile_primary: string;
  mobile_secondary_1: string | null;
  mobile_secondary_2: string | null;
  whatsapp_number: string | null;
  vip_number: string | null;
  is_vip: boolean;
  is_mandir: boolean;
  is_defaulter: boolean;
};

export default function SupportDashboardPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestCall, setLatestCall] = useState<string | null>(null);
  const [checkingCalls, setCheckingCalls] = useState(false);
  const [autoRefresh] = useState(true);
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallHistoryItem[]>([]);
  const [liveCalls, setLiveCalls] = useState<any[]>([]);
  const [hasLiveCall, setHasLiveCall] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [generatingVipNumber, setGeneratingVipNumber] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>({
    first_name: '',
    last_name: '',
    email: '',
    mobile_primary: '',
    whatsapp_number: '',
    whatsapp_same_as_primary: false,
    mobile_secondary_1: '',
    mobile_secondary_2: '',
    company_name: '',
    gst_number: '',
    pan_card_number: '',
    full_address: '', // Will be auto-generated from structured fields
    shipping_room_number: '',
    shipping_floor: '',
    shipping_wing: '',
    shipping_flat_number: '',
    shipping_floor_wing: '',
    shipping_building_name: '',
    shipping_street_area: '',
    shipping_landmark: '',
    shipping_pincode: '',
    shipping_country: 'India',
    shipping_city: '',
    shipping_state: '',
    billing_same_as_shipping: true,
    billing_room_number: '',
    billing_floor: '',
    billing_wing: '',
    billing_flat_number: '',
    billing_floor_wing: '',
    billing_building_name: '',
    billing_street_area: '',
    billing_landmark: '',
    billing_pincode: '',
    billing_country: '',
    billing_state: '',
    billing_city: '',
    is_vip: false,
    vip_number: '',
    is_defaulter: false,
    is_mandir: false,
    is_active: true,
  });

  // Call control states
  const [activeCall, setActiveCall] = useState<{
    ucid: string;
    phoneNumber: string;
    startTime: Date;
    isOnHold: boolean;
    isMuted: boolean;
    isRecordingPaused: boolean;
  } | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);

  // Disposition states
  const [dispositionDialogOpen, setDispositionDialogOpen] = useState(false);
  const [dispositionForm, setDispositionForm] = useState({
    callId: '',
    disposition: '',
    notes: ''
  });
  const [savingDisposition, setSavingDisposition] = useState(false);

  // Agent state
  const [agentState, setAgentState] = useState<'Ready' | 'Pause' | 'Busy' | null>(null);
  const [agentStateDialogOpen, setAgentStateDialogOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  // Agent configuration from database
  const [agentConfig, setAgentConfig] = useState<{
    agentId: string;
    agentName: string;
    phoneName: string;
    campaignName: string;
    skills: string[];
    agentModes: string[];
  } | null>(null);
  const [loadingAgentConfig, setLoadingAgentConfig] = useState(true);
  const [agentsAvailable, setAgentsAvailable] = useState(true); // Default to true (show calls)
  const [checkingAgentAvailability, setCheckingAgentAvailability] = useState(false);
  const [agentApiWorking, setAgentApiWorking] = useState(false);
  const [agentApiWarning, setAgentApiWarning] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerData, setEditCustomerData] = useState<any>({});
  const [savingCustomerEdit, setSavingCustomerEdit] = useState(false);

  // Get authenticated user from Supabase Auth
  useEffect(() => {
    const getUser = async () => {
      setAuthLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
          console.log('[Auth] Logged in as:', user.email);
        } else {
          console.warn('[Auth] No user logged in');
          toast.error('Please log in to access the support dashboard');
        }
      } catch (error) {
        console.error('[Auth] Error getting user:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    getUser();
  }, []);

  // Fetch agent configuration when user email is available
  useEffect(() => {
    if (userEmail) {
      fetchAgentConfig();
    }
  }, [userEmail]);

  const fetchAgentConfig = async () => {
    if (!userEmail) return;

    setLoadingAgentConfig(true);
    try {
      const response = await fetch(`/api/support/agent-config?email=${encodeURIComponent(userEmail)}`);
      const data = await response.json();

      if (data.success && data.hasConfig) {
        setAgentConfig(data.agentConfig);
        console.log('[Agent Config] Loaded:', data.agentConfig);
      } else {
        // Agent config is optional - system uses webhook-based agent availability
        console.log('[Agent Config] Not configured for user (using webhook-based availability)');
      }
    } catch (error) {
      console.error('[Agent Config] Error fetching:', error);
    } finally {
      setLoadingAgentConfig(false);
    }
  };

  // Check for latest incoming call from database
  const checkForIncomingCalls = async () => {
    setCheckingCalls(true);
    setError(null);
    try {
      // Build URL with optional agentId filter
      const url = agentConfig?.agentId
        ? `/api/support/latest-call?agentId=${encodeURIComponent(agentConfig.agentId)}`
        : '/api/support/latest-call';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.phoneNumber) {
          // Normalize phone number (remove +91 or 91 prefix)
          const normalizedPhone = data.phoneNumber.replace(/^\+91/, '').replace(/^91/, '');

          // Check if this is a very recent call (within last 30 seconds)
          const callTime = new Date(data.timestamp).getTime();
          const now = Date.now();
          const ageInSeconds = (now - callTime) / 1000;

          // Only show calls from last 30 seconds as "live"
          if (ageInSeconds <= 30) {
            // Only update if it's a different call
            if (normalizedPhone !== latestCall) {
              setLatestCall(normalizedPhone);
              setPhoneNumber(normalizedPhone);
              setHasLiveCall(true); // Mark as live call
              console.log('🔔 New incoming call detected:', {
                phone: normalizedPhone,
                callId: data.callId,
                agent: data.agentName,
                ageSeconds: ageInSeconds.toFixed(1)
              });
              handleSearch(normalizedPhone);
            }
          } else {
            console.log(`Call is ${ageInSeconds.toFixed(0)}s old, not showing as live`);
            setHasLiveCall(false);
          }
        } else {
          console.log('No recent incoming calls found (last 5 minutes)');
          setHasLiveCall(false);
        }
      } else {
        console.error('Failed to fetch latest call:', response.status);
      }
    } catch (err) {
      console.error('Failed to check for incoming calls:', err);
      setError('Failed to check for incoming calls. Please try again.');
    } finally {
      setCheckingCalls(false);
    }
  };

  // Check agent availability (READY state)
  const checkAgentAvailability = async () => {
    setCheckingAgentAvailability(true);
    try {
      const response = await fetch('/api/support/agent-availability');
      if (response.ok) {
        const data = await response.json();
        setAgentsAvailable(data.isAvailable);
        setAgentApiWorking(data.apiWorking);
        setAgentApiWarning(data.warning);

        console.log('[Agent Availability]', {
          isAvailable: data.isAvailable,
          apiWorking: data.apiWorking,
          warning: data.warning,
          stats: data.stats,
          readyAgents: data.readyAgentList
        });
      } else {
        console.error('Failed to check agent availability:', response.status);
        setAgentsAvailable(true); // Default to showing calls on error
        setAgentApiWorking(false);
      }
    } catch (err) {
      console.error('Failed to check agent availability:', err);
      setAgentsAvailable(true); // Default to showing calls on error
      setAgentApiWorking(false);
    } finally {
      setCheckingAgentAvailability(false);
    }
  };

  // Check for live/ringing calls
  const checkLiveCalls = async () => {
    if (!userEmail) return; // Don't check if no user logged in

    try {
      // Try real-time webhook endpoint first with server-side filtering
      const realtimeUrl = agentConfig?.agentId
        ? `/api/webhooks/ozonetel/realtime?agentId=${encodeURIComponent(agentConfig.agentId)}`
        : '/api/webhooks/ozonetel/realtime';

      const realtimeResponse = await fetch(realtimeUrl);
      if (realtimeResponse.ok) {
        const realtimeData = await realtimeResponse.json();
        if (realtimeData.liveCalls && realtimeData.liveCalls.length > 0) {
          console.log('[Realtime] Received calls (pre-filtered by API):', {
            count: realtimeData.liveCalls.length,
            userAgentId: agentConfig?.agentId || 'none (all agents)',
            calls: realtimeData.liveCalls.map((c: any) => ({ phone: c.phone_number, agent: c.agent_id }))
          });

          setLiveCalls(realtimeData.liveCalls);
          setHasLiveCall(true);

          // Auto-fill the first ringing call
          const ringingCall = realtimeData.liveCalls.find((call: any) => call.call_state === 'ringing');
          if (ringingCall) {
            const normalizedPhone = ringingCall.phone_number.replace(/^\+91/, '').replace(/^91/, '');
            if (normalizedPhone !== latestCall) {
              setLatestCall(normalizedPhone);
              setPhoneNumber(normalizedPhone);
              handleSearch(normalizedPhone);
            }
          }
          return;
        }
      }

      // Fallback: try Ozonetel API polling with server-side filtering
      const url = agentConfig?.agentId
        ? `/api/support/live-calls?agentId=${encodeURIComponent(agentConfig.agentId)}`
        : '/api/support/live-calls';

      const apiResponse = await fetch(url);
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        if (apiData.liveCalls && apiData.liveCalls.length > 0) {
          // No need for client-side filtering anymore - API already filtered by agent_id
          console.log('[Live Calls] Received calls (pre-filtered by API):', {
            count: apiData.liveCalls.length,
            userAgentId: agentConfig?.agentId || 'none (all agents)',
            calls: apiData.liveCalls.map((c: any) => ({ phone: c.phone_number, agent: c.agent_id }))
          });

          setLiveCalls(apiData.liveCalls);
          setHasLiveCall(apiData.liveCalls.length > 0);
        } else {
          setLiveCalls([]);
          setHasLiveCall(false);
        }
      }
    } catch (err) {
      console.error('Failed to check live calls:', err);
      setLiveCalls([]);
      setHasLiveCall(false);
    }
  };

  // Load recent calls on mount and refresh
  const loadRecentCalls = async () => {
    // Build query with server-side filtering by agent_id
    let query = supabase
      .from('call_history')
      .select('id, monitor_ucid, caller_id, type, status, agent_id, agent_name, start_time, call_duration, disposition, audio_file_url');

    // Add server-side filtering by agent_id if user has agent config
    if (agentConfig?.agentId) {
      query = query.eq('agent_id', agentConfig.agentId);
      console.log('[Recent Calls] Filtering by agent_id:', agentConfig.agentId);
    } else {
      console.log('[Recent Calls] No agent filter - showing all calls');
    }

    const { data, error } = await query
      .order('start_time', { ascending: false })
      .limit(10); // Limit to 10 since we're filtering server-side

    if (!error && data) {
      console.log('[Recent Calls] Loaded:', {
        count: data.length,
        userAgentId: agentConfig?.agentId || 'none (all agents)'
      });
      setRecentCalls(data);
    }
  };

  // Auto-refresh polling for incoming calls every 3 seconds (faster for live calls)
  useEffect(() => {
    if (!userEmail) return; // Don't start polling until user is logged in

    // CRITICAL: Wait for agent config to load before starting polling
    // This prevents showing other agents' calls during the brief window before filtering is applied
    if (loadingAgentConfig) {
      console.log('[Polling] Waiting for agent config to load before starting...');
      return;
    }

    console.log('[Polling] Agent config loaded, starting polling with filter:', {
      agentId: agentConfig?.agentId || 'none (admin mode)'
    });

    // Load recent calls on mount
    loadRecentCalls();
    checkLiveCalls(); // Check for live calls immediately
    checkAgentAvailability(); // Check agent availability immediately

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      checkAgentAvailability(); // Check if agents are available (READY state)
      checkLiveCalls(); // Check for LIVE/RINGING calls (PRIORITY)
      checkForIncomingCalls(); // Check for recent completed calls
      loadRecentCalls(); // Refresh recent calls list
    }, 3000); // Check every 3 seconds for faster response

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, latestCall, userEmail, loadingAgentConfig, agentConfig]);

  // Listen for webhook-triggered events (real-time via custom events)
  useEffect(() => {
    const handleIncomingCall = (event: CustomEvent) => {
      const phoneNumber = event.detail.phoneNumber;
      setLatestCall(phoneNumber);
      setPhoneNumber(phoneNumber);
      setShowSearchResults(false);
      handleSearch(phoneNumber);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('ozonetel:incoming-call' as any, handleIncomingCall);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('ozonetel:incoming-call' as any, handleIncomingCall);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search for customer suggestions
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (phoneNumber && phoneNumber.length >= 2) {
        searchCustomerSuggestions(phoneNumber);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [phoneNumber]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-dropdown-container')) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCustomerSuggestions = async (searchTerm: string) => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, mobile_primary, mobile_secondary_1, mobile_secondary_2, whatsapp_number, vip_number, is_vip, is_mandir, is_defaulter")
        .eq("is_active", true)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,mobile_primary.ilike.%${searchTerm}%,mobile_secondary_1.ilike.%${searchTerm}%,mobile_secondary_2.ilike.%${searchTerm}%,whatsapp_number.ilike.%${searchTerm}%,vip_number.ilike.%${searchTerm}%,full_address.ilike.%${searchTerm}%`)
        .limit(10);

      if (!error && data) {
        setSearchResults(data);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Error searching customers:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getNextVipNumber = async (): Promise<string> => {
    try {
      // Fetch all Sd numbers from the database
      const { data, error } = await supabase
        .from("customers")
        .select("vip_number")
        .not("vip_number", "is", null);

      if (error) {
        console.error("Error fetching Sd numbers:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        // No Sd numbers exist, start from 1
        return "1";
      }

      // Convert all Sd numbers to integers and find the highest
      const vipNumbers = data
        .map(item => parseInt(item.vip_number, 10))
        .filter(num => !isNaN(num));

      if (vipNumbers.length === 0) {
        return "1";
      }

      const highestVipNumber = Math.max(...vipNumbers);
      // Increment and return as string
      const nextNumber = highestVipNumber + 1;
      return nextNumber.toString();
    } catch (error) {
      console.error("Error generating Sd number:", error);
      // Return a fallback number if there's an error
      return Date.now().toString().slice(-4);
    }
  };

  const handleVipToggle = async (checked: boolean) => {
    if (checked && !formData.vip_number) {
      // Auto-generate Sd number when Sd is checked and no Sd number exists
      setGeneratingVipNumber(true);
      try {
        const nextVipNumber = await getNextVipNumber();
        setFormData({ ...formData, is_vip: true, vip_number: nextVipNumber });
        toast.success(`Sd number ${nextVipNumber} assigned automatically`);
      } catch (error) {
        console.error("Error generating Sd number:", error);
        toast.error("Failed to generate Sd number. Please enter manually.");
        setFormData({ ...formData, is_vip: true });
      } finally {
        setGeneratingVipNumber(false);
      }
    } else {
      // Unchecking must also clear the number — otherwise it survives in
      // form state (and gets saved back) even though the tier is now off.
      setFormData({ ...formData, is_vip: checked, vip_number: checked ? formData.vip_number : "" });
    }
  };

  const handleOpenCustomerDialog = () => {
    // Pre-fill the phone number if it's a valid 10-digit number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      mobile_primary: cleanPhone.length === 10 ? cleanPhone : '',
      whatsapp_number: '',
      whatsapp_same_as_primary: false,
      mobile_secondary_1: '',
      mobile_secondary_2: '',
      company_name: '',
      gst_number: '',
      pan_card_number: '',
      full_address: '', // Will be auto-generated from structured fields
      shipping_room_number: '',
      shipping_floor: '',
      shipping_wing: '',
      shipping_flat_number: '',
      shipping_floor_wing: '',
      shipping_building_name: '',
      shipping_street_area: '',
      shipping_landmark: '',
      shipping_pincode: '',
      shipping_country: 'India',
      shipping_city: '',
      shipping_state: '',
      billing_same_as_shipping: true,
      billing_room_number: '',
      billing_floor: '',
      billing_wing: '',
      billing_flat_number: '',
      billing_floor_wing: '',
      billing_building_name: '',
      billing_street_area: '',
      billing_landmark: '',
      billing_pincode: '',
      billing_country: '',
      billing_state: '',
      billing_city: '',
      is_vip: false,
      vip_number: '',
      is_defaulter: false,
      is_mandir: false,
      is_active: true,
    });
    setCustomerDialogOpen(true);
  };

  const handleSaveCustomer = async () => {
    // Basic validation
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error('First name and last name are required');
      return;
    }

    const mobileRegex = /^\d{10}$/;
    if (!formData.mobile_primary.match(mobileRegex)) {
      toast.error('Mobile number must be exactly 10 digits');
      return;
    }

    // Address validation: All required structured address fields must be provided
    if (!formData.shipping_building_name.trim() || !formData.shipping_street_area.trim() ||
        !formData.shipping_city.trim() || !formData.shipping_state.trim() || !formData.shipping_pincode.trim()) {
      toast.error('Please fill in all required address fields');
      return;
    }

    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(formData.shipping_pincode.trim())) {
      toast.error('Pincode must be exactly 6 digits');
      return;
    }

    // Email validation - only if provided
    if (formData.email && formData.email.trim().length > 0) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!formData.email.match(emailRegex)) {
        toast.error('Please enter a valid email address');
        return;
      }
    }

    // GST validation - must be exactly 15 characters if provided
    if (formData.gst_number && formData.gst_number.trim().length > 0) {
      if (formData.gst_number.trim().length !== 15) {
        toast.error('GST number must be exactly 15 characters');
        return;
      }
    }

    // PAN validation - must match format if provided
    if (formData.pan_card_number && formData.pan_card_number.trim().length > 0) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!formData.pan_card_number.match(panRegex)) {
        toast.error('PAN must be in format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)');
        return;
      }
    }

    setSavingCustomer(true);
    try {
      // Sync new fields (room_number, floor, wing) with old fields (flat_number, floor_wing) for backward compatibility
      const floorWing = [formData.shipping_floor, formData.shipping_wing]
        .filter(v => v && v.trim() !== "")
        .join(" / ");
      const billingFloorWing = [formData.billing_floor, formData.billing_wing]
        .filter(v => v && v.trim() !== "")
        .join(" / ");

      // Build full_address string from structured address fields
      const addressParts = [
        formData.shipping_room_number,
        formData.shipping_floor,
        formData.shipping_wing,
        formData.shipping_building_name,
        formData.shipping_street_area,
        formData.shipping_landmark,
        formData.shipping_city,
        formData.shipping_state,
        formData.shipping_pincode,
        formData.shipping_country
      ].filter(part => part && part.trim() !== '');

      const fullAddress = addressParts.join(', ');

      const cleanedData = {
        ...formData,
        email: formData.email.trim() === '' ? null : formData.email,
        company_name: formData.company_name.trim() === '' ? null : formData.company_name,
        gst_number: formData.gst_number.trim() === '' ? null : formData.gst_number,
        pan_card_number: formData.pan_card_number.trim() === '' ? null : formData.pan_card_number.toUpperCase(),
        mobile_secondary_1: formData.mobile_secondary_1.trim() === '' ? null : formData.mobile_secondary_1,
        mobile_secondary_2: formData.mobile_secondary_2.trim() === '' ? null : formData.mobile_secondary_2,
        whatsapp_number: formData.whatsapp_same_as_primary ? formData.mobile_primary : (formData.whatsapp_number || null),
        vip_number: formData.vip_number.trim() === '' ? null : formData.vip_number,
        full_address: fullAddress,
        shipping_room_number: formData.shipping_room_number.trim() === '' ? null : formData.shipping_room_number,
        shipping_floor: formData.shipping_floor.trim() === '' ? null : formData.shipping_floor,
        shipping_wing: formData.shipping_wing.trim() === '' ? null : formData.shipping_wing,
        // Sync old fields with new fields for backward compatibility
        shipping_flat_number: formData.shipping_room_number || null,
        shipping_floor_wing: floorWing || null,
        shipping_landmark: formData.shipping_landmark.trim() === '' ? null : formData.shipping_landmark,
        billing_room_number: formData.billing_room_number.trim() === '' ? null : formData.billing_room_number,
        billing_floor: formData.billing_floor.trim() === '' ? null : formData.billing_floor,
        billing_wing: formData.billing_wing.trim() === '' ? null : formData.billing_wing,
        billing_flat_number: formData.billing_room_number || null,
        billing_floor_wing: billingFloorWing || null,
        billing_building_name: formData.billing_building_name.trim() === '' ? null : formData.billing_building_name,
        billing_street_area: formData.billing_street_area.trim() === '' ? null : formData.billing_street_area,
        billing_landmark: formData.billing_landmark.trim() === '' ? null : formData.billing_landmark,
        billing_pincode: formData.billing_pincode.trim() === '' ? null : formData.billing_pincode,
        billing_country: formData.billing_country.trim() === '' ? null : formData.billing_country,
        billing_state: formData.billing_state.trim() === '' ? null : formData.billing_state,
        billing_city: formData.billing_city.trim() === '' ? null : formData.billing_city,
      };

      const { data, error } = await supabase
        .from('customers')
        .insert([cleanedData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Customer created successfully');
      setCustomerDialogOpen(false);

      // Auto-search for the newly created customer
      if (data) {
        setPhoneNumber(data.mobile_primary);
        handleSearch(data.mobile_primary);
      }
    } catch (error: unknown) {
      console.error('Error saving customer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save customer';
      toast.error(errorMessage);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleEditCustomer = () => {
    if (!customerData?.customer) return;
    setEditCustomerData(customerData.customer);
    setIsEditingCustomer(true);
  };

  const handleCancelEdit = () => {
    setIsEditingCustomer(false);
    setEditCustomerData({});
  };

  const handleSaveCustomerEdit = async () => {
    if (!customerData?.customer || !editCustomerData.id) return;

    setSavingCustomerEdit(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          first_name: editCustomerData.first_name,
          last_name: editCustomerData.last_name,
          email: editCustomerData.email,
          company_name: editCustomerData.company_name,
          mobile_secondary_1: editCustomerData.mobile_secondary_1,
          mobile_secondary_2: editCustomerData.mobile_secondary_2,
          whatsapp_number: editCustomerData.whatsapp_number,
        })
        .eq('id', editCustomerData.id);

      if (error) throw error;

      toast.success('Customer updated successfully');
      setIsEditingCustomer(false);
      // Refresh customer data
      handleSearch(customerData.customer.mobile_primary);
    } catch (error: unknown) {
      console.error('Error updating customer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update customer';
      toast.error(errorMessage);
    } finally {
      setSavingCustomerEdit(false);
    }
  };

  const handleSearch = async (phone?: string) => {
    const searchPhone = phone || phoneNumber;
    if (!searchPhone) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/support/customer-lookup?phone=${encodeURIComponent(searchPhone)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to find customer');
      }

      const data: CustomerLookupResponse = await response.json();
      setCustomerData(data);

      // Load call history for this customer with server-side filtering
      if (data.customer?.id) {
        let callQuery = supabase
          .from('call_history')
          .select('id, monitor_ucid, caller_id, type, status, agent_id, agent_name, start_time, call_duration, disposition, audio_file_url')
          .eq('customer_id', data.customer.id);

        // Add server-side filtering by agent_id if user has agent config
        if (agentConfig?.agentId) {
          callQuery = callQuery.eq('agent_id', agentConfig.agentId);
          console.log('[Customer Call History] Filtering by agent_id:', agentConfig.agentId);
        } else {
          console.log('[Customer Call History] No agent filter - showing all calls');
        }

        const { data: callData, error: callError } = await callQuery
          .order('start_time', { ascending: false })
          .limit(10); // Limit to 10 since we're filtering server-side

        if (!callError && callData) {
          console.log('[Customer Call History] Loaded:', {
            count: callData.length,
            userAgentId: agentConfig?.agentId || 'none (all agents)',
            customerId: data.customer.id
          });
          setCallHistory(callData);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setCustomerData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      open: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      // Delivery statuses
      not_assigned: 'bg-gray-100 text-gray-800',
      assigned: 'bg-blue-100 text-blue-800',
      picked_up: 'bg-indigo-100 text-indigo-800',
      in_transit: 'bg-purple-100 text-purple-800',
      out_for_delivery: 'bg-orange-100 text-orange-800',
      failed: 'bg-red-100 text-red-800',
      returned: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
      critical: 'bg-red-200 text-red-900',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const formatPhoneForTel = (phone: string) => {
    // Remove any non-digit characters and format for tel: link
    const cleaned = phone.replace(/\D/g, '');
    return `tel:+91${cleaned}`;
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    // Remove any non-digit characters and format for WhatsApp
    const cleaned = phone.replace(/\D/g, '');
    return `https://wa.me/91${cleaned}`;
  };

  // Download invoice handler
  const fetchDistributorCompanyInfo = async (shippingPincode: string) => {
    try {
      const { data: distributorsData } = await supabase
        .from("distributors")
        .select("company_name, name, email, phone_primary, gst_number, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode, bank_name, bank_account_number, bank_ifsc_code, bank_branch, serviceable_pincodes")
        .not("serviceable_pincodes", "is", null)

      if (distributorsData) {
        const match = distributorsData.find((dist: any) =>
          dist.serviceable_pincodes &&
          Array.isArray(dist.serviceable_pincodes) &&
          dist.serviceable_pincodes.includes(shippingPincode)
        )
        if (match) {
          const address = [match.shipping_address_line1, match.shipping_address_line2].filter(Boolean).join(', ')
          return {
            name: match.company_name || "Sadharmik & Company",
            address: address || '',
            city: match.shipping_city || '',
            pincode: match.shipping_pincode || '',
            phone: match.phone_primary || '',
            email: match.email || '',
            gst: match.gst_number || '',
            state: match.shipping_state ? `${match.shipping_pincode?.substring(0, 2) || ''}-${match.shipping_state}` : '',
            bankName: match.bank_name || '',
            accountNumber: match.bank_account_number || '',
            ifscCode: match.bank_ifsc_code || '',
            branch: match.bank_branch || '',
          }
        }
      }
    } catch (error) {
      console.error("Error fetching distributor info:", error)
    }
    return undefined
  }

  const handleDownloadInvoice = async (order: OrderInfo) => {
    if (!customerData) return;

    try {
      // Fetch full order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order.id)
        .single();

      if (orderError) throw orderError;

      // Fetch order items with all details
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);

      if (itemsError) throw itemsError;

      const companyInfo = orderData.shipping_pincode ? await fetchDistributorCompanyInfo(orderData.shipping_pincode) : undefined;

      const invoiceData = {
        order: {
          id: orderData.id,
          order_number: orderData.order_number,
          invoice_number_gst: orderData.invoice_number_gst,
          invoice_number_non_gst: orderData.invoice_number_non_gst,
          is_gst_invoice: orderData.is_gst_invoice,
          order_date: orderData.order_date,
          order_status: orderData.order_status,
          payment_status: orderData.payment_status,
          payment_method: orderData.payment_method || 'Not specified',
          subtotal: orderData.subtotal,
          discount_amount: orderData.discount_amount,
          cgst_amount: orderData.cgst_amount,
          sgst_amount: orderData.sgst_amount,
          igst_amount: orderData.igst_amount,
          shipping_charges: orderData.shipping_charges,
          total_amount: orderData.total_amount,
          shipping_room_number: orderData.shipping_room_number || undefined,
          shipping_floor: orderData.shipping_floor || undefined,
          shipping_wing: orderData.shipping_wing || undefined,
          shipping_flat_number: orderData.shipping_flat_number || undefined,
          shipping_floor_wing: orderData.shipping_floor_wing || undefined,
          shipping_building_name: orderData.shipping_building_name,
          shipping_street_area: orderData.shipping_street_area,
          shipping_landmark: orderData.shipping_landmark || undefined,
          shipping_city: orderData.shipping_city,
          shipping_state: orderData.shipping_state,
          shipping_pincode: orderData.shipping_pincode,
          shipping_country: orderData.shipping_country || undefined,
          billing_room_number: orderData.billing_room_number || undefined,
          billing_floor: orderData.billing_floor || undefined,
          billing_wing: orderData.billing_wing || undefined,
          billing_flat_number: orderData.billing_flat_number || undefined,
          billing_floor_wing: orderData.billing_floor_wing || undefined,
          billing_building_name: orderData.billing_building_name,
          billing_street_area: orderData.billing_street_area,
          billing_landmark: orderData.billing_landmark || undefined,
          billing_city: orderData.billing_city,
          billing_state: orderData.billing_state,
          billing_pincode: orderData.billing_pincode,
          billing_country: orderData.billing_country || undefined,
        },
        customer: {
          first_name: customerData.customer.first_name,
          last_name: customerData.customer.last_name,
          email: customerData.customer.email || undefined,
          mobile_primary: customerData.customer.mobile_primary,
          company_name: customerData.customer.company_name || undefined,
          gst_number: customerData.customer.gst_number || undefined,
          full_address: customerData.customer.full_address || undefined,
        },
        items: itemsData.map(item => ({
          product_name: item.product_name,
          product_sku: item.product_sku || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount,
          gst_percentage: item.gst_percentage,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total: item.total,
          hsn_code: item.hsn_code || undefined,
        })),
        companyInfo,
      };

      generateOrderInvoice(invoiceData, `${customerData.customer.first_name}_${customerData.customer.last_name}`);
      toast.success("Invoice downloaded successfully");
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast.error("Failed to download invoice");
    }
  };

  // Share invoice via WhatsApp handler
  const handleShareViaWhatsApp = async (order: OrderInfo) => {
    if (!customerData) return;

    try {
      // Check if customer has a phone number
      if (!customerData.customer.mobile_primary) {
        toast.error("Customer phone number not available");
        return;
      }

      // Create invoice message with order link
      const invoiceNumber = order.is_gst_invoice
        ? order.invoice_number_gst
        : order.invoice_number_non_gst;

      const orderDate = new Date(order.order_date);
      const formattedDate = orderDate.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Construct the order URL
      const orderUrl = `https://sadharmikandcompany.com/order/${order.order_number}`;

      const message = `*INVOICE - ${invoiceNumber || order.order_number}*\n\n` +
        `Dear ${customerData.customer.first_name} ${customerData.customer.last_name},\n\n` +
        `Thank you for your order!\n\n` +
        `*Order Details:*\n` +
        `Order Number: ${order.order_number}\n` +
        `Order Date: ${formattedDate}\n` +
        `Total Amount: ₹${order.total_amount.toFixed(2)}\n` +
        `Payment Status: ${order.payment_status}\n\n` +
        `View your complete order details and invoice here:\n${orderUrl}\n\n` +
        `Thank you for shopping with Sadharmik & Company!`;

      // Format phone number - remove any non-digit characters and add country code if needed
      let phoneNumber = customerData.customer.mobile_primary.replace(/\D/g, '');
      if (phoneNumber.length === 10) {
        phoneNumber = '91' + phoneNumber; // Add India country code
      }

      // Create WhatsApp URL
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

      // Open WhatsApp in a new tab/window
      window.open(whatsappUrl, '_blank');
      toast.success("Opening WhatsApp...");
    } catch (error) {
      console.error("Error sharing via WhatsApp:", error);
      toast.error("Failed to share via WhatsApp");
    }
  };

  // Download customer ledger handler
  const handleDownloadLedger = () => {
    if (!customerData) return;

    try {
      const ledgerData = {
        customer: {
          first_name: customerData.customer.first_name,
          last_name: customerData.customer.last_name,
          mobile_primary: customerData.customer.mobile_primary,
          email: customerData.customer.email || undefined,
          company_name: customerData.customer.company_name || undefined,
          gst_number: customerData.customer.gst_number || undefined,
          vip_number: customerData.customer.vip_number || undefined,
        },
        orders: customerData.orders.map(order => ({
          order_number: order.order_number,
          invoice_number_gst: order.invoice_number_gst,
          invoice_number_non_gst: order.invoice_number_non_gst,
          is_gst_invoice: order.is_gst_invoice,
          order_date: order.order_date,
          total_amount: order.total_amount,
          payment_status: order.payment_status,
          order_status: order.order_status,
        })),
        totalSpent: customerData.stats.totalSpent,
      };

      generateCustomerLedger(ledgerData);
      toast.success("Customer ledger downloaded successfully");
    } catch (error) {
      console.error("Error downloading ledger:", error);
      toast.error("Failed to download ledger");
    }
  };

  // Call timer effect
  useEffect(() => {
    if (!activeCall) {
      setCallDuration(0);
      return;
    }

    const interval = setInterval(() => {
      const duration = Math.floor((Date.now() - activeCall.startTime.getTime()) / 1000);
      setCallDuration(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  // Format call duration as MM:SS
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Click-to-dial function
  const handleClickToDial = async (phoneNumber: string) => {
    try {
      // Check if agent config is loaded
      if (!agentConfig) {
        toast.error('Agent configuration not loaded. Please refresh the page.');
        return;
      }

      const response = await fetch('/api/support/manual-dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentConfig.agentId,
          campaignName: agentConfig.campaignName,
          customerNumber: phoneNumber
        })
      });

      const data = await response.json();

      if (data.success && data.ucid) {
        toast.success('Call initiated successfully');
        // Set active call
        setActiveCall({
          ucid: data.ucid,
          phoneNumber,
          startTime: new Date(),
          isOnHold: false,
          isMuted: false,
          isRecordingPaused: false
        });
      } else {
        toast.error(data.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error('Failed to initiate call');
    }
  };

  // Call control functions
  const handleCallControl = async (action: string, conferenceNumber?: string) => {
    if (!activeCall) return;

    try {
      const response = await fetch('/api/support/call-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ucid: activeCall.ucid,
          ...(conferenceNumber && { conferenceNumber })
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);

        // Update activeCall state
        if (action === 'HOLD') {
          setActiveCall({ ...activeCall, isOnHold: true });
        } else if (action === 'UNHOLD') {
          setActiveCall({ ...activeCall, isOnHold: false });
        } else if (action === 'MUTE') {
          setActiveCall({ ...activeCall, isMuted: true });
        } else if (action === 'UNMUTE') {
          setActiveCall({ ...activeCall, isMuted: false });
        } else if (action === 'KICK_CALL') {
          // Call ended, open disposition dialog
          setDispositionForm({
            callId: activeCall.ucid,
            disposition: '',
            notes: ''
          });
          setDispositionDialogOpen(true);
          setActiveCall(null);
        }
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Call control error:', error);
      toast.error('Failed to execute action');
    }
  };

  const handleRecordingControl = async (action: 'pause' | 'unPause') => {
    if (!activeCall) return;

    try {
      const response = await fetch('/api/support/recording-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ucid: activeCall.ucid
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setActiveCall({
          ...activeCall,
          isRecordingPaused: action === 'pause'
        });
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Recording control error:', error);
      toast.error('Failed to control recording');
    }
  };

  const handleSaveDisposition = async () => {
    if (!dispositionForm.disposition) {
      toast.error('Please select a disposition');
      return;
    }

    setSavingDisposition(true);
    try {
      const response = await fetch('/api/support/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: dispositionForm.callId,
          disposition: dispositionForm.disposition,
          notes: dispositionForm.notes,
          customerId: customerData?.customer.id
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Disposition saved successfully');
        setDispositionDialogOpen(false);
        setDispositionForm({ callId: '', disposition: '', notes: '' });
      } else {
        toast.error(data.error || 'Failed to save disposition');
      }
    } catch (error) {
      console.error('Error saving disposition:', error);
      toast.error('Failed to save disposition');
    } finally {
      setSavingDisposition(false);
    }
  };

  const handleChangeAgentState = async (newState: 'Ready' | 'Pause') => {
    if (newState === 'Pause' && !pauseReason) {
      toast.error('Please select a pause reason');
      return;
    }

    if (!agentConfig) {
      toast.error('Agent configuration not loaded');
      return;
    }

    try {
      const response = await fetch('/api/support/agent-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentConfig.agentId,
          phoneName: agentConfig.phoneName,
          state: newState,
          ...(newState === 'Pause' && { pauseReason })
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Agent state changed to ${newState}`);
        setAgentState(newState);
        setAgentStateDialogOpen(false);
        setPauseReason('');
      } else {
        toast.error(data.error || 'Failed to change agent state');
      }
    } catch (error) {
      console.error('Error changing agent state:', error);
      toast.error('Failed to change agent state');
    }
  };

  const handleOpenMap = (addressType: 'shipping' | 'billing') => {
    if (!customerData?.customer) return;

    const customer = customerData.customer;
    let destinationAddress = '';

    if (addressType === 'shipping') {
      // Build shipping address
      if (customer.full_address && customer.full_address.trim() !== '' && customer.full_address !== 'Not Provided') {
        destinationAddress = customer.full_address;
      } else {
        const addressParts = [
          customer.shipping_room_number,
          customer.shipping_floor,
          customer.shipping_wing,
          customer.shipping_flat_number,
          customer.shipping_floor_wing,
          customer.shipping_building_name,
          customer.shipping_street_area,
          customer.shipping_landmark,
          customer.shipping_city,
          customer.shipping_state,
          customer.shipping_pincode,
          customer.shipping_country
        ].filter(part => part && part.trim() !== '' && part !== 'Not Provided');
        destinationAddress = addressParts.join(', ');
      }
    } else {
      // Build billing address
      const addressParts = [
        customer.billing_room_number,
        customer.billing_floor,
        customer.billing_wing,
        customer.billing_flat_number,
        customer.billing_floor_wing,
        customer.billing_building_name,
        customer.billing_street_area,
        customer.billing_landmark,
        customer.billing_city,
        customer.billing_state,
        customer.billing_pincode,
        customer.billing_country
      ].filter(part => part && part.trim() !== '' && part !== 'Not Provided');
      destinationAddress = addressParts.join(', ');
    }

    if (!destinationAddress) {
      setError(`No ${addressType} address available for this customer`);
      return;
    }

    // Get current location using browser geolocation
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const encodedDestination = encodeURIComponent(destinationAddress);
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodedDestination}&travelmode=driving`;
        window.open(mapsUrl, '_blank');
      },
      (error) => {
        console.error('Geolocation error:', error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError('Location permission denied. Please enable location access in your browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            setError('Location information unavailable. Please try again.');
            break;
          case error.TIMEOUT:
            setError('Location request timed out. Please try again.');
            break;
          default:
            setError('Unable to get your location. Please try again.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Page Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg" className="hidden sm:flex">
            <AvatarFallback className="bg-primary/10 text-primary">
              {userEmail ? userEmail.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
            </AvatarFallback>
            {userEmail && !authLoading && (
              <AvatarBadge className="bg-emerald-500" />
            )}
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Customer Support</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {authLoading ? (
                <span>Loading authentication…</span>
              ) : !userEmail ? (
                <span>Please log in to access the support dashboard</span>
              ) : loadingAgentConfig ? (
                <span>Loading agent configuration…</span>
              ) : (
                <>
                  <span className="truncate font-medium text-foreground">{userEmail}</span>
                  {agentConfig ? (
                    <>
                      <Badge variant="secondary" className="font-mono">
                        Agent {agentConfig.agentId}
                      </Badge>
                      <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Filtering on
                      </Badge>
                    </>
                  ) : (
                    <span>Viewing assigned calls</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              onClick={() => {
                checkLiveCalls();
                checkForIncomingCalls();
              }}
              disabled={checkingCalls}
              className="w-full sm:w-auto"
            >
              {checkingCalls ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  <PhoneIncoming className="mr-2 h-4 w-4" />
                  Check Incoming Calls
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh live and recent incoming calls</TooltipContent>
        </Tooltip>
      </header>

      {/* Agent API Warning - Shows when Ozonetel API auth is not configured */}
      {!agentApiWorking && agentApiWarning && !checkingAgentAvailability && (
        <Alert className="border-l-4 border-l-blue-500 bg-blue-500/5">
          <AlertCircle className="text-blue-600 dark:text-blue-400" />
          <AlertTitle>Agent Availability Check Disabled</AlertTitle>
          <AlertDescription>
            <p>{agentApiWarning}</p>
            <p className="mt-1 text-[11px]">
              Contact your Ozonetel administrator to enable &quot;API Authentication&quot; to enable agent availability filtering.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Live state row */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Latest Call */}
        {!hasLiveCall && latestCall && (
          <Alert className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
            <Phone className="text-emerald-600 dark:text-emerald-400" />
            <AlertTitle>Latest Call</AlertTitle>
            <AlertDescription>From: <span className="font-medium text-foreground">{latestCall}</span></AlertDescription>
          </Alert>
        )}

        {/* Live Call Ringing */}
        {agentsAvailable && hasLiveCall && liveCalls.length > 0 && (
          <Alert className="border-l-4 border-l-orange-500 bg-orange-500/5">
            <Phone className="animate-pulse text-orange-600 dark:text-orange-400" />
            <AlertTitle className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-orange-500" />
              </span>
              Live call ringing
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-1.5">
                {liveCalls.map((call, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-foreground">{call.phone_number || call.phoneNumber}</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      Agent {call.agent_id}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {call.call_state || 'ringing'}
                    </Badge>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Incoming Call Hidden */}
        {!agentsAvailable && hasLiveCall && liveCalls.length > 0 && (
          <Alert className="border-l-4 border-l-muted-foreground/40 bg-muted/40">
            <Phone className="text-muted-foreground" />
            <AlertTitle>Incoming Call Detected (Hidden)</AlertTitle>
            <AlertDescription>
              {liveCalls.length} call(s) ringing but hidden — set your status to <span className="font-medium text-foreground">READY</span> to see incoming calls.
            </AlertDescription>
          </Alert>
        )}

        {/* No Agents Available */}
        {agentApiWorking && !agentsAvailable && !checkingAgentAvailability && (
          <Alert className="border-l-4 border-l-amber-500 bg-amber-500/5">
            <AlertCircle className="text-amber-600 dark:text-amber-400" />
            <AlertTitle>No Agents Available</AlertTitle>
            <AlertDescription>
              No agents are currently in READY state. Incoming calls will not be displayed.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Active Call Controls */}
      {activeCall && (
        <Card className="border-blue-500 border-2 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone className="h-6 w-6 text-blue-600 animate-pulse" />
                <div>
                  <CardTitle className="text-lg text-blue-900">Active Call</CardTitle>
                  <CardDescription className="text-blue-700">
                    {activeCall.phoneNumber} • {formatCallDuration(callDuration)}
                    {activeCall.isOnHold && <Badge variant="secondary" className="ml-2">On Hold</Badge>}
                    {activeCall.isMuted && <Badge variant="secondary" className="ml-2">Muted</Badge>}
                    {activeCall.isRecordingPaused && <Badge variant="destructive" className="ml-2">Recording Paused</Badge>}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* Hold/Unhold */}
              <Button
                variant={activeCall.isOnHold ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCallControl(activeCall.isOnHold ? 'UNHOLD' : 'HOLD')}
                className="w-full"
              >
                <PhoneMissed className="mr-2 h-4 w-4" />
                {activeCall.isOnHold ? 'Unhold' : 'Hold'}
              </Button>

              {/* Mute/Unmute */}
              <Button
                variant={activeCall.isMuted ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCallControl(activeCall.isMuted ? 'UNMUTE' : 'MUTE')}
                className="w-full"
              >
                {activeCall.isMuted ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
                {activeCall.isMuted ? 'Unmute' : 'Mute'}
              </Button>

              {/* Conference */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const number = prompt('Enter number to conference:');
                  if (number) handleCallControl('CONFERENCE', number);
                }}
                className="w-full"
              >
                <Users className="mr-2 h-4 w-4" />
                Conference
              </Button>

              {/* Recording Pause/Resume */}
              <Button
                variant={activeCall.isRecordingPaused ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => handleRecordingControl(activeCall.isRecordingPaused ? 'unPause' : 'pause')}
                className="w-full"
              >
                {activeCall.isRecordingPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                {activeCall.isRecordingPaused ? 'Resume Rec' : 'Pause Rec'}
              </Button>

              {/* Transfer */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const number = prompt('Enter number to transfer:');
                  if (number) handleCallControl('CONFERENCE', number);
                }}
                className="w-full"
              >
                <PhoneForwarded className="mr-2 h-4 w-4" />
                Transfer
              </Button>

              {/* Hang Up */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleCallControl('KICK_CALL')}
                className="w-full"
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                Hang Up
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Calls Section - PRIORITY DISPLAY (only shown when agents are available) */}
      {agentsAvailable && hasLiveCall && liveCalls.length > 0 && (
        <Card className="border-orange-500 border-2 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-800 text-base sm:text-lg">
              <Phone className="h-5 w-5 sm:h-6 sm:w-6 animate-pulse" />
              🔔 LIVE INCOMING CALLS - RINGING NOW!
            </CardTitle>
            <CardDescription className="text-orange-700 text-sm">
              Click on a call to view customer details immediately
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(
                liveCalls.reduce((acc, call) => {
                  const phone = (call.phone_number || call.phoneNumber || '').replace(/^\+91/, '').replace(/^91/, '');
                  if (!phone) return acc;

                  // Keep the call with the most recent updated_at timestamp
                  const existingCall = acc.get(phone);
                  if (!existingCall || new Date(call.updated_at || 0) > new Date(existingCall.updated_at || 0)) {
                    acc.set(phone, call);
                  }
                  return acc;
                }, new Map<string, any>()).values()
              ).map((call: any, idx: number) => {
                const displayPhone = (call.phone_number || call.phoneNumber || '').replace(/^\+91/, '').replace(/^91/, '');
                return (
                  <button
                    key={displayPhone || idx}
                    onClick={() => {
                      setPhoneNumber(displayPhone);
                      handleSearch(displayPhone);
                    }}
                    className="w-full text-left p-3 sm:p-4 rounded-lg border-2 border-orange-400 bg-white hover:bg-orange-100 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base sm:text-lg font-bold text-orange-900 truncate">📞 {displayPhone}</p>
                        <p className="text-xs sm:text-sm text-orange-700">
                          Agent ID: {call.agent_name || call.agentName || 'Unknown'}
                        </p>
                        <p className="text-xs sm:text-sm text-orange-700">
                          State: <span className="font-semibold uppercase">{call.call_state || call.state || 'RINGING'}</span>
                        </p>
                        <p className="text-xs text-orange-600">
                          Started: {new Date(call.started_at || call.startTime || Date.now()).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex gap-2 self-start sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a href={formatPhoneForTel(displayPhone)} title="Call">
                            <PhoneCall className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Call</span>
                          </a>
                        </Button>
                        <Badge className="bg-orange-600 text-white text-sm sm:text-lg px-3 sm:px-4 py-1 sm:py-2 animate-pulse">
                          LIVE
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-4 w-4 text-muted-foreground" />
            Customer Lookup
          </CardTitle>
          <CardDescription>Search by phone, name, Sd number, or address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="search-dropdown-container relative">
            <div className="flex flex-col gap-2 sm:flex-row">
              <InputGroup className="h-10 flex-1">
                <InputGroupAddon>
                  <Search className="h-4 w-4" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Search by phone, name, Sd number, address..."
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      setShowSearchResults(false);
                      handleSearch();
                    }
                  }}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                  className="h-10 text-sm"
                />
                {isSearching && (
                  <InputGroupAddon align="inline-end">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </InputGroupAddon>
                )}
              </InputGroup>
              <Button
                onClick={() => {
                  setShowSearchResults(false);
                  handleSearch();
                }}
                disabled={loading}
                size="lg"
                className="w-full sm:w-auto"
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
                {searchResults.length === 0 && phoneNumber.length >= 2 && !isSearching ? (
                  <div className="space-y-3 p-6 text-center">
                    <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No customers found</p>
                      <p className="text-xs text-muted-foreground">Try a different search term or create a new customer</p>
                    </div>
                    <Button
                      onClick={() => {
                        setShowSearchResults(false);
                        handleOpenCustomerDialog();
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create New Customer
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto p-1">
                    {searchResults.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setPhoneNumber(customer.mobile_primary);
                          setShowSearchResults(false);
                          handleSearch(customer.mobile_primary);
                        }}
                        className="flex w-full items-start gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <Avatar size="sm" className="mt-0.5 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {(customer.first_name?.[0] || customer.mobile_primary?.[0] || '?').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="truncate text-sm font-semibold">
                              {customer.first_name} {customer.last_name}
                            </span>
                            {customer.is_vip && (
                              <Badge variant="secondary" className="text-[10px]">Sd</Badge>
                            )}
                            {customer.vip_number && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{customer.vip_number}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">{customer.mobile_primary}</span>
                            {customer.mobile_secondary_1 && (
                              <>
                                <span>·</span>
                                <span>{customer.mobile_secondary_1}</span>
                              </>
                            )}
                            {customer.mobile_secondary_2 && (
                              <>
                                <span>·</span>
                                <span>{customer.mobile_secondary_2}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {customer.is_mandir && (
                            <Badge variant="outline" className="text-[10px]">Mandir</Badge>
                          )}
                          {customer.is_defaulter && (
                            <Badge variant="destructive" className="text-[10px]">Defaulter</Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error}</span>
            {error.toLowerCase().includes('not found') && phoneNumber && (
              <Button
                onClick={handleOpenCustomerDialog}
                variant="outline"
                size="sm"
                className="w-fit"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create New Customer
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {customerData && (
        <div className="space-y-3">
          {/* Customer Details Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  <CardTitle className="text-lg sm:text-xl">Customer Details</CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isEditingCustomer ? (
                    <>
                      <Button
                        onClick={handleEditCustomer}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => window.open(`/dashboard/orders/new?phone=${customerData.customer.mobile_primary}`, '_blank')}
                        size="sm"
                        className="gap-2"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Create Order
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={handleCancelEdit}
                        size="sm"
                        variant="outline"
                        disabled={savingCustomerEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveCustomerEdit}
                        size="sm"
                        disabled={savingCustomerEdit}
                      >
                        {savingCustomerEdit ? 'Saving...' : 'Save'}
                      </Button>
                    </>
                  )}
                  {customerData.customer.is_vip && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">Sd</Badge>
                  )}
                  {customerData.customer.is_defaulter && (
                    <Badge className="bg-red-100 text-red-800 text-xs">Defaulter</Badge>
                  )}
                  {customerData.customer.is_mandir && (
                    <Badge className="bg-blue-100 text-blue-800 text-xs">Mandir</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Address Section - Prominent Display */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                {customerData.customer.full_address && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        Shipping Address
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!customerData?.customer.full_address) return;

                          // Get current location using browser geolocation
                          if (!navigator.geolocation) {
                            setError('Geolocation is not supported by your browser');
                            return;
                          }

                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              const { latitude, longitude } = position.coords;
                              const encodedDestination = encodeURIComponent(customerData.customer.full_address || '');
                              const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodedDestination}&travelmode=driving`;
                              window.open(mapsUrl, '_blank');
                            },
                            (error) => {
                              console.error('Geolocation error:', error);
                              switch (error.code) {
                                case error.PERMISSION_DENIED:
                                  setError('Location permission denied. Please enable location access in your browser settings.');
                                  break;
                                case error.POSITION_UNAVAILABLE:
                                  setError('Location information unavailable. Please try again.');
                                  break;
                                case error.TIMEOUT:
                                  setError('Location request timed out. Please try again.');
                                  break;
                                default:
                                  setError('Unable to get your location. Please try again.');
                                  break;
                              }
                            },
                            {
                              enableHighAccuracy: true,
                              timeout: 10000,
                              maximumAge: 0
                            }
                          );
                        }}
                        className="h-8 gap-1"
                      >
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Open Map</span>
                      </Button>
                    </div>
                    <p className="text-base leading-relaxed text-foreground font-medium">
                      {customerData.customer.full_address}
                    </p>
                  </div>
                )}

                {!customerData.customer.billing_same_as_shipping && customerData.customer.billing_building_name && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-orange-600" />
                        Billing Address
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenMap('billing')}
                        className="h-8 gap-1"
                      >
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Open Map</span>
                      </Button>
                    </div>
                    <p className="text-base leading-relaxed text-foreground">
                      {customerData.customer.billing_room_number && `Room ${customerData.customer.billing_room_number}, `}
                      {customerData.customer.billing_floor && `Floor ${customerData.customer.billing_floor}, `}
                      {customerData.customer.billing_wing && `Wing ${customerData.customer.billing_wing}, `}
                      {customerData.customer.billing_flat_number && `${customerData.customer.billing_flat_number}, `}
                      {customerData.customer.billing_floor_wing && `${customerData.customer.billing_floor_wing}, `}
                      {customerData.customer.billing_building_name}, {customerData.customer.billing_street_area}
                      {customerData.customer.billing_landmark && (
                        <>
                          <br />
                          Landmark: {customerData.customer.billing_landmark}
                        </>
                      )}
                      <br />
                      {customerData.customer.billing_city}, {customerData.customer.billing_state} - {customerData.customer.billing_pincode}
                      {customerData.customer.billing_country && `, ${customerData.customer.billing_country}`}
                    </p>
                  </div>
                )}
              </div>

              {/* Customer Details Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">First Name</p>
                  {isEditingCustomer ? (
                    <Input
                      value={editCustomerData.first_name || ''}
                      onChange={(e) => setEditCustomerData({ ...editCustomerData, first_name: e.target.value })}
                      className="text-base sm:text-lg"
                    />
                  ) : (
                    <p className="text-base sm:text-lg font-semibold">{customerData.customer.first_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Last Name</p>
                  {isEditingCustomer ? (
                    <Input
                      value={editCustomerData.last_name || ''}
                      onChange={(e) => setEditCustomerData({ ...editCustomerData, last_name: e.target.value })}
                      className="text-base sm:text-lg"
                    />
                  ) : (
                    <p className="text-base sm:text-lg font-semibold">{customerData.customer.last_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Company</p>
                  {isEditingCustomer ? (
                    <Input
                      value={editCustomerData.company_name || ''}
                      onChange={(e) => setEditCustomerData({ ...editCustomerData, company_name: e.target.value })}
                      className="text-base sm:text-lg"
                      placeholder="N/A"
                    />
                  ) : (
                    <p className="text-base sm:text-lg truncate">{customerData.customer.company_name || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Email</p>
                  {isEditingCustomer ? (
                    <Input
                      type="email"
                      value={editCustomerData.email || ''}
                      onChange={(e) => setEditCustomerData({ ...editCustomerData, email: e.target.value })}
                      className="text-base sm:text-lg"
                      placeholder="N/A"
                    />
                  ) : (
                    <p className="text-base sm:text-lg break-all">{customerData.customer.email || 'N/A'}</p>
                  )}
                </div>
                {customerData.customer.vip_number && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Sd Number</p>
                    <Badge variant="outline" className="font-mono text-base sm:text-lg mt-1">
                      {customerData.customer.vip_number}
                    </Badge>
                  </div>
                )}
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Primary Phone</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base sm:text-lg">{customerData.customer.mobile_primary}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 sm:h-8"
                      onClick={() => handleClickToDial(customerData.customer.mobile_primary)}
                      title="Click to dial"
                    >
                      <PhoneCall className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>
                {(customerData.customer.mobile_secondary_1 || isEditingCustomer) && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Secondary Phone 1</p>
                    {isEditingCustomer ? (
                      <Input
                        value={editCustomerData.mobile_secondary_1 || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setEditCustomerData({ ...editCustomerData, mobile_secondary_1: value });
                        }}
                        className="text-base sm:text-lg"
                        placeholder="10 digit number"
                        maxLength={10}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-base sm:text-lg">{customerData.customer.mobile_secondary_1}</p>
                        {customerData.customer.mobile_secondary_1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 sm:h-8"
                            asChild
                          >
                            <a href={formatPhoneForTel(customerData.customer.mobile_secondary_1)} title="Call">
                              <PhoneCall className="h-3 w-3 sm:h-4 sm:w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {(customerData.customer.mobile_secondary_2 || isEditingCustomer) && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Secondary Phone 2</p>
                    {isEditingCustomer ? (
                      <Input
                        value={editCustomerData.mobile_secondary_2 || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setEditCustomerData({ ...editCustomerData, mobile_secondary_2: value });
                        }}
                        className="text-base sm:text-lg"
                        placeholder="10 digit number"
                        maxLength={10}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-base sm:text-lg">{customerData.customer.mobile_secondary_2}</p>
                        {customerData.customer.mobile_secondary_2 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 sm:h-8"
                            asChild
                          >
                            <a href={formatPhoneForTel(customerData.customer.mobile_secondary_2)} title="Call">
                              <PhoneCall className="h-3 w-3 sm:h-4 sm:w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">WhatsApp</p>
                  {isEditingCustomer ? (
                    <Input
                      value={editCustomerData.whatsapp_number || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setEditCustomerData({ ...editCustomerData, whatsapp_number: value });
                      }}
                      className="text-base sm:text-lg"
                      placeholder="10 digit number"
                      maxLength={10}
                    />
                  ) : customerData.customer.whatsapp_number ? (
                    <div className="flex items-center gap-2">
                      <p className="text-base sm:text-lg">{customerData.customer.whatsapp_number}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 sm:h-8"
                        asChild
                      >
                        <a
                          href={formatPhoneForWhatsApp(customerData.customer.whatsapp_number)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp"
                        >
                          <WhatsAppIcon className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base sm:text-lg">N/A</p>
                  )}
                </div>
                {customerData.customer.gst_number && (
                  <div className="sm:col-span-2">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">GST Number</p>
                    <p className="text-base sm:text-lg font-mono">{customerData.customer.gst_number}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Stats Section */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Orders</span>
              </div>
              <div className="text-lg sm:text-xl font-bold">{customerData.stats.totalOrders}</div>
            </div>
            <button
              onClick={handleDownloadLedger}
              className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-accent hover:border-primary transition-colors cursor-pointer w-full text-left"
              title="Click to download customer ledger"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Spent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-base sm:text-lg font-bold truncate">
                  {formatCurrency(customerData.stats.totalSpent)}
                </div>
                <Download className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </div>
            </button>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Active Tickets</span>
              </div>
              <div className="text-lg sm:text-xl font-bold">{customerData.stats.activeTickets}</div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Customer Since</span>
              </div>
              <div className="text-xs sm:text-sm font-bold">
                {formatDate(customerData.customer.created_at)}
              </div>
            </div>
          </div>

          {/* Orders and Tickets Tabs */}
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="orders" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">Orders </span>
                <span className="sm:hidden">Orders</span>
                <span className="ml-1">({customerData.orders.length})</span>
              </TabsTrigger>
              <TabsTrigger value="tickets" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">Support Tickets </span>
                <span className="sm:hidden">Tickets</span>
                <span className="ml-1">({customerData.tickets.length})</span>
              </TabsTrigger>
              <TabsTrigger value="calls" className="text-xs sm:text-sm py-2">
                <span className="hidden sm:inline">Call History </span>
                <span className="sm:hidden">Calls</span>
                <span className="ml-1">({callHistory.length})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-2 mt-3">
              {customerData.orders.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground">No orders found</p>
                  </CardContent>
                </Card>
              ) : (
                customerData.orders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg truncate">{order.order_number}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            {order.is_gst_invoice
                              ? (order.invoice_number_gst || order.order_number)
                              : (order.invoice_number_non_gst || order.order_number)
                            } • {formatDate(order.order_date)}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={`${getStatusColor(order.order_status)} text-xs`}>
                            {order.order_status}
                          </Badge>
                          <Badge className={`${getStatusColor(order.payment_status)} text-xs`}>
                            {order.payment_status}
                          </Badge>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2"
                              onClick={() => handleDownloadInvoice(order)}
                              title="Download Invoice"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2"
                              onClick={() => handleShareViaWhatsApp(order)}
                              title="Share via WhatsApp"
                            >
                              <WhatsAppIcon className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2"
                              onClick={() => {
                                router.push(`/dashboard/orders/new?reorder=${order.id}&phone=${customerData.customer.mobile_primary}`)
                              }}
                              title="Reorder"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="text-xs sm:text-sm text-muted-foreground">Total Amount:</span>
                          <span className="text-sm sm:text-base font-semibold">{formatCurrency(order.total_amount)}</span>
                        </div>

                        {/* Delivery Status */}
                        {order.delivery_status && (
                          <div className="flex justify-between items-start">
                            <span className="text-xs sm:text-sm text-muted-foreground">Delivery Status:</span>
                            <Badge className={`${getStatusColor(order.delivery_status)} text-xs`}>
                              {order.delivery_status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        )}

                        {/* Delivery Partner */}
                        {order.delivery_partner_name && (
                          <div className="flex justify-between items-start">
                            <span className="text-xs sm:text-sm text-muted-foreground">Delivery Partner:</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs sm:text-sm font-medium text-right">{order.delivery_partner_name}</span>
                              {order.delivery_partner_mobile && (
                                <a
                                  href={formatPhoneForTel(order.delivery_partner_mobile)}
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {order.delivery_partner_mobile}
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Distributor */}
                        {order.serviceable_distributor_name && (
                          <div className="flex justify-between items-start">
                            <span className="text-xs sm:text-sm text-muted-foreground">Distributor:</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs sm:text-sm font-medium text-right">{order.serviceable_distributor_name}</span>
                              {order.serviceable_distributor_phone && (
                                <a
                                  href={formatPhoneForTel(order.serviceable_distributor_phone)}
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {order.serviceable_distributor_phone}
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Separator before Warehouse */}
                        {order.godown_name && <Separator className="my-2" />}

                        {/* Warehouse/Godown Manager */}
                        {order.godown_name && (
                          <div className="flex justify-between items-start">
                            <span className="text-xs sm:text-sm text-muted-foreground">Warehouse:</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs sm:text-sm font-medium text-right">{order.godown_name}</span>
                              {order.godown_manager_name && (
                                <div className="flex flex-col items-end">
                                  <span className="text-xs text-muted-foreground">Manager: {order.godown_manager_name}</span>
                                  {order.godown_manager_phone && (
                                    <a
                                      href={formatPhoneForTel(order.godown_manager_phone)}
                                      className="text-xs text-blue-600 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {order.godown_manager_phone}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {order.items.length > 0 && (
                          <>
                            <Separator className="my-2" />
                            <p className="text-xs sm:text-sm font-medium">Items:</p>
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-start text-xs sm:text-sm gap-2">
                                <span className="flex-1 min-w-0">{item.product_name} x {item.quantity}</span>
                                <span className="font-medium whitespace-nowrap">{formatCurrency(item.total)}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="tickets" className="space-y-2 mt-3">
              {customerData.tickets.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground">No support tickets found</p>
                  </CardContent>
                </Card>
              ) : (
                customerData.tickets.map((ticket) => (
                  <Card key={ticket.id}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg">{ticket.ticket_number}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm">{ticket.subject}</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={`${getPriorityColor(ticket.priority)} text-xs`}>
                            {ticket.priority}
                          </Badge>
                          <Badge className={`${getStatusColor(ticket.status)} text-xs`}>
                            {ticket.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="text-xs sm:text-sm text-muted-foreground">Category:</span>
                          <span className="text-xs sm:text-sm font-medium text-right">{ticket.category}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs sm:text-sm text-muted-foreground">Created:</span>
                          <span className="text-xs sm:text-sm text-right">{formatDate(ticket.created_at)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="calls" className="space-y-2 mt-3">
              {callHistory.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground">No call history found</p>
                  </CardContent>
                </Card>
              ) : (
                callHistory.map((call) => (
                  <Card key={call.id}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg flex flex-wrap items-center gap-2">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">{call.caller_id}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 sm:h-7 flex-shrink-0"
                              asChild
                            >
                              <a href={formatPhoneForTel(call.caller_id)} title="Call">
                                <PhoneCall className="h-3 w-3" />
                              </a>
                            </Button>
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm mt-1">
                            {formatDate(call.start_time)} • Duration: {call.call_duration || 'N/A'}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={`${getStatusColor(call.status.toLowerCase())} text-xs`}>
                            {call.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {call.type}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs sm:text-sm text-muted-foreground">Call ID:</span>
                          <span className="text-xs sm:text-sm font-mono text-right break-all">{call.monitor_ucid}</span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs sm:text-sm text-muted-foreground">Agent:</span>
                          <span className="text-xs sm:text-sm font-medium text-right">{call.agent_name}</span>
                        </div>
                        {call.disposition && (
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs sm:text-sm text-muted-foreground">Disposition:</span>
                            <span className="text-xs sm:text-sm text-right">{call.disposition}</span>
                          </div>
                        )}
                        {call.audio_file_url && (
                          <div className="pt-2">
                            <audio controls className="w-full h-8 sm:h-10">
                              <source src={call.audio_file_url} type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Recent Calls Carousel - Bottom of Page */}
      <Card className="min-w-0 max-w-full">
        <CardHeader className="flex flex-row items-end justify-between gap-2 pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Recent Calls
            </CardTitle>
            <CardDescription>Last 10 incoming calls</CardDescription>
          </div>
          {recentCalls.length > 0 && (
            <Badge variant="outline" className="font-mono">
              {recentCalls.length}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          {recentCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No recent calls</p>
            </div>
          ) : (
            <div className="w-0 min-w-full max-w-full overflow-hidden">
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3">
                {recentCalls.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => {
                      setPhoneNumber(call.caller_id.replace(/^\+91/, '').replace(/^91/, ''));
                      handleSearch(call.caller_id);
                    }}
                    className="group/call flex w-56 shrink-0 snap-start flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{call.caller_id}</p>
                        <p className="truncate text-xs text-muted-foreground">{call.agent_name}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 p-0"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a href={formatPhoneForTel(call.caller_id)} title="Call">
                          <PhoneCall className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className={`${getStatusColor(call.status.toLowerCase())} px-1.5 py-0 text-[10px]`}>
                        {call.status}
                      </Badge>
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {call.type}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {new Date(call.start_time).toLocaleString('en-IN', {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {call.call_duration && (
                        <span className="font-mono">{call.call_duration}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                ← Scroll to see more calls →
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Disposition Dialog */}
      <Dialog open={dispositionDialogOpen} onOpenChange={setDispositionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Disposition
            </DialogTitle>
            <DialogDescription>
              Add notes and disposition for this call
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-2">
              <Label htmlFor="disposition">Disposition *</Label>
              <Select
                value={dispositionForm.disposition}
                onValueChange={(value) => setDispositionForm({ ...dispositionForm, disposition: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select disposition" />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSITION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={dispositionForm.notes}
                onChange={(e) => setDispositionForm({ ...dispositionForm, notes: e.target.value })}
                placeholder="Enter call notes..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispositionDialogOpen(false)}>
              Skip
            </Button>
            <Button onClick={handleSaveDisposition} disabled={savingDisposition}>
              {savingDisposition ? 'Saving...' : 'Save Disposition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent State Dialog */}
      <Dialog open={agentStateDialogOpen} onOpenChange={setAgentStateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Agent State</DialogTitle>
            <DialogDescription>
              Update your current state
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={agentState === 'Ready' ? 'default' : 'outline'}
                onClick={() => handleChangeAgentState('Ready')}
                className="h-20"
              >
                <div className="flex flex-col items-center gap-2">
                  <User className="h-5 w-5" />
                  <span>Ready</span>
                </div>
              </Button>
              <Button
                variant={agentState === 'Pause' ? 'default' : 'outline'}
                onClick={() => {
                  if (!pauseReason) {
                    toast.error('Please select a pause reason first');
                    return;
                  }
                  handleChangeAgentState('Pause');
                }}
                className="h-20"
              >
                <div className="flex flex-col items-center gap-2">
                  <Pause className="h-5 w-5" />
                  <span>Pause</span>
                </div>
              </Button>
            </div>

            {/* Pause Reason Selection */}
            <div className="space-y-2">
              <Label htmlFor="pauseReason">Pause Reason (required for Pause)</Label>
              <Select value={pauseReason} onValueChange={setPauseReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pause reason" />
                </SelectTrigger>
                <SelectContent>
                  {PAUSE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentStateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter customer details to create a new customer profile
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <p className="text-sm text-muted-foreground">Personal details of the customer</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@domain.com"
                />
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <p className="text-sm text-muted-foreground">Phone numbers and contact details</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile_primary">Mobile Primary *</Label>
                <Input
                  id="mobile_primary"
                  value={formData.mobile_primary}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, mobile_primary: value });
                  }}
                  required
                  maxLength={10}
                  placeholder="10 digit mobile number"
                />
                {formData.mobile_primary && formData.mobile_primary.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {formData.mobile_primary.length}/10 digits
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                  <Input
                    id="whatsapp_number"
                    value={formData.whatsapp_same_as_primary ? formData.mobile_primary : formData.whatsapp_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, whatsapp_number: value, whatsapp_same_as_primary: false });
                    }}
                    disabled={formData.whatsapp_same_as_primary}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <label className="flex items-center gap-2 h-10">
                    <input
                      type="checkbox"
                      checked={formData.whatsapp_same_as_primary}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({
                          ...formData,
                          whatsapp_same_as_primary: checked,
                          whatsapp_number: checked ? formData.mobile_primary : formData.whatsapp_number
                        });
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Same as Primary</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_1">Mobile Secondary 1</Label>
                  <Input
                    id="mobile_secondary_1"
                    value={formData.mobile_secondary_1}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, mobile_secondary_1: value });
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_2">Mobile Secondary 2</Label>
                  <Input
                    id="mobile_secondary_2"
                    value={formData.mobile_secondary_2}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, mobile_secondary_2: value });
                    }}
                    maxLength={10}
                    placeholder="10 digit number"
                  />
                </div>
              </div>
            </div>

            {/* Business Information Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Business Information</h3>
                <p className="text-sm text-muted-foreground">Company, GST, and PAN details (optional)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input
                    id="gst_number"
                    value={formData.gst_number}
                    onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                    maxLength={15}
                    placeholder="15 characters"
                  />
                  {formData.gst_number && formData.gst_number.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {formData.gst_number.length}/15 characters
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_card_number">PAN Card Number</Label>
                  <Input
                    id="pan_card_number"
                    value={formData.pan_card_number}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      setFormData({ ...formData, pan_card_number: value });
                    }}
                    maxLength={10}
                    placeholder="ABCDE1234F"
                  />
                  {formData.pan_card_number && formData.pan_card_number.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {formData.pan_card_number.length}/10 characters
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Shipping Address Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Shipping Address *</h3>
                <p className="text-sm text-muted-foreground">Complete address will be automatically formatted from the fields below</p>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="Room/Flat No."
                    value={formData.shipping_room_number}
                    onChange={(e) => setFormData({ ...formData, shipping_room_number: e.target.value })}
                  />
                  <Input
                    placeholder="Floor"
                    value={formData.shipping_floor}
                    onChange={(e) => setFormData({ ...formData, shipping_floor: e.target.value })}
                  />
                  <Input
                    placeholder="Wing/Block"
                    value={formData.shipping_wing}
                    onChange={(e) => setFormData({ ...formData, shipping_wing: e.target.value })}
                  />
                </div>
                <Input
                  placeholder="Building Name *"
                  value={formData.shipping_building_name}
                  onChange={(e) => setFormData({ ...formData, shipping_building_name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Street/Area *"
                  value={formData.shipping_street_area}
                  onChange={(e) => setFormData({ ...formData, shipping_street_area: e.target.value })}
                  required
                />
                <Input
                  placeholder="Landmark"
                  value={formData.shipping_landmark}
                  onChange={(e) => setFormData({ ...formData, shipping_landmark: e.target.value })}
                />
                <div className="grid grid-cols-4 gap-3">
                  <Input
                    placeholder="City *"
                    value={formData.shipping_city}
                    onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                    required
                  />
                  <Select
                    value={formData.shipping_state}
                    onValueChange={(value) => setFormData({ ...formData, shipping_state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="State *" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Pincode *"
                    value={formData.shipping_pincode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, shipping_pincode: value });
                    }}
                    required
                    maxLength={6}
                  />
                  <Input
                    placeholder="Country"
                    value={formData.shipping_country}
                    onChange={(e) => setFormData({ ...formData, shipping_country: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Billing Address Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Billing Address</h3>
                <p className="text-sm text-muted-foreground">Invoice and billing address</p>
              </div>
              <div className="mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.billing_same_as_shipping}
                    onChange={(e) => setFormData({ ...formData, billing_same_as_shipping: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Same as Shipping Address</span>
                </label>
              </div>
              {!formData.billing_same_as_shipping && (
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      placeholder="Room/Flat No."
                      value={formData.billing_room_number}
                      onChange={(e) => setFormData({ ...formData, billing_room_number: e.target.value })}
                    />
                    <Input
                      placeholder="Floor"
                      value={formData.billing_floor}
                      onChange={(e) => setFormData({ ...formData, billing_floor: e.target.value })}
                    />
                    <Input
                      placeholder="Wing/Block"
                      value={formData.billing_wing}
                      onChange={(e) => setFormData({ ...formData, billing_wing: e.target.value })}
                    />
                  </div>
                  <Input
                    placeholder="Building Name"
                    value={formData.billing_building_name}
                    onChange={(e) => setFormData({ ...formData, billing_building_name: e.target.value })}
                  />
                  <Input
                    placeholder="Street/Area"
                    value={formData.billing_street_area}
                    onChange={(e) => setFormData({ ...formData, billing_street_area: e.target.value })}
                  />
                  <Input
                    placeholder="Landmark"
                    value={formData.billing_landmark}
                    onChange={(e) => setFormData({ ...formData, billing_landmark: e.target.value })}
                  />
                  <div className="grid grid-cols-4 gap-3">
                    <Input
                      placeholder="City"
                      value={formData.billing_city}
                      onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    />
                    <Select
                      value={formData.billing_state}
                      onValueChange={(value) => setFormData({ ...formData, billing_state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Pincode"
                      value={formData.billing_pincode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setFormData({ ...formData, billing_pincode: value });
                      }}
                      maxLength={6}
                    />
                    <Input
                      placeholder="Country"
                      value={formData.billing_country}
                      onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Customer Classification Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Customer Classification</h3>
                <p className="text-sm text-muted-foreground">Customer type and status tags</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_vip}
                      onChange={(e) => handleVipToggle(e.target.checked)}
                      disabled={generatingVipNumber}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Sd Customer</span>
                    {generatingVipNumber && (
                      <span className="text-xs text-muted-foreground">(Generating Sd number...)</span>
                    )}
                  </label>
                  {formData.is_vip && (
                    <div className="flex-1 max-w-xs">
                      <Input
                        placeholder="Sd Number (auto-generated)"
                        value={formData.vip_number}
                        onChange={(e) => setFormData({ ...formData, vip_number: e.target.value })}
                        className="h-9"
                        title="Sd number is auto-generated. You can edit it if needed."
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_mandir}
                    onChange={(e) => setFormData({ ...formData, is_mandir: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Mandir/Temple</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_defaulter}
                    onChange={(e) => setFormData({ ...formData, is_defaulter: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Defaulter</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomer} disabled={savingCustomer}>
              {savingCustomer ? 'Saving...' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
