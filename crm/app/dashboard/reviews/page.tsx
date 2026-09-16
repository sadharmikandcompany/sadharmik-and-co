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
import { Star, Plus, Pencil, Trash2, Search, Sparkles } from "lucide-react"
import { format } from "date-fns"

interface Review {
  id: string
  product_id: string | null
  product_name: string | null
  reviewer_name: string
  rating: number
  title: string | null
  body: string
  is_published: boolean
  is_ai_generated: boolean
  created_at: string
  updated_at: string
}

type PublishedFilter = "all" | "published" | "draft"

function reviewerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ReviewsListPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [publishedFilter, setPublishedFilter] =
    useState<PublishedFilter>("all")
  const [ratingFilter, setRatingFilter] = useState<string>("all")

  useEffect(() => {
    if (!roleLoading && role && role !== "admin") {
      router.replace("/dashboard")
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    if (!roleLoading && role === "admin") {
      fetchReviews()
    }
  }, [roleLoading, role])

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          "id, product_id, product_name, reviewer_name, rating, title, body, is_published, is_ai_generated, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
      if (error) throw error
      setReviews((data as Review[]) || [])
    } catch (error: any) {
      console.error("Failed to load reviews:", error)
      toast.error(error?.message || "Failed to load reviews")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (r: Review) => {
    if (
      !confirm(
        `Delete review by "${r.reviewer_name}"? This cannot be undone.`
      )
    )
      return
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", r.id)
      if (error) throw error
      toast.success("Review deleted")
      fetchReviews()
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete")
    }
  }

  const filtered = reviews.filter((r) => {
    if (publishedFilter === "published" && !r.is_published) return false
    if (publishedFilter === "draft" && r.is_published) return false
    if (ratingFilter !== "all" && r.rating !== Number(ratingFilter))
      return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        (r.product_name || "").toLowerCase().includes(q) ||
        r.reviewer_name.toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q)
      )
    }
    return true
  })

  const counts = reviews.reduce(
    (acc, r) => {
      acc.total += 1
      if (r.is_published) acc.published += 1
      else acc.draft += 1
      if (r.is_ai_generated) acc.ai += 1
      return acc
    },
    { total: 0, published: 0, draft: 0, ai: 0 }
  )

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
            <Star className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
            <p className="text-sm text-muted-foreground">
              Product reviews shown on the public website. Drafts are hidden.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/reviews/new">
            <Plus />
            New Review
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Published" value={counts.published} />
        <StatCard label="Draft" value={counts.draft} />
        <StatCard label="AI generated" value={counts.ai} />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">All Reviews</CardTitle>
          <CardDescription>
            {filtered.length} of {reviews.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
            <InputGroup className="flex-1 min-w-[240px]">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search product, reviewer, body…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <Select
              value={publishedFilter}
              onValueChange={(v) => setPublishedFilter(v as PublishedFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="5">5 stars</SelectItem>
                <SelectItem value="4">4 stars</SelectItem>
                <SelectItem value="3">3 stars</SelectItem>
                <SelectItem value="2">2 stars</SelectItem>
                <SelectItem value="1">1 star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-muted-foreground">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Star className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {reviews.length === 0 ? "No reviews yet" : "No matches"}
              </p>
              <p className="mt-1 text-xs">
                {reviews.length === 0
                  ? "Click “New Review” to add one."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Product</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Excerpt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="max-w-[200px] truncate">
                          {r.product_name || (
                            <span className="text-muted-foreground italic">
                              No product
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-muted-foreground">
                            {reviewerInitials(r.reviewer_name)}
                          </div>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate max-w-[120px] text-xs font-medium">
                              {r.reviewer_name}
                            </span>
                            {r.is_ai_generated && (
                              <Badge
                                variant="outline"
                                className="h-5 gap-1 border-violet-200 bg-violet-50 px-1.5 text-[0.625rem] text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-400"
                                aria-label="AI generated"
                              >
                                <Sparkles className="h-2.5 w-2.5" />
                                AI
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RatingStars value={r.rating} />
                      </TableCell>
                      <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                        <div className="truncate">{r.title || r.body}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            r.is_published
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
                          }
                        >
                          {r.is_published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {format(new Date(r.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/reviews/${r.id}`}>
                            <Pencil />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(r)}
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

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            n <= value
              ? "h-3.5 w-3.5 fill-amber-400 text-amber-400"
              : "h-3.5 w-3.5 text-muted-foreground/40"
          }
        />
      ))}
    </div>
  )
}
