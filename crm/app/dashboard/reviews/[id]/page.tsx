"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/hooks/use-user-role"
import { ProductCombobox, type Product } from "@/components/ui/product-combobox"
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
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { toast } from "sonner"
import { ArrowLeft, Save, Sparkles, Star } from "lucide-react"

type Rating = 1 | 2 | 3 | 4 | 5

const reviewSchema = z.object({
  product_id: z.string(),
  product_name: z.string(),
  reviewer_name: z.string().trim().min(1, "Reviewer name is required"),
  rating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  title: z.string(),
  body: z.string().trim().min(1, "Body is required"),
  is_published: z.boolean(),
  is_ai_generated: z.boolean(),
})

type ReviewForm = z.infer<typeof reviewSchema>

export default function ReviewEditorPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { userProfile, role, loading: roleLoading } = useUserRole()

  const id = params.id
  const isNew = id === "new"

  const form = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    mode: "onChange",
    defaultValues: {
      product_id: "",
      product_name: "",
      reviewer_name: "",
      rating: 5,
      title: "",
      body: "",
      is_published: true,
      is_ai_generated: false,
    },
  })

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const [aiTone, setAiTone] = useState("")
  const [aiExtra, setAiExtra] = useState("")
  const [generating, setGenerating] = useState(false)

  const productName = form.watch("product_name")

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
          .from("reviews")
          .select("*")
          .eq("id", id)
          .single()
        if (error) throw error
        form.reset({
          product_id: data.product_id || "",
          product_name: data.product_name || "",
          reviewer_name: data.reviewer_name || "",
          rating: (data.rating as Rating) || 5,
          title: data.title || "",
          body: data.body || "",
          is_published: !!data.is_published,
          is_ai_generated: !!data.is_ai_generated,
        })
      } catch (error: any) {
        console.error("Failed to load review:", error)
        toast.error(error?.message || "Failed to load review")
        router.replace("/dashboard/reviews")
      } finally {
        setLoading(false)
      }
    })()
  }, [id, isNew, roleLoading, role, router, form])

  const onProductChange = (pid: string, p: Product | null) => {
    form.setValue("product_id", pid, { shouldDirty: true })
    if (p?.name) {
      form.setValue("product_name", p.name, { shouldDirty: true })
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const values = form.getValues()
      const res = await fetch("/api/ai/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: values.product_id || undefined,
          productName: values.product_name || undefined,
          rating: values.rating,
          reviewerName: values.reviewer_name || undefined,
          tone: aiTone,
          extra: aiExtra,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Generation failed")
      if (data.productId) {
        form.setValue("product_id", data.productId, { shouldDirty: true })
      }
      if (data.productName) {
        form.setValue("product_name", data.productName, { shouldDirty: true })
      }
      if (data.reviewerName) {
        form.setValue("reviewer_name", data.reviewerName, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
      if (data.title) {
        form.setValue("title", data.title, { shouldDirty: true })
      }
      if (data.body) {
        form.setValue("body", data.body, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
      form.setValue("is_ai_generated", true, { shouldDirty: true })
      toast.success("Draft generated")
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate")
    } finally {
      setGenerating(false)
    }
  }

  const onSubmit = async (values: ReviewForm) => {
    setSaving(true)
    try {
      const payload = {
        product_id: values.product_id || null,
        product_name: values.product_name.trim() || null,
        reviewer_name: values.reviewer_name.trim(),
        rating: values.rating,
        title: values.title.trim() || null,
        body: values.body.trim(),
        is_published: values.is_published,
        is_ai_generated: values.is_ai_generated,
      }

      if (isNew) {
        const { data, error } = await supabase
          .from("reviews")
          .insert({ ...payload, created_by: userProfile?.id ?? null })
          .select("id")
          .single()
        if (error) throw error
        toast.success("Review created")
        router.replace(`/dashboard/reviews/${data.id}`)
      } else {
        const { error } = await supabase
          .from("reviews")
          .update(payload)
          .eq("id", id)
        if (error) throw error
        toast.success("Review saved")
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <Link href="/dashboard/reviews">
              <ArrowLeft />
              Back to reviews
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {isNew ? "New Review" : "Edit Review"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isNew
                    ? "Add a product review for the public website"
                    : productName || "—"}
                </p>
              </div>
            </div>
            <Button
              type="submit"
              disabled={saving || !form.formState.isValid}
            >
              <Save />
              {saving ? "Saving…" : "Save review"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review Details</CardTitle>
                <CardDescription>
                  Visible on the public website when published.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product</FormLabel>
                      <FormControl>
                        <ProductCombobox
                          value={field.value}
                          onValueChange={onProductChange}
                          placeholder="Select product…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reviewer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reviewer Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Priya S." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rating *</FormLabel>
                        <FormControl>
                          <StarPicker
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional headline" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What did the reviewer think?"
                          rows={6}
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
                <CardTitle className="text-base">Visibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="is_published"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3 space-y-0">
                      <div>
                        <FormLabel className="font-medium">Published</FormLabel>
                        <FormDescription className="text-xs">
                          Show on the public site
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_ai_generated"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3 space-y-0">
                      <div>
                        <FormLabel className="font-medium">
                          AI generated
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Tag for internal tracking
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </CardTitle>
                <CardDescription>
                  Drafts a title + body for the selected product using Gemini.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ai_tone">Tone</Label>
                  <Input
                    id="ai_tone"
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    placeholder="warm, conversational (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai_extra">Extra context</Label>
                  <Textarea
                    id="ai_extra"
                    value={aiExtra}
                    onChange={(e) => setAiExtra(e.target.value)}
                    placeholder="Anything specific to mention (optional)"
                    rows={3}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full"
                >
                  <Sparkles />
                  {generating ? "Generating…" : "Generate review"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Leave product and reviewer blank to let AI pick them randomly.
                  Overwrites title and body.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  )
}

function StarPicker({
  value,
  onChange,
}: {
  value: Rating
  onChange: (r: Rating) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n as Rating)}
          className="p-0.5"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={
              n <= value
                ? "h-6 w-6 fill-amber-400 text-amber-400"
                : "h-6 w-6 text-muted-foreground/40"
            }
          />
        </button>
      ))}
    </div>
  )
}
