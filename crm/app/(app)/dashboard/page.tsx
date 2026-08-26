import { prisma } from "@/lib/prisma";
import { Card, StatCard, Badge } from "@/components/ui";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday-start week
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff));
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function salesSince(date: Date) {
  const orders = await prisma.order.findMany({ where: { orderDate: { gte: date } } });
  return {
    total: orders.reduce((sum, o) => sum + o.total, 0),
    count: orders.length,
  };
}

export default async function DashboardPage() {
  const now = new Date();
  const [today, week, month, lowStock, recentOrders] = await Promise.all([
    salesSince(startOfDay(now)),
    salesSince(startOfWeek(now)),
    salesSince(startOfMonth(now)),
    prisma.product.findMany({ where: { isActive: true, stock: { lt: 5 } }, orderBy: { stock: "asc" } }),
    prisma.order.findMany({ orderBy: { orderDate: "desc" }, take: 8, include: { customer: true } }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Dashboard</h1>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Today" value={`₹${today.total}`} hint={`${today.count} orders`} />
        <StatCard label="This week" value={`₹${week.total}`} hint={`${week.count} orders`} />
        <StatCard label="This month" value={`₹${month.total}`} hint={`${month.count} orders`} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-xl text-royal">Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-royal-soft">Everything is well stocked.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <Badge tone="warning">{p.stock} left</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-serif text-xl text-royal">Recent orders</h2>
          {recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-royal-soft">No orders yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span>{o.orderNumber} · {o.customer.name}</span>
                  <span className="font-semibold text-royal">₹{o.total}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
