"use client";

import { Fragment, useState } from "react";
import Link from "next/link";

interface OrderRow {
  id: string;
  orderNumber: string;
  orderDateLabel: string;
  status: string;
  source: string;
  paymentMethod: string;
  subtotal: number;
  gstAmount: number;
  deliveryCharge: number;
  total: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
}

export function SalesTableBody({ orders }: { orders: OrderRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={8} className="px-4 py-6 text-center text-sm text-royal-soft">No orders match these filters.</td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {orders.map((o) => {
        const isOpen = expandedId === o.id;
        return (
          <Fragment key={o.id}>
            <tr className="border-b border-royal-soft/10 last:border-0">
              <td className="px-2 py-3 text-center">
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : o.id)}
                  aria-label={isOpen ? "Collapse order details" : "Expand order details"}
                  aria-expanded={isOpen}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-royal-soft/30 text-royal-soft transition-transform hover:border-gold hover:text-gold-soft"
                  style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                >
                  ›
                </button>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/sales/${o.id}`}
                  className="inline-block rounded-full bg-royal-soft/10 px-3 py-1 font-semibold text-royal hover:bg-gold/20 hover:text-gold-soft"
                >
                  {o.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/customers/${o.customerId}`} className="hover:text-gold-soft">
                  {o.customerName}
                </Link>
                <p className="text-xs text-royal-soft">{o.customerPhone}</p>
              </td>
              <td className="px-4 py-3">{o.orderDateLabel}</td>
              <td className="px-4 py-3">{o.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">{o.source.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">{o.paymentMethod}</td>
              <td className="px-4 py-3 font-semibold text-royal">₹{o.total}</td>
            </tr>
            {isOpen && (
              <tr className="border-b border-royal-soft/10 bg-royal-soft/5 last:border-0">
                <td />
                <td colSpan={7} className="px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Delivery address</p>
                  <p className="mt-1 text-sm text-ink">{o.customerAddress}</p>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gold-soft">Order items</p>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-royal-soft/15 bg-white">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Unit Price</th>
                          <th className="px-3 py-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map((item) => (
                          <tr key={item.id} className="border-b border-royal-soft/10 last:border-0">
                            <td className="px-3 py-2">{item.productName}</td>
                            <td className="px-3 py-2">{item.quantity}</td>
                            <td className="px-3 py-2">₹{item.unitPrice}</td>
                            <td className="px-3 py-2">₹{item.unitPrice * item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink">
                    <span>Products: <b className="text-royal">{o.items.length}</b></span>
                    <span>Qty: <b className="text-royal">{o.items.reduce((s, i) => s + i.quantity, 0)}</b></span>
                    <span>Subtotal: <b className="text-royal">₹{o.subtotal}</b></span>
                    <span>GST: <b className="text-royal">{o.gstAmount === 0 ? "₹0" : `₹${o.gstAmount}`}</b></span>
                    <span>Delivery: <b className="text-royal">{o.deliveryCharge === 0 ? "Free" : `₹${o.deliveryCharge}`}</b></span>
                    <span>Total: <b className="text-gold-soft">₹{o.total}</b></span>
                    <span>Source: <b className="text-royal">{o.source.replace(/_/g, " ")}</b></span>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </tbody>
  );
}
