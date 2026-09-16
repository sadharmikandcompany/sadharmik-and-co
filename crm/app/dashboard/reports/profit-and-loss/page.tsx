"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarIcon, Loader2, FileText, Printer, ChevronDown, ChevronRight, TrendingUp, TrendingDown, IndianRupee, ShoppingBag, Receipt, Scale, BookOpen, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { isOldGstConvention, splitItemGst } from "@/lib/purchase-item-gst"

type ProfitLossData = {
  // Trading Account - Debit side
  openingStock: number
  purchases: number
  purchaseGST: number
  directExpenses: number
  // Non-material purchases (purchase_category = direct_expense/indirect_expense)
  // excluded from `purchases` above and shown as their own line instead —
  // same GST bill Tally would show in Total Purchase, bifurcated here.
  directExpensePurchases: number
  indirectExpensePurchases: number
  // Trading Account - Credit side
  sales: number
  salesGST: number
  closingStock: number
  // P&L Account - Expenses
  expensesByType: Record<string, number>
  totalIndirectExpenses: number
  // P&L Account - Income
  otherIncome: number
}

type CollapsibleSection = {
  tradingDebit: boolean
  tradingCredit: boolean
  plExpenses: boolean
  plIncome: boolean
}

const FINANCIAL_YEARS = () => {
  const currentYear = new Date().getFullYear()
  const years: { label: string; startDate: string; endDate: string }[] = []
  for (let i = 0; i < 5; i++) {
    const startYear = currentYear - i
    const endYear = startYear + 1
    years.push({
      label: `${startYear}-${endYear}`,
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    })
  }
  return years
}

