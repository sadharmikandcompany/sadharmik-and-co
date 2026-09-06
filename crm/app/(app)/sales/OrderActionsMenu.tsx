"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Pencil,
  Download,
  Printer,
  RotateCcw,
  Truck,
  CheckCircle2,
  BadgeCheck,
  XCircle,
  Trash2,
} from "lucide-react";
import {
  updateOrderStatus,
  assignDeliveryPartner,
  settleOrder,
  cancelOrder,
  deleteOrder,
  reorderOrder,
} from "./actions";

interface DeliveryPartnerOption {
  id: string;
  name: string;
  activeOrders: number;
  totalOrders: number;
}

export function OrderActionsMenu({
  orderId,
  status,
  deliveryPartners,
}: {
  orderId: string;
  status: string;
  deliveryPartners: DeliveryPartnerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Flip left if the panel would run off the right edge of the window.
    const panelWidth = 260;
    const left = Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8);
    setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    setOpen(true);
  }

  // Rows near the bottom of the screen (or window) would otherwise push
  // "Cancel Order"/"Delete Order" off-screen with no way to scroll to them —
  // once the panel's real height is known, flip it to open upward instead
  // whenever it would run past the bottom of the viewport.
  useLayoutEffect(() => {
    if (!open || !panelRef.current || !buttonRef.current) return;
    const panelHeight = panelRef.current.getBoundingClientRect().height;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const overflowsBottom = buttonRect.bottom + 4 + panelHeight > window.innerHeight - 8;
    const top = overflowsBottom
      ? Math.max(8, buttonRect.top - panelHeight - 4)
      : buttonRect.bottom + 4;
    setPos((prev) => (prev && prev.top === top ? prev : { ...prev!, top }));
    // Only re-run when the panel first opens / its content size can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deliveryPartners.length]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  function run(action: () => Promise<{ ok: boolean; error?: string } | void>) {
    close();
    startTransition(async () => {
      const result = await action();
      if (result && "ok" in result && !result.ok) {
        setMessage(result.error ?? "That didn't work.");
        setTimeout(() => setMessage(null), 4000);
      }
    });
  }

  function withId() {
    const fd = new FormData();
    fd.set("id", orderId);
    return fd;
  }

  function handleEdit() {
    close();
    router.push(`/sales/${orderId}/edit`);
  }

  function handleDownloadInvoice() {
    close();
    window.open(`/sales/${orderId}/print?type=a4`, "_blank");
  }

  function handleThermalPrint() {
    close();
    window.open(`/sales/${orderId}/print?type=thermal`, "_blank");
  }

  function handleReorder() {
    run(async () => {
      const result = await reorderOrder(orderId);
      return result;
    });
  }

  function handleAssign(partnerId: string) {
    run(async () => {
      const fd = withId();
      fd.set("deliveryPartnerId", partnerId);
      await assignDeliveryPartner(fd);
    });
  }

  function handleMarkDelivered() {
    run(async () => {
      const fd = withId();
      fd.set("status", "DELIVERED");
      await updateOrderStatus(fd);
    });
  }

  function handleComplete() {
    run(async () => {
      await settleOrder(withId());
    });
  }

  function handleCancel() {
    if (!confirm("Cancel this order? Its stock will be returned.")) return;
    run(async () => cancelOrder(withId()));
  }

  function handleDelete() {
    if (!confirm("Permanently delete this order? This can't be undone.")) return;
    run(async () => deleteOrder(withId()));
  }

  const itemClass =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  const dangerClass =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50";

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        type="button"
        title="Order actions"
        onClick={() => (open ? close() : openMenu())}
        disabled={isPending}
        className="text-gray-400 hover:text-gray-600 p-1 inline-flex rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {message && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-md bg-gray-900 px-4 py-2 text-xs text-white shadow-lg">
          {message}
        </div>
      )}

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: 260,
              maxHeight: "calc(100vh - 16px)",
              overflowY: "auto",
            }}
            className="z-[90] rounded-lg border border-gray-200 bg-white py-1.5 shadow-xl"
          >
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Actions</p>
            <button type="button" className={itemClass} onClick={handleEdit}>
              <Pencil className="h-4 w-4 text-gray-400" /> Edit Order
            </button>
            <button type="button" className={itemClass} onClick={handleDownloadInvoice}>
              <Download className="h-4 w-4 text-gray-400" /> Download Invoice
            </button>
            <button type="button" className={itemClass} onClick={handleThermalPrint}>
              <Printer className="h-4 w-4 text-gray-400" /> Thermal Print (80mm)
            </button>
            <button type="button" className={itemClass} onClick={handleReorder}>
              <RotateCcw className="h-4 w-4 text-gray-400" /> Reorder
            </button>

            <div className="my-1 border-t border-gray-100" />
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Assign Driver</p>
            {deliveryPartners.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-gray-400">No delivery partners yet.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto">
                {deliveryPartners.map((p) => (
                  <button key={p.id} type="button" className={itemClass} onClick={() => handleAssign(p.id)}>
                    <Truck className="h-4 w-4 text-gray-400" />
                    <span className="flex-1">{p.name}</span>
                    <span className="text-[11px] text-gray-400">
                      {p.activeOrders} active · {p.totalOrders} total
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="my-1 border-t border-gray-100" />
            <button type="button" className={itemClass} onClick={handleMarkDelivered} disabled={status === "DELIVERED"}>
              <CheckCircle2 className="h-4 w-4 text-gray-400" /> Mark as Delivered
            </button>
            <button type="button" className={itemClass} onClick={handleComplete}>
              <BadgeCheck className="h-4 w-4 text-gray-400" /> Complete Order
            </button>

            <div className="my-1 border-t border-gray-100" />
            <button type="button" className={dangerClass} onClick={handleCancel} disabled={status === "CANCELLED" || status === "DELIVERED"}>
              <XCircle className="h-4 w-4" /> Cancel Order
            </button>
            <button type="button" className={dangerClass} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" /> Delete Order
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
