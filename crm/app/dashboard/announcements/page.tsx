"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Megaphone,
  Plus,
  Trash2,
  Pencil,
  X,
  CheckCircle2,
  EyeOff,
  ListChecks,
  Clock,
} from "lucide-react"
import { format } from "date-fns"

interface Announcement {
  id: string
  title: string
  message: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AnnouncementsAdminPage() {
  const router = useRouter()
  const { userProfile, role, loading: roleLoading } = useUserRole()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Admin-only route
  useEffect(() => {
    if (!roleLoading && role && role !== "admin") {
      router.replace("/dashboard")
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    if (!roleLoading && role === "admin") {
      fetchAnnouncements()
    }
  }, [roleLoading, role])

  const fetchAnnouncements = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      setAnnouncements(data || [])
    } catch (error) {
      console.error("Failed to load announcements:", error)
      toast.error("Failed to load announcements")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitle("")
    setMessage("")
    setIsActive(true)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required")
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from("announcements")
          .update({
            title: title.trim(),
            message: message.trim(),
            is_active: isActive,
          })
          .eq("id", editingId)
        if (error) throw error
        toast.success("Announcement updated")
      } else {
        const { error } = await supabase.from("announcements").insert({
          title: title.trim(),
          message: message.trim(),
          is_active: isActive,
          created_by: userProfile?.id,
        })
        if (error) throw error
        toast.success("Announcement posted")
      }
      resetForm()
      fetchAnnouncements()
    } catch (error: any) {
      console.error("Failed to save announcement:", error)
      toast.error(error?.message || "Failed to save announcement")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id)
    setTitle(a.title)
    setMessage(a.message)
    setIsActive(a.is_active)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement? This cannot be undone.")) return
    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id)
      if (error) throw error
      toast.success("Announcement deleted")
      if (editingId === id) resetForm()
      fetchAnnouncements()
    } catch (error: any) {
      console.error("Failed to delete:", error)
      toast.error(error?.message || "Failed to delete")
    }
  }

  const handleToggleActive = async (a: Announcement) => {
    try {
      const { error } = await supabase
        .from("announcements")
        .update({ is_active: !a.is_active })
        .eq("id", a.id)
      if (error) throw error
      fetchAnnouncements()
    } catch (error: any) {
      toast.error(error?.message || "Failed to update status")
    }
  }

  if (roleLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
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

  const totalCount = announcements.length
  const activeCount = announcements.filter((a) => a.is_active).length
  const inactiveCount = announcements.filter((a) => !a.is_active).length
  const latestDate = announcements[0]?.created_at

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Announcements
            </h1>
            <p className="text-sm text-muted-foreground">
              Post messages that distributors will see on their panel
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Announcements */}
        <Card>
          <CardHeader>
            <CardDescription>Total Announcements</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {totalCount}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ListChecks className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All announcements posted
          </CardContent>
        </Card>

        {/* Active */}
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardHeader>
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600">
              {activeCount}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Visible to distributors
          </CardContent>
        </Card>

        {/* Inactive */}
        <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20">
          <CardHeader>
            <CardDescription>Inactive</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-600">
              {inactiveCount}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60">
                <EyeOff className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Hidden from distributors
          </CardContent>
        </Card>

        {/* Latest */}
        <Card>
          <CardHeader>
            <CardDescription>Latest Posted</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {latestDate ? format(new Date(latestDate), "dd MMM") : "—"}
            </CardTitle>
            <CardAction>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Clock className="h-4 w-4" />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {latestDate
              ? format(new Date(latestDate), "EEEE, HH:mm")
              : "No announcements yet"}
          </CardContent>
        </Card>
      </div>

      {/* New / Edit Announcement Form */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {editingId ? (
              <Pencil className="h-4 w-4 text-primary" />
            ) : (
              <Plus className="h-4 w-4 text-primary" />
            )}
            {editingId ? "Edit Announcement" : "New Announcement"}
          </CardTitle>
          <CardDescription>
            Visible to all distributors on their dashboard until deactivated.
          </CardDescription>
          <CardAction>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-1">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Price update from April 15"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Message
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write the full message distributors should read…"
                  rows={5}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm text-muted-foreground">
                  {isActive ? "Active (visible)" : "Inactive (hidden)"}
                </span>
              </div>
              <div className="flex gap-2">
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={saving}>
                  <Plus className="h-4 w-4 mr-1" />
                  {saving ? "Saving…" : editingId ? "Update" : "Post"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* All Announcements Table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            All Announcements
          </CardTitle>
          <CardDescription>
            {announcements.length} total · newest first
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="font-normal">
              {activeCount} active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Megaphone className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No announcements yet
              </p>
              <p className="mt-1 text-xs">Post one above to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Megaphone className="h-3.5 w-3.5" />
                          </div>
                          <span className="truncate text-xs font-medium">
                            {a.title}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[400px] truncate text-muted-foreground text-xs">
                        {a.message}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(a)}
                          className="inline-flex"
                          title="Toggle active"
                        >
                          <Badge
                            variant="outline"
                            className={
                              a.is_active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400"
                            }
                          >
                            {a.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground text-xs">
                        {format(new Date(a.created_at), "dd MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(a.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
