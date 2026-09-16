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
import { CalendarIcon, Loader2, FileText, Download, Printer, ChevronDown, ChevronRight, Wallet, Scale, TrendingUp, TrendingDown, BookOpen, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type BalanceSheetData = {
  // Liabilities
  capitalAccount: {
    totalSales: number
    retainedEarnings: number
  }
  currentLiabilities: {
    sundryCreditors: number
    pendingPurchasePayments: number
    gstPayable: number
    expensesPayable: number
  }
  // Assets
  currentAssets: {
    cashInHand: number
    bankAccounts: number
    sundryDebtors: number
    pendingOrderPayments: number
    stockInHand: number
  }
  fixedAssets: {
    totalFixedAssets: number
  }
}

type CollapsibleSection = {
  capitalAccount: boolean
  currentLiabilities: boolean
  currentAssets: boolean
  fixedAssets: boolean
}

export default function BalanceSheetPage() {
  const [loading, setLoading] = useState(true)
  const [asOfDate, setAsOfDate] = useState<Date>(new Date())
  const [financialYear, setFinancialYear] = useState<string>("")
  const [data, setData] = useState<BalanceSheetData>({
    capitalAccount: { totalSales: 0, retainedEarnings: 0 },
    currentLiabilities: { sundryCreditors: 0, pendingPurchasePayments: 0, gstPayable: 0, expensesPayable: 0 },
    currentAssets: { cashInHand: 0, bankAccounts: 0, sundryDebtors: 0, pendingOrderPayments: 0, stockInHand: 0 },
    fixedAssets: { totalFixedAssets: 0 },
  })
  const [expanded, setExpanded] = useState<CollapsibleSection>({
    capitalAccount: true,
    currentLiabilities: true,
    currentAssets: true,
    fixedAssets: true,
  })

  // Set current financial year
  useEffect(() => {
    const now = new Date()
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    setFinancialYear(`${year}-${year + 1}`)
  }, [])

  const fetchBalanceSheetData = useCallback(async () => {
    setLoading(true)
    const dateStr = format(asOfDate, "yyyy-MM-dd")

    try {
      // Fetch all data in parallel
      const [
        ordersResult,
        purchasesResult,
        expensesResult,
        paidOrdersResult,
        paidPurchasesResult,
        stockResult,
      ] = await Promise.all([
        // Total sales (completed orders)
        supabase
          .from("orders")
          .select("total_amount, cgst_amount, sgst_amount, igst_amount, payment_status")
          .lte("order_date", dateStr),
        // Total purchases
        supabase
          .from("purchases")
          .select("total_amount, cgst_amount, sgst_amount, igst_amount, payment_status")
          .lte("purchase_date", dateStr),
        // Total expenses
        supabase
          .from("expenses")
          .select("amount, expense_type")
          .lte("expense_date", dateStr),
        // Paid orders (cash/bank received)
        supabase
          .from("orders")
          .select("total_amount, payment_method, payment_status")
          .eq("payment_status", "paid")
          .lte("order_date", dateStr),
        // Paid purchases (cash/bank paid out)
        supabase
          .from("purchases")
          .select("total_amount, payment_status")
          .eq("payment_status", "paid")
          .lte("purchase_date", dateStr),
        // Stock value
        supabase
          .from("warehouse_stock")
          .select("quantity, purchase_price"),
      ])

      // Calculate totals
      const orders = ordersResult.data || []
      const purchases = purchasesResult.data || []
      const expenses = expensesResult.data || []
      const paidOrders = paidOrdersResult.data || []
      const paidPurchases = paidPurchasesResult.data || []
      const stock = stockResult.data || []

      // Revenue from orders
      const totalSalesRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
      const totalPurchasesCost = purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0)
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

      // GST calculations
      const totalOrderGST = orders.reduce((sum, o) =>
        sum + Number(o.cgst_amount || 0) + Number(o.sgst_amount || 0) + Number(o.igst_amount || 0), 0)
      const totalPurchaseGST = purchases.reduce((sum, p) =>
        sum + Number(p.cgst_amount || 0) + Number(p.sgst_amount || 0) + Number(p.igst_amount || 0), 0)
      const gstPayable = totalOrderGST - totalPurchaseGST

      // Receivables (unpaid orders = sundry debtors)
      const pendingOrders = orders.filter(o => o.payment_status !== "paid")
      const sundryDebtors = pendingOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)

      // Payables (unpaid purchases = sundry creditors)
      const pendingPurchases = purchases.filter(p => p.payment_status !== "paid")
      const sundryCreditors = pendingPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0)

      // Cash/Bank from paid orders minus paid purchases minus expenses
      const totalCashReceived = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
      const totalCashPaid = paidPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0)
      const netCash = totalCashReceived - totalCashPaid - totalExpenses

      // Stock value
      const stockValue = stock.reduce((sum, s) =>
        sum + (Number(s.quantity || 0) * Number(s.purchase_price || 0)), 0)

      // Retained earnings = Total Revenue - Total Cost - Expenses
      const retainedEarnings = totalSalesRevenue - totalPurchasesCost - totalExpenses

      setData({
        capitalAccount: {
          totalSales: totalSalesRevenue,
          retainedEarnings: retainedEarnings > 0 ? retainedEarnings : 0,
        },
        currentLiabilities: {
          sundryCreditors,
          pendingPurchasePayments: 0,
          gstPayable: gstPayable > 0 ? gstPayable : 0,
          expensesPayable: 0,
        },
        currentAssets: {
          cashInHand: netCash > 0 ? netCash * 0.3 : 0,
          bankAccounts: netCash > 0 ? netCash * 0.7 : 0,
          sundryDebtors,
          pendingOrderPayments: 0,
          stockInHand: stockValue,
        },
        fixedAssets: {
          totalFixedAssets: 0,
        },
      })
    } catch (error) {
      console.error("Error fetching balance sheet data:", error)
      toast.error("Failed to fetch balance sheet data")
    } finally {
      setLoading(false)
    }
  }, [asOfDate])

  useEffect(() => {
    fetchBalanceSheetData()
  }, [fetchBalanceSheetData])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Math.abs(amount))
  }

  const formatAmount = (amount: number) => {
    if (amount === 0) return ""
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Math.abs(amount))
  }

  const toggleSection = (section: keyof CollapsibleSection) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Calculate totals
  const totalLiabilities =
    data.capitalAccount.retainedEarnings +
    data.currentLiabilities.sundryCreditors +
    data.currentLiabilities.gstPayable +
    data.currentLiabilities.expensesPayable

  const totalAssets =
    data.currentAssets.cashInHand +
    data.currentAssets.bankAccounts +
    data.currentAssets.sundryDebtors +
    data.currentAssets.stockInHand +
    data.fixedAssets.totalFixedAssets

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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Balance Sheet</h1>
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Balance Sheet</h1>
            <p className="text-sm text-muted-foreground">
              Tally-style balance sheet as on {format(asOfDate, "dd-MMM-yyyy")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(asOfDate, "dd-MMM-yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={asOfDate}
                onSelect={(date) => date && setAsOfDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Tally-style Balance Sheet */}
      <Card className="overflow-hidden border py-0 print:border print:shadow-none">
        {/* Company Header - Tally style */}
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 border-b px-5 py-4 print:bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 print:hidden">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h2 className="text-base md:text-lg font-bold uppercase tracking-wide">Sadharmik & Company</h2>
                <p className="text-sm font-semibold text-primary">Balance Sheet</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:text-right">
              as on {format(asOfDate, "dd-MMMM-yyyy")}
            </p>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Two-column Tally layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-border min-h-[500px]">
            {/* LEFT SIDE - Liabilities */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 bg-rose-50/60 dark:bg-rose-950/15 px-4 py-2.5 border-b font-bold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-400 print:bg-white">
                <ArrowUpRight className="h-3.5 w-3.5 print:hidden" />
                Liabilities
              </div>

              <div className="flex-1 text-sm">
                {/* Capital Account */}
                <div className="border-b border-foreground/10">
                  <button
                    onClick={() => toggleSection("capitalAccount")}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors font-semibold cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      {expanded.capitalAccount ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Capital Account
                    </div>
                    <span className="font-mono">
                      {formatAmount(data.capitalAccount.retainedEarnings)}
                    </span>
                  </button>
                  {expanded.capitalAccount && (
                    <div className="px-4 pb-2">
                      <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                        <span>Retained Earnings</span>
                        <span className="font-mono">{formatAmount(data.capitalAccount.retainedEarnings)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Current Liabilities */}
                <div className="border-b border-foreground/10">
                  <button
                    onClick={() => toggleSection("currentLiabilities")}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors font-semibold cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      {expanded.currentLiabilities ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Current Liabilities
                    </div>
                    <span className="font-mono">
                      {formatAmount(
                        data.currentLiabilities.sundryCreditors +
                        data.currentLiabilities.gstPayable +
                        data.currentLiabilities.expensesPayable
                      )}
                    </span>
                  </button>
                  {expanded.currentLiabilities && (
                    <div className="px-4 pb-2">
                      <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                        <span>Sundry Creditors</span>
                        <span className="font-mono">{formatAmount(data.currentLiabilities.sundryCreditors)}</span>
                      </div>
                      {data.currentLiabilities.gstPayable > 0 && (
                        <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                          <span>GST Payable</span>
                          <span className="font-mono">{formatAmount(data.currentLiabilities.gstPayable)}</span>
                        </div>
                      )}
                      {data.currentLiabilities.expensesPayable > 0 && (
                        <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                          <span>Outstanding Expenses</span>
                          <span className="font-mono">{formatAmount(data.currentLiabilities.expensesPayable)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Liabilities Total */}
              <div className="mt-auto border-t bg-muted/40 px-4 py-2.5 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="font-mono tabular-nums">{formatAmount(totalLiabilities)}</span>
              </div>
            </div>

            {/* RIGHT SIDE - Assets */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 bg-emerald-50/60 dark:bg-emerald-950/15 px-4 py-2.5 border-b font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 print:bg-white">
                <ArrowDownLeft className="h-3.5 w-3.5 print:hidden" />
                Assets
              </div>

              <div className="flex-1 text-sm">
                {/* Current Assets */}
                <div className="border-b border-foreground/10">
                  <button
                    onClick={() => toggleSection("currentAssets")}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors font-semibold cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      {expanded.currentAssets ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Current Assets
                    </div>
                    <span className="font-mono">
                      {formatAmount(
                        data.currentAssets.cashInHand +
                        data.currentAssets.bankAccounts +
                        data.currentAssets.sundryDebtors +
                        data.currentAssets.stockInHand
                      )}
                    </span>
                  </button>
                  {expanded.currentAssets && (
                    <div className="px-4 pb-2">
                      {data.currentAssets.cashInHand > 0 && (
                        <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                          <span>Cash-in-Hand</span>
                          <span className="font-mono">{formatAmount(data.currentAssets.cashInHand)}</span>
                        </div>
                      )}
                      {data.currentAssets.bankAccounts > 0 && (
                        <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                          <span>Bank Accounts</span>
                          <span className="font-mono">{formatAmount(data.currentAssets.bankAccounts)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                        <span>Sundry Debtors</span>
                        <span className="font-mono">{formatAmount(data.currentAssets.sundryDebtors)}</span>
                      </div>
                      {data.currentAssets.stockInHand > 0 && (
                        <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                          <span>Stock-in-Hand</span>
                          <span className="font-mono">{formatAmount(data.currentAssets.stockInHand)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fixed Assets */}
                <div className="border-b border-foreground/10">
                  <button
                    onClick={() => toggleSection("fixedAssets")}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors font-semibold cursor-pointer"
                  >
                    <div className="flex items-center gap-1">
                      {expanded.fixedAssets ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Fixed Assets
                    </div>
                    <span className="font-mono">
                      {formatAmount(data.fixedAssets.totalFixedAssets)}
                    </span>
                  </button>
                  {expanded.fixedAssets && data.fixedAssets.totalFixedAssets > 0 && (
                    <div className="px-4 pb-2">
                      <div className="flex justify-between py-1 pl-6 text-muted-foreground">
                        <span>Fixed Assets</span>
                        <span className="font-mono">{formatAmount(data.fixedAssets.totalFixedAssets)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Profit & Loss (Difference) */}
                {totalLiabilities !== totalAssets && (
                  <div className="border-b border-foreground/10">
                    <div className="flex items-center justify-between px-4 py-2 font-semibold italic text-muted-foreground">
                      <span className="pl-4">
                        {totalLiabilities > totalAssets ? "Profit & Loss A/c (Debit)" : "Profit & Loss A/c (Credit)"}
                      </span>
                      <span className="font-mono">
                        {formatAmount(Math.abs(totalLiabilities - totalAssets))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Assets Total */}
              <div className="mt-auto border-t bg-muted/40 px-4 py-2.5 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatAmount(Math.max(totalLiabilities, totalAssets))}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Total Liabilities</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">
              {formatCurrency(totalLiabilities)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <TrendingDown className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All obligations
          </CardContent>
        </Card>

        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Assets</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
              {formatCurrency(totalAssets)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All resources
          </CardContent>
        </Card>

        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Sundry Debtors</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">
              {formatCurrency(data.currentAssets.sundryDebtors)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Wallet className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Receivables from customers
          </CardContent>
        </Card>

        <Card className="h-full bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
          <CardHeader>
            <CardDescription>Sundry Creditors</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-500">
              {formatCurrency(data.currentLiabilities.sundryCreditors)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500">
                <Scale className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Payables to vendors
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
