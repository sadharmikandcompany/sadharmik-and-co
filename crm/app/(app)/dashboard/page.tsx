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

async function getBusinessMetrics() {
  const [orders, purchases] = await Promise.all([
    prisma.order.findMany(),
    prisma.purchase.findMany()
  ]);

  const totalIncome = orders.reduce((sum, o) => sum + o.amountPaid, 0);
  
  const purchasesTotalValue = purchases.reduce((sum, p) => sum + p.total, 0);
  const purchasesCount = purchases.length;

  const debtorsAmount = orders.reduce((sum, o) => sum + Math.max(0, o.total - o.amountPaid), 0);
  const creditorsAmount = purchases.reduce((sum, p) => sum + Math.max(0, p.total - p.amountPaid), 0);

  return { totalIncome, purchasesTotalValue, purchasesCount, debtorsAmount, creditorsAmount };
}

export default async function DashboardPage() {
  const now = new Date();
  const [today, week, month, metrics, lowStock, recentOrders] = await Promise.all([
    salesSince(startOfDay(now)),
    salesSince(startOfWeek(now)),
    salesSince(startOfMonth(now)),
    getBusinessMetrics(),
    prisma.product.findMany({ where: { isActive: true, stock: { lt: 5 } }, orderBy: { stock: "asc" } }),
    prisma.order.findMany({ orderBy: { orderDate: "desc" }, take: 8, include: { customer: true } }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Dashboard</h1>
      
      <div className="mt-8">
        <h2 className="font-serif text-xl text-royal mb-4">Business Metrics</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Income" value={`₹${metrics.totalIncome}`} hint="All received payments" />
          <StatCard label="Purchases" value={`₹${metrics.purchasesTotalValue}`} hint={`${metrics.purchasesCount} total purchases`} />
          <StatCard label="Debtors (Owed to us)" value={`₹${metrics.debtorsAmount}`} hint="Unpaid order balances" />
          <StatCard label="Creditors (We owe)" value={`₹${metrics.creditorsAmount}`} hint="Unpaid purchase balances" />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-serif text-xl text-royal mb-4">Sales Overview</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatCard label="Today" value={`₹${today.total}`} hint={`${today.count} orders`} />
          <StatCard label="This week" value={`₹${week.total}`} hint={`${week.count} orders`} />
          <StatCard label="This month" value={`₹${month.total}`} hint={`${month.count} orders`} />
        </div>
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
                  <span>{o.orderNumber} · {o.customer.firstName} {o.customer.lastName}</span>
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
