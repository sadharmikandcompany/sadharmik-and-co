# New Order Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-visible product-card grid on the CRM's `/sales/new` ("New Order") page with a dropdown-driven "pick a product → set qty → Add" item picker plus a cart table, and reorganize the order-level fields into a tabbed Payment / Shipping / Notes section — matching the reference layout from `docs/superpowers/specs/2026-09-11-new-order-page-redesign-design.md`.

**Architecture:** Two small, pure-logic changes in `crm/lib/` (delivery-charge override support, threaded through `createOrder`), then a UI-only rewrite of the single client component `crm/app/(app)/sales/new/NewOrderForm.tsx`. No schema changes, no new files, no other page touched.

**Tech Stack:** Next.js 15 (App Router, Server Actions), React 19, TypeScript, Tailwind, Prisma, Vitest.

## Global Constraints

- No Prisma schema/migration changes — `isPriority`, `orderDate`, `deliveryCharge` already exist on `Order`.
- No product categories/sub-categories — the reference screenshot's category filters are intentionally skipped (Product has no category field).
- No Order Status field at creation — new orders keep defaulting to `NEW`.
- This repo only unit-tests pure logic in `lib/*.ts` (see `crm/lib/money.test.ts`, `crm/lib/order-number.test.ts`, etc.) — nothing in `app/**` has tests, and DB-orchestration functions like `createOrder` aren't unit-tested either (they'd require a real Postgres connection). Follow that convention: TDD applies to Task 1 (pure function), Tasks 2–4 are verified by `tsc --noEmit` and the manual smoke test in Task 5, not new test files.
- `crm` is a git-bash/PowerShell environment where the project path contains `&` (`C:\Users\Ronit\Downloads\sadharmik & Co\crm`), which breaks `npx`/`.cmd` shims. Invoke local tool binaries directly via `node`, e.g. `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` and `node ./node_modules/vitest/vitest.mjs run <path>`, run from the `crm` directory.

---

### Task 1: `computeOrderTotals` accepts an optional delivery-charge override

