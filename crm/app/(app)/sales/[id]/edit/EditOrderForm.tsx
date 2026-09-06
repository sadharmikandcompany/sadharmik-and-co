"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { computeOrderTotals, computeLineAmount } from "@/lib/money";
import { Button, Card, Input } from "@/components/ui";
import { updateOrder, type EditOrderLineInput } from "../../actions";

interface ProductOption {
  id: string;
  name: string;
  packSize: string;
  price: number;
  gstPercentage: number;
  stock: number;
}

interface EditableLine {
  key: string;
  lineId?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
}

interface OrderForEdit {
  id: string;
  status: string;
  paymentMethod: string;
  amountPaid: number;
  deliveryPartnerId: string | null;
  notes: string;
  deliveryNotes: string;
  isPriority: boolean;
  customer: { name: string; phone: string; address: string };
  items: {
    lineId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    discountPercentage: number;
    gstPercentage: number;
  }[];
}

const STATUS_OPTIONS = ["NEW", "ROASTING", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "FAILED", "RESCHEDULED", "CANCELLED"] as const;
const PAYMENT_OPTIONS = ["PENDING", "CASH", "UPI", "CARD", "CHEQUE"] as const;
const TABS = ["payment", "shipping", "notes"] as const;
type Tab = (typeof TABS)[number];

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `line-${keySeq}`;
}

