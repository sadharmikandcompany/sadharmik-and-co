# Delivery App v2 — Full Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Sadharmik Delivery rider app to full feature parity with the reference "Kalapurna Delivery" screen recording — Dashboard, a 4-tab My Deliveries (adds In Progress), Rescheduled, Balance Collection, Delivery Sheets (with PDF), Expenses, and an enhanced Profile — and switch the app's visual theme from the v1 green/gold to a blue/light palette matching that reference video.

**Architecture:** Same shape as v1 — Prisma schema additions on the CRM (`crm/`), new `/api/rider/*` routes backed by small `lib/rider*.ts` modules, consumed by new/extended Expo Router screens in `delivery-app/`. The v1 rider-identity model (`User`/`Role.DELIVERY_PARTNER`), bearer-token auth, and existing Pending/Complete/Failed plumbing are all reused and extended, not replaced.

**Tech Stack:** Same as v1 (Next.js/Prisma/Postgres, Expo Router/React Native), plus `expo-print` + `expo-sharing` (PDF generation/sharing for Delivery Sheets) and `@expo/vector-icons` (already bundled with the `expo` package — no new install — used for the 7-tab bottom bar).

## Global Constraints

- Every tool/service used must stay free — `expo-print`/`expo-sharing` are free Expo SDK packages, no paid API added.
- Android only, same as v1.
- Reuse the existing `User`/`Role.DELIVERY_PARTNER`/`Order.deliveryPartnerId` model — no new "Rider" concept.
- This repo's path contains `&`, breaking `npx`/`npm run` for locally-installed tools — use `./node_modules/.bin/<tool>` directly (from `crm/` or `delivery-app/` as appropriate) in every task, exactly as the v1 plan required.
- A `next dev` server (port 3000) and/or an `expo start` Metro server (port 8081) may already be running (the user's own session) — never kill a process you didn't start yourself for manual verification; use a different port for your own.
- The v1 rider-order lifecycle (`OUT_FOR_DELIVERY` → `DELIVERED`/`FAILED`) becomes a longer chain in v2: `OUT_FOR_DELIVERY` (assigned, not yet picked up) → `PICKED_UP` (in progress) → `DELIVERED` / `FAILED` / `RESCHEDULED`. Every task touching order status must respect this exact chain.
- Theme tokens (`theme.colors.*`) are referenced generically by every existing screen — re-theming is a single-file change (Task 2), not a per-screen rewrite. Do not hand-edit color values in individual screen files.

---

## Part A — Schema and theme

### Task 1: Schema additions — order lifecycle, priority/reschedule/settlement, rider profile fields, Expense model

**Files:**
- Modify: `crm/prisma/schema.prisma`

**Interfaces:**
- Produces: `OrderStatus.PICKED_UP`, `OrderStatus.RESCHESULED` — wait, spell exactly `RESCHEDULED`; `Order.isPriority: boolean`, `Order.rescheduledDate: DateTime | null`, `Order.rescheduleReason: string | null`, `Order.settledAt: DateTime | null`; `User.servicePincodes: string[]`, `User.rating: number | null`; new `Expense` model (`id, riderId, amount, category, notes, expenseDate, createdAt`) with a `User.expenses` back-relation. Every later task assumes these exist in the generated Prisma client.

- [ ] **Step 1: Extend `OrderStatus`**

In `crm/prisma/schema.prisma`, change:

```prisma
enum OrderStatus {
  NEW
  ROASTING
  OUT_FOR_DELIVERY
  DELIVERED
  FAILED
}
```

to:

```prisma
enum OrderStatus {
  NEW
  ROASTING
  OUT_FOR_DELIVERY
  PICKED_UP
  DELIVERED
  FAILED
  RESCHEDULED
}
```

- [ ] **Step 2: Add the new `Order` fields**

In `model Order`, add four fields (anywhere among the scalar fields, e.g. right after `deliveryNotes`):

```prisma
  isPriority        Boolean       @default(false)
  rescheduledDate    DateTime?
  rescheduleReason   String?
  settledAt          DateTime?
```

- [ ] **Step 3: Add the new `User` fields and the `Expense` relation**

In `model User`, add two scalar fields and one relation (after `isActive`, before `createdAt` — anywhere among the fields is fine):

```prisma
  servicePincodes String[] @default([])
  rating          Float?
```

and add, alongside the existing `deliveries Order[] @relation("OrderDeliveryPartner")` line:

```prisma
  expenses        Expense[]
```

- [ ] **Step 4: Add the `Expense` model**

Add a new model anywhere in the file (e.g. right after `model User`):

```prisma
model Expense {
  id          String   @id @default(cuid())
  riderId     String
  rider       User     @relation(fields: [riderId], references: [id])
  amount      Int
  category    String?
  notes       String?
  expenseDate DateTime @default(now())
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 5: Run the migration**

Run: `cd crm && ./node_modules/.bin/prisma migrate dev --name delivery_v2_lifecycle_and_expenses`

Expected: completes without a drift/reset prompt (the migration history is clean as of the end of v1 — no baselining needed this time) and prints `Your database is now in sync with your schema.`

If it DOES report drift (meaning the user has made further out-of-band schema changes since v1 finished), STOP and report back rather than guessing — do not run `migrate reset`. This exact situation happened twice during v1 and was resolved by baselining; the controller knows the technique if needed again.

- [ ] **Step 6: Typecheck**

Run: `cd crm && ./node_modules/.bin/tsc --noEmit`

Expected: no NEW errors from this change (the codebase may already show pre-existing errors from the user's own unrelated concurrent work in other files — not your concern, do not fix those).

- [ ] **Step 7: Commit**

```bash
git add crm/prisma/schema.prisma crm/prisma/migrations
git commit -m "feat(crm): add v2 order lifecycle (PICKED_UP/RESCHEDULED), priority/settlement fields, rider profile fields, Expense model"
```

---

### Task 2: Re-theme the app from green/gold to Kalapurna's blue/light palette

**Files:**
- Modify: `delivery-app/theme.ts`

**Interfaces:**
- Produces: the same token names as v1 (`background, surface, primary, primaryText, text, textMuted, danger, success, border`), plus two new tokens (`warning, gold`) used by v2 screens (Pending/priority badges, VIP-style highlights). Every existing screen already references these tokens generically — this task changes only their values, not any screen file.

- [ ] **Step 1: Replace the theme**

Replace the full contents of `delivery-app/theme.ts`:

```ts
export const theme = {
  colors: {
    background: "#F1F4F9",
    surface: "#FFFFFF",
    primary: "#1565C0",
    primaryText: "#FFFFFF",
    text: "#1A1A2E",
    textMuted: "#6B7280",
    danger: "#DC2626",
    success: "#16A34A",
    warning: "#F59E0B",
    gold: "#CA8A04",
    border: "#E5E7EB",
  },
};
```

- [ ] **Step 2: Verify existing screens still read correctly**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors (only values changed, no token renamed or removed).

Start Metro on a non-conflicting port (e.g. `PORT=8090`, or whatever's free — check with `netstat -ano | grep LISTENING` first) and confirm the `login` and `(tabs)/index` bundle endpoints still return 200 (same bundle-check approach as v1's tasks). Stop your Metro when done.

- [ ] **Step 3: Commit**

```bash
git add delivery-app/theme.ts
git commit -m "feat(delivery-app): re-theme from green/gold to blue/light, matching the Kalapurna reference video"
```

---

## Part B — Backend (`crm/`)

### Task 3: Extend the rider-orders library for the longer lifecycle (pickup, reschedule, priority)

**Files:**
- Modify: `crm/lib/riderOrders.ts`
- Modify: `crm/lib/riderOrders.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces (changed signatures — every later task in this plan uses the NEW versions): `canTransitionOrder(order, riderId, requiredStatus: OrderStatus): TransitionCheck` (now takes an explicit required-status instead of hardcoding `OUT_FOR_DELIVERY`), `mapRiderStatusParam` (adds `"in_progress" → "PICKED_UP"`, `"rescheduled" → "RESCHEDULED"`), `pickupOrder(riderId, orderId): Promise<TransitionCheck>` (OUT_FOR_DELIVERY → PICKED_UP), `deliverOrder`/`failOrder` (now require `PICKED_UP`, not `OUT_FOR_DELIVERY`), `rescheduleOrder(riderId, orderId, rescheduledDate: Date, reason: string): Promise<TransitionCheck>` (PICKED_UP → RESCHEDULED), `toRiderOrderJson` (adds `isPriority: boolean`, `rescheduledDate: string | null`, `rescheduleReason: string | null` to its output — the v1 fields are unchanged).

- [ ] **Step 1: Update the tests first (TDD)**

Replace the full contents of `crm/lib/riderOrders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canTransitionOrder, mapRiderStatusParam } from "./riderOrders";

describe("mapRiderStatusParam", () => {
  it("maps pending to OUT_FOR_DELIVERY", () => {
    expect(mapRiderStatusParam("pending")).toBe("OUT_FOR_DELIVERY");
  });

  it("maps in_progress to PICKED_UP", () => {
    expect(mapRiderStatusParam("in_progress")).toBe("PICKED_UP");
  });

  it("maps complete to DELIVERED", () => {
    expect(mapRiderStatusParam("complete")).toBe("DELIVERED");
  });

  it("maps failed to FAILED", () => {
    expect(mapRiderStatusParam("failed")).toBe("FAILED");
  });

  it("maps rescheduled to RESCHEDULED", () => {
    expect(mapRiderStatusParam("rescheduled")).toBe("RESCHEDULED");
  });

  it("returns null for an unknown value", () => {
    expect(mapRiderStatusParam("bogus")).toBeNull();
  });

  it("returns null for null", () => {
    expect(mapRiderStatusParam(null)).toBeNull();
  });
});

describe("canTransitionOrder", () => {
  it("allows a rider to transition their own order that's in the required status", () => {
    const result = canTransitionOrder(
      { deliveryPartnerId: "rider_1", status: "OUT_FOR_DELIVERY" },
      "rider_1",
      "OUT_FOR_DELIVERY"
    );
    expect(result.ok).toBe(true);
  });

  it("rejects an order assigned to someone else", () => {
    const result = canTransitionOrder(
      { deliveryPartnerId: "rider_2", status: "OUT_FOR_DELIVERY" },
      "rider_1",
      "OUT_FOR_DELIVERY"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an order that isn't in the required status", () => {
    const result = canTransitionOrder(
      { deliveryPartnerId: "rider_1", status: "DELIVERED" },
      "rider_1",
      "OUT_FOR_DELIVERY"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a missing order", () => {
    const result = canTransitionOrder(null, "rider_1", "OUT_FOR_DELIVERY");
    expect(result.ok).toBe(false);
  });

  it("requires PICKED_UP (not OUT_FOR_DELIVERY) when that's the required status", () => {
    const pickedUp = canTransitionOrder({ deliveryPartnerId: "rider_1", status: "PICKED_UP" }, "rider_1", "PICKED_UP");
    expect(pickedUp.ok).toBe(true);
    const stillAssigned = canTransitionOrder(
      { deliveryPartnerId: "rider_1", status: "OUT_FOR_DELIVERY" },
      "rider_1",
      "PICKED_UP"
    );
    expect(stillAssigned.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderOrders.test.ts`
Expected: FAIL — `canTransitionOrder` currently takes 2 args, not 3, and `mapRiderStatusParam` doesn't recognize `"in_progress"`/`"rescheduled"` yet.

- [ ] **Step 3: Implement**

Replace the full contents of `crm/lib/riderOrders.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

export function mapRiderStatusParam(status: string | null): OrderStatus | null {
  switch (status) {
    case "pending":
      return "OUT_FOR_DELIVERY";
    case "in_progress":
      return "PICKED_UP";
    case "complete":
      return "DELIVERED";
    case "failed":
      return "FAILED";
    case "rescheduled":
      return "RESCHEDULED";
    default:
      return null;
  }
}

const ORDER_INCLUDE = { customer: true, items: { include: { product: true } } } as const;

export async function listRiderOrders(riderId: string, status: OrderStatus) {
  return prisma.order.findMany({
    where: { deliveryPartnerId: riderId, status },
    orderBy: { orderDate: "desc" },
    include: ORDER_INCLUDE,
  });
}

export async function getRiderOrder(riderId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, deliveryPartnerId: riderId },
    include: ORDER_INCLUDE,
  });
}

export interface TransitionCheck {
  ok: boolean;
  error?: string;
}

export function canTransitionOrder(
  order: { deliveryPartnerId: string | null; status: string } | null,
  riderId: string,
  requiredStatus: OrderStatus
): TransitionCheck {
  if (!order) return { ok: false, error: "Order not found." };
  if (order.deliveryPartnerId !== riderId) {
    return { ok: false, error: "This order isn't assigned to you." };
  }
  if (order.status !== requiredStatus) {
    return { ok: false, error: "This order was already updated." };
  }
  return { ok: true };
}

export async function pickupOrder(riderId: string, orderId: string): Promise<TransitionCheck> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const check = canTransitionOrder(order, riderId, "OUT_FOR_DELIVERY");
  if (!check.ok) return check;

  await prisma.order.update({ where: { id: orderId }, data: { status: "PICKED_UP" } });
  return { ok: true };
}

export async function deliverOrder(riderId: string, orderId: string): Promise<TransitionCheck> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const check = canTransitionOrder(order, riderId, "PICKED_UP");
  if (!check.ok) return check;

  await prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
  return { ok: true };
}

export async function failOrder(riderId: string, orderId: string, reason: string): Promise<TransitionCheck> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const check = canTransitionOrder(order, riderId, "PICKED_UP");
  if (!check.ok) return check;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "FAILED", deliveryNotes: reason.trim() || null },
  });
  return { ok: true };
}

export async function rescheduleOrder(
  riderId: string,
  orderId: string,
  rescheduledDate: Date,
  reason: string
): Promise<TransitionCheck> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const check = canTransitionOrder(order, riderId, "PICKED_UP");
  if (!check.ok) return check;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "RESCHEDULED", rescheduledDate, rescheduleReason: reason.trim() || null },
  });
  return { ok: true };
}

type RiderOrderWithRelations = NonNullable<Awaited<ReturnType<typeof getRiderOrder>>>;

export function toRiderOrderJson(order: RiderOrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
    customerVipNumber: order.customer.vipNumber,
    customerPhone: order.customer.mobilePrimary,
    customerAddress: order.customer.shippingAddress,
    paymentMethod: order.paymentMethod,
    total: order.total,
    deliveryNotes: order.deliveryNotes,
    isPriority: order.isPriority,
    rescheduledDate: order.rescheduledDate ? order.rescheduledDate.toISOString() : null,
    rescheduleReason: order.rescheduleReason,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderOrders.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Update the callers of `canTransitionOrder`'s old 2-arg form**

None exist outside this file — `deliverOrder`/`failOrder` were the only callers and are already updated above. Confirm with:

Run: `cd crm && grep -rn "canTransitionOrder(" --include="*.ts" app lib` (from the `crm/` directory) — expected: only the definitions/calls inside `riderOrders.ts`/`riderOrders.test.ts` appear.

- [ ] **Step 6: Commit**

```bash
git add crm/lib/riderOrders.ts crm/lib/riderOrders.test.ts
git commit -m "feat(crm): extend rider order lifecycle with pickup/reschedule and generalized transition guard"
```

---

### Task 4: `POST /api/rider/orders/[id]/pickup` and `POST /api/rider/orders/[id]/reschedule`

**Files:**
- Create: `crm/app/api/rider/orders/[id]/pickup/route.ts`
- Create: `crm/app/api/rider/orders/[id]/reschedule/route.ts`

**Interfaces:**
- Consumes: `getAuthenticatedRider` (`@/lib/riderAuth`), `pickupOrder`, `rescheduleOrder` (`@/lib/riderOrders`).
- Produces: both → `{ ok: true }` on success, `{ ok: false, error }` with 401/403/400 otherwise. The app's `pickupOrder`/`rescheduleOrder` client functions (Task 10) call these.

- [ ] **Step 1: Implement the pickup route**

Create `crm/app/api/rider/orders/[id]/pickup/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { pickupOrder } from "@/lib/riderOrders";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const result = await pickupOrder(rider.id, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Implement the reschedule route**

Create `crm/app/api/rider/orders/[id]/reschedule/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { rescheduleOrder } from "@/lib/riderOrders";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  let body: { date?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const dateValue = new Date(String(body.date ?? ""));
  if (Number.isNaN(dateValue.getTime())) {
    return NextResponse.json({ ok: false, error: "A valid date is required." }, { status: 400 });
  }
  const reason = String(body.reason ?? "").trim();

  const result = await rescheduleOrder(rider.id, id, dateValue, reason);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Manual verification**

Start the dev server on a non-conflicting port. Using a throwaway script (same pattern as v1's Task 5/6/7 manual verification — a small script with `@prisma/client` creating a test rider, customer, and order with status `PICKED_UP` assigned to that rider), log in via `/api/rider/login`, then:

```bash
curl -s -X POST "http://localhost:<port>/api/rider/orders/<id>/pickup" -H "Authorization: Bearer <token>"
```

against an `OUT_FOR_DELIVERY` order — expect `{"ok":true}` and the DB row now `PICKED_UP`. Then:

```bash
curl -s -X POST "http://localhost:<port>/api/rider/orders/<id>/reschedule" \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"date":"2026-09-10T00:00:00.000Z","reason":"Customer asked for next week"}'
```

against a `PICKED_UP` order — expect `{"ok":true}`, DB row now `RESCHEDULED` with `rescheduledDate`/`rescheduleReason` set. Also verify: calling `pickup` on an already-`PICKED_UP` order returns the 403 "already updated" error (double-processing guard). Clean up all test data afterward.

- [ ] **Step 4: Commit**

```bash
git add crm/app/api/rider/orders
git commit -m "feat(crm): add rider pickup and reschedule API routes"
```

---

### Task 5: Rider dashboard summary — `GET /api/rider/dashboard`

**Files:**
- Create: `crm/lib/riderDashboard.ts`
- Create: `crm/lib/riderDashboard.test.ts`
- Create: `crm/app/api/rider/dashboard/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces: `buildDashboardSummary(counts: {assigned:number; pickedUp:number; delivered:number; failed:number}, todaysCollectionsTotal: number, totalDeliveries: number, rating: number | null): DashboardSummaryJson` (pure, tested) and `getDashboardSummary(riderId: string): Promise<DashboardSummaryJson>` (DB-touching, untested per convention) from `riderDashboard.ts`; the route wraps the latter. `DashboardSummaryJson` shape: `{ totalAssigned, pickedUp, delivered, failed, todaysCollectionsTotal, totalDeliveries, rating }` — used verbatim by the app's `DashboardSummary` type in Task 10.

- [ ] **Step 1: Write the failing test (pure function only)**

Create `crm/lib/riderDashboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "./riderDashboard";

describe("buildDashboardSummary", () => {
  it("assembles the summary from raw counts", () => {
    const result = buildDashboardSummary(
      { assigned: 2, pickedUp: 1, delivered: 5, failed: 1 },
      3150,
      656,
      4.8
    );
    expect(result).toEqual({
      totalAssigned: 2,
      pickedUp: 1,
      delivered: 5,
      failed: 1,
      todaysCollectionsTotal: 3150,
      totalDeliveries: 656,
      rating: 4.8,
    });
  });

  it("passes through a null rating unchanged", () => {
    const result = buildDashboardSummary({ assigned: 0, pickedUp: 0, delivered: 0, failed: 0 }, 0, 0, null);
    expect(result.rating).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderDashboard.test.ts`
Expected: FAIL — `Cannot find module './riderDashboard'`.

- [ ] **Step 3: Implement**

Create `crm/lib/riderDashboard.ts`:

```ts
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
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderDashboard.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the route**

Create `crm/app/api/rider/dashboard/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { getDashboardSummary } from "@/lib/riderDashboard";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const summary = await getDashboardSummary(rider.id);
  return NextResponse.json({ ok: true, summary });
}
```

- [ ] **Step 6: Manual verification**

With a test rider that has a mix of `OUT_FOR_DELIVERY`/`PICKED_UP`/`DELIVERED` (some with today's date)/`FAILED` orders (create via a throwaway script as before):

```bash
curl -s "http://localhost:<port>/api/rider/dashboard" -H "Authorization: Bearer <token>"
```

Expected: `{"ok":true,"summary":{"totalAssigned":N,"pickedUp":N,"delivered":N,"failed":N,"todaysCollectionsTotal":N,"totalDeliveries":N,"rating":null}}` matching what you set up. Clean up test data afterward.

- [ ] **Step 7: Commit**

```bash
git add crm/lib/riderDashboard.ts crm/lib/riderDashboard.test.ts crm/app/api/rider/dashboard
git commit -m "feat(crm): add rider dashboard summary API route"
```

---

### Task 6: Balance collection — `GET /api/rider/balance`

**Files:**
- Create: `crm/lib/riderBalance.ts`
- Create: `crm/lib/riderBalance.test.ts`
- Create: `crm/app/api/rider/balance/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces: `isUnsettled(order: {status: string; paymentMethod: string; settledAt: Date | null}): boolean` (pure, tested — an order counts toward balance collection when `DELIVERED`, paid in `CASH` or left `PENDING`, and not yet `settledAt`), `getBalanceCollection(riderId: string)` (DB-touching, untested). Route wraps the latter, response shape `{ ok: true, balance: { orders: [{id, orderNumber, customerName, total, paymentMethod}], total: number } }` — used by the app's `BalanceCollection` type (Task 10).

