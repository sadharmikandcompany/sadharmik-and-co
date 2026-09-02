"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";
import { createPurchase, updatePurchase, type PurchaseLineInput } from "./actions";

export interface PurchaseOrderFormProps {
  purchaseId?: string;
  initialData?: {
    supplierId: string;
    paidStatus: "PAID" | "DUE" | "PARTIAL";
    purchaseStatus: "PENDING" | "RECEIVED" | "CANCELLED";
    poNumber: string;
    invoiceNumber: string;
    paymentMethod: string;
    batchNumber: string;
    notes: string;
    amountPaid: number;
    purchaseDate: string;
    lines: PurchaseLineInput[];
  };
  suppliers: { id: string; name: string }[];
}

export function PurchaseOrderForm({ purchaseId, initialData, suppliers }: PurchaseOrderFormProps) {
  const router = useRouter();
  
  const [supplierId, setSupplierId] = useState(initialData?.supplierId || "");
  const [paidStatus, setPaidStatus] = useState<"PAID" | "DUE" | "PARTIAL">(initialData?.paidStatus || "DUE");
  const [purchaseStatus, setPurchaseStatus] = useState<"PENDING" | "RECEIVED" | "CANCELLED">(initialData?.purchaseStatus || "PENDING");
  
  const [poNumber, setPoNumber] = useState(initialData?.poNumber || "");
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoiceNumber || "");
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || "");
  const [batchNumber, setBatchNumber] = useState(initialData?.batchNumber || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [amountPaid, setAmountPaid] = useState<string>(initialData?.amountPaid?.toString() || "");
  const [purchaseDate, setPurchaseDate] = useState(initialData?.purchaseDate ? new Date(initialData.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

  const [lines, setLines] = useState<PurchaseLineInput[]>(initialData?.lines || [{ itemName: "", quantity: 0, unit: "kg", rate: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalAmount = lines.reduce((acc, line) => acc + (line.quantity * line.rate), 0);

  function updateLine(index: number, patch: Partial<PurchaseLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { itemName: "", quantity: 0, unit: "kg", rate: 0 }]);
  }
  
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const parsedAmountPaid = amountPaid ? Number(amountPaid) : 0;
      const optionalFields = {
        poNumber,
        invoiceNumber,
        paymentMethod,
        batchNumber,
        notes,
        amountPaid: parsedAmountPaid,
        purchaseDate
      };

      let result;
      if (purchaseId) {
        result = await updatePurchase(purchaseId, supplierId, paidStatus, purchaseStatus, lines, optionalFields);
      } else {
        result = await createPurchase(supplierId, paidStatus, purchaseStatus, lines, optionalFields);
      }

      if (result.ok) {
        router.push("/purchases");
      } else {
        setError(result.error ?? "Could not save the purchase.");
      }
    });
  }

  return (
    <div className="mt-4 space-y-6 max-w-5xl">
      <Card>
        <h2 className="font-serif text-lg text-royal mb-4">Supplier Information</h2>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-royal">Select Vendor *</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
          >
            <option value="">Search by name, phone, company...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <p className="text-xs text-royal-soft mt-1">Can't find a vendor? Add them from the Vendors page first.</p>
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-lg text-royal mb-4">Purchase Items</h2>
        <div className="space-y-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
                <th className="pb-2 font-medium">Item Details</th>
                <th className="pb-2 font-medium w-24">Qty</th>
                <th className="pb-2 font-medium w-24">Unit</th>
                <th className="pb-2 font-medium w-32">Rate (₹)</th>
                <th className="pb-2 font-medium w-32 text-right">Amount (₹)</th>
                <th className="pb-2 font-medium w-12 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-royal-soft/10">
                  <td className="py-2 pr-2">
                    <Input
                      placeholder="e.g. Wheat flour"
                      value={line.itemName}
                      onChange={(e) => updateLine(i, { itemName: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min="0"
                      value={line.quantity || ""}
                      onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input placeholder="kg" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min="0"
                      value={line.rate || ""}
                      onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 text-right align-middle font-medium text-royal">
                    {((line.quantity || 0) * (line.rate || 0)).toLocaleString()}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" variant="ghost" onClick={addLine}>+ Add items to this purchase order</Button>
        </div>
        
        <div className="flex justify-end mt-4 pt-4 border-t border-royal-soft/15">
          <div className="flex items-center gap-4 text-xl">
            <span className="font-serif text-royal">Total Amount:</span>
            <span className="font-semibold text-royal">₹{totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-lg text-royal mb-4">Status & Additional Information</h2>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-royal">Purchase Status</label>
            <select
              value={purchaseStatus}
              onChange={(e) => setPurchaseStatus(e.target.value as any)}
              className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
            >
              <option value="PENDING">Pending</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-royal">Payment Status</label>
            <select
              value={paidStatus}
              onChange={(e) => setPaidStatus(e.target.value as any)}
              className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm"
            >
              <option value="DUE">Due</option>
              <option value="PARTIAL">Partially paid</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-royal">Payment Method</label>
            <Input 
              placeholder="e.g., Bank Transfer, Cash" 
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mt-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-royal">Purchase Date</label>
            <Input 
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-royal">Invoice Number</label>
            <Input 
              placeholder="e.g., INV-2024-001" 
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-royal">Batch Number</label>
            <Input 
              placeholder="e.g., BATCH-001, LOT-2024" 
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-royal">PO Number</label>
            <Input 
              placeholder="PO-###" 
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-royal">Amount Paid (₹)</label>
            <Input 
              type="number"
              min="0"
              placeholder="0" 
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <label className="text-sm font-medium text-royal">Purchase Notes</label>
          <textarea 
            className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold min-h-[100px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="button" onClick={submit} disabled={isPending} className="bg-royal text-white hover:bg-royal-deep">
          {isPending ? "Saving…" : (purchaseId ? "Update Purchase Order" : "Create Purchase Order")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/purchases")}>
          Cancel
        </Button>
      </div>
      
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
