import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Table } from "@/components/ui";
import { ExportCsvButton } from "./ExportCsvButton";
import { SalesTableBody } from "./SalesTableBody";

const STATUS_OPTIONS = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
const PAYMENT_OPTIONS = ["CASH", "UPI", "CARD", "CHEQUE", "PENDING"] as const;

function parseDateBoundary(value: string | undefined, suffix: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}${suffix}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    payment?: string;
    from?: string;
    to?: string;
    amountFrom?: string;
    amountTo?: string;
  }>;
}) {
  const { q, status, payment, from, to, amountFrom, amountTo } = await searchParams;
  const validStatus = STATUS_OPTIONS.find((s) => s === status);
  const validPayment = PAYMENT_OPTIONS.find((p) => p === payment);
  const query = (q ?? "").trim();

  const orders = await prisma.order.findMany({
    where: {
      status: validStatus,
      paymentMethod: validPayment,
      orderDate: {
        gte: parseDateBoundary(from, "T00:00:00"),
        lte: parseDateBoundary(to, "T23:59:59"),
      },
      total: {
        gte: parseAmount(amountFrom),
        lte: parseAmount(amountTo),
      },
      ...(query
        ? {
            OR: [
              { orderNumber: { contains: query, mode: "insensitive" as const } },
              { customer: { name: { contains: query, mode: "insensitive" as const } } },
              { customer: { phone: { contains: query } } },
            ],
          }
        : {}),
    },
    orderBy: { orderDate: "desc" },
    include: { customer: true, items: { include: { product: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-royal">Sales</h1>
          <p className="mt-1 text-sm text-royal-soft">Manage your orders</p>
        </div>
        <div className="flex gap-3">
          <ExportCsvButton
            rows={orders.map((o) => ({
              orderNumber: o.orderNumber,
              customerName: o.customer.name,
              date: o.orderDate.toLocaleDateString("en-IN"),
              status: o.status,
              source: o.source,
              paymentMethod: o.paymentMethod,
              subtotal: o.subtotal,
              gstAmount: o.gstAmount,
              deliveryCharge: o.deliveryCharge,
              total: o.total,
            }))}
          />
          <Link
            href="/sales/new"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep shadow-[0_10px_24px_-10px_rgba(201,162,75,.6)] transition-transform hover:-translate-y-0.5"
          >
            + Create Order
          </Link>
        </div>
      </div>

      <form className="mt-6 space-y-3" action="/sales">
        <input
          type="text"
          name="q"
          placeholder="Search order #, customer name or phone…"
          defaultValue={q ?? ""}
          className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
        />
        <div className="flex flex-wrap gap-3">
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
          <select
            name="payment"
            defaultValue={payment ?? ""}
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            <option value="">All payment methods</option>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
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
          <input
            type="number"
            name="amountFrom"
            placeholder="₹ from"
            defaultValue={amountFrom ?? ""}
            className="w-28 rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          />
          <input
            type="number"
            name="amountTo"
            placeholder="₹ to"
            defaultValue={amountTo ?? ""}
            className="w-28 rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          />
          <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
            Filter
          </button>
          {(q || status || payment || from || to || amountFrom || amountTo) && (
            <Link
              href="/sales"
              className="inline-flex items-center rounded-full border border-royal-soft/30 px-5 py-2.5 text-sm font-semibold text-royal-soft hover:border-gold hover:text-gold-soft"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-2 py-3" aria-label="Expand" />
            <th className="px-4 py-3">Order #</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Address</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Total</th>
          </tr>
        </thead>
        <SalesTableBody
          orders={orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            orderDateLabel: o.orderDate.toLocaleDateString("en-IN"),
            status: o.status,
            source: o.source,
            paymentMethod: o.paymentMethod,
            subtotal: o.subtotal,
            gstAmount: o.gstAmount,
            deliveryCharge: o.deliveryCharge,
            total: o.total,
            customerId: o.customerId,
            customerName: o.customer.name,
            customerPhone: o.customer.phone,
            customerAddress: o.customer.address,
            items: o.items.map((item) => ({
              id: item.id,
              productName: item.product.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          }))}
        />
      </Table>
    </div>
  );
}
