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
