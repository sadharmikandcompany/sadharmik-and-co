import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { createExpense, listExpenses, type ExpensePeriod } from "@/lib/riderExpenses";

const VALID_PERIODS: ExpensePeriod[] = ["today", "week", "month"];

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const periodParam = request.nextUrl.searchParams.get("period");
  const period = VALID_PERIODS.find((p) => p === periodParam);
  if (!period) {
    return NextResponse.json({ ok: false, error: "period must be today, week, or month." }, { status: 400 });
  }

  const result = await listExpenses(rider.id, period);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let body: { amount?: number; category?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const result = await createExpense(
    rider.id,
    Math.round(Number(body.amount)),
    body.category ? String(body.category) : null,
    body.notes ? String(body.notes) : null
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
