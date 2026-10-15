'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { restoreKgStockForOrder } from '@/lib/stock/deduct-kg-stock'

type OrderItem = {
  id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  weight_grams: number | null
  subtotal: number
  discount_amount: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  total: number
}

type OrderInfo = {
  id: string
  order_number: string
  total_amount: number
  subtotal: number
  gst_amount: number
  cgst_amount: number
  sgst_amount: number
  source_godown_id: string | null
  payment_status: string
  payment_method: string | null
}

type ProcessReturnDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  onSuccess: () => void
}

const formatINR = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export function ProcessReturnDialog({ open, onOpenChange, orderId, onSuccess }: ProcessReturnDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [returnQty, setReturnQty] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) {
      setOrder(null)
      setItems([])
      setReturnQty({})
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [{ data: orderData }, { data: itemsData }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, total_amount, subtotal, gst_amount, cgst_amount, sgst_amount, source_godown_id, payment_status, payment_method')
          .eq('id', orderId)
          .single(),
        supabase
          .from('order_items')
          .select('id, product_id, product_name, quantity, unit_price, weight_grams, subtotal, discount_amount, gst_amount, cgst_amount, sgst_amount, total')
          .eq('order_id', orderId),
      ])
      if (cancelled) return
      setOrder(orderData as OrderInfo | null)
      setItems((itemsData || []) as OrderItem[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, orderId])

  const parsedReturnQty = (itemId: string, maxQty: number): number => {
    const raw = parseFloat(returnQty[itemId] || '0')
    if (isNaN(raw) || raw <= 0) return 0
    return Math.min(raw, maxQty)
  }

  const returnedLines = items
    .map((item) => {
      const qty = parsedReturnQty(item.id, item.quantity)
      if (qty <= 0 || item.quantity <= 0) return null
      const ratio = qty / item.quantity
      return {
        item,
        qty,
        ratio,
        deltaSubtotal: item.subtotal * ratio,
        deltaDiscount: item.discount_amount * ratio,
        deltaGst: item.gst_amount * ratio,
        deltaCgst: item.cgst_amount * ratio,
        deltaSgst: item.sgst_amount * ratio,
        deltaTotal: item.total * ratio,
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  const totalReturnValue = returnedLines.reduce((sum, l) => sum + l.deltaTotal, 0)

  const handleConfirm = async () => {
    if (!order || returnedLines.length === 0) {
      toast.error('Enter a return quantity for at least one item')
      return
    }

    setSaving(true)
    try {
      // Shrink each returned line proportionally, re-reading the live row
      // right before writing so a concurrent edit isn't clobbered.
      for (const line of returnedLines) {
        const { data: fresh } = await supabase
          .from('order_items')
          .select('quantity, subtotal, discount_amount, gst_amount, cgst_amount, sgst_amount, total')
          .eq('id', line.item.id)
          .single()
        if (!fresh) continue
        await supabase
          .from('order_items')
          .update({
            quantity: Math.max(0, Number(fresh.quantity) - line.qty),
            subtotal: Math.max(0, Number(fresh.subtotal) - line.deltaSubtotal),
            discount_amount: Math.max(0, Number(fresh.discount_amount) - line.deltaDiscount),
            gst_amount: Math.max(0, Number(fresh.gst_amount) - line.deltaGst),
            cgst_amount: Math.max(0, Number(fresh.cgst_amount) - line.deltaCgst),
            sgst_amount: Math.max(0, Number(fresh.sgst_amount) - line.deltaSgst),
            total: Math.max(0, Number(fresh.total) - line.deltaTotal),
          })
          .eq('id', line.item.id)
      }

      const deltaSubtotalTotal = returnedLines.reduce((s, l) => s + l.deltaSubtotal, 0)
      const deltaGstTotal = returnedLines.reduce((s, l) => s + l.deltaGst, 0)
      const deltaCgstTotal = returnedLines.reduce((s, l) => s + l.deltaCgst, 0)
      const deltaSgstTotal = returnedLines.reduce((s, l) => s + l.deltaSgst, 0)

      await supabase
        .from('orders')
        .update({
          subtotal: Math.max(0, Number(order.subtotal) - deltaSubtotalTotal),
          gst_amount: Math.max(0, Number(order.gst_amount) - deltaGstTotal),
          cgst_amount: Math.max(0, Number(order.cgst_amount) - deltaCgstTotal),
          sgst_amount: Math.max(0, Number(order.sgst_amount) - deltaSgstTotal),
          total_amount: Math.max(0, Number(order.total_amount) - totalReturnValue),
        })
        .eq('id', order.id)

      // Stock goes back to the warehouse this order shipped from.
      if (order.source_godown_id) {
        await restoreKgStockForOrder(
          supabase,
          order.source_godown_id,
          returnedLines.map((l) => ({ product_id: l.item.product_id, quantity: l.qty, weight_grams: l.item.weight_grams }))
        )
      }

      // Already paid? Post a reversal so Reconciliation doesn't overstate
      // what was actually kept — same account the original payment used.
      if (order.payment_status === 'completed' && totalReturnValue > 0) {
        const { data: accounts } = await supabase.from('bank_accounts').select('id, account_type')
        const isCash = order.payment_method === 'cash'
        const account = (accounts || []).find((a) => (isCash ? a.account_type === 'cash' : a.account_type !== 'cash'))
        if (account) {
          const { data: { user } } = await supabase.auth.getUser()
          await supabase.from('bank_transactions').insert({
            bank_account_id: account.id,
            txn_date: new Date().toISOString(),
            value_date: new Date().toISOString(),
            amount: totalReturnValue,
            txn_type: 'Dr',
            description: `Return - ${order.order_number} (${formatINR(totalReturnValue)} returned)`,
            reference: `${order.order_number}-RETURN-${Date.now()}`,
            status: 'matched',
            created_by: user?.id || null,
          })
        }
      }

      toast.success(`Returned ${formatINR(totalReturnValue)} for ${order.order_number}`)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error processing return:', error)
      toast.error(error.message || 'Failed to process return')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Process Return{order ? ` — ${order.order_number}` : ''}</DialogTitle>
          <DialogDescription>
            Enter how much of each item is coming back. Stock is added back to the fulfilling warehouse, and the
            order total is reduced to match — {order?.payment_status === 'completed' ? 'the paid amount is reversed in Reconciliation too.' : 'no reversal is needed since this order isn\'t marked paid yet.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground text-center">Loading order...</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground text-center">No items found on this order.</p>
        ) : (
          <div className="space-y-4 py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right w-28">Returning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        max={item.quantity}
                        step="any"
                        value={returnQty[item.id] || ''}
                        onChange={(e) => setReturnQty({ ...returnQty, [item.id]: e.target.value })}
                        placeholder="0"
                        className="h-8 text-right"
                        disabled={item.quantity <= 0}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <Label className="text-muted-foreground">Return value</Label>
              <span className="font-semibold tabular-nums">{formatINR(totalReturnValue)}</span>
            </div>
            {order && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <Label className="text-muted-foreground">New order total</Label>
                <span className="font-semibold tabular-nums">{formatINR(Number(order.total_amount) - totalReturnValue)}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving || loading || returnedLines.length === 0}>
            {saving ? 'Processing...' : 'Confirm Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
