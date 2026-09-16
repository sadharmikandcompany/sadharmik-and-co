"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
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
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Upload,
  X,
  FileText,
  BadgeCheck,
  Image as ImageIcon,
} from "lucide-react"

const BUCKET = "licenses"

interface LicenseForm {
  title: string
  image_url: string
  pdf_url: string
}

export default function LicenseEditorPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { userProfile, role, loading: roleLoading } = useUserRole()

  const id = params.id
  const isNew = id === "new"

  const [form, setForm] = useState<LicenseForm>({
    title: "",
    image_url: "",
    pdf_url: "",
  })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!roleLoading && role && role !== "admin") {
      router.replace("/dashboard")
    }
  }, [role, roleLoading, router])

  useEffect(() => {
    if (isNew || !id) return
    if (roleLoading || role !== "admin") return
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("licenses")
          .select("*")
          .eq("id", id)
          .single()
        if (error) throw error
        setForm({
          title: data.title || "",
          image_url: data.image_url || "",
          pdf_url: data.pdf_url || "",
        })
      } catch (error: any) {
        console.error("Failed to load license:", error)
        toast.error(error?.message || "Failed to load license")
        router.replace("/dashboard/licenses")
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isNew, roleLoading, role, router])

  const uploadFile = async (
    file: File,
    kind: "image" | "pdf"
  ): Promise<string | null> => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be smaller than 10 MB")
      return null
    }
    try {
      const ext = file.name.split(".").pop() || (kind === "pdf" ? "pdf" : "bin")
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
      const path = `${kind === "pdf" ? "pdfs" : "images"}/${filename}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return data.publicUrl
    } catch (error: any) {
      toast.error(error?.message || "Upload failed")
      return null
    }
  }

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    const url = await uploadFile(file, "image")
    if (url) {
      setForm((f) => ({ ...f, image_url: url }))
      toast.success("Image uploaded")
    }
    setUploadingImage(false)
  }

  const handlePdfUpload = async (file: File) => {
    setUploadingPdf(true)
    const url = await uploadFile(file, "pdf")
    if (url) {
      setForm((f) => ({ ...f, pdf_url: url }))
      toast.success("PDF uploaded")
    }
    setUploadingPdf(false)
  }

  const canSave = useMemo(
    () =>
      form.title.trim().length > 0 &&
      (form.image_url.length > 0 || form.pdf_url.length > 0),
    [form.title, form.image_url, form.pdf_url]
  )

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Title and at least one file (image or PDF) are required")
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        image_url: form.image_url || null,
        pdf_url: form.pdf_url || null,
      }

      if (isNew) {
        const { data, error } = await supabase
          .from("licenses")
          .insert({ ...payload, created_by: userProfile?.id ?? null })
          .select("id")
          .single()
        if (error) throw error
        toast.success("License created")
        router.replace(`/dashboard/licenses/${data.id}`)
      } else {
        const { error } = await supabase
          .from("licenses")
          .update(payload)
          .eq("id", id)
        if (error) throw error
        toast.success("License saved")
      }
    } catch (error: any) {
      console.error("Save failed:", error)
      toast.error(
        error?.message || error?.details || error?.hint || "Failed to save"
      )
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
            <Link href="/dashboard/licenses">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BadgeCheck className="h-6 w-6" />
              {isNew ? "New License" : "Edit License"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNew
                ? "Upload a license image or PDF for the public site"
                : form.title || "—"}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !canSave}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">License Details</CardTitle>
              <CardDescription>
                Visible on the public website once saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Title *
                </label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. FSSAI Registration"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image
              </CardTitle>
              <CardDescription>
                Primary visual. Shown on the public site when present.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.image_url ? (
                <div className="space-y-2">
                  <a
                    href={form.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded border overflow-hidden hover:opacity-90"
                  >
                    <img
                      src={form.image_url}
                      alt={form.title || "License image"}
                      className="w-full max-h-56 object-contain bg-muted"
                    />
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded p-6 text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/40"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {uploadingImage ? "Uploading…" : "Click to upload image"}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
              >
                <Upload className="h-4 w-4 mr-1" />
                {form.image_url ? "Replace" : "Upload"}
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file)
                  e.target.value = ""
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                PDF (alternative)
              </CardTitle>
              <CardDescription>
                Used on the public site when no image is uploaded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.pdf_url ? (
                <div className="space-y-2">
                  <a
                    href={form.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded border text-sm hover:bg-muted"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">View PDF</span>
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setForm((f) => ({ ...f, pdf_url: "" }))}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded p-6 text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/40"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  {uploadingPdf ? "Uploading…" : "Click to upload PDF"}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf}
              >
                <Upload className="h-4 w-4 mr-1" />
                {form.pdf_url ? "Replace" : "Upload"}
              </Button>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handlePdfUpload(file)
                  e.target.value = ""
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
