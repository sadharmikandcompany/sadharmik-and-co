"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { CreditCard, X, Loader2, Search, IndianRupee, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

type VendorAging = {
  vendor_id: string
  vendor_name: string
  current: number
  overdue_30: number
  overdue_60: number
  overdue_90: number
  overdue_90_plus: number
  total: number
}

export default function APAgingPage() {
  const [data, setData] = useState<VendorAging[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => { fetchAging() }, [])

  const fetchAging = async () => {
    setLoading(true)
    try {
      // Get unpaid/partially paid purchases
      const { data: purchases, error } = await supabase
        .from("purchases")
        .select("id, supplier_name, total_amount, purchase_date, payment_status, supplier_id")
        .in("payment_status", ["pending", "partial", "processing"])
        .order("purchase_date", { ascending: true })

      if (error) throw error

      const now = new Date()
      const vendorMap = new Map<string, VendorAging>()

      ;(purchases || []).forEach((p: any) => {
        const key = p.supplier_id || p.supplier_name || "Unknown"
        const existing = vendorMap.get(key) || {
          vendor_id: p.supplier_id || "",
          vendor_name: p.supplier_name || "Unknown",
          current: 0, overdue_30: 0, overdue_60: 0, overdue_90: 0, overdue_90_plus: 0, total: 0,
        }

        const daysOld = Math.floor((now.getTime() - new Date(p.purchase_date).getTime()) / (1000 * 60 * 60 * 24))
        const amount = Number(p.total_amount || 0)

        if (daysOld <= 30) existing.current += amount
        else if (daysOld <= 60) existing.overdue_30 += amount
        else if (daysOld <= 90) existing.overdue_60 += amount
        else if (daysOld <= 120) existing.overdue_90 += amount
        else existing.overdue_90_plus += amount

        existing.total += amount
        vendorMap.set(key, existing)
      })

      setData(Array.from(vendorMap.values()).sort((a, b) => b.total - a.total))
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)

  const filtered = data.filter(d => searchTerm === "" || d.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()))

  const totals = filtered.reduce((acc, d) => ({
    current: acc.current + d.current,
    overdue_30: acc.overdue_30 + d.overdue_30,
    overdue_60: acc.overdue_60 + d.overdue_60,
    overdue_90: acc.overdue_90 + d.overdue_90,
    overdue_90_plus: acc.overdue_90_plus + d.overdue_90_plus,
    total: acc.total + d.total,
  }), { current: 0, overdue_30: 0, overdue_60: 0, overdue_90: 0, overdue_90_plus: 0, total: 0 })

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <CreditCard className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Accounts Payable Aging</h1>
        </div>
      </div>
      <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Accounts Payable Aging</h1>
            <p className="text-sm text-muted-foreground">Vendor-wise outstanding payables by aging bucket</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Outstanding</CardDescription>
            <CardTitle className="text-xl font-bold tabular-nums">{formatCurrency(totals.total)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><IndianRupee className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All buckets</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Current (0-30)</CardDescription>
            <CardTitle className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{formatCurrency(totals.current)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500"><Clock className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Within terms</CardContent>
        </Card>
        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>31-60 Days</CardDescription>
            <CardTitle className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{formatCurrency(totals.overdue_30)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500"><Clock className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Mildly overdue</CardContent>
        </Card>
        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>61-90 Days</CardDescription>
            <CardTitle className="text-xl font-bold tabular-nums text-orange-600 dark:text-orange-500">{formatCurrency(totals.overdue_60)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500"><AlertTriangle className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Overdue</CardContent>
        </Card>
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>91-120 Days</CardDescription>
            <CardTitle className="text-xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{formatCurrency(totals.overdue_90)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500"><AlertTriangle className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Critical</CardContent>
        </Card>
        <Card className="h-full bg-rose-100/60 dark:bg-rose-950/30 border-rose-300/60 dark:border-rose-900/50">
          <CardHeader>
            <CardDescription>120+ Days</CardDescription>
            <CardTitle className="text-xl font-bold tabular-nums text-rose-700 dark:text-rose-400">{formatCurrency(totals.overdue_90_plus)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-200 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"><AlertTriangle className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Severely overdue</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-900/50">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Vendor-wise Aging</CardTitle>
                <CardDescription className="mt-0.5">Outstanding payables broken down by vendor</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full self-start sm:self-auto">{filtered.length} vendors</Badge>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search vendor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[260px] pl-8" />
            </div>
            {searchTerm && <Button variant="ghost" onClick={() => setSearchTerm("")} className="gap-2"><X className="h-4 w-4" />Clear</Button>}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Vendor</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Current (0-30)</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">31-60 Days</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">61-90 Days</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">91-120 Days</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">120+ Days</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">No outstanding payables</TableCell></TableRow>
                ) : filtered.map(row => (
                  <TableRow key={row.vendor_id || row.vendor_name} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">{row.vendor_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.current > 0 ? formatCurrency(row.current) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{row.overdue_30 > 0 ? formatCurrency(row.overdue_30) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-orange-600">{row.overdue_60 > 0 ? formatCurrency(row.overdue_60) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">{row.overdue_90 > 0 ? formatCurrency(row.overdue_90) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-700">{row.overdue_90_plus > 0 ? formatCurrency(row.overdue_90_plus) : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Grand Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.current)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.overdue_30)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.overdue_60)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.overdue_90)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.overdue_90_plus)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">{filtered.length} vendors with outstanding payables</div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
