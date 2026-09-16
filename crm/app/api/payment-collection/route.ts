import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    // Fetch orders with pending/partial payment status
    const allOrders: any[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabaseServer
        .from("orders")
        .select(
          "id, order_number, customer_id, total_amount, payment_status, order_status, order_date, created_at, invoice_number_gst, invoice_number_non_gst, cod_collected_amount, cod_payment_method"
        )
        .in("payment_status", ["pending", "partial"])
        .not("customer_id", "is", null)
        .not("order_status", "eq", "cancelled")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch orders: " + error.message },
          { status: 500 }
        );
      }

      if (batch && batch.length > 0) {
        allOrders.push(...batch);
        from += pageSize;
        hasMore = batch.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    if (allOrders.length === 0) {
      return NextResponse.json([]);
    }

    // Get unique customer IDs
    const customerIds = Array.from(
      new Set(allOrders.map((o) => o.customer_id).filter(Boolean))
    ) as string[];

    // Batch fetch customers
    const customerMap: Record<
      string,
      {
        first_name: string;
        last_name: string;
        mobile_primary: string;
        whatsapp_number: string | null;
        mobile_secondary_1: string | null;
        mobile_secondary_2: string | null;
        company_name: string | null;
        full_address: string | null;
      }
    > = {};

    const chunkSize = 200;
    for (let i = 0; i < customerIds.length; i += chunkSize) {
      const chunk = customerIds.slice(i, i + chunkSize);
      const { data: custData } = await supabaseServer
        .from("customers")
        .select(
          "id, first_name, last_name, mobile_primary, whatsapp_number, mobile_secondary_1, mobile_secondary_2, company_name, full_address"
        )
        .in("id", chunk);

      if (custData) {
        custData.forEach((c: any) => {
          customerMap[c.id] = c;
        });
      }
    }

    // Fetch collection data from route_assignments (including payment method)
    const orderIds = allOrders.map((o) => o.id);
    const raMap: Record<string, { collected: number; method: string | null }> = {};

    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize);
      const { data: routeData } = await supabaseServer
        .from("route_assignments")
        .select("order_id, collected_amount, collected_payment_method")
        .in("order_id", chunk);

      if (routeData) {
        routeData.forEach((r: any) => {
          const amt = parseFloat(r.collected_amount) || 0;
          const existing = raMap[r.order_id];
          if (existing) {
            existing.collected += amt;
          } else {
            raMap[r.order_id] = { collected: amt, method: r.collected_payment_method };
          }
        });
      }
    }

    // Build response with accurate balance calculation
    // "balance" payment method = credit/pay-later (money NOT actually collected)
    // "cash"/"upi"/"cheque" = actual money collected
    const now = new Date();
    const pendingPayments = allOrders
      .filter((order) => order.customer_id && customerMap[order.customer_id])
      .map((order) => {
        const customer = customerMap[order.customer_id];
        const ra = raMap[order.id];
        const raCollected = ra?.collected || 0;
        const raMethod = ra?.method || null;
        const codCollected = parseFloat(order.cod_collected_amount) || 0;
        const codMethod = order.cod_payment_method || null;

        // Only count as collected if payment method is actual money (not "balance"/credit)
        const actualRaCollected = raMethod && raMethod !== "balance" ? raCollected : 0;
        const actualCodCollected = codMethod && codMethod !== "balance" ? codCollected : 0;
        // They are mutually exclusive (never overlap), so take whichever has a value
        const collected = actualRaCollected || actualCodCollected;
        const balance = (order.total_amount || 0) - collected;
        const orderDate = new Date(order.order_date || order.created_at);
        const daysDiff = Math.floor(
          (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          order_id: order.id,
          order_number: order.order_number,
          customer_id: order.customer_id,
          customer_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
          mobile_primary: customer.mobile_primary || "",
          whatsapp_number: customer.whatsapp_number || null,
          mobile_secondary_1: customer.mobile_secondary_1 || null,
          mobile_secondary_2: customer.mobile_secondary_2 || null,
          company_name: customer.company_name || null,
          full_address: customer.full_address || null,
          total_amount: order.total_amount || 0,
          collected_amount: collected,
          balance_amount: balance,
          order_date: order.order_date || order.created_at,
          days_since_order: daysDiff,
          payment_status: order.payment_status,
          order_status: order.order_status,
          invoice_number_gst: order.invoice_number_gst || null,
          invoice_number_non_gst: order.invoice_number_non_gst || null,
        };
      })
      .filter((p) => p.balance_amount > 0)
      .sort((a, b) => b.days_since_order - a.days_since_order);

    return NextResponse.json(pendingPayments);
  } catch (err: any) {
    console.error("payment-collection API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
