"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeOrderTotals } from "@/lib/money";
import { effectivePrice } from "@/lib/pricing";
import { Button, Card, Input } from "@/components/ui";
import {
  createOrder,
  type OrderSourceInput,
  type PaymentMethodInput,
} from "@/lib/orders";
import { AddCustomerButton } from "@/app/(app)/customers/AddCustomerButton";

interface ProductOption {
  id: string;
  name: string;
  packSize: string;
  price: number;
  mandirPrice: number | null;
  shopPrice: number | null;
  gstPercentage: number;
  stock: number;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  vipNumber?: number;
  isMandir: boolean;
  isShop: boolean;
}

// "Sd0001"-style code so staff can search by the customer's printed code,
// not just name/phone.
function customerCode(vipNumber?: number) {
  return vipNumber ? `sd${String(vipNumber).padStart(4, "0")}` : "";
}

const PAYMENT_METHODS: { value: PaymentMethodInput; label: string }[] = [
  { value: "PENDING", label: "Pending / COD" },
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
];

const ORDER_SOURCES: { value: OrderSourceInput; label: string }[] = [
  { value: "PHONE", label: "Phone" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "WEBSITE", label: "Website" },
];

export function NewOrderForm({ nextVipNumber, products, customers }: { nextVipNumber?: number, products: ProductOption[]; customers: CustomerOption[] }) {
  const router = useRouter();

  const [customerList, setCustomerList] = useState(customers);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");

  const [productQuery, setProductQuery] = useState("");
  const [pickerProductId, setPickerProductId] = useState("");
  const [pickerQty, setPickerQty] = useState(1);
  const [cart, setCart] = useState<{ product: ProductOption; quantity: number; unitPrice: number }[]>([]);

  const [source, setSource] = useState<OrderSourceInput>("PHONE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInput>("PENDING");
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [shippingChargeInput, setShippingChargeInput] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [orderDateInput, setOrderDateInput] = useState("");
  const [activeTab, setActiveTab] = useState<"payment" | "shipping" | "notes">("payment");

  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const qCode = q.replace(/\s+/g, "");
    return customerList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        customerCode(c.vipNumber).includes(qCode)
    );
  }, [customerList, customerQuery]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productQuery]);

  const billLines = useMemo(
    () => cart.map(({ quantity, unitPrice, product }) => ({ quantity, unitPrice, gstPercentage: product.gstPercentage })),
    [cart]
  );
  const autoTotals = computeOrderTotals(billLines);
  const effectiveDelivery =
    shippingChargeInput.trim() === "" ? autoTotals.delivery : Math.max(0, Math.round(Number(shippingChargeInput)) || 0);
  const totals = { ...autoTotals, delivery: effectiveDelivery, total: autoTotals.subtotal + autoTotals.gst + effectiveDelivery };

  function handleAddToCart() {
    const product = products.find((p) => p.id === pickerProductId);
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        // Adding a product that's already in the cart just bumps its
        // quantity — the rate the staff may have already edited stays put.
        const nextQuantity = Math.min(existing.quantity + pickerQty, product.stock);
        return prev.map((line) => (line.product.id === product.id ? { ...line, quantity: nextQuantity } : line));
      }
      return [...prev, { product, quantity: Math.min(pickerQty, product.stock), unitPrice: effectivePrice(product, selectedCustomer) }];
    });
    setPickerProductId("");
    setPickerQty(1);
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((line) => line.product.id !== productId));
  }

  function updateCartUnitPrice(productId: string, unitPrice: number) {
    setCart((prev) => prev.map((line) => (line.product.id === productId ? { ...line, unitPrice: Math.max(0, unitPrice) } : line)));
  }

  function updateCartQuantity(productId: string, quantity: number) {
    setCart((prev) =>
      prev.map((line) =>
        line.product.id === productId ? { ...line, quantity: Math.max(1, Math.min(quantity, line.product.stock)) } : line
      )
    );
  }

  const pickerStock = products.find((p) => p.id === pickerProductId)?.stock ?? 1;

  function handleSaveOrder() {
    if (!selectedCustomer) {
      setMessage({ type: "error", text: "Select a customer first." });
      return;
    }
    setMessage(null);
    startSaving(async () => {
      const result = await createOrder(
        selectedCustomer.id,
        cart.map(({ product, quantity, unitPrice }) => ({ productId: product.id, quantity, unitPrice })),
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <h2 className="font-serif text-lg text-royal">Customer</h2>
          {selectedCustomer ? (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
              <div>
                <p className="font-semibold text-royal">{selectedCustomer.name}</p>
                <p className="text-sm text-royal-soft">{selectedCustomer.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-sm text-royal-soft hover:text-gold-soft"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Search by name, phone, or Sd code…"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                className="mt-3"
              />
              {customerQuery.trim().length >= 2 && (
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-sm text-royal-soft">No matching customers.</p>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className="flex w-full items-center justify-between rounded-xl border border-royal-soft/15 px-4 py-2.5 text-left text-sm hover:border-gold"
                      >
                        <span className="font-medium text-royal">
                          {c.vipNumber && <span className="text-gold-soft font-mono mr-2">Sd {String(c.vipNumber).padStart(4, "0")}</span>}
                          {c.name}
                        </span>
                        <span className="text-royal-soft">{c.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="mt-3">
                <AddCustomerButton 
                  nextVipNumber={nextVipNumber}
                  onSuccess={(customer) => {
                    setCustomerList((prev) => [...prev, customer]);
                    setSelectedCustomer(customer);
                    setCustomerQuery("");
                  }} 
                />
              </div>
            </>
          )}
        </Card>

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
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min={1}
                          max={line.product.stock}
                          value={line.quantity}
                          onChange={(e) => updateCartQuantity(line.product.id, Number(e.target.value) || 1)}
                          className="w-16 rounded-lg border border-royal-soft/30 bg-white px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={line.unitPrice}
                          onChange={(e) => updateCartUnitPrice(line.product.id, Number(e.target.value) || 0)}
                          className="w-20 rounded-lg border border-royal-soft/30 bg-white px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 text-right">₹{line.unitPrice * line.quantity}</td>
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

          <Button
            type="button"
            onClick={handleSaveOrder}
            disabled={isSaving || cart.length === 0}
            className="mt-4 w-full justify-center"
          >
            {isSaving ? "Saving…" : "Save Order"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
