"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { createPurchase, type PurchaseLineInput } from "./actions";

export function PurchaseForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [supplierId, setSupplierId] = useState("");
  const [paidStatus, setPaidStatus] = useState<"PAID" | "DUE" | "PARTIAL">("DUE");
  const [lines, setLines] = useState<PurchaseLineInput[]>([{ itemName: "", quantity: 0, unit: "kg", rate: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateLine(index: number, patch: Partial<PurchaseLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { itemName: "", quantity: 0, unit: "kg", rate: 0 }]);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createPurchase(supplierId, paidStatus, lines);
        setLines([{ itemName: "", quantity: 0, unit: "kg", rate: 0 }]);
        setSupplierId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the purchase.");
      }
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        >
          <option value="">Select a supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={paidStatus}
          onChange={(e) => setPaidStatus(e.target.value as "PAID" | "DUE" | "PARTIAL")}
          className="rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
        >
          <option value="DUE">Due</option>
          <option value="PARTIAL">Partially paid</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input
              placeholder="Item (e.g. Wheat flour)"
              value={line.itemName}
              onChange={(e) => updateLine(i, { itemName: e.target.value })}
            />
            <Input
              placeholder="Qty"
              type="number"
              min="0"
              value={line.quantity || ""}
              onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
            />
            <Input placeholder="Unit (kg)" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
            <Input
              placeholder="Rate (₹)"
              type="number"
              min="0"
              value={line.rate || ""}
              onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="ghost" onClick={addLine}>+ Add line</Button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="button" onClick={submit} disabled={isPending}>
        {isPending ? "Saving…" : "Save purchase"}
      </Button>
    </div>
  );
}
