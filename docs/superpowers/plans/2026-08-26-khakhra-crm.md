# Sadharmik & Co. Internal CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, local, password-gated back-office web app (`crm/`) for Sadharmik & Co. covering customers, products, POS order creation, sales, and purchases, branded to match the public site.

**Architecture:** A standalone Next.js 15 (App Router) + TypeScript + Tailwind v4 app in a new `crm/` folder, sibling to the existing `index.html`. Data lives in a local SQLite database via Prisma — no cloud account, no network dependency. A single shared password (env var) gates every page behind a signed session cookie checked in middleware. Server Actions handle all writes (no separate API layer).

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Prisma ORM + SQLite, Vitest (for pure-logic unit tests).

## Global Constraints

- Monetary amounts are whole rupees (integers) — no paise, matching the public site's `₹` display convention.
- Delivery pricing reuses the public site's exact rule: pack = 500g, free delivery at ≥1000g (2 packs), otherwise a flat ₹70 delivery charge (from `index.html:811-818`).
- Low-stock threshold on the Dashboard is a stock quantity below 5 packs.
- No hard deletes of Customers/Products/Suppliers — they carry an `isActive` flag instead, so historical Orders/Purchases never reference a missing record.
- Single shared password auth via `CRM_PASSWORD` env var — no per-user accounts or roles.
- No external services (no Supabase, no cloud DB) in this phase — SQLite file on disk only.
- Branding reuses the public site's palette: royal blue `#0D2A57` (deep `#071A3B`, soft `#143669`), gold `#C9A24B` (light `#E7CB84`, soft `#9C7E32`), cream `#F2E7CC`, ivory `#FBF5E7`, ink `#0c1f44` — and its fonts, Cormorant Garamond (headings) + Mukta (body).
- POS is the single order-creation screen — no separate/duplicate order-entry UI.

---

### Task 1: Project scaffold & branding

**Files:**
- Create: `crm/package.json`
- Create: `crm/tsconfig.json`
- Create: `crm/next.config.ts`
- Create: `crm/postcss.config.mjs`
- Create: `crm/.gitignore`
- Create: `crm/.env.example`
- Create: `crm/.env`
- Create: `crm/app/globals.css`
- Create: `crm/app/layout.tsx`
- Create: `crm/app/page.tsx`

**Interfaces:**
- Produces: a runnable Next.js app on `http://localhost:3000` with the brand fonts/colors loaded, and Tailwind v4 tokens (`bg-royal`, `text-gold`, `font-serif`, etc.) available to every later task.

- [ ] **Step 1: Create the folder and `package.json`**

```bash
mkdir -p "crm"
```

`crm/package.json`:

```json
{
  "name": "sadharmik-crm",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.4.1",
    "next": "^15.5.15",
    "react": "19.1.2",
    "react-dom": "19.1.2"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "prisma": "^6.4.1",
    "tailwindcss": "^4",
    "tsx": "^4.19.2",
    "typescript": "^5.9.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Add TypeScript, Next, and PostCSS config**

`crm/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`crm/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`crm/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 3: Add `.gitignore` and env files**

`crm/.gitignore`:

```
node_modules
.next
prisma/dev.db
prisma/dev.db-journal
.env
```

`crm/.env.example`:

```
DATABASE_URL="file:./dev.db"
CRM_PASSWORD="change-me"
CRM_SESSION_SECRET="change-me-too"
```

`crm/.env` (real local values — never committed, `.gitignore`d above):

```
DATABASE_URL="file:./dev.db"
CRM_PASSWORD="sadharmik2026"
CRM_SESSION_SECRET="a-long-random-local-only-secret-string"
```

- [ ] **Step 4: Add branded global styles**

`crm/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-royal-deep: #071A3B;
  --color-royal: #0D2A57;
  --color-royal-soft: #143669;
  --color-gold: #C9A24B;
  --color-gold-2: #E7CB84;
  --color-gold-soft: #9C7E32;
  --color-cream: #F2E7CC;
  --color-ivory: #FBF5E7;
  --color-ink: #0c1f44;

  --font-serif: var(--font-cormorant), Georgia, serif;
  --font-sans: var(--font-mukta), system-ui, sans-serif;
}

body {
  background-color: var(--color-ivory);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```

- [ ] **Step 5: Add root layout with brand fonts**

`crm/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, Mukta } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
});

const mukta = Mukta({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-mukta",
});

export const metadata: Metadata = {
  title: "Sadharmik & Co. — CRM",
  description: "Internal order, customer and stock management for Sadharmik & Co.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${mukta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Add a placeholder home page**

`crm/app/page.tsx`:

```tsx
export default function RootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-royal-deep">
      <p className="font-serif text-3xl text-ivory">Sadharmik & Co. — CRM</p>
    </div>
  );
}
```

- [ ] **Step 7: Install and verify**

```bash
cd crm
npm install
npm run dev
```

Expected: server starts on `http://localhost:3000`. Open it (or `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000`) — expect `200`, and the page shows "Sadharmik & Co. — CRM" in serif font on a dark royal-blue background. Stop the dev server (Ctrl+C) before continuing.

- [ ] **Step 8: Commit**

```bash
git add crm/package.json crm/package-lock.json crm/tsconfig.json crm/next.config.ts crm/postcss.config.mjs crm/.gitignore crm/.env.example crm/app
git commit -m "feat(crm): scaffold Next.js app with brand theme

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(`crm/.env` stays untracked per `.gitignore` — do not force-add it.)

---

### Task 2: Prisma schema, client, and seed data

**Files:**
- Create: `crm/prisma/schema.prisma`
- Create: `crm/lib/prisma.ts`
- Create: `crm/prisma/seed.ts`

**Interfaces:**
- Consumes: `crm/.env`'s `DATABASE_URL` (Task 1).
- Produces: `prisma` client singleton at `crm/lib/prisma.ts` (`import { prisma } from "@/lib/prisma"`), and models `Product`, `Customer`, `Supplier`, `Order`, `OrderItem`, `Purchase`, `PurchaseItem` with the fields listed below — every later task's Prisma queries rely on these exact field names.

- [ ] **Step 1: Write the schema**

`crm/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Product {
  id         String      @id @default(cuid())
  name       String      @unique
  packSize   String
  price      Int
  stock      Int         @default(0)
  isActive   Boolean     @default(true)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  orderItems OrderItem[]
}

model Customer {
  id        String   @id @default(cuid())
  name      String
  phone     String
  whatsapp  String?
  address   String
  notes     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  orders    Order[]
}

model Supplier {
  id            String     @id @default(cuid())
  name          String
  phone         String
  itemsSupplied String?
  notes         String?
  isActive      Boolean    @default(true)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  purchases     Purchase[]
}

enum OrderStatus {
  NEW
  ROASTING
  OUT_FOR_DELIVERY
  DELIVERED
}

enum OrderSource {
  WEBSITE
  WHATSAPP
  PHONE
  WALK_IN
}

