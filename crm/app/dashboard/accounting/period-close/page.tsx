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
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Lock, Unlock, Plus, CalendarIcon, Loader2, AlertTriangle, CalendarRange, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type AccountingPeriod = {
  id: string
  period_name: string
  start_date: string
  end_date: string
  status: string
  closed_by: string | null
  closed_at: string | null
  created_at: string
}

export default function PeriodClosePage() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [loading, setLoading] = useState(true)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newPeriodName, setNewPeriodName] = useState("")
  const [newStartDate, setNewStartDate] = useState<Date | undefined>(undefined)
  const [newEndDate, setNewEndDate] = useState<Date | undefined>(undefined)

  const [isCloseOpen, setIsCloseOpen] = useState(false)
  const [closingPeriod, setClosingPeriod] = useState<AccountingPeriod | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => { fetchPeriods() }, [])

  const fetchPeriods = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("accounting_periods").select("*").order("start_date", { ascending: false })
    if (error) { toast.error("Failed to load periods"); setLoading(false); return }
    setPeriods(data || [])
    setLoading(false)
  }

  const handleAddPeriod = async () => {
    if (!newPeriodName || !newStartDate || !newEndDate) { toast.error("All fields required"); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from("accounting_periods").insert([{
        period_name: newPeriodName,
        start_date: format(newStartDate, "yyyy-MM-dd"),
        end_date: format(newEndDate, "yyyy-MM-dd"),
        status: "Open",
      }])
      if (error) throw error
      toast.success("Period created")
      setIsAddOpen(false)
      setNewPeriodName(""); setNewStartDate(undefined); setNewEndDate(undefined)
      fetchPeriods()
    } catch (error: any) {
      toast.error(error.message || "Failed to create period")
    } finally { setSubmitting(false) }
  }

  const handleClosePeriod = async () => {
    if (!closingPeriod) return
    setClosing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("accounting_periods")
        .update({ status: "Closed", closed_by: user?.id, closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", closingPeriod.id)
      if (error) throw error
      toast.success("Period closed successfully")
      setIsCloseOpen(false)
      setClosingPeriod(null)
      fetchPeriods()
    } catch (error: any) {
      toast.error(error.message || "Failed to close period")
    } finally { setClosing(false) }
  }

  const handleReopenPeriod = async (period: AccountingPeriod) => {
    const { error } = await supabase.from("accounting_periods")
      .update({ status: "Open", closed_by: null, closed_at: null, updated_at: new Date().toISOString() })
      .eq("id", period.id)
    if (error) { toast.error("Failed to reopen"); return }
    toast.success("Period reopened")
    fetchPeriods()
  }

  const openCount = periods.filter(p => p.status === "Open").length
  const closedCount = periods.filter(p => p.status === "Closed").length

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Accounting Period Management</h1>
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
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Accounting Period Management</h1>
            <p className="text-sm text-muted-foreground">Open and close accounting periods to control journal posting</p>
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Period</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Accounting Period</DialogTitle><DialogDescription>Define a new accounting period</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Period Name *</Label><Input value={newPeriodName} onChange={e => setNewPeriodName(e.target.value)} placeholder="e.g. April 2026" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{newStartDate ? format(newStartDate, "PPP") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newStartDate} onSelect={setNewStartDate} initialFocus /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newEndDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />{newEndDate ? format(newEndDate, "PPP") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newEndDate} onSelect={setNewEndDate} initialFocus /></PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddPeriod} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : <><Plus className="mr-2 h-4 w-4" />Create</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Close Confirmation */}
      <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-500" />Close Accounting Period</DialogTitle>
            <DialogDescription>Closing this period will prevent any new journal entries from being posted to dates within this range. Are you sure?</DialogDescription>
          </DialogHeader>
          {closingPeriod && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="font-medium">{closingPeriod.period_name}</div>
              <div className="text-sm text-muted-foreground">{new Date(closingPeriod.start_date).toLocaleDateString()} to {new Date(closingPeriod.end_date).toLocaleDateString()}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClosePeriod} disabled={closing}>
              {closing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Closing...</> : <><Lock className="mr-2 h-4 w-4" />Close Period</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Periods</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{periods.length}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><CalendarRange className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All defined periods</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Open</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{openCount}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500"><Unlock className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Accepting entries</CardContent>
        </Card>
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Closed</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{closedCount}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500"><Lock className="h-4 w-4" /></div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Locked from posting</CardContent>
        </Card>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">All Periods</CardTitle>
                <CardDescription className="mt-0.5">Manage open/close status of accounting periods</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full self-start sm:self-auto">{periods.length} periods</Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[800px] w-full">
              <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Period Name</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Start Date</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">End Date</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Closed At</TableHead>
                <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {periods.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">No accounting periods defined</TableCell></TableRow>
                ) : periods.map(period => (
                  <TableRow key={period.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">{period.period_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(period.start_date).toLocaleDateString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(period.end_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {period.status === "Open" ? (
                        <Badge className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Open</Badge>
                      ) : (
                        <Badge variant="destructive" className="rounded-full">Closed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{period.closed_at ? new Date(period.closed_at).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="text-right">
                      {period.status === "Open" ? (
                        <Button variant="outline" size="sm" onClick={() => { setClosingPeriod(period); setIsCloseOpen(true) }}>
                          <Lock className="mr-1 h-3 w-3" />Close
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => handleReopenPeriod(period)}>
                          <Unlock className="mr-1 h-3 w-3" />Reopen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
