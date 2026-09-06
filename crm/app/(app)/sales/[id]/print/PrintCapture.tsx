"use client";

import { useEffect, useRef, useState } from "react";
import { A4Invoice } from "./A4Invoice";
import { ThermalReceipt } from "./ThermalReceipt";
import type { Order, Customer, OrderItem, Product } from "@prisma/client";

type OrderWithDetails = Order & {
  customer: Customer;
  items: (OrderItem & { product: Product })[];
};

// Renders the receipt/invoice off-screen, snapshots it, and triggers a real
// PDF download — no browser print dialog, no dependency on a printer driver
// being installed (that's what was sending people to a "install a printer"
// page instead of a PDF).
export function PrintCapture({ order, type }: { order: OrderWithDetails; type: "a4" | "thermal" }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const node = nodeRef.current;
        if (!node) throw new Error("Nothing to capture.");

        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);

        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const pxToMm = 25.4 / 96;
        const widthMm = (canvas.width / 2) * pxToMm;
        const heightMm = (canvas.height / 2) * pxToMm;

        const pdf = new jsPDF({
          orientation: heightMm >= widthMm ? "portrait" : "landscape",
          unit: "mm",
          format: [widthMm, heightMm],
        });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthMm, heightMm);

        const label = type === "thermal" ? "Receipt" : "Invoice";
        pdf.save(`${label}-${order.orderNumber}.pdf`);

        if (cancelled) return;
        setStatus("done");
        // Best-effort: this only succeeds when the tab was opened by script,
        // which is the normal case here (opened via window.open/target=_blank).
        setTimeout(() => window.close(), 400);
      } catch (err) {
        console.error("PDF generation failed, falling back to print dialog:", err);
        if (cancelled) return;
        setStatus("error");
        window.print();
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      {status !== "error" && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-white/90 print:hidden">
          <p className="text-sm font-semibold text-royal-soft">
            {status === "working" ? "Preparing your PDF…" : "Downloaded — you can close this tab."}
          </p>
        </div>
      )}
      {/* inline-block so this shrink-wraps to the receipt/invoice's own
          width instead of stretching to the full page — otherwise
          html2canvas captures the whole (mostly blank) page width, which
          both prints a lot of blank space and makes the capture much
          slower than it needs to be. */}
      <div ref={nodeRef} className="inline-block">
        {type === "thermal" ? <ThermalReceipt order={order} /> : <A4Invoice order={order} />}
      </div>
    </div>
  );
}
