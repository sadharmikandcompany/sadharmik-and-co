"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { updateCustomer, deleteCustomer } from "./actions";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  mobilePrimary: string;
  whatsapp: string | null;
  mobileSecondary1: string | null;
  mobileSecondary2: string | null;
  companyName: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  shippingAddress: string;
  billingAddress: string | null;
  isVip: boolean;
  isMandir: boolean;
  isDefaulter: boolean;
  isActive: boolean;
  notes: string | null;
}

export function CustomerRowActions({ customer }: { customer: Customer }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  // For the shipping address structure check - default to false for edit since it's saved as string
  const [useStructuredShipping, setUseStructuredShipping] = useState(false);

  function handleEditSubmit(formData: FormData) {
    setError(null);
    startSaving(async () => {
      if (useStructuredShipping) {
        const room = formData.get("ship_room") || "";
        const floor = formData.get("ship_floor") || "";
        const wing = formData.get("ship_wing") || "";
        const bldg = formData.get("ship_bldg") || "";
        const street = formData.get("ship_street") || "";
        const landmark = formData.get("ship_landmark") || "";
        const city = formData.get("ship_city") || "";
        const state = formData.get("ship_state") || "";
        const pincode = formData.get("ship_pincode") || "";
        const combined = [room, floor, wing, bldg, street, landmark, city, state, pincode]
          .filter(Boolean)
          .join(", ");
        formData.set("shippingAddress", combined);
      }

      const result = await updateCustomer(customer.id, formData);
      if (!result.ok) {
        setError(result.error ?? "Could not update customer.");
        return;
      }
      setIsEditOpen(false);
    });
  }

  function handleDelete() {
    setError(null);
    startSaving(async () => {
      const result = await deleteCustomer(customer.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete customer.");
        return;
      }
      setIsDeleteDialogOpen(false);
    });
  }

  return (
    <div className="flex gap-2 justify-end">
      <button
        onClick={() => setIsEditOpen(true)}
        className="text-xs font-semibold text-royal hover:text-gold-soft px-2 py-1 border border-royal-soft/20 rounded hover:border-gold-soft transition-colors"
      >
        Edit
      </button>
      <button
        onClick={() => setIsDeleteDialogOpen(true)}
        className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 border border-red-200 rounded hover:border-red-400 transition-colors"
      >
        Delete
      </button>

      {isEditOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col relative my-8">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-semibold text-royal">Edit Customer</h2>
                <p className="text-sm text-royal-soft">Update details for {customer.firstName} {customer.lastName}</p>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form action={handleEditSubmit} className="p-6 space-y-8 text-left">

              {/* Basic Information */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">First Name *</label>
                    <Input name="firstName" defaultValue={customer.firstName} required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Last Name *</label>
                    <Input name="lastName" defaultValue={customer.lastName} required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Email (Optional)</label>
                    <Input name="email" type="email" defaultValue={customer.email || ""} />
                  </div>
                </div>
              </section>

              {/* Contact Information */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Mobile Primary *</label>
                    <Input id={`mobilePrimaryEdit_${customer.id}`} name="mobilePrimary" defaultValue={customer.mobilePrimary} required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">WhatsApp Number</label>
                    <Input id={`whatsappEdit_${customer.id}`} name="whatsapp" defaultValue={customer.whatsapp || ""} />
                    <label className="flex items-center gap-2 mt-2 text-xs">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        onChange={(e) => {
                          const primaryInput = document.getElementById(`mobilePrimaryEdit_${customer.id}`) as HTMLInputElement;
                          const whatsappInput = document.getElementById(`whatsappEdit_${customer.id}`) as HTMLInputElement;
                          if (e.target.checked && primaryInput && whatsappInput) {
                            whatsappInput.value = primaryInput.value;
                          }
                        }}
                      />
                      Same as Primary
                    </label>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Mobile Secondary 1</label>
                    <Input name="mobileSecondary1" defaultValue={customer.mobileSecondary1 || ""} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Mobile Secondary 2</label>
                    <Input name="mobileSecondary2" defaultValue={customer.mobileSecondary2 || ""} />
                  </div>
                </div>
              </section>

              {/* Business Information */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Business Information</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Company Name</label>
                    <Input name="companyName" defaultValue={customer.companyName || ""} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">GST Number</label>
                    <Input name="gstNumber" defaultValue={customer.gstNumber || ""} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">PAN Card Number</label>
                    <Input name="panNumber" defaultValue={customer.panNumber || ""} />
                  </div>
                </div>
              </section>

              {/* Shipping Address */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Shipping Address *</h3>

                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <input
                      type="checkbox"
                      checked={useStructuredShipping}
                      onChange={e => setUseStructuredShipping(e.target.checked)}
                    />
                    Use Structured Address Form
                  </label>
                </div>

                {!useStructuredShipping ? (
                  <Input
                    name="shippingAddress"
                    defaultValue={customer.shippingAddress}
                    required
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 p-4 border rounded bg-gray-50">
                    <Input name="ship_room" placeholder="Room/Flat No." />
                    <Input name="ship_floor" placeholder="Floor" />
                    <Input name="ship_wing" placeholder="Wing/Block" />
                    <Input name="ship_bldg" placeholder="Building Name *" required />
                    <Input name="ship_street" placeholder="Street/Area *" required />
                    <Input name="ship_landmark" placeholder="Landmark" />
                    <Input name="ship_city" placeholder="City *" required />
                    <Input name="ship_state" placeholder="State" />
                    <Input name="ship_pincode" placeholder="Pincode *" required />
                  </div>
                )}
              </section>

              {/* Billing Address */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Billing Address</h3>
                <Input name="billingAddress" defaultValue={customer.billingAddress || ""} placeholder="If different, enter billing address" />
              </section>

              {/* Customer Classification */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Customer Classification</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="isVip"
                        defaultChecked={customer.isVip}
                        onChange={(e) => {
                          const el = e.target as HTMLInputElement;
                          if (el.parentElement?.nextElementSibling) {
                            (el.parentElement.nextElementSibling as HTMLElement).style.display = el.checked ? 'block' : 'none';
                          }
                        }}
                      />
                      VIP Customer
                    </label>

                    {/* Inline VIP Number Input */}
                    <div style={{ display: customer.isVip ? 'flex' : 'none' }} className="ml-2 items-center gap-2">
                      <span className="text-sm font-semibold text-royal">Sd</span>
                      {/* Note: we don't pass the old VIP number directly since the user might want to edit it or leave it alone. We can pass it if we add it to the interface. But for now they can leave empty to ignore. */}
                      <Input name="vipNumber" type="number" placeholder="New # (optional)" className="w-32 text-sm" />
                    </div>

                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="isMandir" defaultChecked={customer.isMandir} /> Mandir/Temple
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="isDefaulter" defaultChecked={customer.isDefaulter} /> Defaulter
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="isActive" value="true" defaultChecked={customer.isActive} /> Active
                    </label>
                  </div>
                </div>
              </section>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="sticky bottom-0 bg-white border-t px-6 py-4 -mx-6 -mb-6 flex justify-end gap-3 rounded-b-lg z-10">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSaving} className="bg-royal text-white hover:bg-royal/90">
                  {isSaving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteDialogOpen && (
        <Modal title="Delete Customer" onClose={() => setIsDeleteDialogOpen(false)}>
          <div className="space-y-4 text-left">
            <p className="text-sm text-gray-600">Are you sure you want to delete <strong>{customer.firstName} {customer.lastName}</strong>?</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={isSaving} onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white border-0">
                {isSaving ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
