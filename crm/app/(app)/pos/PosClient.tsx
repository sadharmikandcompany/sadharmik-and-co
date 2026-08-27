"use client";

import { useMemo, useState, useTransition } from "react";
import { computeOrderTotals } from "@/lib/money";
import { Button, Card, Input, Modal } from "@/components/ui";
import { addCustomerInline, createOrder, type OrderSourceInput, type PaymentMethodInput } from "@/lib/orders";

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
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
];

const ORDER_SOURCES: { value: OrderSourceInput; label: string }[] = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE", label: "Phone" },
  { value: "WEBSITE", label: "Website" },
];

export function PosClient({ products, customers }: { products: ProductOption[]; customers: CustomerOption[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [productQuery, setProductQuery] = useState("");

  const [customerList, setCustomerList] = useState(customers);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [customerModalError, setCustomerModalError] = useState<string | null>(null);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInput>("CASH");
  const [source, setSource] = useState<OrderSourceInput>("WALK_IN");

  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isAddingCustomer, startAddingCustomer] = useTransition();
  const [isCompletingOrder, startCompletingOrder] = useTransition();

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productQuery]);

  const cartLines = useMemo(
    () =>
      products
        .filter((p) => (quantities[p.id] ?? 0) > 0)
        .map((p) => ({
          product: p,
          quantity: quantities[p.id],
        })),
    [products, quantities]
  );

  const billLines = useMemo(
    () =>
      cartLines.map(({ product, quantity }) => ({
        quantity,
        unitPrice: product.price,
        gstPercentage: product.gstPercentage,
      })),
    [cartLines]
  );
  const totals = computeOrderTotals(billLines);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return customerList.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
  }, [customerList, customerQuery]);

  function setQty(productId: string, qty: number, stock: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, Math.min(qty, stock)) }));
  }

  function openCustomerModal() {
    setCustomerModalError(null);
    setCustomerQuery("");
    setShowNewCustomerForm(false);
    setShowCustomerModal(true);
  }

  function chooseCustomer(customer: CustomerOption) {
    setSelectedCustomer(customer);
    setShowCustomerModal(false);
    setShowCheckoutModal(true);
  }

  function handleCreateCustomer() {
    setCustomerModalError(null);
    startAddingCustomer(async () => {
      const result = await addCustomerInline(newCustomer.name, newCustomer.phone, newCustomer.address);
      if (result.ok && result.customer) {
        setCustomerList((prev) => [...prev, result.customer!]);
        setNewCustomer({ name: "", phone: "", address: "" });
        setShowNewCustomerForm(false);
        chooseCustomer(result.customer);
      } else {
        setCustomerModalError(result.error ?? "Could not add customer.");
      }
    });
  }

  function handleCompleteOrder() {
    if (!selectedCustomer) return;
    setMessage(null);
    startCompletingOrder(async () => {
      const result = await createOrder(
        selectedCustomer.id,
        cartLines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        source,
        paymentMethod
      );
      if (result.ok) {
        setMessage({ type: "success", text: `Order ${result.orderNumber} saved.` });
        setQuantities({});
        setSelectedCustomer(null);
        setShowCheckoutModal(false);
        setPaymentMethod("CASH");
        setSource("WALK_IN");
      } else {
        setMessage({ type: "error", text: result.error ?? "Could not save the order." });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <Input
            placeholder="Search products…"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
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

          {message && (
            <p className={`mt-4 text-sm ${message.type === "error" ? "text-red-600" : "text-emerald-600"}`}>
              {message.text}
            </p>
          )}

          <Button
            type="button"
            onClick={openCustomerModal}
            disabled={cartLines.length === 0}
            className="mt-4 w-full justify-center"
          >
            Select Customer to Checkout
          </Button>
        </Card>
      </div>

      {showCustomerModal && (
        <Modal title="Select customer" subtitle="Search by name or phone" onClose={() => setShowCustomerModal(false)}>
          <Input
            placeholder="Search by name, phone…"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            autoFocus
          />

          {customerQuery.trim().length > 0 && customerQuery.trim().length < 2 && (
            <p className="mt-3 text-sm text-royal-soft">Type at least 2 characters to search…</p>
          )}

          {customerQuery.trim().length >= 2 && (
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <p className="text-sm text-royal-soft">No matching customers.</p>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => chooseCustomer(c)}
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
            className="mt-4"
          >
            + Add New Customer
          </Button>

          {showNewCustomerForm && (
            <div className="mt-4 grid grid-cols-1 gap-3">
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
              {customerModalError && <p className="text-sm text-red-600">{customerModalError}</p>}
              <Button type="button" onClick={handleCreateCustomer} disabled={isAddingCustomer} className="justify-center">
                {isAddingCustomer ? "Saving…" : "Save customer"}
              </Button>
            </div>
          )}
        </Modal>
      )}

      {showCheckoutModal && selectedCustomer && (
        <Modal
          title="Complete Order"
          subtitle="Review order details and select payment method"
          onClose={() => setShowCheckoutModal(false)}
        >
          <div className="rounded-xl border border-royal-soft/15 px-4 py-3">
            <p className="font-semibold text-royal">{selectedCustomer.name}</p>
            <p className="text-sm text-royal-soft">{selectedCustomer.phone}</p>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gold-soft">Payment method</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  paymentMethod === m.value
                    ? "border-gold bg-gold text-royal-deep"
                    : "border-royal-soft/30 text-royal"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gold-soft">Order source</p>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as OrderSourceInput)}
            className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            {ORDER_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gold-soft">Items</p>
          <ul className="mt-2 space-y-1 text-sm">
            {cartLines.map(({ product, quantity }) => (
              <li key={product.id} className="flex justify-between">
                <span>{product.name} × {quantity}</span>
                <span>₹{product.price * quantity}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1 border-t border-royal-soft/15 pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal}</span></div>
            <div className="flex justify-between"><span>GST</span><span>{totals.gst === 0 ? "₹0" : `₹${totals.gst}`}</span></div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>{totals.delivery === 0 ? "Free" : `₹${totals.delivery}`}</span>
            </div>
            <div className="flex justify-between font-semibold text-royal">
              <span>Total Amount</span><span>₹{totals.total}</span>
            </div>
          </div>

          {message?.type === "error" && <p className="mt-3 text-sm text-red-600">{message.text}</p>}

          <div className="mt-5 flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowCheckoutModal(false)} className="flex-1 justify-center">
              Cancel
            </Button>
            <Button type="button" onClick={handleCompleteOrder} disabled={isCompletingOrder} className="flex-1 justify-center">
              {isCompletingOrder ? "Saving…" : "Complete Order"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
