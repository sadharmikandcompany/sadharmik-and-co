import React from "react";
import { Order, Customer, OrderItem, Product } from "@prisma/client";

type OrderWithDetails = Order & {
  customer: Customer;
  items: (OrderItem & { product: Product })[];
};

export function ThermalReceipt({ order }: { order: OrderWithDetails }) {
  // Calculate CGST and SGST (Assuming 5% GST total, so 2.5% each)
  const cgst = (order.gstAmount / 2).toFixed(2);
  const sgst = (order.gstAmount / 2).toFixed(2);

  return (
    <div className="bg-white p-4 mx-auto max-w-[80mm] text-[13px] font-mono leading-[1.4] text-black">
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="text-[18px] font-bold tracking-wide">SADHARMIK &amp; COMPANY</h1>
        <p>G2, Mahadev Nagar-A CHS Ltd, Nr Bank of Maharastra, B P Road, Nr Mahadev Mandir, Bhayandar (East), 101105</p>
        <p>Ph: 8777600400</p>
        {/* TODO: this GSTIN is still the old Kalapurna Ghee entity's — swap
            in Sadharmik & Company's own GSTIN before this goes back live. */}
        <p>GSTIN: 27DABPG1499H1ZM</p>
      </div>

      <hr className="border-t-[1.5px] border-black my-2" />

      {/* Invoice Details */}
      <div className="text-center mb-2 font-bold text-[15px]">TAX INVOICE</div>
      <div>
        <p>Invoice: A{order.invoiceNumber}</p>
        <p>Date: {new Date(order.orderDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        <p>Order: {order.orderNumber}</p>
      </div>

      <hr className="border-t-[1.5px] border-black my-2" />

      {/* Bill To */}
      <div>
        <p className="font-bold">Bill To:</p>
        <p className="font-bold">{order.customer.firstName} {order.customer.lastName} {order.customer.vipNumber ? `(VIP: ${order.customer.vipNumber})` : ''}</p>
        <p>Ph: {order.customer.mobilePrimary}</p>
        <p className="whitespace-pre-wrap">{order.customer.shippingAddress || "N/A"}</p>
      </div>

      <hr className="border-t-[1.5px] border-black my-2" />

      {/* Items Table */}
      <table className="w-full mb-2 text-[13px]">
        <thead>
          <tr>
            <th className="text-left font-bold pb-1">Item</th>
            <th className="text-right font-bold pb-1 w-10">Qty</th>
            <th className="text-right font-bold pb-1 w-16">Rate</th>
            <th className="text-right font-bold pb-1 w-16">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <React.Fragment key={item.id}>
              <tr>
                {/* pt-1.5 only (no pb) so this sits flush against its own
                    qty/rate/amount row right below — the gap belongs
                    between items, not inside one. Keeping this a single
                    colSpan cell (rather than padding out the other three
                    columns with empty <td>s) avoids the row growing to fit
                    those cells' own line-height on top of the wrapped name.
                    The inner div's max-width — roughly the Item column's
                    real share of the row once Qty/Rate/Amount take theirs —
                    is what forces a long name to wrap within it instead of
                    running the full receipt width. */}
                <td colSpan={4} className="pt-1.5 leading-tight break-words align-top">
                  <div className="max-w-[38%]">{item.product.name}</div>
                  {/* HSN Code can be added here if available in product */}
                </td>
              </tr>
              <tr>
                <td></td>
                <td className="pb-1.5 text-right align-top">{item.quantity}</td>
                <td className="pb-1.5 text-right align-top">{item.unitPrice.toFixed(2)}</td>
                <td className="pb-1.5 text-right align-top">{(item.unitPrice * item.quantity).toFixed(2)}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <hr className="border-t-[1.5px] border-black my-2" />

      {/* Totals */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{order.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxable Amount:</span>
          <span>{order.subtotal.toFixed(2)}</span>
        </div>
        {order.gstAmount > 0 && (
          <>
            <div className="flex justify-between">
              <span>CGST @ 2.5%:</span>
              <span>{cgst}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST @ 2.5%:</span>
              <span>{sgst}</span>
            </div>
          </>
        )}
        {order.deliveryCharge > 0 && (
          <div className="flex justify-between">
            <span>Delivery:</span>
            <span>{order.deliveryCharge.toFixed(2)}</span>
          </div>
        )}
      </div>

      <hr className="border-t-[1.5px] border-black my-2" />
      
      <div className="flex justify-between font-bold text-[16px]">
        <span>TOTAL:</span>
        <span>{order.total.toFixed(2)}</span>
      </div>

      <hr className="border-t-[1.5px] border-black my-2" />

      <div>
        <p>Payment: {order.paymentMethod.toLowerCase()}</p>
        <p>Status: {order.status.toLowerCase().replace(/_/g, " ")}</p>
      </div>

      <hr className="border-t-[1.5px] border-black my-2" />

      {/* Footer */}
      <div className="text-center mt-2 flex flex-col items-center">
        <p className="mt-1">Thank you for doing business with us!</p>
        <p>Visit again!</p>
      </div>
    </div>
  );
}
