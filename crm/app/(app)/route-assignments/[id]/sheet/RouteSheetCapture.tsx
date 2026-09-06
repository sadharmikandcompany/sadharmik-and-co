"use client";

import { useEffect, useRef, useState } from "react";
import { RouteDeliverySheet } from "./RouteDeliverySheet";
import type { RouteManifest } from "@/lib/routeAssignments";

// Same approach as the order print page: snapshot the rendered sheet and
// trigger a real PDF download, rather than relying on the browser's print
// dialog (which needs a printer driver and isn't what "download the PDF"
// means here).
export function RouteSheetCapture({ manifest }: { manifest: RouteManifest }) {
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

        const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });

        const pxToMm = 25.4 / 96;
        const widthMm = (canvas.width / 2) * pxToMm;
        const heightMm = (canvas.height / 2) * pxToMm;

        const pdf = new jsPDF({
          orientation: heightMm >= widthMm ? "portrait" : "landscape",
          unit: "mm",
          format: [widthMm, heightMm],
        });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthMm, heightMm);
        pdf.save(`Route-${manifest.routeNumber}-Delivery-Sheet.pdf`);

        if (cancelled) return;
        setStatus("done");
        setTimeout(() => window.close(), 400);
      } catch (err) {
        console.error("Route sheet PDF generation failed, falling back to print dialog:", err);
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
            {status === "working" ? "Preparing your delivery sheet PDF…" : "Downloaded — you can close this tab."}
          </p>
        </div>
      )}
      <div ref={nodeRef}>
        <RouteDeliverySheet manifest={manifest} />
      </div>
    </div>
  );
}
