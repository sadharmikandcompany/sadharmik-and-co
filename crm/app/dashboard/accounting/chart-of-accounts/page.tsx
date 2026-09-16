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
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, BookOpen, Loader2, Edit, ChevronRight, ChevronDown, X, Search, Wallet, Banknote, Landmark, TrendingUp, TrendingDown } from "lucide-react"
import { toast } from "sonner"

type Account = {
  id: string
  code: string
  name: string
  type: string
  parent_id: string | null
  is_system: boolean
  gst_category: string | null
  description: string | null
  is_active: boolean
  created_at: string
  children?: Account[]
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Add Account Modal
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("")
  const [newParentId, setNewParentId] = useState<string>("none")
  const [newGstCategory, setNewGstCategory] = useState("")
  const [newDescription, setNewDescription] = useState("")

  // Edit Account Modal
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [editCode, setEditCode] = useState("")
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState("")
  const [editParentId, setEditParentId] = useState<string>("none")
  const [editGstCategory, setEditGstCategory] = useState("")
  const [editDescription, setEditDescription] = useState("")

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .order("code", { ascending: true })

    if (error) {
      console.error("Error fetching accounts:", error)
      toast.error("Failed to fetch chart of accounts")
      setLoading(false)
      return
    }
    setAccounts(data || [])
    // Expand all top-level groups by default
    const topLevel = (data || []).filter(a => !a.parent_id).map(a => a.id)
    setExpandedGroups(new Set(topLevel))
    setLoading(false)
  }

  const buildTree = (items: Account[]): Account[] => {
    const map = new Map<string, Account>()
    const roots: Account[] = []
    items.forEach(item => map.set(item.id, { ...item, children: [] }))
    items.forEach(item => {
      const node = map.get(item.id)!
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })
    return roots
  }

  const toggleExpand = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = searchTerm === "" ||
      account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "all" || account.type === typeFilter
    return matchesSearch && matchesType
  })

  const tree = buildTree(filteredAccounts)

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "Asset": return "default"
      case "Liability": return "destructive"
      case "Equity": return "secondary"
      case "Revenue": return "outline"
      case "Expense": return "destructive"
      default: return "secondary"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Asset": return "text-blue-600"
      case "Liability": return "text-red-600"
      case "Equity": return "text-purple-600"
      case "Revenue": return "text-green-600"
      case "Expense": return "text-orange-600"
      default: return ""
    }
  }

  const parentAccounts = accounts.filter(a => !a.parent_id)

  const handleAddAccount = async () => {
    if (!newCode || !newName || !newType) {
      toast.error("Code, Name, and Type are required")
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from("chart_of_accounts").insert([{
        code: newCode,
        name: newName,
        type: newType,
        parent_id: newParentId === "none" ? null : newParentId,
        gst_category: newGstCategory || null,
        description: newDescription || null,
        is_system: false,
        is_active: true,
      }])
      if (error) throw error
      toast.success("Account created successfully")
      setIsAddOpen(false)
      setNewCode(""); setNewName(""); setNewType(""); setNewParentId("none")
      setNewGstCategory(""); setNewDescription("")
      fetchAccounts()
    } catch (error: any) {
      console.error("Error creating account:", error)
      toast.error(error.message || "Failed to create account")
    } finally {
      setSubmitting(false)
    }
  }

  const openEditModal = (account: Account) => {
    setSelectedAccount(account)
    setEditCode(account.code)
    setEditName(account.name)
    setEditType(account.type)
    setEditParentId(account.parent_id || "none")
    setEditGstCategory(account.gst_category || "")
    setEditDescription(account.description || "")
    setIsEditOpen(true)
  }

  const handleUpdateAccount = async () => {
    if (!selectedAccount || !editCode || !editName || !editType) {
      toast.error("Code, Name, and Type are required")
      return
    }
    setUpdating(true)
    try {
      const { error } = await supabase.from("chart_of_accounts")
        .update({
          code: editCode,
          name: editName,
          type: editType,
          parent_id: editParentId === "none" ? null : editParentId,
          gst_category: editGstCategory || null,
          description: editDescription || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedAccount.id)
      if (error) throw error
      toast.success("Account updated successfully")
      setIsEditOpen(false)
      setSelectedAccount(null)
      fetchAccounts()
    } catch (error: any) {
      console.error("Error updating account:", error)
      toast.error(error.message || "Failed to update account")
    } finally {
      setUpdating(false)
    }
  }

  const renderAccountRow = (account: Account, depth: number = 0): React.ReactNode => {
    const hasChildren = account.children && account.children.length > 0
    const isExpanded = expandedGroups.has(account.id)

    return (
      <div key={account.id}>
        <div
          className={`flex items-center gap-2 py-2 px-4 hover:bg-muted/50 border-b ${depth > 0 ? 'bg-muted/20' : ''}`}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          <div className="w-6">
            {hasChildren && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleExpand(account.id)}>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <div className="w-20 font-mono text-sm font-medium">{account.code}</div>
          <div className={`flex-1 ${depth === 0 ? 'font-semibold' : ''} ${getTypeColor(account.type)}`}>
            {account.name}
          </div>
          <div className="w-24">
            <Badge variant={getTypeBadgeVariant(account.type) as any}>{account.type}</Badge>
          </div>
          <div className="w-32 text-sm text-muted-foreground">{account.gst_category || "-"}</div>
          <div className="w-16">
            {account.is_system ? (
              <Badge variant="secondary" className="text-xs">System</Badge>
            ) : (
              <Button variant="ghost" size="sm" className="h-7" onClick={() => openEditModal(account)}>
                <Edit className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && account.children!.map(child => renderAccountRow(child, depth + 1))}
      </div>
    )
  }

  const countByType = (type: string) => accounts.filter(a => a.type === type).length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <BookOpen className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Chart of Accounts</h1>
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
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-sm text-muted-foreground">Manage your accounting ledger structure</p>
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Account</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Account</DialogTitle>
              <DialogDescription>Create a new account in the chart of accounts</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Code *</Label>
                  <Input placeholder="e.g. 1150" value={newCode} onChange={e => setNewCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Account Type *</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asset">Asset</SelectItem>
                      <SelectItem value="Liability">Liability</SelectItem>
                      <SelectItem value="Equity">Equity</SelectItem>
                      <SelectItem value="Revenue">Revenue</SelectItem>
                      <SelectItem value="Expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <Input placeholder="e.g. Advance to Suppliers" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Parent Account</Label>
                <Select value={newParentId} onValueChange={setNewParentId}>
                  <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top Level)</SelectItem>
                    {parentAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>GST Category</Label>
                <Input placeholder="e.g. ITC CGST" value={newGstCategory} onChange={e => setNewGstCategory(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Account description" value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={handleAddAccount} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : <><Plus className="mr-2 h-4 w-4" />Create Account</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update account details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Code *</Label>
                <Input value={editCode} onChange={e => setEditCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asset">Asset</SelectItem>
                    <SelectItem value="Liability">Liability</SelectItem>
                    <SelectItem value="Equity">Equity</SelectItem>
                    <SelectItem value="Revenue">Revenue</SelectItem>
                    <SelectItem value="Expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Parent Account</Label>
              <Select value={editParentId} onValueChange={setEditParentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top Level)</SelectItem>
                  {parentAccounts.filter(a => a.id !== selectedAccount?.id).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>GST Category</Label>
              <Input value={editGstCategory} onChange={e => setEditGstCategory(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={updating}>Cancel</Button>
            <Button onClick={handleUpdateAccount} disabled={updating}>
              {updating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : <><Edit className="mr-2 h-4 w-4" />Update</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="h-full bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40">
          <CardHeader>
            <CardDescription>Asset</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-500">{countByType("Asset")}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-500">
                <Wallet className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">accounts</CardContent>
        </Card>
        <Card className="h-full bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40">
          <CardHeader>
            <CardDescription>Liability</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-500">{countByType("Liability")}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-500">
                <Banknote className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">accounts</CardContent>
        </Card>
        <Card className="h-full bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-900/40">
          <CardHeader>
            <CardDescription>Equity</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-500">{countByType("Equity")}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-500">
                <Landmark className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">accounts</CardContent>
        </Card>
        <Card className="h-full bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40">
          <CardHeader>
            <CardDescription>Revenue</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">{countByType("Revenue")}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-500">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">accounts</CardContent>
        </Card>
        <Card className="h-full bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40">
          <CardHeader>
            <CardDescription>Expense</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-500">{countByType("Expense")}</CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-500">
                <TrendingDown className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">accounts</CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Account Tree</CardTitle>
                <CardDescription className="mt-0.5">Hierarchical view of all accounts</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">{accounts.length} accounts</Badge>
              {(searchTerm || typeFilter !== "all") && (
                <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Filters active</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by code or name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-[220px] pl-8" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Asset">Asset</SelectItem>
                <SelectItem value="Liability">Liability</SelectItem>
                <SelectItem value="Equity">Equity</SelectItem>
                <SelectItem value="Revenue">Revenue</SelectItem>
                <SelectItem value="Expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            {(searchTerm || typeFilter !== "all") && (
              <Button variant="ghost" onClick={() => { setSearchTerm(""); setTypeFilter("all") }} className="gap-2">
                <X className="h-4 w-4" />Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <Separator />
        <CardContent>
          <div className="rounded-md border">
            <div className="flex items-center gap-2 py-2 px-4 bg-muted font-medium text-sm border-b">
              <div className="w-6" />
              <div className="w-20">Code</div>
              <div className="flex-1">Account Name</div>
              <div className="w-24">Type</div>
              <div className="w-32">GST Category</div>
              <div className="w-16">Action</div>
            </div>
            {tree.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No accounts found</div>
            ) : (
              tree.map(account => renderAccountRow(account))
            )}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Total: {accounts.length} accounts
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
