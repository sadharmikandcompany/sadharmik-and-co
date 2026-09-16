'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Package, MapPin, Download, Printer, ShieldCheck, Truck, QrCode, CreditCard, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { generateOrderInvoice } from '@/lib/invoice-generator';
import { toast } from 'sonner';
import QRCode from 'qrcode';

// Remove the interface as we're using useParams now

type Order = {
  id: string;
  order_number: string;
  customer_id: string | null;
  distributor_id: string | null;
  is_distributor: boolean;
  is_subdistributor: boolean;
  order_status: string;
  payment_status: string;
  payment_method: string | null;
  transaction_id: string | null;
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
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  gst_amount: number;
  shipping_charges: number;
  total_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  shipping_method: string | null;
  tracking_number: string | null;
  courier_partner: string | null;
  expected_delivery_date: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  customer_notes: string | null;
  is_priority: boolean;
  order_date: string;
  created_at: string;
  delivery_partner_id: string | null;
  delivery_status: string | null;
};

type OrderItem = {
  id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  hsn_code: string | null;
  gst_percentage: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  subtotal: number;
  total: number;
};

type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile_primary: string;
  company_name: string | null;
  full_address: string | null;
};

type DeliveryPartner = {
  id: string;
  name: string;
  mobile: string;
};

async function getOrder(orderNumber: string) {
  try {
    // Fetch order by order_number instead of id
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !orderData) {
      return null;
    }

    // Fetch order items using the order's id
    const { data: itemsData, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderData.id);

    if (itemsError) {
      return null;
    }

    // Fetch customer
    let customer: Customer | null = null;
    if (orderData.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, mobile_primary, company_name, full_address")
        .eq("id", orderData.customer_id)
        .single();

      if (!customerError && customerData) {
        customer = customerData;
      }
    } else if (orderData.distributor_id) {
      // Fetch distributor and transform to Customer type
      const { data: distributorData, error: distributorError } = await supabase
        .from("distributors")
        .select("id, name, email, phone_primary, company_name")
        .eq("id", orderData.distributor_id)
        .single();

      if (!distributorError && distributorData) {
        customer = {
          id: distributorData.id,
          first_name: distributorData.name.split(' ')[0] || distributorData.name,
          last_name: distributorData.name.split(' ').slice(1).join(' ') || '',
          email: distributorData.email,
          mobile_primary: distributorData.phone_primary,
          company_name: distributorData.company_name,
          full_address: null
        };
      }
    }

    // Fetch delivery partner
    let deliveryPartner: DeliveryPartner | null = null;
    if (orderData.delivery_partner_id) {
      const { data: partnerData, error: partnerError } = await supabase
        .from("delivery_partners")
        .select("id, name, mobile")
        .eq("id", orderData.delivery_partner_id)
        .single();

      if (!partnerError && partnerData) {
        deliveryPartner = partnerData;
      }
    }

    return {
      order: orderData as Order,
      items: (itemsData || []) as OrderItem[],
      customer,
      deliveryPartner
    };
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
}

function getStatusVariant(status: string) {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === "completed" || lowerStatus === "delivered" || lowerStatus === "paid") {
    return "default";
  }
  if (lowerStatus === "pending" || lowerStatus === "processing") {
    return "outline";
  }
  if (lowerStatus === "cancelled" || lowerStatus === "failed") {
    return "destructive";
  }
  return "secondary";
}

export default function OrderPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50/50 to-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    }>
      <OrderPage />
    </Suspense>
  );
}

function OrderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderNumber = params.orderid as string;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deliveryPartner, setDeliveryPartner] = useState<DeliveryPartner | null>(null);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  // Payment QR code state
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [generatingPayment, setGeneratingPayment] = useState(false);
  const [easebuzzPaymentUrl, setEasebuzzPaymentUrl] = useState<string | null>(null);

  // Check for payment callback result
  const paymentResult = searchParams.get('payment');
  const paymentReason = searchParams.get('reason');

  useEffect(() => {
    async function fetchData() {
      const data = await getOrder(orderNumber);

      if (!data) {
        setNotFoundFlag(true);
        setLoading(false);
        return;
      }

      setOrder(data.order);
      setItems(data.items);
      setCustomer(data.customer);
      setDeliveryPartner(data.deliveryPartner);
      setLoading(false);
    }

    if (orderNumber) {
      fetchData();
    }
  }, [orderNumber]);

  // Generate payment QR pointing to /order/{order_number}
  useEffect(() => {
    if (!order) return;

    const orderPageUrl = `${window.location.origin}/order/${order.order_number}`;
    setPaymentUrl(orderPageUrl);

    QRCode.toDataURL(orderPageUrl, {
      width: 250,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).then(qrDataUrl => {
      setPaymentQrDataUrl(qrDataUrl);
    }).catch(err => {
      console.error('Error generating QR:', err);
    });
  }, [order]);

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
            name: match.company_name || match.name,
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

  const handleDownloadInvoice = async () => {
    if (!order || !customer || items.length === 0) {
      toast.error("Unable to generate invoice");
      return;
    }

    try {
      const companyInfo = order.shipping_pincode ? await fetchDistributorCompanyInfo(order.shipping_pincode) : undefined;

      const invoiceData = {
        order: {
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          order_status: order.order_status,
          payment_status: order.payment_status,
          payment_method: order.payment_method || 'Not specified',
          subtotal: order.subtotal,
          discount_amount: order.discount_amount,
          cgst_amount: order.cgst_amount,
          sgst_amount: order.sgst_amount,
          igst_amount: order.igst_amount,
          shipping_charges: order.shipping_charges,
          total_amount: order.total_amount,
          shipping_room_number: order.shipping_room_number || undefined,
          shipping_floor: order.shipping_floor || undefined,
          shipping_wing: order.shipping_wing || undefined,
          shipping_flat_number: order.shipping_flat_number || undefined,
          shipping_floor_wing: order.shipping_floor_wing || undefined,
          shipping_building_name: order.shipping_building_name,
          shipping_street_area: order.shipping_street_area,
          shipping_landmark: order.shipping_landmark || undefined,
          shipping_city: order.shipping_city,
          shipping_state: order.shipping_state,
          shipping_pincode: order.shipping_pincode,
          shipping_country: order.shipping_country || undefined,
          billing_room_number: order.shipping_room_number || undefined,
          billing_floor: order.shipping_floor || undefined,
          billing_wing: order.shipping_wing || undefined,
          billing_flat_number: order.shipping_flat_number || undefined,
          billing_floor_wing: order.shipping_floor_wing || undefined,
          billing_building_name: order.shipping_building_name,
          billing_street_area: order.shipping_street_area,
          billing_landmark: order.shipping_landmark || undefined,
          billing_city: order.shipping_city,
          billing_state: order.shipping_state,
          billing_pincode: order.shipping_pincode,
          billing_country: order.shipping_country || undefined,
        },
        customer: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email || undefined,
          mobile_primary: customer.mobile_primary,
          company_name: customer.company_name || undefined,
        },
        items: items.map(item => ({
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

      generateOrderInvoice(invoiceData);
      toast.success("Invoice downloaded successfully");
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice");
    }
  };

  const handlePrintInvoice = () => {
    toast.info("Generating invoice for printing...");
    handleDownloadInvoice();
  };

  // Get last 3 digits of order number as OTP
  const getDeliveryOTP = () => {
    if (!order) return '---';
    return order.order_number.slice(-3);
  };

  // Generate Easebuzz payment link and redirect
  const handlePayNow = async () => {
    if (!order || !customer) {
      toast.error('Unable to process payment');
      return;
    }

    setGeneratingPayment(true);
    try {
      const response = await fetch('/api/easebuzz/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          amount: order.total_amount,
          customerName: `${customer.first_name} ${customer.last_name}`.trim(),
          customerPhone: customer.mobile_primary,
          customerEmail: customer.email || undefined,
          productInfo: 'Kalapurna Order',
        }),
      });

      const data = await response.json();
      if (data.success && data.paymentUrl) {
        setEasebuzzPaymentUrl(data.paymentUrl);
        // Update QR code to point to payment URL
        QRCode.toDataURL(data.paymentUrl, {
          width: 250,
          margin: 2,
          errorCorrectionLevel: 'M',
        }).then(qrDataUrl => {
          setPaymentQrDataUrl(qrDataUrl);
        });
        // Redirect to Easebuzz payment page
        window.location.href = data.paymentUrl;
      } else {
        toast.error(data.error || 'Failed to generate payment link');
      }
    } catch (error) {
      console.error('Payment link generation error:', error);
      toast.error('Failed to generate payment link');
    } finally {
      setGeneratingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50/50 to-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (notFoundFlag || !order) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/30 to-background">
      {/* Header with green accent */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-6 shadow-md">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium opacity-90 mb-1">Order Number</p>
              <h1 className="text-xl font-bold tracking-tight">#{order.order_number}</h1>
              <p className="text-xs opacity-80 mt-1">
                {new Date(order.order_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge
                variant={getStatusVariant(order.order_status)}
                className="text-xs bg-white/20 text-white border-white/30"
              >
                {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintInvoice}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadInvoice}
              className="flex-1 bg-white text-green-700 hover:bg-white/90"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-4 space-y-3">

        {/* Payment Result Banner */}
        {paymentResult === 'success' && (
          <Card className="border-green-300 bg-green-50 shadow-sm gap-0 py-0">
            <CardContent className="py-3 px-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">Payment completed successfully!</p>
            </CardContent>
          </Card>
        )}
        {paymentResult === 'failed' && (
          <Card className="border-red-300 bg-red-50 shadow-sm gap-0 py-0">
            <CardContent className="py-3 px-4 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm font-medium text-red-800">
                Payment failed{paymentReason ? `: ${paymentReason}` : '. Please try again.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Customer & Payment Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {customer && (
            <Card className="border-green-100 shadow-sm gap-0 py-0">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-sm font-medium text-green-800">Customer</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 space-y-1.5">
                <p className="font-semibold text-sm">
                  {customer.first_name} {customer.last_name}
                </p>
                {customer.company_name && (
                  <p className="text-xs text-muted-foreground">{customer.company_name}</p>
                )}
                {customer.email && (
                  <p className="text-xs text-muted-foreground break-all">{customer.email}</p>
                )}
                {customer.mobile_primary && (
                  <p className="text-xs text-muted-foreground">{customer.mobile_primary}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-green-100 shadow-sm gap-0 py-0">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-sm font-medium text-green-800">Payment</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={getStatusVariant(order.payment_status)}
                  className="text-xs bg-green-100 text-green-700 border-green-200"
                >
                  {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                </Badge>
              </div>
              {order.payment_method && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{order.payment_method}</span>
                </div>
              )}
              {order.transaction_id && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-1">Transaction ID</p>
                  <p className="text-xs font-mono bg-green-50 px-2 py-1 rounded break-all">
                    {order.transaction_id}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Shipping Address */}
        <Card className="border-green-100 shadow-sm gap-0 py-0">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-800">
              <MapPin className="h-4 w-4 text-green-600" />
              Shipping Address
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            {order.shipping_city && order.shipping_city !== 'N/A' && order.shipping_city !== '' ? (
              <address className="not-italic text-xs leading-relaxed text-muted-foreground">
                {order.shipping_room_number && order.shipping_room_number !== 'N/A' && (
                  <span>Room {order.shipping_room_number}, </span>
                )}
                {order.shipping_floor && order.shipping_floor !== 'N/A' && (
                  <span>Floor {order.shipping_floor}, </span>
                )}
                {order.shipping_wing && order.shipping_wing !== 'N/A' && (
                  <span>Wing {order.shipping_wing}, </span>
                )}
                {order.shipping_flat_number && order.shipping_flat_number !== 'N/A' && (
                  <span>{order.shipping_flat_number}, </span>
                )}
                {order.shipping_building_name && order.shipping_building_name !== 'N/A' && (
                  <span className="font-medium text-foreground">{order.shipping_building_name}, </span>
                )}
                {order.shipping_street_area && order.shipping_street_area !== 'N/A' && (
                  <span>{order.shipping_street_area}, </span>
                )}
                {order.shipping_landmark && order.shipping_landmark !== 'N/A' && (
                  <span>Near {order.shipping_landmark}, </span>
                )}
                <span>{order.shipping_city}, {order.shipping_state} - {order.shipping_pincode}</span>
                {order.shipping_country && order.shipping_country !== 'N/A' && (
                  <span>, {order.shipping_country}</span>
                )}
              </address>
            ) : customer?.full_address && customer.full_address !== '000000' && customer.full_address !== 'Not Provided' ? (
              <address className="not-italic text-xs leading-relaxed text-muted-foreground">
                {customer.full_address}
              </address>
            ) : (
              <p className="text-xs text-muted-foreground">No address available</p>
            )}
          </CardContent>
        </Card>

        {/* Delivery Information */}
        {deliveryPartner && (
          <Card className="border-green-100 shadow-sm gap-0 py-0">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-800">
                <Truck className="h-4 w-4 text-green-600" />
                Delivery Driver
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4 space-y-1.5">
              <p className="font-semibold text-sm">{deliveryPartner.name}</p>
              <p className="text-xs text-muted-foreground">{deliveryPartner.mobile}</p>
              {order.delivery_status && (
                <div className="pt-1">
                  <Badge variant={getStatusVariant(order.delivery_status)} className="text-xs">
                    {order.delivery_status.charAt(0).toUpperCase() + order.delivery_status.slice(1).replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card className="border-green-100 shadow-sm gap-0 py-0">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-800">
              <Package className="h-4 w-4 text-green-600" />
              Items ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            {/* Mobile-optimized item list */}
            <div className="space-y-3">
              {items.map((item, index) => {
                const itemSubtotal = item.quantity * item.unit_price;
                const netAmount = itemSubtotal - item.discount_amount;

                return (
                  <div
                    key={item.id}
                    className="pb-3 border-b last:border-0 last:pb-0 border-green-100"
                  >
                    <div className="flex justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight">{item.product_name}</p>
                        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-1">
                          {item.product_sku && <span>SKU: {item.product_sku}</span>}
                          {item.hsn_code && <span>HSN: {item.hsn_code}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm text-green-700">₹{item.total.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unit Price</span>
                        <span>₹{item.unit_price.toFixed(2)}</span>
                      </div>
                      {item.discount_percent > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Discount</span>
                          <span className="text-green-600">{item.discount_percent}%</span>
                        </div>
                      )}
                      {item.gst_percentage > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GST</span>
                          <span>{item.gst_percentage}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>


            {/* Order Summary */}
            <div className="mt-4 pt-4 border-t border-green-100">
              <div className="space-y-2 bg-green-50/50 p-3 rounded-lg">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">₹{order.subtotal.toFixed(2)}</span>
                </div>
                {(() => {
                  const totalItemDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
                  return totalItemDiscount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Item Discounts</span>
                      <span className="text-green-600 font-medium">-₹{totalItemDiscount.toFixed(2)}</span>
                    </div>
                  );
                })()}
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Order Discount</span>
                    <span className="text-green-600 font-medium">-₹{order.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                {order.cgst_amount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">CGST</span>
                    <span className="font-medium">₹{order.cgst_amount.toFixed(2)}</span>
                  </div>
                )}
                {order.sgst_amount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">SGST</span>
                    <span className="font-medium">₹{order.sgst_amount.toFixed(2)}</span>
                  </div>
                )}
                {order.igst_amount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">IGST</span>
                    <span className="font-medium">₹{order.igst_amount.toFixed(2)}</span>
                  </div>
                )}
                {order.shipping_charges > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">₹{order.shipping_charges.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="bg-green-200" />
                <div className="flex justify-between text-base font-bold text-green-800 pt-1">
                  <span>Total</span>
                  <span>₹{order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Notes */}
        {order.customer_notes && (
          <Card className="border-green-100 shadow-sm gap-0 py-0">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-sm font-medium text-green-800">Order Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-xs leading-relaxed text-muted-foreground">{order.customer_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Order QR Code */}
        {paymentQrDataUrl && (
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0 shadow-lg gap-0 py-0">
            <CardContent className="py-6 px-4">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <QrCode className="h-5 w-5" />
                  <p className="text-xs font-medium uppercase tracking-wide">Order QR Code</p>
                </div>

                <div className="bg-white rounded-xl p-3 inline-block mx-auto shadow-lg">
                  <img
                    src={paymentQrDataUrl}
                    alt="Order QR Code"
                    className="w-48 h-48"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-2xl font-bold">₹{order.total_amount.toFixed(2)}</p>
                  <p className="text-xs text-white/80">
                    {easebuzzPaymentUrl ? 'Scan to pay' : 'Scan to view order details'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pay Now Button - Show when payment is pending */}
        {order.payment_status === 'pending' && customer && (
          <Button
            onClick={handlePayNow}
            disabled={generatingPayment}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 text-lg font-semibold shadow-lg"
            size="lg"
          >
            {generatingPayment ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating Payment Link...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-5 w-5" />
                Pay Now - ₹{order.total_amount.toFixed(2)}
              </>
            )}
          </Button>
        )}

        {/* Delivery OTP - Prominent Display */}
        <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white border-0 shadow-lg gap-0 py-0">
          <CardContent className="py-6 px-4">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5" />
                <p className="text-xs font-medium uppercase tracking-wide">Delivery Verification Code</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-5 border border-white/20">
                <p className="text-5xl font-bold font-mono tracking-[0.3em] text-white">
                  {getDeliveryOTP()}
                </p>
              </div>

              <p className="text-xs opacity-90 max-w-xs mx-auto pt-1">
                Share this code with the delivery partner to confirm receipt
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
