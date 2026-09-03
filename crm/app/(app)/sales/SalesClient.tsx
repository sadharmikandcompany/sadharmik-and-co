"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Calendar, MoreVertical, Download, Plus, EyeOff, Globe, AlertCircle, DollarSign, Users, FileText, ChevronDown } from "lucide-react";
import { Button, Input } from "@/components/ui";

interface OrderRow {
  id: string;
  orderNumber: string;
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

export function SalesClient({ orders }: { orders: OrderRow[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  
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
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerPhone.includes(searchQuery) ||
      order.customerAddress.toLowerCase().includes(searchQuery.toLowerCase());
      
    return matchesSearch;
  });

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 font-sans">
      
      {/* Header and Top Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">Manage orders</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="ghost" className="h-9 px-3 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Hide Retailer
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            <Globe className="w-3.5 h-3.5 mr-1.5" /> Website Orders
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Failed
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            <DollarSign className="w-3.5 h-3.5 mr-1.5" /> Balance
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Distributor Orders
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Invoices
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export
          </Button>
          <Link href="/sales/new" className="h-9 px-4 py-2 flex items-center justify-center text-xs bg-blue-700 hover:bg-blue-800 text-white rounded-md">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Order
          </Link>
        </div>
      </div>

      {/* Filter Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders, invoices, address, pincode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
      <div className="flex flex-wrap gap-3 mb-6">
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

      {/* Data Table */}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 bg-gray-50 border-b border-gray-200">
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
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                    {order.orderDateLabel}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{order.orderNumber}</div>
                    {/* Placeholder for priority badge if needed */}
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
                    <Link href={`/sales/${order.id}`} className="text-gray-400 hover:text-gray-600 p-1 inline-flex rounded-full hover:bg-gray-100 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
