"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Upload,
  X,
  FileText,
  FlaskConical,
} from "lucide-react"

const BUCKET = "lab-test-certificates"

const today = () => new Date().toISOString().slice(0, 10)

const labTestSchema = z.object({
  batch_number: z.string().trim().min(1, "Batch number is required"),
  test_date: z.string().min(1, "Test date is required"),
  lab_name: z.string().trim().min(1, "Lab name is required"),
  status: z.enum(["pending", "passed", "failed"]),
  certificate_url: z.string(),
})

type LabTestForm = z.infer<typeof labTestSchema>

export default function LabTestEditorPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { userProfile, role, loading: roleLoading } = useUserRole()

  const id = params.id
  const isNew = id === "new"

  const form = useForm<LabTestForm>({
    resolver: zodResolver(labTestSchema),
    mode: "onChange",
    defaultValues: {
      batch_number: "",
      test_date: today(),
      lab_name: "",
      status: "pending",
      certificate_url: "",
    },
  })

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const certInputRef = useRef<HTMLInputElement>(null)

  const certificateUrl = form.watch("certificate_url")
  const batchNumber = form.watch("batch_number")

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
          .from("lab_tests")
          .select("*")
          .eq("id", id)
          .single()
        if (error) throw error
        form.reset({
          batch_number: data.batch_number || "",
          test_date: data.test_date || today(),
          lab_name: data.lab_name || "",
          status: (data.status as LabTestForm["status"]) || "pending",
          certificate_url: data.certificate_url || "",
        })
      } catch (error: any) {
        console.error("Failed to load lab test:", error)
        toast.error(error?.message || "Failed to load lab test")
        router.replace("/dashboard/lab-tests")
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isNew, roleLoading, role, router, form])

  const uploadCertificate = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be smaller than 10 MB")
      return
    }
    setUploadingCert(true)
    try {
      const ext = file.name.split(".").pop() || "pdf"
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
      const path = `certificates/${filename}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      form.setValue("certificate_url", data.publicUrl, { shouldDirty: true })
      toast.success("Certificate uploaded")
    } catch (error: any) {
      toast.error(error?.message || "Upload failed")
    } finally {
      setUploadingCert(false)
    }
  }

  const onSubmit = async (values: LabTestForm) => {
    setSaving(true)
    try {
      const payload = {
        batch_number: values.batch_number.trim(),
        test_date: values.test_date,
        lab_name: values.lab_name.trim(),
        status: values.status,
        certificate_url: values.certificate_url || null,
      }

      if (isNew) {
        const { data, error } = await supabase
          .from("lab_tests")
          .insert({ ...payload, created_by: userProfile?.id ?? null })
          .select("id")
          .single()
        if (error) throw error
        toast.success("Lab test created")
        router.replace(`/dashboard/lab-tests/${data.id}`)
      } else {
        const { error } = await supabase
          .from("lab_tests")
          .update(payload)
          .eq("id", id)
        if (error) throw error
        toast.success("Lab test saved")
      }
    } catch (error: any) {
      console.error("Save failed:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        raw: error,
      })
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <Link href="/dashboard/lab-tests">
              <ArrowLeft />
              Back to lab tests
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {isNew ? "New Lab Test" : "Edit Lab Test"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isNew
                    ? "Record a lab test for a product batch"
                    : `Batch: ${batchNumber || "—"}`}
                </p>
              </div>
            </div>
            <Button
              type="submit"
              disabled={saving || !form.formState.isValid}
            >
              <Save />
              {saving ? "Saving…" : "Save lab test"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lab Test Details</CardTitle>
                <CardDescription>
                  Visible on the public website once saved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="batch_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Batch Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. BN-2026-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="test_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="lab_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lab Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. ABC Labs Pvt Ltd"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="passed">Passed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Certificate
                </CardTitle>
                <CardDescription>
                  PDF or image of the lab report
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {certificateUrl ? (
                  <div className="space-y-2">
                    <a
                      href={certificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded border text-sm hover:bg-muted"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">View certificate</span>
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        form.setValue("certificate_url", "", {
                          shouldDirty: true,
                        })
                      }
                    >
                      <X />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded p-6 text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/40"
                    onClick={() => certInputRef.current?.click()}
                  >
                    {uploadingCert
                      ? "Uploading…"
                      : "Click to upload PDF or image"}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => certInputRef.current?.click()}
                  disabled={uploadingCert}
                >
                  <Upload />
                  {certificateUrl ? "Replace" : "Upload"}
                </Button>
                <input
                  ref={certInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadCertificate(file)
                    e.target.value = ""
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  )
}
