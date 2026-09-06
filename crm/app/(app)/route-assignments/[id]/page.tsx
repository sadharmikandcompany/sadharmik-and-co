import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRouteManifest } from "@/lib/routeAssignments";
import { Card } from "@/components/ui";
import {
  updateRouteStatus,
  assignRouteDeliveryPartner,
  removeOrderFromRoute,
  deleteRouteAssignment,
} from "../actions";

const STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

export default async function RouteAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [manifest, deliveryPartners] = await Promise.all([
    getRouteManifest(id),
    prisma.user.findMany({ where: { role: "DELIVERY_PARTNER", isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!manifest) notFound();

  return (
    <div>
      <Link href="/route-assignments" className="text-sm text-royal-soft hover:text-gold-soft">← All routes</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-royal">Route #{manifest.routeNumber}</h1>
          <p className="mt-1 text-sm text-royal-soft">
            {manifest.warehouseName} · {manifest.totalOrders} orders · created {manifest.createdAtLabel}
          </p>
        </div>
        <Link
          href={`/route-assignments/${manifest.id}/sheet`}
          target="_blank"
          className="rounded-full bg-royal-deep px-5 py-2.5 text-sm font-semibold text-white hover:bg-royal"
        >
          Print Delivery Sheet
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="font-serif text-lg text-royal">Orders ({manifest.totalOrders})</h2>
            <div className="mt-3 divide-y divide-royal-soft/10">
              {manifest.orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <Link href={`/sales/${o.id}`} className="font-semibold text-royal hover:text-gold-soft">
                      {o.orderNumber}
                    </Link>
                    <p className="text-xs text-royal-soft">
                      {o.customerName} · {o.customerAddress}
                    </p>
                    <p className="text-xs text-royal-soft">{o.items.map((i) => `${i.productName} x${i.quantity}`).join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-royal">₹{o.total}</span>
                    <form action={removeOrderFromRoute}>
                      <input type="hidden" name="routeId" value={manifest.id} />
                      <input type="hidden" name="orderId" value={o.id} />
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700">Unassign</button>
                    </form>
                  </div>
                </div>
              ))}
              {manifest.orders.length === 0 && (
                <p className="py-4 text-sm text-royal-soft">No orders left on this route.</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-serif text-lg text-royal">Product totals</h2>
            <p className="mt-1 text-xs text-royal-soft">What to load for this whole route.</p>
            <ul className="mt-3 space-y-1 text-sm">
              {manifest.productTotals.map((p) => (
                <li key={p.productName} className="flex justify-between">
                  <span>{p.productName}</span>
                  <span className="font-semibold text-royal">{p.totalQuantity}</span>
                </li>
              ))}
              {manifest.productTotals.length === 0 && <p className="text-royal-soft">Nothing to load.</p>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-serif text-lg text-royal">Status</h2>
            <form action={updateRouteStatus} className="mt-3 flex items-center gap-3">
              <input type="hidden" name="id" value={manifest.id} />
              <select name="status" defaultValue={manifest.status} className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
              <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">Update</button>
            </form>
          </Card>

          <Card>
            <h2 className="font-serif text-lg text-royal">Delivery partner</h2>
            <form action={assignRouteDeliveryPartner} className="mt-3 flex items-center gap-3">
              <input type="hidden" name="id" value={manifest.id} />
              <select
                name="deliveryPartnerId"
                defaultValue=""
                className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
              >
                <option value="">Unassigned</option>
                {deliveryPartners.map((p) => (
                  <option key={p.id} value={p.id} selected={manifest.deliveryPartnerName === p.name}>{p.name}</option>
                ))}
              </select>
              <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">Assign</button>
            </form>
          </Card>

          <Card>
            <h2 className="font-serif text-lg text-royal">Summary</h2>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Total items</span><span>{manifest.totalItems}</span></div>
              <div className="flex justify-between"><span>Total amount</span><span>₹{manifest.totalAmount}</span></div>
              <div className="flex justify-between"><span>Cash/COD to collect</span><span>₹{manifest.totalCod}</span></div>
            </div>
            {manifest.notes && (
              <div className="mt-3 border-t border-royal-soft/15 pt-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Notes</p>
                <p className="mt-1 text-ink">{manifest.notes}</p>
              </div>
            )}
          </Card>

          <form action={deleteRouteAssignment}>
            <input type="hidden" name="id" value={manifest.id} />
            <button type="submit" className="w-full rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
              Delete Route
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
