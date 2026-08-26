import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Table } from "@/components/ui";

const STATUS_OPTIONS = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
}) {
  const { status, from, to } = await searchParams;
  const validStatus = STATUS_OPTIONS.find((s) => s === status);

  const orders = await prisma.order.findMany({
    where: {
      status: validStatus,
      orderDate: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(`${to}T23:59:59`) : undefined,
      },
    },
    orderBy: { orderDate: "desc" },
    include: { customer: true },
  });

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Sales</h1>

      <form className="mt-6 flex flex-wrap gap-3" action="/sales">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        />
        <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
          Filter
        </button>
      </form>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Order #</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-royal-soft/10 last:border-0">
              <td className="px-4 py-3">
                <Link href={`/sales/${o.id}`} className="font-semibold text-royal hover:text-gold-soft">
                  {o.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3">{o.customer.name}</td>
              <td className="px-4 py-3">{o.orderDate.toLocaleDateString("en-IN")}</td>
              <td className="px-4 py-3">{o.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">₹{o.total}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-royal-soft">No orders match these filters.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
