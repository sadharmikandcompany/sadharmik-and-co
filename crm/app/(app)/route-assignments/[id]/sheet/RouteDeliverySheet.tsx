import type { RouteManifest } from "@/lib/routeAssignments";

export function RouteDeliverySheet({ manifest }: { manifest: RouteManifest }) {
  return (
    <div className="bg-white p-8 md:p-10 max-w-4xl mx-auto min-h-[1056px] text-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-royal-deep">Delivery Sheet</h1>
          <p className="text-gray-600 font-medium mt-1">Route #{manifest.routeNumber}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-lg font-bold text-gray-900">Sadharmik & Co.</p>
          <p className="text-sm text-gray-600">Warehouse: {manifest.warehouseName}</p>
          {manifest.warehouseAddress && <p className="text-sm text-gray-600">{manifest.warehouseAddress}</p>}
          <p className="text-sm text-gray-600 mt-1">Date: {manifest.createdAtLabel}</p>
          {manifest.deliveryPartnerName && <p className="text-sm text-gray-600">Driver: {manifest.deliveryPartnerName}</p>}
        </div>
      </div>

      <hr className="my-4 border-gray-200" />

      {/* Product totals — what to load */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-2">Product Totals (Loading Summary)</h2>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100/60">
              <th className="text-left p-2.5 font-semibold border-y border-gray-200">Product</th>
              <th className="text-right p-2.5 font-semibold border-y border-gray-200">Total Qty</th>
            </tr>
          </thead>
          <tbody>
            {manifest.productTotals.map((p) => (
              <tr key={p.productName} className="border-b border-gray-100">
                <td className="p-2.5 text-gray-900">{p.productName}</td>
                <td className="p-2.5 text-right font-semibold text-gray-900">{p.totalQuantity}</td>
              </tr>
            ))}
            {manifest.productTotals.length === 0 && (
              <tr>
                <td colSpan={2} className="p-2.5 text-center text-gray-500">Nothing to load.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order-by-order manifest */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-2">Orders ({manifest.totalOrders})</h2>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-slate-100/60">
              <th className="text-left p-2 font-semibold border-y border-gray-200">#</th>
              <th className="text-left p-2 font-semibold border-y border-gray-200">Order</th>
              <th className="text-left p-2 font-semibold border-y border-gray-200">Customer</th>
              <th className="text-left p-2 font-semibold border-y border-gray-200">Address</th>
              <th className="text-left p-2 font-semibold border-y border-gray-200">Items</th>
              <th className="text-right p-2 font-semibold border-y border-gray-200">Payment</th>
              <th className="text-right p-2 font-semibold border-y border-gray-200">Amount</th>
            </tr>
          </thead>
          <tbody>
            {manifest.orders.map((o, i) => (
              <tr key={o.id} className="border-b border-gray-100 align-top">
                <td className="p-2 text-gray-600">{i + 1}</td>
                <td className="p-2 font-medium text-gray-900">{o.orderNumber}</td>
                <td className="p-2 text-gray-900">
                  {o.customerName}
                  <div className="text-gray-500">{o.customerPhone}</div>
                </td>
                <td className="p-2 text-gray-600 max-w-[180px]">{o.customerAddress}</td>
                <td className="p-2 text-gray-600">{o.items.map((it) => `${it.productName} x${it.quantity}`).join(", ")}</td>
                <td className="p-2 text-right text-gray-600">
                  {o.paymentMethod === "CASH" || o.paymentMethod === "PENDING" ? "COD" : o.paymentMethod}
                </td>
                <td className="p-2 text-right font-medium text-gray-900">₹{o.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full sm:w-80 space-y-2">
          <div className="flex justify-between text-gray-600"><span>Total Orders:</span><span>{manifest.totalOrders}</span></div>
          <div className="flex justify-between text-gray-600"><span>Total Items:</span><span>{manifest.totalItems}</span></div>
          <div className="flex justify-between text-gray-600"><span>Cash/COD to Collect:</span><span>₹{manifest.totalCod}</span></div>
          <hr className="my-2 border-gray-200" />
          <div className="flex justify-between text-lg font-bold text-royal-deep"><span>Total Amount:</span><span>₹{manifest.totalAmount}</span></div>
        </div>
      </div>

      {manifest.notes && (
        <div className="mt-6 bg-slate-50 p-4 rounded-lg">
          <p className="text-sm font-semibold text-gray-900 mb-1">Notes:</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{manifest.notes}</p>
        </div>
      )}
    </div>
  );
}
