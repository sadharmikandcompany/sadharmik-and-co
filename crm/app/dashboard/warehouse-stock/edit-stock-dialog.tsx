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
import { toast } from 'sonner'
import { formatKg } from '@/lib/product-weight'

type EditStockDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  godownId: string
  godownName: string
  categoryId: string
  flavourName: string
  currentKg: number
  onSuccess: () => void
}

export function EditStockDialog({
  open,
  onOpenChange,
  godownId,
  godownName,
  categoryId,
  flavourName,
  currentKg,
  onSuccess,
}: EditStockDialogProps) {
  const [newKg, setNewKg] = useState(String(currentKg))
  const [loading, setLoading] = useState(false)

  // The dialog stays mounted between opens — reset to the row being edited.
  useEffect(() => {
    if (open) setNewKg(String(currentKg))
  }, [open, currentKg])

  const parsedKg = parseFloat(newKg)
  const change = isNaN(parsedKg) ? 0 : parsedKg - currentKg

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isNaN(parsedKg)) {
      toast.error('Please enter a valid kg amount')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('godown_kg_stock')
        .upsert(
          {
            godown_id: godownId,
            category_id: categoryId,
            quantity_kg: Number(parsedKg.toFixed(3)),
          },
          { onConflict: 'godown_id,category_id' }
        )

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
            <DialogTitle>Edit Stock</DialogTitle>
            <DialogDescription>
              Update the stock in kg for this flavour in the selected warehouse
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Flavour</Label>
                <p className="font-medium">{flavourName}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Warehouse</Label>
                <p className="font-medium">{godownName}</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Current Stock</Label>
              <p className="font-medium">{formatKg(currentKg)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kg">New Stock (kg)</Label>
              <Input
                id="kg"
                type="number"
                step="any"
                value={newKg}
                onChange={(e) => setNewKg(e.target.value)}
                placeholder="e.g. 4"
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">
                Change: {change >= 0 ? '+' : '-'}{formatKg(Math.abs(change))}
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