- [ ] **Step 1: Write the failing test**

Create `crm/lib/riderBalance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isUnsettled } from "./riderBalance";

describe("isUnsettled", () => {
  it("counts a delivered, unsettled cash order", () => {
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "CASH", settledAt: null })).toBe(true);
  });

  it("counts a delivered, unsettled pending-payment order", () => {
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "PENDING", settledAt: null })).toBe(true);
  });

  it("excludes an order already settled", () => {
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "CASH", settledAt: new Date() })).toBe(false);
  });

  it("excludes an order that isn't delivered yet", () => {
    expect(isUnsettled({ status: "PICKED_UP", paymentMethod: "CASH", settledAt: null })).toBe(false);
  });

  it("excludes a delivered order paid by UPI/card (already reconciled electronically)", () => {
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "UPI", settledAt: null })).toBe(false);
    expect(isUnsettled({ status: "DELIVERED", paymentMethod: "CARD", settledAt: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderBalance.test.ts`
Expected: FAIL — `Cannot find module './riderBalance'`.

- [ ] **Step 3: Implement**

Create `crm/lib/riderBalance.ts`:

```ts
import { prisma } from "@/lib/prisma";

export function isUnsettled(order: { status: string; paymentMethod: string; settledAt: Date | null }): boolean {
  return (
    order.status === "DELIVERED" &&
    (order.paymentMethod === "CASH" || order.paymentMethod === "PENDING") &&
    order.settledAt === null
  );
}

export interface BalanceOrderJson {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  paymentMethod: string;
}

export interface BalanceCollectionJson {
  orders: BalanceOrderJson[];
  total: number;
}

export async function getBalanceCollection(riderId: string): Promise<BalanceCollectionJson> {
  const orders = await prisma.order.findMany({
    where: {
      deliveryPartnerId: riderId,
      status: "DELIVERED",
      settledAt: null,
      paymentMethod: { in: ["CASH", "PENDING"] },
    },
    include: { customer: true },
    orderBy: { orderDate: "desc" },
  });

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
      total: o.total,
      paymentMethod: o.paymentMethod,
    })),
    total: orders.reduce((sum, o) => sum + o.total, 0),
  };
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderBalance.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement the route**

Create `crm/app/api/rider/balance/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { getBalanceCollection } from "@/lib/riderBalance";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const balance = await getBalanceCollection(rider.id);
  return NextResponse.json({ ok: true, balance });
}
```

- [ ] **Step 6: Manual verification**

Create a test rider + a `DELIVERED`/`CASH`/unsettled order and a `DELIVERED`/`UPI` order (should NOT appear):

```bash
curl -s "http://localhost:<port>/api/rider/balance" -H "Authorization: Bearer <token>"
```

Expected: `orders` contains only the CASH one, `total` matches its amount. Clean up afterward.

- [ ] **Step 7: Commit**

```bash
git add crm/lib/riderBalance.ts crm/lib/riderBalance.test.ts crm/app/api/rider/balance
git commit -m "feat(crm): add rider balance/COD collection API route"
```

---

### Task 7: Expenses — `GET`/`POST /api/rider/expenses`

**Files:**
- Create: `crm/lib/riderExpenses.ts`
- Create: `crm/lib/riderExpenses.test.ts`
- Create: `crm/app/api/rider/expenses/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces: `periodStartDate(period: "today"|"week"|"month", now: Date): Date` (pure, tested), `listExpenses(riderId, period)`, `createExpense(riderId, amount, category, notes)` (DB-touching, untested). Route: `GET ?period=today|week|month` → `{ ok: true, expenses: [{id, amount, category, notes, expenseDate}], total: number }`; `POST` body `{ amount, category?, notes? }` → `{ ok: true }` or `{ ok: false, error }` (400 if `amount` isn't a positive integer).

- [ ] **Step 1: Write the failing test**

Create `crm/lib/riderExpenses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { periodStartDate } from "./riderExpenses";

describe("periodStartDate", () => {
  const now = new Date("2026-09-10T15:30:00.000Z");

  it("today starts at local midnight of the given day", () => {
    const start = periodStartDate("today", now);
    expect(start.getDate()).toBe(now.getDate());
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("week starts 7 days before now", () => {
    const start = periodStartDate("week", now);
    const diffDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.1);
  });

  it("month starts on the 1st of the current month", () => {
    const start = periodStartDate("month", now);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(now.getMonth());
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderExpenses.test.ts`
Expected: FAIL — `Cannot find module './riderExpenses'`.

- [ ] **Step 3: Implement**

Create `crm/lib/riderExpenses.ts`:

```ts
import { prisma } from "@/lib/prisma";

export type ExpensePeriod = "today" | "week" | "month";

export function periodStartDate(period: ExpensePeriod, now: Date = new Date()): Date {
  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return start;
}

export interface ExpenseJson {
  id: string;
  amount: number;
  category: string | null;
  notes: string | null;
  expenseDate: string;
}

export async function listExpenses(riderId: string, period: ExpensePeriod): Promise<{ expenses: ExpenseJson[]; total: number }> {
  const rows = await prisma.expense.findMany({
    where: { riderId, expenseDate: { gte: periodStartDate(period) } },
    orderBy: { expenseDate: "desc" },
  });

  const expenses = rows.map((e) => ({
    id: e.id,
    amount: e.amount,
    category: e.category,
    notes: e.notes,
    expenseDate: e.expenseDate.toISOString(),
  }));

  return { expenses, total: expenses.reduce((sum, e) => sum + e.amount, 0) };
}

export async function createExpense(
  riderId: string,
  amount: number,
  category: string | null,
  notes: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "Amount must be a positive whole number." };
  }
  await prisma.expense.create({
    data: { riderId, amount, category: category || null, notes: notes || null },
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderExpenses.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the route**

Create `crm/app/api/rider/expenses/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { createExpense, listExpenses, type ExpensePeriod } from "@/lib/riderExpenses";

const VALID_PERIODS: ExpensePeriod[] = ["today", "week", "month"];

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const periodParam = request.nextUrl.searchParams.get("period");
  const period = VALID_PERIODS.find((p) => p === periodParam);
  if (!period) {
    return NextResponse.json({ ok: false, error: "period must be today, week, or month." }, { status: 400 });
  }

  const result = await listExpenses(rider.id, period);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let body: { amount?: number; category?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const result = await createExpense(
    rider.id,
    Math.round(Number(body.amount)),
    body.category ? String(body.category) : null,
    body.notes ? String(body.notes) : null
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Manual verification**

```bash
curl -s -X POST "http://localhost:<port>/api/rider/expenses" \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"amount":150,"category":"Fuel","notes":"Petrol for the day"}'
curl -s "http://localhost:<port>/api/rider/expenses?period=today" -H "Authorization: Bearer <token>"
```

Expected: POST returns `{"ok":true}`; GET returns it in `expenses` with `total: 150`. Also verify `amount: 0` and `amount: -5` both get rejected with 400. Clean up (delete the test expense row) afterward.

- [ ] **Step 7: Commit**

```bash
git add crm/lib/riderExpenses.ts crm/lib/riderExpenses.test.ts crm/app/api/rider/expenses
git commit -m "feat(crm): add rider expenses API routes"
```

---

### Task 8: Delivery sheet — `GET /api/rider/delivery-sheet`

**Files:**
- Create: `crm/lib/riderDeliverySheet.ts`
- Create: `crm/lib/riderDeliverySheet.test.ts`
- Create: `crm/app/api/rider/delivery-sheet/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces: `summarizeDeliverySheet(orders: {total:number; paymentMethod:string; items:{quantity:number}[]}[]): {totalOrders:number; totalItems:number; totalAmount:number; totalCod:number}` (pure, tested), `getDeliverySheet(riderId, filter: "today"|"all")` (DB-touching, untested). Route: `GET ?filter=today|all` → `{ ok: true, sheet: { orders: [...], totalOrders, totalItems, totalAmount, totalCod } }`, where each sheet order is `{id, orderNumber, customerName, customerPhone, customerAddress, paymentMethod, total, items:[{productName, quantity}]}` — matches the app's `DeliverySheet` type (Task 10). "today" = orders with `orderDate` today assigned to the rider (any status); "all" = every order ever assigned to the rider regardless of date.

- [ ] **Step 1: Write the failing test**

Create `crm/lib/riderDeliverySheet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeDeliverySheet } from "./riderDeliverySheet";

describe("summarizeDeliverySheet", () => {
  it("sums orders, items, amount, and COD-only amount", () => {
    const result = summarizeDeliverySheet([
      { total: 500, paymentMethod: "CASH", items: [{ quantity: 2 }, { quantity: 1 }] },
      { total: 300, paymentMethod: "UPI", items: [{ quantity: 1 }] },
      { total: 200, paymentMethod: "PENDING", items: [{ quantity: 3 }] },
    ]);
    expect(result).toEqual({ totalOrders: 3, totalItems: 7, totalAmount: 1000, totalCod: 700 });
  });

  it("handles an empty list", () => {
    expect(summarizeDeliverySheet([])).toEqual({ totalOrders: 0, totalItems: 0, totalAmount: 0, totalCod: 0 });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderDeliverySheet.test.ts`
Expected: FAIL — `Cannot find module './riderDeliverySheet'`.

- [ ] **Step 3: Implement**

Create `crm/lib/riderDeliverySheet.ts`:

```ts
import { prisma } from "@/lib/prisma";

export interface DeliverySheetOrderJson {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  total: number;
  items: { productName: string; quantity: number }[];
}

export interface DeliverySheetSummary {
  totalOrders: number;
  totalItems: number;
  totalAmount: number;
  totalCod: number;
}

export function summarizeDeliverySheet(
  orders: { total: number; paymentMethod: string; items: { quantity: number }[] }[]
): DeliverySheetSummary {
  return {
    totalOrders: orders.length,
    totalItems: orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    totalAmount: orders.reduce((sum, o) => sum + o.total, 0),
    totalCod: orders
      .filter((o) => o.paymentMethod === "CASH" || o.paymentMethod === "PENDING")
      .reduce((sum, o) => sum + o.total, 0),
  };
}

export async function getDeliverySheet(
  riderId: string,
  filter: "today" | "all"
): Promise<DeliverySheetSummary & { orders: DeliverySheetOrderJson[] }> {
  const where: Parameters<typeof prisma.order.findMany>[0] extends { where?: infer W } ? W : never = {
    deliveryPartnerId: riderId,
  };
  if (filter === "today") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    (where as { orderDate?: { gte: Date; lt: Date } }).orderDate = { gte: startOfToday, lt: endOfToday };
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: { orderDate: "desc" },
    include: { customer: true, items: { include: { product: true } } },
  });

  const orders: DeliverySheetOrderJson[] = rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
    customerPhone: o.customer.mobilePrimary,
    customerAddress: o.customer.shippingAddress,
    paymentMethod: o.paymentMethod,
    total: o.total,
    items: o.items.map((i) => ({ productName: i.product.name, quantity: i.quantity })),
  }));

  return { orders, ...summarizeDeliverySheet(rows.map((o) => ({ total: o.total, paymentMethod: o.paymentMethod, items: o.items }))) };
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd crm && ./node_modules/.bin/vitest run lib/riderDeliverySheet.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the route**

Create `crm/app/api/rider/delivery-sheet/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { getDeliverySheet } from "@/lib/riderDeliverySheet";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const filterParam = request.nextUrl.searchParams.get("filter");
  const filter = filterParam === "all" ? "all" : "today";

  const sheet = await getDeliverySheet(rider.id, filter);
  return NextResponse.json({ ok: true, sheet });
}
```

- [ ] **Step 6: Manual verification**

Create a test order dated today assigned to a test rider, then:

```bash
curl -s "http://localhost:<port>/api/rider/delivery-sheet?filter=today" -H "Authorization: Bearer <token>"
```

Expected: the order appears with correct `totalOrders`/`totalItems`/`totalAmount`/`totalCod`. Clean up afterward.

- [ ] **Step 7: Commit**

```bash
git add crm/lib/riderDeliverySheet.ts crm/lib/riderDeliverySheet.test.ts crm/app/api/rider/delivery-sheet
git commit -m "feat(crm): add rider delivery sheet API route"
```

---

## Part C — App (`delivery-app/`)

### Task 9: Install PDF dependencies, extend the API client with every v2 endpoint

**Files:**
- Modify: `delivery-app/lib/api.ts`
- Modify: `delivery-app/package.json` / `package-lock.json` (via `expo install`)

**Interfaces:**
- Consumes: `API_BASE_URL` (`./config`), `getToken` (already in this file).
- Produces (new exports, consumed by Tasks 11-17): `DashboardSummary`, `BalanceCollection`, `BalanceOrder`, `Expense`, `DeliverySheet`, `DeliverySheetOrder` types; `fetchDashboard()`, `fetchBalance()`, `fetchExpenses(period)`, `createExpense(amount, category, notes)`, `fetchDeliverySheet(filter)`, `pickupOrder(orderId)`, `rescheduleOrder(orderId, date, reason)` functions. `RiderOrder` type gains `isPriority: boolean`, `rescheduledDate: string | null`, `rescheduleReason: string | null` (matching Task 3's `toRiderOrderJson`). `fetchMyDeliveries`'s status union gains `"in_progress"` and `"rescheduled"`.

- [ ] **Step 1: Install PDF packages**

Run: `cd delivery-app && ./node_modules/.bin/expo install expo-print expo-sharing`

- [ ] **Step 2: Extend the API client**

In `delivery-app/lib/api.ts`, change the `RiderOrder` interface from:

```ts
export interface RiderOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerVipNumber: number;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  total: number;
  deliveryNotes: string | null;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
}
```

to:

```ts
export interface RiderOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerVipNumber: number;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  total: number;
  deliveryNotes: string | null;
  isPriority: boolean;
  rescheduledDate: string | null;
  rescheduleReason: string | null;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
}
```

Change `fetchMyDeliveries`'s parameter type from:

```ts
export async function fetchMyDeliveries(status: "pending" | "complete" | "failed"): Promise<RiderOrder[]> {
```

to:

```ts
export async function fetchMyDeliveries(
  status: "pending" | "in_progress" | "complete" | "failed" | "rescheduled"
): Promise<RiderOrder[]> {
```

(the function body is unchanged — it already just interpolates `status` into the query string).

At the end of the file, append:

```ts
export async function pickupOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch(`/api/rider/orders/${orderId}/pickup`, { method: "POST" });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export async function rescheduleOrder(
  orderId: string,
  date: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch(`/api/rider/orders/${orderId}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ date, reason }),
  });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export interface DashboardSummary {
  totalAssigned: number;
  pickedUp: number;
  delivered: number;
  failed: number;
  todaysCollectionsTotal: number;
  totalDeliveries: number;
  rating: number | null;
}

