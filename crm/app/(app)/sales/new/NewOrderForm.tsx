"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeOrderTotals } from "@/lib/money";
import { Button, Card, Input } from "@/components/ui";
import {
  addCustomerInline,
  createOrder,
  type OrderSourceInput,
  type PaymentMethodInput,
} from "@/lib/orders";

interface ProductOption {
  id: string;
  name: string;
  packSize: string;
  price: number;
  gstPercentage: number;
  stock: number;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
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

export function NewOrderForm({ products, customers }: { products: ProductOption[]; customers: CustomerOption[] }) {
  const router = useRouter();

  const [customerList, setCustomerList] = useState(customers);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [productQuery, setProductQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [source, setSource] = useState<OrderSourceInput>("PHONE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInput>("PENDING");
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isAddingCustomer, startAddingCustomer] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return customerList.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
  }, [customerList, customerQuery]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productQuery]);

  const cartLines = useMemo(
    () => products.filter((p) => (quantities[p.id] ?? 0) > 0).map((p) => ({ product: p, quantity: quantities[p.id] })),
    [products, quantities]
  );

  const billLines = useMemo(
    () => cartLines.map(({ product, quantity }) => ({ quantity, unitPrice: product.price, gstPercentage: product.gstPercentage })),
    [cartLines]
  );
  const totals = computeOrderTotals(billLines);

  function setQty(productId: string, qty: number, stock: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, Math.min(qty, stock)) }));
  }

  function handleCreateCustomer() {
    setCustomerError(null);
    startAddingCustomer(async () => {
      const result = await addCustomerInline(newCustomer.name, newCustomer.phone, newCustomer.address);
      if (result.ok && result.customer) {
        setCustomerList((prev) => [...prev, result.customer!]);
        setSelectedCustomer(result.customer);
        setNewCustomer({ name: "", phone: "", address: "" });
        setShowNewCustomerForm(false);
        setCustomerQuery("");
      } else {
        setCustomerError(result.error ?? "Could not add customer.");
      }
    });
  }

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
        router.push(`/sales/${result.orderId}`);
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
                placeholder="Search by name, phone…"
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
                        <span className="font-medium text-royal">{c.name}</span>
                        <span className="text-royal-soft">{c.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNewCustomerForm((v) => !v)}
                className="mt-3"
              >
                + Add new customer
              </Button>
              {showNewCustomerForm && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  {customerError && <p className="text-sm text-red-600 sm:col-span-3">{customerError}</p>}
                  <Button
                    type="button"
                    onClick={handleCreateCustomer}
                    disabled={isAddingCustomer}
                    className="justify-center sm:col-span-3"
                  >
                    {isAddingCustomer ? "Saving…" : "Save customer"}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

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

        <Card>
          <h2 className="font-serif text-lg text-royal">Order details</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Payment</label>
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
          </div>
          <div className="mt-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. delivery instructions, special request…"
              rows={3}
              className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
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
            disabled={isSaving || cartLines.length === 0}
            className="mt-4 w-full justify-center"
          >
            {isSaving ? "Saving…" : "Save Order"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
