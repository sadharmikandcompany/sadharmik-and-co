"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { createCustomer } from "./actions";

export function AddCustomerButton({
  nextVipNumber,
  nextMandirNumber,
  nextShopNumber,
  onSuccess
}: {
  nextVipNumber?: number;
  nextMandirNumber?: number;
  nextShopNumber?: number;
  onSuccess?: (customer: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  // For the shipping address structure check
  const [useStructuredShipping, setUseStructuredShipping] = useState(false);

  function close() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startSaving(async () => {
      // If structured address is checked, we combine the fields before sending
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

      const result = await createCustomer(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not add customer.");
        return;
      }
      if (onSuccess && result.customer) {
        onSuccess(result.customer);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col relative my-8">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-semibold text-royal">Add New Customer</h2>
                <p className="text-sm text-royal-soft">Enter customer details to create a new customer</p>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form action={handleSubmit} className="p-6 space-y-8 text-left">

              {/* Basic Information */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Basic Information</h3>
                <p className="text-sm text-gray-500 mb-4 -mt-2">Personal details of the customer</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">First Name *</label>
                    <Input name="firstName" required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Last Name *</label>
                    <Input name="lastName" required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Email (Optional)</label>
                    <Input name="email" type="email" placeholder="example@domain.com" />
                  </div>
                </div>
              </section>

              {/* Contact Information */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Contact Information</h3>
                <p className="text-sm text-gray-500 mb-4 -mt-2">Phone numbers and contact details</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Mobile Primary *</label>
                    <Input id="mobilePrimaryInput" name="mobilePrimary" placeholder="10 digit mobile number" required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">WhatsApp Number</label>
                    <Input id="whatsappInput" name="whatsapp" placeholder="10 digit number" />
                    <label className="flex items-center gap-2 mt-2 text-xs">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        onChange={(e) => {
                          const primaryInput = document.getElementById('mobilePrimaryInput') as HTMLInputElement;
                          const whatsappInput = document.getElementById('whatsappInput') as HTMLInputElement;
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
                    <Input name="mobileSecondary1" placeholder="10 digit number" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Mobile Secondary 2</label>
                    <Input name="mobileSecondary2" placeholder="10 digit number" />
                  </div>
                </div>
              </section>

              {/* Business Information */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Business Information</h3>
                <p className="text-sm text-gray-500 mb-4 -mt-2">Company, GST, and PAN details (optional)</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Company Name</label>
                    <Input name="companyName" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">GST Number</label>
                    <Input name="gstNumber" placeholder="15 characters" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block">PAN Card Number</label>
                    <Input name="panNumber" placeholder="ABCDE1234F" />
                  </div>
                </div>
              </section>

              {/* Shipping Address */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Shipping Address *</h3>
                <p className="text-sm text-gray-500 mb-4 -mt-2">Provide either full address OR structured address fields</p>

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
                    placeholder="Enter complete address here to skip structured fields below"
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
                <p className="text-sm text-gray-500 mb-4 -mt-2">Invoice and billing address</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked />
                  Same as Shipping Address
                </label>
                <div className="mt-4">
                  <Input name="billingAddress" placeholder="If different, enter billing address" />
                </div>
              </section>

              {/* Customer Classification */}
              <section>
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Customer Classification</h3>
                <p className="text-sm text-gray-500 mb-4 -mt-2">Customer type and status tags</p>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="isVip"
                        onChange={(e) => {
                          const el = e.target as HTMLInputElement;
                          if (el.parentElement?.nextElementSibling) {
                            (el.parentElement.nextElementSibling as HTMLElement).style.display = el.checked ? 'flex' : 'none';
                          }
                        }}
                      />
                      VIP Customer
                    </label>

                    {/* Inline VIP Number Input (Hidden by default) */}
                    <div style={{ display: 'none' }} className="ml-2 items-center gap-2">
                      <span className="text-sm font-semibold text-royal uppercase">Sd</span>
                      <Input name="vipNumber" type="number" defaultValue={nextVipNumber} className="w-24 text-sm" />
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="isMandir"
                        onChange={(e) => {
                          const el = e.target as HTMLInputElement;
                          if (el.parentElement?.nextElementSibling) {
                            (el.parentElement.nextElementSibling as HTMLElement).style.display = el.checked ? 'flex' : 'none';
                          }
                        }}
                      />
                      Mandir/Temple
                    </label>

                    {/* Inline Mandir Number Input (Hidden by default) */}
                    <div style={{ display: 'none' }} className="ml-2 items-center gap-2">
                      <span className="text-sm font-semibold text-royal uppercase">Mandir #</span>
                      <Input name="mandirNumber" type="number" defaultValue={nextMandirNumber} className="w-24 text-sm" />
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="isShop"
                        onChange={(e) => {
                          const el = e.target as HTMLInputElement;
                          if (el.parentElement?.nextElementSibling) {
                            (el.parentElement.nextElementSibling as HTMLElement).style.display = el.checked ? 'flex' : 'none';
                          }
                        }}
                      />
                      Shop
                    </label>

                    {/* Inline Shop Number Input (Hidden by default) */}
                    <div style={{ display: 'none' }} className="ml-2 items-center gap-2">
                      <span className="text-sm font-semibold text-royal uppercase">Shop #</span>
                      <Input name="shopNumber" type="number" defaultValue={nextShopNumber} className="w-24 text-sm" />
                    </div>

                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="isDefaulter" /> Defaulter
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="isActive" value="true" defaultChecked /> Active
                    </label>
                  </div>
                </div>
              </section>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="sticky bottom-0 bg-white border-t px-6 py-4 -mx-6 -mb-6 flex justify-end gap-3 rounded-b-lg z-10">
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={isSaving} className="bg-royal text-white hover:bg-royal/90">
                  {isSaving ? "Saving…" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