export async function fetchDashboard(): Promise<DashboardSummary> {
  const response = await authedFetch("/api/rider/dashboard");
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load dashboard.");
  return data.summary;
}

export interface BalanceOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  paymentMethod: string;
}

export interface BalanceCollection {
  orders: BalanceOrder[];
  total: number;
}

export async function fetchBalance(): Promise<BalanceCollection> {
  const response = await authedFetch("/api/rider/balance");
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load balance.");
  return data.balance;
}

export interface Expense {
  id: string;
  amount: number;
  category: string | null;
  notes: string | null;
  expenseDate: string;
}

export async function fetchExpenses(period: "today" | "week" | "month"): Promise<{ expenses: Expense[]; total: number }> {
  const response = await authedFetch(`/api/rider/expenses?period=${period}`);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load expenses.");
  return { expenses: data.expenses, total: data.total };
}

export async function createExpense(
  amount: number,
  category: string,
  notes: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch("/api/rider/expenses", {
    method: "POST",
    body: JSON.stringify({ amount, category, notes }),
  });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export interface DeliverySheetOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  total: number;
  items: { productName: string; quantity: number }[];
}

export interface DeliverySheet {
  orders: DeliverySheetOrder[];
  totalOrders: number;
  totalItems: number;
  totalAmount: number;
  totalCod: number;
}

