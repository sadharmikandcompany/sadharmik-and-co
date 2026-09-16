"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  FlaskConical,
  Plus,
  Pencil,
  Trash2,
  Search,
  FileDown,
} from "lucide-react"
import { format } from "date-fns"

type LabTestStatus = "pending" | "passed" | "failed"

interface LabTest {
  id: string
  product_id: string | null
  product_name: string | null
  batch_number: string
  test_date: string
  lab_name: string
  status: LabTestStatus
  certificate_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type StatusFilter = "all" | LabTestStatus

const statusVariant: Record<
  LabTestStatus,
  "default" | "secondary" | "destructive"
> = {
  pending: "secondary",
  passed: "default",
  failed: "destructive",
}

export default function LabTestsListPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()

  const [tests, setTests] = useState<LabTest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  useEffect(() => {
    if (!roleLoading && role && role !== "admin") {
      router.replace("/dashboard")
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    if (!roleLoading && role === "admin") {
      fetchTests()
    }
  }, [roleLoading, role])

  const fetchTests = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("lab_tests")
        .select(
          "id, product_id, product_name, batch_number, test_date, lab_name, status, certificate_url, notes, created_at, updated_at"
        )
        .order("test_date", { ascending: false })
      if (error) throw error
      setTests((data as LabTest[]) || [])
    } catch (error: any) {
      console.error("Failed to load lab tests:", error)
      toast.error(error?.message || "Failed to load lab tests")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (t: LabTest) => {
    if (
      !confirm(
        `Delete lab test for batch "${t.batch_number}"? This cannot be undone.`
      )
    )
      return
    try {
      const { error } = await supabase
        .from("lab_tests")
        .delete()
        .eq("id", t.id)
      if (error) throw error
      toast.success("Lab test deleted")
      fetchTests()
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete")
    }
  }

  const filtered = tests.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        (t.product_name || "").toLowerCase().includes(q) ||
        t.batch_number.toLowerCase().includes(q) ||
        t.lab_name.toLowerCase().includes(q)
      )
    }
    return true
  })

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Admin access only</p>
      </div>
    )
  }

  const counts = tests.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lab Tests</h1>
            <p className="text-sm text-muted-foreground">
              Lab test reports for product batches · visible on the public site.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/lab-tests/new">
            <Plus />
            New Lab Test
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={tests.length} />
        <StatCard label="Pending" value={counts.pending || 0} />
        <StatCard label="Passed" value={counts.passed || 0} />
        <StatCard label="Failed" value={counts.failed || 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Lab Tests</CardTitle>
          <CardDescription>
            {filtered.length} of {tests.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="flex-1 min-w-[240px]">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search product, batch, lab…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tests.length === 0
                ? "No lab tests yet. Click “New Lab Test” to create one."
                : "No lab tests match your filters."}
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Lab</TableHead>
                    <TableHead>Test Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cert</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[220px]">
                          {t.product_name || "(no product)"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.batch_number}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[180px]">
                        {t.lab_name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(t.test_date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant[t.status]}
                          className="capitalize"
                        >
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.certificate_url ? (
                          <a
                            href={t.certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            View
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/lab-tests/${t.id}`}>
                            <Pencil />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(t)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-bold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
