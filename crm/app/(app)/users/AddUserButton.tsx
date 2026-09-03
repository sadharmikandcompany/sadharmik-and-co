"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { createUser } from "./actions";

export function AddUserButton() {
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
      const result = await createUser(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not add user.");
        return;
      }
      close();
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + Add User
      </Button>

      {open && (
        <Modal title="Add user" onClose={close}>
          <form action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input name="name" placeholder="Name" required className="sm:col-span-2" />
            <Input name="email" type="email" placeholder="Email (optional)" />
            <Input name="phone" placeholder="Phone" required />
            <Input name="password" type="password" placeholder="Password" required className="sm:col-span-2" />
            
            <div className="sm:col-span-2">
              <select name="role" className="w-full rounded-xl border border-royal-soft/30 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-gold" required defaultValue="STAFF">
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staff</option>
                <option value="DELIVERY_PARTNER">Delivery Partner</option>
              </select>
            </div>
            
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <Button type="submit" disabled={isSaving} className="justify-center sm:col-span-2">
              {isSaving ? "Saving…" : "Add user"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
