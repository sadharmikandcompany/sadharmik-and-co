"use client"

import { useState } from "react"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { FileSearch, Upload, AlertCircle, CheckCircle, BookOpen, FileText, CheckCircle2, XCircle } from "lucide-react"

export default function GSTR2BReconciliationPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("default", { month: "long", year: "numeric" }) }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileSearch className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">GSTR-2B Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Match ITC claimed vs vendor GSTR-1 filings</p>
          </div>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full md:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>ITC as per Books</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">-</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BookOpen className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">From purchase records</CardContent>
        </Card>

        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>ITC as per 2B</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">-</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <FileText className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">From GSTN portal</CardContent>
        </Card>

        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Matched</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">-</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Reconciled entries</CardContent>
        </Card>

        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Mismatches</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">-</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <XCircle className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Need review</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Import GSTR-2B Data</CardTitle><CardDescription>Upload the GSTR-2B JSON or CSV file downloaded from the GST portal to begin reconciliation</CardDescription></CardHeader>
        <CardContent>
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Upload GSTR-2B File</p>
            <p className="text-sm text-muted-foreground mt-2">Supported formats: JSON, CSV (as downloaded from NIC portal)</p>
            <Button className="mt-4" variant="outline"><Upload className="mr-2 h-4 w-4" />Choose File</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reconciliation Process</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">1</div>
              <div><div className="font-medium">Download GSTR-2B</div><p className="text-sm text-muted-foreground">Log into the GST portal and download GSTR-2B for the selected period</p></div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">2</div>
              <div><div className="font-medium">Upload to System</div><p className="text-sm text-muted-foreground">Upload the JSON/CSV file using the upload area above</p></div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">3</div>
              <div><div className="font-medium">Auto-Match</div><p className="text-sm text-muted-foreground">System will match vendor invoices from purchases against GSTR-2B entries by GSTIN and invoice number</p></div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">4</div>
              <div><div className="font-medium">Review Mismatches</div><p className="text-sm text-muted-foreground">Review and resolve any mismatches — missing in 2B, amount differences, or GSTIN errors</p></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
