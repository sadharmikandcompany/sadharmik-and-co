"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Droplets, ArrowLeft, Plus, History, Package, Pencil } from "lucide-react"
import { format } from "date-fns"

type LooseStock = {
  id: string
  category_id: string
  quantity_liters: number
  price_per_liter: number
  created_at: string
  updated_at: string
  product_categories: {
    name: string
  }
}

type LooseStockTransaction = {
  id: string
  loose_stock_id: string
  transaction_type: string
  quantity_liters: number
  price_per_liter: number
  total_amount: number
  vendor_id: string | null
  vendor_name: string | null
  transferred_to_stock_id: string | null
  invoice_number: string | null
  batch_number: string | null
  transaction_notes: string | null
  transaction_date: string
  created_at: string
  loose_stock: {
    product_categories: {
      name: string
    }
  }
  stock_inventory?: {
    product_variants: {
      variant_name: string
    }
    packaging_materials: {
      name: string
    }
  }
}

export default function LooseStockPage() {
  const router = useRouter()
  const [looseStocks, setLooseStocks] = useState<LooseStock[]>([])
  const [transactions, setTransactions] = useState<LooseStockTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [editStock, setEditStock] = useState<LooseStock | null>(null)
  const [editQty, setEditQty] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)

  useEffect(() => {
    fetchLooseStockData()
  }, [])

  const openEditDialog = (stock: LooseStock) => {
    setEditStock(stock)
    setEditQty(String(stock.quantity_liters))
    setEditPassword("")
  }

  const closeEditDialog = () => {
    setEditStock(null)
    setEditQty("")
    setEditPassword("")
  }

  const handleEditQty = async () => {
    if (!editStock) return

    if (!editPassword) {
      toast.error("Please enter your account password")
      return
    }

    const newQty = Number(editQty)
    if (!Number.isFinite(newQty) || newQty < 0) {
      toast.error("Please enter a valid quantity (0 or more)")
      return
    }

    setEditSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.email) {
        toast.error("Unable to verify your account. Please log in again.")
        return
      }

      // Re-authenticate using the user's own login password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: editPassword,
      })

      if (authError) {
        toast.error("Incorrect password")
        return
      }

      const oldQty = editStock.quantity_liters

      // 1. Update loose stock quantity
      const { error: updateError } = await supabase
        .from("loose_stock")
        .update({
          quantity_liters: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editStock.id)

      if (updateError) throw updateError

      // 2. Log the adjustment as a loose stock transaction
      const { error: transactionError } = await supabase
        .from("loose_stock_transactions")
        .insert([{
          loose_stock_id: editStock.id,
          transaction_type: "adjustment",
          quantity_liters: newQty - oldQty,
          transaction_notes: "Manual correction",
          user_id: user.id,
          user_email: user.email,
        }])

      if (transactionError) throw transactionError

      toast.success("Quantity updated successfully")
      closeEditDialog()
      fetchLooseStockData()
    } catch (error) {
      console.error("Error updating loose stock quantity:", error)
      toast.error("Failed to update quantity")
    } finally {
      setEditSubmitting(false)
    }
  }

  const fetchLooseStockData = async () => {
    setLoading(true)

    try {
      // Fetch all loose stock with category details
      const { data: stockData, error: stockError } = await supabase
        .from("loose_stock")
        .select(`
          *,
          product_categories!inner (
            name
          )
        `)
        .order("product_categories(name)")

      if (stockError) throw stockError

      setLooseStocks(stockData || [])

      // Fetch recent transactions
      const { data: transactionData, error: transactionError } = await supabase
        .from("loose_stock_transactions")
        .select(`
          *,
          loose_stock!inner (
            product_categories!inner (
              name
            )
          ),
          stock_inventory (
            product_variants (
              variant_name
            ),
            packaging_materials (
              name
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100)

      if (transactionError) throw transactionError

      setTransactions(transactionData || [])
    } catch (error) {
      console.error("Error fetching loose stock data:", error)
      toast.error("Failed to fetch loose stock data")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "PPP")
  }

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "PPp")
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "purchase":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      case "transfer":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
      case "adjustment":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-200"
    }
  }

  const calculateTotalValue = () => {
    return looseStocks.reduce((sum, stock) => {
      return sum + (stock.quantity_liters * stock.price_per_liter)
    }, 0)
  }

  const calculateTotalLiters = () => {
    return looseStocks.reduce((sum, stock) => sum + stock.quantity_liters, 0)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Droplets className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Loose Stock Management</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Droplets className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-7 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back
        </Button>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Droplets className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Loose Stock Management</h1>
            <p className="text-sm text-muted-foreground">
              View and manage bulk/loose stock inventory
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/purchases/loose")}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Purchase
          </Button>
          <Button onClick={() => router.push("/dashboard/main-stock/transfer")}>
            <Package className="mr-2 h-4 w-4" />
            Transfer to Packages
          </Button>
        </div>
      </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{looseStocks.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Quantity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {calculateTotalLiters().toFixed(2)}L
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(calculateTotalValue())}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="h-auto">
          <TabsTrigger value="inventory" className="data-[state=active]:bg-background">
            <Droplets className="mr-2 h-4 w-4" />
            Current Inventory
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-background">
            <History className="mr-2 h-4 w-4" />
            Transaction History
          </TabsTrigger>
        </TabsList>

        {/* Current Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="w-full min-w-0 max-w-full">
          <Card className="w-full max-w-full overflow-hidden">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50">
                    <Droplets className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Loose Stock Inventory</CardTitle>
                    <CardDescription className="mt-0.5">
                      Current stock levels for all bulk/loose categories
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
                  {looseStocks.length} {looseStocks.length === 1 ? "category" : "categories"}
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <div className="w-full max-w-full overflow-x-auto">
                <Table className="min-w-[900px] w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Category</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Quantity (Liters)</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Price per Liter</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total Value</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Last Updated</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {looseStocks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No loose stock found
                        </TableCell>
                      </TableRow>
                    ) : (
                      looseStocks.map((stock) => (
                        <TableRow key={stock.id} className="transition-colors hover:bg-muted/30">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Droplets className="h-4 w-4 text-amber-600" />
                              {stock.product_categories.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                            {stock.quantity_liters.toFixed(2)}L
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(stock.price_per_liter)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatCurrency(stock.quantity_liters * stock.price_per_liter)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(stock.updated_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(stock)}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit qty
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        {/* Transaction History Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="w-full min-w-0 max-w-full">
          <Card className="w-full max-w-full overflow-hidden">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Transaction History</CardTitle>
                    <CardDescription className="mt-0.5">
                      All purchases, transfers, and adjustments
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full self-start sm:self-auto">
                  {transactions.length} {transactions.length === 1 ? "txn" : "txns"}
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <div className="w-full max-w-full overflow-x-auto">
                <Table className="min-w-[1000px] w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Date</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Category</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Type</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Quantity (L)</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Price/L</TableHead>
                      <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Total Amount</TableHead>
                      <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((transaction) => (
                        <TableRow key={transaction.id} className="transition-colors hover:bg-muted/30">
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(transaction.transaction_date)}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Droplets className="h-4 w-4 text-amber-600" />
                              {transaction.loose_stock.product_categories.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`rounded-full capitalize ${getTransactionTypeColor(transaction.transaction_type)}`}
                            >
                              {transaction.transaction_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-amber-600 dark:text-amber-400">
                            {transaction.quantity_liters.toFixed(2)}L
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {transaction.price_per_liter
                              ? formatCurrency(transaction.price_per_liter)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {transaction.total_amount
                              ? formatCurrency(transaction.total_amount)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {transaction.transaction_type === "purchase" && (
                              <div>
                                {transaction.vendor_name && (
                                  <div>Vendor: {transaction.vendor_name}</div>
                                )}
                                {transaction.invoice_number && (
                                  <div className="font-mono text-xs">
                                    Invoice: {transaction.invoice_number}
                                  </div>
                                )}
                              </div>
                            )}
                            {transaction.transaction_type === "transfer" &&
                              transaction.stock_inventory && (
                                <div>
                                  To: {transaction.stock_inventory.product_variants.variant_name} -{" "}
                                  {transaction.stock_inventory.packaging_materials.name}
                                </div>
                              )}
                            {transaction.transaction_notes && (
                              <div className="text-xs italic">{transaction.transaction_notes}</div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Quantity Dialog */}
      <Dialog
        open={editStock !== null}
        onOpenChange={(open) => {
          if (!open) closeEditDialog()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit Quantity{editStock ? ` — ${editStock.product_categories.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editStock && (
              <p className="text-sm text-muted-foreground">
                Current quantity:{" "}
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {editStock.quantity_liters.toFixed(2)}L
                </span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-qty">New quantity (liters)</Label>
              <Input
                id="edit-qty"
                type="number"
                step="0.01"
                min="0"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                placeholder="Enter new quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Confirm with your account password</Label>
              <Input
                id="edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Your login password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeEditDialog}
              disabled={editSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEditQty} disabled={editSubmitting}>
              {editSubmitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
