"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { createRouteAssignmentAction } from "../actions";
import type { EligibleOrderRow } from "@/lib/routeAssignments";

interface WarehouseOption {
  id: string;
  name: string;
}

interface DeliveryPartnerOption {
  id: string;
  name: string;
}

export function NewRouteAssignmentForm({
  warehouses,
  deliveryPartners,
  orders,
  errorMessage,
}: {
  warehouses: WarehouseOption[];
  deliveryPartners: DeliveryPartnerOption[];
  orders: EligibleOrderRow[];
  errorMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerAddress.toLowerCase().includes(q)
    );
  }, [orders, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const allVisibleSelected = filteredOrders.every((o) => prev.has(o.id));
      const next = new Set(prev);
      for (const o of filteredOrders) {
        if (allVisibleSelected) next.delete(o.id);
        else next.add(o.id);
      }
      return next;
    });
  }

  const selectedTotal = orders.filter((o) => selected.has(o.id)).reduce((sum, o) => sum + o.total, 0);

  return (
    <form action={createRouteAssignmentAction} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        )}

        <Card>
          <h2 className="font-serif text-lg text-royal">Orders for this route</h2>
          <p className="mt-1 text-xs text-royal-soft">Only orders not already on a route are shown.</p>
          <div className="mt-3 flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order #, customer, address…"
              className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={toggleAllVisible}
              className="whitespace-nowrap rounded-full border border-royal-soft/30 px-4 py-2 text-xs font-semibold text-royal-deep hover:bg-slate-50"
            >
              Select all shown
            </button>
          </div>

          <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-xl border border-royal-soft/15">
            <table className="w-full text-left text-sm">
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-royal-soft">No eligible orders found.</td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id} className="border-b border-royal-soft/10 last:border-0">
                      <td className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(o.id)}
                          onChange={() => toggle(o.id)}
                          className="h-4 w-4 rounded border-royal-soft/40"
                        />
                        {selected.has(o.id) && <input type="hidden" name="orderIds" value={o.id} />}
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="font-semibold text-royal">{o.orderNumber}</p>
                        <p className="text-xs text-royal-soft">{o.orderDateLabel} · {o.status.replace(/_/g, " ")}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="text-ink">{o.customerName}</p>
                        <p className="text-xs text-royal-soft truncate max-w-xs">{o.customerAddress}</p>
                      </td>
                      <td className="px-2 py-2.5 text-xs text-royal-soft">{o.itemsSummary}</td>
                      <td className="px-2 py-2.5 text-right font-medium text-royal">₹{o.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div>
        <Card className="sticky top-6">
          <h2 className="font-serif text-lg text-royal">Route details</h2>

          <label className="mt-3 block text-xs font-semibold uppercase tracking-widest text-gold-soft">Warehouse</label>
          <select
            name="warehouseId"
            required
            className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            <option value="">Select a warehouse…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {warehouses.length === 0 && (
            <p className="mt-1 text-xs text-red-600">No warehouses yet — add one on the Warehouses page first.</p>
          )}

          <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-gold-soft">
            Delivery partner (optional)
          </label>
          <select
            name="deliveryPartnerId"
            className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            <option value="">Assign later</option>
            {deliveryPartners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-gold-soft">Notes (optional)</label>
          <textarea
            name="notes"
            rows={3}
            placeholder="e.g. van registration, dispatch time…"
            className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
          />

          <div className="mt-4 space-y-1 border-t border-royal-soft/15 pt-3 text-sm">
            <div className="flex justify-between"><span>Orders selected</span><span>{selected.size}</span></div>
            <div className="flex justify-between font-semibold text-royal"><span>Total</span><span>₹{selectedTotal}</span></div>
          </div>

          <button
            type="submit"
            disabled={selected.size === 0 || warehouses.length === 0}
            className="mt-4 w-full rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-royal-deep disabled:opacity-50"
          >
            Create Route Assignment
          </button>
        </Card>
      </div>
    </form>
  );
}