model Order {
  id             String      @id @default(cuid())
  orderNumber    String      @unique
  customerId     String
  customer       Customer    @relation(fields: [customerId], references: [id])
  status         OrderStatus @default(NEW)
  source         OrderSource @default(WALK_IN)
  subtotal       Int
  deliveryCharge Int
  total          Int
  orderDate      DateTime    @default(now())
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  items          OrderItem[]
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id])
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Int
}

enum PaidStatus {
  PAID
  DUE
  PARTIAL
}

model Purchase {
  id           String         @id @default(cuid())
  supplierId   String
  supplier     Supplier       @relation(fields: [supplierId], references: [id])
  purchaseDate DateTime       @default(now())
  total        Int
  paidStatus   PaidStatus     @default(DUE)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  items        PurchaseItem[]
}

model PurchaseItem {
  id         String   @id @default(cuid())
  purchaseId String
  purchase   Purchase @relation(fields: [purchaseId], references: [id])
  itemName   String
  quantity   Float
  unit       String
  rate       Int
  amount     Int
}
```

- [ ] **Step 2: Add the Prisma client singleton**

`crm/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Run the migration**

```bash
cd crm
npx prisma migrate dev --name init
```

Expected: output ends with `Your database is now in sync with your schema.` and a new `crm/prisma/dev.db` file exists.

- [ ] **Step 4: Write the seed script**

`crm/prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FLAVOURS = [
  "Ghee Sada",
  "Ghee Jeera",
  "Methi Masala",
  "Special Masala",
  "Methi",
  "Punjabi",
  "Nachani",
  "Jeera Masala",
];

function computeDelivery(packs: number): number {
  return packs * 500 >= 1000 ? 0 : 70;
}

async function main() {
  for (const name of FLAVOURS) {
    await prisma.product.upsert({
      where: { name },
      update: {},
      create: { name, packSize: "500g", price: 160, stock: 20 },
    });
  }

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-priya" },
    update: {},
    create: {
      id: "seed-customer-priya",
      name: "Priya Shah",
      phone: "9820012345",
      whatsapp: "9820012345",
      address: "12 Laxmi Nivas, Ghatkopar East, Mumbai 400077",
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: "seed-supplier-om" },
    update: {},
    create: {
      id: "seed-supplier-om",
      name: "Om Flour Mills",
      phone: "9821099999",
      itemsSupplied: "Wheat flour, packaging",
    },
  });

  const gheeSada = await prisma.product.findUniqueOrThrow({ where: { name: "Ghee Sada" } });
  const methi = await prisma.product.findUniqueOrThrow({ where: { name: "Methi" } });

  const packs = 2 + 1;
  const subtotal = gheeSada.price * 2 + methi.price * 1;
  const delivery = computeDelivery(packs);

  const existingOrder = await prisma.order.findUnique({ where: { orderNumber: "SDK000000001" } });
  if (!existingOrder) {
    await prisma.order.create({
      data: {
        orderNumber: "SDK000000001",
        customerId: customer.id,
        status: "DELIVERED",
        source: "WHATSAPP",
        subtotal,
        deliveryCharge: delivery,
        total: subtotal + delivery,
        items: {
          create: [
            { productId: gheeSada.id, quantity: 2, unitPrice: gheeSada.price },
            { productId: methi.id, quantity: 1, unitPrice: methi.price },
          ],
        },
      },
    });
  }

  const existingPurchase = await prisma.purchase.findFirst({ where: { supplierId: supplier.id } });
  if (!existingPurchase) {
    await prisma.purchase.create({
      data: {
        supplierId: supplier.id,
        total: 25 * 40,
        paidStatus: "PAID",
        items: {
          create: [{ itemName: "Wheat flour", quantity: 25, unit: "kg", rate: 40, amount: 25 * 40 }],
        },
      },
    });
  }

  console.log(`Seeded ${FLAVOURS.length} products, 1 customer, 1 supplier, 1 order, 1 purchase.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 5: Run the seed and verify**

```bash
cd crm
npx prisma db seed
```

Expected: prints `Seeded 8 products, 1 customer, 1 supplier, 1 order, 1 purchase.` Re-running the same command should print the same line without erroring (the `upsert`/existence checks make it idempotent).

- [ ] **Step 6: Commit**

```bash
git add crm/prisma crm/lib/prisma.ts
git commit -m "feat(crm): add Prisma schema, client, and seed data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Money calculation module

**Files:**
- Create: `crm/lib/money.ts`
- Create: `crm/lib/money.test.ts`
- Create: `crm/vitest.config.ts`

**Interfaces:**
- Produces: `BillLine { quantity: number; unitPrice: number }`, `computeDeliveryCharge(packCount: number): number`, `computeSubtotal(lines: BillLine[]): number`, `computeOrderTotals(lines: BillLine[]): { packs: number; subtotal: number; delivery: number; total: number }`, `computePurchaseTotal(lines: { quantity: number; rate: number }[]): number`. Consumed by Task 13 (POS) and Task 15 (Purchases).

- [ ] **Step 1: Add the Vitest config**

`crm/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 2: Write the failing tests**

`crm/lib/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeDeliveryCharge, computeOrderTotals, computePurchaseTotal, computeSubtotal } from "./money";

describe("computeDeliveryCharge", () => {
  it("charges ₹70 for 1 pack (500g)", () => {
    expect(computeDeliveryCharge(1)).toBe(70);
  });

  it("is free at exactly 2 packs (1000g)", () => {
    expect(computeDeliveryCharge(2)).toBe(0);
  });

  it("is free above 2 packs", () => {
    expect(computeDeliveryCharge(5)).toBe(0);
  });

  it("charges ₹70 for 0 packs", () => {
    expect(computeDeliveryCharge(0)).toBe(70);
  });
});

describe("computeSubtotal", () => {
  it("sums quantity × unitPrice across lines", () => {
    expect(
      computeSubtotal([
        { quantity: 2, unitPrice: 160 },
        { quantity: 1, unitPrice: 160 },
      ])
    ).toBe(480);
  });

  it("is 0 for no lines", () => {
    expect(computeSubtotal([])).toBe(0);
  });
});

describe("computeOrderTotals", () => {
  it("combines packs, subtotal, delivery and total", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }]);
    expect(result).toEqual({ packs: 1, subtotal: 160, delivery: 70, total: 230 });
  });

  it("gives free delivery at 2 packs", () => {
    const result = computeOrderTotals([{ quantity: 2, unitPrice: 160 }]);
    expect(result).toEqual({ packs: 2, subtotal: 320, delivery: 0, total: 320 });
  });
});

describe("computePurchaseTotal", () => {
  it("sums quantity × rate across purchase lines", () => {
    expect(
      computePurchaseTotal([
        { quantity: 25, rate: 40 },
        { quantity: 5, rate: 300 },
      ])
    ).toBe(2500);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd crm
npx vitest run lib/money.test.ts
```

