"use client";

import { useState, useTransition } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Badge, Table } from "@/components/ui";
import { deleteProduct } from "./actions";
import { ViewProductModal } from "./ViewProductModal";
import { EditProductModal } from "./EditProductModal";

export interface ProductRow {
  id: string;
  name: string;
  packSize: string;
  price: number;
  mandirPrice: number | null;
  shopPrice: number | null;
  gstPercentage: number;
  stock: number;
  isActive: boolean;
  showOnWebsite: boolean;
  imageUrl: string | null;
  description: string | null;
}

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const [openModal, setOpenModal] = useState<{ type: "view" | "edit"; product: ProductRow } | null>(null);

  return (
    <>
      <Table>
        <thead>
          <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
            <th className="px-4 py-3">Photo</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Pack</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Mandir</th>
            <th className="px-4 py-3">Shop</th>
            <th className="px-4 py-3">GST %</th>
            <th className="px-4 py-3">Stock</th>
            <th className="px-4 py-3">Active</th>
            <th className="px-4 py-3">Website</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <ProductRowItem
              key={p.id}
              product={p}
              onView={() => setOpenModal({ type: "view", product: p })}
              onEdit={() => setOpenModal({ type: "edit", product: p })}
            />
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={11} className="px-4 py-6 text-center text-sm text-royal-soft">No products yet.</td>
            </tr>
          )}
        </tbody>
      </Table>

      {openModal?.type === "view" && (
        <ViewProductModal product={openModal.product} onClose={() => setOpenModal(null)} />
      )}
      {openModal?.type === "edit" && (
        <EditProductModal product={openModal.product} onClose={() => setOpenModal(null)} />
      )}
    </>
  );
}

function ProductRowItem({
  product,
  onView,
  onEdit,
}: {
  product: ProductRow;
  onView: () => void;
  onEdit: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    setError(null);
    const formData = new FormData();
    formData.set("id", product.id);
    startDeleting(async () => {
      const result = await deleteProduct(formData);
      if (!result.ok) setError(result.error ?? "Could not delete product.");
    });
  }

  return (
    <tr className="border-b border-royal-soft/10 last:border-0 align-top">
      <td className="px-4 py-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-royal-soft/40 text-[10px] text-royal-soft">
            No photo
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-medium text-royal">{product.name}</td>
      <td className="px-4 py-3">{product.packSize}</td>
      <td className="px-4 py-3">₹{product.price}</td>
      <td className="px-4 py-3">{product.mandirPrice != null ? `₹${product.mandirPrice}` : "—"}</td>
      <td className="px-4 py-3">{product.shopPrice != null ? `₹${product.shopPrice}` : "—"}</td>
      <td className="px-4 py-3">{product.gstPercentage}%</td>
      <td className="px-4 py-3">{product.stock}</td>
      <td className="px-4 py-3">
        <Badge tone={product.isActive ? "gold" : "neutral"}>{product.isActive ? "Active" : "Inactive"}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge tone={product.showOnWebsite ? "gold" : "neutral"}>{product.showOnWebsite ? "Shown" : "Hidden"}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onView} aria-label={`View ${product.name}`} className="text-royal-soft hover:text-gold-soft">
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" onClick={onEdit} aria-label={`Edit ${product.name}`} className="text-royal-soft hover:text-gold-soft">
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={`Delete ${product.name}`}
            className="text-royal-soft hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="mt-1 max-w-[140px] text-[11px] text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
