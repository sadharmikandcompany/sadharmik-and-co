"use client";

import { Modal } from "@/components/ui";
import type { ProductRow } from "./ProductsTable";

export function ViewProductModal({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  return (
    <Modal title={product.name} subtitle={product.packSize} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-32 w-32 rounded-lg object-cover" />
        ) : (
          <span className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-royal-soft/40 text-xs text-royal-soft">
            No photo
          </span>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Price</p>
            <p className="text-royal">₹{product.price}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Mandir Price</p>
            <p className="text-royal">{product.mandirPrice != null ? `₹${product.mandirPrice}` : "Not set"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Shop Price</p>
            <p className="text-royal">{product.shopPrice != null ? `₹${product.shopPrice}` : "Not set"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">GST %</p>
            <p className="text-royal">{product.gstPercentage}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Stock</p>
            <p className="text-royal">{product.stock}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Status</p>
            <p className="text-royal">
              {product.isActive ? "Active" : "Inactive"} · {product.showOnWebsite ? "Shown on website" : "Hidden from website"}
            </p>
          </div>
        </div>
        {product.description && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-soft">Description</p>
            <p className="text-royal-soft">{product.description}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
