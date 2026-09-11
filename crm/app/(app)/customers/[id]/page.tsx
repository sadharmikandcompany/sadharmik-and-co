import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { customerCodeLabel, customerDisplayCode } from "@/lib/customerCode";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { orderDate: "desc" },
        include: { items: { include: { product: true } } },
      },
    },
  });

  if (!customer) notFound();

  const lifetimeTotal = customer.orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div>
      <Link href="/customers" className="text-sm text-royal-soft hover:text-gold-soft">← All customers</Link>
      <h1 className="mt-2 font-serif text-3xl text-royal">{customer.firstName} {customer.lastName}</h1>
      <p className="mt-1 text-sm font-mono font-bold text-gold-soft">{customerCodeLabel(customer)}: {customerDisplayCode(customer)}</p>
      <p className="mt-1 text-sm text-royal-soft">{customer.mobilePrimary} · {customer.shippingAddress}</p>

      <Card className="mt-6 max-w-xs">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Lifetime spend</p>
        <p className="mt-2 font-serif text-3xl text-royal">₹{lifetimeTotal}</p>
      </Card>

      <h2 className="mt-8 font-serif text-xl text-royal">Order history</h2>
      {customer.orders.length === 0 ? (
        <p className="mt-3 text-sm text-royal-soft">No orders yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {customer.orders.map((o) => (
            <Card key={o.id}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-royal">{o.orderNumber}</p>
                <p className="font-serif text-lg text-gold-soft">₹{o.total}</p>
              </div>
              <p className="mt-1 text-xs text-royal-soft">
                {o.orderDate.toLocaleDateString("en-IN")} · {o.status.replace(/_/g, " ")}
              </p>
              <ul className="mt-2 text-sm text-ink">
                {o.items.map((item) => (
                  <li key={item.id}>{item.product.name} × {item.quantity}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
