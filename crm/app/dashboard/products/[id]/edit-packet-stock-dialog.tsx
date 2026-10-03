'use client'

import { useState } from 'react'
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
import { toast } from 'sonner'

type EditPacketStockDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  godownId: string
  godownName: string
  stockInventoryId: string
  productName: string
  variantName: string
  currentQuantity: number
  onSuccess: () => void
}

export function EditPacketStockDialog({
  open,
  onOpenChange,
  godownId,
  godownName,
  stockInventoryId,
  productName,
  variantName,
  currentQuantity,
  onSuccess,
}: EditPacketStockDialogProps) {
  const [newQuantity, setNewQuantity] = useState(currentQuantity.toString())
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const quantity = parseInt(newQuantity)
    if (isNaN(quantity)) {
      toast.error('Please enter a valid quantity')
      return
    }

    setLoading(true)

    try {
      // Check whether a record already exists for this warehouse + product.
      // godown_stock has no unique constraint on (godown_id, stock_inventory_id),
      // so we can't use upsert/onConflict — update or insert explicitly instead.
      const { data: existingStock, error: fetchError } = await supabase
        .from('godown_stock')
        .select('id')
        .eq('godown_id', godownId)
        .eq('stock_inventory_id', stockInventoryId)
        .limit(1)
        .maybeSingle()

      if (fetchError) throw fetchError

      // Note: available_quantity is a generated column, so we don't set it manually
      const { error } = existingStock
        ? await supabase
            .from('godown_stock')
            .update({ quantity, updated_at: new Date().toISOString() })
            .eq('id', existingStock.id)
        : await supabase
            .from('godown_stock')
            .insert({
              godown_id: godownId,
              stock_inventory_id: stockInventoryId,
              quantity,
              reserved_quantity: 0,
            })

      if (error) throw error

      toast.success('Stock updated successfully')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error updating stock:', error)
      toast.error(error.message || 'Failed to update stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Stock Quantity</DialogTitle>
            <DialogDescription>
              Update the stock quantity for this product in the selected warehouse
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Product</Label>
              <p className="font-medium">{productName}</p>
              <p className="text-sm text-muted-foreground">{variantName}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Warehouse</Label>
              <p className="font-medium">{godownName}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Current Quantity</Label>
              <p className="font-medium">{currentQuantity}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">New Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Enter new quantity (can be negative)"
                required
              />
              <p className="text-xs text-muted-foreground">
                Change: {parseInt(newQuantity) - currentQuantity >= 0 ? '+' : ''}
                {parseInt(newQuantity) - currentQuantity || 0}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
