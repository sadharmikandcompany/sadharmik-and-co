import { prisma } from "@/lib/prisma";

export interface DashboardSummaryJson {
  totalAssigned: number;
  pickedUp: number;
  delivered: number;
  failed: number;
  todaysCollectionsTotal: number;
  totalDeliveries: number;
  rating: number | null;
}

export function buildDashboardSummary(
  counts: { assigned: number; pickedUp: number; delivered: number; failed: number },
  todaysCollectionsTotal: number,
  totalDeliveries: number,
  rating: number | null
): DashboardSummaryJson {
  return {
    totalAssigned: counts.assigned,
    pickedUp: counts.pickedUp,
    delivered: counts.delivered,
    failed: counts.failed,
    todaysCollectionsTotal,
    totalDeliveries,
    rating,
  };
}

export async function getDashboardSummary(riderId: string): Promise<DashboardSummaryJson> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [assigned, pickedUp, deliveredToday, failedToday, totalDeliveries, rider] = await Promise.all([
    prisma.order.count({ where: { deliveryPartnerId: riderId, status: "OUT_FOR_DELIVERY" } }),
    prisma.order.count({ where: { deliveryPartnerId: riderId, status: "PICKED_UP" } }),
    prisma.order.findMany({
      where: { deliveryPartnerId: riderId, status: "DELIVERED", updatedAt: { gte: startOfToday } },
      select: { total: true },
    }),
    prisma.order.count({
      where: { deliveryPartnerId: riderId, status: "FAILED", updatedAt: { gte: startOfToday } },
    }),
    prisma.order.count({ where: { deliveryPartnerId: riderId, status: "DELIVERED" } }),
    prisma.user.findUnique({ where: { id: riderId }, select: { rating: true } }),
  ]);

  const todaysCollectionsTotal = deliveredToday.reduce((sum, o) => sum + o.total, 0);

  return buildDashboardSummary(
    { assigned, pickedUp, delivered: deliveredToday.length, failed: failedToday },
    todaysCollectionsTotal,
    totalDeliveries,
    rider?.rating ?? null
  );
}
