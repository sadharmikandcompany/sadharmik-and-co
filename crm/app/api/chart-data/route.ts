import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const { searchParams } = request.nextUrl;
    const distributorId = searchParams.get("distributor_id");
    const period = searchParams.get("period") || "monthly";

    const lookbackMonths = period === "daily" ? 1 : period === "weekly" ? 3 : 6;
    const startDate = getMonthsAgoISO(lookbackMonths);

    if (distributorId) {
      const allOrders = await fetchAllPages(supabase, (from, to) =>
        supabase
          .from("orders")
          .select("created_at, total_amount, retailers!inner(distributor_id)")
          .eq("retailers.distributor_id", distributorId)
          .gte("created_at", startDate)
          .order("created_at", { ascending: true })
          .range(from, to)
      );

      if ("error" in allOrders) {
        return NextResponse.json({ error: allOrders.error }, { status: 500 });
      }

      const result = period === "daily"
        ? aggregateDaily(allOrders, "created_at")
        : period === "weekly"
        ? aggregateWeekly(allOrders, "created_at")
        : aggregateMonthly(allOrders, "created_at");
      return NextResponse.json(result);
    }

    const allOrders = await fetchAllPages(supabase, (from, to) =>
      supabase
        .from("orders")
        .select("order_date, total_amount")
        .gte("order_date", startDate)
        .order("order_date", { ascending: true })
        .range(from, to)
    );

    if ("error" in allOrders) {
      return NextResponse.json({ error: allOrders.error }, { status: 500 });
    }

    const result = period === "daily"
      ? aggregateDaily(allOrders, "order_date")
      : period === "weekly"
      ? aggregateWeekly(allOrders, "order_date")
      : aggregateMonthly(allOrders, "order_date");
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("monthly-chart API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

async function fetchAllPages(
  _supabase: any,
  queryFn: (from: number, to: number) => any
): Promise<any[] | { error: string }> {
  const pageSize = 1000;
  const allRows: any[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryFn(from, to);

    if (error) return { error: error.message };

    allRows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    page++;
  }

  return allRows;
}

function getMonthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const day = weekStart.getDate();
  const month = weekStart.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
}

function aggregateDaily(
  rows: any[],
  dateField: string
): { month: string; revenue: number; orders: number }[] {
  const dailyMap: Map<string, { label: string; revenue: number; orders: number }> = new Map();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().substring(0, 10);
    const label = `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
    dailyMap.set(key, { label, revenue: 0, orders: 0 });
  }

  rows.forEach((row) => {
    const dateVal = row[dateField];
    if (dateVal) {
      const key = typeof dateVal === "string" ? dateVal.substring(0, 10) : new Date(dateVal).toISOString().substring(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.revenue += parseFloat(String(row.total_amount)) || 0;
        bucket.orders += 1;
      }
    }
  });

  return Array.from(dailyMap.values()).map((val) => ({
    month: val.label,
    revenue: Math.round(val.revenue),
    orders: val.orders,
  }));
}

function aggregateWeekly(
  rows: any[],
  dateField: string
): { month: string; revenue: number; orders: number }[] {
  const weeklyMap: Map<string, { label: string; revenue: number; orders: number }> = new Map();
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const ws = getWeekStart(d);
    const key = ws.toISOString().substring(0, 10);
    if (!weeklyMap.has(key)) {
      weeklyMap.set(key, { label: formatWeekLabel(ws), revenue: 0, orders: 0 });
    }
  }

  rows.forEach((row) => {
    const dateVal = row[dateField];
    if (dateVal) {
      const orderDate = new Date(dateVal);
      const ws = getWeekStart(orderDate);
      const key = ws.toISOString().substring(0, 10);
      const bucket = weeklyMap.get(key);
      if (bucket) {
        bucket.revenue += parseFloat(String(row.total_amount)) || 0;
        bucket.orders += 1;
      }
    }
  });

  return Array.from(weeklyMap.values()).map((val) => ({
    month: val.label,
    revenue: Math.round(val.revenue),
    orders: val.orders,
  }));
}

function aggregateMonthly(
  rows: any[],
  dateField: string
): { month: string; revenue: number; orders: number }[] {
  const monthlyMap: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = { revenue: 0, orders: 0 };
  }

  rows.forEach((row) => {
    const dateVal = row[dateField];
    if (dateVal) {
      const key = dateVal.substring(0, 7);
      if (monthlyMap[key]) {
        monthlyMap[key].revenue += parseFloat(String(row.total_amount)) || 0;
        monthlyMap[key].orders += 1;
      }
    }
  });

  return Object.entries(monthlyMap).map(([key, val]) => {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString("en-US", { month: "short", year: "numeric" });
    return {
      month: monthName,
      revenue: Math.round(val.revenue),
      orders: val.orders,
    };
  });
}
