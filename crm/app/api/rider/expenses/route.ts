import { NextResponse } from "next/server"
import { getSupabaseAdmin, getRiderIdFromRequest, CORS_HEADERS } from "@/lib/rider-auth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function periodStart(period: string): string {
  const now = new Date()
  if (period === "week") {
    now.setDate(now.getDate() - 7)
  } else if (period === "month") {
    now.setMonth(now.getMonth() - 1)
  } else {
    now.setHours(0, 0, 0, 0)
  }
  return now.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const riderId = getRiderIdFromRequest(request)
  if (!riderId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") || "today"

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("rider_expenses")
    .select("id, amount, category, notes, expense_date")
    .eq("delivery_partner_id", riderId)
    .gte("expense_date", periodStart(period))
    .order("expense_date", { ascending: false })

  if (error) {
    console.error("Error fetching rider expenses:", error)
    return NextResponse.json({ ok: false, error: "Could not load expenses." }, { status: 500, headers: CORS_HEADERS })
  }

  const expenses = (data || []).map((e) => ({
    id: e.id,
    amount: e.amount,
    category: e.category,
    notes: e.notes,
    expenseDate: e.expense_date,
  }))
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return NextResponse.json({ ok: true, expenses, total }, { headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  const riderId = getRiderIdFromRequest(request)
  if (!riderId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }

  const { amount, category, notes } = await request.json().catch(() => ({}))
  const parsedAmount = parseFloat(amount)
  if (!parsedAmount || parsedAmount <= 0) {
    return NextResponse.json({ ok: false, error: "A valid amount is required." }, { status: 400, headers: CORS_HEADERS })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from("rider_expenses").insert([
    {
      delivery_partner_id: riderId,
      amount: parsedAmount,
      category: category || null,
      notes: notes || null,
    },
  ])

  if (error) {
    console.error("Error creating rider expense:", error)
    return NextResponse.json({ ok: false, error: "Could not save the expense." }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
}
