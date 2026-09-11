# Regular/Mandir/Shop price tiers + modal-based Products page

Date: 2026-09-11
Status: Approved

## Context

The user wants the CRM's Products page (`/products`) to gain per-product
price tiers for Mandir and Shop customers — modeled on a reference CRM
(Kalapurna) that has Customer/Retailer/Distributor pricing per product —
and a modal-based edit/view UI matching that reference's Actions column
(view/edit/delete icons), replacing today's always-editable inline table
row. The tiers are named to match this app's existing `Customer.isMandir`
/ `Customer.isShop` flags rather than Kalapurna's naming. Selecting a
Mandir or Shop customer on New Order / POS should automatically default
line items to that tier's price. Kalapurna's pincode-based pricing is
explicitly out of scope.

## Scope

Touches: `prisma/schema.prisma` (new columns + migration), a new
`lib/pricing.ts`, the Products page and its actions, and the New Order
and POS pages' price-defaulting behavior. Does not touch the Edit Order
page, which keeps its existing plain per-line Unit Price editing.

## Design

### 1. Schema

Add two nullable columns to `Product`:

```prisma
model Product {
  ...
  price         Int
  mandirPrice   Int?
  shopPrice     Int?
  gstPercentage Int         @default(0)
  ...
}
```

`null` means "no special price set for this tier — fall back to the
regular `price`." A plain additive migration (`prisma migrate dev`),
matching the style of the existing `product_show_on_website` and
`customer_mandir_shop_numbers` migrations already in
`prisma/migrations/`.

### 2. Shared pricing helper — `lib/pricing.ts` (new file)

```ts
export interface PriceTiers {
  price: number;
  mandirPrice: number | null;
  shopPrice: number | null;
}

export interface CustomerTierFlags {
  isMandir: boolean;
  isShop: boolean;
}

export function effectivePrice(product: PriceTiers, customer: CustomerTierFlags | null | undefined): number {
  if (customer?.isMandir && product.mandirPrice != null) return product.mandirPrice;
  if (customer?.isShop && product.shopPrice != null) return product.shopPrice;
  return product.price;
}
```

Priority when a customer is somehow both Mandir and Shop: Mandir wins
(checked first). This is a deliberate, documented tie-break, not an
oversight — the two flags are not expected to co-occur in practice.

This function is pure and gets its own unit tests
(`lib/pricing.test.ts`), following the repo's existing convention of
testing pure logic in `lib/*.ts` (see `lib/money.test.ts`).

### 3. Products page

- `ProductRow` (in `ProductsTable.tsx`) gains `mandirPrice: number | null`
  and `shopPrice: number | null`, sourced from `products/page.tsx`'s
  Prisma query.
- The table becomes **read-only**: Photo, Name, Pack, Price, Mandir,
  Shop, GST %, Stock, Active, On Website (badges, not checkboxes), and
  an **Actions** column with three icon buttons (`lucide-react`'s `Eye`,
  `Pencil`, `Trash2` — `lucide-react` is already a dependency, already
  used in `EditOrderForm.tsx`).
- **Eye** opens a new read-only `ViewProductModal.tsx` — the same fields,
  rendered as plain text, no form controls.
- **Pencil** opens a new `EditProductModal.tsx` — a form with every field
  `AddProductButton.tsx` already has, plus two new optional inputs
  (Mandir Price, Shop Price — blank means "not set"), submitting through
  the existing `updateProduct` action (extended, see below).
- **Trash2** keeps today's `confirm()` + `deleteProduct` call, just as an
  icon button instead of a text link.
- `ProductsTable.tsx` itself shrinks to rendering the read-only rows and
  wiring up which modal (if any) is open — the form logic moves into the
  two new modal files, keeping each file single-purpose.

### 4. Server actions — `app/(app)/products/actions.ts`

- `createProduct` and `updateProduct` read two new optional `FormData`
  fields, `mandirPrice` and `shopPrice`: an empty/missing value stores
  `null`; otherwise parsed and validated the same way `price` already is
  (finite, ≥ 0).

### 5. New Order page (`app/(app)/sales/new/`)

- `ProductOption` (in `NewOrderForm.tsx`) gains `mandirPrice: number | null`
  and `shopPrice: number | null`; `page.tsx`'s Prisma mapping passes them
  through.
- `CustomerOption` gains `isMandir: boolean` and `isShop: boolean`;
  `page.tsx`'s customer mapping passes them through.
- `handleAddToCart` sets a newly-added line's starting `unitPrice` via
  `effectivePrice(product, selectedCustomer)` instead of always
  `product.price`. Staff can still hand-edit the Rate afterward (already
  built in the prior increment) — this only changes the *default*.
- Deliberately **not** in scope: retroactively repricing cart lines
  already added if the customer selection changes afterward (add-order
  dependent; the existing "Change" customer flow doesn't touch the cart
  today, and this design doesn't add that coupling).

### 6. POS page (`app/(app)/pos/`)

- Same `ProductOption`/`CustomerOption` field additions as above, via
  `pos/page.tsx`'s Prisma mappings.
- Unlike New Order, POS's flow adds items to the cart (the `quantities`
  record) *before* a customer is chosen (customer selection happens at
  checkout). There is no "add to cart" moment to apply a tier price.
  Instead, `PosClient.tsx`'s `billLines` (which feeds both the checkout
  modal's displayed bill and the `createOrder` call) computes each line's
  `unitPrice` via `effectivePrice(product, selectedCustomer)`, recomputed
  live against whichever customer is currently selected. POS has no
  manual per-line rate-edit UI today and this design doesn't add one —
  `effectivePrice` fully determines what's charged there.

### 7. Testing

- `lib/pricing.test.ts`: unit tests for `effectivePrice` covering — no
  customer, non-tier customer, Mandir customer with/without a set
  `mandirPrice`, Shop customer with/without a set `shopPrice`, and a
  customer flagged as both (Mandir wins).
- Everything else (schema, UI, action wiring) is verified via
  `tsc --noEmit` and a manual smoke test through the running dev server,
  matching how the prior New Order redesign work in this repo was
  verified (no existing test coverage for `app/**` pages or DB-touching
  server actions).

## Out of scope

- Kalapurna's pincode-based pricing groups.
- Any change to the Edit Order page (`EditOrderForm.tsx`) — it keeps its
  existing plain, manually-editable per-line Unit Price, unaffected by
  tiers.
- Retroactively repricing New Order cart lines when the customer
  selection changes after items are already added.
- A manual per-line rate-edit UI on POS (POS gets automatic tier pricing
  only, per the design above).