export async function fetchDeliverySheet(filter: "today" | "all"): Promise<DeliverySheet> {
  const response = await authedFetch(`/api/rider/delivery-sheet?filter=${filter}`);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load delivery sheet.");
  return data.sheet;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add delivery-app/lib/api.ts delivery-app/package.json delivery-app/package-lock.json
git commit -m "feat(delivery-app): extend API client with dashboard/balance/expenses/delivery-sheet/pickup/reschedule"
```

---

### Task 10: Restructure tabs to 7 screens, move My Deliveries to its own route with an In Progress tab

**Files:**
- Modify: `delivery-app/app/(tabs)/_layout.tsx`
- Create: `delivery-app/app/(tabs)/deliveries.tsx` (moved/extended from the old `index.tsx`)

**Interfaces:**
- Consumes: `RiderOrder`, `fetchMyDeliveries` (`../../lib/api`), `theme` (`../../theme`).
- Produces: route `/(tabs)/deliveries` — Task 12's Dashboard screen (the new `index.tsx`) and other screens link to it; the old `/(tabs)/index` route is about to be replaced by Task 11's Dashboard, so this task ONLY creates `deliveries.tsx` and updates the tab bar — it does not yet touch `index.tsx` (Task 11 does that, to keep this task's diff focused on the move + the new tab).

- [ ] **Step 1: Create the moved-and-extended My Deliveries screen**

Create `delivery-app/app/(tabs)/deliveries.tsx` with the same content as the current `delivery-app/app/(tabs)/index.tsx`, but with a 4th tab and priority-flag display. Full file:

```tsx
import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchMyDeliveries, type RiderOrder } from "../../lib/api";
import { theme } from "../../theme";

