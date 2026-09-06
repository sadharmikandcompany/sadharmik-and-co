"use client";

import { useState, useTransition } from "react";
import { Button, Table } from "@/components/ui";
import { updateProduct, deleteProduct } from "./actions";
import { readImageAsCompressedDataUrl } from "./imageUtils";

export interface ProductRow {
  id: string;
  name: string;
  packSize: string;
  price: number;
  gstPercentage: number;
  stock: number;
  isActive: boolean;
  showOnWebsite: boolean;
  imageUrl: string | null;
  description: string | null;
}

export function ProductsTable({ products }: { products: ProductRow[] }) {
  return (
    <Table>
      <thead>
        <tr className="border-b border-royal-soft/15 text-xs uppercase tracking-wider text-royal-soft">
          <th className="px-4 py-3">Photo</th>
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Pack</th>
          <th className="px-4 py-3">Price</th>
          <th className="px-4 py-3">GST %</th>
          <th className="px-4 py-3">Stock</th>
          <th className="px-4 py-3">Description</th>
          <th className="px-4 py-3">Active</th>
          <th className="px-4 py-3">On Website</th>
          <th className="px-4 py-3">Actions</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <ProductRowItem key={p.id} product={p} />
        ))}
        {products.length === 0 && (
          <tr>
            <td colSpan={10} className="px-4 py-6 text-center text-sm text-royal-soft">No products yet.</td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}

function ProductRowItem({ product }: { product: ProductRow }) {
  const [name, setName] = useState(product.name);
  const [packSize, setPackSize] = useState(product.packSize);
  const [price, setPrice] = useState(String(product.price));
  const [gstPercentage, setGstPercentage] = useState(String(product.gstPercentage));
  const [stock, setStock] = useState(String(product.stock));
  const [isActive, setIsActive] = useState(product.isActive);
  const [showOnWebsite, setShowOnWebsite] = useState(product.showOnWebsite);
  const [description, setDescription] = useState(product.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(product.imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImageUrl(await readImageAsCompressedDataUrl(file));
    } catch {
      setError("Could not read that photo — try a different file.");
    }
  }

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("id", product.id);
    formData.set("name", name);
    formData.set("packSize", packSize);
    formData.set("price", price);
    formData.set("stock", stock);
    formData.set("gstPercentage", gstPercentage);
    formData.set("description", description);
    formData.set("imageUrl", imageUrl ?? "");
    if (isActive) formData.set("isActive", "on");
    if (showOnWebsite) formData.set("showOnWebsite", "on");
    startSaving(async () => {
      const result = await updateProduct(formData);
      if (!result.ok) setError(result.error ?? "Could not save product.");
    });
  }

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
        <div className="flex flex-col items-start gap-1">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-royal-soft/40 text-[10px] text-royal-soft">
              No photo
            </span>
          )}
          <input type="file" accept="image/*" onChange={handlePhotoChange} className="w-24 text-[10px]" />
          {imageUrl && (
            <button type="button" onClick={() => setImageUrl(null)} className="text-[10px] text-royal-soft underline">
              Remove
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-32 rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm font-medium text-royal outline-none focus:border-gold"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={packSize}
          onChange={(e) => setPackSize(e.target.value)}
          className="w-20 rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          value={gstPercentage}
          onChange={(e) => setGstPercentage(e.target.value)}
          className="w-20 rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="w-20 rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </td>
      <td className="px-4 py-3">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Shown on the website"
          className="w-48 rounded-xl border border-royal-soft/30 bg-white px-3 py-2 text-xs outline-none focus:border-gold"
        />
      </td>
      <td className="px-4 py-3">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          title="Visible in the website's product catalogue"
          checked={showOnWebsite}
          onChange={(e) => setShowOnWebsite(e.target.checked)}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1.5">
          <Button type="button" variant="ghost" onClick={handleSave} disabled={isSaving || isDeleting}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving || isDeleting}
            className="text-[11px] text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        {error && <p className="mt-1 max-w-[140px] text-[11px] text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