Expected: FAIL — `Cannot find module './money'` (the module doesn't exist yet).

- [ ] **Step 4: Implement `money.ts`**

`crm/lib/money.ts`:

```ts
export const PACK_WEIGHT_GRAMS = 500;
export const FREE_DELIVERY_WEIGHT_GRAMS = 1000;
export const DELIVERY_CHARGE_RUPEES = 70;

export interface BillLine {
  quantity: number;
  unitPrice: number;
}

export interface OrderTotals {
  packs: number;
  subtotal: number;
  delivery: number;
  total: number;
}

export function totalPacks(lines: BillLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function computeDeliveryCharge(packCount: number): number {
  return packCount * PACK_WEIGHT_GRAMS >= FREE_DELIVERY_WEIGHT_GRAMS ? 0 : DELIVERY_CHARGE_RUPEES;
}

export function computeSubtotal(lines: BillLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export function computeOrderTotals(lines: BillLine[]): OrderTotals {
  const packs = totalPacks(lines);
  const subtotal = computeSubtotal(lines);
  const delivery = computeDeliveryCharge(packs);
  return { packs, subtotal, delivery, total: subtotal + delivery };
}

export function computePurchaseTotal(lines: { quantity: number; rate: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd crm
npx vitest run lib/money.test.ts
```

Expected: PASS — all 8 tests green.

- [ ] **Step 6: Commit**

```bash
git add crm/lib/money.ts crm/lib/money.test.ts crm/vitest.config.ts
git commit -m "feat(crm): add order/delivery money calculations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Order number generator

**Files:**
- Create: `crm/lib/order-number.ts`
- Create: `crm/lib/order-number.test.ts`

**Interfaces:**
- Produces: `generateOrderNumber(date: Date, sequence: number): string` → format `SDK{YY}{MM}{DD}{seq, 3 digits}`. Consumed by Task 13 (POS).

- [ ] **Step 1: Write the failing test**

`crm/lib/order-number.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateOrderNumber } from "./order-number";

