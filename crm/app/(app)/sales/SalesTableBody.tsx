"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { deleteOrder } from "./actions";

interface OrderRow {
  id: string;
  orderNumber: string;
  invoiceNumber: number;
  orderDateLabel: string;
  status: string;
  source: string;
  paymentMethod: string;
  subtotal: number;
  gstAmount: number;
  deliveryCharge: number;
  total: number;
  amountPaid: number;
  customerId: string;
  customerName: string;
  customerVipNumber: number;
  customerPhone: string;
  customerAddress: string;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
}

export function SalesTableBody({ orders }: { orders: OrderRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Clicking anywhere on a row toggles it — except a link/button inside the
  // row, which should navigate/act normally. Deliberately not using
  // stopPropagation on those for this: Next.js's <Link> intercepts clicks
  // via a delegated listener on an ancestor, so stopping propagation on the
  // link itself silently blocks its own navigation.
  function toggleRow(id: string, e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    setExpandedId((current) => (current === id ? null : id));
  }

  if (orders.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={9} className="px-4 py-6 text-center text-sm text-royal-soft">No orders match these filters.</td>
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
            <tr
              onClick={(e) => toggleRow(o.id, e)}
              className="cursor-pointer border-b border-royal-soft/10 last:border-0 hover:bg-royal-soft/5"
            >
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-royal-deep">A{o.invoiceNumber}</span>
                  <Link href={`/sales/${o.id}/print?type=a4`} target="_blank" className="text-royal-soft hover:text-royal-deep" title="Print A4">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  </Link>
                  <Link href={`/sales/${o.id}/print?type=thermal`} target="_blank" className="text-royal-soft hover:text-royal-deep" title="Print Thermal">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </Link>
                </div>
                <Link
                  href={`/sales/${o.id}`}
                  className="text-xs text-royal-soft hover:text-gold-soft inline-flex items-center gap-1"
                >
                  {o.orderNumber}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/customers/${o.customerId}`} className="hover:text-gold-soft font-medium text-royal">
                  {o.customerVipNumber && <span className="text-gold-soft font-mono font-bold mr-1">Sd {String(o.customerVipNumber).padStart(4, '0')}</span>}
                  {o.customerName}
                </Link>
                <p className="text-xs text-royal-soft">{o.customerPhone}</p>
              </td>
              <td className="max-w-[220px] px-4 py-3">
                <p className="truncate text-sm text-royal-soft" title={o.customerAddress}>{o.customerAddress}</p>
              </td>
              <td className="px-4 py-3">{o.orderDateLabel}</td>
              <td className="px-4 py-3">{o.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">{o.source.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">{o.paymentMethod}</td>
              <td className="px-4 py-3 font-semibold text-royal">₹{o.total}</td>
              <td className="px-4 py-3 font-semibold text-gold-soft">
                {o.total - o.amountPaid > 0 ? `₹${o.total - o.amountPaid}` : "—"}
              </td>
            </tr>
            {isOpen && (
              <tr className="border-b border-royal-soft/10 bg-royal-soft/5 last:border-0">
                <td />
                <td colSpan={8} className="px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Order items</p>
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
                    <span>Paid: <b className="text-royal">₹{o.amountPaid}</b></span>
                    <span>Balance: <b className="text-royal">₹{o.total - o.amountPaid}</b></span>
                    <span>Source: <b className="text-royal">{o.source.replace(/_/g, " ")}</b></span>
                    <div className="mt-4 flex gap-3">
                      <Link
                        href={`/sales/${o.id}`}
                        className="rounded-full bg-royal-soft/10 px-4 py-2 text-sm font-semibold text-royal hover:bg-gold/20 hover:text-gold-soft"
                      >
                        Edit / Manage
                      </Link>
                      <form action={deleteOrder} onSubmit={(e) => { if(!confirm("Are you sure you want to delete this order?")) e.preventDefault(); }}>
                        <input type="hidden" name="id" value={o.id} />
                        <button
                          type="submit"
                          className="rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/20"
                        >
                          Delete Order
                        </button>
                      </form>
                    </div>
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
