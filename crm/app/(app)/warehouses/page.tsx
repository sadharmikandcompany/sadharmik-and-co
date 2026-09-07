import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { createWarehouse, toggleWarehouseActive } from "./actions";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { routeAssignments: true } } },
  });

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Warehouses</h1>
      <p className="mt-1 text-sm text-royal-soft">
        Where routes dispatch from. Add warehouses here, then pick one when creating a Route Assignment.
      </p>

      <Card className="mt-6 max-w-xl">
        <h2 className="font-serif text-lg text-royal">Add Warehouse</h2>
        <form action={createWarehouse} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Warehouse name"
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold sm:col-span-1"
          />
          <input
            name="address"
            placeholder="Address (optional)"
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold sm:col-span-1"
          />
          <button
            type="submit"
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep sm:col-span-2 sm:w-fit"
          >
            Add Warehouse
          </button>
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {warehouses.length === 0 ? (
          <p className="text-sm text-royal-soft">No warehouses yet — add one above.</p>
        ) : (
          warehouses.map((w) => (
            <Card key={w.id} className="flex items-center justify-between max-w-xl">
              <div>
                <p className="font-semibold text-royal">
                  {w.name}
                  {!w.isActive && <span className="ml-2 text-xs font-normal text-red-500">(inactive)</span>}
                </p>
                {w.address && <p className="text-xs text-royal-soft">{w.address}</p>}
                <p className="mt-0.5 text-[11px] text-royal-soft">
                  {w._count.routeAssignments} route{w._count.routeAssignments === 1 ? "" : "s"}
                </p>
              </div>
              <form action={toggleWarehouseActive}>
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="isActive" value={String(w.isActive)} />
                <button type="submit" className="rounded-full border border-royal-soft/30 px-4 py-2 text-xs font-semibold text-royal-deep hover:bg-slate-50">
                  {w.isActive ? "Deactivate" : "Activate"}
                </button>
              </form>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
