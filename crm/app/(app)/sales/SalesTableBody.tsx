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

                  <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-gold-soft">Items</p>
                  <ul className="mt-1 max-w-xs space-y-1 text-sm text-ink">
                    {o.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4">
                        <span>{item.productName} × {item.quantity}</span>
                        <span>₹{item.unitPrice * item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </tbody>
  );
}
