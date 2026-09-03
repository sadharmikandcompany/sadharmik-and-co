import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { updateOrderStatus, updateOrderPaymentMethod, assignDeliveryPartner } from "../actions";

const STATUS_OPTIONS = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"] as const;
const PAYMENT_OPTIONS = ["PENDING", "CASH", "UPI", "CARD", "CHEQUE"] as const;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, deliveryPartners] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: true } } },
    }),
    prisma.user.findMany({
      where: { role: "DELIVERY_PARTNER", isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!order) notFound();

  return (
    <div>
      <Link href="/sales" className="text-sm text-royal-soft hover:text-gold-soft">← All sales</Link>
      <h1 className="mt-2 font-serif text-3xl text-royal">{order.orderNumber}</h1>
      <p className="mt-1 text-sm text-royal-soft">
        {order.customer.firstName} {order.customer.lastName} · {order.orderDate.toLocaleDateString("en-IN")} · {order.source.replace(/_/g, " ")} · {order.paymentMethod}
      </p>

      <Card className="mt-6 max-w-md">
        <ul className="space-y-1 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>{item.product.name} × {item.quantity}</span>
              <span>₹{item.unitPrice * item.quantity}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-royal-soft/15 pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
          <div className="flex justify-between"><span>GST</span><span>{order.gstAmount === 0 ? "₹0" : `₹${order.gstAmount}`}</span></div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{order.deliveryCharge === 0 ? "Free" : `₹${order.deliveryCharge}`}</span>
          </div>
          <div className="flex justify-between font-semibold text-royal"><span>Total</span><span>₹{order.total}</span></div>
        </div>
        {order.notes && (
          <div className="mt-3 border-t border-royal-soft/15 pt-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Notes</p>
            <p className="mt-1 text-ink">{order.notes}</p>
          </div>
        )}
        {order.deliveryNotes && (
          <div className="mt-3 border-t border-royal-soft/15 pt-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Delivery notes</p>
            <p className="mt-1 text-ink">{order.deliveryNotes}</p>
          </div>
        )}
      </Card>

      <Card className="mt-6 max-w-md">
        <h2 className="font-serif text-lg text-royal">Status</h2>
        <form action={updateOrderStatus} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="id" value={order.id} />
          <select
            name="status"
            defaultValue={order.status}
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
            Update
          </button>
        </form>
      </Card>

      <Card className="mt-6 max-w-md">
        <h2 className="font-serif text-lg text-royal">Delivery partner</h2>
        <p className="mt-1 text-xs text-royal-soft">Who's delivering this order — shows up in their app once assigned.</p>
        <form action={assignDeliveryPartner} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="id" value={order.id} />
          <select
            name="deliveryPartnerId"
            defaultValue={order.deliveryPartnerId ?? ""}
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            <option value="">Unassigned</option>
            {deliveryPartners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
            Assign
          </button>
        </form>
      </Card>

      <Card className="mt-6 max-w-md">
        <h2 className="font-serif text-lg text-royal">Payment</h2>
        <p className="mt-1 text-xs text-royal-soft">Update this once payment is actually collected.</p>
        <form action={updateOrderPaymentMethod} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="id" value={order.id} />
          <select
            name="paymentMethod"
            defaultValue={order.paymentMethod}
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p} value={p}>{p === "PENDING" ? "Pending / COD" : p}</option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
            Update
          </button>
        </form>
      </Card>
    </div>
  );
}
