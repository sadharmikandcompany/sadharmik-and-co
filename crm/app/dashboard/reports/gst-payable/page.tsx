"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Landmark, AlertCircle, TrendingUp, TrendingDown, Scale } from "lucide-react"
import { toast } from "sonner"
import { useUserRole } from "@/hooks/use-user-role"

// Roles that create their own sales/purchases and so have their own GST
// liability, separate from both Sadharmik & Company's company registration and the
// factory's registration.
const PERSONAL_VIEW_ROLES = ["main_distributor", "sub_distributor", "retailer"]

// The factory (Gujarat) and Sadharmik & Company the company (Maharashtra) are two
// separate GST registrations — their figures must never be combined.
type ViewMode = "company" | "factory" | "personal"

type GstBuckets = { igst: number; cgst: number; sgst: number }

const formatINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

const emptyBuckets = (): GstBuckets => ({ igst: 0, cgst: 0, sgst: 0 })

/**
 * GST set-off ordering (Task 3):
 *  - IGST credit → IGST first, then CGST, then SGST
 *  - CGST credit → CGST first, then IGST only (never SGST)
 *  - SGST credit → SGST first, then IGST only (never CGST)
 * Returns remaining output liability per bucket after applying all available ITC.
 */
function applySetOff(output: GstBuckets, itc: GstBuckets): GstBuckets {
  const remainingOutput = { ...output }
  let igstCredit = itc.igst
  let cgstCredit = itc.cgst
  let sgstCredit = itc.sgst

  // IGST credit: IGST -> CGST -> SGST
  const useIgstOnIgst = Math.min(igstCredit, remainingOutput.igst)
  remainingOutput.igst -= useIgstOnIgst
  igstCredit -= useIgstOnIgst
  const useIgstOnCgst = Math.min(igstCredit, remainingOutput.cgst)
  remainingOutput.cgst -= useIgstOnCgst
  igstCredit -= useIgstOnCgst
  const useIgstOnSgst = Math.min(igstCredit, remainingOutput.sgst)
  remainingOutput.sgst -= useIgstOnSgst
  igstCredit -= useIgstOnSgst

  // CGST credit: CGST -> IGST only
  const useCgstOnCgst = Math.min(cgstCredit, remainingOutput.cgst)
  remainingOutput.cgst -= useCgstOnCgst
  cgstCredit -= useCgstOnCgst
  const useCgstOnIgst = Math.min(cgstCredit, remainingOutput.igst)
  remainingOutput.igst -= useCgstOnIgst
  cgstCredit -= useCgstOnIgst

  // SGST credit: SGST -> IGST only
  const useSgstOnSgst = Math.min(sgstCredit, remainingOutput.sgst)
  remainingOutput.sgst -= useSgstOnSgst
  sgstCredit -= useSgstOnSgst
  const useSgstOnIgst = Math.min(sgstCredit, remainingOutput.igst)
  remainingOutput.igst -= useSgstOnIgst
  sgstCredit -= useSgstOnIgst

  return remainingOutput
}

function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

// Indian Fiscal Year runs April 1 → March 31. offset 0 = current FY, -1 = previous.
function getFiscalYearRange(offset: number) {
  const now = new Date()
  const currentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const startYear = currentFYStartYear + offset
  const start = new Date(startYear, 3, 1)
  const end = new Date(startYear + 1, 3, 1) // exclusive upper bound
  return { start, end, label: `FY ${startYear}-${String(startYear + 1).slice(-2)}` }
}

