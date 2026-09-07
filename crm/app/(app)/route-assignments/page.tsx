import Link from "next/link";
import { listRouteAssignments } from "@/lib/routeAssignments";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700 border border-gray-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border border-emerald-200",
};

export default async function RouteAssignmentsPage() {
  const routes = await listRouteAssignments();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-royal">Route Assignments</h1>
          <p className="mt-1 text-sm text-royal-soft">
            Group orders by warehouse into a route, then print a combined delivery sheet.
          </p>
        </div>
        <Link
          href="/route-assignments/new"
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep"
        >
          + New Route Assignment
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-royal-soft/15 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
              <th className="px-4 py-3">Route #</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Delivery Partner</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-royal-soft">
                  No route assignments yet.
                </td>
              </tr>
            ) : (
              routes.map((r) => (
                <tr key={r.id} className="border-b border-royal-soft/10 last:border-0 hover:bg-ivory/60">
                  <td className="px-4 py-3">
                    <Link href={`/route-assignments/${r.id}`} className="font-semibold text-royal hover:text-gold-soft">
                      Route #{r.routeNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.warehouseName}</td>
                  <td className="px-4 py-3">{r.deliveryPartnerName ?? <span className="text-royal-soft">Unassigned</span>}</td>
                  <td className="px-4 py-3">{r.orderCount}</td>
                  <td className="px-4 py-3">₹{r.totalAmount}</td>
                  <td className="px-4 py-3">{r.createdAtLabel}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? ""}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
