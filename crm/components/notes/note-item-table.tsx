"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash2 } from "lucide-react"

// Shared by New + Edit, Debit Note + Credit Note (4 surfaces) — item-table
// look & feel matches the Purchases item table: every row is directly
// editable (no separate "draft row" commit step), and Rate/Unit (Excl. Tax)
// is the primary editable field with Rate (Incl. of Tax) as a computed
// alternate that back-computes the excl.-tax rate when edited directly.
export type NoteItem = {
  id: string
  product_id: string
  item_name: string
  hsn_code: string
  description: string
  quantity: number
  unit: string
  price_per_unit: number // excl.-tax rate — what's actually written on the original bill
  discount_percent: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  amount: number // incl.-tax line total
}

export const NOTE_UNITS = ["PCS", "KG", "G", "L", "ML", "BOX", "PACK", "DOZEN", "METER", "CM"]

export function makeEmptyNoteItem(): NoteItem {
  return {
    id: "",
    product_id: "",
    item_name: "",
    hsn_code: "",
    description: "",
    quantity: 1,
    unit: "PCS",
    price_per_unit: 0,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 18,
    tax_amount: 0,
    amount: 0,
  }
}

export function calculateNoteItemAmount(item: NoteItem): NoteItem {
  const baseAmount = item.quantity * item.price_per_unit
  const discountAmt = (baseAmount * item.discount_percent) / 100
  const afterDiscount = baseAmount - discountAmt
  const taxAmt = (afterDiscount * item.tax_percent) / 100
  const finalAmount = afterDiscount + taxAmt

  return {
    ...item,
    discount_amount: discountAmt,
    tax_amount: taxAmt,
    amount: finalAmount,
  }
}

interface NoteItemTableProps {
  items: NoteItem[]
  onUpdateItem: (id: string, field: keyof NoteItem, value: string | number) => void
  onRemoveItem: (id: string) => void
}

export function NoteItemTable({ items, onUpdateItem, onRemoveItem }: NoteItemTableProps) {
  if (items.length === 0) return null

  // Same shape as the Purchases item table's bottom subtotal row.
  const totals = items.reduce(
    (acc, item) => {
      const baseAmount = item.quantity * item.price_per_unit
      const taxableAmt = baseAmount - item.discount_amount
      acc.taxable += taxableAmt
      acc.gst += item.tax_amount
      acc.grand += item.amount
      return acc
    },
    { taxable: 0, gst: 0, grand: 0 }
  )

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="w-56">Item</TableHead>
            <TableHead className="w-28">HSN</TableHead>
            <TableHead className="w-20 text-center">Qty</TableHead>
            <TableHead className="w-24">Unit</TableHead>
            <TableHead className="w-28 text-right">Rate/Unit (Excl. Tax)</TableHead>
            <TableHead className="w-28 text-right">Rate (Incl. of Tax)</TableHead>
            <TableHead className="w-20 text-center">Disc %</TableHead>
            <TableHead className="w-28 text-right">Taxable Amt</TableHead>
            <TableHead className="w-20 text-center">Tax %</TableHead>
            <TableHead className="w-28 text-right">GST Amt</TableHead>
            <TableHead className="w-28 text-right">Total</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            const baseAmount = item.quantity * item.price_per_unit
            const taxableAmt = baseAmount - item.discount_amount
            const inclRate = item.quantity > 0 ? (taxableAmt + item.tax_amount) / item.quantity : 0

            return (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="w-56 align-top whitespace-normal py-2">
                  <div className="w-full space-y-1">
                    <Input
                      value={item.item_name}
                      onChange={(e) => onUpdateItem(item.id, "item_name", e.target.value)}
                      placeholder="Item name"
                      className="h-8 w-full font-medium"
                    />
                    <Input
                      value={item.description}
                      onChange={(e) => onUpdateItem(item.id, "description", e.target.value)}
                      placeholder="Description"
                      className="h-7 w-full text-xs text-muted-foreground"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    value={item.hsn_code}
                    onChange={(e) => onUpdateItem(item.id, "hsn_code", e.target.value)}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={item.quantity}
                    onChange={(e) => onUpdateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                    className="h-8 text-center"
                  />
                </TableCell>
                <TableCell>
                  <Select value={item.unit} onValueChange={(v) => onUpdateItem(item.id, "unit", v)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price_per_unit || ""}
                    onChange={(e) => onUpdateItem(item.id, "price_per_unit", parseFloat(e.target.value) || 0)}
                    className="h-8 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inclRate.toFixed(2)}
                    onChange={(e) => {
                      const incl = Number(e.target.value) || 0
                      const discMult = 1 - (item.discount_percent || 0) / 100
                      const taxMult = 1 + (item.tax_percent || 0) / 100
                      const exclPrice = discMult * taxMult > 0 ? incl / (discMult * taxMult) : 0
                      onUpdateItem(item.id, "price_per_unit", exclPrice)
                    }}
                    className="h-8 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={item.discount_percent || ""}
                    onChange={(e) => onUpdateItem(item.id, "discount_percent", parseFloat(e.target.value) || 0)}
                    className="h-8 text-center"
                  />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  ₹{taxableAmt.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={item.tax_percent}
                    onChange={(e) => onUpdateItem(item.id, "tax_percent", parseFloat(e.target.value) || 0)}
                    className="h-8 text-center"
                  />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  ₹{item.tax_amount.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  ₹{item.amount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell colSpan={8} className="text-right">Subtotal:</TableCell>
            <TableCell className="text-right">₹{totals.taxable.toFixed(2)}</TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right">₹{totals.gst.toFixed(2)}</TableCell>
            <TableCell className="text-right">₹{totals.grand.toFixed(2)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
