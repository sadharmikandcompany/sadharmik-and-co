"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { createCustomer } from "./actions";

export function AddCustomerButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startSaving(async () => {
      const result = await createCustomer(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not add customer.");
        return;
      }
      close();
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + Add Customer
      </Button>

      {open && (
        <Modal title="Add customer" onClose={close}>
          <form action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Name" required />
            <Input name="phone" placeholder="Phone" required />
            <Input name="address" placeholder="Address" required className="sm:col-span-2" />
            <Input name="notes" placeholder="Notes (optional)" className="sm:col-span-2" />
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <Button type="submit" disabled={isSaving} className="justify-center sm:col-span-2">
              {isSaving ? "Saving…" : "Add customer"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
