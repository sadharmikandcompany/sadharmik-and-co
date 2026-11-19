'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Globe, FileCheck, Pencil, ArrowLeft } from 'lucide-react'

type PendingOrder = {
  id: string
  order_number: string
  customer_full_name: string | null
  guest_phone: string | null
  shipping_full_address: string | null
  shipping_pincode: string | null
  total_amount: number
  order_date: string
  order_status: string
  payment_status: string
  item_count: number
}

// Strips everything but digits and drops a leading country code (91) so a
// phone saved as "+919820162010", "919820162010" or "9820162010" all match
// the same 10-digit Indian mobile number.
const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

// Website guest checkouts carry name/phone directly on the order (see
// app/api/public-orders/route.ts) instead of a customer_id. Converting to a
// bill is the natural point to resolve that to a real customer: match by
// phone if one already exists, otherwise create one from what the order
// already has, so the order (and future ones from the same number) show up
// on the Customers page instead of staying untracked guests forever.
async function findOrCreateCustomerForOrder(order: PendingOrder): Promise<string | null> {
  const phone = (order.guest_phone || '').trim()
  if (!phone) return null
  const normalized = normalizePhone(phone)
  if (normalized.length !== 10) return null

  const { data: existing } = await supabase
    .from('customers')
    .select('id, mobile_primary')
    .ilike('mobile_primary', `%${normalized}%`)
    .limit(1)
    .maybeSingle()
  if (existing) return existing.id

  const name = (order.customer_full_name || 'Guest').trim()
  const [firstName, ...restName] = name.split(/\s+/)

  // Website checkouts only ever ship within Mumbai/Maharashtra (see
  // public-orders route) and store the whole typed address as one string —
  // mirrored into both building_name/street_area here, same as that route
  // does for the order itself, since customers requires these NOT NULL.
  const address = order.shipping_full_address || ''
  const { data: created, error } = await supabase
    .from('customers')
    .insert([{
      first_name: firstName || 'Guest',
      last_name: restName.join(' ') || '',
      mobile_primary: normalized,
      full_address: address || null,
      shipping_building_name: address,
      shipping_street_area: address,
      shipping_city: 'Mumbai',
      shipping_state: 'Maharashtra',
      shipping_pincode: order.shipping_pincode || '',
      billing_building_name: address,
      billing_street_area: address,
      billing_city: 'Mumbai',
      billing_state: 'Maharashtra',
      billing_pincode: order.shipping_pincode || '',
      is_active: true,
    }])
    .select('id')
    .single()
  if (error) {
    console.error('Error creating customer for website order:', error)
    return null
  }
  return created.id
}

export default function WebsiteOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, customer_full_name, guest_phone, shipping_full_address, shipping_pincode, total_amount, order_date, order_status, payment_status, order_items(id)'
      )
      .eq('source', 'website')
      .is('invoice_number_gst', null)
      .is('invoice_number_non_gst', null)
      .neq('order_status', 'cancelled')
      .order('order_date', { ascending: false })

    if (error) {
      console.error('Error fetching pending website orders:', error)
      toast.error('Failed to load website orders')
      setLoading(false)
      return
    }

    setOrders(
      (data || []).map((o: any) => ({
        ...o,
        item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
      }))
    )
    setLoading(false)
  }

  const handleConvertToBill = async (order: PendingOrder) => {
    if (convertingId) return
    setConvertingId(order.id)

    try {
      // Re-check the live row — it may have been converted or cancelled by someone else
      // since this list was fetched.
      const { data: fresh, error: freshError } = await supabase
        .from('orders')
        .select('invoice_number_gst, invoice_number_non_gst, order_status')
        .eq('id', order.id)
        .single()

      if (freshError) throw freshError

      if (fresh.invoice_number_gst || fresh.invoice_number_non_gst) {
        toast.error('This order already has a bill')
        setOrders((prev) => prev.filter((o) => o.id !== order.id))
        return
      }
      if (fresh.order_status === 'cancelled') {
        toast.error('Cannot bill a cancelled order')
        setOrders((prev) => prev.filter((o) => o.id !== order.id))
        return
      }

      // Website checkouts are always plain guest retail orders — never GST,
      // never Mandir/Shop tier. If a distributor's serviceable pincodes cover
      // the shipping pincode, the bill comes from their Invoice Code sequence
      // instead of the plain "A" prefix, same rule staff-created orders use.
      let distCode: string | null = null
      if (order.shipping_pincode) {
        const { data: matchedDistributors } = await supabase
          .from('distributors')
          .select('invoice_code, serviceable_pincodes')
          .not('serviceable_pincodes', 'is', null)
          .not('invoice_code', 'is', null)
        const match = (matchedDistributors || []).find(
          (d: any) =>
            Array.isArray(d.serviceable_pincodes) && d.serviceable_pincodes.includes(order.shipping_pincode)
        )
        if (match) distCode = match.invoice_code
      }

      const { data: nextInvoiceNumber, error: invoiceError } = await supabase.rpc('get_next_invoice_number', {
        is_gst: false,
        dist_code: distCode,
        force_kp: false,
        p_is_mandir: false,
        p_is_shop: false,
      })

      if (invoiceError) throw invoiceError

      // Website checkouts never create a customer record (see public-orders
      // route) — find-or-create one here by phone so the order actually shows
      // up on the Customers page once it becomes a real bill, instead of
      // staying an untracked guest forever.
      const customerId = await findOrCreateCustomerForOrder(order)

      const { error: updateError } = await supabase
        .from('orders')
        .update({ invoice_number_non_gst: nextInvoiceNumber, customer_id: customerId })
        .eq('id', order.id)

      if (updateError) throw updateError

      toast.success(`Bill ${nextInvoiceNumber} generated for ${order.order_number}`)
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
    } catch (err: any) {
      console.error('Error converting website order to bill:', err)
      toast.error(err.message || 'Failed to generate bill')
    } finally {
      setConvertingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/orders-v2')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Globe className="h-6 w-6" />
              Website Orders — Pending Bill
            </h1>
            <p className="text-sm text-muted-foreground">
              Website orders no longer get a bill automatically. Review each one, fix anything that looks off, then convert it.
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-sm shrink-0">
          {orders.length} pending
        </Badge>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No website orders waiting for a bill.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{order.order_number}</span>
                    <Badge variant="outline">
                      {order.item_count} item{order.item_count === 1 ? '' : 's'}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {order.payment_status}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1">
                    {order.customer_full_name || 'Guest'} — {order.guest_phone}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{order.shipping_full_address}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(order.order_date).toLocaleString('en-IN')} · ₹
                    {order.total_amount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/dashboard/orders/${order.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="mr-2 h-4 w-4" />
                      Review / Edit
                    </Button>
                  </Link>
                  <Button size="sm" onClick={() => handleConvertToBill(order)} disabled={convertingId === order.id}>
                    <FileCheck className="mr-2 h-4 w-4" />
                    {convertingId === order.id ? 'Converting...' : 'Convert to Bill'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
