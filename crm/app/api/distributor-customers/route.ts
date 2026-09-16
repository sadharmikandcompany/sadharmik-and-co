import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getGodownIds(supabase: ReturnType<typeof getSupabaseServer>, distributorId: string): Promise<string[]> {
  const { data } = await supabase
    .from("godowns")
    .select("id")
    .eq("distributor_id", distributorId)
    .eq("is_active", true);
  return (data || []).map((g: any) => g.id);
}

async function getDistributorScope(
  supabase: ReturnType<typeof getSupabaseServer>,
  distributorId: string
): Promise<{ isSubDistributor: boolean; serviceablePincodes: string[] }> {
  const { data } = await supabase
    .from("distributors")
    .select("parent_id, serviceable_pincodes")
    .eq("id", distributorId)
    .single();
  return {
    isSubDistributor: !!data?.parent_id,
    serviceablePincodes: data?.serviceable_pincodes || [],
  };
}

// Get customer IDs via godowns (main distributors)
async function getCustomerIdsByGodowns(supabase: ReturnType<typeof getSupabaseServer>, godownIds: string[]): Promise<string[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("customer_id")
    .in("source_godown_id", godownIds)
    .not("customer_id", "is", null);

  if (error) throw error;
  return [...new Set((data || []).map(o => o.customer_id).filter(Boolean))];
}

// Get customer IDs via serviceable pincodes (sub-distributors)
async function getCustomerIdsByPincodes(supabase: ReturnType<typeof getSupabaseServer>, pincodes: string[]): Promise<string[]> {
  // Fetch in batches of 100 pincodes to avoid URL limit
  const allCustomerIds: string[] = [];
  for (let i = 0; i < pincodes.length; i += 100) {
    const batch = pincodes.slice(i, i + 100);
    const { data, error } = await supabase
      .from("orders")
      .select("customer_id")
      .in("shipping_pincode", batch)
      .not("customer_id", "is", null);

    if (error) throw error;
    (data || []).forEach(o => {
      if (o.customer_id) allCustomerIds.push(o.customer_id);
    });
  }
  return [...new Set(allCustomerIds)];
}

// Get customer IDs via retailer_id (retailers)
async function getCustomerIdsByRetailer(supabase: ReturnType<typeof getSupabaseServer>, retailerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("customer_id")
    .eq("retailer_id", retailerId)
    .not("customer_id", "is", null);

  if (error) throw error;
  return [...new Set((data || []).map(o => o.customer_id).filter(Boolean))];
}

// Build order stats query filter
function buildOrderStatsQuery(
  supabase: ReturnType<typeof getSupabaseServer>,
  godownIds: string[],
  pincodes: string[],
  retailerId: string | null,
  pageIds: string[]
) {
  // Retailer scoping takes precedence, then godowns, then pincodes
  if (retailerId) {
    return supabase
      .from("orders")
      .select("customer_id, total_amount, created_at")
      .eq("retailer_id", retailerId)
      .in("customer_id", pageIds);
  }
  if (godownIds.length > 0) {
    return supabase
      .from("orders")
      .select("customer_id, total_amount, created_at")
      .in("source_godown_id", godownIds)
      .in("customer_id", pageIds);
  }
  return supabase
    .from("orders")
    .select("customer_id, total_amount, created_at")
    .in("shipping_pincode", pincodes)
    .in("customer_id", pageIds);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const { searchParams } = request.nextUrl;
    const distributorId = searchParams.get("distributor_id");
    const retailerId = searchParams.get("retailer_id");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "0", 10);
    const pageSize = parseInt(searchParams.get("page_size") || "20", 10);

    if (!distributorId && !retailerId) {
      return NextResponse.json({ error: "distributor_id or retailer_id is required" }, { status: 400 });
    }

    let godownIds: string[] = [];
    let pincodes: string[] = [];
    let allCustomerIds: string[];

    if (retailerId) {
      // Retailer: scope by orders.retailer_id
      allCustomerIds = await getCustomerIdsByRetailer(supabase, retailerId);
    } else {
      // Distributor: pick branch by parent_id, not by godown presence —
      // sub-distributors can have godowns attached but their orders are matched by shipping pincode.
      const { isSubDistributor, serviceablePincodes } = await getDistributorScope(supabase, distributorId!);
      if (isSubDistributor) {
        pincodes = serviceablePincodes;
        if (pincodes.length === 0) {
          return NextResponse.json({ customers: [], total: 0 });
        }
        allCustomerIds = await getCustomerIdsByPincodes(supabase, pincodes);
      } else {
        godownIds = await getGodownIds(supabase, distributorId!);
        if (godownIds.length === 0) {
          return NextResponse.json({ customers: [], total: 0 });
        }
        allCustomerIds = await getCustomerIdsByGodowns(supabase, godownIds);
      }
    }

    if (allCustomerIds.length === 0) {
      return NextResponse.json({ customers: [], total: 0 });
    }

    // Fetch customer details in batches of 500
    let allCustomers: any[] = [];
    for (let i = 0; i < allCustomerIds.length; i += 500) {
      const batch = allCustomerIds.slice(i, i + 500);
      let query = supabase
        .from("customers")
        .select("id, first_name, last_name, mobile_primary, email, shipping_city, shipping_pincode, is_active")
        .in("id", batch);

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,mobile_primary.ilike.%${search}%,shipping_city.ilike.%${search}%`
        );
      }

      const { data } = await query;
      if (data) allCustomers.push(...data);
    }

    // Sort and paginate
    allCustomers.sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
    const filteredTotal = allCustomers.length;
    const offset = page * pageSize;
    const pageCustomers = allCustomers.slice(offset, offset + pageSize);

    if (pageCustomers.length === 0) {
      return NextResponse.json({ customers: [], total: filteredTotal });
    }

    // Get order stats for this page of customers
    const pageIds = pageCustomers.map((c: any) => c.id);
    const { data: statsData } = await buildOrderStatsQuery(supabase, godownIds, pincodes, retailerId, pageIds);

    // Aggregate stats per customer
    const statsMap = new Map<string, { total_orders: number; total_spent: number; last_order: string | null }>();
    (statsData || []).forEach((o: any) => {
      const existing = statsMap.get(o.customer_id) || { total_orders: 0, total_spent: 0, last_order: null };
      existing.total_orders++;
      existing.total_spent += parseFloat(o.total_amount) || 0;
      if (!existing.last_order || o.created_at > existing.last_order) {
        existing.last_order = o.created_at;
      }
      statsMap.set(o.customer_id, existing);
    });

    const customers = pageCustomers.map((c: any) => {
      const stats = statsMap.get(c.id) || { total_orders: 0, total_spent: 0, last_order: null };
      return { ...c, ...stats };
    });

    return NextResponse.json({ customers, total: filteredTotal });
  } catch (error: any) {
    console.error("Error in distributor-customers API:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