export default function ProfitAndLossPage() {
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const now = new Date()
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    return new Date(year, 3, 1) // April 1st
  })
  const [dateTo, setDateTo] = useState<Date>(new Date())
  const [selectedFY, setSelectedFY] = useState<string>("")
  const [data, setData] = useState<ProfitLossData>({
    openingStock: 0,
    purchases: 0,
    purchaseGST: 0,
    directExpenses: 0,
    directExpensePurchases: 0,
    indirectExpensePurchases: 0,
    sales: 0,
    salesGST: 0,
    closingStock: 0,
    expensesByType: {},
    totalIndirectExpenses: 0,
    otherIncome: 0,
  })
  const [expanded, setExpanded] = useState<CollapsibleSection>({
    tradingDebit: true,
    tradingCredit: true,
    plExpenses: true,
    plIncome: true,
  })

  // Set initial financial year
  useEffect(() => {
    const now = new Date()
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    setSelectedFY(`${year}-${year + 1}`)
  }, [])

  const handleFYChange = (fy: string) => {
    setSelectedFY(fy)
    const years = FINANCIAL_YEARS()
    const selected = years.find(y => y.label === fy)
    if (selected) {
      setDateFrom(new Date(selected.startDate))
      setDateTo(new Date(selected.endDate))
    }
  }

  const fetchProfitLossData = useCallback(async () => {
    setLoading(true)
    const fromStr = format(dateFrom, "yyyy-MM-dd")
    const toStr = format(dateTo, "yyyy-MM-dd")

    try {
      const [ordersResult, purchasesResult, expensesResult, stockResult] = await Promise.all([
        // Sales data
        supabase
          .from("orders")
          .select("total_amount, cgst_amount, sgst_amount, igst_amount, order_status")
          .gte("order_date", fromStr)
          .lte("order_date", toStr),
        // Purchases data
        supabase
          .from("purchases")
          .select("id, subtotal, total_amount, gst_amount, cgst_amount, sgst_amount, igst_amount, purchase_category")
          .gte("purchase_date", fromStr)
          .lte("purchase_date", toStr),
        // Expenses data
        supabase
          .from("expenses")
          .select("amount, expense_type")
          .gte("expense_date", fromStr)
          .lte("expense_date", toStr),
        // Current stock for closing stock value
        supabase
          .from("warehouse_stock")
          .select("quantity, purchase_price"),
      ])

      const orders = ordersResult.data || []
      const purchases = purchasesResult.data || []
      const expenses = expensesResult.data || []
      const stock = stockResult.data || []

      // Sales
      const totalSales = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
      const totalSalesGST = orders.reduce((sum, o) =>
        sum + Number(o.cgst_amount || 0) + Number(o.sgst_amount || 0) + Number(o.igst_amount || 0), 0)
      const netSales = totalSales - totalSalesGST

      // Purchases — only material (stock) purchases count toward Total
      // Purchase/COGS. Non-material purchases (direct_expense/indirect_expense)
      // are excluded here and booked as expenses instead, below.
      // "fixed_asset" purchases are capitalized — deliberately excluded from
      // every bucket here, they belong on the Balance Sheet, not the P&L.
      const materialPurchases = purchases.filter(p => (p.purchase_category || "material") === "material")
      const nonMaterialPurchases = purchases.filter(p => (p.purchase_category || "material") !== "material")

      const totalPurchases = materialPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0)
      const totalPurchaseGST = materialPurchases.reduce((sum, p) =>
        sum + Number(p.cgst_amount || 0) + Number(p.sgst_amount || 0) + Number(p.igst_amount || 0), 0)
      const netPurchases = totalPurchases - totalPurchaseGST

      // Non-material purchases are bucketed by LINE ITEM, not by the whole
      // invoice — a single voucher can mix a Direct Expense line ("RO
      // Material Purchase") with an Indirect Expense line ("Transportation"),
      // each overriding purchase_items.purchase_category independently (see
      // add_purchase_item_category.sql). Booked net of GST (taxable value),
      // matching how material/COGS is netted below — using the item's own
      // STORED gst_amount via splitItemGst(), not gst_percentage, since some
      // purchases predate the GST-inclusive→exclusive rate fix and recomputing
      // from the percentage would double-count GST on those (see
      // lib/purchase-item-gst.ts). "other" folds into indirect so it's still
      // accounted for; "fixed_asset" is excluded (capitalized, not expensed).
      const nonMaterialPurchaseById = new Map(nonMaterialPurchases.map(p => [p.id, p]))
      let directExpensePurchasesTotal = 0
      let indirectExpensePurchasesTotal = 0
      if (nonMaterialPurchases.length > 0) {
        const { data: nonMaterialItems } = await supabase
          .from("purchase_items")
          .select("purchase_id, total, gst_amount, purchase_category")
          .in("purchase_id", nonMaterialPurchases.map(p => p.id))
        ;(nonMaterialItems || []).forEach((item: any) => {
          const purchase = nonMaterialPurchaseById.get(item.purchase_id)
          if (!purchase) return
          const category = item.purchase_category || purchase.purchase_category || "indirect_expense"
          const { taxable } = splitItemGst(item, isOldGstConvention(purchase))
          if (category === "direct_expense") directExpensePurchasesTotal += taxable
          else if (category === "fixed_asset") {
            // capitalized — excluded from the P&L
          } else {
            // indirect_expense or other
            indirectExpensePurchasesTotal += taxable
          }
        })
      }

      // Expenses grouped by type
      const expensesByType: Record<string, number> = {}
      let directExpenseTotal = 0
      let indirectExpenseTotal = 0

      const directExpenseTypes = ["freight", "shipping", "transport", "loading", "unloading", "packaging"]

      expenses.forEach(e => {
        const type = e.expense_type || "Other"
        const amount = Number(e.amount || 0)
        expensesByType[type] = (expensesByType[type] || 0) + amount

        if (directExpenseTypes.some(d => type.toLowerCase().includes(d))) {
          directExpenseTotal += amount
        } else {
          indirectExpenseTotal += amount
        }
      })

      // Closing stock
      const closingStock = stock.reduce((sum, s) =>
        sum + (Number(s.quantity || 0) * Number(s.purchase_price || 0)), 0)

      setData({
        openingStock: 0,
        purchases: netPurchases,
        purchaseGST: totalPurchaseGST,
        directExpenses: directExpenseTotal + directExpensePurchasesTotal,
        directExpensePurchases: directExpensePurchasesTotal,
        indirectExpensePurchases: indirectExpensePurchasesTotal,
        sales: netSales,
        salesGST: totalSalesGST,
        closingStock,
        expensesByType,
        totalIndirectExpenses: indirectExpenseTotal + indirectExpensePurchasesTotal,
        otherIncome: 0,
      })
    } catch (error) {
      console.error("Error fetching P&L data:", error)
      toast.error("Failed to fetch profit & loss data")
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchProfitLossData()
  }, [fetchProfitLossData])

  const formatAmount = (amount: number) => {
    if (amount === 0) return ""
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Math.abs(amount))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const toggleSection = (section: keyof CollapsibleSection) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Trading Account calculations
  const tradingDebitTotal = data.openingStock + data.purchases + data.directExpenses
  const tradingCreditTotal = data.sales + data.closingStock
  const grossProfit = tradingCreditTotal - tradingDebitTotal
  const grossLoss = grossProfit < 0 ? Math.abs(grossProfit) : 0
  const grossProfitPositive = grossProfit > 0 ? grossProfit : 0

  // P&L Account calculations
  const plDebitTotal = data.totalIndirectExpenses + (grossLoss > 0 ? grossLoss : 0)
  const plCreditTotal = (grossProfitPositive > 0 ? grossProfitPositive : 0) + data.otherIncome
  const netProfit = plCreditTotal - plDebitTotal
  const netLoss = netProfit < 0 ? Math.abs(netProfit) : 0
  const netProfitPositive = netProfit > 0 ? netProfit : 0

  // Get indirect expenses (non-direct)
  const directExpenseTypes = ["freight", "shipping", "transport", "loading", "unloading", "packaging"]
  const indirectExpenses = Object.entries(data.expensesByType).filter(
    ([type]) => !directExpenseTypes.some(d => type.toLowerCase().includes(d))
  )
  const directExpenses = Object.entries(data.expensesByType).filter(
    ([type]) => directExpenseTypes.some(d => type.toLowerCase().includes(d))
  )

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <FileText className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Profit & Loss Account</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Profit & Loss Account</h1>
            <p className="text-sm text-muted-foreground">
              Trading and Profit & Loss statement ({format(dateFrom, "dd-MMM-yyyy")} to {format(dateTo, "dd-MMM-yyyy")})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Select value={selectedFY} onValueChange={handleFYChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Financial Year" />
            </SelectTrigger>
            <SelectContent>
              {FINANCIAL_YEARS().map(fy => (
                <SelectItem key={fy.label} value={fy.label}>
                  FY {fy.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateFrom, "dd-MMM-yy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateTo, "dd-MMM-yy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Trading Account */}
      <Card className="overflow-hidden border py-0 print:border print:shadow-none">
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 border-b px-5 py-4 print:bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 print:hidden">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h2 className="text-base md:text-lg font-bold uppercase tracking-wide">Sadharmik & Company</h2>
                <p className="text-sm font-semibold text-primary">Trading Account</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:text-right">
              {format(dateFrom, "dd-MMMM-yyyy")} to {format(dateTo, "dd-MMMM-yyyy")}
            </p>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-border min-h-[300px]">
            {/* LEFT - Trading Debit (Expenses) */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 bg-rose-50/60 dark:bg-rose-950/15 px-4 py-2.5 border-b font-bold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-400 print:bg-white">
                <ArrowUpRight className="h-3.5 w-3.5 print:hidden" />
                Particulars (Dr.)
              </div>
              <div className="flex-1 text-sm">
                <button
                  onClick={() => toggleSection("tradingDebit")}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors border-b border-foreground/10 cursor-pointer"
                >
                  <div className="flex items-center gap-1 font-semibold">
                    {expanded.tradingDebit ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Cost of Goods
                  </div>
                  <span className="font-mono font-semibold">{formatAmount(tradingDebitTotal)}</span>
                </button>
                {expanded.tradingDebit && (
                  <div className="border-b border-foreground/10">
                    {data.openingStock > 0 && (
                      <div className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                        <span>Opening Stock</span>
                        <span className="font-mono">{formatAmount(data.openingStock)}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                      <span>Purchases (Net)</span>
                      <span className="font-mono">{formatAmount(data.purchases)}</span>
                    </div>
                    {data.directExpensePurchases > 0 && (
                      <div className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                        <span>Purchases (Direct Expense)</span>
                        <span className="font-mono">{formatAmount(data.directExpensePurchases)}</span>
                      </div>
                    )}
                    {directExpenses.map(([type, amount]) => (
                      <div key={type} className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                        <span>{type}</span>
                        <span className="font-mono">{formatAmount(amount)}</span>
                      </div>
                    ))}
                    {data.directExpenses - data.directExpensePurchases > 0 && directExpenses.length === 0 && (
                      <div className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                        <span>Direct Expenses</span>
                        <span className="font-mono">{formatAmount(data.directExpenses - data.directExpensePurchases)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Gross Profit (if profit) */}
                {grossProfitPositive > 0 && (
                  <div className="flex justify-between px-4 py-2 font-semibold text-green-600 dark:text-green-400 border-t border-foreground/10">
                    <span className="pl-4 italic">Gross Profit c/d</span>
                    <span className="font-mono">{formatAmount(grossProfitPositive)}</span>
                  </div>
                )}
              </div>

              <div className="mt-auto border-t bg-muted/40 px-4 py-2.5 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="font-mono tabular-nums">{formatAmount(Math.max(tradingDebitTotal + grossProfitPositive, tradingCreditTotal + grossLoss))}</span>
              </div>
            </div>

            {/* RIGHT - Trading Credit (Income) */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 bg-emerald-50/60 dark:bg-emerald-950/15 px-4 py-2.5 border-b font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 print:bg-white">
                <ArrowDownLeft className="h-3.5 w-3.5 print:hidden" />
                Particulars (Cr.)
              </div>
              <div className="flex-1 text-sm">
                <button
                  onClick={() => toggleSection("tradingCredit")}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors border-b border-foreground/10 cursor-pointer"
                >
                  <div className="flex items-center gap-1 font-semibold">
                    {expanded.tradingCredit ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Revenue
                  </div>
                  <span className="font-mono font-semibold">{formatAmount(tradingCreditTotal)}</span>
                </button>
                {expanded.tradingCredit && (
                  <div className="border-b border-foreground/10">
                    <div className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                      <span>Sales (Net)</span>
                      <span className="font-mono">{formatAmount(data.sales)}</span>
                    </div>
                    {data.closingStock > 0 && (
                      <div className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                        <span>Closing Stock</span>
                        <span className="font-mono">{formatAmount(data.closingStock)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Gross Loss (if loss) */}
                {grossLoss > 0 && (
                  <div className="flex justify-between px-4 py-2 font-semibold text-red-600 dark:text-red-400 border-t border-foreground/10">
                    <span className="pl-4 italic">Gross Loss c/d</span>
                    <span className="font-mono">{formatAmount(grossLoss)}</span>
                  </div>
                )}
              </div>

              <div className="mt-auto border-t bg-muted/40 px-4 py-2.5 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="font-mono tabular-nums">{formatAmount(Math.max(tradingDebitTotal + grossProfitPositive, tradingCreditTotal + grossLoss))}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit & Loss Account */}
      <Card className="overflow-hidden border py-0 print:border print:shadow-none">
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 border-b px-5 py-4 print:bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 print:hidden">
                <Scale className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-primary">Profit & Loss Account</p>
            </div>
            <p className="text-xs text-muted-foreground sm:text-right">
              {format(dateFrom, "dd-MMMM-yyyy")} to {format(dateTo, "dd-MMMM-yyyy")}
            </p>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-border min-h-[300px]">
            {/* LEFT - P&L Debit (Expenses) */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 bg-rose-50/60 dark:bg-rose-950/15 px-4 py-2.5 border-b font-bold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-400 print:bg-white">
                <ArrowUpRight className="h-3.5 w-3.5 print:hidden" />
                Expenses (Dr.)
              </div>
              <div className="flex-1 text-sm">
                {/* Gross Loss brought forward */}
                {grossLoss > 0 && (
                  <div className="flex justify-between px-4 py-2 font-semibold text-red-600 dark:text-red-400 border-b border-foreground/10">
                    <span className="pl-4 italic">Gross Loss b/d</span>
                    <span className="font-mono">{formatAmount(grossLoss)}</span>
                  </div>
                )}

                {/* Indirect Expenses */}
                <button
                  onClick={() => toggleSection("plExpenses")}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors border-b border-foreground/10 cursor-pointer"
                >
                  <div className="flex items-center gap-1 font-semibold">
                    {expanded.plExpenses ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Indirect Expenses
                  </div>
                  <span className="font-mono font-semibold">{formatAmount(data.totalIndirectExpenses)}</span>
                </button>
                {expanded.plExpenses && (indirectExpenses.length > 0 || data.indirectExpensePurchases > 0) && (
                  <div className="border-b border-foreground/10">
                    {data.indirectExpensePurchases > 0 && (
                      <div className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                        <span>Purchases (Indirect Expense)</span>
                        <span className="font-mono">{formatAmount(data.indirectExpensePurchases)}</span>
                      </div>
                    )}
                    {indirectExpenses.map(([type, amount]) => (
                      <div key={type} className="flex justify-between px-4 py-1.5 pl-10 text-muted-foreground">
                        <span>{type}</span>
                        <span className="font-mono">{formatAmount(amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Net Profit */}
                {netProfitPositive > 0 && (
                  <div className="flex justify-between px-4 py-2 font-semibold text-green-600 dark:text-green-400 border-t border-foreground/10">
                    <span className="pl-4 italic">Net Profit</span>
                    <span className="font-mono">{formatAmount(netProfitPositive)}</span>
                  </div>
                )}
              </div>

              <div className="mt-auto border-t bg-muted/40 px-4 py-2.5 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatAmount(Math.max(plDebitTotal + netProfitPositive, plCreditTotal + netLoss))}
                </span>
              </div>
            </div>

            {/* RIGHT - P&L Credit (Income) */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 bg-emerald-50/60 dark:bg-emerald-950/15 px-4 py-2.5 border-b font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 print:bg-white">
                <ArrowDownLeft className="h-3.5 w-3.5 print:hidden" />
                Income (Cr.)
              </div>
              <div className="flex-1 text-sm">
                {/* Gross Profit brought forward */}
                {grossProfitPositive > 0 && (
                  <div className="flex justify-between px-4 py-2 font-semibold text-green-600 dark:text-green-400 border-b border-foreground/10">
                    <span className="pl-4 italic">Gross Profit b/d</span>
                    <span className="font-mono">{formatAmount(grossProfitPositive)}</span>
                  </div>
                )}

                {/* Other Income */}
                <button
                  onClick={() => toggleSection("plIncome")}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors border-b border-foreground/10 cursor-pointer"
                >
                  <div className="flex items-center gap-1 font-semibold">
                    {expanded.plIncome ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Other Income
                  </div>
                  <span className="font-mono font-semibold">{formatAmount(data.otherIncome)}</span>
                </button>

                {/* Net Loss */}
                {netLoss > 0 && (
                  <div className="flex justify-between px-4 py-2 font-semibold text-red-600 dark:text-red-400 border-t border-foreground/10">
                    <span className="pl-4 italic">Net Loss</span>
                    <span className="font-mono">{formatAmount(netLoss)}</span>
                  </div>
                )}
              </div>

              <div className="mt-auto border-t bg-muted/40 px-4 py-2.5 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatAmount(Math.max(plDebitTotal + netProfitPositive, plCreditTotal + netLoss))}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 print:hidden">
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Net Sales</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
              {formatCurrency(data.sales)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Excluding GST
          </CardContent>
        </Card>

        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Net Purchases</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">
              {formatCurrency(data.purchases)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Excluding GST
          </CardContent>
        </Card>

        <Card className={cn(
          "h-full",
          grossProfit >= 0
            ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40"
            : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40"
        )}>
          <CardHeader>
            <CardDescription>Gross Profit/Loss</CardDescription>
            <CardTitle className={cn(
              "text-2xl font-bold tabular-nums",
              grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"
            )}>
              {formatCurrency(Math.abs(grossProfit))}
            </CardTitle>
            <CardAction>
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                grossProfit >= 0
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500"
                  : "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500"
              )}>
                {grossProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {grossProfit >= 0 ? "Profit" : "Loss"}
          </CardContent>
        </Card>

        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Total Expenses</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">
              {formatCurrency(data.totalIndirectExpenses)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Receipt className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Indirect expenses
          </CardContent>
        </Card>

        <Card className={cn(
          "h-full",
          netProfit >= 0
            ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40"
            : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40"
        )}>
          <CardHeader>
            <CardDescription>Net Profit/Loss</CardDescription>
            <CardTitle className={cn(
              "text-2xl font-bold tabular-nums",
              netProfit >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"
            )}>
              {formatCurrency(Math.abs(netProfit))}
            </CardTitle>
            <CardAction>
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                netProfit >= 0
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500"
                  : "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500"
              )}>
                {netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {netProfit >= 0 ? "Profit" : "Loss"}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