function currentFYStartYear() {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

// Quick-select buttons for every month for the given FY (Apr → Mar).
function fyMonthOptions(fyStartYear: number) {
  const options: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(fyStartYear, 3 + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    options.push({ value, label: d.toLocaleString("en-US", { month: "short", year: "numeric" }) })
  }
  return options
}

type FilterMode = "all" | "fy" | "month" | "custom"

export default function GstPayablePage() {
  const { role, userProfile } = useUserRole()
  const viewMode: ViewMode =
    role && PERSONAL_VIEW_ROLES.includes(role)
      ? "personal"
      : role === "factories"
        ? "factory"
        : "company"
  const isPersonalView = viewMode === "personal"
  const [filterMode, setFilterMode] = useState<FilterMode>("month")
  const [month, setMonth] = useState(currentMonthValue())
  const [fyOffset, setFyOffset] = useState(0)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [outputGst, setOutputGst] = useState<GstBuckets>(emptyBuckets())
  const [itc, setItc] = useState<GstBuckets>(emptyBuckets())
  const [outputOrderCount, setOutputOrderCount] = useState(0)
  const [itcOrderCount, setItcOrderCount] = useState(0)
  const [excludedExemptGst, setExcludedExemptGst] = useState(0)

  // Resolves the active filter into a date range for the query (null bounds
  // for "all") plus a human label shown on the cards below.
  const getSelectedRange = (): { fromIso: string | null; toIso: string | null; label: string } => {
    if (filterMode === "all") {
      return { fromIso: null, toIso: null, label: "all transactions till date" }
    }
    if (filterMode === "fy") {
      const { start, end, label } = getFiscalYearRange(fyOffset)
      return { fromIso: start.toISOString().slice(0, 10), toIso: end.toISOString().slice(0, 10), label }
    }
    if (filterMode === "custom") {
      if (!customFrom || !customTo) {
        return { fromIso: null, toIso: null, label: "custom range" }
      }
      const toExclusive = new Date(customTo + "T00:00:00")
      toExclusive.setDate(toExclusive.getDate() + 1)
      return {
        fromIso: customFrom,
        toIso: toExclusive.toISOString().slice(0, 10),
        label: `${customFrom} to ${customTo}`,
      }
    }
    // month
    const [year, mon] = month.split("-").map(Number)
    const fromDate = new Date(year, mon - 1, 1)
    const toDate = new Date(year, mon, 1)
    return {
      fromIso: fromDate.toISOString().slice(0, 10),
      toIso: toDate.toISOString().slice(0, 10),
      label: fromDate.toLocaleString("en-US", { month: "long", year: "numeric" }),
    }
  }

  useEffect(() => {
    // Personal view depends on knowing who "me" is first — wait for the
    // profile to load so we don't briefly fetch/show company-wide data.
    if (isPersonalView && !userProfile) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, month, fyOffset, customFrom, customTo, isPersonalView, userProfile])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { fromIso, toIso } = getSelectedRange()

      // ===== Output GST: GST-invoiced sales in the selected period =====
      // Cancelled orders are excluded — a cancelled invoice carries no actual
      // tax liability, even if it was originally raised as a GST invoice.
      let ordersQuery = supabase
        .from("orders")
        .select("cgst_amount, sgst_amount, igst_amount")
        .eq("is_gst_invoice", true)
        .neq("order_status", "cancelled")
      if (fromIso) ordersQuery = ordersQuery.gte("order_date", fromIso)
      if (toIso) ordersQuery = ordersQuery.lt("order_date", toIso)

      if (viewMode === "factory") {
        // Factory (Gujarat) sales only — created via Order from Factory.
        ordersQuery = ordersQuery.eq("is_factory_order", true)
      } else if (viewMode === "company") {
        // Company (Maharashtra) sales — everything that ISN'T a factory-direct
        // sale. These are two separate GST registrations, never combined.
        ordersQuery = ordersQuery.or("is_factory_order.eq.false,is_factory_order.is.null")
      } else if (userProfile) {
        // Personal view: only sales THIS user personally created, regardless
        // of who the buyer was — there's no "seller of record" column other
        // than created_by_user_id, so that's the source of truth here.
        ordersQuery = ordersQuery.eq("created_by_user_id", userProfile.id)
      }

      const { data: orders, error: ordersErr } = await ordersQuery

      if (ordersErr) throw ordersErr

      const output = emptyBuckets()
      ;(orders || []).forEach((o: any) => {
        output.cgst += parseFloat(String(o.cgst_amount)) || 0
        output.sgst += parseFloat(String(o.sgst_amount)) || 0
        output.igst += parseFloat(String(o.igst_amount)) || 0
      })
      setOutputGst(output)
      setOutputOrderCount((orders || []).length)

      // ===== ITC: purchase line items in the selected period, ITC-eligible only =====
      // Purchases (milk, packaging, etc.) are always received at the Gujarat
      // factory — there's no separate "company-only" purchase channel, so the
      // company (Maharashtra) view has no ITC of its own to show here.
      let itemsQuery = supabase
        .from("purchase_items")
        .select("purchase_id, cgst_amount, sgst_amount, igst_amount, is_itc_eligible, purchases!inner(purchase_date, created_by_user_id, distributor_id)")
      if (fromIso) itemsQuery = itemsQuery.gte("purchases.purchase_date", fromIso)
      if (toIso) itemsQuery = itemsQuery.lt("purchases.purchase_date", toIso)

      if (viewMode === "factory") {
        // Factory's own purchases only — exclude purchases made by a
        // distributor for their own stock (that's the distributor's ITC).
        itemsQuery = itemsQuery.is("purchases.distributor_id", null)
      } else if (viewMode === "personal" && userProfile) {
        itemsQuery = itemsQuery.eq("purchases.created_by_user_id", userProfile.id)
      }

      const { data: purchaseItems, error: itemsErr } =
        viewMode === "company" ? { data: [], error: null } : await itemsQuery

      if (itemsErr) throw itemsErr

      const credit = emptyBuckets()
      let excluded = 0
      // Counts distinct purchase ORDERS contributing ITC, not line items — a
      // single order can have several lines (or several loose entries), which
      // would otherwise inflate this above the actual number of purchases.
      const eligibleOrders = new Set<string>()
      ;(purchaseItems || []).forEach((item: any) => {
        const c = parseFloat(String(item.cgst_amount)) || 0
        const s = parseFloat(String(item.sgst_amount)) || 0
        const i = parseFloat(String(item.igst_amount)) || 0
        if (item.is_itc_eligible === false) {
          excluded += c + s + i
          return
        }
        credit.cgst += c
        credit.sgst += s
        credit.igst += i
        if (item.purchase_id) eligibleOrders.add(item.purchase_id)
      })

      // Loose (litre-based) purchases carry their own GST — they never get a
      // purchase_items row, so they're summed separately here. Factory-only,
      // like the rest of loose stock (no distributor_id column to scope by).
      if (viewMode === "factory") {
        let looseQuery = supabase
          .from("loose_stock_transactions")
          .select("id, purchase_id, cgst_amount, sgst_amount, igst_amount, is_itc_eligible")
          .eq("transaction_type", "purchase")
        if (fromIso) looseQuery = looseQuery.gte("transaction_date", fromIso)
        if (toIso) looseQuery = looseQuery.lt("transaction_date", toIso)

        const { data: looseTxns, error: looseErr } = await looseQuery
        if (looseErr) throw looseErr

        ;(looseTxns || []).forEach((txn: any) => {
          const c = parseFloat(String(txn.cgst_amount)) || 0
          const s = parseFloat(String(txn.sgst_amount)) || 0
          const i = parseFloat(String(txn.igst_amount)) || 0
          if (txn.is_itc_eligible === false) {
            excluded += c + s + i
            return
          }
          credit.cgst += c
          credit.sgst += s
          credit.igst += i
          // Standalone loose purchases (no purchase_id) each count as their
          // own order, same as they appear as their own row on the Purchases page.
          eligibleOrders.add(txn.purchase_id || txn.id)
        })
      }

      setItc(credit)
      setItcOrderCount(eligibleOrders.size)
      setExcludedExemptGst(excluded)
    } catch (error) {
      console.error("Error fetching GST payable data:", error)
      toast.error("Failed to load GST payable data")
    } finally {
      setLoading(false)
    }
  }

  const netPayable = applySetOff(outputGst, itc)
  const totalOutput = outputGst.igst + outputGst.cgst + outputGst.sgst
  const totalItc = itc.igst + itc.cgst + itc.sgst
  const totalNetPayable = netPayable.igst + netPayable.cgst + netPayable.sgst
  const periodLabel = getSelectedRange().label

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 shrink-0">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {viewMode === "personal"
              ? "Your Estimated GST Payable"
              : viewMode === "factory"
                ? "Factory (Gujarat) Estimated GST Payable"
                : "Company (Maharashtra) Estimated GST Payable"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === "personal"
              ? "Output GST minus Input Tax Credit on your own sales and purchases, for the selected period"
              : viewMode === "factory"
                ? "Output GST minus Input Tax Credit on the factory's own sales and purchases, for the selected period"
                : "Output GST minus Input Tax Credit on Sadharmik & Company's company-wide sales, for the selected period"}
          </p>
        </div>
      </div>

      {viewMode === "company" && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            This shows the company&apos;s own sales only — it does not include the
            factory&apos;s Gujarat-registered GST, which is a separate filing. See
            "Factory (Gujarat)" for that.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          This is an <strong>estimate</strong> computed from {isPersonalView ? "your own" : "the relevant"} sales and purchase
          records. The actual amount payable depends on {isPersonalView ? "you and your suppliers" : "the relevant parties"} correctly filing
          {isPersonalView ? " your respective" : " their own"} GST returns, reconciled via GSTR-2B — figures here may differ from
          what the government portal ultimately shows.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={filterMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("all")}
            >
              All Transactions
            </Button>
            <Button
              type="button"
              variant={filterMode === "fy" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("fy")}
            >
              Fiscal Year
            </Button>
            <Button
              type="button"
              variant={filterMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("month")}
            >
              Month
            </Button>
            <Button
              type="button"
              variant={filterMode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("custom")}
            >
              Custom Range
            </Button>
          </div>

          {filterMode === "fy" && (
            <div className="max-w-xs space-y-2">
              <Label htmlFor="fy_select">Select fiscal year</Label>
              <Select value={String(fyOffset)} onValueChange={(v) => setFyOffset(Number(v))}>
                <SelectTrigger id="fy_select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, -1, -2, -3].map((offset) => (
                    <SelectItem key={offset} value={String(offset)}>
                      {getFiscalYearRange(offset).label}
                      {offset === 0 ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {filterMode === "month" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {fyMonthOptions(currentFYStartYear()).map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={month === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMonth(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="month">Or pick any month</Label>
                <Input
                  id="month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
            </div>
          )}

          {filterMode === "custom" && (
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom_from">From</Label>
                <Input
                  id="custom_from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom_to">To</Label>
                <Input
                  id="custom_to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-rose-600" />
                  Output GST
                </CardTitle>
                <CardDescription>{outputOrderCount} GST invoice{outputOrderCount === 1 ? "" : "s"} · {periodLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="font-medium">{formatINR(outputGst.igst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="font-medium">{formatINR(outputGst.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="font-medium">{formatINR(outputGst.sgst)}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold"><span>Total</span><span>{formatINR(totalOutput)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                  Input Tax Credit
                </CardTitle>
                <CardDescription>{itcOrderCount} eligible purchase order{itcOrderCount === 1 ? "" : "s"} · {periodLabel}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="font-medium">{formatINR(itc.igst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="font-medium">{formatINR(itc.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="font-medium">{formatINR(itc.sgst)}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold"><span>Total</span><span>{formatINR(totalItc)}</span></div>
                {excludedExemptGst > 0 && (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    {formatINR(excludedExemptGst)} excluded from purchases marked ITC-ineligible (e.g. exempt milk).
                  </p>
                )}
                {viewMode === "company" && (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Purchases are received at the Gujarat factory, not the company —
                    see "Factory (Gujarat)" for ITC.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  Net GST Payable
                </CardTitle>
                <CardDescription>After ITC set-off (IGST→CGST→SGST rules applied)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="font-medium">{formatINR(netPayable.igst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="font-medium">{formatINR(netPayable.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="font-medium">{formatINR(netPayable.sgst)}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatINR(totalNetPayable)}</span></div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
