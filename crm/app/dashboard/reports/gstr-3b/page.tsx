"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { FileText, Loader2, Receipt, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

export default function GSTR3BPage() {
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [outputTax, setOutputTax] = useState({ taxable: 0, cgst: 0, sgst: 0, igst: 0 })
  const [inputTax, setInputTax] = useState({ taxable: 0, cgst: 0, sgst: 0, igst: 0 })

  useEffect(() => { fetchData() }, [selectedMonth])

  const getNextMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-").map(Number)
    const nextDate = new Date(year, month, 1)
    return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const startDate = `${selectedMonth}-01`
      const endDate = getNextMonth(selectedMonth)

      // Output tax from sales
      const { data: sales } = await supabase
        .from("orders")
        .select("total_amount, cgst_amount, sgst_amount, igst_amount")
        .eq("is_gst_invoice", true)
        .gte("order_date", startDate)
        .lt("order_date", endDate)

      const out = (sales || []).reduce((acc, o) => ({
        taxable: acc.taxable + Number(o.total_amount || 0) - Number(o.cgst_amount || 0) - Number(o.sgst_amount || 0) - Number(o.igst_amount || 0),
        cgst: acc.cgst + Number(o.cgst_amount || 0),
        sgst: acc.sgst + Number(o.sgst_amount || 0),
        igst: acc.igst + Number(o.igst_amount || 0),
      }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 })
      setOutputTax(out)

      // Input tax from purchases
      const { data: purchases } = await supabase
        .from("purchases")
        .select("total_amount, cgst_amount, sgst_amount, igst_amount")
        .gte("purchase_date", startDate)
        .lt("purchase_date", endDate)

      const inp = (purchases || []).reduce((acc, p) => ({
        taxable: acc.taxable + Number(p.total_amount || 0) - Number(p.cgst_amount || 0) - Number(p.sgst_amount || 0) - Number(p.igst_amount || 0),
        cgst: acc.cgst + Number(p.cgst_amount || 0),
        sgst: acc.sgst + Number(p.sgst_amount || 0),
        igst: acc.igst + Number(p.igst_amount || 0),
      }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 })
      setInputTax(inp)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load GSTR-3B data")
    } finally { setLoading(false) }
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)

  const netCGST = outputTax.cgst - inputTax.cgst
  const netSGST = outputTax.sgst - inputTax.sgst
  const netIGST = outputTax.igst - inputTax.igst
  const totalLiability = Math.max(0, netCGST) + Math.max(0, netSGST) + Math.max(0, netIGST)

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("default", { month: "long", year: "numeric" }) }
  })

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">GSTR-3B Summary</h1>
        </div>
      </div>
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">GSTR-3B Summary</h1>
            <p className="text-sm text-muted-foreground">Monthly GST liability summary for filing</p>
          </div>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full md:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Net Liability */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Net GST Liability</CardTitle>
                <CardDescription className="mt-0.5">Output Tax − Input Tax Credit (ITC)</CardDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={`rounded-full self-start sm:self-auto ${
                totalLiability > 0
                  ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              }`}
            >
              {totalLiability > 0 ? "Payable" : "No Liability"}
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Net CGST", value: netCGST },
              { label: "Net SGST", value: netSGST },
              { label: "Net IGST", value: netIGST },
            ].map((t) => {
              const positive = t.value > 0
              return (
                <div
                  key={t.label}
                  className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t.label}
                    </div>
                    {positive ? (
                      <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </div>
                  <div className={`mt-2 text-2xl font-bold tabular-nums ${positive ? "text-red-600 dark:text-red-500" : "text-emerald-600 dark:text-emerald-500"}`}>
                    {formatCurrency(t.value)}
                  </div>
                </div>
              )
            })}
            <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Payable
                </div>
                <Wallet className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-red-600 dark:text-red-500">
                {formatCurrency(totalLiability)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3.1 Output Tax */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50">
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">3.1 — Outward Supplies (Output Tax)</CardTitle>
                <CardDescription className="mt-0.5">Tax on sales and outward supplies</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full self-start sm:self-auto bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              Tax Collected: {formatCurrency(outputTax.cgst + outputTax.sgst + outputTax.igst)}
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Description</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Taxable Value</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">CGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">SGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">IGST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="transition-colors hover:bg-muted/30">
                  <TableCell className="text-sm">Outward taxable supplies (other than zero rated, nil rated, exempted)</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(outputTax.taxable)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(outputTax.cgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(outputTax.sgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(outputTax.igst)}</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/60 hover:bg-muted/60 font-semibold">
                  <TableCell>Total Output Tax</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(outputTax.taxable)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(outputTax.cgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(outputTax.sgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(outputTax.igst)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 4. Input Tax Credit */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/50">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">4 — Eligible ITC (Input Tax Credit)</CardTitle>
                <CardDescription className="mt-0.5">Tax paid on purchases eligible for credit</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full self-start sm:self-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              ITC Available: {formatCurrency(inputTax.cgst + inputTax.sgst + inputTax.igst)}
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Description</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Taxable Value</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">CGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">SGST</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">IGST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="transition-colors hover:bg-muted/30">
                  <TableCell className="text-sm">All other ITC (from purchases)</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(inputTax.taxable)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(inputTax.cgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(inputTax.sgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(inputTax.igst)}</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/60 hover:bg-muted/60 font-semibold">
                  <TableCell>Total ITC Available</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(inputTax.taxable)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(inputTax.cgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(inputTax.sgst)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(inputTax.igst)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