describe("generateOrderNumber", () => {
  it("formats as SDK + YYMMDD + 3-digit sequence", () => {
    expect(generateOrderNumber(new Date(2026, 7, 26), 1)).toBe("SDK260826001");
  });

  it("pads sequence numbers past 9", () => {
    expect(generateOrderNumber(new Date(2026, 7, 26), 42)).toBe("SDK260826042");
  });

  it("pads single-digit months and days", () => {
    expect(generateOrderNumber(new Date(2026, 0, 5), 1)).toBe("SDK260105001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd crm
npx vitest run lib/order-number.test.ts
```

Expected: FAIL with `Cannot find module './order-number'`.

- [ ] **Step 3: Implement `order-number.ts`**

`crm/lib/order-number.ts`:

```ts
export function generateOrderNumber(date: Date, sequence: number): string {
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");
  return `SDK${y}${m}${d}${seq}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd crm
npx vitest run lib/order-number.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add crm/lib/order-number.ts crm/lib/order-number.test.ts
git commit -m "feat(crm): add order number generator

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Auth module (shared password + signed session)

**Files:**
- Create: `crm/lib/auth.ts`
- Create: `crm/lib/auth.test.ts`

**Interfaces:**
- Consumes: `process.env.CRM_PASSWORD`, `process.env.CRM_SESSION_SECRET` (Task 1).
- Produces: `SESSION_COOKIE_NAME: string`, `checkPassword(input: string): boolean`, `signSession(): string`, `verifySession(token: string | undefined): boolean`. Consumed by Task 6 (login + middleware) and Task 8 (logout).

- [ ] **Step 1: Write the failing tests**

`crm/lib/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { checkPassword, signSession, verifySession } from "./auth";

describe("checkPassword", () => {
  beforeEach(() => {
    process.env.CRM_PASSWORD = "sadharmik2026";
  });

  it("accepts the correct password", () => {
    expect(checkPassword("sadharmik2026")).toBe(true);
  });

  it("rejects an incorrect password", () => {
    expect(checkPassword("wrong-password")).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(checkPassword("")).toBe(false);
  });
});

describe("signSession / verifySession", () => {
  beforeEach(() => {
    process.env.CRM_SESSION_SECRET = "test-secret";
  });

  it("verifies a token it just signed", () => {
    const token = signSession();
    expect(verifySession(token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = signSession();
    expect(verifySession(token + "x")).toBe(false);
  });

  it("rejects an undefined token", () => {
    expect(verifySession(undefined)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSession();
    process.env.CRM_SESSION_SECRET = "a-different-secret";
    expect(verifySession(token)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd crm
npx vitest run lib/auth.test.ts
```

Expected: FAIL with `Cannot find module './auth'`.

- [ ] **Step 3: Implement `auth.ts`**

`crm/lib/auth.ts`:

```ts
import crypto from "crypto";

export const SESSION_COOKIE_NAME = "sdhmk_crm_session";

const SESSION_VALUE = "authenticated";

function getSecret(): string {
  return process.env.CRM_SESSION_SECRET || "insecure-dev-secret";
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.CRM_PASSWORD || "";
  if (!expected || !input) return false;
  return timingSafeStringEqual(input, expected);
}

export function signSession(): string {
  const hmac = crypto.createHmac("sha256", getSecret()).update(SESSION_VALUE).digest("hex");
  return `${SESSION_VALUE}.${hmac}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [value, hmac] = token.split(".");
  if (!value || !hmac || value !== SESSION_VALUE) return false;
  const expected = crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
  return timingSafeStringEqual(expected, hmac);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd crm
npx vitest run lib/auth.test.ts
```

Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add crm/lib/auth.ts crm/lib/auth.test.ts
git commit -m "feat(crm): add shared-password auth with signed session cookie

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Login page, middleware, and root redirect

**Files:**
- Create: `crm/app/login/page.tsx`
- Create: `crm/app/login/actions.ts`
- Create: `crm/middleware.ts`
- Modify: `crm/app/page.tsx`

**Interfaces:**
- Consumes: `checkPassword`, `signSession`, `verifySession`, `SESSION_COOKIE_NAME` from `crm/lib/auth.ts` (Task 5).
- Produces: unauthenticated requests to any of `/dashboard`, `/customers`, `/products`, `/pos`, `/sales`, `/purchases` (and their sub-paths) redirect to `/login`; a correct password sets the session cookie and redirects to `/dashboard`.

- [ ] **Step 1: Write the login server action**

`crm/app/login/actions.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, signSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export interface LoginState {
  error: string;
}

export async function login(_prevState: LoginState | null, formData: FormData): Promise<LoginState | null> {
  const password = String(formData.get("password") ?? "");

  if (!checkPassword(password)) {
    return { error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signSession(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/dashboard");
}
```

- [ ] **Step 2: Write the login page**

`crm/app/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState | null, FormData>(login, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-royal-deep px-4">
      <form action={formAction} className="w-full max-w-sm rounded-2xl border border-royal-soft/30 bg-royal p-8">
        <p className="font-serif text-2xl text-ivory">Sadharmik & Co.</p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-gold">CRM login</p>
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="mt-8 w-full rounded-xl border border-royal-soft/40 bg-white/5 px-4 py-2.5 text-sm text-cream outline-none focus:border-gold"
        />
        {state?.error && <p className="mt-3 text-sm text-red-300">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep disabled:opacity-60"
        >
          {pending ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Write the middleware**

`crm/middleware.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth";

export const runtime = "nodejs";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!verifySession(token)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/pos/:path*",
    "/sales/:path*",
    "/purchases/:path*",
  ],
};
```

- [ ] **Step 4: Redirect the root page**

Replace `crm/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
```

- [ ] **Step 5: Verify manually**

```bash
cd crm
npm run dev
```

In another terminal:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/dashboard
```

Expected: a redirect response whose location is `/login` (unauthenticated). Then open `http://localhost:3000/login` in a browser, submit the password from `crm/.env` (`sadharmik2026`) — expect it redirects towards `/dashboard` (a 404 page is fine for now; `/dashboard` doesn't exist until Task 9 — the important part is the cookie was set and no "Incorrect password" error appeared). Submitting a wrong password should show "Incorrect password." inline. Stop the dev server before continuing.

- [ ] **Step 6: Commit**

```bash
git add crm/app/login crm/middleware.ts crm/app/page.tsx
git commit -m "feat(crm): add login page and auth middleware

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Shared UI primitives

**Files:**
- Create: `crm/components/ui.tsx`

**Interfaces:**
- Produces: `Button`, `Input`, `Card`, `Badge`, `Table`, `StatCard` React components, all styled with the brand theme tokens from Task 1. Consumed by Tasks 8–15.

- [ ] **Step 1: Implement the primitives**

`crm/components/ui.tsx`:

```tsx
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  className = "",
  variant = "gold",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "ghost" }) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    gold: "bg-gold text-royal-deep shadow-[0_10px_24px_-10px_rgba(201,162,75,.6)]",
    ghost: "border border-royal-soft/40 text-royal bg-transparent",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-royal-soft/15 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "warning";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-royal-soft/10 text-royal",
    gold: "bg-gold/20 text-gold-soft",
    warning: "bg-red-100 text-red-700",
  };
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-royal-soft/15 bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">{children}</table>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">{label}</p>
      <p className="mt-2 font-serif text-3xl text-royal">{value}</p>
      {hint && <p className="mt-1 text-xs text-royal-soft">{hint}</p>}
    </Card>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd crm
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add crm/components/ui.tsx
git commit -m "feat(crm): add shared UI primitives

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Authenticated app shell

**Files:**
- Create: `crm/components/Sidebar.tsx`
- Create: `crm/app/(app)/actions.ts`
- Create: `crm/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `SESSION_COOKIE_NAME` from `crm/lib/auth.ts` (Task 5).
- Produces: `crm/app/(app)/layout.tsx` wraps every page placed under `app/(app)/` with a sidebar + logout button. Tasks 9–15 place their pages inside this route group.

- [ ] **Step 1: Write the logout action**

`crm/app/(app)/actions.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
```

- [ ] **Step 2: Write the sidebar**

`crm/components/Sidebar.tsx`:

```tsx
import Link from "next/link";
import { logout } from "@/app/(app)/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/pos", label: "POS / New order" },
  { href: "/sales", label: "Sales" },
  { href: "/purchases", label: "Purchases" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-none flex-col justify-between border-r border-royal-soft/15 bg-royal-deep px-5 py-8 text-cream">
      <div>
        <p className="font-serif text-xl text-ivory">Sadharmik & Co.</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-gold">CRM</p>
        <nav className="mt-10 flex flex-col gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-cream/80 transition-colors hover:bg-white/5 hover:text-gold-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-lg border border-royal-soft/40 px-3 py-2 text-left text-sm text-cream/70 hover:border-gold hover:text-gold-2"
        >
          Log out
        </button>
      </form>
    </aside>
  );
}
```

- [ ] **Step 3: Write the shell layout**

`crm/app/(app)/layout.tsx`:

```tsx
import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ivory">
      <Sidebar />
      <main className="flex-1 p-10">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Add a temporary page to verify the shell renders**

`crm/app/(app)/dashboard/page.tsx` (placeholder — replaced fully in Task 9):

```tsx
export default function DashboardPage() {
  return <h1 className="font-serif text-3xl text-royal">Dashboard</h1>;
}
```

- [ ] **Step 5: Verify manually**

```bash
cd crm
npm run dev
```

Log in at `http://localhost:3000/login` with the password from `crm/.env`, then visit `http://localhost:3000/dashboard`. Expected: a dark sidebar on the left with "Sadharmik & Co." / "CRM" and six nav links, "Dashboard" heading in the main area, and clicking "Log out" returns you to `/login`. Stop the dev server before continuing.

- [ ] **Step 6: Commit**

```bash
git add "crm/app/(app)" crm/components/Sidebar.tsx
git commit -m "feat(crm): add authenticated app shell with sidebar nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Dashboard page

**Files:**
- Modify: `crm/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 2), `StatCard`, `Card`, `Badge` (Task 7).
- Produces: the real Dashboard — today/week/month sales stats, low-stock list, recent orders.

- [ ] **Step 1: Implement the dashboard**

Replace `crm/app/(app)/dashboard/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { Card, StatCard, Badge } from "@/components/ui";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday-start week
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff));
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function salesSince(date: Date) {
  const orders = await prisma.order.findMany({ where: { orderDate: { gte: date } } });
  return {
    total: orders.reduce((sum, o) => sum + o.total, 0),
    count: orders.length,
  };
}

export default async function DashboardPage() {
  const now = new Date();
  const [today, week, month, lowStock, recentOrders] = await Promise.all([
    salesSince(startOfDay(now)),
    salesSince(startOfWeek(now)),
    salesSince(startOfMonth(now)),
    prisma.product.findMany({ where: { isActive: true, stock: { lt: 5 } }, orderBy: { stock: "asc" } }),
    prisma.order.findMany({ orderBy: { orderDate: "desc" }, take: 8, include: { customer: true } }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Dashboard</h1>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Today" value={`₹${today.total}`} hint={`${today.count} orders`} />
        <StatCard label="This week" value={`₹${week.total}`} hint={`${week.count} orders`} />
        <StatCard label="This month" value={`₹${month.total}`} hint={`${month.count} orders`} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-xl text-royal">Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-royal-soft">Everything is well stocked.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <Badge tone="warning">{p.stock} left</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-serif text-xl text-royal">Recent orders</h2>
          {recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-royal-soft">No orders yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span>{o.orderNumber} · {o.customer.name}</span>
                  <span className="font-semibold text-royal">₹{o.total}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

```bash
cd crm
npm run dev
```

Log in, visit `/dashboard`. Expected: three stat cards ("Today", "This week", "This month" — the seeded order from Task 2 counts towards week/month totals unless it lands on a different calendar week/month than today, which is fine), a "Low stock" card (empty message, since seeded stock is 20 per product), and "Recent orders" showing `SDK000000001 · Priya Shah` with `₹480` (if 2 packs of Ghee Sada @160 + 1 Methi @160 = 480, free delivery at 3 packs = 1500g ≥ 1000g). Stop the dev server before continuing.

- [ ] **Step 3: Commit**

```bash
git add "crm/app/(app)/dashboard"
git commit -m "feat(crm): implement dashboard with sales stats and low-stock alerts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Products page (item master)

**Files:**
- Create: `crm/app/(app)/products/actions.ts`
- Create: `crm/app/(app)/products/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 2), `Button`, `Card`, `Input`, `Table` (Task 7).
- Produces: `/products` — list, add, and inline edit of Products.

- [ ] **Step 1: Write the server actions**

`crm/app/(app)/products/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const packSize = String(formData.get("packSize") ?? "").trim();
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock"));

  if (!name || !packSize || !Number.isFinite(price) || !Number.isFinite(stock)) {
    throw new Error("All product fields are required.");
  }

  await prisma.product.create({ data: { name, packSize, price, stock } });
  revalidatePath("/products");
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const price = Number(formData.get("price"));
  const stock = Number(formData.get("stock"));
  const isActive = formData.get("isActive") === "on";

  if (!id) throw new Error("Missing product id.");

  await prisma.product.update({ where: { id }, data: { price, stock, isActive } });
  revalidatePath("/products");
}
```

- [ ] **Step 2: Write the page**

`crm/app/(app)/products/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { Button, Card, Input, Table } from "@/components/ui";
import { createProduct, updateProduct } from "./actions";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Products</h1>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Add product</h2>
        <form action={createProduct} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input name="name" placeholder="Flavour name" required />
          <Input name="packSize" placeholder="Pack size (e.g. 500g)" required />
          <Input name="price" type="number" min="0" placeholder="Price (₹)" required />
          <Input name="stock" type="number" min="0" placeholder="Stock" required />
          <Button type="submit" className="justify-center sm:col-span-4">Add product</Button>
        </form>
      </Card>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Pack</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Stock</th>
            <th className="px-4 py-3">Active</th>
            <th className="px-4 py-3">Save</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-royal-soft/10 last:border-0">
              <form action={updateProduct} className="contents">
                <td className="px-4 py-3">
                  {p.name}
                  <input type="hidden" name="id" value={p.id} />
                </td>
                <td className="px-4 py-3">{p.packSize}</td>
                <td className="px-4 py-3">
                  <Input name="price" type="number" min="0" defaultValue={p.price} className="w-24" />
                </td>
                <td className="px-4 py-3">
                  <Input name="stock" type="number" min="0" defaultValue={p.stock} className="w-20" />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" name="isActive" defaultChecked={p.isActive} />
                </td>
                <td className="px-4 py-3">
                  <Button type="submit" variant="ghost">Save</Button>
                </td>
              </form>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
cd crm
npm run dev
```

Log in, visit `/products`. Expected: the 8 seeded flavours listed at ₹160/500g, stock 20 each. Add a product ("Test Flavour", "250g", 99, 10) — it appears in the list. Change a row's stock number and click that row's "Save" — reload the page and confirm the new value persisted. Stop the dev server before continuing.

- [ ] **Step 4: Commit**

```bash
git add "crm/app/(app)/products"
git commit -m "feat(crm): add products (item master) page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Customers page (list, search, add)

**Files:**
- Create: `crm/app/(app)/customers/actions.ts`
- Create: `crm/app/(app)/customers/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 2), `Button`, `Card`, `Input`, `Table` (Task 7).
- Produces: `/customers` — searchable list + add form. `/customers?q=...` filters by name/phone substring.

- [ ] **Step 1: Write the server action**

`crm/app/(app)/customers/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !phone || !address) {
    throw new Error("Name, phone and address are required.");
  }

  await prisma.customer.create({
    data: { name, phone, whatsapp: phone, address, notes: notes || null },
  });
  revalidatePath("/customers");
}
```

- [ ] **Step 2: Write the page**

`crm/app/(app)/customers/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button, Card, Input, Table } from "@/components/ui";
import { createCustomer } from "./actions";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: q
      ? { isActive: true, OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
      : { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Customers</h1>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Add customer</h2>
        <form action={createCustomer} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input name="name" placeholder="Name" required />
          <Input name="phone" placeholder="Phone" required />
          <Input name="address" placeholder="Address" required className="sm:col-span-2" />
          <Input name="notes" placeholder="Notes (optional)" className="sm:col-span-2" />
          <Button type="submit" className="justify-center sm:col-span-2">Add customer</Button>
        </form>
      </Card>

      <form className="mt-6 max-w-sm" action="/customers">
        <Input name="q" placeholder="Search by name or phone" defaultValue={q ?? ""} />
      </form>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Address</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b border-royal-soft/10 last:border-0">
              <td className="px-4 py-3">
                <Link href={`/customers/${c.id}`} className="font-semibold text-royal hover:text-gold-soft">
                  {c.name}
                </Link>
              </td>
              <td className="px-4 py-3">{c.phone}</td>
              <td className="px-4 py-3">{c.address}</td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-sm text-royal-soft">No customers found.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
cd crm
npm run dev
```

Log in, visit `/customers`. Expected: "Priya Shah" listed with phone `9820012345`. Add a new customer and confirm it appears. Search `q=Priya` and confirm only Priya shows; search `q=zzz` and confirm the "No customers found." empty state appears. Stop the dev server before continuing.

- [ ] **Step 4: Commit**

```bash
git add "crm/app/(app)/customers/actions.ts" "crm/app/(app)/customers/page.tsx"
git commit -m "feat(crm): add customers list, search, and add form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Customer detail page (order history)

**Files:**
- Create: `crm/app/(app)/customers/[id]/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 2), `Card` (Task 7).
- Produces: `/customers/[id]` — a single customer's lifetime spend and full order history.

- [ ] **Step 1: Write the page**

`crm/app/(app)/customers/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { orderDate: "desc" },
        include: { items: { include: { product: true } } },
      },
    },
  });

  if (!customer) notFound();

  const lifetimeTotal = customer.orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div>
      <Link href="/customers" className="text-sm text-royal-soft hover:text-gold-soft">← All customers</Link>
      <h1 className="mt-2 font-serif text-3xl text-royal">{customer.name}</h1>
      <p className="mt-1 text-sm text-royal-soft">{customer.phone} · {customer.address}</p>

      <Card className="mt-6 max-w-xs">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Lifetime spend</p>
        <p className="mt-2 font-serif text-3xl text-royal">₹{lifetimeTotal}</p>
      </Card>

      <h2 className="mt-8 font-serif text-xl text-royal">Order history</h2>
      {customer.orders.length === 0 ? (
        <p className="mt-3 text-sm text-royal-soft">No orders yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {customer.orders.map((o) => (
            <Card key={o.id}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-royal">{o.orderNumber}</p>
                <p className="font-serif text-lg text-gold-soft">₹{o.total}</p>
              </div>
              <p className="mt-1 text-xs text-royal-soft">
                {o.orderDate.toLocaleDateString("en-IN")} · {o.status.replace(/_/g, " ")}
              </p>
              <ul className="mt-2 text-sm text-ink">
                {o.items.map((item) => (
                  <li key={item.id}>{item.product.name} × {item.quantity}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

```bash
cd crm
npm run dev
```

Log in, go to `/customers`, click "Priya Shah". Expected: lifetime spend `₹480`, and one order card `SDK000000001` listing "Ghee Sada × 2" and "Methi × 1". Visit a nonsense id, e.g. `/customers/does-not-exist` — expect a 404 page. Stop the dev server before continuing.

- [ ] **Step 3: Commit**

```bash
git add "crm/app/(app)/customers/[id]"
git commit -m "feat(crm): add customer detail page with order history

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: POS / New order page

**Files:**
- Create: `crm/app/(app)/pos/actions.ts`
- Create: `crm/app/(app)/pos/PosClient.tsx`
- Create: `crm/app/(app)/pos/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 2), `computeOrderTotals`, `BillLine` (Task 3), `generateOrderNumber` (Task 4), `Button`, `Card`, `Input` (Task 7).
- Produces: `/pos` — the order-creation screen. `createOrder(customerId: string, lines: { productId: string; quantity: number }[]): Promise<{ ok: boolean; error?: string; orderNumber?: string }>` and `addCustomerInline(name, phone, address): Promise<Customer>`, both callable from client code.

- [ ] **Step 1: Write the server actions**

`crm/app/(app)/pos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeOrderTotals, type BillLine } from "@/lib/money";
import { generateOrderNumber } from "@/lib/order-number";

export interface PosLine {
  productId: string;
  quantity: number;
}

export interface CreateOrderResult {
  ok: boolean;
  error?: string;
  orderNumber?: string;
}

export async function createOrder(customerId: string, lines: PosLine[]): Promise<CreateOrderResult> {
  if (!customerId) return { ok: false, error: "Select a customer first." };

  const activeLines = lines.filter((l) => l.quantity > 0);
  if (activeLines.length === 0) return { ok: false, error: "Add at least one item." };

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: activeLines.map((l) => l.productId) } },
    });

    const billLines: BillLine[] = activeLines.map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) throw new Error("Unknown product in order.");
      if (line.quantity > product.stock) {
        throw new Error(`Only ${product.stock} left of ${product.name}.`);
      }
      return { quantity: line.quantity, unitPrice: product.price };
    });

    const totals = computeOrderTotals(billLines);

    const todayCount = await prisma.order.count({
      where: { orderDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    const orderNumber = generateOrderNumber(new Date(), todayCount + 1);

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          orderNumber,
          customerId,
          subtotal: totals.subtotal,
          deliveryCharge: totals.delivery,
          total: totals.total,
          items: {
            create: activeLines.map((line) => {
              const product = products.find((p) => p.id === line.productId)!;
              return { productId: line.productId, quantity: line.quantity, unitPrice: product.price };
            }),
          },
        },
      });

      for (const line of activeLines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
      }
    });

    revalidatePath("/pos");
    revalidatePath("/sales");
    revalidatePath("/dashboard");
    revalidatePath(`/customers/${customerId}`);

    return { ok: true, orderNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the order." };
  }
}

export async function addCustomerInline(name: string, phone: string, address: string) {
  if (!name.trim() || !phone.trim() || !address.trim()) {
    throw new Error("Name, phone and address are required.");
  }
  const customer = await prisma.customer.create({
    data: { name: name.trim(), phone: phone.trim(), whatsapp: phone.trim(), address: address.trim() },
  });
  revalidatePath("/pos");
  revalidatePath("/customers");
  return customer;
}
```

- [ ] **Step 2: Write the client component**

`crm/app/(app)/pos/PosClient.tsx`:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { computeOrderTotals } from "@/lib/money";
import { Button, Card, Input } from "@/components/ui";
import { addCustomerInline, createOrder } from "./actions";

interface ProductOption {
  id: string;
  name: string;
  packSize: string;
  price: number;
  stock: number;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export function PosClient({ products, customers }: { products: ProductOption[]; customers: CustomerOption[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [customerList, setCustomerList] = useState(customers);
  const [isPending, startTransition] = useTransition();

  const billLines = useMemo(
    () =>
      products
        .filter((p) => (quantities[p.id] ?? 0) > 0)
        .map((p) => ({ quantity: quantities[p.id], unitPrice: p.price })),
    [products, quantities]
  );
  const totals = computeOrderTotals(billLines);

  function setQty(productId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, qty) }));
  }

  function handleCreateCustomer() {
    startTransition(async () => {
      try {
        const customer = await addCustomerInline(newCustomer.name, newCustomer.phone, newCustomer.address);
        setCustomerList((prev) => [...prev, { id: customer.id, name: customer.name, phone: customer.phone }]);
        setCustomerId(customer.id);
        setShowNewCustomer(false);
        setNewCustomer({ name: "", phone: "", address: "" });
      } catch (err) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Could not add customer." });
      }
    });
  }

  function handleSaveOrder() {
    setMessage(null);
    startTransition(async () => {
      const result = await createOrder(
        customerId,
        Object.entries(quantities).map(([productId, quantity]) => ({ productId, quantity }))
      );
      if (result.ok) {
        setMessage({ type: "success", text: `Saved as ${result.orderNumber}.` });
        setQuantities({});
      } else {
        setMessage({ type: "error", text: result.error ?? "Could not save the order." });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <h2 className="font-serif text-lg text-royal">Customer</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">Select a customer…</option>
              {customerList.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
              ))}
            </select>
            <Button type="button" variant="ghost" onClick={() => setShowNewCustomer((v) => !v)}>
              + New customer
            </Button>
          </div>

          {showNewCustomer && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                placeholder="Name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
              />
              <Input
                placeholder="Phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
              />
              <Input
                placeholder="Address"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer((c) => ({ ...c, address: e.target.value }))}
              />
              <Button
                type="button"
                onClick={handleCreateCustomer}
                disabled={isPending}
                className="justify-center sm:col-span-3"
              >
                Save customer
              </Button>
            </div>
          )}
        </Card>

        <Card className="mt-6">
          <h2 className="font-serif text-lg text-royal">Flavours</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {products.map((p) => {
              const qty = quantities[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-royal-soft/15 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-royal">{p.name}</p>
                    <p className="text-xs text-royal-soft">₹{p.price} / {p.packSize} · {p.stock} in stock</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQty(p.id, qty - 1)}
                      className="h-8 w-8 rounded-full border border-gold text-gold-soft"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(p.id, Math.min(p.stock, qty + 1))}
                      disabled={qty >= p.stock}
                      className="h-8 w-8 rounded-full border border-gold text-gold-soft disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div>
        <Card className="sticky top-6">
          <h2 className="font-serif text-lg text-royal">Bill</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal}</span></div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>{totals.delivery === 0 ? "Free" : `₹${totals.delivery}`}</span>
            </div>
            <div className="flex justify-between border-t border-royal-soft/15 pt-2 font-semibold text-royal">
              <span>Total</span><span>₹{totals.total}</span>
            </div>
          </div>

          {message && (
            <p className={`mt-4 text-sm ${message.type === "error" ? "text-red-600" : "text-emerald-600"}`}>
              {message.text}
            </p>
          )}

          <Button
            type="button"
            onClick={handleSaveOrder}
            disabled={isPending || billLines.length === 0}
            className="mt-4 w-full justify-center"
          >
            {isPending ? "Saving…" : "Save order"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the server page**

`crm/app/(app)/pos/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { PosClient } from "./PosClient";

export default async function PosPage() {
  const [products, customers] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">POS · New order</h1>
      <p className="mt-1 text-sm text-royal-soft">Build a bill and save it as an order.</p>
      <div className="mt-6">
        <PosClient
          products={products.map((p) => ({ id: p.id, name: p.name, packSize: p.packSize, price: p.price, stock: p.stock }))}
          customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify manually**

```bash
cd crm
npm run dev
```

Log in, visit `/pos`. Select "Priya Shah", add 2 × "Ghee Jeera" — expect Bill shows Subtotal ₹320, Delivery "Free" (2 packs = 1000g), Total ₹320. Click "Save order" — expect a success message like "Saved as SDK260826002" (or the current date's sequence) and the quantity selectors reset to 0. Visit `/products` and confirm "Ghee Jeera" stock dropped from 20 to 18. Go back to `/pos`, select "Ghee Sada", click "+" repeatedly until it reaches the product's stock count — confirm the "+" button disables at that point (can't oversell). Try "+ New customer", fill in a name/phone/address, click "Save customer" — confirm it's selected automatically and appears next time you open `/customers`. Stop the dev server before continuing.

- [ ] **Step 5: Commit**

```bash
git add "crm/app/(app)/pos"
git commit -m "feat(crm): add POS order-creation screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Sales page and order detail

**Files:**
- Create: `crm/app/(app)/sales/actions.ts`
- Create: `crm/app/(app)/sales/page.tsx`
- Create: `crm/app/(app)/sales/[id]/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 2), `Card`, `Table` (Task 7).
- Produces: `/sales` (filterable order register) and `/sales/[id]` (order detail + status update).

- [ ] **Step 1: Write the status-update action**

`crm/app/(app)/sales/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export async function updateOrderStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id) throw new Error("Missing order id.");
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    throw new Error("Invalid status.");
  }

  await prisma.order.update({ where: { id }, data: { status: status as (typeof VALID_STATUSES)[number] } });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Write the sales register page**

`crm/app/(app)/sales/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Table } from "@/components/ui";

const STATUS_OPTIONS = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
}) {
  const { status, from, to } = await searchParams;
  const validStatus = STATUS_OPTIONS.find((s) => s === status);

  const orders = await prisma.order.findMany({
    where: {
      status: validStatus,
      orderDate: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(`${to}T23:59:59`) : undefined,
      },
    },
    orderBy: { orderDate: "desc" },
    include: { customer: true },
  });

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Sales</h1>

      <form className="mt-6 flex flex-wrap gap-3" action="/sales">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        />
        <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep">
          Filter
        </button>
      </form>

      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Order #</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-royal-soft/10 last:border-0">
              <td className="px-4 py-3">
                <Link href={`/sales/${o.id}`} className="font-semibold text-royal hover:text-gold-soft">
                  {o.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3">{o.customer.name}</td>
              <td className="px-4 py-3">{o.orderDate.toLocaleDateString("en-IN")}</td>
              <td className="px-4 py-3">{o.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">₹{o.total}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-royal-soft">No orders match these filters.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Write the order detail page**

`crm/app/(app)/sales/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { updateOrderStatus } from "../actions";

const STATUS_OPTIONS = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  });

  if (!order) notFound();

  return (
    <div>
      <Link href="/sales" className="text-sm text-royal-soft hover:text-gold-soft">← All sales</Link>
      <h1 className="mt-2 font-serif text-3xl text-royal">{order.orderNumber}</h1>
      <p className="mt-1 text-sm text-royal-soft">
        {order.customer.name} · {order.orderDate.toLocaleDateString("en-IN")}
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
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{order.deliveryCharge === 0 ? "Free" : `₹${order.deliveryCharge}`}</span>
          </div>
          <div className="flex justify-between font-semibold text-royal"><span>Total</span><span>₹{order.total}</span></div>
        </div>
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
    </div>
  );
}
```

- [ ] **Step 4: Verify manually**

```bash
cd crm
npm run dev
```

Log in, visit `/sales`. Expected: the seeded `SDK000000001` order (status "DELIVERED") plus any orders created during Task 13's manual testing. Click into `SDK000000001` — expect the item breakdown, totals, and a status dropdown. Change status to "ROASTING" and click "Update" — reload `/sales` and confirm the status column now reads "ROASTING". Filter `/sales` by status "DELIVERED" and confirm that order no longer appears in the filtered list. Stop the dev server before continuing.

- [ ] **Step 5: Commit**

```bash
git add "crm/app/(app)/sales"
git commit -m "feat(crm): add sales register and order detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: Suppliers & Purchases page

**Files:**
- Create: `crm/app/(app)/purchases/actions.ts`
- Create: `crm/app/(app)/purchases/PurchaseForm.tsx`
- Create: `crm/app/(app)/purchases/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 2), `computePurchaseTotal` (Task 3), `Button`, `Card`, `Input`, `Table` (Task 7).
- Produces: `/purchases` — add supplier, log a purchase with line items, and a purchase register.

- [ ] **Step 1: Write the server actions**

`crm/app/(app)/purchases/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computePurchaseTotal } from "@/lib/money";

export async function createSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const itemsSupplied = String(formData.get("itemsSupplied") ?? "").trim();

  if (!name || !phone) throw new Error("Supplier name and phone are required.");

  await prisma.supplier.create({ data: { name, phone, itemsSupplied: itemsSupplied || null } });
  revalidatePath("/purchases");
}

export interface PurchaseLineInput {
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
}

export async function createPurchase(
  supplierId: string,
  paidStatus: "PAID" | "DUE" | "PARTIAL",
  lines: PurchaseLineInput[]
) {
  if (!supplierId) throw new Error("Select a supplier first.");

  const validLines = lines.filter((l) => l.itemName.trim() && l.quantity > 0 && l.rate > 0);
  if (validLines.length === 0) throw new Error("Add at least one purchase line.");

  const total = computePurchaseTotal(validLines);

  await prisma.purchase.create({
    data: {
      supplierId,
      total,
      paidStatus,
      items: {
        create: validLines.map((l) => ({
          itemName: l.itemName.trim(),
          quantity: l.quantity,
          unit: l.unit.trim() || "unit",
          rate: l.rate,
          amount: l.quantity * l.rate,
        })),
      },
    },
  });

  revalidatePath("/purchases");
}
```

- [ ] **Step 2: Write the purchase-entry client form**

`crm/app/(app)/purchases/PurchaseForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { createPurchase, type PurchaseLineInput } from "./actions";

export function PurchaseForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [supplierId, setSupplierId] = useState("");
  const [paidStatus, setPaidStatus] = useState<"PAID" | "DUE" | "PARTIAL">("DUE");
  const [lines, setLines] = useState<PurchaseLineInput[]>([{ itemName: "", quantity: 0, unit: "kg", rate: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateLine(index: number, patch: Partial<PurchaseLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { itemName: "", quantity: 0, unit: "kg", rate: 0 }]);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createPurchase(supplierId, paidStatus, lines);
        setLines([{ itemName: "", quantity: 0, unit: "kg", rate: 0 }]);
        setSupplierId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the purchase.");
      }
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        >
          <option value="">Select a supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={paidStatus}
          onChange={(e) => setPaidStatus(e.target.value as "PAID" | "DUE" | "PARTIAL")}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        >
          <option value="DUE">Due</option>
          <option value="PARTIAL">Partially paid</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input
              placeholder="Item (e.g. Wheat flour)"
              value={line.itemName}
              onChange={(e) => updateLine(i, { itemName: e.target.value })}
            />
            <Input
              placeholder="Qty"
              type="number"
              min="0"
              value={line.quantity || ""}
              onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
            />
            <Input placeholder="Unit (kg)" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
            <Input
              placeholder="Rate (₹)"
              type="number"
              min="0"
              value={line.rate || ""}
              onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="ghost" onClick={addLine}>+ Add line</Button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="button" onClick={submit} disabled={isPending}>
        {isPending ? "Saving…" : "Save purchase"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Write the page**

`crm/app/(app)/purchases/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { Button, Card, Input, Table } from "@/components/ui";
import { createSupplier } from "./actions";
import { PurchaseForm } from "./PurchaseForm";

export default async function PurchasesPage() {
  const [suppliers, purchases] = await Promise.all([
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.purchase.findMany({ orderBy: { purchaseDate: "desc" }, include: { supplier: true, items: true } }),
  ]);

  return (
    <div>
      <h1 className="font-serif text-3xl text-royal">Purchases</h1>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Add supplier</h2>
        <form action={createSupplier} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input name="name" placeholder="Supplier name" required />
          <Input name="phone" placeholder="Phone" required />
          <Input name="itemsSupplied" placeholder="Items supplied (optional)" />
          <Button type="submit" className="justify-center sm:col-span-3">Add supplier</Button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="font-serif text-lg text-royal">Log purchase</h2>
        <PurchaseForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
      </Card>

      <h2 className="mt-8 font-serif text-xl text-royal">Purchase register</h2>
      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Supplier</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id} className="border-b border-royal-soft/10 last:border-0">
              <td className="px-4 py-3">{p.supplier.name}</td>
              <td className="px-4 py-3">{p.purchaseDate.toLocaleDateString("en-IN")}</td>
              <td className="px-4 py-3">{p.items.map((i) => i.itemName).join(", ")}</td>
              <td className="px-4 py-3">₹{p.total}</td>
              <td className="px-4 py-3">{p.paidStatus}</td>
            </tr>
          ))}
          {purchases.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-royal-soft">No purchases logged yet.</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Verify manually**

```bash
cd crm
npm run dev
```

Log in, visit `/purchases`. Expected: "Om Flour Mills" listed as a supplier, and the seeded purchase register row (`Om Flour Mills`, "Wheat flour", ₹1000, "PAID"). Add a new supplier ("Ghatkopar Oil Traders", phone, "Oil"). In "Log purchase", pick that new supplier, set status "Due", add a line ("Groundnut oil", 10, "litre", 180), click "+ Add line", add a second line ("Packaging pouches", 500, "pcs", 2), click "Save purchase". Expected: a new row appears in the register with total ₹(10×180 + 500×2) = ₹2800 and status "DUE". Stop the dev server before continuing.

- [ ] **Step 5: Commit**

```bash
git add "crm/app/(app)/purchases"
git commit -m "feat(crm): add suppliers and purchases page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: README and full run-through

**Files:**
- Create: `crm/README.md`

**Interfaces:**
- Consumes: nothing new — documents everything built in Tasks 1–15.
- Produces: a written path for the owner (or a future engineer) to run the CRM from a clean checkout.

- [ ] **Step 1: Write the README**

`crm/README.md`:

```markdown
# Sadharmik & Co. — Internal CRM

A private, local back-office app for managing customers, products, orders
(POS), sales, and purchases. Not linked to or visible from the public
`index.html` site — this is for the owner/staff only.

## First-time setup

```bash
cd crm
npm install
cp .env.example .env
```

Edit `.env` and set a real `CRM_PASSWORD` (this is the login password) and a
random `CRM_SESSION_SECRET` (any long random string — used to sign the login
session, not something you need to remember).

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

## Running it

```bash
npm run dev
```

Open `http://localhost:3000`, log in with the password from `.env`.

## Running the tests

```bash
npm test
```

## Data model

See `prisma/schema.prisma` for the full data model: Product (item master),
Customer, Supplier, Order/OrderItem, Purchase/PurchaseItem.

## Pages

- `/dashboard` — sales stats, low-stock alerts, recent orders
- `/customers` — list, search, add; click a row for order history
- `/products` — item master (add/edit flavour, price, stock)
- `/pos` — build a bill and save it as an order (this is the order-creation
  screen)
- `/sales` — order register with status/date filters
- `/purchases` — suppliers + raw-material purchase register
```

- [ ] **Step 2: Full run-through from a clean database**

```bash
cd crm
rm -f prisma/dev.db
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Expected: seed prints `Seeded 8 products, 1 customer, 1 supplier, 1 order, 1 purchase.` Log in, then click through every sidebar link (Dashboard, Customers, Products, POS, Sales, Purchases) confirming each loads without an error overlay. Stop the dev server.

```bash
npx vitest run
```

Expected: all test files (`lib/money.test.ts`, `lib/order-number.test.ts`, `lib/auth.test.ts`) pass.

- [ ] **Step 3: Commit**

```bash
git add crm/README.md
git commit -m "docs(crm): add setup and run instructions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
