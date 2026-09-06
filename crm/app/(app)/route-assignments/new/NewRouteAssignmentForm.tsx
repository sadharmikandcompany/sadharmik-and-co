"use client";

import { useMemo, useState } from "react";
import { Filter, Package, RotateCcw, Truck } from "lucide-react";
import { Card } from "@/components/ui";
import { createRouteAssignmentAction, removeOrderFromRoute } from "../actions";
import type { EligibleOrderRow, AssignedOrderRow } from "@/lib/routeAssignments";

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
  assignedOrders,
  errorMessage,
}: {
  warehouses: WarehouseOption[];
  deliveryPartners: DeliveryPartnerOption[];
  orders: EligibleOrderRow[];
  assignedOrders: AssignedOrderRow[];
  errorMessage?: string;
}) {
  const [warehouseId, setWarehouseId] = useState("");
  const [deliveryPartnerId, setDeliveryPartnerId] = useState("");
  const [notes, setNotes] = useState("");
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
      const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((o) => prev.has(o.id));
      const next = new Set(prev);
      for (const o of filteredOrders) {
        if (allVisibleSelected) next.delete(o.id);
        else next.add(o.id);
      }
      return next;
    });
  }

  function handleReset() {
    setWarehouseId("");
    setDeliveryPartnerId("");
    setNotes("");
    setQuery("");
    setSelected(new Set());
  }

  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selected.has(o.id));
  const selectedTotal = orders.filter((o) => selected.has(o.id)).reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="mt-6 space-y-6">
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      )}

      {/* Assignment Filters */}
      <Card>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gold-soft" />
          <h2 className="font-serif text-lg text-royal">Assignment Filters</h2>
        </div>
        <p className="mt-1 text-xs text-royal-soft">
          Select a warehouse and delivery partner, then choose orders below to assign.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Warehouse *</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Delivery Partner</label>
            <select
              value={deliveryPartnerId}
              onChange={(e) => setDeliveryPartnerId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">Assign later</option>
              {deliveryPartners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleReset}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-royal-soft/30 px-5 py-2.5 text-sm font-semibold text-royal-deep hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>
        {warehouses.length === 0 && (
          <p className="mt-2 text-xs text-red-600">No warehouses yet — add one on the Warehouses page first.</p>
        )}
      </Card>

      {/* Unassigned Orders + submit */}
      <form action={createRouteAssignmentAction}>
        <input type="hidden" name="warehouseId" value={warehouseId} />
        <input type="hidden" name="deliveryPartnerId" value={deliveryPartnerId} />
        <input type="hidden" name="notes" value={notes} />
        {Array.from(selected).map((id) => (
          <input key={id} type="hidden" name="orderIds" value={id} />
        ))}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gold-soft" />
              <h2 className="font-serif text-lg text-royal">Unassigned Orders</h2>
            </div>
            <span className="rounded-full bg-royal-soft/10 px-3 py-1 text-xs font-semibold text-royal">
              {selected.size} selected · {filteredOrders.length} of {orders.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-royal-soft">Pick orders to load onto this route.</p>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders, customer, address…"
            className="mt-3 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
          />

          <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-xl border border-royal-soft/15">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-ivory">
                <tr className="text-xs uppercase tracking-wider text-royal-soft">
                  <th className="w-10 px-3 py-2">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 rounded border-royal-soft/40" />
                  </th>
                  <th className="px-2 py-2">Order</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2">Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-royal-soft">No eligible orders found.</td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id} className="border-t border-royal-soft/10">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(o.id)}
                          onChange={() => toggle(o.id)}
                          className="h-4 w-4 rounded border-royal-soft/40"
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="font-semibold text-royal">A{o.invoiceNumber}</p>
                        <p className="text-xs text-royal-soft">{o.orderNumber} · {o.orderDateLabel}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="text-ink">{o.customerName}</p>
                        <p className="text-xs text-royal-soft">{o.customerPhone}</p>
                      </td>
                      <td className="px-2 py-2.5 text-right font-medium text-royal">₹{o.total}</td>
                      <td className="px-2 py-2.5 text-xs text-royal-soft max-w-xs truncate">{o.customerAddress}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. van registration, dispatch time…"
                className="mt-2 w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
              />
            </div>
            <div className="text-sm text-royal-soft sm:text-right">
              <p>{selected.size} orders selected</p>
              <p className="font-semibold text-royal">₹{selectedTotal}</p>
            </div>
            <button
              type="submit"
              disabled={selected.size === 0 || !warehouseId || warehouses.length === 0}
              className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-royal-deep disabled:opacity-50"
            >
              Create Route Assignment
            </button>
          </div>
        </Card>
      </form>

      {/* Assigned Orders — pull one back off its route */}
      <Card>
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-gold-soft" />
          <h2 className="font-serif text-lg text-royal">Assigned Orders</h2>
        </div>
        <p className="mt-1 text-xs text-royal-soft">
          Already on a route — unassign one to make it available again (e.g. a delivery didn't go out).
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-royal-soft/15">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-royal-soft">
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {assignedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-royal-soft">No orders on a route right now.</td>
                </tr>
              ) : (
                assignedOrders.map((o) => (
                  <tr key={o.id} className="border-t border-royal-soft/10">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-royal">A{o.invoiceNumber}</p>
                      <p className="text-xs text-royal-soft">{o.orderNumber}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-ink">{o.customerName}</p>
                      <p className="text-xs text-royal-soft">{o.customerPhone}</p>
                    </td>
                    <td className="px-3 py-2.5 text-royal-soft">
                      Route #{o.routeNumber} · {o.warehouseName}
                    </td>
                    <td className="px-3 py-2.5 text-royal-soft">{o.deliveryPartnerName ?? "Unassigned"}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-royal">₹{o.total}</td>
                    <td className="px-3 py-2.5 text-center">
                      <form action={removeOrderFromRoute}>
                        <input type="hidden" name="routeId" value={o.routeId} />
                        <input type="hidden" name="orderId" value={o.id} />
                        <button type="submit" className="text-xs font-semibold text-red-600 hover:text-red-700">
                          Unassign
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
