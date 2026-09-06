"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createRouteAssignment as createRouteAssignmentRecord } from "@/lib/routeAssignments";

const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

export async function createRouteAssignmentAction(formData: FormData) {
  const warehouseId = String(formData.get("warehouseId") ?? "");
  const deliveryPartnerId = String(formData.get("deliveryPartnerId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const orderIds = formData.getAll("orderIds").map(String);

  const result = await createRouteAssignmentRecord(warehouseId, orderIds, deliveryPartnerId, notes);

  revalidatePath("/route-assignments");
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  if (!result.ok) {
    // Surfaced as a query param since this is a plain <form action> with no
    // client state to hold an inline error message.
    redirect(`/route-assignments/new?error=${encodeURIComponent(result.error ?? "Could not create the route.")}`);
  }
  redirect(`/route-assignments/${result.routeId}`);
}

export async function updateRouteStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) throw new Error("Missing route id.");
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) throw new Error("Invalid status.");

  await prisma.routeAssignment.update({ where: { id }, data: { status: status as (typeof VALID_STATUSES)[number] } });
  revalidatePath("/route-assignments");
  revalidatePath(`/route-assignments/${id}`);
}

export async function assignRouteDeliveryPartner(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const deliveryPartnerId = String(formData.get("deliveryPartnerId") ?? "");
  if (!id) throw new Error("Missing route id.");

  await prisma.$transaction(async (tx) => {
    await tx.routeAssignment.update({ where: { id }, data: { deliveryPartnerId: deliveryPartnerId || null } });

    // A route's driver is also every one of its orders' driver — the rider
    // app only ever looks at Order.deliveryPartnerId, never the route.
    const orders = await tx.order.findMany({ where: { routeAssignmentId: id }, select: { id: true, status: true } });
    if (orders.length === 0) return;

    await tx.order.updateMany({
      where: { routeAssignmentId: id },
      data: { deliveryPartnerId: deliveryPartnerId || null },
    });

    if (deliveryPartnerId) {
      const idsToBump = orders.filter((o) => ["NEW", "ROASTING"].includes(o.status)).map((o) => o.id);
      if (idsToBump.length > 0) {
        await tx.order.updateMany({ where: { id: { in: idsToBump } }, data: { status: "OUT_FOR_DELIVERY" } });
      }
    }
  });

  revalidatePath("/route-assignments");
  revalidatePath(`/route-assignments/${id}`);
  revalidatePath("/sales");
  revalidatePath("/dashboard");
}

/** Takes an order back off a route so it's eligible for a different one. */
export async function removeOrderFromRoute(formData: FormData) {
  const routeId = String(formData.get("routeId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  if (!routeId || !orderId) throw new Error("Missing route or order id.");

  await prisma.order.update({ where: { id: orderId }, data: { routeAssignmentId: null } });
  revalidatePath("/route-assignments");
  revalidatePath(`/route-assignments/${routeId}`);
  revalidatePath("/sales");
}

export async function deleteRouteAssignment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing route id.");

  await prisma.$transaction([
    prisma.order.updateMany({ where: { routeAssignmentId: id }, data: { routeAssignmentId: null } }),
    prisma.routeAssignment.delete({ where: { id } }),
  ]);

  revalidatePath("/route-assignments");
  revalidatePath("/sales");
  redirect("/route-assignments");
}
