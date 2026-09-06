import React from "react";
import { Order, Customer, OrderItem, Product } from "@prisma/client";

type OrderWithDetails = Order & {
  customer: Customer;
  items: (OrderItem & { product: Product })[];
};

export function A4Invoice({ order }: { order: OrderWithDetails }) {
  return (
    <div className="bg-white p-8 md:p-12 shadow-sm max-w-4xl mx-auto min-h-[1056px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-royal-deep mb-2">TAX INVOICE</h1>
          <p className="text-gray-600 font-medium">Invoice No: A{order.invoiceNumber}</p>
          <p className="text-gray-500 text-sm mt-1">Order Ref: {order.orderNumber}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xl sm:text-2xl font-bold text-gray-900">Sadharmik & Co.</p>
          <p className="text-sm text-gray-600">Kalapurna Ghee, Shop no.1, Iqbal Bldg.</p>
          <p className="text-sm text-gray-600">Gokhle Road, Nr. Jakhadevi Mandir</p>
          <p className="text-sm text-gray-600">Dadar west - 400028</p>
          <p className="text-sm text-gray-600 mt-1">+91-7770008880 | info@kalapurna.in</p>
        </div>
      </div>

      <hr className="my-6 border-gray-200" />

      {/* Bill To & Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
        <div>
          <h3 className="font-bold text-gray-900 mb-2">Bill To:</h3>
          <p className="font-semibold text-gray-900">{order.customer.firstName} {order.customer.lastName}</p>
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{order.customer.shippingAddress || "N/A"}</p>
          <p className="text-sm text-gray-600 mt-1">{order.customer.mobilePrimary}</p>
        </div>
        <div className="sm:text-right">
          <div className="mb-4">
            <p className="text-gray-600 text-sm">Invoice Date</p>
            <p className="font-semibold text-gray-900">
              {new Date(order.orderDate).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Payment Method</p>
            <p className="font-semibold text-gray-900">{order.paymentMethod}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <table className="w-full text-sm sm:text-base">
          <thead className="bg-slate-100/50">
            <tr>
              <th className="text-left p-3 text-gray-900 font-semibold border-y border-gray-200">Item Description</th>
              <th className="text-right p-3 text-gray-900 font-semibold border-y border-gray-200">Qty</th>
              <th className="text-right p-3 text-gray-900 font-semibold border-y border-gray-200">Unit Price</th>
              <th className="text-right p-3 text-gray-900 font-semibold border-y border-gray-200">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="p-3 text-gray-900">{item.product.name}</td>
                <td className="text-right p-3 text-gray-600">{item.quantity}</td>
                <td className="text-right p-3 text-gray-600">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                <td className="text-right p-3 text-gray-900 font-medium">
                  ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-full sm:w-80 space-y-2">
          <div className="flex justify-between text-gray-600 text-sm">
            <span>Subtotal:</span>
            <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-gray-600 text-sm">
            <span>Tax (GST):</span>
            <span>₹{order.gstAmount.toLocaleString('en-IN')}</span>
          </div>
          {order.deliveryCharge > 0 && (
            <div className="flex justify-between text-gray-600 text-sm">
              <span>Delivery Charges:</span>
              <span>₹{order.deliveryCharge.toLocaleString('en-IN')}</span>
            </div>
          )}
          <hr className="my-2 border-gray-200" />
          <div className="flex justify-between text-lg font-bold text-royal-deep">
            <span>Total Amount:</span>
            <span>₹{order.total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-slate-50 p-4 rounded-lg mb-6">
          <p className="text-sm font-semibold text-gray-900 mb-1">Order Notes:</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-16 mt-auto">
        <p className="font-semibold text-gray-700 mb-1">Thank you for your business!</p>
        <p>This is a computer-generated invoice and does not require a signature.</p>
      </div>
    </div>
  );
}