**Files:**
- Modify: `crm/lib/money.ts`
- Test: `crm/lib/money.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `BillLine[]`, existing `computeDeliveryCharge`).
- Produces: `computeOrderTotals(lines: BillLine[], deliveryOverride?: number): OrderTotals` — when `deliveryOverride` is provided, `OrderTotals.delivery` is `Math.max(0, Math.round(deliveryOverride))` instead of the auto-computed pack-based charge; `OrderTotals.total` reflects that same delivery value. Task 2 calls this with its own override value.

- [ ] **Step 1: Write the failing tests**

Add these four `it` blocks inside the existing `describe("computeOrderTotals", ...)` block in `crm/lib/money.test.ts` (after the existing three `it` blocks, before the closing `});`):

```ts
  it("uses the delivery override instead of the auto-computed charge when provided", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }], 25);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 25, total: 185 });
  });

  it("clamps a negative delivery override to 0", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }], -10);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 0, total: 160 });
  });

  it("rounds a fractional delivery override", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }], 25.6);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 26, total: 186 });
  });

  it("falls back to the auto-computed charge when no override is given", () => {
    const result = computeOrderTotals([{ quantity: 1, unitPrice: 160 }]);
    expect(result).toEqual({ packs: 1, subtotal: 160, gst: 0, delivery: 70, total: 230 });
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run (from the `crm` directory): `node ./node_modules/vitest/vitest.mjs run lib/money.test.ts`
Expected: the 3 new override-related tests FAIL (actual `delivery`/`total` come back as the auto-computed ₹70 case, not 25/0/26) — the 4th new test ("falls back...") passes already since it matches current behavior.

- [ ] **Step 3: Implement the override**

In `crm/lib/money.ts`, replace the existing `computeOrderTotals` function:

```ts
export function computeOrderTotals(lines: BillLine[], deliveryOverride?: number): OrderTotals {
  const packs = totalPacks(lines);
  const subtotal = computeSubtotal(lines);
  const gst = computeGstAmount(lines);
  const delivery = deliveryOverride !== undefined ? Math.max(0, Math.round(deliveryOverride)) : computeDeliveryCharge(packs);
  return { packs, subtotal, gst, delivery, total: subtotal + gst + delivery };
}
```

- [ ] **Step 4: Run the tests to verify they all pass**

Run: `node ./node_modules/vitest/vitest.mjs run lib/money.test.ts`
Expected: all tests in the file PASS (including the pre-existing ones — the override parameter is optional so no existing call site breaks).

- [ ] **Step 5: Commit**

```bash
git add crm/lib/money.ts crm/lib/money.test.ts
git commit -m "feat(crm): computeOrderTotals accepts an optional delivery-charge override

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `createOrder` accepts delivery override, order date, and priority

**Files:**
- Modify: `crm/lib/orders.ts:23-107` (the `createOrder` function)

**Interfaces:**
- Consumes: `computeOrderTotals(lines, deliveryOverride?)` from Task 1.
- Produces: `createOrder(customerId: string, lines: OrderLine[], source?: OrderSourceInput, paymentMethod?: PaymentMethodInput, notes?: string, amountPaid?: number, deliveryChargeOverride?: number, orderDate?: Date, isPriority?: boolean): Promise<CreateOrderResult>` — three new **optional** params appended at the end, so the existing call in `crm/app/(app)/pos/PosClient.tsx` (which passes only 4 args) keeps compiling and behaving identically. Task 4 calls this with all 9 args.

- [ ] **Step 1: Update the function signature and body**

In `crm/lib/orders.ts`, replace the `createOrder` function signature and the two lines inside it noted below.

Signature (was 6 params, now 9):

```ts
export async function createOrder(
  customerId: string,
  lines: OrderLine[],
  source: OrderSourceInput = "WALK_IN",
  paymentMethod: PaymentMethodInput = "CASH",
  notes?: string,
  amountPaid?: number,
  deliveryChargeOverride?: number,
  orderDate?: Date,
  isPriority?: boolean
): Promise<CreateOrderResult> {
```

Replace this line (currently `const totals = computeOrderTotals(billLines);`):

```ts
    const totals = computeOrderTotals(billLines, deliveryChargeOverride);
```

Replace the `tx.order.create({ data: { ... } })` call's `data` object so it also sets `orderDate` and `isPriority` when given, leaving every existing field as-is:

```ts
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          source,
          paymentMethod,
          notes: notes?.trim() || null,
          subtotal: totals.subtotal,
          gstAmount: totals.gst,
          deliveryCharge: totals.delivery,
          total: totals.total,
          amountPaid: amountPaid ?? (paymentMethod === "PENDING" ? 0 : totals.total),
          ...(orderDate ? { orderDate } : {}),
          ...(isPriority ? { isPriority } : {}),
          items: {
            create: activeLines.map((line) => {
              const product = products.find((p) => p.id === line.productId)!;
              return { productId: line.productId, quantity: line.quantity, unitPrice: product.price };
            }),
          },
        },
      });
```

- [ ] **Step 2: Type-check**

Run (from the `crm` directory): `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: no errors. This confirms the new optional params don't break the existing 4-arg call in `PosClient.tsx` or the 6-arg call in the current `NewOrderForm.tsx` (which Tasks 3–4 will update to pass all 9).

- [ ] **Step 3: Commit**

```bash
git add crm/lib/orders.ts
git commit -m "feat(crm): createOrder accepts delivery override, order date, and priority

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Item picker — dropdown + qty + Add, replacing the product grid

**Files:**
- Modify: `crm/app/(app)/sales/new/NewOrderForm.tsx`

**Interfaces:**
- Consumes: `ProductOption` (existing local interface: `{ id, name, packSize, price, gstPercentage, stock }`), `computeOrderTotals` from `@/lib/money` (existing import).
- Produces: local state `cart: { product: ProductOption; quantity: number }[]` and `removeFromCart(productId: string): void`, which Task 4's Bill card and `handleSaveOrder` read/call.

- [ ] **Step 1: Replace state and derived values**

In `crm/app/(app)/sales/new/NewOrderForm.tsx`, replace these lines:

```ts
  const [productQuery, setProductQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
```

with:

```ts
  const [productQuery, setProductQuery] = useState("");
  const [pickerProductId, setPickerProductId] = useState("");
  const [pickerQty, setPickerQty] = useState(1);
  const [cart, setCart] = useState<{ product: ProductOption; quantity: number }[]>([]);
```

Then replace the `cartLines` and `billLines` memos:

```ts
  const cartLines = useMemo(
    () => products.filter((p) => (quantities[p.id] ?? 0) > 0).map((p) => ({ product: p, quantity: quantities[p.id] })),
    [products, quantities]
  );

  const billLines = useMemo(
    () => cartLines.map(({ product, quantity }) => ({ quantity, unitPrice: product.price, gstPercentage: product.gstPercentage })),
    [cartLines]
  );
  const totals = computeOrderTotals(billLines);
```

with:

```ts
  const billLines = useMemo(
    () => cart.map(({ product, quantity }) => ({ quantity, unitPrice: product.price, gstPercentage: product.gstPercentage })),
    [cart]
  );
  const autoTotals = computeOrderTotals(billLines);
```

(`totals`, incorporating the shipping-charge override, is defined in Task 4 once that input exists — leave no `totals` reference dangling; Task 4 adds it back before the component is used again.)

Delete the now-unused `setQty` function:

```ts
  function setQty(productId: string, qty: number, stock: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, Math.min(qty, stock)) }));
  }
