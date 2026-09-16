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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
  BadgeCheck,
  Plus,
  Pencil,
  Trash2,
  Search,
  FileDown,
  Image as ImageIcon,
} from "lucide-react"
import { format } from "date-fns"

interface License {
  id: string
  title: string
  image_url: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export default function LicensesListPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()

  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!roleLoading && role && role !== "admin") {
      router.replace("/dashboard")
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    if (!roleLoading && role === "admin") {
      fetchLicenses()
    }
  }, [roleLoading, role])

  const fetchLicenses = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("licenses")
        .select("id, title, image_url, pdf_url, created_at, updated_at")
        .order("created_at", { ascending: false })
      if (error) throw error
      setLicenses((data as License[]) || [])
    } catch (error: any) {
      console.error("Failed to load licenses:", error)
      toast.error(error?.message || "Failed to load licenses")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (l: License) => {
    if (!confirm(`Delete license "${l.title}"? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from("licenses").delete().eq("id", l.id)
      if (error) throw error
      toast.success("License deleted")
      fetchLicenses()
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete")
    }
  }

  const filtered = licenses.filter((l) => {
    if (!search.trim()) return true
    return l.title.toLowerCase().includes(search.toLowerCase())
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <BadgeCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Licenses</h1>
            <p className="text-sm text-muted-foreground">
              Compliance & regulatory licenses · visible on the public site.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/licenses/new">
            <Plus />
            New License
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Licenses</CardTitle>
          <CardDescription>
            {filtered.length} of {licenses.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {licenses.length === 0
                ? "No licenses yet. Click “New License” to upload one."
                : "No licenses match your search."}
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Preview</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        {l.image_url ? (
                          <img
                            src={l.image_url}
                            alt={l.title}
                            className="h-12 w-12 rounded object-cover border"
                          />
                        ) : l.pdf_url ? (
                          <div className="h-12 w-12 rounded border flex items-center justify-center bg-muted text-muted-foreground">
                            <FileDown className="h-5 w-5" />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded border flex items-center justify-center bg-muted text-muted-foreground">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[280px]">{l.title}</div>
                      </TableCell>
                      <TableCell>
                        {l.image_url ? (
                          <a
                            href={l.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            Image
                          </a>
                        ) : l.pdf_url ? (
                          <a
                            href={l.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            PDF
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(l.updated_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/licenses/${l.id}`}>
                            <Pencil />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(l)}
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
