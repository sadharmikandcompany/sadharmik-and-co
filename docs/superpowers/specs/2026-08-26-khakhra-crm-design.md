# Sadharmik & Co. — Internal CRM Design

## Context

The public site (`index.html`) is a single static HTML/CSS/JS page. Customers pick
khakhra flavours, and the page builds a WhatsApp message for their order. A
client-side "My Account" modal saves the customer's name/address/order history
to `localStorage` — but that data lives only in that customer's own browser.
The business owner has no central place to see who ordered what, manage stock,
or track raw-material purchases.

As a reference, the user shared `red/kalapurna-web-main/` — a full Next.js +
Supabase e-commerce site built for a different business (Kalapurna Ghee). It
is a customer-facing storefront, not a back-office/admin app, but its data
model (master tables for Products, Categories, Customers, plus an Orders
table) and stack (Next.js, TypeScript, Tailwind, shadcn/ui) are the pattern to
follow for this CRM.

## Goal

Build a private, internal back-office web app for Sadharmik & Co. that gives
the owner:

- A customer database (add/view customers, see their order history)
- A way to create orders directly (POS-style billing screen)
- A sales register/report
- A purchases register for raw materials bought from suppliers
- A dashboard summarizing the above

This is separate from the public site — different audience (owner/staff only,
not customers), so it does not need to match the public site's tech stack,
only its visual branding.

## Non-goals

- No changes to the public `index.html` site's customer-facing ordering flow
  in this phase (it keeps working exactly as it does today).
- No customer login/signup on the public site (that was explicitly ruled out
  in favor of an internal-only dashboard).
- No cloud database / hosting in this phase — everything runs locally.
- No multi-user accounts/roles — a single shared password gate is enough.
- No distributor/sub-distributor pricing tiers, lab-test certificates,
  reviews, or blog — those are Kalapurna-specific features that don't apply
  to a single-product-line Mumbai-only khakhra business.

## Architecture

- **Location**: new `crm/` folder at the project root, sibling to `index.html`.
  Kept as its own app (own `package.json`, own dev server) rather than merged
  into the static site, since it's a different stack and different audience.
- **Stack**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui —
  mirrors the Kalapurna reference project's stack for consistency with what
  the user is already used to reading/maintaining.
- **Database**: SQLite via Prisma ORM, stored as a local file
  (`crm/prisma/dev.db`). No external account or network dependency; `npm run
  dev` is enough to get a working app. Prisma's schema-first models double as
  documentation of the data shape, and migrating to Postgres/Supabase later
  (if the owner ever wants access from another device) is a supported Prisma
  path, not a rewrite.
- **Auth**: a single shared password, checked against an env var
  (`CRM_PASSWORD`), setting a signed session cookie. No user accounts, no
  roles — this is a private tool for the owner/staff, not a multi-tenant
  system.
- **Branding**: Tailwind theme reuses the public site's palette — royal blue
  `#0D2A57` (+ `#143669` soft variant), gold `#C9A24B` (+ `#E7CB84` light
  variant), cream `#F2E7CC`/`#FBF5E7` — and the same Google Fonts (Cormorant
  Garamond for headings, Mukta for body), so the CRM visually reads as the
  same business.

## Data model

All monetary amounts in whole rupees (integers), matching the public site's
convention (`₹` displayed without paise).

**Product** (item master)
- id, name (e.g. "Methi Khakhra"), pack size label (e.g. "200g"), price,
  stock quantity, is_active, created_at/updated_at

**Customer** (customer master)
- id, name, phone, whatsapp (optional, defaults to phone), address (single
  free-text field, matching the public site's single-textarea address field —
  no need to over-structure this for a Mumbai-only delivery area), notes,
  created_at/updated_at

**Supplier** (new — not present in the Kalapurna reference, needed for
Purchases)
- id, name, phone, items supplied (free text, e.g. "Wheat flour, packaging"),
  notes, created_at/updated_at

**Order** (sales transaction) + **OrderItem**
- Order: id, order_number (human-friendly, e.g. `SDK{date}{seq}`), customer_id,
  status (New / Roasting / Out for delivery / Delivered), source (Website /
  WhatsApp / Phone / Walk-in), subtotal, delivery_charge, total, order_date,
  created_at/updated_at
- OrderItem: id, order_id, product_id, quantity, unit_price (captured at time
  of sale, so later price changes don't rewrite history)

**Purchase** (raw-material purchase) + **PurchaseItem**
- Purchase: id, supplier_id, purchase_date, total, paid_status (Paid / Due /
  Partially paid), created_at/updated_at
- PurchaseItem: id, purchase_id, item_name (free text — raw materials aren't
  in the Product master, which only holds sellable khakhra flavours), quantity,
  unit (free text, e.g. "kg", "packets"), rate, amount

## Pages

1. **Login** — password field, sets session cookie, redirects to Dashboard.
2. **Dashboard** — today/this-week/this-month sales totals and order counts,
   low-stock products (stock quantity below 5 packs), recent orders list.
3. **Customers** — searchable table (name/phone), "Add Customer" form; row
   click opens a detail view with that customer's full order history and
   lifetime total spend.
4. **Products** — item master table (name, pack size, price, stock), add/edit
   form. Editing stock here is the only way stock changes outside of an order
   being placed (which decrements it).
5. **POS / New Order** — the order-creation screen: search/select an existing
   customer or add one inline without leaving the screen; tap products to add
   to the bill with a quantity stepper (same interaction pattern as the public
   site's "Add to order" + qty control); running subtotal/delivery/total
   computed live; "Save order" creates the Order + OrderItems and decrements
   product stock. This single screen covers both "order creation" and "POS"
   from the requirements — no separate screen duplicates this.
6. **Sales** — read-only register of past orders: filterable by date range and
   status, click a row to see its full item breakdown. This is the reporting
   counterpart to POS's data-entry.
7. **Purchases** — supplier list + "Log purchase" form (pick/add a supplier,
   add line items, mark paid status); running purchase register with running
   total owed to each supplier.

## Error handling & edge cases

- POS: attempting to add more of a product than is currently in stock is
  blocked with an inline message, not a silent overshoot into negative stock.
- Deleting a customer/product that has existing orders is disallowed
  (soft-delete via `is_active` instead), so historical orders never end up
  pointing at a missing record.
- Empty states are handled explicitly on every list page (no customers yet,
  no orders yet, etc.) rather than showing a blank table.

## Testing approach

- Prisma schema + a seed script (a handful of khakhra products, one sample
  customer) so the app is exercisable immediately after setup without manual
  data entry first.
- Manual verification pass through each page after implementation (this is an
  internal tool for a single user; heavy automated test infrastructure is out
  of proportion to the app's size — YAGNI).

## Open questions / future phases (explicitly out of scope now)

- Whether the public site should eventually write orders directly into this
  same database (instead of only WhatsApp) — deferred; today's public site
  behavior is unchanged.
- Cloud hosting / access from a phone — deferred until local version is
  validated.