```

Add these two handlers in its place:

```ts
  function handleAddToCart() {
    const product = products.find((p) => p.id === pickerProductId);
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + pickerQty, product.stock);
        return prev.map((line) => (line.product.id === product.id ? { ...line, quantity: nextQuantity } : line));
      }
      return [...prev, { product, quantity: Math.min(pickerQty, product.stock) }];
    });
    setPickerProductId("");
    setPickerQty(1);
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((line) => line.product.id !== productId));
  }

  const pickerStock = products.find((p) => p.id === pickerProductId)?.stock ?? 1;
```

- [ ] **Step 2: Replace the Items card's JSX**

Replace this whole block (the `<Card>` currently containing the product search input and the product-card grid):

```tsx
        <Card>
          <h2 className="font-serif text-lg text-royal">Items</h2>
          <Input
            placeholder="Search products…"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            className="mt-3"
          />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredProducts.map((p) => {
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
                      onClick={() => setQty(p.id, qty - 1, p.stock)}
                      className="h-8 w-8 rounded-full border border-gold text-gold-soft"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(p.id, qty + 1, p.stock)}
                      disabled={qty >= p.stock}
                      className="h-8 w-8 rounded-full border border-gold text-gold-soft disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <p className="text-sm text-royal-soft sm:col-span-2">No flavours match “{productQuery}”.</p>
            )}
          </div>
        </Card>
