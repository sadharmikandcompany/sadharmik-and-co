'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  RefreshCw,
  Play,
  MessageCircle,
  Send,
  Clock,
  User,
  ShoppingCart,
  AlertCircle,
  DollarSign,
  MapPin,
  Package,
  UserPlus,
  Download,
  Edit3,
  Tag,
  Image as ImageIcon,
  ChevronDown,
  Plus,
  Copy,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { CustomerInfo, OrderInfo, SupportTicketInfo } from '@/lib/types/ozonetel';
import { generateOrderInvoice, generateCustomerLedger } from '@/lib/invoice-generator';

interface CallLog {
  id: string;
  call_id: string;
  caller_number: string;
  called_number: string;
  direction: 'inbound' | 'outbound';
  status: string;
  duration: number;
  start_time: string;
  end_time: string;
  agent_name: string;
  agent_id: string;
  recording_url: string | null;
  disposition: string | null;
  customer_id: string | null;
}

interface LiveCall {
  call_id: string;
  phone_number: string;
  direction: string;
  call_state: string;
  agent_id: string;
  agent_name: string;
  department: string;
  timestamp: string;
}

interface CustomerLookupResponse {
  customer: CustomerInfo;
  orders: OrderInfo[];
  tickets: SupportTicketInfo[];
  stats: {
    totalOrders: number;
    totalSpent: number;
    activeTickets: number;
    outstandingBalance: number;
    websiteOrderCount?: number;
    isPremium?: boolean;
  };
}

interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
}

// Indian States for customer creation
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

// Rate list types
type RateListCategory = {
  id: string;
  category_name: string;
};

type RateListProduct = {
  id: string;
  name: string;
  brand: string | null;
  customer_price: number;
  customer_sale_price: number | null;
  customer_discount_percent: number | null;
  images: string[] | null;
  short_description: string | null;
  parent_category_id: string | null;
  sub_category_id: string | null;
  parent_category?: RateListCategory;
  sub_category?: RateListCategory;
};

type PincodePricing = {
  product_id: string;
  customer_price: number | null;
  customer_sale_price: number | null;
};

function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

function formatRateCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function getEffectivePrice(
  product: RateListProduct,
  pricingMap: Map<string, PincodePricing>
) {
  const override = pricingMap.get(product.id);
  const customerPrice = override?.customer_price ?? product.customer_price;
  const customerSalePrice =
    override?.customer_sale_price ?? product.customer_sale_price;
  return { customerPrice, customerSalePrice };
}

// MyOperator agent config type
interface MyOperatorAgentConfig {
  name: string;
  role: string;
  extension: string;
  phone: string;
  email: string;
  userId: string | null;
  showAllAgents: boolean;
}

