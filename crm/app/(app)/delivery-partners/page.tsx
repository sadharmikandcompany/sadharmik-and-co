import { prisma } from "@/lib/prisma";
import { Table } from "@/components/ui";

export default async function DeliveryPartnersPage() {
  const partners = await prisma.user.findMany({
    where: { role: "DELIVERY_PARTNER", isActive: true },
    include: { deliveries: { include: { customer: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-royal">Delivery Partners</h1>
      </div>
      <p className="mt-1 mb-6 text-sm text-royal-soft">View active delivery partners and their assigned orders.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {partners.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-royal-soft/20 p-5 shadow-sm">
            <h2 className="font-semibold text-lg text-royal">{p.name}</h2>
            <p className="text-sm text-royal-soft mb-4">{p.phone}</p>
            
            <h3 className="text-sm font-medium text-ink mb-2">Current Assignments ({p.deliveries.length})</h3>
            {p.deliveries.length > 0 ? (
              <ul className="space-y-2">
                {p.deliveries.map(d => (
                  <li key={d.id} className="text-sm p-2 bg-cream rounded-lg flex justify-between items-center">
                    <span><span className="font-mono text-royal-soft text-xs">{d.orderNumber}</span> - {d.customer.firstName} {d.customer.lastName}</span>
                    <span className="text-xs bg-gold-soft/20 text-royal px-2 py-0.5 rounded-full">{d.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-royal-soft/70 italic">No active deliveries</p>
            )}
          </div>
        ))}
        {partners.length === 0 && (
          <div className="col-span-full py-10 text-center text-royal-soft bg-white/50 rounded-xl border border-dashed border-royal-soft/30">
            No delivery partners found. Add them in the Users page.
          </div>
        )}
      </div>
    </div>
  );
}
