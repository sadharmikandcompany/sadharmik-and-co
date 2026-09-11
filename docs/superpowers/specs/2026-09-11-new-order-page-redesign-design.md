# New Order page redesign

Date: 2026-09-11
Status: Approved

## Context

The user wants the `/sales/new` ("New Order") page in the Sadharmik & Co CRM
redesigned to match the item-picker and order-details layout of a reference
CRM (Kalapurna's `/dashboard/orders/new`), adapted to this app's actual data
model — no product categories exist here, so the item picker skips the
category/sub-category filters shown in the reference and goes straight to a
product dropdown.

## Scope

Replace the current always-visible product-card grid on `/sales/new` with a
dropdown-driven "add one item at a time" flow, and reorganize the order-level
fields (payment method, amount paid, shipping charge, priority, source, order
date, notes) into a tabbed "Order Details" section. The Customer section is
unchanged. No other page is affected.

## Design

### 1. Customer section
Unchanged — existing search/select/Add Customer modal behavior stays as is.

### 2. Order Items
Replaces the grid of product cards (each with its own qty stepper) with:
- A searchable product dropdown, rendering each option as
  `"<name> — ₹<price>/<packSize> · <stock> in stock"`, filtered by the
  existing product search text as the user types.
- A qty stepper (-/number/+), clamped to `[1, selected product's stock]`.
- An **Add** button. Clicking it appends `{ productId, quantity }` to a
  `cartLines` array in local state; adding a product already in the cart
  increments its existing line's quantity instead of creating a duplicate
  row, still clamped to stock.
- A cart table below the picker: columns Item / Qty / Rate / Amount, plus a
  ✕ button per row to remove that line. Shows "No items added yet." when
  the cart is empty. The **Save Order** button stays disabled while the
  cart is empty, as today.

### 3. Order Details (tabbed: Payment / Shipping / Notes)
One tab visible at a time, tab buttons styled after the reference screenshot.

- **Payment tab:** Payment Method select (Cash / UPI / Card / Cheque /
  Pending — this field already doubles as a pending/paid signal, so there
  is no separate "Payment Status" field). Amount Paid (₹, existing
  behavior: defaults to the order total unless the method is Pending, in
  which case it defaults to 0 — user can override). Shipping Charges (₹,
  number input) — pre-filled with the auto-computed delivery fee
  (`computeDeliveryCharge` from `lib/money.ts`) whenever the cart changes,
  but user-editable; once the user edits it, further cart changes stop
  overwriting it until they clear the field back to blank, at which point
  it resumes auto-filling. Priority Order toggle (boolean, maps to
  `isPriority`).
- **Shipping tab:** Order Source select (Phone / WhatsApp / Walk-in /
  Website, existing field). Order Date (optional `datetime-local` input;
  blank means "now," same as current server default).
- **Notes tab:** the existing notes textarea, unchanged.

No Order Status field at creation — every new order still starts as `NEW`
(the existing `Order.status` default). This is a deliberate scope cut, not
an oversight: status transitions happen later in the order lifecycle
(sales list / order detail), not at creation.

The Bill summary card (right column) is unchanged in appearance; it now
reads `cartLines` (the new cart state) for subtotal/GST, and uses the
shipping-charge field's current value (auto or overridden) as the
delivery line and in the total, instead of always deriving delivery from
`computeOrderTotals`.

### 4. Server changes (`lib/orders.ts`)

`createOrder` gains two new optional parameters:
- `deliveryChargeOverride?: number` — when provided, used verbatim as the
  order's `deliveryCharge` (and folded into `total`) instead of
  `computeOrderTotals`'s auto-computed delivery fee.
- `orderDate?: Date` — when provided, stored as `Order.orderDate` instead
  of leaving it to the schema's `@default(now())`.
- `isPriority?: boolean` — stored as `Order.isPriority` (defaults to
  `false`, matching the schema default, if omitted).

No Prisma schema changes: `isPriority`, `orderDate`, and `deliveryCharge`
already exist on `Order`.

### 5. Error handling

Unchanged pattern: validation and save errors surface in the existing
red-text message box above the Save button. Stock/customer validation in
`createOrder` is untouched.

### 6. Testing

No existing automated test covers this page. Verification is a manual
smoke test via the local dev server: add multiple line items (including
adding the same product twice to confirm it merges), remove a line,
switch between all three Order Details tabs and confirm values persist
across tab switches, override the shipping charge and confirm the total
updates, submit, and confirm the created order's stored totals match what
the Bill card showed.

## Out of scope

- Product categories/sub-categories (don't exist in this schema).
- Setting Order Status at creation time.
- Changes to POS (`/pos`), the order edit page, or any other page.
- Any Prisma schema/migration changes.
