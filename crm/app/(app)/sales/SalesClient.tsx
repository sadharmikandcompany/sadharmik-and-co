"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Calendar, Download, Plus, EyeOff, Globe, AlertCircle, DollarSign, Users, FileText, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { OrderActionsMenu } from "./OrderActionsMenu";

const PAGE_SIZE = 25;

interface OrderRow {
  id: string;
  orderNumber: string;
  invoiceNumber: number;
  orderDateLabel: string;
  status: string;
  source: string;
  paymentMethod: string;
  total: number;
  amountPaid: number;
  customerName: string;
  customerVipNumber: number;
  customerPhone: string;
  customerAddress: string;
  deliveryPartnerName?: string | null;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
}

interface DeliveryPartnerOption {
  id: string;
  name: string;
  activeOrders: number;
  totalOrders: number;
}

export function SalesClient({ orders, deliveryPartners }: { orders: OrderRow[]; deliveryPartners: DeliveryPartnerOption[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setCurrentPage(1); // a new search always starts back at page 1
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">completed</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">pending</span>;
    }
  };

  const getPaymentBadge = (total: number, paid: number) => {
    if (paid >= total && total > 0) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">completed</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">pending</span>;
  };

  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase();
    const qCode = q.replace(/\s+/g, "");
    const customerCode = order.customerVipNumber ? `sd${String(order.customerVipNumber).padStart(4, "0")}` : "";
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(q) ||
      order.customerName.toLowerCase().includes(q) ||
      order.customerPhone.includes(searchQuery) ||
      order.customerAddress.toLowerCase().includes(q) ||
      (qCode.length > 0 && customerCode.includes(qCode));

    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pagedOrders = useMemo(
    () => filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    // filteredOrders is a fresh array every render, so we key off searchQuery/orders/page instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, searchQuery, page]
  );
  const rangeStart = filteredOrders.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredOrders.length);

  return (
    <div className="w-full font-sans">

      {/* Header, buttons and filters are frozen at the top — only the table body scrolls. */}
      <div className="sticky top-0 z-20 bg-ivory pb-4 border-b border-gray-200">
        {/* Header and Top Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-sm text-gray-500">Manage orders</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="ghost" className="h-8 px-4 rounded-full text-xs bg-white text-gray-700 border border-gray-200 hover:bg-gray-50">
              <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Hide Retailer
            </Button>
            <Button variant="ghost" className="h-8 px-4 rounded-full text-xs bg-white text-gray-700 border border-gray-200 hover:bg-gray-50">
              <Globe className="w-3.5 h-3.5 mr-1.5" /> Website Orders
            </Button>
            <Button variant="ghost" className="h-8 px-4 rounded-full text-xs bg-white text-gray-700 border border-gray-200 hover:bg-gray-50">
              <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Failed
            </Button>
            <Button variant="ghost" className="h-8 px-4 rounded-full text-xs bg-white text-gray-700 border border-gray-200 hover:bg-gray-50">
              <DollarSign className="w-3.5 h-3.5 mr-1.5" /> Balance
            </Button>
            <Button variant="ghost" className="h-8 px-4 rounded-full text-xs bg-white text-gray-700 border border-gray-200 hover:bg-gray-50">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Distributor Orders
            </Button>
            <Button variant="ghost" className="h-8 px-4 rounded-full text-xs bg-white text-gray-700 border border-gray-200 hover:bg-gray-50">
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Invoices
            </Button>
            <Button variant="ghost" className="h-8 px-4 rounded-full text-xs bg-white text-gray-700 border border-gray-200 hover:bg-gray-50">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export
            </Button>
            <Link href="/sales/new" className="h-8 px-5 flex items-center justify-center text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Order
            </Link>
          </div>
        </div>

        {/* Filter Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders, customer, Sd code, address..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <select className="w-full h-10 px-3 appearance-none rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white">
              <option>All Statuses</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="w-full h-10 px-3 appearance-none rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white">
              <option>All Delivery Status</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="w-full h-10 px-3 appearance-none rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white">
              <option>All Payment Methods</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select className="w-full h-10 px-3 appearance-none rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white">
              <option>All Distributors</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Filter Row 2 */}
        <div className="flex flex-wrap gap-3 mt-3">
          <div className="relative w-full sm:w-auto">
            <select className="w-full sm:w-64 h-10 px-3 appearance-none rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-white">
              <option>All Delivery Partners</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex gap-3">
            <div className="relative w-32">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Date From" className="w-full h-10 pl-9 pr-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-500" />
            </div>
            <div className="relative w-32">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Date To" className="w-full h-10 pl-9 pr-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-500" />
            </div>
          </div>

          <div className="flex gap-3">
            <input type="text" placeholder="Amount From ₹" className="w-36 h-10 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
            <input type="text" placeholder="Amount To ₹" className="w-36 h-10 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* Data Table. w-full + min-w-0 keep this box from ever growing past its
          parent, so a wide table scrolls sideways inside here, not the whole
          page — the page itself still scrolls normally top-to-bottom, it's
          only the header/filters above that stay pinned. */}
      <div className="mt-6 w-full min-w-0 overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="w-full text-[13px] text-left">
          <thead className="text-gray-500 bg-white border-b border-gray-200">
            <tr>
              <th scope="col" className="px-4 py-3 w-10">
                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">Date</th>
              <th scope="col" className="px-4 py-3 font-semibold">Order Number</th>
              <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
              <th scope="col" className="px-4 py-3 font-semibold">Address</th>
              <th scope="col" className="px-4 py-3 font-semibold">Distributor</th>
              <th scope="col" className="px-4 py-3 font-semibold">Delivery Driver</th>
              <th scope="col" className="px-4 py-3 font-semibold">Delivery Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Payment Method</th>
              <th scope="col" className="px-4 py-3 font-semibold">Amount</th>
              <th scope="col" className="px-4 py-3 font-semibold">Order Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Payment Status</th>
              <th scope="col" className="px-4 py-3 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pagedOrders.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              pagedOrders.map((order) => (
                <tr key={order.id} className="bg-[#FFFDF4] hover:bg-[#F9F6EA] border-b border-gray-100 last:border-none">
                  <td className="px-4 py-4">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                    {order.orderDateLabel}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">A{order.invoiceNumber}</span>
                      <Link href={`/sales/${order.id}/print?type=a4`} target="_blank" className="text-gray-400 hover:text-gray-600" title="Print A4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      </Link>
                      <button onClick={() => window.open(`/sales/${order.id}/print?type=thermal`, '_blank')} className="text-gray-400 hover:text-gray-600" title="Print Thermal (Direct)">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </button>
                    </div>
                    <Link href={`/sales/${order.id}`} className="text-xs text-gray-500 hover:text-indigo-600 inline-flex items-center gap-1">
                      {order.orderNumber}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{order.customerName}</span>
                      {order.customerVipNumber && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 border border-gray-200">
                          {order.customerVipNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">{order.customerPhone}</div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 text-xs max-w-xs truncate">
                    {order.customerAddress}
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-xs">
                    {/* Distributor placeholder */}
                    Bhavya Gandhi<br/>Services 400074
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-xs">
                    {order.deliveryPartnerName || <span className="text-gray-400">Not assigned</span>}
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-xs">
                    <span className="text-gray-400">Not assigned</span>
                  </td>
                  <td className="px-4 py-4 text-gray-900 text-sm">
                    {order.paymentMethod === 'CASH' ? 'Cash' : 
                     order.paymentMethod === 'CARD' ? 'Card' : 
                     order.paymentMethod === 'UPI' ? 'UPI' : 'Cheque'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900 font-medium">
                    ₹{order.total.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getPaymentBadge(order.total, order.amountPaid)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <OrderActionsMenu orderId={order.id} status={order.status} deliveryPartners={deliveryPartners} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — 25 orders per page */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {filteredOrders.length === 0
            ? "No orders"
            : `Showing ${rangeStart}–${rangeEnd} of ${filteredOrders.length} orders`}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 h-8 px-3 rounded text-xs font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <span className="px-3 text-xs text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 h-8 px-3 rounded text-xs font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