export function EditOrderForm({ order, products, deliveryPartners }: { order: OrderForEdit; products: ProductOption[]; deliveryPartners: { id: string; name: string }[] }) {
  const router = useRouter();

  const [lines, setLines] = useState<EditableLine[]>(() =>
    order.items.map((item) => ({
      key: nextKey(),
      lineId: item.lineId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercentage: item.discountPercentage,
    }))
  );

  const [status, setStatus] = useState(order.status);
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod);
  const [amountPaidInput, setAmountPaidInput] = useState(String(order.amountPaid));
  const [deliveryPartnerId, setDeliveryPartnerId] = useState(order.deliveryPartnerId ?? "");
  const [notes, setNotes] = useState(order.notes);
  const [deliveryNotes, setDeliveryNotes] = useState(order.deliveryNotes);
  const [isPriority, setIsPriority] = useState(order.isPriority);
  const [tab, setTab] = useState<Tab>("payment");

  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // A product's original quantity on THIS order is stock this order can still
  // claim back — the server restores it before re-reserving, so it isn't
  // capped out by the product's currently-free stock.
  const originalQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of order.items) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [order.items]);

  function availableStock(productId: string): number {
    const product = productsById.get(productId);
    if (!product) return 0;
    return product.stock + (originalQtyByProduct.get(productId) ?? 0);
  }

  const billLines = useMemo(
    () =>
      lines
        .filter((l) => l.quantity > 0 && l.productId)
        .map((l) => ({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          gstPercentage: productsById.get(l.productId)?.gstPercentage ?? 0,
          discountPercentage: l.discountPercentage,
        })),
    [lines, productsById]
  );
  const totals = computeOrderTotals(billLines);

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function addLine() {
    const used = new Set(lines.map((l) => l.productId));
    const firstAvailable = products.find((p) => !used.has(p.id)) ?? products[0];
    if (!firstAvailable) return;
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        productId: firstAvailable.id,
        quantity: 1,
        unitPrice: firstAvailable.price,
        discountPercentage: 0,
      },
    ]);
  }

  function handleProductChange(key: string, productId: string) {
    const product = productsById.get(productId);
    updateLine(key, { productId, unitPrice: product?.price ?? 0 });
  }

  function handleSave() {
    if (lines.filter((l) => l.quantity > 0).length === 0) {
      setMessage({ type: "error", text: "Add at least one item." });
      return;
    }
    setMessage(null);
    const payload: EditOrderLineInput[] = lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercentage: l.discountPercentage,
      }));

    startSaving(async () => {
      const result = await updateOrder(order.id, payload, {
        status,
        paymentMethod,
        amountPaid: amountPaidInput ? Number(amountPaidInput) : 0,
        deliveryPartnerId,
        notes,
        deliveryNotes,
        isPriority,
      });
      if (result.ok) {
        router.push("/sales");
      } else {
        setMessage({ type: "error", text: result.error ?? "Could not save changes." });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* Order Items line editor */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-royal">Order Items</h2>
            <Button type="button" variant="ghost" onClick={addLine} disabled={lines.length >= products.length}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-royal-soft">
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2 w-28">Qty</th>
                  <th className="px-2 py-2 w-28">Unit Price</th>
                  <th className="px-2 py-2 w-24">Disc %</th>
                  <th className="px-2 py-2 w-20">GST %</th>
                  <th className="px-2 py-2 w-28 text-right">Total</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const product = productsById.get(line.productId);
                  const max = availableStock(line.productId);
                  const lineAmount = computeLineAmount({
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    discountPercentage: line.discountPercentage,
                  });
                  return (
                    <tr key={line.key} className="border-t border-royal-soft/10">
                      <td className="px-2 py-2">
                        <select
                          value={line.productId}
                          onChange={(e) => handleProductChange(line.key, e.target.value)}
                          className="w-full rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.packSize})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          max={max}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: Math.max(0, Math.min(Number(e.target.value) || 0, max)) })}
                          className="w-full rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm"
                        />
                        <p className="mt-0.5 text-[11px] text-royal-soft">{max} available</p>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={line.discountPercentage}
                          onChange={(e) => updateLine(line.key, { discountPercentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          className="w-full rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-royal-soft">{product?.gstPercentage ?? 0}%</td>
                      <td className="px-2 py-2 text-right font-semibold text-royal">₹{lineAmount}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="text-royal-soft hover:text-red-600"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-royal-soft">
                      No items — add one to continue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Order Details: Payment / Shipping / Notes tabs */}
        <Card>
          <h2 className="font-serif text-lg text-royal">Order Details</h2>
          <div className="mt-3 flex gap-2 border-b border-royal-soft/15">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-semibold capitalize ${
                  tab === t ? "border-b-2 border-gold text-royal" : "text-royal-soft"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "payment" && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Order Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
                >
                  {PAYMENT_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p === "PENDING" ? "Pending / COD" : p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Amount Paid (₹)</label>
                <Input
                  type="number"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  className="mt-2 w-full"
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-royal sm:col-span-2">
                <input type="checkbox" checked={isPriority} onChange={(e) => setIsPriority(e.target.checked)} />
                Mark as Priority
              </label>
            </div>
          )}

          {tab === "shipping" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-royal-soft/15 px-4 py-3 text-sm">
                <p className="font-semibold text-royal">{order.customer.name}</p>
                <p className="text-royal-soft">{order.customer.phone}</p>
                <p className="mt-1 whitespace-pre-wrap text-royal-soft">{order.customer.address}</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Delivery Partner</label>
                <select
                  value={deliveryPartnerId}
                  onChange={(e) => setDeliveryPartnerId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {deliveryPartners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Delivery Notes</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. gate code, landmark, preferred time…"
                  className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
                />
              </div>
            </div>
          )}

          {tab === "notes" && (
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Order Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="e.g. special request, internal note…"
                className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
              />
            </div>
          )}
        </Card>
      </div>

      <div>
        <Card className="sticky top-6">
          <h2 className="font-serif text-lg text-royal">Bill</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal}</span></div>
            <div className="flex justify-between"><span>GST</span><span>{totals.gst === 0 ? "₹0" : `₹${totals.gst}`}</span></div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>{totals.delivery === 0 ? "Free" : `₹${totals.delivery}`}</span>
            </div>
            <div className="flex justify-between border-t border-royal-soft/15 pt-2 font-semibold text-royal">
              <span>Total</span><span>₹{totals.total}</span>
            </div>
          </div>

          {message?.type === "error" && <p className="mt-4 text-sm text-red-600">{message.text}</p>}

          <Button type="button" onClick={handleSave} disabled={isSaving} className="mt-4 w-full justify-center">
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
