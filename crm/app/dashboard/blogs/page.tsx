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
import { Input } from "@/components/ui/input"
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
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  ExternalLink,
} from "lucide-react"
import { format } from "date-fns"

interface Blog {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  status: "draft" | "published" | "archived"
  tags: string[]
  published_at: string | null
  created_at: string
  updated_at: string
}

type StatusFilter = "all" | "draft" | "published" | "archived"

export default function BlogsListPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()

  const [blogs, setBlogs] = useState<Blog[]>([])
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
      fetchBlogs()
    }
  }, [roleLoading, role])

  const fetchBlogs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("blogs")
        .select(
          "id, title, slug, excerpt, cover_image_url, status, tags, published_at, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
      if (error) throw error
      setBlogs((data as Blog[]) || [])
    } catch (error: any) {
      console.error("Failed to load blogs:", error)
      toast.error(error?.message || "Failed to load blogs")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (b: Blog) => {
    if (!confirm(`Delete "${b.title}"? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from("blogs").delete().eq("id", b.id)
      if (error) throw error
      toast.success("Blog deleted")
      fetchBlogs()
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete")
    }
  }

  const handleToggleStatus = async (b: Blog) => {
    const next = b.status === "published" ? "draft" : "published"
    try {
      const { error } = await supabase
        .from("blogs")
        .update({
          status: next,
          published_at:
            next === "published" ? b.published_at || new Date().toISOString() : b.published_at,
        })
        .eq("id", b.id)
      if (error) throw error
      toast.success(next === "published" ? "Published" : "Moved to draft")
      fetchBlogs()
    } catch (error: any) {
      toast.error(error?.message || "Failed to update status")
    }
  }

  const filtered = blogs.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        b.title.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.excerpt || "").toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7" />
            Blogs
          </h1>
          <p className="text-muted-foreground">
            Manage blog posts with rich content and images.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/blogs/new">
            <Plus className="h-4 w-4 mr-1" />
            New Blog
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Blogs</CardTitle>
          <CardDescription>
            {filtered.length} of {blogs.length} · newest first
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title, slug, excerpt, tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {blogs.length === 0
                ? "No blogs yet. Click “New Blog” to create one."
                : "No blogs match your filters."}
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium max-w-[280px]">
                        <div className="flex items-center gap-3">
                          {b.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={b.cover_image_url}
                              alt=""
                              className="h-10 w-14 rounded object-cover border"
                            />
                          ) : (
                            <div className="h-10 w-14 rounded bg-muted border" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate">{b.title}</div>
                            {b.excerpt && (
                              <div className="text-xs text-muted-foreground truncate">
                                {b.excerpt}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[200px] truncate">
                        {b.slug}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleStatus(b)}
                          title={
                            b.status === "published"
                              ? "Click to move to draft"
                              : "Click to publish"
                          }
                        >
                          <Badge
                            variant={
                              b.status === "published"
                                ? "default"
                                : b.status === "archived"
                                  ? "outline"
                                  : "secondary"
                            }
                          >
                            {b.status}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {b.tags.slice(0, 3).map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="text-xs"
                            >
                              {t}
                            </Badge>
                          ))}
                          {b.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{b.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(b.updated_at), "dd MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/blogs/${b.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(b)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
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
