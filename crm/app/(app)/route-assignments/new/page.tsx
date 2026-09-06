import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listEligibleOrdersForRoute } from "@/lib/routeAssignments";
import { NewRouteAssignmentForm } from "./NewRouteAssignmentForm";

export default async function NewRouteAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const [warehouses, deliveryPartners, orders] = await Promise.all([
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "DELIVERY_PARTNER", isActive: true }, orderBy: { name: "asc" } }),
    listEligibleOrdersForRoute(),
  ]);

  return (
    <div>
      <Link href="/route-assignments" className="text-sm text-royal-soft hover:text-gold-soft">← All routes</Link>
      <h1 className="mt-2 font-serif text-3xl text-royal">New Route Assignment</h1>
      <p className="mt-1 text-sm text-royal-soft">
        Pick a warehouse and the orders dispatching from it — you can print a combined delivery sheet afterwards.
      </p>

      <NewRouteAssignmentForm
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        deliveryPartners={deliveryPartners.map((p) => ({ id: p.id, name: p.name }))}
        orders={orders}
        errorMessage={error}
      />
    </div>
  );
}
