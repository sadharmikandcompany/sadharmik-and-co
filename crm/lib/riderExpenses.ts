import { prisma } from "@/lib/prisma";

export type ExpensePeriod = "today" | "week" | "month";

export function periodStartDate(period: ExpensePeriod, now: Date = new Date()): Date {
  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return start;
}

export interface ExpenseJson {
  id: string;
  amount: number;
  category: string | null;
  notes: string | null;
  expenseDate: string;
}

export async function listExpenses(riderId: string, period: ExpensePeriod): Promise<{ expenses: ExpenseJson[]; total: number }> {
  const rows = await prisma.expense.findMany({
    where: { riderId, expenseDate: { gte: periodStartDate(period) } },
    orderBy: { expenseDate: "desc" },
  });

  const expenses = rows.map((e) => ({
    id: e.id,
    amount: e.amount,
    category: e.category,
    notes: e.notes,
    expenseDate: e.expenseDate.toISOString(),
  }));

  return { expenses, total: expenses.reduce((sum, e) => sum + e.amount, 0) };
}

export async function createExpense(
  riderId: string,
  amount: number,
  category: string | null,
  notes: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Amount must be a positive whole number." };
  }
  await prisma.expense.create({
    data: { riderId, amount, category: category || null, notes: notes || null },
  });
  return { ok: true };
}