```

with:

```tsx
        <Card>
          <h2 className="font-serif text-lg text-royal">Order Items</h2>
          <p className="text-sm text-royal-soft">Add products to the order</p>

          <Input
            placeholder="Search products…"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            className="mt-3"
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Product</label>
              <select
                value={pickerProductId}
                onChange={(e) => {
                  setPickerProductId(e.target.value);
                  setPickerQty(1);
                }}
                className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
              >
                <option value="">Select a product ({filteredProducts.length} available)</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stock === 0}>
                    {p.name} — ₹{p.price}/{p.packSize} · {p.stock} in stock
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Qty</label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickerQty((q) => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-full border border-gold text-gold-soft"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm">{pickerQty}</span>
                <button
                  type="button"
                  onClick={() => setPickerQty((q) => Math.min(pickerStock, q + 1))}
                  disabled={pickerQty >= pickerStock}
                  className="h-9 w-9 rounded-full border border-gold text-gold-soft disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            <Button type="button" onClick={handleAddToCart} disabled={!pickerProductId} className="justify-center">
              + Add
            </Button>
          </div>

          <div className="mt-4">
            {cart.length === 0 ? (
              <p className="text-sm text-royal-soft">No items added yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-widest text-gold-soft">
                    <th className="pb-2">Item</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((line) => (
                    <tr key={line.product.id} className="border-t border-royal-soft/15">
                      <td className="py-2">{line.product.name}</td>
                      <td className="py-2 text-right">{line.quantity}</td>
                      <td className="py-2 text-right">₹{line.product.price}</td>
                      <td className="py-2 text-right">₹{line.product.price * line.quantity}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.product.id)}
                          aria-label={`Remove ${line.product.name}`}
                          className="text-royal-soft hover:text-red-600"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
```

- [ ] **Step 3: Type-check**

Run (from the `crm` directory): `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: errors referencing `quantities`, `setQty`, `cartLines`, and `totals` still being used further down the file (in the Order Details / Bill sections) — that's expected, Task 4 fixes those. Confirm the errors are ONLY in `NewOrderForm.tsx` and ONLY about those four names.

- [ ] **Step 4: Commit**

```bash
git add "crm/app/(app)/sales/new/NewOrderForm.tsx"
git commit -m "feat(crm): New Order page — dropdown item picker replaces product grid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Committing here is safe even though `tsc` isn't clean yet — Task 3 and Task 4 are one logical unit split for reviewability; Task 4's commit brings the file back to a fully type-checking state. If your workflow requires every commit to type-check, squash Tasks 3 and 4's commits after Task 4 instead.)

---

### Task 4: Order Details tabs (Payment / Shipping / Notes) and wiring to `createOrder`

**Files:**
- Modify: `crm/app/(app)/sales/new/NewOrderForm.tsx`

**Interfaces:**
- Consumes: `cart`, `removeFromCart`, `autoTotals`, `billLines` from Task 3; `createOrder(customerId, lines, source, paymentMethod, notes, amountPaid, deliveryChargeOverride, orderDate, isPriority)` from Task 2.
- Produces: none — this is the outermost layer of the page.

- [ ] **Step 1: Add the new state**

Add alongside the existing `source`/`paymentMethod`/`amountPaidInput`/`notes` state declarations:

```ts
  const [shippingChargeInput, setShippingChargeInput] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [orderDateInput, setOrderDateInput] = useState("");
  const [activeTab, setActiveTab] = useState<"payment" | "shipping" | "notes">("payment");
```

Add the effective-totals calculation right after `const autoTotals = computeOrderTotals(billLines);` (from Task 3):

```ts
  const effectiveDelivery =
    shippingChargeInput.trim() === "" ? autoTotals.delivery : Math.max(0, Math.round(Number(shippingChargeInput)) || 0);
  const totals = { ...autoTotals, delivery: effectiveDelivery, total: autoTotals.subtotal + autoTotals.gst + effectiveDelivery };
```

- [ ] **Step 2: Update `handleSaveOrder`**

Replace:

```ts
  function handleSaveOrder() {
    if (!selectedCustomer) {
      setMessage({ type: "error", text: "Select a customer first." });
      return;
    }
    setMessage(null);
    startSaving(async () => {
      const result = await createOrder(
        selectedCustomer.id,
        cartLines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        source,
        paymentMethod,
        notes,
        amountPaidInput ? Number(amountPaidInput) : undefined
      );
      if (result.ok && result.orderId) {
        router.push("/sales");
      } else {
        setMessage({ type: "error", text: result.error ?? "Could not save the order." });
      }
    });
  }
```

with:

```ts
  function handleSaveOrder() {
    if (!selectedCustomer) {
      setMessage({ type: "error", text: "Select a customer first." });
      return;
    }
    setMessage(null);
    startSaving(async () => {
      const result = await createOrder(
        selectedCustomer.id,
        cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        source,
        paymentMethod,
        notes,
        amountPaidInput ? Number(amountPaidInput) : undefined,
        shippingChargeInput.trim() === "" ? undefined : effectiveDelivery,
        orderDateInput ? new Date(orderDateInput) : undefined,
        isPriority
      );
      if (result.ok && result.orderId) {
        router.push("/sales");
      } else {
        setMessage({ type: "error", text: result.error ?? "Could not save the order." });
      }
    });
  }
```

Also update the Save button's `disabled` prop — replace `disabled={isSaving || cartLines.length === 0}` with `disabled={isSaving || cart.length === 0}` (in the Bill `<Card>` near the bottom of the file).

- [ ] **Step 3: Replace the "Order details" card**

Replace the entire `<Card>` currently titled "Order details" (source/payment/amount-paid/notes) with:

```tsx
        <Card>
          <h2 className="font-serif text-lg text-royal">Order Details</h2>
          <p className="text-sm text-royal-soft">Configure payment, shipping, and additional details</p>

          <div className="mt-3 flex overflow-hidden rounded-xl border border-royal-soft/20 text-sm font-semibold">
            {(["payment", "shipping", "notes"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2.5 capitalize ${
                  activeTab === tab ? "bg-gold text-royal-deep" : "bg-white text-royal-soft"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "payment" && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodInput)}
                  className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Amount Paid (₹)</label>
                <Input
                  type="number"
                  placeholder={paymentMethod === "PENDING" ? "0" : totals.total.toString()}
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  className="mt-2 w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Shipping Charges (₹)</label>
                <Input
                  type="number"
                  placeholder={autoTotals.delivery.toString()}
                  value={shippingChargeInput}
                  onChange={(e) => setShippingChargeInput(e.target.value)}
                  className="mt-2 w-full"
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-royal sm:col-span-2">
                <input
                  type="checkbox"
                  checked={isPriority}
                  onChange={(e) => setIsPriority(e.target.checked)}
                  className="h-4 w-4 rounded border-royal-soft/40"
                />
                Priority Order
              </label>
            </div>
          )}

          {activeTab === "shipping" && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as OrderSourceInput)}
                  className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
                >
                  {ORDER_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Order Date (optional)</label>
                <Input
                  type="datetime-local"
                  placeholder="Defaults to today"
                  value={orderDateInput}
                  onChange={(e) => setOrderDateInput(e.target.value)}
                  className="mt-2 w-full"
                />
                <p className="mt-1 text-xs text-royal-soft">Leave empty to use today's date and time.</p>
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. delivery instructions, special request…"
                rows={3}
                className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
              />
            </div>
          )}
        </Card>
```

- [ ] **Step 4: Type-check**

Run (from the `crm` directory): `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "crm/app/(app)/sales/new/NewOrderForm.tsx"
git commit -m "feat(crm): New Order page — tabbed Payment/Shipping/Notes details, wired to createOrder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

From the `crm` directory: `node ./node_modules/next/dist/bin/next dev` (background it; `npx`/`next dev` directly fails in this repo's `&`-containing path — see Global Constraints). Wait for `✓ Ready`.

- [ ] **Step 2: Walk through the page**

Open `http://localhost:3000/sales/new` and:
1. Select a customer.
2. Pick a product from the dropdown, set qty to 2, click **Add** — confirm it appears in the cart table with correct Rate/Amount.
3. Pick the *same* product again with qty 1, click **Add** — confirm the existing row's qty becomes 3 (merged), not a duplicate row.
4. Click the row's ✕ — confirm it's removed and the Bill card's subtotal updates.
5. Add two different products.
6. Switch to the Shipping tab, back to Payment, back to Shipping — confirm the Source/Order Date values you set persist across tab switches (this is a rendering conditional, not unmounted state, so it should).
7. In the Payment tab, type a value into Shipping Charges (e.g. `50`) — confirm the Bill card's Delivery and Total update to use it. Clear the field back to empty — confirm the Bill card reverts to the auto-computed delivery fee.
8. Toggle Priority Order on.
9. In the Notes tab, type a note.
10. Click **Save Order** — confirm it navigates to `/sales` and the new order appears with the expected total, and (via the order detail page) the correct delivery charge, priority flag, and notes.

- [ ] **Step 3: Report results**

If any sub-step doesn't match, note exactly which one and what happened instead — do not mark this task done until all 10 pass.

## Self-Review Notes

- **Spec coverage:** Item picker (Task 3) ✓, cart with remove (Task 3) ✓, tabbed Order Details with Payment/Shipping/Notes (Task 4) ✓, shipping-charge auto-fill/override behavior (Task 4) ✓, priority toggle (Task 4) ✓, order date (Task 4) ✓, `createOrder`/`computeOrderTotals` server-side support (Tasks 1–2) ✓, no schema changes ✓, no Order Status field ✓, no category filters ✓.
- **Placeholder scan:** none found — every step has complete code.
- **Type consistency:** `cart` (Task 3) is read by Task 4's `autoTotals`/`totals`/`handleSaveOrder` under the same name; `removeFromCart`, `pickerProductId`, `pickerQty`, `pickerStock` are only used within Task 3's own JSX. `computeOrderTotals`'s second parameter is named `deliveryOverride` in Task 1's implementation and passed positionally (not by name) from Task 2, so the name mismatch with Task 2's `deliveryChargeOverride` parameter is not a bug.
