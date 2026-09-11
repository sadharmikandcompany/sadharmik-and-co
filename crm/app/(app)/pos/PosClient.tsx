"use client";

import { useMemo, useState, useTransition } from "react";
import { computeOrderTotals } from "@/lib/money";
import { effectivePrice } from "@/lib/pricing";
import { Button, Card, Input, Modal } from "@/components/ui";
import { createOrder, type OrderSourceInput, type PaymentMethodInput } from "@/lib/orders";
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
  imageUrl: string | null;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  vipNumber?: number;
  isMandir: boolean;
  isShop: boolean;
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

export function PosClient({
  products,
  customers,
  nextVipNumber,
  nextMandirNumber,
  nextShopNumber,
}: {
  products: ProductOption[];
  customers: CustomerOption[];
  nextVipNumber?: number;
  nextMandirNumber?: number;
  nextShopNumber?: number;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [productQuery, setProductQuery] = useState("");

  const [customerList, setCustomerList] = useState(customers);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInput>("CASH");
  const [source, setSource] = useState<OrderSourceInput>("WALK_IN");

  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
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
        unitPrice: effectivePrice(product, selectedCustomer),
        gstPercentage: product.gstPercentage,
      })),
    [cartLines, selectedCustomer]
  );
  const totals = computeOrderTotals(billLines);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const qCode = q.replace(/\s+/g, "");
    const code = (c: CustomerOption) => (c.vipNumber ? `sd${String(c.vipNumber).padStart(4, "0")}` : "");
    return customerList.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || code(c).includes(qCode)
    );
  }, [customerList, customerQuery]);

  function setQty(productId: string, qty: number, stock: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(0, Math.min(qty, stock)) }));
  }

  function openCustomerModal() {
    setCustomerQuery("");
    setShowCustomerModal(true);
  }

  function chooseCustomer(customer: CustomerOption) {
    setSelectedCustomer(customer);
    setShowCustomerModal(false);
    setShowCheckoutModal(true);
  }

  function handleNewCustomer(customer: { id: string; name: string; phone: string; vipNumber?: number | null; isMandir: boolean; isShop: boolean }) {
    const c = { ...customer, vipNumber: customer.vipNumber ?? undefined };
    setCustomerList((prev) => [...prev, c]);
    chooseCustomer(c);
  }

  function handleCompleteOrder() {
    if (!selectedCustomer) return;
    setMessage(null);
    startCompletingOrder(async () => {
      const result = await createOrder(
        selectedCustomer.id,
        cartLines.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
          unitPrice: effectivePrice(product, selectedCustomer),
        })),
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
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-royal-soft/10 text-[9px] text-royal-soft">
                        No photo
                      </span>
                    )}
                    <div>
                      <p className="font-semibold text-royal">{p.name}</p>
                      <p className="text-xs text-royal-soft">₹{p.price} / {p.packSize} · {p.stock} in stock</p>
                    </div>
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
        <Modal title="Select customer" subtitle="Search by name, phone, or Sd code" onClose={() => setShowCustomerModal(false)}>
          <Input
            placeholder="Search by name, phone, or Sd code…"
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
                    <span className="font-medium text-royal">
                      {c.vipNumber && <span className="text-gold-soft font-mono mr-2">Sd {String(c.vipNumber).padStart(4, '0')}</span>}
                      {c.name}
                    </span>
                    <span className="text-royal-soft">{c.phone}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="mt-4">
            <AddCustomerButton
              nextVipNumber={nextVipNumber}
              nextMandirNumber={nextMandirNumber}
              nextShopNumber={nextShopNumber}
              onSuccess={handleNewCustomer}
            />
          </div>
        </Modal>
      )}

      {showCheckoutModal && selectedCustomer && (
        <Modal
          title="Complete Order"
          subtitle="Review order details and select payment method"
          onClose={() => setShowCheckoutModal(false)}
        >
          <div className="rounded-xl border border-royal-soft/15 px-4 py-3">
            <p className="font-semibold text-royal">
              {selectedCustomer.vipNumber && <span className="text-gold-soft font-mono mr-2">Sd {String(selectedCustomer.vipNumber).padStart(4, '0')}</span>}
              {selectedCustomer.name}
            </p>
            <p className="text-sm text-royal-soft">{selectedCustomer.phone}</p>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gold-soft">Payment method</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${paymentMethod === m.value
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
                <span>₹{effectivePrice(product, selectedCustomer) * quantity}</span>
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
