"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { updateProduct } from "./actions";
import { readImageAsCompressedDataUrl } from "./imageUtils";
import type { ProductRow } from "./ProductsTable";

export function EditProductModal({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const [name, setName] = useState(product.name);
  const [packSize, setPackSize] = useState(product.packSize);
  const [price, setPrice] = useState(String(product.price));
  const [mandirPrice, setMandirPrice] = useState(product.mandirPrice != null ? String(product.mandirPrice) : "");
  const [shopPrice, setShopPrice] = useState(product.shopPrice != null ? String(product.shopPrice) : "");
  const [gstPercentage, setGstPercentage] = useState(String(product.gstPercentage));
  const [stock, setStock] = useState(String(product.stock));
  const [isActive, setIsActive] = useState(product.isActive);
  const [showOnWebsite, setShowOnWebsite] = useState(product.showOnWebsite);
  const [description, setDescription] = useState(product.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(product.imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImageUrl(await readImageAsCompressedDataUrl(file));
    } catch {
      setError("Could not read that photo — try a different file.");
    }
  }

  function handleSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set("id", product.id);
    formData.set("name", name);
    formData.set("packSize", packSize);
    formData.set("price", price);
    formData.set("mandirPrice", mandirPrice);
    formData.set("shopPrice", shopPrice);
    formData.set("stock", stock);
    formData.set("gstPercentage", gstPercentage);
    formData.set("description", description);
    formData.set("imageUrl", imageUrl ?? "");
    if (isActive) formData.set("isActive", "on");
    if (showOnWebsite) formData.set("showOnWebsite", "on");
    startSaving(async () => {
      const result = await updateProduct(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not save product.");
        return;
      }
      onClose();
    });
  }

  return (
    <Modal title="Edit product" subtitle={product.name} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Flavour name" />
        <Input value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="Pack size (e.g. 500g)" />
        <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (₹)" />
        <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" />
        <Input
          type="number"
          min="0"
          value={mandirPrice}
          onChange={(e) => setMandirPrice(e.target.value)}
          placeholder="Mandir Price (₹, optional)"
        />
        <Input
          type="number"
          min="0"
          value={shopPrice}
          onChange={(e) => setShopPrice(e.target.value)}
          placeholder="Shop Price (₹, optional)"
        />
        <Input
          type="number"
          min="0"
          value={gstPercentage}
          onChange={(e) => setGstPercentage(e.target.value)}
          placeholder="GST % (default 0)"
        />
        <div className="flex items-center gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-royal">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-royal">
            <input type="checkbox" checked={showOnWebsite} onChange={(e) => setShowOnWebsite(e.target.checked)} />
            Show on website
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-3">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-royal-soft/40 text-xs text-royal-soft">
                Photo
              </span>
            )}
            <span className="text-sm text-royal-soft">
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-xs" />
            </span>
          </label>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description shown on the website (optional)"
          rows={2}
          className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold sm:col-span-2"
        />
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <Button type="button" onClick={handleSubmit} disabled={isSaving} className="justify-center sm:col-span-2">
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}
