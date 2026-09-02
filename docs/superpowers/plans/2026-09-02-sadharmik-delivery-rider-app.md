# Sadharmik Delivery Rider App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, locally-testable Android rider app (Expo) plus the CRM API/UI changes it needs, so a Sadharmik & Co. delivery partner can log in, see the orders assigned to them, and mark each Delivered or Failed — reading/writing the same database the back-office CRM already uses.

**Architecture:** New `/api/rider/*` routes on the existing `crm/` Next.js app, backed by the `User`/`Role.DELIVERY_PARTNER`/`Order.deliveryPartnerId` model already sitting (uncommitted, unmigrated) in the CRM's working tree, authenticated with a bearer token (not the CRM's existing cookie session). A new `delivery-app/` Expo (React Native, TypeScript, Expo Router) project consumes that API. Everything runs locally for this plan (CRM via `next dev`, app via Expo Go on the same WiFi) — deploying to Vercel and building a signed APK are the user's explicit next phase, not part of this plan.

**Tech Stack:** Next.js 15 / Prisma 6 / Postgres (existing CRM), `bcryptjs` for password hashing, Vitest for unit tests, Expo SDK (latest) + `expo-router` + `expo-secure-store` for the app.

**Full spec:** `docs/superpowers/specs/2026-09-02-sadharmik-delivery-rider-app-design.md`

## Global Constraints

- Android only — no iOS work in this or any later phase (per spec Architecture).
- Every tool/service used must be free — no paid EAS builds, no Play Store account, no paid API keys (per spec Architecture; navigation uses a plain Google Maps deep link, not the Maps API).
- This plan stops at "runs correctly against the CRM's local dev server via Expo Go" — do NOT deploy to Vercel and do NOT run any `eas build` in this plan; those are the user's explicit next phase.
- Reuse the existing `User` / `Role.DELIVERY_PARTNER` / `Order.deliveryPartnerId` model already in the CRM's working tree — do not introduce a separate `Rider` table (per spec's "Superseded note").
- Rider login is phone + password (the `User` model has no `username` field) — bcrypt-hashed, not plaintext.
- v1 scope only: Login, My Deliveries (Pending/Complete/Failed), Order detail (Call/Navigate/Deliver/Fail), Profile+Logout. Do NOT build Dashboard stats, Balance/COD reconciliation, Expense tracking, delivery-sheet PDFs, rescheduling, priority flags, ratings, or service-area pincodes — all explicitly deferred (per spec Non-goals).

---

## Part A — CRM backend (`crm/`)

### Task 1: Migrate the schema (existing WIP + this build's additions)

**Files:**
- Modify: `crm/prisma/schema.prisma`

**Interfaces:**
- Produces: `OrderStatus.FAILED`, `Order.deliveryNotes: string | null`, on top of the already-present (uncommitted) `User`, `Role`, `Order.deliveryPartnerId`, `Customer.vipNumber`. Every later task assumes these exist in the generated Prisma client.

- [ ] **Step 1: Add `FAILED` to the `OrderStatus` enum**

In `crm/prisma/schema.prisma`, change:

```prisma
enum OrderStatus {
  NEW
  ROASTING
  OUT_FOR_DELIVERY
  DELIVERED
}
```

to:

```prisma
enum OrderStatus {
  NEW
  ROASTING
  OUT_FOR_DELIVERY
  DELIVERED
  FAILED
}
```

- [ ] **Step 2: Add `deliveryNotes` to `Order`**

In the same file, in `model Order`, add one field (anywhere among the scalar fields, e.g. right after `notes`):

```prisma
  deliveryNotes  String?
```

So the relevant part of `model Order` reads:

```prisma
  notes             String?
  deliveryNotes      String?
  subtotal           Int
```

- [ ] **Step 3: Run the migration**

Run: `cd crm && npx prisma migrate dev --name add_delivery_status_and_notes`

Expected: prompts complete without error and print `Your database is now in sync with your schema.` — this single migration captures both the changes above **and** the already-pending `User`/`Role`/`vipNumber`/`deliveryPartnerId` changes that were sitting unmigrated in the working tree.

- [ ] **Step 4: Typecheck the existing WIP now compiles against the migrated client**

Run: `cd crm && npx tsc --noEmit`

Expected: no errors. (This is the first time `app/(app)/users/*`, `app/(app)/delivery-partners/page.tsx`, and the Sales-page VIP/delivery-partner changes can actually typecheck against a real generated Prisma client — catch any mismatch now, before building on top of it.)

- [ ] **Step 5: Manual smoke check**

Run: `cd crm && npm run dev`, then visit `http://localhost:3000/users` and `http://localhost:3000/delivery-partners` in a browser (log in first if prompted). Expected: both pages load without a server error (empty lists are fine — no users exist yet).

- [ ] **Step 6: Commit**

```bash
git add crm/prisma/schema.prisma crm/prisma/migrations
git commit -m "feat(crm): add FAILED order status and deliveryNotes field"
```

---

### Task 2: Hash rider/user passwords instead of storing them in plaintext

**Files:**
- Create: `crm/lib/password.ts`
- Create: `crm/lib/password.test.ts`
- Modify: `crm/app/(app)/users/actions.ts`
- Modify: `crm/package.json`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>` — used by Task 5 (login route) and by the existing `createUser` action.

- [ ] **Step 1: Add the hashing dependency**

Run: `cd crm && npm install bcryptjs && npm install -D @types/bcryptjs`

- [ ] **Step 2: Write the failing test**

Create `crm/lib/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("correct-horse", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("rejects against an empty hash", async () => {
    expect(await verifyPassword("anything", "")).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd crm && npx vitest run lib/password.test.ts`
Expected: FAIL — `Cannot find module './password'` (file doesn't exist yet).

- [ ] **Step 4: Implement**

Create `crm/lib/password.ts`:

```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `cd crm && npx vitest run lib/password.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire it into user creation**

In `crm/app/(app)/users/actions.ts`, add the import:

```ts
import { hashPassword } from "@/lib/password";
```

and change:

```ts
    await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        role,
        passwordHash: password, // In production this should be hashed
      },
    });
