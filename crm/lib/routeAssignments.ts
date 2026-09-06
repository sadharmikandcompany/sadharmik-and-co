import { prisma } from "@/lib/prisma";

// Orders that still make sense to load onto a route — anything already
// delivered, cancelled, or failed has nothing left to dispatch.
const ELIGIBLE_STATUSES = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "PICKED_UP", "RESCHEDULED"] as const;

export interface EligibleOrderRow {
  id: string;
  orderNumber: string;
  orderDateLabel: string;
  status: string;
  paymentMethod: string;
  total: number;
  customerName: string;
  customerAddress: string;
  itemsSummary: string;
}

/** Orders not yet on any route, available to add to a new/existing one. */
export async function listEligibleOrdersForRoute(): Promise<EligibleOrderRow[]> {
  const orders = await prisma.order.findMany({
    where: { routeAssignmentId: null, status: { in: [...ELIGIBLE_STATUSES] } },
    orderBy: { orderDate: "desc" },
    include: { customer: true, items: { include: { product: true } } },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    orderDateLabel: o.orderDate.toLocaleDateString("en-IN"),
    status: o.status,
    paymentMethod: o.paymentMethod,
    total: o.total,
    customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
    customerAddress: o.customer.shippingAddress,
    itemsSummary: o.items.map((i) => `${i.product.name} x${i.quantity}`).join(", "),
  }));
}

export interface CreateRouteAssignmentResult {
  ok: boolean;
  error?: string;
  routeId?: string;
}

export async function createRouteAssignment(
  warehouseId: string,
  orderIds: string[],
  deliveryPartnerId?: string,
  notes?: string
): Promise<CreateRouteAssignmentResult> {
  if (!warehouseId) return { ok: false, error: "Select a warehouse first." };
  if (orderIds.length === 0) return { ok: false, error: "Select at least one order." };

  try {
    const routeId = await prisma.$transaction(async (tx) => {
      // Guard against an order that got claimed by another route between
      // the page loading and this submit.
      const stillEligible = await tx.order.findMany({
        where: { id: { in: orderIds }, routeAssignmentId: null },
        select: { id: true },
      });
      if (stillEligible.length !== orderIds.length) {
        throw new Error("One or more selected orders are already on another route. Refresh and try again.");
      }

      const route = await tx.routeAssignment.create({
        data: {
          warehouseId,
          deliveryPartnerId: deliveryPartnerId || null,
          notes: notes?.trim() || null,
        },
      });

      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: { routeAssignmentId: route.id },
      });

      return route.id;
    });

    return { ok: true, routeId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create the route." };
  }
}

export interface ProductTotal {
  productName: string;
  totalQuantity: number;
}

/** Per-product quantity totals across every order in the route — the
 * "Khakra: 40 pcs" loading/packing summary. */
export function summarizeProductTotals(
  orders: { items: { productName: string; quantity: number }[] }[]
): ProductTotal[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      totals.set(item.productName, (totals.get(item.productName) ?? 0) + item.quantity);
    }
  }
  return Array.from(totals.entries())
    .map(([productName, totalQuantity]) => ({ productName, totalQuantity }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

export interface RouteManifestOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  status: string;
  total: number;
  items: { productName: string; quantity: number }[];
}

export interface RouteManifest {
  id: string;
  routeNumber: number;
  status: string;
  warehouseName: string;
  warehouseAddress: string | null;
  deliveryPartnerName: string | null;
  createdAtLabel: string;
  notes: string | null;
  orders: RouteManifestOrder[];
  productTotals: ProductTotal[];
  totalOrders: number;
  totalItems: number;
  totalAmount: number;
  totalCod: number;
}

export async function getRouteManifest(routeId: string): Promise<RouteManifest | null> {
  const route = await prisma.routeAssignment.findUnique({
    where: { id: routeId },
    include: {
      warehouse: true,
      deliveryPartner: true,
      orders: {
        orderBy: { orderDate: "desc" },
        include: { customer: true, items: { include: { product: true } } },
      },
    },
  });
  if (!route) return null;

  const orders: RouteManifestOrder[] = route.orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
    customerPhone: o.customer.mobilePrimary,
    customerAddress: o.customer.shippingAddress,
    paymentMethod: o.paymentMethod,
    status: o.status,
    total: o.total,
    items: o.items.map((i) => ({ productName: i.product.name, quantity: i.quantity })),
  }));

  return {
    id: route.id,
    routeNumber: route.routeNumber,
    status: route.status,
    warehouseName: route.warehouse.name,
    warehouseAddress: route.warehouse.address,
    deliveryPartnerName: route.deliveryPartner?.name ?? null,
    createdAtLabel: route.createdAt.toLocaleDateString("en-IN"),
    notes: route.notes,
    orders,
    productTotals: summarizeProductTotals(orders),
    totalOrders: orders.length,
    totalItems: orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    totalAmount: orders.reduce((sum, o) => sum + o.total, 0),
    totalCod: orders
      .filter((o) => o.paymentMethod === "CASH" || o.paymentMethod === "PENDING")
      .reduce((sum, o) => sum + o.total, 0),
  };
}

export async function listRouteAssignments() {
  const routes = await prisma.routeAssignment.findMany({
    orderBy: { createdAt: "desc" },
    include: { warehouse: true, deliveryPartner: true, orders: { select: { id: true, total: true } } },
  });

  return routes.map((r) => ({
    id: r.id,
    routeNumber: r.routeNumber,
    status: r.status,
    warehouseName: r.warehouse.name,
    deliveryPartnerName: r.deliveryPartner?.name ?? null,
    createdAtLabel: r.createdAt.toLocaleDateString("en-IN"),
    orderCount: r.orders.length,
    totalAmount: r.orders.reduce((sum, o) => sum + o.total, 0),
  }));
}
