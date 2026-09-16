"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, UserCog, Loader2, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, ShoppingBag, BarChart3, Search, Filter as FilterIcon } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRangePresetFilter, type DatePreset } from "@/components/ui/date-range-preset-filter"
import { ExportButtons } from "@/components/export-buttons"

type UserTransaction = {
  user_id: string
  user_name: string
  user_email: string | null
  total_sales: number
  total_purchases: number
  sales_count: number
  purchases_count: number
  net_transaction: number
  sales_orders: any[]
  purchase_orders: any[]
}

export default function UserTransactionsReportPage() {
  const [userTransactions, setUserTransactions] = useState<UserTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>("all")

  useEffect(() => {
    fetchUserTransactions()
  }, [])

  const fetchUserTransactions = async () => {
    setLoading(true)

    try {
      // Fetch all orders with user information
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          total_amount,
          order_date,
          created_at,
          created_by,
          users:created_by (
            id,
            full_name,
            email
          )
        `)

      if (ordersError) throw ordersError

      // Fetch all purchases with user information
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("purchases")
        .select(`
          id,
          purchase_number,
          total_amount,
          purchase_date,
          created_at,
          created_by,
          users:created_by (
            id,
            full_name,
            email
          )
        `)

      if (purchasesError) throw purchasesError

      // Group by user
      const userMap = new Map<string, UserTransaction>()

      // Process sales (orders)
      ordersData?.forEach((order: any) => {
        const userId = order.created_by
        if (!userId) return

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            user_id: userId,
            user_name: order.users?.full_name || "Unknown User",
            user_email: order.users?.email || null,
            total_sales: 0,
            total_purchases: 0,
            sales_count: 0,
            purchases_count: 0,
            net_transaction: 0,
            sales_orders: [],
            purchase_orders: [],
          })
        }

        const userData = userMap.get(userId)!
        userData.total_sales += Number(order.total_amount || 0)
        userData.sales_count += 1
        userData.sales_orders.push(order)
        userData.net_transaction = userData.total_sales - userData.total_purchases
        userMap.set(userId, userData)
      })

      // Process purchases
      purchasesData?.forEach((purchase: any) => {
        const userId = purchase.created_by
        if (!userId) return

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            user_id: userId,
            user_name: purchase.users?.full_name || "Unknown User",
            user_email: purchase.users?.email || null,
            total_sales: 0,
            total_purchases: 0,
            sales_count: 0,
            purchases_count: 0,
            net_transaction: 0,
            sales_orders: [],
            purchase_orders: [],
          })
        }

        const userData = userMap.get(userId)!
        userData.total_purchases += Number(purchase.total_amount || 0)
        userData.purchases_count += 1
        userData.purchase_orders.push(purchase)
        userData.net_transaction = userData.total_sales - userData.total_purchases
        userMap.set(userId, userData)
      })

      const transactions = Array.from(userMap.values())
      setUserTransactions(transactions)
    } catch (error) {
      console.error("Error fetching user transactions:", error)
      toast.error("Failed to fetch user transactions")
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = userTransactions.filter((transaction) => {
    // Text search filter
    const matchesSearch =
      searchTerm === "" ||
      transaction.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.user_email?.toLowerCase().includes(searchTerm.toLowerCase())

    // Date range filter (checking both sales and purchases)
    let matchesDateRange = true
    if (dateFrom || dateTo) {
      const hasMatchingSale = transaction.sales_orders.some((order: any) => {
        const orderDate = new Date(order.order_date || order.created_at)
        const matchesFrom = !dateFrom || orderDate >= dateFrom
        const matchesTo = !dateTo || orderDate <= dateTo
        return matchesFrom && matchesTo
      })

      const hasMatchingPurchase = transaction.purchase_orders.some((purchase: any) => {
        const purchaseDate = new Date(purchase.purchase_date || purchase.created_at)
        const matchesFrom = !dateFrom || purchaseDate >= dateFrom
        const matchesTo = !dateTo || purchaseDate <= dateTo
        return matchesFrom && matchesTo
      })

      matchesDateRange = hasMatchingSale || hasMatchingPurchase
    }

    // Transaction type filter
    const matchesTransactionType =
      transactionTypeFilter === "all" ||
      (transactionTypeFilter === "sales_only" && transaction.sales_count > 0 && transaction.purchases_count === 0) ||
      (transactionTypeFilter === "purchases_only" && transaction.purchases_count > 0 && transaction.sales_count === 0) ||
      (transactionTypeFilter === "both" && transaction.sales_count > 0 && transaction.purchases_count > 0)

    return matchesSearch && matchesDateRange && matchesTransactionType
  })

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setDatePreset("all")
    setTransactionTypeFilter("all")
    setSearchTerm("")
  }

  const hasActiveFilters =
    dateFrom ||
    dateTo ||
    transactionTypeFilter !== "all" ||
    searchTerm !== ""

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Calculate summary stats
  const totalSales = filteredTransactions.reduce((sum, t) => sum + t.total_sales, 0)
  const totalPurchases = filteredTransactions.reduce((sum, t) => sum + t.total_purchases, 0)
  const netTotal = totalSales - totalPurchases
  const totalSalesCount = filteredTransactions.reduce((sum, t) => sum + t.sales_count, 0)
  const totalPurchasesCount = filteredTransactions.reduce((sum, t) => sum + t.purchases_count, 0)

  // Prepare export data
  const exportData = filteredTransactions.map(transaction => ({
    'User Name': transaction.user_name,
    'Email': transaction.user_email || 'N/A',
    'Sales Count': transaction.sales_count,
    'Total Sales': `₹${transaction.total_sales.toFixed(2)}`,
    'Purchases Count': transaction.purchases_count,
    'Total Purchases': `₹${transaction.total_purchases.toFixed(2)}`,
    'Net Transaction': `₹${transaction.net_transaction.toFixed(2)}`,
    'Status': transaction.net_transaction >= 0 ? 'Profit' : 'Loss'
  }))

  const exportColumns = [
    { header: 'User', dataKey: 'User Name' },
    { header: 'Sales #', dataKey: 'Sales Count' },
    { header: 'Sales Total', dataKey: 'Total Sales' },
    { header: 'Purchases #', dataKey: 'Purchases Count' },
    { header: 'Purchases Total', dataKey: 'Total Purchases' },
    { header: 'Net', dataKey: 'Net Transaction' }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <UserCog className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">User Transactions Report</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <UserCog className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">User Transactions Report</h1>
            <p className="text-sm text-muted-foreground">
              Purchase and sale transactions by user with export options
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
        <ExportButtons
          data={exportData}
          filename="user-transactions-report"
          columns={exportColumns}
          pdfTitle="User Transactions Report"
        />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {filteredTransactions.length.toLocaleString()}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <UserCog className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Across current filters
          </CardContent>
        </Card>

        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Total Sales</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
              {formatCurrency(totalSales)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {totalSalesCount} orders
          </CardContent>
        </Card>

        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Total Purchases</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">
              {formatCurrency(totalPurchases)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {totalPurchasesCount} orders
          </CardContent>
        </Card>

        <Card className={cn(
          "h-full",
          netTotal >= 0
            ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40"
            : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40"
        )}>
          <CardHeader>
            <CardDescription>Net Total</CardDescription>
            <CardTitle className={cn(
              "text-2xl font-bold tabular-nums",
              netTotal >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"
            )}>
              {formatCurrency(Math.abs(netTotal))}
            </CardTitle>
            <CardAction>
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                netTotal >= 0
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500"
                  : "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500"
              )}>
                {netTotal >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {netTotal >= 0 ? "Profit" : "Loss"}
          </CardContent>
        </Card>

        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Avg per User</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">
              {formatCurrency(filteredTransactions.length > 0 ? netTotal / filteredTransactions.length : 0)}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <BarChart3 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Mean net transaction
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FilterIcon className="h-4 w-4 text-muted-foreground" />
                User Transaction Details
              </CardTitle>
              <CardDescription>
                Filter and view detailed transaction information by user
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Badge variant="secondary" className="rounded-full">
                Filters active
              </Badge>
            )}
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>

              {/* Transaction Type */}
              <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sales_only">Sales Only</SelectItem>
                  <SelectItem value="purchases_only">Purchases Only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>

              {/* Date range */}
              <DateRangePresetFilter
                preset={datePreset}
                onPresetChange={(p, range) => {
                  setDatePreset(p)
                  setDateFrom(range.from)
                  setDateTo(range.to)
                }}
                customFrom={dateFrom}
                customTo={dateTo}
                onCustomRangeChange={(from, to) => {
                  setDatePreset("custom")
                  setDateFrom(from)
                  setDateTo(to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999) : undefined)
                }}
              />

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="rounded-md border overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>User Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Sales Count</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-center">Purchases Count</TableHead>
                  <TableHead className="text-right">Total Purchases</TableHead>
                  <TableHead className="text-right">Net Transaction</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No user transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.user_id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {transaction.user_name}
                      </TableCell>
                      <TableCell>
                        {transaction.user_email ? (
                          <span className="text-sm text-muted-foreground">{transaction.user_email}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-50">
                          {transaction.sales_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(transaction.total_sales)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-orange-50">
                          {transaction.purchases_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-orange-600">
                        {formatCurrency(transaction.total_purchases)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-bold",
                        transaction.net_transaction >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(Math.abs(transaction.net_transaction))}
                      </TableCell>
                      <TableCell className="text-center">
                        {transaction.net_transaction >= 0 ? (
                          <Badge variant="default" className="gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Profit
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <TrendingDown className="h-3 w-3" />
                            Loss
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredTransactions.length} users
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
