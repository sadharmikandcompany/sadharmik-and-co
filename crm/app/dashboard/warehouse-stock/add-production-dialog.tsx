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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { formatKg } from '@/lib/product-weight'

type CategoryOption = { id: string; name: string }

type AddProductionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  godownId: string
  godownName: string
  categories: CategoryOption[]
  onSuccess: () => void
}

// Adds today's finished production on top of whatever stock is already
// there — e.g. 15kg on hand + 15kg made today = 30kg — instead of making
// you work out and type the new total yourself (that's what Edit Stock is
// for, when you really do want to set an absolute figure).
export function AddProductionDialog({
  open,
  onOpenChange,
  godownId,
  godownName,
  categories,
  onSuccess,
}: AddProductionDialogProps) {
  const [categoryId, setCategoryId] = useState('')
  const [kgMade, setKgMade] = useState('')
  const [currentKg, setCurrentKg] = useState<number | null>(null)
  const [loadingCurrent, setLoadingCurrent] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setCategoryId('')
      setKgMade('')
      setCurrentKg(null)
    }
  }, [open])

  useEffect(() => {
    if (!categoryId) {
      setCurrentKg(null)
      return
    }
    let cancelled = false
    setLoadingCurrent(true)
    supabase
      .from('godown_kg_stock')
      .select('quantity_kg')
      .eq('godown_id', godownId)
      .eq('category_id', categoryId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setCurrentKg(Number(data?.quantity_kg) || 0)
          setLoadingCurrent(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [categoryId, godownId])

  const parsedKg = parseFloat(kgMade)
  const newTotal = (currentKg ?? 0) + (isNaN(parsedKg) ? 0 : parsedKg)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!categoryId) {
      toast.error('Please select a product')
      return
    }
    if (isNaN(parsedKg) || parsedKg <= 0) {
      toast.error('Please enter how many kg were made')
      return
    }

    setSaving(true)
    try {
      // Re-read the current figure right before writing, in case someone
      // else changed it since this dialog opened.
      const { data: fresh } = await supabase
        .from('godown_kg_stock')
        .select('quantity_kg')
        .eq('godown_id', godownId)
        .eq('category_id', categoryId)
        .maybeSingle()

      const freshCurrent = Number(fresh?.quantity_kg) || 0

      const { error } = await supabase
        .from('godown_kg_stock')
        .upsert(
          {
            godown_id: godownId,
            category_id: categoryId,
            quantity_kg: Number((freshCurrent + parsedKg).toFixed(3)),
          },
          { onConflict: 'godown_id,category_id' }
        )

      if (error) throw error

      toast.success(`Added ${formatKg(parsedKg)} — new total ${formatKg(freshCurrent + parsedKg)}`)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error adding production:', error)
      toast.error(error.message || 'Failed to add production')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Today&apos;s Production</DialogTitle>
            <DialogDescription>
              Adds on top of what&apos;s already in stock at {godownName} — it doesn&apos;t replace it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category">Product</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {categoryId && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Current Stock</Label>
                <p className="font-medium">{loadingCurrent ? '...' : formatKg(currentKg ?? 0)}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="kgMade">Kg Made Today</Label>
              <Input
                id="kgMade"
                type="number"
                step="any"
                min="0"
                value={kgMade}
                onChange={(e) => setKgMade(e.target.value)}
                placeholder="e.g. 15"
                autoFocus
                required
              />
              {categoryId && kgMade && !isNaN(parsedKg) && (
                <p className="text-xs text-muted-foreground">
                  New total: {formatKg(newTotal)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Add to Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
