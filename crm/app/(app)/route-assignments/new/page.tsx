import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listEligibleOrdersForRoute, listAssignedOrders } from "@/lib/routeAssignments";
import { NewRouteAssignmentForm } from "./NewRouteAssignmentForm";

// Always render fresh — this is live business data, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function NewRouteAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const [warehouses, deliveryPartners, orders, assignedOrders] = await Promise.all([
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "DELIVERY_PARTNER", isActive: true }, orderBy: { name: "asc" } }),
    listEligibleOrdersForRoute(),
    listAssignedOrders(),
  ]);

  return (
    <div>
      <Link href="/route-assignments" className="text-sm text-royal-soft hover:text-gold-soft">← All routes</Link>
      <h1 className="mt-2 font-serif text-3xl text-royal">Route Assignments</h1>
      <p className="mt-1 text-sm text-royal-soft">
        Select a warehouse and delivery partner, then choose orders to assign.
      </p>

      <NewRouteAssignmentForm
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        deliveryPartners={deliveryPartners.map((p) => ({ id: p.id, name: p.name }))}
        orders={orders}
        assignedOrders={assignedOrders}
        errorMessage={error}
      />
    </div>
  );
}
