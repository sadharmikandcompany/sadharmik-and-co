"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Loader2, Receipt, IndianRupee, Filter as FilterIcon, Building2, Users, Download } from "lucide-react"
import { toast } from "sonner"
import { exportGSTR1Excel } from "@/lib/gstr1-export"

type GSTREntry = {
  invoice_number: string
  invoice_date: string
  customer_name: string
  gstin: string | null
  state: string | null
  taxable_value: number
  cgst: number
  sgst: number
  igst: number
  total: number
  hsn: string | null
  is_b2b: boolean
}

export default function GSTR1Page() {
  const [entries, setEntries] = useState<GSTREntry[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const filename = await exportGSTR1Excel({
        selectedMonth,
        companyGstin: process.env.NEXT_PUBLIC_COMPANY_GSTIN || "",
        companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "",
      })
      toast.success(`Exported ${filename}`)
    } catch (err: any) {
      const msg = err?.message || err?.error_description || err?.details || (typeof err === "string" ? err : JSON.stringify(err))
      console.error("Export failed:", msg, err)
      toast.error(`Export failed: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { fetchData() }, [selectedMonth])

  const fetchData = async () => {
    setLoading(true)
    try {
      // First try tax_ledger
      const { data: taxData, error: taxError } = await supabase
        .from("tax_ledger")
        .select("*")
        .eq("txn_type", "sale")
        .gte("txn_date", `${selectedMonth}-01`)
        .lt("txn_date", getNextMonth(selectedMonth))
        .order("txn_date", { ascending: true })

      if (!taxError && taxData && taxData.length > 0) {
        const mapped: GSTREntry[] = taxData.map(t => ({
          invoice_number: t.invoice_number || "",
          invoice_date: t.txn_date,
          customer_name: t.party_name || "",
          gstin: t.gstin,
          state: t.state_code,
          taxable_value: Number(t.taxable_value),
          cgst: Number(t.cgst_amount),
          sgst: Number(t.sgst_amount),
          igst: Number(t.igst_amount),
          total: Number(t.taxable_value) + Number(t.total_tax),
          hsn: t.hsn,
          is_b2b: t.is_b2b || false,
        }))
        setEntries(mapped)
        setLoading(false)
        return
      }

      // Fallback to orders
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("is_gst_invoice", true)
        .gte("order_date", `${selectedMonth}-01`)
        .lt("order_date", getNextMonth(selectedMonth))
        .order("order_date", { ascending: true })

      const mapped: GSTREntry[] = (orders || []).map(o => ({
        invoice_number: o.invoice_number_gst || o.order_number || "",
        invoice_date: o.order_date,
        customer_name: o.customer_name || o.customer_full_name || "",
        gstin: o.customer_gst_number || null,
        state: o.shipping_state || null,
        taxable_value: Number(o.total_amount || 0) - Number(o.cgst_amount || 0) - Number(o.sgst_amount || 0) - Number(o.igst_amount || 0),
        cgst: Number(o.cgst_amount || 0),
        sgst: Number(o.sgst_amount || 0),
        igst: Number(o.igst_amount || 0),
        total: Number(o.total_amount || 0),
        hsn: null,
        is_b2b: !!o.customer_gst_number,
      }))
      setEntries(mapped)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load GSTR-1 data")
    } finally { setLoading(false) }
  }

  const getNextMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-").map(Number)
    const nextDate = new Date(year, month, 1)
    return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)

  const b2bEntries = entries.filter(e => e.is_b2b)
  const b2cEntries = entries.filter(e => !e.is_b2b)

  const totalTaxable = entries.reduce((s, e) => s + e.taxable_value, 0)
  const totalCGST = entries.reduce((s, e) => s + e.cgst, 0)
  const totalSGST = entries.reduce((s, e) => s + e.sgst, 0)
  const totalIGST = entries.reduce((s, e) => s + e.igst, 0)

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("default", { month: "long", year: "numeric" }) }
  })

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">GSTR-1 Report</h1>
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">GSTR-1 Report</h1>
            <p className="text-sm text-muted-foreground">Outward supplies for GST filing</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full md:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={exporting || entries.length === 0} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Exporting..." : "Export Excel"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Invoices</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{entries.length.toLocaleString()}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Receipt className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">For the period</CardContent>
        </Card>

        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Taxable Value</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{formatCurrency(totalTaxable)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Pre-tax</CardContent>
        </Card>

        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>CGST</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{formatCurrency(totalCGST)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Receipt className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Central GST</CardContent>
        </Card>

        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>SGST</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">{formatCurrency(totalSGST)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Receipt className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">State GST</CardContent>
        </Card>

        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>IGST</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{formatCurrency(totalIGST)}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <Receipt className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Integrated GST</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="b2b">
        <TabsList className="flex-wrap h-auto"><TabsTrigger value="b2b">B2B Invoices ({b2bEntries.length})</TabsTrigger><TabsTrigger value="b2c">B2C Invoices ({b2cEntries.length})</TabsTrigger></TabsList>

        <TabsContent value="b2b">
          <div className="w-full min-w-0 max-w-full">
          <Card className="w-full max-w-full overflow-hidden">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">B2B — Business to Business</CardTitle>
                    <CardDescription className="mt-0.5">Invoices with registered GSTIN</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
                  {b2bEntries.length} {b2bEntries.length === 1 ? "invoice" : "invoices"}
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <div className="w-full max-w-full overflow-x-auto">
                <Table className="min-w-[1000px] w-max">
                  <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Invoice #</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Customer</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">GSTIN</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Taxable</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">CGST</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">SGST</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">IGST</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {b2bEntries.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No B2B invoices</TableCell></TableRow>
                    : b2bEntries.map((e, i) => (
                      <TableRow key={i} className="transition-colors hover:bg-muted/30">
                        <TableCell className="font-mono text-sm font-medium">{e.invoice_number}</TableCell>
                        <TableCell className="text-sm">{new Date(e.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>{e.customer_name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{e.gstin}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(e.taxable_value)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{e.cgst > 0 ? formatCurrency(e.cgst) : "-"}</TableCell>
                        <TableCell className="text-right tabular-nums text-blue-600 dark:text-blue-400">{e.sgst > 0 ? formatCurrency(e.sgst) : "-"}</TableCell>
                        <TableCell className="text-right tabular-nums text-violet-600 dark:text-violet-400">{e.igst > 0 ? formatCurrency(e.igst) : "-"}</TableCell>
                        <TableCell className="text-right tabular-nums font-bold">{formatCurrency(e.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="b2c">
          <div className="w-full min-w-0 max-w-full">
          <Card className="w-full max-w-full overflow-hidden">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/50">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">B2C — Business to Consumer</CardTitle>
                    <CardDescription className="mt-0.5">Invoices without GSTIN</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
                  {b2cEntries.length} {b2cEntries.length === 1 ? "invoice" : "invoices"}
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <div className="w-full max-w-full overflow-x-auto">
                <Table className="min-w-[1000px] w-max">
                  <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Invoice #</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Customer</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">State</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Taxable</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">CGST</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">SGST</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">IGST</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {b2cEntries.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No B2C invoices</TableCell></TableRow>
                    : b2cEntries.map((e, i) => (
                      <TableRow key={i} className="transition-colors hover:bg-muted/30">
                        <TableCell className="font-mono text-sm font-medium">{e.invoice_number}</TableCell>
                        <TableCell className="text-sm">{new Date(e.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>{e.customer_name}</TableCell>
                        <TableCell className="text-sm">{e.state || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(e.taxable_value)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{e.cgst > 0 ? formatCurrency(e.cgst) : "-"}</TableCell>
                        <TableCell className="text-right tabular-nums text-blue-600 dark:text-blue-400">{e.sgst > 0 ? formatCurrency(e.sgst) : "-"}</TableCell>
                        <TableCell className="text-right tabular-nums text-violet-600 dark:text-violet-400">{e.igst > 0 ? formatCurrency(e.igst) : "-"}</TableCell>
                        <TableCell className="text-right tabular-nums font-bold">{formatCurrency(e.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
