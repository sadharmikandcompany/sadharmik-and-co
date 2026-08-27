"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { createProduct } from "./actions";
import { readImageAsCompressedDataUrl } from "./imageUtils";

export function AddProductButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setImageUrl(null);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImageUrl(await readImageAsCompressedDataUrl(file));
    } catch {
      setError("Could not read that photo — try a different file.");
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (imageUrl) formData.set("imageUrl", imageUrl);
    startSaving(async () => {
      const result = await createProduct(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not add product.");
        return;
      }
      close();
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + Add Product
      </Button>

      {open && (
        <Modal title="Add product" onClose={close}>
          <form action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Flavour name" required />
            <Input name="packSize" placeholder="Pack size (e.g. 500g)" required />
            <Input name="price" type="number" min="0" placeholder="Price (₹)" required />
            <Input name="stock" type="number" min="0" placeholder="Stock" required />
            <Input name="gstPercentage" type="number" min="0" placeholder="GST % (default 0)" />
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
              name="description"
              placeholder="Short description shown on the website (optional)"
              rows={2}
              className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-gold sm:col-span-2"
            />
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <Button type="submit" disabled={isSaving} className="justify-center sm:col-span-2">
              {isSaving ? "Saving…" : "Add product"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