```

to:

```ts
    await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        role,
        passwordHash: await hashPassword(password),
      },
    });
```

- [ ] **Step 7: Manual verification**

Run: `cd crm && npm run dev`, visit `/users`, add a test user with a known password. Run `cd crm && npx prisma studio`, open the `User` table, confirm the new row's `passwordHash` looks like a bcrypt hash (starts with `$2a$` or `$2b$`), not the plaintext password.

- [ ] **Step 8: Commit**

```bash
git add crm/lib/password.ts crm/lib/password.test.ts crm/app/(app)/users/actions.ts crm/package.json crm/package-lock.json
git commit -m "feat(crm): hash user passwords with bcrypt instead of storing plaintext"
```

---

### Task 3: Rider auth token library

**Files:**
- Create: `crm/lib/riderAuth.ts`
- Create: `crm/lib/riderAuth.test.ts`
- Modify: `crm/.env`
- Modify: `crm/.env.example`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces: `signRiderToken(userId: string): string`, `verifyRiderToken(token: string | undefined | null): string | null`, `canLoginAsRider(user: { isActive: boolean; role: string } | null, passwordMatches: boolean): boolean`, `getAuthenticatedRider(request: Request): Promise<import("@prisma/client").User | null>` — used by every `/api/rider/*` route (Tasks 5–7).

- [ ] **Step 1: Add the new secret to env files**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and copy the output.

In `crm/.env`, add a new line with that generated value:

```
RIDER_TOKEN_SECRET="<paste the generated value here>"
```

In `crm/.env.example`, add:

```
RIDER_TOKEN_SECRET="change-me-too"
```

- [ ] **Step 2: Write the failing tests**

Create `crm/lib/riderAuth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canLoginAsRider, signRiderToken, verifyRiderToken } from "./riderAuth";

describe("signRiderToken / verifyRiderToken", () => {
  beforeEach(() => {
    process.env.RIDER_TOKEN_SECRET = "test-secret";
  });

  it("verifies a token it just signed, returning the user id", () => {
    const token = signRiderToken("user_123");
    expect(verifyRiderToken(token)).toBe("user_123");
  });

  it("rejects a tampered token", () => {
    const token = signRiderToken("user_123");
    expect(verifyRiderToken(token.slice(0, -1) + "0")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signRiderToken("user_123");
    process.env.RIDER_TOKEN_SECRET = "a-different-secret";
    expect(verifyRiderToken(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    const token = signRiderToken("user_123");
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);
    expect(verifyRiderToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it("rejects a malformed token", () => {
    expect(verifyRiderToken("not-a-real-token")).toBeNull();
  });

  it("rejects undefined and null", () => {
    expect(verifyRiderToken(undefined)).toBeNull();
    expect(verifyRiderToken(null)).toBeNull();
  });
});

describe("canLoginAsRider", () => {
  it("allows an active delivery partner with a matching password", () => {
    expect(canLoginAsRider({ isActive: true, role: "DELIVERY_PARTNER" }, true)).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(canLoginAsRider({ isActive: true, role: "DELIVERY_PARTNER" }, false)).toBe(false);
  });

  it("rejects an inactive user", () => {
    expect(canLoginAsRider({ isActive: false, role: "DELIVERY_PARTNER" }, true)).toBe(false);
  });

  it("rejects a non-delivery-partner role", () => {
    expect(canLoginAsRider({ isActive: true, role: "STAFF" }, true)).toBe(false);
  });

  it("rejects a missing user", () => {
    expect(canLoginAsRider(null, true)).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd crm && npx vitest run lib/riderAuth.test.ts`
Expected: FAIL — `Cannot find module './riderAuth'`.

- [ ] **Step 4: Implement**

Create `crm/lib/riderAuth.ts`:

```ts
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.RIDER_TOKEN_SECRET;
  if (!secret) {
    throw new Error("RIDER_TOKEN_SECRET environment variable is not set.");
  }
  return secret;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function signRiderToken(userId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyRiderToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAtRaw, hmac] = parts;
  const payload = `${userId}.${expiresAtRaw}`;
  const expected = sign(payload);
  if (expected.length !== hmac.length || !timingSafeStringEqual(expected, hmac)) return null;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return userId;
}

export function canLoginAsRider(
  user: { isActive: boolean; role: string } | null,
  passwordMatches: boolean
): boolean {
  return !!user && user.isActive && user.role === "DELIVERY_PARTNER" && passwordMatches;
}

export async function getAuthenticatedRider(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const userId = verifyRiderToken(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || user.role !== "DELIVERY_PARTNER") return null;
  return user;
}
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `cd crm && npx vitest run lib/riderAuth.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add crm/lib/riderAuth.ts crm/lib/riderAuth.test.ts crm/.env.example
git commit -m "feat(crm): add rider bearer-token signing/verification"
```

(`.env` is gitignored and intentionally not committed — confirm with `git status` that it doesn't show up.)

---

### Task 4: Rider order-list/transition library

**Files:**
- Create: `crm/lib/riderOrders.ts`
- Create: `crm/lib/riderOrders.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`.
- Produces: `mapRiderStatusParam(status: string | null): OrderStatus | null`, `canTransitionOrder(order: { deliveryPartnerId: string | null; status: string } | null, riderId: string): { ok: boolean; error?: string }`, `listRiderOrders(riderId: string, status: OrderStatus)`, `getRiderOrder(riderId: string, orderId: string)`, `deliverOrder(riderId: string, orderId: string): Promise<{ ok: boolean; error?: string }>`, `failOrder(riderId: string, orderId: string, reason: string): Promise<{ ok: boolean; error?: string }>`, `toRiderOrderJson(order)` (shapes a Prisma order — with `customer` and `items.product` included — into the flat JSON both order routes return) — used by Tasks 6–7. Keeping the JSON-shaping function here rather than exporting it from a route file matters: Next.js route files should only export HTTP-method handlers (plus a small set of reserved config names) — an extra named export like a shared helper is unsupported there.

- [ ] **Step 1: Write the failing tests (pure functions only)**

Create `crm/lib/riderOrders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canTransitionOrder, mapRiderStatusParam } from "./riderOrders";

describe("mapRiderStatusParam", () => {
  it("maps pending to OUT_FOR_DELIVERY", () => {
    expect(mapRiderStatusParam("pending")).toBe("OUT_FOR_DELIVERY");
  });

  it("maps complete to DELIVERED", () => {
    expect(mapRiderStatusParam("complete")).toBe("DELIVERED");
  });

  it("maps failed to FAILED", () => {
    expect(mapRiderStatusParam("failed")).toBe("FAILED");
  });

  it("returns null for an unknown value", () => {
    expect(mapRiderStatusParam("bogus")).toBeNull();
  });

  it("returns null for null", () => {
    expect(mapRiderStatusParam(null)).toBeNull();
  });
});

describe("canTransitionOrder", () => {
  it("allows a rider to transition their own out-for-delivery order", () => {
    const result = canTransitionOrder({ deliveryPartnerId: "rider_1", status: "OUT_FOR_DELIVERY" }, "rider_1");
    expect(result.ok).toBe(true);
  });

  it("rejects an order assigned to someone else", () => {
    const result = canTransitionOrder({ deliveryPartnerId: "rider_2", status: "OUT_FOR_DELIVERY" }, "rider_1");
    expect(result.ok).toBe(false);
  });

  it("rejects an order that isn't out for delivery", () => {
    const result = canTransitionOrder({ deliveryPartnerId: "rider_1", status: "DELIVERED" }, "rider_1");
    expect(result.ok).toBe(false);
  });

  it("rejects a missing order", () => {
    const result = canTransitionOrder(null, "rider_1");
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd crm && npx vitest run lib/riderOrders.test.ts`
Expected: FAIL — `Cannot find module './riderOrders'`.

- [ ] **Step 3: Implement**

Create `crm/lib/riderOrders.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";

export function mapRiderStatusParam(status: string | null): OrderStatus | null {
  switch (status) {
    case "pending":
      return "OUT_FOR_DELIVERY";
    case "complete":
      return "DELIVERED";
    case "failed":
      return "FAILED";
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
  riderId: string
): TransitionCheck {
  if (!order) return { ok: false, error: "Order not found." };
  if (order.deliveryPartnerId !== riderId) {
    return { ok: false, error: "This order isn't assigned to you." };
  }
  if (order.status !== "OUT_FOR_DELIVERY") {
    return { ok: false, error: "This order was already updated." };
  }
  return { ok: true };
}

export async function deliverOrder(riderId: string, orderId: string): Promise<TransitionCheck> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const check = canTransitionOrder(order, riderId);
  if (!check.ok) return check;

  await prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
  return { ok: true };
}

export async function failOrder(riderId: string, orderId: string, reason: string): Promise<TransitionCheck> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const check = canTransitionOrder(order, riderId);
  if (!check.ok) return check;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "FAILED", deliveryNotes: reason.trim() || null },
  });
  return { ok: true };
}

type RiderOrderWithRelations = NonNullable<Awaited<ReturnType<typeof getRiderOrder>>>;

export function toRiderOrderJson(order: RiderOrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customer.name,
    customerVipNumber: order.customer.vipNumber,
    customerPhone: order.customer.phone,
    customerAddress: order.customer.address,
    paymentMethod: order.paymentMethod,
    total: order.total,
    deliveryNotes: order.deliveryNotes,
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

Run: `cd crm && npx vitest run lib/riderOrders.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add crm/lib/riderOrders.ts crm/lib/riderOrders.test.ts
git commit -m "feat(crm): add rider order listing and delivery/fail transitions"
```

---

### Task 5: `POST /api/rider/login` and `GET /api/rider/me`

**Files:**
- Create: `crm/app/api/rider/login/route.ts`
- Create: `crm/app/api/rider/me/route.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `verifyPassword` (`@/lib/password`), `canLoginAsRider`, `signRiderToken`, `getAuthenticatedRider` (`@/lib/riderAuth`).
- Produces: `POST /api/rider/login` → `{ ok: true, token: string }` or `{ ok: false, error: string }`; `GET /api/rider/me` → `{ ok: true, rider: { id, name, phone } }` or `{ ok: false, error: string }` — the app's `lib/api.ts` (Task 11) calls both.

- [ ] **Step 1: Implement the login route**

Create `crm/app/api/rider/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { canLoginAsRider, signRiderToken } from "@/lib/riderAuth";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  let body: { phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");
  if (!phone || !password) {
    return jsonError("Phone and password are required.", 400);
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!canLoginAsRider(user, passwordMatches)) {
    return jsonError("Invalid phone or password.", 401);
  }

  const token = signRiderToken(user!.id);
  return NextResponse.json({ ok: true, token });
}
```

- [ ] **Step 2: Implement the "who am I" route**

Create `crm/app/api/rider/me/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, rider: { id: rider.id, name: rider.name, phone: rider.phone } });
}
```

- [ ] **Step 3: Manual verification**

With `cd crm && npm run dev` running, and at least one active `DELIVERY_PARTNER` user created via `/users` (note the phone + password you used):

```bash
curl -s -X POST http://localhost:3000/api/rider/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"<that phone>","password":"<that password>"}'
```

Expected: `{"ok":true,"token":"..."}`. Copy the token, then:

```bash
curl -s http://localhost:3000/api/rider/me -H "Authorization: Bearer <token>"
```

Expected: `{"ok":true,"rider":{"id":"...","name":"...","phone":"..."}}`.

Also confirm the failure path: retry login with a wrong password — expect `{"ok":false,"error":"Invalid phone or password."}` with a 401 status.

- [ ] **Step 4: Commit**

```bash
git add crm/app/api/rider/login crm/app/api/rider/me
git commit -m "feat(crm): add rider login and profile API routes"
```

---

### Task 6: `GET /api/rider/orders` and `GET /api/rider/orders/[id]`

**Files:**
- Create: `crm/app/api/rider/orders/route.ts`
- Create: `crm/app/api/rider/orders/[id]/route.ts`

**Interfaces:**
- Consumes: `getAuthenticatedRider` (`@/lib/riderAuth`), `listRiderOrders`, `getRiderOrder`, `mapRiderStatusParam`, `toRiderOrderJson` (`@/lib/riderOrders`).
- Produces: `GET /api/rider/orders?status=pending|complete|failed` → `{ ok: true, orders: RiderOrderJSON[] }`; `GET /api/rider/orders/:id` → `{ ok: true, order: RiderOrderJSON }` or 404. `RiderOrderJSON` shape (used verbatim by the app's `RiderOrder` type in Task 11): `{ id, orderNumber, status, customerName, customerVipNumber, customerPhone, customerAddress, paymentMethod, total, deliveryNotes, items: [{ id, productName, quantity, unitPrice }] }` — this is exactly what `toRiderOrderJson` (Task 4) returns.

- [ ] **Step 1: Implement the list route**

Create `crm/app/api/rider/orders/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { listRiderOrders, mapRiderStatusParam, toRiderOrderJson } from "@/lib/riderOrders";

export async function GET(request: NextRequest) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const status = mapRiderStatusParam(request.nextUrl.searchParams.get("status"));
  if (!status) {
    return NextResponse.json({ ok: false, error: "status must be pending, complete, or failed." }, { status: 400 });
  }

  const orders = await listRiderOrders(rider.id, status);
  return NextResponse.json({ ok: true, orders: orders.map(toRiderOrderJson) });
}
```

- [ ] **Step 2: Implement the single-order route**

Create `crm/app/api/rider/orders/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { getRiderOrder, toRiderOrderJson } from "@/lib/riderOrders";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const order = await getRiderOrder(rider.id, id);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: toRiderOrderJson(order) });
}
```

- [ ] **Step 3: Manual verification**

Using a token from Task 5's verification, and an order manually assigned to that rider (via `/sales/<order id>` — this UI arrives in Task 8, so for now assign it directly: `cd crm && npx prisma studio`, open `Order`, set `deliveryPartnerId` on one row to the rider's user id, and set its `status` to `OUT_FOR_DELIVERY`):

```bash
curl -s "http://localhost:3000/api/rider/orders?status=pending" -H "Authorization: Bearer <token>"
```

Expected: `{"ok":true,"orders":[{"id":"...", "orderNumber":"...", ...}]}` containing that order.

```bash
curl -s "http://localhost:3000/api/rider/orders/<that order id>" -H "Authorization: Bearer <token>"
```

Expected: `{"ok":true,"order":{...}}` with the same fields.

- [ ] **Step 4: Commit**

```bash
git add crm/app/api/rider/orders
git commit -m "feat(crm): add rider order list and single-order API routes"
```

---

### Task 7: `POST /api/rider/orders/[id]/deliver` and `POST /api/rider/orders/[id]/fail`

**Files:**
- Create: `crm/app/api/rider/orders/[id]/deliver/route.ts`
- Create: `crm/app/api/rider/orders/[id]/fail/route.ts`

**Interfaces:**
- Consumes: `getAuthenticatedRider` (`@/lib/riderAuth`), `deliverOrder`, `failOrder` (`@/lib/riderOrders`).
- Produces: both → `{ ok: true }` on success, `{ ok: false, error: string }` with 401/403 otherwise — the app's `markDelivered`/`markFailed` (Task 11) call these.

- [ ] **Step 1: Implement the deliver route**

Create `crm/app/api/rider/orders/[id]/deliver/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { deliverOrder } from "@/lib/riderOrders";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const result = await deliverOrder(rider.id, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Implement the fail route**

Create `crm/app/api/rider/orders/[id]/fail/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedRider } from "@/lib/riderAuth";
import { failOrder } from "@/lib/riderOrders";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rider = await getAuthenticatedRider(request);
  if (!rider) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = String(body.reason ?? "").trim();

  const result = await failOrder(rider.id, id, reason);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Manual verification**

Using the same assigned order and token from Task 6:

```bash
curl -s -X POST "http://localhost:3000/api/rider/orders/<order id>/deliver" -H "Authorization: Bearer <token>"
```

Expected: `{"ok":true}`. Confirm in Prisma Studio the order's `status` is now `DELIVERED`.

Assign a second order to the same rider (`OUT_FOR_DELIVERY`), then:

```bash
curl -s -X POST "http://localhost:3000/api/rider/orders/<second order id>/fail" \
  -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"reason":"Customer not available"}'
```

Expected: `{"ok":true}`; confirm `status` is `FAILED` and `deliveryNotes` is `"Customer not available"`.

Retry the same `deliver` call again on the now-`DELIVERED` order — expect `{"ok":false,"error":"This order was already updated."}` with status 403 (proves the double-processing guard works).

- [ ] **Step 4: Commit**

```bash
git add crm/app/api/rider/orders
git commit -m "feat(crm): add rider deliver/fail API routes"
```

---

### Task 8: CRM UI — assign a delivery partner to an order

**Files:**
- Modify: `crm/app/(app)/sales/actions.ts`
- Modify: `crm/app/(app)/sales/[id]/page.tsx`

**Interfaces:**
- Produces: `assignDeliveryPartner(formData: FormData): Promise<void>` server action, wired into the order-detail page — this is how a real order gets a `deliveryPartnerId` in normal use (not just via Prisma Studio, which was only for testing in Tasks 6–7).

- [ ] **Step 1: Add the server action**

In `crm/app/(app)/sales/actions.ts`, append:

```ts
export async function assignDeliveryPartner(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const deliveryPartnerId = String(formData.get("deliveryPartnerId") ?? "");
  if (!id) throw new Error("Missing order id.");

  await prisma.order.update({
    where: { id },
    data: { deliveryPartnerId: deliveryPartnerId || null },
  });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/delivery-partners");
}
```

- [ ] **Step 2: Add the UI**

In `crm/app/(app)/sales/[id]/page.tsx`, replace the whole file with:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { updateOrderStatus, updateOrderPaymentMethod, assignDeliveryPartner } from "../actions";

const STATUS_OPTIONS = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"] as const;
const PAYMENT_OPTIONS = ["PENDING", "CASH", "UPI", "CARD", "CHEQUE"] as const;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, deliveryPartners] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: true } }, deliveryPartner: true },
    }),
    prisma.user.findMany({
      where: { role: "DELIVERY_PARTNER", isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!order) notFound();

  return (
    <div>
      <Link href="/sales" className="text-sm text-royal-soft hover:text-gold-soft">← All sales</Link>
      <h1 className="mt-2 font-serif text-3xl text-royal">{order.orderNumber}</h1>
      <p className="mt-1 text-sm text-royal-soft">
        {order.customer.name} · {order.orderDate.toLocaleDateString("en-IN")} · {order.source.replace(/_/g, " ")} · {order.paymentMethod}
      </p>

      <Card className="mt-6 max-w-md">
        <ul className="space-y-1 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>{item.product.name} × {item.quantity}</span>
              <span>₹{item.unitPrice * item.quantity}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-royal-soft/15 pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
          <div className="flex justify-between"><span>GST</span><span>{order.gstAmount === 0 ? "₹0" : `₹${order.gstAmount}`}</span></div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{order.deliveryCharge === 0 ? "Free" : `₹${order.deliveryCharge}`}</span>
          </div>
          <div className="flex justify-between font-semibold text-royal"><span>Total</span><span>₹{order.total}</span></div>
        </div>
        {order.notes && (
          <div className="mt-3 border-t border-royal-soft/15 pt-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Notes</p>
            <p className="mt-1 text-ink">{order.notes}</p>
          </div>
        )}
        {order.deliveryNotes && (
          <div className="mt-3 border-t border-royal-soft/15 pt-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Delivery notes</p>
            <p className="mt-1 text-ink">{order.deliveryNotes}</p>
          </div>
        )}
      </Card>

      <Card className="mt-6 max-w-md">
        <h2 className="font-serif text-lg text-royal">Status</h2>
        <form action={updateOrderStatus} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="id" value={order.id} />
          <select
            name="status"
            defaultValue={order.status}
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
            Update
          </button>
        </form>
      </Card>

      <Card className="mt-6 max-w-md">
        <h2 className="font-serif text-lg text-royal">Delivery partner</h2>
        <p className="mt-1 text-xs text-royal-soft">Who's delivering this order — shows up in their app once assigned.</p>
        <form action={assignDeliveryPartner} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="id" value={order.id} />
          <select
            name="deliveryPartnerId"
            defaultValue={order.deliveryPartnerId ?? ""}
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            <option value="">Unassigned</option>
            {deliveryPartners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
            Assign
          </button>
        </form>
      </Card>

      <Card className="mt-6 max-w-md">
        <h2 className="font-serif text-lg text-royal">Payment</h2>
        <p className="mt-1 text-xs text-royal-soft">Update this once payment is actually collected.</p>
        <form action={updateOrderPaymentMethod} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="id" value={order.id} />
          <select
            name="paymentMethod"
            defaultValue={order.paymentMethod}
            className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p} value={p}>{p === "PENDING" ? "Pending / COD" : p}</option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
            Update
          </button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `cd crm && npm run dev`, open any order at `/sales/<id>`, use the new "Delivery partner" dropdown to assign the test rider from Task 5, submit, and confirm the page reloads showing that partner selected. Visit `/delivery-partners` and confirm that order now shows under that partner's assignments.

- [ ] **Step 4: Commit**

```bash
git add crm/app/\(app\)/sales/actions.ts "crm/app/(app)/sales/[id]/page.tsx"
git commit -m "feat(crm): assign a delivery partner from the order detail page"
```

---

### Task 9: Protect the new admin pages + document the rider API

**Files:**
- Modify: `crm/middleware.ts`
- Modify: `crm/README.md`

**Interfaces:** none (routing/config + docs only).

- [ ] **Step 1: Add the missing matcher entries**

`/users` and `/delivery-partners` currently render without requiring login — they're missing from the middleware's matcher. In `crm/middleware.ts`, change:

```ts
export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/pos/:path*",
    "/sales/:path*",
    "/purchases/:path*",
  ],
};
```

to:

```ts
export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/pos/:path*",
    "/sales/:path*",
    "/purchases/:path*",
    "/users/:path*",
    "/delivery-partners/:path*",
  ],
};
```

- [ ] **Step 2: Manual verification**

Log out of the CRM (or use a private browser window), then visit `http://localhost:3000/users` directly. Expected: redirected to `/login` (previously it would have rendered the page).

- [ ] **Step 3: Document the new API and env var**

Append to `crm/README.md`:

```markdown
## Delivery rider API

`/api/rider/*` is a separate, token-authenticated API for the Sadharmik
Delivery Android app (not the browser session used by the rest of the CRM).
A rider is a `User` row with `role: DELIVERY_PARTNER` — create one from
`/users`, then assign them to orders from an order's detail page
(`/sales/<id>`).

Requires `RIDER_TOKEN_SECRET` in `.env` (see `.env.example`) — a long random
string, separate from `CRM_SESSION_SECRET`.

Routes: `POST /api/rider/login`, `GET /api/rider/me`,
`GET /api/rider/orders?status=pending|complete|failed`,
`GET /api/rider/orders/:id`, `POST /api/rider/orders/:id/deliver`,
`POST /api/rider/orders/:id/fail`. All except `login` require
`Authorization: Bearer <token>`.

See `delivery-app/README.md` for the Android app itself.
```

- [ ] **Step 4: Commit**

```bash
git add crm/middleware.ts crm/README.md
git commit -m "fix(crm): require login for Users/Delivery Partners pages; document rider API"
```

---

## Part B — Delivery rider Android app (`delivery-app/`)

### Task 10: Scaffold the Expo app

**Files:**
- Create: `delivery-app/` (via `create-expo-app`, then modified below)
- Create: `delivery-app/theme.ts`
- Create: `delivery-app/lib/config.ts`
- Modify: `delivery-app/package.json`
- Modify: `delivery-app/app.json`

**Interfaces:**
- Produces: `theme` object (`{ colors: { background, surface, primary, primaryText, text, textMuted, danger, success, border } }`) and `API_BASE_URL: string` — every later screen imports these.

- [ ] **Step 1: Scaffold the project**

Run (from the repo root, `sadharmik & Co/`):

```bash
npx create-expo-app@latest delivery-app --template blank-typescript
cd delivery-app
npx expo install expo-router expo-linking expo-constants expo-status-bar expo-secure-store react-native-safe-area-context react-native-screens react-native-gesture-handler
```

Accept whatever exact versions `expo install` resolves — don't pin them manually.

- [ ] **Step 2: Wire up Expo Router**

In `delivery-app/package.json`, set:

```json
  "main": "expo-router/entry",
```

In `delivery-app/app.json`, inside the `"expo"` object, add (merge with whatever fields the scaffold already put there — don't remove `name`/`slug`/`version`/etc.):

```json
    "scheme": "sadharmikdelivery",
    "plugins": ["expo-router"],
```

- [ ] **Step 3: Remove the template's placeholder screen**

The `blank-typescript` template generates an `App.tsx` at the project root — delete it (`rm delivery-app/App.tsx`); Expo Router's file-based routing (the `app/` directory, built in the following tasks) replaces it entirely. If the scaffold also created a starter `app/` directory with example screens, delete its contents too — the tasks below create the real ones.

- [ ] **Step 4: Add the theme**

Create `delivery-app/theme.ts`:

```ts
export const theme = {
  colors: {
    background: "#0d2818",
    surface: "#123a22",
    primary: "#c9a227",
    primaryText: "#0d2818",
    text: "#f5efe0",
    textMuted: "#a9c2ae",
    danger: "#e05a4e",
    success: "#4caf7d",
    border: "#1e4a2c",
  },
};
```

- [ ] **Step 5: Add the API base URL config**

Create `delivery-app/lib/config.ts`:

```ts
// Local development: replace YOUR_COMPUTER_LAN_IP with your computer's
// IPv4 address on the WiFi network your phone is also on (find it with
// `ipconfig` on Windows — look for "IPv4 Address" under your active
// network adapter). Your phone can't reach "localhost" — that would mean
// the phone itself, not your computer.
//
// Once the CRM is deployed (a later phase, not this one), replace this
// whole value with that deployed URL instead.
export const API_BASE_URL = "http://YOUR_COMPUTER_LAN_IP:3000";
```

- [ ] **Step 6: Verify it runs**

Run: `cd delivery-app && npx expo start`

Expected: the Metro bundler starts and prints a QR code, with no red error screen when opened (a blank/default screen is fine — real screens come in later tasks).

- [ ] **Step 7: Commit**

```bash
cd delivery-app && git add -A && cd .. && git add delivery-app
git commit -m "feat(delivery-app): scaffold Expo app with router and theme"
```

---

### Task 11: API client and auth state

**Files:**
- Create: `delivery-app/lib/api.ts`
- Create: `delivery-app/lib/auth.tsx`

**Interfaces:**
- Consumes: `API_BASE_URL` (`./config`).
- Produces: `login(phone, password): Promise<{ok, error?}>`, `fetchMe(): Promise<RiderProfile | null>`, `fetchMyDeliveries(status): Promise<RiderOrder[]>`, `fetchOrder(id): Promise<RiderOrder>`, `markDelivered(id): Promise<{ok, error?}>`, `markFailed(id, reason): Promise<{ok, error?}>`, types `RiderProfile`, `RiderOrder` — consumed by every screen task (12–14). `AuthProvider`, `useAuth(): { isLoading, isLoggedIn, setLoggedIn, logout }` — consumed by Task 12's root layout and Task 14's profile screen.

- [ ] **Step 1: Implement the API client**

Create `delivery-app/lib/api.ts`:

```ts
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "sadharmik_rider_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
}

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

export async function login(phone: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/rider/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    return { ok: false, error: data.error ?? "Login failed." };
  }
  await setToken(data.token);
  return { ok: true };
}

export async function fetchMe(): Promise<RiderProfile | null> {
  const response = await authedFetch("/api/rider/me");
  if (!response.ok) return null;
  const data = await response.json();
  return data.ok ? data.rider : null;
}

export async function fetchMyDeliveries(status: "pending" | "complete" | "failed"): Promise<RiderOrder[]> {
  const response = await authedFetch(`/api/rider/orders?status=${status}`);
  if (!response.ok) throw new Error("Could not load deliveries.");
  const data = await response.json();
  if (!data.ok) throw new Error(data.error ?? "Could not load deliveries.");
  return data.orders;
}

export async function fetchOrder(orderId: string): Promise<RiderOrder> {
  const response = await authedFetch(`/api/rider/orders/${orderId}`);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not load order.");
  return data.order;
}

export async function markDelivered(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch(`/api/rider/orders/${orderId}/deliver`, { method: "POST" });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}

export async function markFailed(orderId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const response = await authedFetch(`/api/rider/orders/${orderId}/fail`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  const data = await response.json();
  return { ok: data.ok, error: data.error };
}
```

- [ ] **Step 2: Implement the auth context**

Create `delivery-app/lib/auth.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getToken, clearToken } from "./api";

interface AuthContextValue {
  isLoading: boolean;
  isLoggedIn: boolean;
  setLoggedIn: (value: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getToken().then((token) => {
      setIsLoggedIn(!!token);
      setIsLoading(false);
    });
  }, []);

  async function logout() {
    await clearToken();
    setIsLoggedIn(false);
  }

  return (
    <AuthContext.Provider value={{ isLoading, isLoggedIn, setLoggedIn: setIsLoggedIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider.");
  return ctx;
}
```

- [ ] **Step 3: Commit**

```bash
git add delivery-app/lib/api.ts delivery-app/lib/auth.tsx
git commit -m "feat(delivery-app): add API client and auth state"
```

(No automated tests for this task or the rest of Part B — per the spec's Testing approach, the Expo app is verified manually on a real device, matching this codebase's existing convention of not testing DB/network-touching functions.)

---

### Task 12: Root layout (auth guard) and Login screen

**Files:**
- Create: `delivery-app/app/_layout.tsx`
- Create: `delivery-app/app/login.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth` (`../lib/auth`), `login` (`../lib/api`), `theme` (`../theme`).
- Produces: route `/login`; redirects to `/(tabs)` once logged in (Task 13 creates that group) — so this task alone will show a login screen that, on success, tries to navigate to a route that doesn't exist yet. That's expected and fixed by the next task; verify only the login screen itself here.

- [ ] **Step 1: Root layout with auth-based redirect**

Create `delivery-app/app/_layout.tsx`:

```tsx
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../lib/auth";
import { theme } from "../theme";

function RootNavigation() {
  const { isLoading, isLoggedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "login";
    if (!isLoggedIn && !inAuthGroup) {
      router.replace("/login");
    } else if (isLoggedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoading, isLoggedIn, segments]);

  if (isLoading) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ title: "Delivery" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Login screen**

Create `delivery-app/app/login.tsx`:

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { login } from "../lib/api";
import { useAuth } from "../lib/auth";
import { theme } from "../theme";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setLoggedIn } = useAuth();
  const router = useRouter();

  async function handleSubmit() {
    setError(null);
    if (!phone.trim() || !password) {
      setError("Enter your phone and password.");
      return;
    }
    setIsSubmitting(true);
    const result = await login(phone.trim(), password);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Login failed.");
      return;
    }
    setLoggedIn(true);
    router.replace("/(tabs)");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sadharmik Delivery</Text>
      <Text style={styles.subtitle}>Driver Portal</Text>

      <TextInput
        style={styles.input}
        placeholder="Phone number"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", padding: 24 },
  title: { color: theme.colors.primary, fontSize: 28, fontWeight: "700", textAlign: "center" },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 32 },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  error: { color: theme.colors.danger, marginBottom: 12, textAlign: "center" },
  button: { backgroundColor: theme.colors.primary, borderRadius: 999, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: theme.colors.primaryText, fontWeight: "700", fontSize: 16 },
});
```

- [ ] **Step 3: Manual verification**

Before this step, edit `delivery-app/lib/config.ts` to use your actual LAN IP (see Task 15 for finding it), and run the CRM with `cd crm && npx next dev -H 0.0.0.0` so it accepts connections from your phone.

Run: `cd delivery-app && npx expo start`, open in Expo Go on your phone (same WiFi). Expected: the login screen renders (deep green background, gold title). Enter the test rider's phone/wrong password — expect the red error text to appear and the screen to stay on Login. This confirms the screen and the failure path; the success path is confirmed in Task 13 once `/(tabs)` exists.

- [ ] **Step 4: Commit**

```bash
git add delivery-app/app/_layout.tsx delivery-app/app/login.tsx
git commit -m "feat(delivery-app): add root layout with auth guard and login screen"
```

---

### Task 13: Tabs layout and My Deliveries screen

**Files:**
- Create: `delivery-app/app/(tabs)/_layout.tsx`
- Create: `delivery-app/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `fetchMyDeliveries`, `RiderOrder` (`../../lib/api`), `theme` (`../../theme`).
- Produces: route `/(tabs)` (default screen `index`) — the login screen (Task 12) redirects here on success; tapping a card navigates to `/order/[id]` (Task 14).

- [ ] **Step 1: Tabs layout**

Create `delivery-app/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { theme } from "../../theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "My Deliveries" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: My Deliveries screen**

Create `delivery-app/app/(tabs)/index.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchMyDeliveries, type RiderOrder } from "../../lib/api";
import { theme } from "../../theme";

type TabKey = "pending" | "complete" | "failed";
const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
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
        ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>No {activeTab} deliveries.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
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
  tabBar: { flexDirection: "row", padding: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: "600" },
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  vipBadge: { color: theme.colors.primary, fontWeight: "700" },
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

- [ ] **Step 3: Manual verification**

With the same rider logged in as Task 12, and the two orders assigned in Tasks 6–7's manual verification (one `OUT_FOR_DELIVERY`, one already `DELIVERED`/`FAILED` from those steps — assign a couple more via `/sales/<id>` in a browser if you reset them), log in on the phone. Expected: after login, lands on "My Deliveries", "Pending" tab shows the `OUT_FOR_DELIVERY` order as a card with the right customer/amount; switching to "Complete"/"Failed" shows the others; pull-to-refresh works; an empty tab shows "No … deliveries." rather than a blank screen.

- [ ] **Step 4: Commit**

```bash
git add "delivery-app/app/(tabs)"
git commit -m "feat(delivery-app): add tabs layout and My Deliveries screen"
```

---

### Task 14: Order detail screen

**Files:**
- Create: `delivery-app/app/order/[id].tsx`

**Interfaces:**
- Consumes: `fetchOrder`, `markDelivered`, `markFailed`, `RiderOrder` (`../../lib/api`), `theme` (`../../theme`).

- [ ] **Step 1: Implement the screen**

Create `delivery-app/app/order/[id].tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { fetchOrder, markDelivered, markFailed, type RiderOrder } from "../../lib/api";
import { theme } from "../../theme";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFailReason, setShowFailReason] = useState(false);
  const [failReason, setFailReason] = useState("");
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

  async function handleDeliver() {
    setIsSubmitting(true);
    const result = await markDelivered(id);
    setIsSubmitting(false);
    if (!result.ok) {
      Alert.alert("Couldn't update", result.error ?? "Please try again.");
      return;
    }
    router.back();
  }

  async function handleFail() {
    if (!failReason.trim()) {
      Alert.alert("Reason required", "Enter a short reason for the failed delivery.");
      return;
    }
    setIsSubmitting(true);
    const result = await markFailed(id, failReason.trim());
    setIsSubmitting(false);
    if (!result.ok) {
      Alert.alert("Couldn't update", result.error ?? "Please try again.");
      return;
    }
    router.back();
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

  const canAct = order.status === "OUT_FOR_DELIVERY";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {canAct && !showFailReason && (
        <View style={styles.footerButtons}>
          <Pressable style={styles.deliverButton} onPress={handleDeliver} disabled={isSubmitting}>
            <Text style={styles.deliverButtonText}>{isSubmitting ? "Updating…" : "Mark Delivered"}</Text>
          </Pressable>
          <Pressable style={styles.failButton} onPress={() => setShowFailReason(true)} disabled={isSubmitting}>
            <Text style={styles.failButtonText}>Mark Failed</Text>
          </Pressable>
        </View>
      )}

      {canAct && showFailReason && (
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
  footerButtons: { gap: 12 },
  deliverButton: { backgroundColor: theme.colors.success, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  deliverButtonText: { color: "#04150a", fontWeight: "700", fontSize: 16 },
  failButton: { backgroundColor: theme.colors.danger, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  failButtonText: { color: "#2a0705", fontWeight: "700", fontSize: 16 },
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

- [ ] **Step 2: Manual verification**

From the Pending list (Task 13), tap the assigned order. Expected: detail screen shows items/total, Call opens the phone dialer with the customer's number pre-filled, Navigate opens Google/Apple Maps with the address searched. Tap "Mark Failed", type a reason, "Confirm Failed" — expect it to navigate back and the order to have moved from Pending to the Failed tab. Repeat with a fresh assigned order and "Mark Delivered" instead — expect it to move to Complete. Re-open a now-Delivered order directly (e.g. from the Complete tab) — expect the Delivered/Failed buttons to be hidden (`canAct` is false) since it's no longer `OUT_FOR_DELIVERY`.

- [ ] **Step 3: Commit**

```bash
git add delivery-app/app/order
git commit -m "feat(delivery-app): add order detail screen with call/navigate/deliver/fail"
```

---

### Task 15: Profile screen, and local-run README

**Files:**
- Create: `delivery-app/app/(tabs)/profile.tsx`
- Create: `delivery-app/README.md`

**Interfaces:**
- Consumes: `fetchMe`, `RiderProfile` (`../../lib/api`), `useAuth` (`../../lib/auth`), `theme` (`../../theme`).

- [ ] **Step 1: Profile screen**

Create `delivery-app/app/(tabs)/profile.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchMe, type RiderProfile } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { theme } from "../../theme";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { logout } = useAuth();

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchMe().then((result) => {
        setProfile(result);
        setIsLoading(false);
      });
    }, [])
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <>
          <Text style={styles.name}>{profile?.name ?? "Unknown rider"}</Text>
          <Text style={styles.phone}>{profile?.phone}</Text>
        </>
      )}

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 16 },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: "700" },
  phone: { color: theme.colors.textMuted, marginTop: 4, marginBottom: 24 },
  logoutButton: { backgroundColor: theme.colors.danger, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  logoutText: { color: "#2a0705", fontWeight: "700" },
});
```

- [ ] **Step 2: Manual verification**

Open the Profile tab — expect the logged-in rider's real name/phone (from `/api/rider/me`). Tap Logout — expect an immediate redirect to the Login screen (via the root layout's effect from Task 12), and confirm you can log back in.

- [ ] **Step 3: Write the local-run README**

Create `delivery-app/README.md`:

```markdown
# Sadharmik Delivery — Rider App

An Android app (Expo/React Native) for Sadharmik & Co. delivery partners:
see the orders assigned to you, call/navigate to the customer, and mark each
one Delivered or Failed. Talks to the `crm/` app's `/api/rider/*` routes —
see `crm/README.md` for that side.

## Running it locally (current phase)

1. Find your computer's LAN IP: on Windows, run `ipconfig` and note the
   "IPv4 Address" under your active WiFi adapter (e.g. `192.168.1.42`).
2. Edit `lib/config.ts` and replace `YOUR_COMPUTER_LAN_IP` with that address.
3. Start the CRM so it accepts connections from other devices on the
   network: `cd ../crm && npx next dev -H 0.0.0.0`. If Windows Firewall
   prompts you the first time, allow access on your private/home network.
4. In this folder, run `npx expo start`, then scan the QR code with the
   Expo Go app on an Android phone connected to the **same WiFi network**.
5. Create a rider in the CRM at `/users` (role "Delivery Partner"), assign
   them an order from that order's `/sales/<id>` page, then log into the
   app with that rider's phone/password.

## Next phase (not done yet)

Once the app works end-to-end locally: deploy `crm/` to Vercel's free tier,
point `lib/config.ts` at that URL instead, then build a signed release APK
with `eas build --local` (free, no Play Store account) and share the APK
file directly with riders to sideload.
```

- [ ] **Step 4: Commit**

```bash
git add "delivery-app/app/(tabs)/profile.tsx" delivery-app/README.md
git commit -m "feat(delivery-app): add profile screen and local-run instructions"
```

---

## Self-Review Notes

- **Spec coverage:** Login (Task 12), My Deliveries w/ 3 tabs (Task 13), order detail w/ call/navigate/deliver/fail (Task 14), Profile+logout (Task 15), rider auth via bearer token (Tasks 3, 5), `Order.deliveryNotes`/`FAILED` (Task 1), reused `User`/`Role`/`deliveryPartnerId` (Tasks 1, 6–8), password hashing fix (Task 2), assign-partner UI (Task 8), local-first rollout (Tasks 10–15 all run against local dev) — all covered.
- **Deferred items double-checked absent:** no dashboard/stats screen, no balance/COD screen, no expenses screen, no PDF export, no rescheduling, no priority flag, no ratings, no pincode/service-area field anywhere above — correct per Non-goals.
- **Type consistency:** `RiderOrder` (Task 11) fields match the JSON shape produced by Tasks 6–7's routes field-for-field (`id, orderNumber, status, customerName, customerVipNumber, customerPhone, customerAddress, paymentMethod, total, deliveryNotes, items[]`). `RiderProfile` matches `/api/rider/me`'s `rider` shape. `TransitionCheck`/`canTransitionOrder` signature used identically in `deliverOrder`/`failOrder` (Task 4) and their tests.
- **No placeholders:** the one intentionally-environment-specific value (`YOUR_COMPUTER_LAN_IP` in `lib/config.ts`) mirrors this repo's own convention for such values (`.env.example`'s `"change-me"`), not a shortcut around real content.
