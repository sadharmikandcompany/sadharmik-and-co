"use client"

import { useState, useEffect } from 'react'
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Loader2, ChevronLeft, ChevronRight, FileText } from "lucide-react"
import { format } from "date-fns"

const toDateInputValue = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toISOString().split('T')[0] : ''

const formatDisplayDate = (iso: string | null | undefined): string | null => {
  const ymd = toDateInputValue(iso)
  if (!ymd) return null
  // Parse as local midnight so the displayed date matches the input value exactly
  return format(new Date(ymd + 'T00:00:00'), "dd MMM yyyy")
}

interface Order {
  id: string
  order_number: string
  customer_id: string | null
  retailer_id: string | null
  customer_name?: string
  customer_phone?: string
  order_status: string
  payment_status: string
  total_amount: number
  shipping_full_address: string
  order_date: string
  created_at: string
  invoice_number_gst: string | null
  invoice_number_non_gst: string | null
  is_gst_invoice: boolean
}

export default function InvoiceNumberManagement() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedInvoiceGst, setEditedInvoiceGst] = useState<string>('')
  const [editedInvoiceNonGst, setEditedInvoiceNonGst] = useState<string>('')
  const [editedOrderDate, setEditedOrderDate] = useState<string>('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [totalOrders, setTotalOrders] = useState(0)

  // Server-side pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50 // Fetch 50 items per page from database

  useEffect(() => {
    fetchOrders()
  }, [currentPage]) // Re-fetch when page changes

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)

    try {
      // Calculate pagination range
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      // Get total count only on first page load or when needed
      if (currentPage === 1 || totalOrders === 0) {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .or("customer_id.not.is.null,retailer_id.not.is.null")

        setTotalOrders(count || 0)
        console.log(`Total orders in database: ${count}`)
      }

      // Fetch only the current page of orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, customer_id, retailer_id, order_status, payment_status, total_amount, shipping_full_address, order_date, created_at, invoice_number_gst, invoice_number_non_gst, is_gst_invoice')
        .or("customer_id.not.is.null,retailer_id.not.is.null")
        .order('created_at', { ascending: false })
        .range(from, to)

      if (ordersError) throw ordersError

      console.log(`Fetched page ${currentPage}: ${ordersData?.length || 0} orders (rows ${from + 1} to ${from + (ordersData?.length || 0)})`)

      // Extract unique customer and retailer IDs from current page
      const customerIds = [...new Set(ordersData
        .filter((order: any) => order.customer_id)
        .map((order: any) => order.customer_id))]
      const retailerIds = [...new Set(ordersData
        .filter((order: any) => order.retailer_id)
        .map((order: any) => order.retailer_id))]

      console.log(`Fetching ${customerIds.length} unique customers and ${retailerIds.length} unique retailers`)

      // Fetch customers and retailers in parallel
      const [customersResult, retailersResult] = await Promise.all([
        customerIds.length > 0
          ? supabase
              .from("customers")
              .select("id, first_name, last_name, mobile_primary")
              .in("id", customerIds)
          : Promise.resolve({ data: [], error: null }),
        retailerIds.length > 0
          ? supabase
              .from("retailers")
              .select("id, name, phone_primary")
              .in("id", retailerIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (customersResult.error) {
        console.error('Error fetching customers:', customersResult.error)
      }
      if (retailersResult.error) {
        console.error('Error fetching retailers:', retailersResult.error)
      }

      console.log(`Fetched ${customersResult.data?.length || 0} customers and ${retailersResult.data?.length || 0} retailers`)

      // Create lookup maps
      const customersMap = new Map(
        (customersResult.data || []).map((c: any) => [c.id, c])
      )
      const retailersMap = new Map(
        (retailersResult.data || []).map((r: any) => [r.id, r])
      )

      // Map the data to the expected format with full customer names
      const ordersWithCustomers = ordersData.map((order: any) => {
        let customer_name = "Unknown"
        let customer_phone = ""

        if (order.customer_id) {
          const customer = customersMap.get(order.customer_id)
          if (customer) {
            customer_name = `${customer.first_name} ${customer.last_name}`.trim()
            customer_phone = customer.mobile_primary || ""
          } else {
            console.warn(`Customer not found for ID: ${order.customer_id}`)
          }
        } else if (order.retailer_id) {
          const retailer = retailersMap.get(order.retailer_id)
          if (retailer) {
            customer_name = `${retailer.name} (Retailer)`
            customer_phone = retailer.phone_primary || ""
          } else {
            console.warn(`Retailer not found for ID: ${order.retailer_id}`)
          }
        }

        return {
          ...order,
          customer_name,
          customer_phone,
        }
      })

      setOrders(ordersWithCustomers || [])
      console.log(`Successfully loaded page ${currentPage} with ${ordersWithCustomers.length} orders`)

      // Log a sample to verify data
      if (ordersWithCustomers.length > 0) {
        console.log('Sample order:', ordersWithCustomers[0])
      }

    } catch (err: any) {
      setError(err.message)
      toast.error('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (order: Order) => {
    setEditingId(order.id)
    setEditedInvoiceGst(order.invoice_number_gst || '')
    setEditedInvoiceNonGst(order.invoice_number_non_gst || '')
    setEditedOrderDate(toDateInputValue(order.order_date))
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditedInvoiceGst('')
    setEditedInvoiceNonGst('')
    setEditedOrderDate('')
  }

  const saveInvoiceNumbers = async (order: Order) => {
    // Require at least one of: invoice numbers or order date so save is never a no-op
    if (!editedInvoiceGst.trim() && !editedInvoiceNonGst.trim() && !editedOrderDate) {
      toast.error('Provide at least one invoice number or an order date')
      return
    }

    setUpdatingId(order.id)

    try {
      // Check uniqueness before saving
      if (editedInvoiceGst.trim()) {
        const { data: existingGst } = await supabase
          .from('orders')
          .select('id, order_number')
          .eq('invoice_number_gst', editedInvoiceGst.trim())
          .neq('id', order.id)
          .limit(1)

        if (existingGst && existingGst.length > 0) {
          toast.error(`GST invoice number "${editedInvoiceGst.trim()}" is already used by order ${existingGst[0].order_number}`)
          setUpdatingId(null)
          return
        }
      }

      if (editedInvoiceNonGst.trim()) {
        const { data: existingNonGst } = await supabase
          .from('orders')
          .select('id, order_number')
          .eq('invoice_number_non_gst', editedInvoiceNonGst.trim())
          .neq('id', order.id)
          .limit(1)

        if (existingNonGst && existingNonGst.length > 0) {
          toast.error(`Non-GST invoice number "${editedInvoiceNonGst.trim()}" is already used by order ${existingNonGst[0].order_number}`)
          setUpdatingId(null)
          return
        }
      }

      // Update the database
      const { error } = await supabase
        .from('orders')
        .update({
          invoice_number_gst: editedInvoiceGst.trim() || null,
          invoice_number_non_gst: editedInvoiceNonGst.trim() || null,
          order_date: editedOrderDate ? new Date(editedOrderDate).toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)

      if (error) throw error

      // Update local state
      setOrders(prev =>
        prev.map(o =>
          o.id === order.id
            ? {
                ...o,
                invoice_number_gst: editedInvoiceGst.trim() || null,
                invoice_number_non_gst: editedInvoiceNonGst.trim() || null,
                order_date: editedOrderDate ? new Date(editedOrderDate).toISOString() : o.order_date
              }
            : o
        )
      )

      toast.success('Order updated successfully')
      setEditingId(null)
      setEditedInvoiceGst('')
      setEditedInvoiceNonGst('')
      setEditedOrderDate('')

    } catch (err: any) {
      console.error('Error updating invoice numbers:', err)
      // Handle unique constraint violation from DB
      if (err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
        toast.error('This invoice number is already in use by another order')
      } else {
        toast.error('Failed to update invoice numbers')
      }
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Invoice Number Management</h1>
        <div className="space-y-4">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading orders (Page {currentPage})...</p>
            {totalOrders > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Total orders in database: {totalOrders.toLocaleString()}
              </p>
            )}
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Invoice Number Management</h1>
        <Alert variant="destructive">
          <AlertDescription>
            Error loading orders: {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Invoice Number Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalOrders > 0 && (
              <>
                Showing <strong>{((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalOrders)}</strong> of <strong>{totalOrders.toLocaleString()}</strong> total orders
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchOrders} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableCaption>
            {orders.length > 0
              ? `Click any invoice number or order date to edit inline. Page ${currentPage} of ${Math.ceil(totalOrders / itemsPerPage)}`
              : 'No orders found'
            }
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Order Number</TableHead>
              <TableHead className="w-[200px]">Customer</TableHead>
              <TableHead className="w-[120px]">Phone</TableHead>
              <TableHead className="w-[250px]">Shipping Address</TableHead>
              <TableHead className="w-[100px]">Amount</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[160px]">Order Date</TableHead>
              <TableHead className="w-[200px]">Invoice (GST)</TableHead>
              <TableHead className="w-[200px]">Invoice (Non-GST)</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium font-mono">
                  {order.order_number}
                </TableCell>
                <TableCell>
                  {order.customer_name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {order.customer_phone}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="max-w-[250px]" title={order.shipping_full_address}>
                    {order.shipping_full_address ? (
                      <div className="space-y-0.5">
                        {order.shipping_full_address.split(';').filter(Boolean).map((part, idx) => (
                          <div key={idx} className={idx === 0 ? "truncate" : "truncate text-xs text-muted-foreground"}>
                            {part.trim()}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">N/A</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  ₹{order.total_amount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant={order.order_status === "delivered" ? "default" : "secondary"} className="text-xs">
                    {order.order_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {editingId === order.id ? (
                    <Input
                      type="date"
                      value={editedOrderDate}
                      onChange={(e) => setEditedOrderDate(e.target.value)}
                      className="w-full"
                      disabled={updatingId === order.id}
                    />
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-muted p-2 rounded text-sm"
                      onClick={() => startEditing(order)}
                    >
                      {formatDisplayDate(order.order_date) ?? <span className="text-muted-foreground italic">Not set</span>}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === order.id ? (
                    <Input
                      value={editedInvoiceGst}
                      onChange={(e) => setEditedInvoiceGst(e.target.value)}
                      className="w-full font-mono"
                      placeholder="GST Invoice Number"
                      disabled={updatingId === order.id}
                    />
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-muted p-2 rounded font-mono text-sm"
                      onClick={() => startEditing(order)}
                    >
                      {order.invoice_number_gst || <span className="text-muted-foreground italic">Not set</span>}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === order.id ? (
                    <Input
                      value={editedInvoiceNonGst}
                      onChange={(e) => setEditedInvoiceNonGst(e.target.value)}
                      className="w-full font-mono"
                      placeholder="Non-GST Invoice Number"
                      disabled={updatingId === order.id}
                    />
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-muted p-2 rounded font-mono text-sm"
                      onClick={() => startEditing(order)}
                    >
                      {order.invoice_number_non_gst || <span className="text-muted-foreground italic">Not set</span>}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {order.is_gst_invoice ? 'GST' : 'Non-GST'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {editingId === order.id ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveInvoiceNumbers(order)}
                        disabled={updatingId === order.id}
                      >
                        {updatingId === order.id ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        disabled={updatingId === order.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(order)}
                      disabled={updatingId === order.id || editingId !== null}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Edit Invoice #
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalOrders > 0 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalOrders)} of {totalOrders.toLocaleString()} orders
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {Math.ceil(totalOrders / itemsPerPage)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalOrders / itemsPerPage), p + 1))}
              disabled={currentPage >= Math.ceil(totalOrders / itemsPerPage) || loading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
