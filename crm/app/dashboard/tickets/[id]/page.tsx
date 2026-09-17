"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Package,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Send,
  Award,
  Image as ImageIcon,
  X,
  Paperclip,
  Video,
} from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  mobile_primary: string
  mobile_secondary_1: string | null
  is_vip: boolean
  vip_number: string | null
}

type Order = {
  id: string
  order_number: string
  order_status: string | null
  total_amount: number | null
  created_at: string
}

type TicketMessage = {
  id: string
  ticket_id: string
  message: string
  sender_type: string
  sender_name: string | null
  sender_email: string | null
  is_internal: boolean
  attachments: string[] | null
  created_at: string
}

type Ticket = {
  id: string
  ticket_number: string
  customer_id: string
  order_id: string | null
  subject: string
  description: string
  category: string
  priority: string
  status: string
  assigned_to: string | null
  is_escalated: boolean
  resolution: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

const categoryLabels: Record<string, string> = {
  order_issue: "Order Issue",
  delivery_issue: "Delivery Issue",
  product_inquiry: "Product Inquiry",
  payment_issue: "Payment Issue",
  refund_request: "Refund Request",
  complaint: "Complaint",
  technical_issue: "Technical Issue",
  account_issue: "Account Issue",
  feedback: "Feedback",
  other: "Other",
}

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
}

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending_customer: "Pending Customer",
  on_hold: "On Hold",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [filePreviews, setFilePreviews] = useState<{ url: string; type: 'image' | 'video' }[]>([])

  useEffect(() => {
    if (ticketId) {
      fetchTicketData()
    }
  }, [ticketId])

  const fetchTicketData = async () => {
    try {
      setLoading(true)

      // Fetch ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .single()

      if (ticketError) throw ticketError

      setTicket(ticketData)

      // Fetch customer
      if (ticketData.customer_id) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("id, first_name, last_name, email, mobile_primary, mobile_secondary_1, is_vip, vip_number")
          .eq("id", ticketData.customer_id)
          .single()

        setCustomer(customerData)
      }

      // Fetch order if exists
      if (ticketData.order_id) {
        const { data: orderData } = await supabase
          .from("orders")
          .select("id, order_number, order_status, total_amount, created_at")
          .eq("id", ticketData.order_id)
          .single()

        setOrder(orderData)
      }

      // Fetch messages
      const { data: messagesData } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })

      setMessages(messagesData || [])
    } catch (error) {
      console.error("Error fetching ticket data:", error)
      toast.error("Failed to load ticket details")
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter((file) =>
      file.type.startsWith("image/") || file.type.startsWith("video/")
    )

    if (validFiles.length === 0) {
      toast.error("Please select only image or video files")
      return
    }

    // Check file size (max 50MB for videos, 10MB for images)
    const oversizedFiles = validFiles.filter((file) => {
      const maxSize = file.type.startsWith("video/") ? 50 * 1024 * 1024 : 10 * 1024 * 1024
      return file.size > maxSize
    })

    if (oversizedFiles.length > 0) {
      toast.error("Some files are too large. Max 50MB for videos, 10MB for images")
      return
    }

    // Limit to 5 files
    if (selectedFiles.length + validFiles.length > 5) {
      toast.error("Maximum 5 files allowed")
      return
    }

    setSelectedFiles([...selectedFiles, ...validFiles])

    // Create previews
    const newPreviews = validFiles.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video/") ? "video" as const : "image" as const
    }))
    setFilePreviews([...filePreviews, ...newPreviews])
  }

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    const newPreviews = filePreviews.filter((_, i) => i !== index)

    // Revoke the URL to free memory
    URL.revokeObjectURL(filePreviews[index].url)

    setSelectedFiles(newFiles)
    setFilePreviews(newPreviews)
  }

  const uploadFiles = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return []

    const uploadedUrls: string[] = []

    for (const file of selectedFiles) {
      const fileExt = file.name.split(".").pop()
      const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { data, error } = await supabase.storage
        .from("ticket-attachments")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (error) {
        console.error("Error uploading file:", error)
        throw error
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("ticket-attachments").getPublicUrl(data.path)

      uploadedUrls.push(publicUrl)
    }

    return uploadedUrls
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) {
      toast.error("Please enter a message or select files")
      return
    }

    try {
      setSendingMessage(true)
      setUploadingFiles(true)

      // Upload files first
      const fileUrls = await uploadFiles()

      // Send message with attachments
      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        message: newMessage.trim() || "(Attachment)",
        sender_type: "agent",
        sender_name: "Support Agent",
        is_internal: false,
        attachments: fileUrls,
      })

      if (error) throw error

      toast.success("Message sent successfully")
      setNewMessage("")
      setSelectedFiles([])
      setFilePreviews([])
      fetchTicketData() // Refresh messages
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
    } finally {
      setSendingMessage(false)
      setUploadingFiles(false)
    }
  }

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "urgent":
      case "critical":
        return "border-red-300 bg-red-500/15 text-red-700 dark:text-red-400"
      case "high":
        return "border-orange-300 bg-orange-500/15 text-orange-700 dark:text-orange-400"
      case "medium":
        return "border-amber-300 bg-amber-500/15 text-amber-700 dark:text-amber-400"
      case "low":
        return "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      default:
        return "border-border bg-muted text-foreground"
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "resolved":
      case "closed":
        return "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      case "in_progress":
        return "border-blue-300 bg-blue-500/15 text-blue-700 dark:text-blue-400"
      case "pending_customer":
      case "on_hold":
        return "border-amber-300 bg-amber-500/15 text-amber-700 dark:text-amber-400"
      case "cancelled":
        return "border-red-300 bg-red-500/15 text-red-700 dark:text-red-400"
      default:
        return "border-border bg-muted text-foreground"
    }
  }

  const getInitials = (firstName?: string | null, lastName?: string | null, fallback?: string | null) => {
    const f = (firstName?.[0] ?? "").toUpperCase()
    const l = (lastName?.[0] ?? "").toUpperCase()
    return (f + l) || (fallback?.[0]?.toUpperCase() ?? "?")
  }

  if (loading) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1 text-center">
          <h2 className="font-heading text-xl font-semibold">Ticket not found</h2>
          <p className="text-sm text-muted-foreground">It may have been deleted or the link is incorrect.</p>
        </div>
        <Button onClick={() => router.push("/dashboard/tickets")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tickets
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
    <div className="space-y-5">
      {/* Page Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => router.push("/dashboard/tickets")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                {ticket.ticket_number}
              </h1>
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wide">
                {categoryLabels[ticket.category]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{ticket.subject}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`${getPriorityBadgeClass(ticket.priority)}`}>
            {priorityLabels[ticket.priority]}
          </Badge>
          <Badge variant="outline" className={`${getStatusBadgeClass(ticket.status)}`}>
            {statusLabels[ticket.status]}
          </Badge>
          {ticket.is_escalated && (
            <Badge variant="destructive" className="gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground/70 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-destructive-foreground" />
              </span>
              Escalated
            </Badge>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-5 lg:col-span-2">
          {/* Ticket Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Ticket Details
              </CardTitle>
              <CardDescription>Description and category information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {ticket.description}
                </p>
              </div>
              {ticket.resolution && (
                <div className="rounded-lg border-l-4 border-l-emerald-500 bg-emerald-500/5 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Resolution
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {ticket.resolution}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Conversation
                </CardTitle>
                <CardDescription>All messages exchanged on this ticket</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono">
                {messages.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No messages yet — start the conversation below.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[480px] pr-3">
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isAgent = message.sender_type === "agent"
                      const senderLabel = message.sender_name || message.sender_email || "Unknown"
                      return (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${isAgent ? "flex-row-reverse" : ""}`}
                        >
                          <Avatar size="sm" className="mt-0.5 shrink-0">
                            <AvatarFallback
                              className={
                                isAgent
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {senderLabel.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`min-w-0 flex-1 space-y-1 ${isAgent ? "items-end text-right" : ""}`}>
                            <div className={`flex items-center gap-2 ${isAgent ? "justify-end" : ""}`}>
                              <span className="text-xs font-medium">{senderLabel}</span>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {message.sender_type}
                              </Badge>
                              {message.is_internal && (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px]">
                                  Internal
                                </Badge>
                              )}
                            </div>
                            <div
                              className={`inline-block max-w-full rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed ${
                                isAgent
                                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                                  : "rounded-tl-sm bg-muted text-foreground"
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{message.message}</p>
                            </div>
                            <p className="text-[10px] tabular-nums text-muted-foreground">
                              {new Date(message.created_at).toLocaleString()}
                            </p>

                            {/* Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className={`mt-1 flex flex-wrap gap-2 ${isAgent ? "justify-end" : ""}`}>
                                {message.attachments.map((url, idx) => {
                                  const isVideo = /\.(mp4|webm|ogg|mov|avi)$/i.test(url)
                                  return isVideo ? (
                                    <div key={idx} className="overflow-hidden rounded-lg border bg-muted">
                                      <video
                                        src={url}
                                        controls
                                        className="block max-h-[200px] max-w-[300px]"
                                      >
                                        Your browser does not support the video tag.
                                      </video>
                                    </div>
                                  ) : (
                                    <a
                                      key={idx}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group relative overflow-hidden rounded-lg border bg-muted ring-1 ring-border transition-shadow hover:ring-primary/40"
                                    >
                                      <Image
                                        src={url}
                                        alt={`Attachment ${idx + 1}`}
                                        width={160}
                                        height={160}
                                        className="block size-[120px] object-cover transition-transform group-hover:scale-105"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                        <ImageIcon className="h-5 w-5 text-white" />
                                      </div>
                                    </a>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}

              <Separator />

              {/* New Message */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Add Response
                  </Label>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {newMessage.length} chars
                  </span>
                </div>
                <Textarea
                  placeholder="Type your response here…"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  className="resize-y"
                />

                {/* File Previews */}
                {filePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {filePreviews.map((preview, index) => (
                      <div key={index} className="group relative">
                        {preview.type === "image" ? (
                          <Image
                            src={preview.url}
                            alt={`Preview ${index + 1}`}
                            width={100}
                            height={100}
                            className="size-[88px] rounded-lg border bg-muted object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="flex size-[88px] items-center justify-center rounded-lg border bg-muted ring-1 ring-border">
                            <Video className="h-7 w-7 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 ring-2 ring-background transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {preview.type === "video" && (
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">
                            VIDEO
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                    disabled={uploadingFiles || selectedFiles.length >= 5}
                    className="h-10"
                  >
                    <Paperclip className="mr-2 h-4 w-4" />
                    Attach Files
                    <Badge variant="secondary" className="ml-1.5 font-mono text-[10px]">
                      {selectedFiles.length}/5
                    </Badge>
                  </Button>

                  <Button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || uploadingFiles || (!newMessage.trim() && selectedFiles.length === 0)}
                    className="h-10 flex-1"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {uploadingFiles ? "Uploading…" : sendingMessage ? "Sending…" : "Send Response"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Customer Info */}
          {customer && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(customer.first_name, customer.last_name, customer.mobile_primary)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold">
                      {customer.first_name?.trim()} {customer.last_name?.trim()}
                    </p>
                    {customer.is_vip && (
                      <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400">
                        <Award className="h-3 w-3" />
                        Sd {customer.vip_number}
                      </Badge>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono tabular-nums">{customer.mobile_primary}</span>
                  </div>
                  {customer.mobile_secondary_1 && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono tabular-nums">{customer.mobile_secondary_1}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="break-all text-xs">{customer.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Info */}
          {order && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Related Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Order Number
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums">{order.order_number}</p>
                </div>
                {order.order_status && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>
                    <Badge variant="outline" className="capitalize">{order.order_status}</Badge>
                  </div>
                )}
                {order.total_amount && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Amount
                    </p>
                    <p className="font-heading text-base font-semibold tabular-nums">
                      ₹{order.total_amount.toLocaleString("en-IN")}
                    </p>
                  </div>
                )}
                <div className="space-y-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Order Date
                  </p>
                  <p className="text-sm tabular-nums">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ticket Meta — timeline style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {ticket.assigned_to && (
                  <li className="relative">
                    <span className="absolute -left-[26px] top-0.5 flex size-4 items-center justify-center rounded-full bg-blue-500/15 ring-2 ring-background">
                      <User className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                    </span>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Assigned To
                    </p>
                    <p className="text-sm font-medium">{ticket.assigned_to}</p>
                  </li>
                )}
                <li className="relative">
                  <span className="absolute -left-[26px] top-0.5 flex size-4 items-center justify-center rounded-full bg-muted ring-2 ring-background">
                    <Calendar className="h-2.5 w-2.5 text-muted-foreground" />
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Created
                  </p>
                  <p className="text-sm tabular-nums">{new Date(ticket.created_at).toLocaleString()}</p>
                </li>
                <li className="relative">
                  <span className="absolute -left-[26px] top-0.5 flex size-4 items-center justify-center rounded-full bg-muted ring-2 ring-background">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Last Updated
                  </p>
                  <p className="text-sm tabular-nums">{new Date(ticket.updated_at).toLocaleString()}</p>
                </li>
                {ticket.resolved_at && (
                  <li className="relative">
                    <span className="absolute -left-[26px] top-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-background">
                      <CheckCircle className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Resolved
                    </p>
                    <p className="text-sm tabular-nums">{new Date(ticket.resolved_at).toLocaleString()}</p>
                  </li>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
