"use client";

import { Button } from "@/components/ui";

interface ExportRow {
  orderNumber: string;
  customerName: string;
  date: string;
  status: string;
  source: string;
  paymentMethod: string;
  subtotal: number;
  gstAmount: number;
  deliveryCharge: number;
  total: number;
}

function toCsv(rows: ExportRow[]): string {
  const headers = [
    "Order #",
    "Customer",
    "Date",
    "Status",
    "Source",
    "Payment",
    "Subtotal",
    "GST",
    "Delivery",
    "Total",
  ];
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.orderNumber,
        r.customerName,
        r.date,
        r.status,
        r.source,
        r.paymentMethod,
        r.subtotal,
        r.gstAmount,
        r.deliveryCharge,
        r.total,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export function ExportCsvButton({ rows }: { rows: ExportRow[] }) {
  function handleExport() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="ghost" onClick={handleExport} disabled={rows.length === 0}>
      Export CSV
    </Button>
  );
}