export default function MyOperatorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('support');

  // Auth & agent config state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [agentConfig, setAgentConfig] = useState<MyOperatorAgentConfig | null>(null);
  const [loadingAgentConfig, setLoadingAgentConfig] = useState(false);

  // Call detection state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [latestCall, setLatestCall] = useState<string | null>(null);
  const [hasLiveCall, setHasLiveCall] = useState(false);
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [customerCallHistory, setCustomerCallHistory] = useState<CallLog[]>([]);

  // Customer state
  const [customerData, setCustomerData] = useState<CustomerLookupResponse | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerTab, setCustomerTab] = useState('orders');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showAllOrders, setShowAllOrders] = useState(false);

  // Customer creation dialog
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    first_name: '',
    last_name: '',
    mobile_primary: '',
    whatsapp_number: '',
    email: '',
    company_name: '',
    shipping_building_name: '',
    shipping_street_area: '',
    shipping_city: '',
    shipping_state: '',
    shipping_pincode: '',
    shipping_country: 'India',
  });

  // Edit customer state
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerData, setEditCustomerData] = useState<Partial<CustomerInfo>>({});
  const [savingCustomerEdit, setSavingCustomerEdit] = useState(false);

  // Click-to-call state
  const [clickToCallNumber, setClickToCallNumber] = useState('');
  const [clickToCallUserId, setClickToCallUserId] = useState('');
  const [clickToCallNumber2, setClickToCallNumber2] = useState('');
  const [clickToCallType, setClickToCallType] = useState<'1' | '2'>('1');
  const [calling, setCalling] = useState(false);

  // WhatsApp state
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);


  // Rate list state
  const [rateListProducts, setRateListProducts] = useState<RateListProduct[]>([]);
  const [rateListPricingMap, setRateListPricingMap] = useState<Map<string, PincodePricing>>(new Map());
  const [rateListCategories, setRateListCategories] = useState<RateListCategory[]>([]);
  const [rateListLoading, setRateListLoading] = useState(false);
  const [rateListPincode, setRateListPincode] = useState<string>('');
  const [rateListSearch, setRateListSearch] = useState('');
  const [rateListCategory, setRateListCategory] = useState<string>('all');

  // Fetch rate list data for a pincode
  const fetchRateListData = useCallback(async (pincode: string) => {
    if (!pincode || pincode.length !== 6) return;

    setRateListLoading(true);
    setRateListPincode(pincode);
    try {
      const [productsResult, pricingResult, categoriesResult] = await Promise.all([
        supabase
          .from('products')
          .select(`
            id, name, brand, customer_price, customer_sale_price,
            customer_discount_percent, images, short_description,
            parent_category_id, sub_category_id,
            parent_category:parent_category_id(id, category_name),
            sub_category:sub_category_id(id, category_name)
          `)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('product_pincode_pricing')
          .select('product_id, customer_price, customer_sale_price')
          .eq('pincode', pincode),
        supabase
          .from('categories')
          .select('id, category_name')
          .order('category_name', { ascending: true }),
      ]);

      if (productsResult.error) {
        console.error('Error fetching rate list products:', productsResult.error);
        toast.error('Failed to fetch rate list');
        setRateListLoading(false);
        return;
      }

      const normalizedProducts = (productsResult.data || []).map(
        (p: Record<string, unknown>) => ({
          ...p,
          parent_category: Array.isArray(p.parent_category)
            ? p.parent_category[0] ?? undefined
            : p.parent_category ?? undefined,
          sub_category: Array.isArray(p.sub_category)
            ? p.sub_category[0] ?? undefined
            : p.sub_category ?? undefined,
        })
      ) as RateListProduct[];

      setRateListProducts(normalizedProducts);
      setRateListCategories(categoriesResult.data || []);

      const pricingMap = new Map<string, PincodePricing>();
      if (pricingResult.data) {
        for (const entry of pricingResult.data) {
          pricingMap.set(entry.product_id, entry);
        }
      }
      setRateListPricingMap(pricingMap);
    } catch (err) {
      console.error('Error fetching rate list:', err);
      toast.error('Failed to load rate list');
    } finally {
      setRateListLoading(false);
    }
  }, []);

  // Ghee (the best-selling lines) comes first, oils last — factory request:
  // the rate list should surface what sells most, grouped category-wise.
  const rateListCategoryRank = (categoryName?: string) => {
    const c = (categoryName || '').toLowerCase();
    if (c.includes('cow') && c.includes('ghee') && !c.includes('bilona')) return 0;
    if (c.includes('bilona')) return 1;
    if (c.includes('buffalo')) return 2;
    if (c.includes('ghee')) return 3;
    if (c.includes('oil')) return 5;
    return 4;
  };

  // Filtered rate list products, grouped category-wise
  const filteredRateListProducts = useMemo(() => {
    const filtered = rateListProducts.filter((product) => {
      if (product.name.toLowerCase().includes('mandir')) return false;
      const matchesSearch =
        product.name.toLowerCase().includes(rateListSearch.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(rateListSearch.toLowerCase()));
      const matchesCategory =
        rateListCategory === 'all' || product.parent_category_id === rateListCategory;
      return matchesSearch && matchesCategory;
    });
    return [...filtered].sort((a, b) => {
      const rankA = rateListCategoryRank(a.parent_category?.category_name);
      const rankB = rateListCategoryRank(b.parent_category?.category_name);
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }, [rateListProducts, rateListSearch, rateListCategory]);

  // Search for customer by phone
  const handleCustomerSearch = useCallback(async (rawPhone: string) => {
    // Tolerate spaces/dashes in typed or pasted numbers (e.g. "99676 93914")
    const phone = (rawPhone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) return;

    setCustomerLoading(true);
    setCustomerError(null);

    try {
      const response = await fetch(`/api/support/customer-lookup?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();

      if (response.ok && data.customer) {
        setCustomerData(data);
        setShowAllOrders(false); // Reset pagination
        setExpandedOrderId(null); // Reset expanded order
        console.log('[MyOperator] Customer found:', data.customer.first_name, data.customer.last_name);

        // Load call history for this customer
        if (data.customer.id) {
          const { data: callData } = await supabase
            .from('myoperator_call_logs')
            .select('*')
            .eq('customer_id', data.customer.id)
            .order('created_at', { ascending: false })
            .limit(10);

          if (callData) {
            setCustomerCallHistory(callData);
          }
        }
      } else {
        setCustomerData(null);
        setCustomerError('Customer not found');
      }
    } catch (error) {
      console.error('[MyOperator] Customer lookup error:', error);
      setCustomerError('Failed to lookup customer');
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  // Check for latest incoming call (filtered by agent if config available, skip for admins)
  const checkForIncomingCalls = useCallback(async () => {
    try {
      const url = agentConfig?.userId && !agentConfig?.showAllAgents
        ? `/api/myoperator/latest-call?agentId=${encodeURIComponent(agentConfig.userId)}`
        : '/api/myoperator/latest-call';
      const response = await fetch(url);
      const data = await response.json();

      if (data.phoneNumber) {
        const normalizedPhone = data.phoneNumber.replace(/^\+?91/, '');
        const ageInSeconds = data.ageSeconds || 0;

        // Only show calls from last 30 seconds as "live"
        if (ageInSeconds <= 30 && normalizedPhone !== latestCall) {
          setLatestCall(normalizedPhone);
          setPhoneNumber(normalizedPhone);
          setClickToCallNumber(normalizedPhone);
          setWhatsappNumber(normalizedPhone);
          setHasLiveCall(true);
          console.log('[MyOperator] New incoming call:', normalizedPhone);
          handleCustomerSearch(normalizedPhone);
        } else if (ageInSeconds > 30) {
          setHasLiveCall(false);
        }
      }
    } catch (error) {
      console.error('[MyOperator] Check calls error:', error);
    }
  }, [latestCall, handleCustomerSearch, agentConfig]);

  // Check for live/ringing calls (filtered by agent if config available)
  const checkLiveCalls = useCallback(async () => {
    try {
      const response = await fetch('/api/myoperator/live-calls');
      const data = await response.json();

      if (data.liveCalls && data.liveCalls.length > 0) {
        // Filter by agent if config is available (skip for admins who see all)
        let filteredCalls = data.liveCalls;
        if (agentConfig && !agentConfig.showAllAgents) {
          filteredCalls = data.liveCalls.filter((c: LiveCall) =>
            !c.agent_name || // Show calls without agent assignment
            c.agent_name.toLowerCase() === agentConfig.name.toLowerCase() ||
            c.agent_id === agentConfig.userId
          );
        }

        setLiveCalls(filteredCalls);
        setHasLiveCall(filteredCalls.length > 0);

        // Auto-fill first ringing call across all tabs
        const ringingCall = filteredCalls.find((c: LiveCall) => c.call_state === 'ringing');
        if (ringingCall) {
          const normalizedPhone = ringingCall.phone_number.replace(/^\+?91/, '');
          if (normalizedPhone !== latestCall) {
            setLatestCall(normalizedPhone);
            setPhoneNumber(normalizedPhone);
            setClickToCallNumber(normalizedPhone);
            setWhatsappNumber(normalizedPhone);
            handleCustomerSearch(normalizedPhone);
          }
        }
      } else {
        setLiveCalls([]);
      }
    } catch (error) {
      console.error('[MyOperator] Live calls error:', error);
    }
  }, [latestCall, handleCustomerSearch, agentConfig]);

  // Load recent calls (filtered by agent if config available, skip for admins)
  const loadRecentCalls = useCallback(async () => {
    try {
      const url = agentConfig?.name && !agentConfig?.showAllAgents
        ? `/api/myoperator/recent-calls?limit=10&agentName=${encodeURIComponent(agentConfig.name)}`
        : '/api/myoperator/recent-calls?limit=10';
      const response = await fetch(url);
      const data = await response.json();
      if (data.calls) {
        setRecentCalls(data.calls);
      }
    } catch (error) {
      console.error('[MyOperator] Recent calls error:', error);
    }
  }, [agentConfig]);

  // Manual search
  const handleManualSearch = () => {
    if (phoneNumber) {
      handleCustomerSearch(phoneNumber);
    }
  };

  // Click to call
  const handleClickToCall = async () => {
    if (!clickToCallNumber) {
      toast.error('Please enter customer phone number');
      return;
    }

    setCalling(true);
    try {
      const response = await fetch('/api/myoperator/click-to-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: clickToCallNumber,
          userId: clickToCallUserId || undefined,
          number2: clickToCallNumber2 || undefined,
          type: clickToCallType,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Call initiated successfully. ID: ${data.uniqueId || data.referenceId}`);
      } else {
        toast.error(data.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Click to call error:', error);
      toast.error('Failed to initiate call');
    } finally {
      setCalling(false);
    }
  };

  // Send WhatsApp
  const handleSendWhatsApp = async () => {
    if (!whatsappNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    if (!selectedTemplate && !whatsappMessage) {
      toast.error('Please enter a message or select a template');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const response = await fetch('/api/myoperator/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerNumber: whatsappNumber,
          countryCode: '91',
          message: whatsappMessage || undefined,
          templateName: selectedTemplate || undefined,
          type: selectedTemplate ? 'template' : 'text',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('WhatsApp message sent');
        setWhatsappMessage('');
      } else {
        toast.error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('WhatsApp error:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingWhatsApp(false);
    }
  };


  // Format helpers
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      answered: 'bg-green-100 text-green-800',
      missed: 'bg-red-100 text-red-800',
      busy: 'bg-yellow-100 text-yellow-800',
      ringing: 'bg-blue-100 text-blue-800 animate-pulse',
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
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/^\+?91/, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return phone;
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

  const formatPhoneForWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return `https://wa.me/91${cleaned}`;
  };

  const formatPhoneForTel = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return `tel:+91${cleaned}`;
  };

  // Edit customer handlers
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
      handleCustomerSearch(customerData.customer.mobile_primary);
    } catch (error: unknown) {
      console.error('Error updating customer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update customer';
      toast.error(errorMessage);
    } finally {
      setSavingCustomerEdit(false);
    }
  };

  // Open map
  const handleOpenMap = (address: string) => {
    if (!address) {
      toast.error('No address available');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const encodedDestination = encodeURIComponent(address);
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodedDestination}&travelmode=driving`;
        window.open(mapsUrl, '_blank');
      },
      () => {
        // Fallback: open address without current location
        const encodedDestination = encodeURIComponent(address);
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`;
        window.open(mapsUrl, '_blank');
      }
    );
  };

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

  // Download invoice
  const handleDownloadInvoice = async (order: OrderInfo) => {
    if (!customerData) return;

    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order.id)
        .single();

      if (orderError) throw orderError;

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);

      if (itemsError) throw itemsError;

      const companyInfo = orderData.shipping_pincode ? await fetchDistributorCompanyInfo(orderData.shipping_pincode) : undefined;

      const invoiceData = {
        order: {
          ...orderData,
          id: orderData.id,
          order_number: orderData.order_number,
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
      toast.success("Invoice downloaded");
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast.error("Failed to download invoice");
    }
  };

  // Download customer ledger
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
      toast.success("Customer ledger downloaded");
    } catch (error) {
      console.error("Error downloading ledger:", error);
      toast.error("Failed to download ledger");
    }
  };

  // Share invoice via WhatsApp
  const handleShareViaWhatsApp = (order: OrderInfo) => {
    if (!customerData) return;

    const invoiceNumber = order.is_gst_invoice
      ? order.invoice_number_gst
      : order.invoice_number_non_gst;

    const orderUrl = `https://sadharmikandcompany.com/order/${order.order_number}`;

    const message = `*INVOICE - ${invoiceNumber || order.order_number}*\n\n` +
      `Dear ${customerData.customer.first_name} ${customerData.customer.last_name},\n\n` +
      `Thank you for your order!\n\n` +
      `*Order Details:*\n` +
      `Order Number: ${order.order_number}\n` +
      `Order Date: ${formatDate(order.order_date)}\n` +
      `Total Amount: ${formatCurrency(order.total_amount)}\n` +
      `Payment Status: ${order.payment_status}\n\n` +
      `View your complete order details and invoice here:\n${orderUrl}\n\n` +
      `Thank you for shopping with Sadharmik & Company!`;

    let phoneNum = customerData.customer.mobile_primary.replace(/\D/g, '');
    if (phoneNum.length === 10) {
      phoneNum = '91' + phoneNum;
    }

    const whatsappUrl = `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success("Opening WhatsApp...");
  };

  // Customer creation
  const handleOpenCustomerDialog = () => {
    setNewCustomerData({
      ...newCustomerData,
      mobile_primary: phoneNumber,
      whatsapp_number: phoneNumber,
    });
    setCustomerDialogOpen(true);
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomerData.first_name || !newCustomerData.mobile_primary) {
      toast.error('First name and phone number are required');
      return;
    }

    setSavingCustomer(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          first_name: newCustomerData.first_name,
          last_name: newCustomerData.last_name,
          mobile_primary: newCustomerData.mobile_primary,
          whatsapp_number: newCustomerData.whatsapp_number || newCustomerData.mobile_primary,
          email: newCustomerData.email || null,
          company_name: newCustomerData.company_name || null,
          shipping_building_name: newCustomerData.shipping_building_name || null,
          shipping_street_area: newCustomerData.shipping_street_area || null,
          shipping_city: newCustomerData.shipping_city || null,
          shipping_state: newCustomerData.shipping_state || null,
          shipping_pincode: newCustomerData.shipping_pincode || null,
          shipping_country: newCustomerData.shipping_country || 'India',
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Customer created successfully');
      setCustomerDialogOpen(false);

      if (data) {
        setPhoneNumber(data.mobile_primary);
        handleCustomerSearch(data.mobile_primary);
      }
    } catch (error: unknown) {
      console.error('Error saving customer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save customer';
      toast.error(errorMessage);
    } finally {
      setSavingCustomer(false);
    }
  };

  // Get authenticated user from Supabase Auth
  useEffect(() => {
    const getUser = async () => {
      setAuthLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
          console.log('[MyOperator Auth] Logged in as:', user.email);
        } else {
          console.warn('[MyOperator Auth] No user logged in');
          toast.error('Please log in to access MyOperator dashboard');
        }
      } catch (error) {
        console.error('[MyOperator Auth] Error getting user:', error);
      } finally {
        setAuthLoading(false);
      }
    };
    getUser();
  }, []);

  // Fetch MyOperator agent config when user email is available
  useEffect(() => {
    if (!userEmail) return;

    const fetchAgentConfig = async () => {
      setLoadingAgentConfig(true);
      try {
        const response = await fetch(`/api/myoperator/agent-config?email=${encodeURIComponent(userEmail)}`);
        const data = await response.json();

        if (data.success && data.hasConfig) {
          setAgentConfig(data.agentConfig);
          console.log('[MyOperator Agent Config] Loaded:', data.agentConfig);

          // Auto-fill userId for click-to-call Type 1
          if (data.agentConfig.userId) {
            setClickToCallUserId(data.agentConfig.userId);
          }
        } else {
          console.log('[MyOperator Agent Config] Not configured for user:', userEmail);
        }
      } catch (error) {
        console.error('[MyOperator Agent Config] Error:', error);
      } finally {
        setLoadingAgentConfig(false);
      }
    };

    fetchAgentConfig();
  }, [userEmail]);

  // Polling for incoming calls every 3 seconds
  useEffect(() => {
    loadRecentCalls();
    checkLiveCalls();
    checkForIncomingCalls();

    const interval = setInterval(() => {
      checkLiveCalls();
      checkForIncomingCalls();
      loadRecentCalls();
    }, 3000);

    return () => clearInterval(interval);
  }, [checkLiveCalls, checkForIncomingCalls, loadRecentCalls]);

  // Fetch rate list when customer data changes and has a pincode
  useEffect(() => {
    if (customerData?.customer?.shipping_pincode) {
      // Auto-fill pincode from customer data and fetch rate list
      fetchRateListData(customerData.customer.shipping_pincode);
    }
    // Don't reset pincode when customerData is null - allow manual pincode entry
  }, [customerData, fetchRateListData]);

  // Fetch WhatsApp templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/myoperator/whatsapp/templates');
        const data = await response.json();
        if (data.success) {
          setWhatsappTemplates(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };
    fetchTemplates();
  }, []);


  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Page Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg" className="hidden sm:flex">
            <AvatarFallback className="bg-primary/10 text-primary">
              {agentConfig?.name
                ? agentConfig.name.charAt(0).toUpperCase()
                : userEmail
                  ? userEmail.charAt(0).toUpperCase()
                  : <User className="h-4 w-4" />}
            </AvatarFallback>
            {agentConfig && !loadingAgentConfig && (
              <AvatarBadge className="bg-emerald-500" />
            )}
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              MyOperator Support
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>Cloud telephony and WhatsApp integration</span>
              {(authLoading || loadingAgentConfig) ? (
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Loading agent…
                </Badge>
              ) : agentConfig ? (
                <>
                  <Badge variant="secondary" className="font-mono">
                    {agentConfig.name} · Ext {agentConfig.extension}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {agentConfig.role}
                  </Badge>
                </>
              ) : userEmail ? (
                <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  No agent config · {userEmail}
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Not logged in
                </Badge>
              )}
              {hasLiveCall && (
                <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  Live call
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                checkLiveCalls();
                checkForIncomingCalls();
                loadRecentCalls();
                if (phoneNumber) {
                  handleCustomerSearch(phoneNumber);
                }
              }}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh live calls, recent calls, and customer data</TooltipContent>
        </Tooltip>
      </header>



      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="support" className="gap-2">
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Support</span>
          </TabsTrigger>
          <TabsTrigger value="dial" className="gap-2">
            <PhoneCall className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Click to Call</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
        </TabsList>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-3">
          {/* Search row */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <InputGroup className="h-10 flex-1">
              <InputGroupAddon>
                <Phone className="h-4 w-4" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Enter phone number..."
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setPhoneNumber(value);
                  if (value.length === 10) {
                    handleCustomerSearch(value);
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                className="h-10 text-sm"
              />
              <InputGroupAddon align="inline-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleManualSearch}
                      disabled={customerLoading}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                    >
                      {customerLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Search customer</TooltipContent>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>

            <InputGroup className="h-10 sm:w-56">
              <InputGroupAddon>
                <MapPin className="h-4 w-4" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Pincode..."
                value={rateListPincode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 6) {
                    setRateListPincode(value);
                    if (value.length === 6) {
                      fetchRateListData(value);
                    }
                  }
                }}
                maxLength={6}
                inputMode="numeric"
                className="h-10 text-sm"
              />
            </InputGroup>
          </div>

          {(customerData || customerLoading || customerError) ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Left: Live Calls & Customer Details */}
            <div className="space-y-3">
              {/* Live Calls */}
              {liveCalls.length > 0 && (
                <Card>
                  <CardHeader className="pb-1 pt-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <PhoneCall className="h-3.5 w-3.5 text-green-600" />
                      Live Calls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-2">
                    <div className="space-y-1.5">
                      {liveCalls.filter((call, index, self) =>
                        index === self.findIndex(c => c.phone_number === call.phone_number)
                      ).map((call) => (
                        <div
                          key={call.call_id}
                          className="flex items-center justify-between p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                          onClick={() => {
                            setPhoneNumber(call.phone_number);
                            handleCustomerSearch(call.phone_number);
                          }}
                        >
                          <div>
                            <div className="font-mono text-sm">{formatPhone(call.phone_number)}</div>
                            <div className="text-xs text-muted-foreground">{call.agent_name}</div>
                          </div>
                          <Badge className={getStatusColor(call.call_state)}>
                            {call.call_state}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Customer Details */}
              {customerLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : customerError ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium text-lg mb-2">Customer Not Found</h3>
                      <p className="text-muted-foreground mb-4">
                        No customer found with phone number: {phoneNumber}
                      </p>
                      <Button variant="outline" onClick={handleOpenCustomerDialog}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create New Customer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : customerData ? (
                <>
                  {/* Customer Details Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {(customerData.customer.first_name?.[0] || '?').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5">
                            <CardTitle className="text-base">Customer Details</CardTitle>
                            <div className="flex flex-wrap items-center gap-1">
                              {customerData.stats?.isPremium && (
                                <Badge className="gap-1 bg-violet-500/15 text-violet-700 hover:bg-violet-500/20 dark:text-violet-400">
                                  <span className="size-1.5 rounded-full bg-violet-500" />
                                  Premium ({customerData.stats.websiteOrderCount} web orders)
                                </Badge>
                              )}
                              {customerData.customer.is_vip && (
                                <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400">
                                  <span className="size-1.5 rounded-full bg-amber-500" />
                                  Sd
                                </Badge>
                              )}
                              {customerData.customer.is_defaulter && (
                                <Badge variant="destructive">Defaulter</Badge>
                              )}
                              {customerData.customer.is_mandir && (
                                <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-400">
                                  Mandir
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!isEditingCustomer ? (
                            <>
                              <Button
                                onClick={handleEditCustomer}
                                size="sm"
                                variant="outline"
                              >
                                <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                onClick={() => window.open(`/dashboard/orders/new?phone=${customerData.customer.mobile_primary}`, '_blank')}
                                size="sm"
                              >
                                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
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
                                {savingCustomerEdit ? 'Saving…' : 'Save'}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Address Section */}
                      {customerData.customer.full_address && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              Shipping Address
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenMap(customerData.customer.full_address || '')}
                              className="h-7 shrink-0"
                            >
                              <MapPin className="mr-1.5 h-3.5 w-3.5" />
                              Open Map
                            </Button>
                          </div>
                          <p className="text-sm leading-relaxed text-foreground/90">
                            {customerData.customer.full_address}
                          </p>
                        </div>
                      )}

                      {/* Customer Details Grid */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">First Name</p>
                          {isEditingCustomer ? (
                            <Input
                              value={editCustomerData.first_name || ''}
                              onChange={(e) => setEditCustomerData({ ...editCustomerData, first_name: e.target.value })}
                              className="h-8 text-sm"
                            />
                          ) : (
                            <p className="text-sm font-semibold">{customerData.customer.first_name}</p>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last Name</p>
                          {isEditingCustomer ? (
                            <Input
                              value={editCustomerData.last_name || ''}
                              onChange={(e) => setEditCustomerData({ ...editCustomerData, last_name: e.target.value })}
                              className="h-8 text-sm"
                            />
                          ) : (
                            <p className="text-sm font-semibold">{customerData.customer.last_name}</p>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Company</p>
                          {isEditingCustomer ? (
                            <Input
                              value={editCustomerData.company_name || ''}
                              onChange={(e) => setEditCustomerData({ ...editCustomerData, company_name: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="N/A"
                            />
                          ) : (
                            <p className="text-sm text-foreground/90">{customerData.customer.company_name || 'N/A'}</p>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                          {isEditingCustomer ? (
                            <Input
                              type="email"
                              value={editCustomerData.email || ''}
                              onChange={(e) => setEditCustomerData({ ...editCustomerData, email: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="N/A"
                            />
                          ) : (
                            <p className="break-all text-sm text-foreground/90">{customerData.customer.email || 'N/A'}</p>
                          )}
                        </div>
                        {customerData.customer.vip_number && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sd Number</p>
                            <Badge variant="outline" className="font-mono">
                              {customerData.customer.vip_number}
                            </Badge>
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Primary Phone</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono tabular-nums">{customerData.customer.mobile_primary}</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setClickToCallNumber(customerData.customer.mobile_primary);
                                setActiveTab('dial');
                              }}
                              title="Click to dial"
                            >
                              <PhoneCall className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {(customerData.customer.mobile_secondary_1 || isEditingCustomer) && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Secondary Phone 1</p>
                            {isEditingCustomer ? (
                              <Input
                                value={editCustomerData.mobile_secondary_1 || ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  setEditCustomerData({ ...editCustomerData, mobile_secondary_1: value });
                                }}
                                className="h-8 text-sm"
                                placeholder="10 digit number"
                                maxLength={10}
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-mono tabular-nums">{customerData.customer.mobile_secondary_1}</p>
                                {customerData.customer.mobile_secondary_1 && (
                                  <Button size="sm" variant="outline" className="h-6 w-6 p-0" asChild>
                                    <a href={formatPhoneForTel(customerData.customer.mobile_secondary_1)} title="Call">
                                      <PhoneCall className="h-3 w-3" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {(customerData.customer.mobile_secondary_2 || isEditingCustomer) && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Secondary Phone 2</p>
                            {isEditingCustomer ? (
                              <Input
                                value={editCustomerData.mobile_secondary_2 || ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  setEditCustomerData({ ...editCustomerData, mobile_secondary_2: value });
                                }}
                                className="h-8 text-sm"
                                placeholder="10 digit number"
                                maxLength={10}
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-mono tabular-nums">{customerData.customer.mobile_secondary_2}</p>
                                {customerData.customer.mobile_secondary_2 && (
                                  <Button size="sm" variant="outline" className="h-6 w-6 p-0" asChild>
                                    <a href={formatPhoneForTel(customerData.customer.mobile_secondary_2)} title="Call">
                                      <PhoneCall className="h-3 w-3" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">WhatsApp</p>
                          {isEditingCustomer ? (
                            <Input
                              value={editCustomerData.whatsapp_number || ''}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                setEditCustomerData({ ...editCustomerData, whatsapp_number: value });
                              }}
                              className="h-8 text-sm"
                              placeholder="10 digit number"
                              maxLength={10}
                            />
                          ) : customerData.customer.whatsapp_number ? (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-mono tabular-nums">{customerData.customer.whatsapp_number}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 w-6 p-0"
                                asChild
                              >
                                <a
                                  href={formatPhoneForWhatsApp(customerData.customer.whatsapp_number)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                </a>
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm text-foreground/90">N/A</p>
                          )}
                        </div>
                        {customerData.customer.gst_number && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">GST Number</p>
                            <p className="font-mono text-sm tabular-nums">{customerData.customer.gst_number}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* Total Orders */}
                    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                        Total Orders (FY)
                      </div>
                      <div className="font-heading text-2xl font-semibold tabular-nums">
                        {customerData.stats.totalOrders}
                      </div>
                    </div>

                    {/* Total Spent (clickable → ledger) */}
                    <button
                      onClick={handleDownloadLedger}
                      title="Click to download customer ledger"
                      className="group flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5" />
                          Total Spent (FY)
                        </span>
                        <Download className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="font-heading truncate text-lg font-semibold tabular-nums">
                        {formatCurrency(customerData.stats.totalSpent)}
                      </div>
                    </button>

                    {/* Balance Due */}
                    <div
                      className={`flex flex-col gap-1.5 rounded-lg border p-3 ${
                        customerData.stats.outstandingBalance > 0
                          ? 'border-red-200 bg-red-500/5 dark:border-red-900/50'
                          : 'border-emerald-200 bg-emerald-500/5 dark:border-emerald-900/50'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-xs font-medium ${
                          customerData.stats.outstandingBalance > 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        Balance Due
                      </div>
                      <div
                        className={`font-heading truncate text-lg font-semibold tabular-nums ${
                          customerData.stats.outstandingBalance > 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatCurrency(customerData.stats.outstandingBalance)}
                      </div>
                    </div>

                    {/* Active Tickets */}
                    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Active Tickets
                      </div>
                      <div className="font-heading text-2xl font-semibold tabular-nums">
                        {customerData.stats.activeTickets}
                      </div>
                    </div>

                    {/* Customer Since (full width) */}
                    <div className="col-span-2 flex items-center justify-between rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Customer Since
                      </div>
                      <div className="text-sm font-medium tabular-nums">
                        {formatDate(customerData.customer.created_at)}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Right: Orders, Tickets, Call History */}
            <div className="lg:col-span-2 space-y-3">
              {customerData && (
                <>
                  {/* Orders, Tickets, Call History Tabs */}
                  <Tabs value={customerTab} onValueChange={setCustomerTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="orders">
                        Orders ({customerData.orders.length})
                      </TabsTrigger>
                      <TabsTrigger value="tickets">
                        Tickets ({customerData.tickets.length})
                      </TabsTrigger>
                      <TabsTrigger value="calls">
                        Calls ({customerCallHistory.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="orders" className="space-y-2 mt-3">
                      {/* Create Order & Use Last Bill Buttons */}
                      <div className="flex gap-2 mb-3">
                        <Button
                          size="sm"
                          onClick={() => router.push(`/dashboard/orders/new?phone=${customerData.customer.mobile_primary}`)}
                          className="flex-1"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create Order
                        </Button>
                        {customerData.orders.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/dashboard/orders/new?reorder=${customerData.orders[0].id}&phone=${customerData.customer.mobile_primary}`)}
                            className="flex-1"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Use Last Bill
                          </Button>
                        )}
                      </div>

                      {customerData.orders.length === 0 ? (
                        <Card>
                          <CardContent className="flex items-center justify-center p-4">
                            <p className="text-sm text-muted-foreground">No orders found</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                        {(showAllOrders ? customerData.orders : customerData.orders.slice(0, 5)).map((order) => {
                          const isExpanded = expandedOrderId === order.id;
                          const itemCount = order.items?.length || 0;

                          return (
                            <Card
                              key={order.id}
                              className="cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            >
                              {/* Compact View - Always Visible */}
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-sm">{order.order_number}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(order.order_date)} • {formatCurrency(order.total_amount)} • {itemCount} items
                                    </p>
                                  </div>
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </CardContent>

                              {/* Expanded View - Shows on Click */}
                              {isExpanded && (
                                <CardContent className="pt-0 pb-4 px-4 border-t">
                                  <div className="space-y-2 pt-3">
                                    {/* Status Badges & Actions */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Badge className={`${getStatusColor(order.order_status)} text-xs`}>
                                        {order.order_status}
                                      </Badge>
                                      <Badge className={`${getStatusColor(order.payment_status)} text-xs`}>
                                        {order.payment_status}
                                      </Badge>
                                      {order.delivery_status && (
                                        <Badge className={`${getStatusColor(order.delivery_status)} text-xs`}>
                                          {order.delivery_status.replace(/_/g, ' ')}
                                        </Badge>
                                      )}
                                      <div className="flex gap-1 ml-auto">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 px-2"
                                          onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(order); }}
                                          title="Download Invoice"
                                        >
                                          <Download className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 px-2"
                                          onClick={(e) => { e.stopPropagation(); handleShareViaWhatsApp(order); }}
                                          title="Share via WhatsApp"
                                        >
                                          <WhatsAppIcon className="h-3 w-3 text-green-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 px-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/dashboard/orders/new?reorder=${order.id}&phone=${customerData.customer.mobile_primary}`)
                                          }}
                                          title="Reorder"
                                        >
                                          <RefreshCw className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Invoice & Location */}
                                    <div className="text-xs text-muted-foreground">
                                      {order.is_gst_invoice
                                        ? (order.invoice_number_gst || order.order_number)
                                        : (order.invoice_number_non_gst || order.order_number)
                                      } • {order.shipping_city}, {order.shipping_pincode}
                                    </div>

                                    {/* Delivery Partner */}
                                    {order.delivery_partner_name && (
                                      <div className="flex justify-between items-start text-xs">
                                        <span className="text-muted-foreground">Delivery:</span>
                                        <div className="text-right">
                                          <span className="font-medium">{order.delivery_partner_name}</span>
                                          {order.delivery_partner_mobile && (
                                            <a
                                              href={formatPhoneForTel(order.delivery_partner_mobile)}
                                              className="text-blue-600 hover:underline ml-1"
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
                                      <div className="flex justify-between items-start text-xs">
                                        <span className="text-muted-foreground">Distributor:</span>
                                        <div className="text-right">
                                          <span className="font-medium">{order.serviceable_distributor_name}</span>
                                          {order.serviceable_distributor_phone && (
                                            <a
                                              href={formatPhoneForTel(order.serviceable_distributor_phone)}
                                              className="text-blue-600 hover:underline ml-1"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {order.serviceable_distributor_phone}
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Warehouse/Godown */}
                                    {order.godown_name && (
                                      <div className="flex justify-between items-start text-xs">
                                        <span className="text-muted-foreground">Warehouse:</span>
                                        <div className="text-right">
                                          <span className="font-medium">{order.godown_name}</span>
                                          {order.godown_manager_name && (
                                            <span className="text-muted-foreground ml-1">({order.godown_manager_name})</span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Order Items */}
                                    {order.items && order.items.length > 0 && (
                                      <>
                                        <Separator className="my-2" />
                                        <p className="text-xs font-medium">Items:</p>
                                        {order.items.map((item, idx) => (
                                          <div key={idx} className="flex justify-between items-start text-xs gap-2">
                                            <span className="flex-1 min-w-0">{item.product_name} x {item.quantity}</span>
                                            <span className="font-medium whitespace-nowrap">{formatCurrency(item.total)}</span>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}

                        {/* Show More / Show Less Button */}
                        {customerData.orders.length > 5 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setShowAllOrders(!showAllOrders)}
                          >
                            {showAllOrders ? (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1 rotate-180" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Show All ({customerData.orders.length - 5} more)
                              </>
                            )}
                          </Button>
                        )}
                        </>
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
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-base">{ticket.ticket_number}</CardTitle>
                                  <CardDescription className="text-xs">
                                    {ticket.subject}
                                  </CardDescription>
                                </div>
                                <div className="flex gap-1">
                                  <Badge className={getStatusColor(ticket.status)}>
                                    {ticket.status}
                                  </Badge>
                                  <Badge variant="outline">
                                    {ticket.priority}
                                  </Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-xs text-muted-foreground">
                                {ticket.category} • {formatDate(ticket.created_at)}
                              </p>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="calls" className="space-y-2 mt-3">
                      {customerCallHistory.length === 0 ? (
                        <Card>
                          <CardContent className="flex items-center justify-center p-4">
                            <p className="text-sm text-muted-foreground">No call history found</p>
                          </CardContent>
                        </Card>
                      ) : (
                        customerCallHistory.map((call) => (
                          <Card key={call.id}>
                            <CardContent className="py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {call.direction === 'inbound' ? (
                                    <PhoneIncoming className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{call.agent_name || 'Unknown'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDuration(call.duration)} • {formatDate(call.start_time)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getStatusColor(call.status)}>
                                    {call.status}
                                  </Badge>
                                  {call.recording_url && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2"
                                      onClick={() => window.open(call.recording_url!, '_blank')}
                                    >
                                      <Play className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {call.disposition && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Disposition: {call.disposition}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* Pincode-Based Rate List */}
                  {rateListPincode && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              Rate List · Pincode {rateListPincode}
                            </CardTitle>
                            <CardDescription>
                              {customerData?.customer?.shipping_city
                                ? `Product prices for ${customerData.customer.shipping_city}, ${customerData.customer.shipping_state}`
                                : `Product prices for pincode ${rateListPincode}`}
                            </CardDescription>
                          </div>
                          {!rateListLoading && rateListProducts.length > 0 && (
                            <Badge variant="outline" className="font-mono">
                              {filteredRateListProducts.length} products
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Filters */}
                        {!rateListLoading && rateListProducts.length > 0 && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <InputGroup className="h-9 flex-1 sm:max-w-xs">
                              <InputGroupAddon>
                                <Search className="h-4 w-4" />
                              </InputGroupAddon>
                              <InputGroupInput
                                placeholder="Search products..."
                                value={rateListSearch}
                                onChange={(e) => setRateListSearch(e.target.value)}
                                className="h-9 text-sm"
                              />
                            </InputGroup>
                            {rateListCategories.length > 0 && (
                              <Select
                                value={rateListCategory}
                                onValueChange={setRateListCategory}
                              >
                                <SelectTrigger className="w-full sm:w-[180px]">
                                  <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Categories</SelectItem>
                                  {rateListCategories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                      {cat.category_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}

                        {/* Loading */}
                        {rateListLoading && (
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <Skeleton key={i} className="h-24 w-full rounded-lg" />
                            ))}
                          </div>
                        )}

                        {/* Product List */}
                        {!rateListLoading && filteredRateListProducts.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredRateListProducts.map((product) => {
                              const { customerPrice, customerSalePrice } =
                                getEffectivePrice(product, rateListPricingMap);
                              const hasDiscount =
                                customerSalePrice != null && customerSalePrice < customerPrice;
                              const discountPercent = hasDiscount
                                ? Math.round(
                                    ((customerPrice - customerSalePrice!) / customerPrice) * 100
                                  )
                                : 0;

                              const thumbnail =
                                product.images &&
                                product.images.length > 0 &&
                                isValidImageUrl(product.images[0])
                                  ? product.images[0]
                                  : null;

                              const categoryName = product.parent_category?.category_name ?? null;

                              return (
                                <div
                                  key={product.id}
                                  className="group flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent/50"
                                >
                                  {/* Thumbnail */}
                                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border">
                                    {thumbnail ? (
                                      <Image
                                        src={thumbnail}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        sizes="64px"
                                      />
                                    ) : (
                                      <div className="flex h-full items-center justify-center">
                                        <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                                      </div>
                                    )}
                                    {hasDiscount && discountPercent > 0 && (
                                      <Badge className="absolute -right-1 -top-1 h-4 rounded-full bg-emerald-600 px-1 py-0 text-[10px] text-white shadow-sm hover:bg-emerald-600">
                                        −{discountPercent}%
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Details */}
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <p className="line-clamp-2 text-sm font-medium leading-snug">
                                      {product.name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {categoryName && (
                                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                          {categoryName}
                                        </Badge>
                                      )}
                                      {product.brand && (
                                        <span className="text-[10px] text-muted-foreground">
                                          {product.brand}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                      <span className="font-heading text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                        {formatRateCurrency(
                                          hasDiscount ? customerSalePrice! : customerPrice
                                        )}
                                      </span>
                                      {hasDiscount && (
                                        <span className="text-xs tabular-nums text-muted-foreground line-through">
                                          {formatRateCurrency(customerPrice)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Empty */}
                        {!rateListLoading && rateListProducts.length > 0 && filteredRateListProducts.length === 0 && (
                          <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">No products match your search</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => {
                                setRateListSearch('');
                                setRateListCategory('all');
                              }}
                            >
                              Clear Filters
                            </Button>
                          </div>
                        )}

                        {!rateListLoading && rateListProducts.length === 0 && (
                          <div className="text-center py-8">
                            <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              No products available for this pincode
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>) : (
            <div className="space-y-2">
              {liveCalls.length > 0 && (
                <Card>
                  <CardHeader className="pb-1 pt-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <PhoneCall className="h-3.5 w-3.5 text-green-600 animate-pulse" />
                      Live Calls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-2">
                    <div className="space-y-1.5">
                      {liveCalls.filter((call, index, self) =>
                        index === self.findIndex(c => c.phone_number === call.phone_number)
                      ).map((call) => (
                        <div
                          key={call.call_id}
                          className="flex items-center justify-between p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                          onClick={() => {
                            setPhoneNumber(call.phone_number);
                            handleCustomerSearch(call.phone_number);
                          }}
                        >
                          <div>
                            <div className="font-mono text-sm">{formatPhone(call.phone_number)}</div>
                            <div className="text-xs text-muted-foreground">{call.agent_name}</div>
                          </div>
                          <Badge className={getStatusColor(call.call_state)}>
                            {call.call_state}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Calls
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {recentCalls.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent calls</p>
                  ) : (
                    <div className="space-y-1.5">
                      {recentCalls.slice(0, 10).map((call) => (
                        <div
                          key={call.id}
                          className="flex items-center justify-between p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                          onClick={() => {
                            setPhoneNumber(call.caller_number);
                            handleCustomerSearch(call.caller_number);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {call.direction === 'inbound' ? (
                              <PhoneIncoming className="h-4 w-4 text-green-600" />
                            ) : (
                              <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                            )}
                            <div>
                              <div className="font-mono text-sm">{formatPhone(call.caller_number)}</div>
                              <div className="text-xs text-muted-foreground">
                                {call.agent_name} • {formatDuration(call.duration)}
                              </div>
                            </div>
                          </div>
                          <Badge className={getStatusColor(call.status)} variant="secondary">
                            {call.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rate List when pincode entered without customer */}
              {rateListPincode && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Tag className="h-5 w-5 text-green-600" />
                        Rate List for Pincode: {rateListPincode}
                      </CardTitle>
                      {!rateListLoading && rateListProducts.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {filteredRateListProducts.length} products
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      Product prices for pincode {rateListPincode}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filters */}
                    {!rateListLoading && rateListProducts.length > 0 && (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1 sm:max-w-xs">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search products..."
                            value={rateListSearch}
                            onChange={(e) => setRateListSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        {rateListCategories.length > 0 && (
                          <Select
                            value={rateListCategory}
                            onValueChange={setRateListCategory}
                          >
                            <SelectTrigger className="w-full sm:w-[180px]">
                              <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {rateListCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.category_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {/* Loading */}
                    {rateListLoading && (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-24 w-full rounded-lg" />
                        ))}
                      </div>
                    )}

                    {/* Product List */}
                    {!rateListLoading && filteredRateListProducts.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredRateListProducts.slice(0, 12).map((product) => {
                          const { customerPrice, customerSalePrice } =
                            getEffectivePrice(product, rateListPricingMap);
                          const hasDiscount =
                            customerSalePrice != null && customerSalePrice < customerPrice;

                          return (
                            <div
                              key={product.id}
                              className="flex gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-snug line-clamp-2">
                                  {product.name}
                                </p>
                                <div className="flex items-baseline gap-2 mt-1">
                                  <span className="text-base font-bold text-green-700">
                                    {formatRateCurrency(
                                      hasDiscount ? customerSalePrice! : customerPrice
                                    )}
                                  </span>
                                  {hasDiscount && (
                                    <span className="text-xs text-muted-foreground line-through">
                                      {formatRateCurrency(customerPrice)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty */}
                    {!rateListLoading && rateListProducts.length === 0 && (
                      <div className="text-center py-8">
                        <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No products available for this pincode
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Click to Call Tab */}
        <TabsContent value="dial" className="space-y-4">
          {/* Current Agent Info */}
          {agentConfig && (
            <Alert className="border-l-4 border-l-blue-500 bg-blue-500/5">
              <User className="text-blue-600 dark:text-blue-400" />
              <AlertTitle>Logged in as {agentConfig.name}</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Badge variant="secondary" className="font-mono">Ext {agentConfig.extension}</Badge>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{agentConfig.role}</Badge>
                  <Badge variant="outline" className="font-mono">{agentConfig.phone}</Badge>
                  {agentConfig.userId && (
                    <Badge variant="outline" className="font-mono">UID {agentConfig.userId}</Badge>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="border-b bg-gradient-to-br from-blue-500/5 to-blue-500/0 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-base">Click to Call</CardTitle>
                    <CardDescription>Initiate outbound calls via MyOperator OBD</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1.5 font-mono uppercase tracking-wide">
                  Type {clickToCallType}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* Call Type */}
              <div className="space-y-2">
                <Label htmlFor="callType" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Call Type
                </Label>
                <Select value={clickToCallType} onValueChange={(v) => setClickToCallType(v as '1' | '2')}>
                  <SelectTrigger id="callType" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-[10px]">Type 2</Badge>
                        IVR — routes to available agent
                      </span>
                    </SelectItem>
                    <SelectItem value="1">
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-[10px]">Type 1</Badge>
                        Peer-to-Peer — direct agent dial
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Phone */}
              <div className="space-y-2">
                <Label htmlFor="customerNumber" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Customer Phone <span className="text-destructive">*</span>
                </Label>
                <InputGroup className="h-10">
                  <InputGroupAddon>
                    <Phone className="h-4 w-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="customerNumber"
                    placeholder="+917483320275"
                    value={clickToCallNumber}
                    onChange={(e) => setClickToCallNumber(e.target.value)}
                    inputMode="tel"
                    className="h-10 text-sm"
                  />
                </InputGroup>
              </div>

              {clickToCallType === '1' && (
                <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Badge variant="secondary" className="font-mono text-[10px]">P2P</Badge>
                    Choose agent end
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="userId" className="text-xs font-medium">
                      User / Agent ID
                    </Label>
                    <InputGroup className="h-10">
                      <InputGroupAddon>
                        <User className="h-4 w-4" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id="userId"
                        placeholder="MyOperator user ID"
                        value={clickToCallUserId}
                        onChange={(e) => {
                          setClickToCallUserId(e.target.value);
                          if (e.target.value) setClickToCallNumber2('');
                        }}
                        className="h-10 text-sm"
                      />
                    </InputGroup>
                    <p className="text-[11px] text-muted-foreground">
                      {agentConfig?.userId
                        ? `Auto-filled with your agent ID — ${agentConfig.name} is dialed first, then the customer.`
                        : 'Agent is dialed first, then the customer.'}
                    </p>
                  </div>

                  <div className="relative">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-muted px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      or
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="number2" className="text-xs font-medium">
                      Second Number (Anonymous)
                    </Label>
                    <InputGroup className="h-10">
                      <InputGroupAddon>
                        <Phone className="h-4 w-4" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id="number2"
                        placeholder="+919876543210"
                        value={clickToCallNumber2}
                        onChange={(e) => {
                          setClickToCallNumber2(e.target.value);
                          if (e.target.value) setClickToCallUserId('');
                        }}
                        inputMode="tel"
                        className="h-10 text-sm"
                      />
                    </InputGroup>
                    <p className="text-[11px] text-muted-foreground">
                      Both numbers are dialed directly. Requires anonymous feature enabled.
                    </p>
                  </div>
                </div>
              )}

              {clickToCallType === '2' && (
                <Alert className="border-l-4 border-l-blue-500 bg-blue-500/5">
                  <AlertCircle className="text-blue-600 dark:text-blue-400" />
                  <AlertDescription>
                    Customer will be connected to any available agent in the IVR department.
                    {agentConfig && (
                      <span> You (<span className="font-medium text-foreground">{agentConfig.name}</span>) must be online to receive the call.</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Action footer */}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setClickToCallNumber('');
                    setClickToCallUserId('');
                    setClickToCallNumber2('');
                  }}
                  disabled={calling}
                  className="h-10"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleClickToCall}
                  disabled={calling || !clickToCallNumber}
                  className="h-10 px-6"
                >
                  {calling ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Initiating call…
                    </>
                  ) : (
                    <>
                      <PhoneCall className="mr-2 h-4 w-4" />
                      Make Call
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* All Agents Quick Reference */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-4 w-4 text-muted-foreground" />
                Team Agents
              </CardTitle>
              <CardDescription>MyOperator registered agents — click the phone to dial</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 pl-4">Ext</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="w-12 pr-4 text-right">Call</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    // Cleared of the previous business's real staff — add
                    // Sadharmik & Co's own agents here once MyOperator is set up.
                    { ext: '00', name: 'Admin', role: 'Admin', phone: '', email: 'admin@sadharmikandco.com' },
                  ].map((agent) => {
                    const isYou = agentConfig?.extension === agent.ext;
                    return (
                      <TableRow
                        key={agent.ext}
                        className={isYou ? 'bg-blue-500/5' : undefined}
                      >
                        <TableCell className="pl-4">
                          <span className="inline-flex size-7 items-center justify-center rounded-full bg-blue-500/10 font-mono text-xs font-medium text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-400">
                            {agent.ext}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {agent.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{agent.name}</span>
                            {isYou && (
                              <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                You
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                            {agent.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">{agent.phone}</TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{agent.email}</TableCell>
                        <TableCell className="pr-4 text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setClickToCallNumber(agent.phone);
                                  setClickToCallType('1');
                                }}
                              >
                                <PhoneCall className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Dial {agent.name}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader className="border-b bg-gradient-to-br from-emerald-500/5 to-emerald-500/0 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <WhatsAppIcon className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-base">Send WhatsApp Message</CardTitle>
                    <CardDescription>Send messages using approved templates or free text</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Connected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* Recipient phone */}
              <div className="space-y-2">
                <Label htmlFor="whatsappNumber" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recipient
                </Label>
                <InputGroup className="h-10">
                  <InputGroupAddon>
                    <WhatsAppIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="whatsappNumber"
                    placeholder="91XXXXXXXXXX"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    inputMode="tel"
                    className="h-10 text-sm"
                  />
                </InputGroup>
                <p className="text-[11px] text-muted-foreground">
                  Include country code (e.g. <span className="font-mono">919876543210</span>)
                </p>
              </div>

              {/* Template selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Message Template <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
                </Label>
                <Select value={selectedTemplate || "__none__"} onValueChange={(v) => setSelectedTemplate(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None — send a free text message</SelectItem>
                    {whatsappTemplates.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        <span className="flex items-center gap-2">
                          <span>{template.name}</span>
                          <Badge
                            variant="outline"
                            className={`px-1.5 py-0 text-[10px] ${
                              template.status?.toLowerCase() === 'approved'
                                ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : ''
                            }`}
                          >
                            {template.status}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Free-text message (only when no template) */}
              {!selectedTemplate && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="whatsappMessage" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Message
                    </Label>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {whatsappMessage.length} chars
                    </span>
                  </div>
                  <Textarea
                    id="whatsappMessage"
                    placeholder="Type your message…"
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    rows={5}
                    className="resize-y"
                  />
                  <Alert className="border-l-4 border-l-amber-500 bg-amber-500/5">
                    <AlertCircle className="text-amber-600 dark:text-amber-400" />
                    <AlertDescription>
                      Free-text messages can only be sent within <span className="font-medium text-foreground">24 hours</span> of the customer&apos;s last message.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Send button */}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWhatsappNumber('');
                    setWhatsappMessage('');
                    setSelectedTemplate('');
                  }}
                  disabled={sendingWhatsApp}
                  className="h-10"
                >
                  Clear
                </Button>
                <Button
                  onClick={() => handleSendWhatsApp()}
                  disabled={sendingWhatsApp || !whatsappNumber || (!selectedTemplate && !whatsappMessage)}
                  className="h-10 bg-emerald-600 px-6 text-white hover:bg-emerald-700"
                >
                  {sendingWhatsApp ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send WhatsApp Message
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Customer Creation Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Customer</DialogTitle>
            <DialogDescription>
              Add a new customer to the system
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={newCustomerData.first_name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={newCustomerData.last_name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mobile_primary">Primary Phone *</Label>
                <Input
                  id="mobile_primary"
                  value={newCustomerData.mobile_primary}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, mobile_primary: e.target.value.replace(/\D/g, '') })}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                <Input
                  id="whatsapp_number"
                  value={newCustomerData.whatsapp_number}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, whatsapp_number: e.target.value.replace(/\D/g, '') })}
                  maxLength={10}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomerData.email}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={newCustomerData.company_name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, company_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_building_name">Building Name</Label>
              <Input
                id="shipping_building_name"
                value={newCustomerData.shipping_building_name}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, shipping_building_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping_street_area">Street / Area</Label>
              <Input
                id="shipping_street_area"
                value={newCustomerData.shipping_street_area}
                onChange={(e) => setNewCustomerData({ ...newCustomerData, shipping_street_area: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipping_city">City</Label>
                <Input
                  id="shipping_city"
                  value={newCustomerData.shipping_city}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, shipping_city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipping_state">State</Label>
                <Select
                  value={newCustomerData.shipping_state}
                  onValueChange={(v) => setNewCustomerData({ ...newCustomerData, shipping_state: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipping_pincode">Pincode</Label>
                <Input
                  id="shipping_pincode"
                  value={newCustomerData.shipping_pincode}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, shipping_pincode: e.target.value.replace(/\D/g, '') })}
                  maxLength={6}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewCustomer} disabled={savingCustomer}>
              {savingCustomer ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Create Customer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
