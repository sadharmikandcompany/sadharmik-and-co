import { NextRequest, NextResponse } from 'next/server';
import { ozonetelService } from '@/lib/services/ozonetel';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get('phone');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Find customer by phone number
    const customer = await ozonetelService.findCustomerByPhone(phoneNumber);

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get customer's orders
    const orders = await ozonetelService.getCustomerOrders(customer.id);

    // Get customer's support tickets
    const tickets = await ozonetelService.getCustomerTickets(customer.id);

    // Compute outstanding balance across all non-cancelled orders for this customer.
    // Paid amounts are tracked in route_assignments.collected_amount, so we need
    // every order for the customer (not just the recent set returned above).
    let outstandingBalance = 0;
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, total_amount, order_status, order_date, source')
      .eq('customer_id', customer.id);

    // Premium customer: 5+ website orders (all-time, excluding cancelled)
    const websiteOrderCount = (allOrders || []).filter(
      o => o.order_status !== 'cancelled' && o.source === 'website'
    ).length;
    const isPremium = websiteOrderCount >= 5;

    // Order stats count the current financial year (Apr 1 – Mar 31), not all-time
    const now = new Date();
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(fyStartYear, 3, 1);
    const fyOrders = (allOrders || []).filter(
      o => o.order_status !== 'cancelled' && o.order_date && new Date(o.order_date) >= fyStart
    );

    if (allOrders && allOrders.length > 0) {
      const activeOrders = allOrders.filter(o => o.order_status !== 'cancelled');
      const orderIds = activeOrders.map(o => o.id);

      const paidByOrder = new Map<string, number>();
      if (orderIds.length > 0) {
        const { data: routeAssignments } = await supabase
          .from('route_assignments')
          .select('order_id, collected_amount')
          .in('order_id', orderIds);

        (routeAssignments || []).forEach((ra: any) => {
          if (!ra.order_id) return;
          paidByOrder.set(
            ra.order_id,
            (paidByOrder.get(ra.order_id) || 0) + Number(ra.collected_amount || 0)
          );
        });
      }

      outstandingBalance = activeOrders.reduce((sum, o) => {
        const paid = paidByOrder.get(o.id) || 0;
        return sum + (Number(o.total_amount || 0) - paid);
      }, 0);
    }

    return NextResponse.json({
      customer,
      orders,
      tickets,
      stats: {
        totalOrders: fyOrders.length,
        totalSpent: fyOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
        activeTickets: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
        outstandingBalance,
        websiteOrderCount,
        isPremium
      }
    });
  } catch (error) {
    console.error('Customer lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup customer' },
      { status: 500 }
    );
  }
}