type TabKey = "pending" | "in_progress" | "complete" | "failed";
const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "complete", label: "Complete" },
  { key: "failed", label: "Failed" },
];

export default function DeliveriesScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async (tab: TabKey) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchMyDeliveries(tab);
      setOrders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load deliveries.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(activeTab);
    }, [activeTab, load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => load(activeTab)} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>No {activeTab.replace("_", " ")} deliveries.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
            {item.isPriority && (
              <View style={styles.priorityBanner}>
                <Text style={styles.priorityBannerText}>PRIORITY ORDER</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <Text style={styles.vipBadge}>VIP {String(item.customerVipNumber).padStart(4, "0")}</Text>
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.customerPhone}>{item.customerPhone}</Text>
            <Text style={styles.address} numberOfLines={2}>
              {item.customerAddress}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.itemCount}>
                {item.items.length} item{item.items.length === 1 ? "" : "s"}
              </Text>
              <Text style={styles.amount}>
                {item.paymentMethod} · ₹{item.total.toLocaleString("en-IN")}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabBar: { flexDirection: "row", padding: 12, gap: 6, flexWrap: "wrap" },
  tab: { flex: 1, minWidth: "22%", paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: theme.colors.primaryText },
  error: { color: theme.colors.danger, textAlign: "center", marginBottom: 8 },
  listContainer: { padding: 12, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: theme.colors.textMuted },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  priorityBanner: {
    backgroundColor: theme.colors.warning,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  priorityBannerText: { color: theme.colors.primaryText, fontSize: 11, fontWeight: "700" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  vipBadge: { color: theme.colors.gold, fontWeight: "700" },
  customerName: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  customerPhone: { color: theme.colors.textMuted, marginBottom: 6 },
  address: { color: theme.colors.textMuted, marginBottom: 10 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  itemCount: { color: theme.colors.textMuted },
  amount: { color: theme.colors.primary, fontWeight: "700" },
});
```

- [ ] **Step 2: Delete the old `index.tsx` content (Task 11 replaces it)**

Do NOT delete `delivery-app/app/(tabs)/index.tsx` in this task — leave it as-is (still the old My Deliveries screen) so the app keeps building. Task 11 replaces its contents with the Dashboard.

- [ ] **Step 3: Update the tabs layout with all 7 tabs and icons**

Replace the full contents of `delivery-app/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: theme.colors.primaryText,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reschedule"
        options={{
          title: "Reschedule",
          tabBarIcon: ({ color, size }) => <Ionicons name="refresh" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="balance"
        options={{
          title: "Balance",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sheets"
        options={{
          title: "Sheets",
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

Note: this references 5 routes (`reschedule`, `balance`, `sheets`, `expenses`) that don't exist as files yet (Tasks 12-16 create them) — Expo Router will show a "route not found" error for those specific tabs until then, which is expected and fine for this task; `index` (still the old My Deliveries content) and `deliveries` (new) and `profile` (existing) all work.

- [ ] **Step 4: Typecheck and bundle-check**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors.

Start Metro on a non-conflicting port, confirm the `(tabs)/deliveries` bundle returns 200. Stop it when done.

- [ ] **Step 5: Commit**

```bash
git add "delivery-app/app/(tabs)/deliveries.tsx" "delivery-app/app/(tabs)/_layout.tsx"
git commit -m "feat(delivery-app): move My Deliveries to its own tab, add In Progress + priority flag, wire 7-tab layout"
```

---

### Task 11: Dashboard screen (new tab home)

**Files:**
- Modify: `delivery-app/app/(tabs)/index.tsx` (full replacement — was the old My Deliveries screen, now the Dashboard)

**Interfaces:**
- Consumes: `fetchDashboard`, `DashboardSummary` (`../../lib/api`), `useAuth` (`../../lib/auth`), `theme` (`../../theme`).

- [ ] **Step 1: Replace the screen**

Replace the full contents of `delivery-app/app/(tabs)/index.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Switch } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchDashboard, fetchMe, type DashboardSummary, type RiderProfile } from "../../lib/api";
import { theme } from "../../theme";

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryResult, profileResult] = await Promise.all([fetchDashboard(), fetchMe()]);
      setSummary(summaryResult);
      setProfile(profileResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Could not load dashboard."}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome, {profile?.name ?? "Rider"}!</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.availabilityRow}>
          <View>
            <Text style={styles.availabilityLabel}>Availability Status</Text>
            <Text style={[styles.availabilityValue, { color: isAvailable ? theme.colors.success : theme.colors.textMuted }]}>
              {isAvailable ? "Available for Deliveries" : "Currently Unavailable"}
            </Text>
          </View>
          <Switch value={isAvailable} onValueChange={setIsAvailable} trackColor={{ true: theme.colors.success }} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Today's Summary</Text>
      <View style={styles.grid}>
        <View style={[styles.statTile, { backgroundColor: "#E3F2FD" }]}>
          <Text style={styles.statValue}>{summary.totalAssigned}</Text>
          <Text style={styles.statLabel}>Total Assigned</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: "#E8F5E9" }]}>
          <Text style={styles.statValue}>{summary.delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: "#FFF8E1" }]}>
          <Text style={styles.statValue}>{summary.pickedUp}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: "#FFEBEE" }]}>
          <Text style={styles.statValue}>{summary.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Today's Collections</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.mutedLabel}>Today's Total</Text>
          <Text style={styles.collectionsValue}>₹{summary.todaysCollectionsTotal.toLocaleString("en-IN")}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Performance</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.mutedLabel}>Total Deliveries</Text>
          <Text style={styles.performanceValue}>{summary.totalDeliveries}</Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <Text style={styles.mutedLabel}>Average Rating</Text>
          <Text style={styles.performanceValue}>{summary.rating != null ? summary.rating.toFixed(1) : "—"}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <Pressable style={styles.primaryButton} onPress={() => router.push("/(tabs)/deliveries")}>
        <Text style={styles.primaryButtonText}>View All Deliveries</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center", gap: 12 },
  error: { color: theme.colors.danger },
  retryButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: theme.colors.primaryText, fontWeight: "700" },
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  welcome: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  date: { color: theme.colors.textMuted, marginTop: 4 },
  availabilityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  availabilityLabel: { color: theme.colors.text, fontWeight: "600" },
  availabilityValue: { marginTop: 2, fontWeight: "600" },
  sectionTitle: { color: theme.colors.text, fontWeight: "700", fontSize: 15, marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statTile: { width: "47%", borderRadius: 16, padding: 16 },
  statValue: { fontSize: 24, fontWeight: "800", color: theme.colors.text },
  statLabel: { color: theme.colors.textMuted, marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mutedLabel: { color: theme.colors.textMuted },
  collectionsValue: { color: theme.colors.success, fontWeight: "800", fontSize: 18 },
  performanceValue: { color: theme.colors.text, fontWeight: "700" },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: theme.colors.primaryText, fontWeight: "700" },
});
```

- [ ] **Step 2: Typecheck and bundle-check**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors.

Start Metro on a non-conflicting port, confirm the `(tabs)/index` bundle returns 200. Stop it when done.

- [ ] **Step 3: Commit**

```bash
git add "delivery-app/app/(tabs)/index.tsx"
git commit -m "feat(delivery-app): add Dashboard screen (availability, today's summary, collections, performance)"
```

---

### Task 12: Order detail — add Mark Picked Up and Reschedule

**Files:**
- Modify: `delivery-app/app/order/[id].tsx` (full replacement)

**Interfaces:**
- Consumes: `fetchOrder`, `pickupOrder`, `markDelivered`, `markFailed`, `rescheduleOrder`, `RiderOrder` (`../../lib/api`), `theme` (`../../theme`).

- [ ] **Step 1: Replace the screen**

Replace the full contents of `delivery-app/app/order/[id].tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { fetchOrder, pickupOrder, markDelivered, markFailed, rescheduleOrder, type RiderOrder } from "../../lib/api";
import { theme } from "../../theme";

type ActionMode = "none" | "fail" | "reschedule";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>("none");
  const [failReason, setFailReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchOrder(id);
      setOrder(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePickup() {
    setIsSubmitting(true);
    try {
      const result = await pickupOrder(id);
      if (!result.ok) {
        Alert.alert("Couldn't update", result.error ?? "Please try again.");
        return;
      }
      await load();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeliver() {
    setIsSubmitting(true);
    try {
      const result = await markDelivered(id);
      if (!result.ok) {
        Alert.alert("Couldn't update", result.error ?? "Please try again.");
        return;
      }
      router.back();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFail() {
    if (!failReason.trim()) {
      Alert.alert("Reason required", "Enter a short reason for the failed delivery.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await markFailed(id, failReason.trim());
      if (!result.ok) {
        Alert.alert("Couldn't update", result.error ?? "Please try again.");
        return;
      }
      router.back();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReschedule() {
    const parsedDate = new Date(rescheduleDate);
    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert("Valid date required", "Enter the new date as YYYY-MM-DD.");
      return;
    }
    if (!rescheduleReason.trim()) {
      Alert.alert("Reason required", "Enter a short reason for rescheduling.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await rescheduleOrder(id, parsedDate.toISOString(), rescheduleReason.trim());
      if (!result.ok) {
        Alert.alert("Couldn't update", result.error ?? "Please try again.");
        return;
      }
      router.back();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Order not found."}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const canPickup = order.status === "OUT_FOR_DELIVERY";
  const canAct = order.status === "PICKED_UP";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {order.isPriority && (
        <View style={styles.priorityBanner}>
          <Text style={styles.priorityBannerText}>PRIORITY ORDER</Text>
        </View>
      )}
      <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      <Text style={styles.customerName}>
        VIP {String(order.customerVipNumber).padStart(4, "0")} · {order.customerName}
      </Text>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}>
          <Text style={styles.actionButtonText}>Call</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() =>
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`)
          }
        >
          <Text style={styles.actionButtonText}>Navigate</Text>
        </Pressable>
      </View>

      <Text style={styles.address}>{order.customerAddress}</Text>

      <View style={styles.itemsCard}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemName}>
              {item.productName} × {item.quantity}
            </Text>
            <Text style={styles.itemPrice}>₹{(item.unitPrice * item.quantity).toLocaleString("en-IN")}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{order.paymentMethod}</Text>
          <Text style={styles.totalValue}>₹{order.total.toLocaleString("en-IN")}</Text>
        </View>
      </View>

      {order.deliveryNotes && <Text style={styles.notes}>Note: {order.deliveryNotes}</Text>}
      {order.rescheduledDate && (
        <Text style={styles.notes}>
          Rescheduled to {new Date(order.rescheduledDate).toLocaleDateString("en-IN")}
          {order.rescheduleReason ? ` — ${order.rescheduleReason}` : ""}
        </Text>
      )}

      {canPickup && (
        <Pressable style={styles.pickupButton} onPress={handlePickup} disabled={isSubmitting}>
          <Text style={styles.pickupButtonText}>{isSubmitting ? "Updating…" : "Mark Picked Up"}</Text>
        </Pressable>
      )}

      {canAct && actionMode === "none" && (
        <View style={styles.footerButtons}>
          <Pressable style={styles.deliverButton} onPress={handleDeliver} disabled={isSubmitting}>
            <Text style={styles.deliverButtonText}>{isSubmitting ? "Updating…" : "Mark Delivered"}</Text>
          </Pressable>
          <Pressable style={styles.failButton} onPress={() => setActionMode("fail")} disabled={isSubmitting}>
            <Text style={styles.failButtonText}>Mark Failed</Text>
          </Pressable>
          <Pressable style={styles.rescheduleButton} onPress={() => setActionMode("reschedule")} disabled={isSubmitting}>
            <Text style={styles.rescheduleButtonText}>Reschedule</Text>
          </Pressable>
        </View>
      )}

      {canAct && actionMode === "fail" && (
        <View style={styles.footerButtons}>
          <TextInput
            style={styles.reasonInput}
            placeholder="Reason (e.g. customer not available)"
            placeholderTextColor={theme.colors.textMuted}
            value={failReason}
            onChangeText={setFailReason}
          />
          <Pressable style={styles.failButton} onPress={handleFail} disabled={isSubmitting}>
            <Text style={styles.failButtonText}>{isSubmitting ? "Updating…" : "Confirm Failed"}</Text>
          </Pressable>
          <Pressable onPress={() => setActionMode("none")} disabled={isSubmitting}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {canAct && actionMode === "reschedule" && (
        <View style={styles.footerButtons}>
          <TextInput
            style={styles.reasonInput}
            placeholder="New date (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.textMuted}
            value={rescheduleDate}
            onChangeText={setRescheduleDate}
          />
          <TextInput
            style={styles.reasonInput}
            placeholder="Reason for rescheduling"
            placeholderTextColor={theme.colors.textMuted}
            value={rescheduleReason}
            onChangeText={setRescheduleReason}
          />
          <Pressable style={styles.rescheduleButton} onPress={handleReschedule} disabled={isSubmitting}>
            <Text style={styles.rescheduleButtonText}>{isSubmitting ? "Updating…" : "Confirm Reschedule"}</Text>
          </Pressable>
          <Pressable onPress={() => setActionMode("none")} disabled={isSubmitting}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16 },
  center: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center", gap: 12 },
  error: { color: theme.colors.danger },
  retryButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: theme.colors.primaryText, fontWeight: "700" },
  priorityBanner: {
    backgroundColor: theme.colors.warning,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  priorityBannerText: { color: theme.colors.primaryText, fontSize: 11, fontWeight: "700" },
  orderNumber: { color: theme.colors.text, fontSize: 20, fontWeight: "700" },
  customerName: { color: theme.colors.primary, marginTop: 4, marginBottom: 12 },
  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: { color: theme.colors.text, fontWeight: "600" },
  address: { color: theme.colors.textMuted, marginBottom: 16 },
  itemsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  itemName: { color: theme.colors.text, flex: 1, marginRight: 8 },
  itemPrice: { color: theme.colors.text, fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  totalLabel: { color: theme.colors.textMuted },
  totalValue: { color: theme.colors.primary, fontWeight: "700", fontSize: 16 },
  notes: { color: theme.colors.danger, marginBottom: 16 },
  pickupButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  pickupButtonText: { color: theme.colors.primaryText, fontWeight: "700", fontSize: 16 },
  footerButtons: { gap: 12 },
  deliverButton: { backgroundColor: theme.colors.success, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  deliverButtonText: { color: "#04150a", fontWeight: "700", fontSize: 16 },
  failButton: { backgroundColor: theme.colors.danger, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  failButtonText: { color: "#2a0705", fontWeight: "700", fontSize: 16 },
  rescheduleButton: { backgroundColor: theme.colors.warning, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  rescheduleButtonText: { color: "#4a2c00", fontWeight: "700", fontSize: 16 },
  cancelLink: { color: theme.colors.textMuted, textAlign: "center", padding: 8 },
  reasonInput: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
});
```

- [ ] **Step 2: Typecheck and bundle-check**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors.

Start Metro, confirm `order/[id]` bundles cleanly. Stop it when done.

- [ ] **Step 3: Commit**

```bash
git add delivery-app/app/order
git commit -m "feat(delivery-app): add Mark Picked Up and Reschedule to the order detail screen"
```

---

### Task 13: Rescheduled screen

**Files:**
- Create: `delivery-app/app/(tabs)/reschedule.tsx`

**Interfaces:**
- Consumes: `fetchMyDeliveries`, `RiderOrder` (`../../lib/api`), `theme` (`../../theme`).

- [ ] **Step 1: Create the screen**

Create `delivery-app/app/(tabs)/reschedule.tsx`:

```tsx
import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchMyDeliveries, type RiderOrder } from "../../lib/api";
import { theme } from "../../theme";

type FilterKey = "today" | "overdue" | "all";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "all", label: "All" },
];

export default function RescheduledScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("today");
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchMyDeliveries("rescheduled");
      setOrders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rescheduled deliveries.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredOrders = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    return orders.filter((order) => {
      if (!order.rescheduledDate) return false;
      const date = new Date(order.rescheduledDate);
      if (activeFilter === "today") return date >= startOfToday && date < endOfToday;
      if (activeFilter === "overdue") return date < startOfToday;
      return true;
    });
  }, [orders, activeFilter]);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setActiveFilter(filter.key)}
            style={[styles.tab, activeFilter === filter.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeFilter === filter.key && styles.tabTextActive]}>{filter.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.colors.primary} />}
        contentContainerStyle={filteredOrders.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.emptyText}>No rescheduled deliveries scheduled for {activeFilter}.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <Text style={styles.rescheduledDate}>
                {item.rescheduledDate ? new Date(item.rescheduledDate).toLocaleDateString("en-IN") : ""}
              </Text>
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.address} numberOfLines={2}>
              {item.customerAddress}
            </Text>
            {item.rescheduleReason && <Text style={styles.reason}>{item.rescheduleReason}</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabBar: { flexDirection: "row", padding: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: theme.colors.primaryText },
  error: { color: theme.colors.danger, textAlign: "center", marginBottom: 8 },
  listContainer: { padding: 12, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  emptyText: { color: theme.colors.textMuted, textAlign: "center" },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  rescheduledDate: { color: theme.colors.warning, fontWeight: "700" },
  customerName: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  address: { color: theme.colors.textMuted, marginTop: 4 },
  reason: { color: theme.colors.textMuted, marginTop: 8, fontStyle: "italic" },
});
```

- [ ] **Step 2: Typecheck and bundle-check**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors.

Start Metro, confirm `(tabs)/reschedule` bundles cleanly. Stop it when done.

- [ ] **Step 3: Commit**

```bash
git add "delivery-app/app/(tabs)/reschedule.tsx"
git commit -m "feat(delivery-app): add Rescheduled deliveries screen with Today/Overdue/All filters"
```

---

### Task 14: Balance Collection screen

**Files:**
- Create: `delivery-app/app/(tabs)/balance.tsx`

**Interfaces:**
- Consumes: `fetchBalance`, `BalanceCollection` (`../../lib/api`), `theme` (`../../theme`).

- [ ] **Step 1: Create the screen**

Create `delivery-app/app/(tabs)/balance.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { fetchBalance, type BalanceCollection } from "../../lib/api";
import { theme } from "../../theme";

export default function BalanceScreen() {
  const [balance, setBalance] = useState<BalanceCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchBalance();
      setBalance(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load balance.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading && !balance) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const orders = balance?.orders ?? [];

  if (orders.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
        <Text style={styles.allClearTitle}>All Clear!</Text>
        <Text style={styles.allClearSubtitle}>No pending balance collections.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total to Collect</Text>
        <Text style={styles.totalValue}>₹{balance!.total.toLocaleString("en-IN")}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.paymentMethod}>{item.paymentMethod}</Text>
              <Text style={styles.amount}>₹{item.total.toLocaleString("en-IN")}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center", gap: 8, padding: 24 },
  error: { color: theme.colors.danger },
  allClearTitle: { color: theme.colors.text, fontSize: 20, fontWeight: "700", marginTop: 8 },
  allClearSubtitle: { color: theme.colors.textMuted },
  totalCard: { backgroundColor: theme.colors.primary, margin: 12, borderRadius: 16, padding: 20, alignItems: "center" },
  totalLabel: { color: theme.colors.primaryText, opacity: 0.85 },
  totalValue: { color: theme.colors.primaryText, fontSize: 28, fontWeight: "800", marginTop: 4 },
  listContainer: { padding: 12, paddingTop: 0, gap: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  customerName: { color: theme.colors.textMuted, marginTop: 2 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  paymentMethod: { color: theme.colors.textMuted },
  amount: { color: theme.colors.primary, fontWeight: "700" },
});
```

- [ ] **Step 2: Typecheck and bundle-check**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors.

Start Metro, confirm `(tabs)/balance` bundles cleanly. Stop it when done.

- [ ] **Step 3: Commit**

```bash
git add "delivery-app/app/(tabs)/balance.tsx"
git commit -m "feat(delivery-app): add Balance Collection screen"
```

---

### Task 15: Expenses screen (list + add)

**Files:**
- Create: `delivery-app/app/(tabs)/expenses.tsx`

**Interfaces:**
- Consumes: `fetchExpenses`, `createExpense`, `Expense` (`../../lib/api`), `theme` (`../../theme`).

- [ ] **Step 1: Create the screen**

Create `delivery-app/app/(tabs)/expenses.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Modal, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { fetchExpenses, createExpense, type Expense } from "../../lib/api";
import { theme } from "../../theme";

type PeriodKey = "today" | "week" | "month";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

export default function ExpensesScreen() {
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("today");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (period: PeriodKey) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchExpenses(period);
      setExpenses(result.expenses);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load expenses.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(activePeriod);
    }, [activePeriod, load])
  );

  function closeModal() {
    setShowAddModal(false);
    setAmountInput("");
    setCategoryInput("");
    setNotesInput("");
    setSaveError(null);
  }

  async function handleSave() {
    const amount = Math.round(Number(amountInput));
    if (!Number.isInteger(amount) || amount <= 0) {
      setSaveError("Enter a valid amount.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await createExpense(amount, categoryInput.trim(), notesInput.trim());
      if (!result.ok) {
        setSaveError(result.error ?? "Could not save expense.");
        return;
      }
      closeModal();
      load(activePeriod);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save expense.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {PERIODS.map((period) => (
          <Pressable
            key={period.key}
            onPress={() => setActivePeriod(period.key)}
            style={[styles.tab, activePeriod === period.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activePeriod === period.key && styles.tabTextActive]}>{period.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Expenses</Text>
        <Text style={styles.totalValue}>₹{total.toLocaleString("en-IN")}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => load(activePeriod)} tintColor={theme.colors.primary} />}
        contentContainerStyle={expenses.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.emptyText}>No expenses recorded for {activePeriod.replace("_", " ")}.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.category}>{item.category || "Uncategorized"}</Text>
              <Text style={styles.amount}>₹{item.amount.toLocaleString("en-IN")}</Text>
            </View>
            {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
            <Text style={styles.date}>{new Date(item.expenseDate).toLocaleString("en-IN")}</Text>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={28} color={theme.colors.primaryText} />
      </Pressable>

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount (₹)"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              value={amountInput}
              onChangeText={setAmountInput}
            />
            <TextInput
              style={styles.input}
              placeholder="Category (e.g. Fuel)"
              placeholderTextColor={theme.colors.textMuted}
              value={categoryInput}
              onChangeText={setCategoryInput}
            />
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={notesInput}
              onChangeText={setNotesInput}
            />
            {saveError && <Text style={styles.error}>{saveError}</Text>}
            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelButton} onPress={closeModal} disabled={isSaving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                <Text style={styles.saveButtonText}>{isSaving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabBar: { flexDirection: "row", padding: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: theme.colors.primaryText },
  totalCard: { backgroundColor: theme.colors.surface, marginHorizontal: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  totalLabel: { color: theme.colors.textMuted },
  totalValue: { color: theme.colors.text, fontSize: 22, fontWeight: "800", marginTop: 4 },
  error: { color: theme.colors.danger, textAlign: "center", marginTop: 8 },
  listContainer: { padding: 12, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: theme.colors.textMuted },
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  category: { color: theme.colors.text, fontWeight: "700" },
  amount: { color: theme.colors.primary, fontWeight: "700" },
  notes: { color: theme.colors.textMuted, marginTop: 6 },
  date: { color: theme.colors.textMuted, marginTop: 6, fontSize: 12 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  input: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  cancelButtonText: { color: theme.colors.textMuted, fontWeight: "600" },
  saveButton: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 999, backgroundColor: theme.colors.primary },
  saveButtonText: { color: theme.colors.primaryText, fontWeight: "700" },
});
```

- [ ] **Step 2: Typecheck and bundle-check**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors.

Start Metro, confirm `(tabs)/expenses` bundles cleanly. Stop it when done.

- [ ] **Step 3: Commit**

```bash
git add "delivery-app/app/(tabs)/expenses.tsx"
git commit -m "feat(delivery-app): add Expenses screen with Today/Week/Month filter and add-expense modal"
```

---

### Task 16: Delivery Sheets screen with PDF download

**Files:**
- Create: `delivery-app/app/(tabs)/sheets.tsx`

**Interfaces:**
- Consumes: `fetchDeliverySheet`, `DeliverySheet` (`../../lib/api`), `theme` (`../../theme`), `expo-print`, `expo-sharing` (installed in Task 9).

- [ ] **Step 1: Create the screen**

Create `delivery-app/app/(tabs)/sheets.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { fetchDeliverySheet, type DeliverySheet } from "../../lib/api";
import { theme } from "../../theme";

type FilterKey = "today" | "all";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "all", label: "All Active" },
];

function buildSheetHtml(sheet: DeliverySheet): string {
  const rows = sheet.orders
    .map(
      (order, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${order.orderNumber}</td>
          <td>${order.customerName}</td>
          <td>${order.customerPhone}</td>
          <td>${order.customerAddress}</td>
          <td>${order.items.map((i) => `${i.productName} x${i.quantity}`).join("<br/>")}</td>
          <td>${order.paymentMethod}</td>
          <td>₹${order.total.toLocaleString("en-IN")}</td>
        </tr>
      `
    )
    .join("");

  return `
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: -apple-system, sans-serif; padding: 16px;">
        <h2>My Delivery Sheet</h2>
        <p>Orders: ${sheet.totalOrders} · Items: ${sheet.totalItems} · Total: ₹${sheet.totalAmount.toLocaleString(
    "en-IN"
  )} · COD: ₹${sheet.totalCod.toLocaleString("en-IN")}</p>
        <table style="width:100%; border-collapse: collapse;" border="1" cellpadding="6">
          <thead>
            <tr>
              <th>#</th><th>Order #</th><th>Customer</th><th>Phone</th><th>Address</th><th>Items</th><th>Payment</th><th>Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

export default function DeliverySheetsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("today");
  const [sheet, setSheet] = useState<DeliverySheet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const load = useCallback(async (filter: FilterKey) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchDeliverySheet(filter);
      setSheet(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load delivery sheet.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(activeFilter);
    }, [activeFilter, load])
  );

  async function handleDownloadPdf() {
    if (!sheet) return;
    setIsExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildSheetHtml(sheet) });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Delivery Sheet" });
      } else {
        Alert.alert("PDF created", `Saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert("Couldn't create PDF", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setActiveFilter(filter.key)}
            style={[styles.tab, activeFilter === filter.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeFilter === filter.key && styles.tabTextActive]}>{filter.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {sheet && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{sheet.totalOrders}</Text>
              <Text style={styles.statLabel}>ORDERS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{sheet.totalItems}</Text>
              <Text style={styles.statLabel}>ITEMS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>₹{sheet.totalAmount.toLocaleString("en-IN")}</Text>
              <Text style={styles.statLabel}>TOTAL</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>₹{sheet.totalCod.toLocaleString("en-IN")}</Text>
              <Text style={styles.statLabel}>COD</Text>
            </View>
          </View>

          <Pressable style={styles.downloadButton} onPress={handleDownloadPdf} disabled={isExporting || sheet.orders.length === 0}>
            <Text style={styles.downloadButtonText}>{isExporting ? "Preparing…" : "Download Delivery Sheet PDF"}</Text>
          </Pressable>
        </>
      )}

      <FlatList
        data={sheet?.orders ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => load(activeFilter)} tintColor={theme.colors.primary} />}
        contentContainerStyle={(sheet?.orders.length ?? 0) === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>No deliveries for {activeFilter}.</Text> : null}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.indexBubble}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.address}>{item.customerAddress}</Text>
            <Text style={styles.itemsLabel}>Items ({item.items.length})</Text>
            {item.items.map((line, i) => (
              <Text key={i} style={styles.itemLine}>
                {line.productName} · Qty: {line.quantity}
              </Text>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabBar: { flexDirection: "row", padding: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: theme.colors.primaryText },
  error: { color: theme.colors.danger, textAlign: "center", marginBottom: 8 },
  statsRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  statBox: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
  statValue: { color: theme.colors.text, fontWeight: "800" },
  statLabel: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  downloadButton: { backgroundColor: theme.colors.primary, marginHorizontal: 12, marginTop: 12, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  downloadButtonText: { color: theme.colors.primaryText, fontWeight: "700" },
  listContainer: { padding: 12, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: theme.colors.textMuted },
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  indexBubble: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  indexText: { color: theme.colors.primaryText, fontSize: 12, fontWeight: "700" },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  customerName: { color: theme.colors.text, fontWeight: "600" },
  address: { color: theme.colors.textMuted, marginTop: 2 },
  itemsLabel: { color: theme.colors.text, fontWeight: "600", marginTop: 10 },
  itemLine: { color: theme.colors.textMuted, marginTop: 2 },
});
```

- [ ] **Step 2: Typecheck and bundle-check**

Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: no errors.

Start Metro, confirm `(tabs)/sheets` bundles cleanly (this is the first screen importing `expo-print`/`expo-sharing` — a bundle failure here would mean the Task 9 install didn't take; if so, re-run `expo install expo-print expo-sharing` and retry). Stop it when done.

- [ ] **Step 3: Commit**

```bash
git add "delivery-app/app/(tabs)/sheets.tsx"
git commit -m "feat(delivery-app): add Delivery Sheets screen with PDF export"
```

---

### Task 17: Enhanced Profile screen (service areas, rating, performance) and final full-project check

**Files:**
- Modify: `delivery-app/app/(tabs)/profile.tsx` (full replacement)

**Interfaces:**
- Consumes: `fetchMe`, `fetchDashboard`, `RiderProfile`, `DashboardSummary` (`../../lib/api`), `useAuth` (`../../lib/auth`), `theme` (`../../theme`).

Note: `servicePincodes`/`rating` are on the `User` model (Task 1) but NOT yet exposed by `/api/rider/me` (v1's route only returns `{id, name, phone}`). This task also updates that route so the Profile screen has real data to show.

- [ ] **Step 1: Expose service pincodes and rating from `/api/rider/me`**

In `crm/app/api/rider/me/route.ts`, change:

```ts
  return NextResponse.json({ ok: true, rider: { id: rider.id, name: rider.name, phone: rider.phone } });
```

to:

```ts
  return NextResponse.json({
    ok: true,
    rider: {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      servicePincodes: rider.servicePincodes,
      rating: rider.rating,
    },
  });
```

- [ ] **Step 2: Update the app's `RiderProfile` type to match**

In `delivery-app/lib/api.ts`, change:

```ts
export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
}
```

to:

```ts
export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  servicePincodes: string[];
  rating: number | null;
}
```

- [ ] **Step 3: Replace the Profile screen**

Replace the full contents of `delivery-app/app/(tabs)/profile.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchMe, fetchDashboard, type RiderProfile, type DashboardSummary } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { theme } from "../../theme";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      setError(null);
      Promise.all([fetchMe(), fetchDashboard()])
        .then(([profileResult, summaryResult]) => {
          setProfile(profileResult);
          setSummary(summaryResult);
          setIsLoading(false);
        })
        .catch(() => {
          setError("Could not load your profile. Check your connection and try again.");
          setIsLoading(false);
        });
    }, [])
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarInitial}>{profile?.name?.charAt(0).toUpperCase() ?? "?"}</Text>
      </View>
      <Text style={styles.name}>{profile?.name ?? "Unknown rider"}</Text>
      <Text style={styles.phone}>{profile?.phone}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.row}>
          <Text style={styles.mutedLabel}>Total Deliveries</Text>
          <Text style={styles.valueText}>{summary?.totalDeliveries ?? 0}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.mutedLabel}>Average Rating</Text>
          <Text style={styles.valueText}>{profile?.rating != null ? profile.rating.toFixed(1) : "—"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Service Areas</Text>
        {profile && profile.servicePincodes.length > 0 ? (
          <View style={styles.pincodeWrap}>
            {profile.servicePincodes.map((pincode) => (
              <View key={pincode} style={styles.pincodeChip}>
                <Text style={styles.pincodeText}>{pincode}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.mutedLabel}>No service areas configured yet.</Text>
        )}
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, alignItems: "center", gap: 12 },
  center: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center" },
  error: { color: theme.colors.danger },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", marginTop: 8 },
  avatarInitial: { color: theme.colors.primaryText, fontSize: 28, fontWeight: "800" },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: "700" },
  phone: { color: theme.colors.textMuted },
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, width: "100%" },
  sectionTitle: { color: theme.colors.text, fontWeight: "700", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  mutedLabel: { color: theme.colors.textMuted },
  valueText: { color: theme.colors.text, fontWeight: "700" },
  pincodeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pincodeChip: { backgroundColor: theme.colors.background, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border },
  pincodeText: { color: theme.colors.primary, fontWeight: "600" },
  logoutButton: { backgroundColor: theme.colors.danger, borderRadius: 999, paddingVertical: 14, alignItems: "center", width: "100%", marginTop: 8 },
  logoutText: { color: "#2a0705", fontWeight: "700" },
});
```

- [ ] **Step 4: Full-project typecheck**

Run: `cd crm && ./node_modules/.bin/tsc --noEmit` — expected: no NEW errors (pre-existing errors from the user's unrelated concurrent work are fine).
Run: `cd delivery-app && ./node_modules/.bin/tsc --noEmit` — expected: zero errors.

- [ ] **Step 5: Final bundle sanity check**

Start Metro on a non-conflicting port. Confirm every one of these 7 routes bundles with a 200: `index`, `deliveries`, `reschedule`, `balance`, `sheets`, `expenses`, `profile`, plus `login` and `order/[id]`. List the final `delivery-app/app` directory tree in your report. Stop Metro when done.

- [ ] **Step 6: Commit**

```bash
git add crm/app/api/rider/me delivery-app/lib/api.ts "delivery-app/app/(tabs)/profile.tsx"
git commit -m "feat(delivery-app): enhance Profile with service areas, rating, and performance"
```

---

## Self-Review Notes

- **Spec coverage:** Dashboard (Task 11), 4-tab My Deliveries + priority flag (Task 10), Order detail pickup/reschedule (Task 12), Rescheduled (Task 13), Balance Collection (Task 14), Expenses (Task 15), Delivery Sheets + PDF (Task 16), enhanced Profile (Task 17), blue/light re-theme (Task 2) — every item from the video that the user asked for is covered.
- **Lifecycle consistency:** `OUT_FOR_DELIVERY → PICKED_UP → DELIVERED/FAILED/RESCHEDULED` is enforced identically in the backend guard (Task 3's `canTransitionOrder` with explicit `requiredStatus`) and the app's `canPickup`/`canAct` checks (Task 12) — no screen can act on a status the backend would reject.
- **Type consistency:** `toRiderOrderJson`'s new fields (`isPriority`, `rescheduledDate`, `rescheduleReason`) match the app's `RiderOrder` type field-for-field (Task 9); `DashboardSummary`, `BalanceCollection`, `Expense`, `DeliverySheet` types all match their route's JSON shape exactly, checked field-by-field while writing each task.
- **No placeholders:** every screen and route has complete, real code; the one environment-specific value from v1 (`YOUR_COMPUTER_LAN_IP`) is unchanged by this plan.
