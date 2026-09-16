"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { RichTextEditor } from "@/components/rich-text-editor"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Save, Upload, X, ImageIcon } from "lucide-react"

const BUCKET = "blog-images"

type BlogStatus = "draft" | "published" | "archived"

interface BlogForm {
  title: string
  slug: string
  excerpt: string
  content: string
  cover_image_url: string
  status: BlogStatus
  tags: string[]
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120)
}

export default function BlogEditorPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { userProfile, role, loading: roleLoading } = useUserRole()

  const blogId = params.id
  const isNew = blogId === "new"

  const [form, setForm] = useState<BlogForm>({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    cover_image_url: "",
    status: "draft",
    tags: [],
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!roleLoading && role && role !== "admin") {
      router.replace("/dashboard")
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    if (isNew || !blogId) return
    if (roleLoading || role !== "admin") return
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("blogs")
          .select("*")
          .eq("id", blogId)
          .single()
        if (error) throw error
        setForm({
          title: data.title || "",
          slug: data.slug || "",
          excerpt: data.excerpt || "",
          content: data.content || "",
          cover_image_url: data.cover_image_url || "",
          status: (data.status as BlogStatus) || "draft",
          tags: data.tags || [],
        })
        setSlugTouched(true)
      } catch (error: any) {
        console.error("Failed to load blog:", error)
        toast.error(error?.message || "Failed to load blog")
        router.replace("/dashboard/blogs")
      } finally {
        setLoading(false)
      }
    })()
  }, [blogId, isNew, roleLoading, role, router])

  const onTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: slugTouched ? f.slug : slugify(title),
    }))
  }

  const onSlugChange = (slug: string) => {
    setSlugTouched(true)
    setForm((f) => ({ ...f, slug: slugify(slug) }))
  }

  const addTag = () => {
    const v = tagInput.trim()
    if (!v) return
    if (form.tags.includes(v)) {
      setTagInput("")
      return
    }
    setForm((f) => ({ ...f, tags: [...f.tags, v] }))
    setTagInput("")
  }

  const removeTag = (t: string) =>
    setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB")
      return
    }
    setUploadingCover(true)
    try {
      const ext = file.name.split(".").pop() || "png"
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
      const path = `covers/${filename}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      setForm((f) => ({ ...f, cover_image_url: data.publicUrl }))
      toast.success("Cover image uploaded")
    } catch (error: any) {
      toast.error(error?.message || "Upload failed")
    } finally {
      setUploadingCover(false)
    }
  }

  const canSave = useMemo(
    () => form.title.trim().length > 0 && form.slug.trim().length > 0,
    [form.title, form.slug]
  )

  const handleSave = async (publishOverride?: BlogStatus) => {
    if (!canSave) {
      toast.error("Title and slug are required")
      return
    }
    setSaving(true)
    const status = publishOverride || form.status
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        excerpt: form.excerpt.trim() || null,
        content: form.content,
        cover_image_url: form.cover_image_url || null,
        status,
        tags: form.tags,
        published_at:
          status === "published" ? new Date().toISOString() : null,
      }

      if (isNew) {
        const { data, error } = await supabase
          .from("blogs")
          .insert({
            ...payload,
            author_id: userProfile?.id ?? null,
            published_at:
              status === "published" ? new Date().toISOString() : null,
          })
          .select("id")
          .single()
        if (error) throw error
        toast.success("Blog created")
        router.replace(`/dashboard/blogs/${data.id}`)
      } else {
        const update: Record<string, unknown> = { ...payload }
        if (status !== "published") {
          update.published_at = null
        }
        const { error } = await supabase
          .from("blogs")
          .update(update)
          .eq("id", blogId)
        if (error) throw error
        setForm((f) => ({ ...f, status }))
        toast.success("Blog saved")
      }
    } catch (error: any) {
      console.error("Save failed:", error)
      toast.error(error?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (roleLoading || loading) {
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
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/blogs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? "New Blog" : "Edit Blog"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNew
                ? "Write and publish a new blog post"
                : `Status: ${form.status}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave("draft")}
            disabled={saving || !canSave}
          >
            <Save className="h-4 w-4 mr-1" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSave("published")}
            disabled={saving || !canSave}
          >
            {saving ? "Saving…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input
                  value={form.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Awesome blog title"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Slug</label>
                <Input
                  value={form.slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  placeholder="awesome-blog-title"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL-friendly identifier. Auto-generated from title — edit to
                  override.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Excerpt
                </label>
                <Textarea
                  value={form.excerpt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, excerpt: e.target.value }))
                  }
                  placeholder="Short summary shown in blog listings"
                  rows={2}
                  maxLength={300}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content</CardTitle>
              <CardDescription>
                Rich text editor. Paste or upload images directly into the body.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={form.content}
                onChange={(content) => setForm((f) => ({ ...f, content }))}
                placeholder="Start writing your blog…"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as BlogStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Cover Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.cover_image_url ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.cover_image_url}
                    alt="Cover"
                    className="w-full h-40 object-cover rounded border"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() =>
                      setForm((f) => ({ ...f, cover_image_url: "" }))
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded h-40 flex items-center justify-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/40"
                  onClick={() => coverInputRef.current?.click()}
                >
                  {uploadingCover ? "Uploading…" : "No cover image"}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
              >
                <Upload className="h-4 w-4 mr-1" />
                {form.cover_image_url ? "Replace" : "Upload"}
              </Button>
              <Input
                value={form.cover_image_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cover_image_url: e.target.value }))
                }
                placeholder="Or paste image URL"
                className="text-xs"
              />
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadCover(file)
                  e.target.value = ""
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Add a tag"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {t}
                      <button
                        onClick={() => removeTag(t)}
                        className="hover:text-red-600"
                        aria-label={`Remove ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
