"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, AlertCircle, X, Search, User, Phone, Mail, Award, Paperclip, Image as ImageIcon, Video } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  mobile_primary: string
  mobile_secondary_1: string | null
  mobile_secondary_2: string | null
  whatsapp_number: string | null
  vip_number: string | null
  is_vip: boolean
}

type Order = {
  id: string
  order_number: string
  customer_id: string
  order_status: string | null
  payment_status: string | null
  total_amount: number | null
  created_at: string
}

type SupportUser = {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
}

type SupportTicket = {
  id: string
  ticket_number: string
  customer_id: string
  order_id: string | null
  customer_name?: string
  order_number?: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  assigned_to: string | null
  resolution: string | null
  satisfaction_rating: number | null
  is_escalated: boolean
  first_response_time_minutes: number | null
  resolution_time_minutes: number | null
  created_at: string
}

type TicketFormData = {
  customer_id: string
  order_id: string | null
  subject: string
  description: string
  category: string
  priority: string
  status: string
  assigned_to: string
  is_escalated: boolean
  attachments: string[]
}

const categoryOptions = [
  { value: "order_issue", label: "Order Issue" },
  { value: "delivery_issue", label: "Delivery Issue" },
  { value: "product_inquiry", label: "Product Inquiry" },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "refund_request", label: "Refund Request" },
  { value: "complaint", label: "Complaint" },
  { value: "technical_issue", label: "Technical Issue" },
  { value: "account_issue", label: "Account Issue" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" }
]

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
  { value: "critical", label: "Critical" }
]

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_customer", label: "Pending Customer" },
  { value: "on_hold", label: "On Hold" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" }
]

export default function SupportTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [escalatedFilter, setEscalatedFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null)
  const [deletingTicket, setDeletingTicket] = useState<SupportTicket | null>(null)
  const [saving, setSaving] = useState(false)

  // Customer search states
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCustomerOrders, setSelectedCustomerOrders] = useState<Order[]>([])
  const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false)

  // File upload states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<{ url: string; type: 'image' | 'video' }[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const [formData, setFormData] = useState<TicketFormData>({
    customer_id: "",
    order_id: null,
    subject: "",
    description: "",
    category: "other",
    priority: "medium",
    status: "open",
    assigned_to: "",
    is_escalated: false,
    attachments: [],
  })

  useEffect(() => {
    fetchTicketsAndRelatedData()
  }, [])

  // Update filtered customers when customer search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCustomers(customerSearchTerm)
    }, 300) // Debounce for 300ms

    return () => clearTimeout(timeoutId)
  }, [customerSearchTerm])

  const fetchTicketsAndRelatedData = async () => {
    setLoading(true)

    // Fetch tickets
    const { data: ticketsData, error: ticketsError } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })

    if (ticketsError) {
      console.error("Error fetching tickets:", ticketsError)
      toast.error("Failed to fetch tickets")
      setLoading(false)
      return
    }

    // Fetch related data
    const customerIds = [...new Set(ticketsData?.map((t) => t.customer_id))]
    const orderIds = [...new Set(ticketsData?.map((t) => t.order_id).filter(Boolean))]

    const [{ data: customersData }, { data: ordersData }] = await Promise.all([
      supabase.from("customers").select("id, first_name, last_name, email").in("id", customerIds),
      orderIds.length > 0
        ? supabase.from("orders").select("id, order_number").in("id", orderIds)
        : Promise.resolve({ data: [] }),
    ])

    // Create lookup maps
    const customerMap = new Map(
      customersData?.map((c) => [c.id, `${c.first_name} ${c.last_name}`])
    )
    const orderMap = new Map(ordersData?.map((o) => [o.id, o.order_number]))

    // Add related data to tickets
    const enrichedTickets = ticketsData?.map((ticket) => ({
      ...ticket,
      customer_name: customerMap.get(ticket.customer_id) || "Unknown",
      order_number: ticket.order_id ? orderMap.get(ticket.order_id) : undefined,
    }))

    // Fetch all active customers for form dropdowns (limit to active customers to keep it manageable)
    const { data: allCustomers } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, mobile_primary, mobile_secondary_1, mobile_secondary_2, whatsapp_number, vip_number, is_vip")
      .eq("is_active", true)
      .order("first_name")
      .limit(5000) // Increase limit to get more customers

    // Fetch customer support users
    const { data: supportUsersData } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active")
      .eq("role", "customer_support")
      .eq("is_active", true)
      .order("email")

    setTickets(enrichedTickets || [])
    setCustomers(allCustomers || [])
    setSupportUsers(supportUsersData || [])
    setLoading(false)
  }

  // Search customers directly from database
  const searchCustomers = async (term: string) => {
    console.log("searchCustomers called with:", term)

    if (!term || term.length < 2) {
      setFilteredCustomers([])
      return
    }

    try {
      const searchTerm = `%${term.trim()}%`

      // Search directly in database for better performance
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, mobile_primary, mobile_secondary_1, mobile_secondary_2, whatsapp_number, vip_number, is_vip")
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},mobile_primary.ilike.${searchTerm},mobile_secondary_1.ilike.${searchTerm},mobile_secondary_2.ilike.${searchTerm},whatsapp_number.ilike.${searchTerm},vip_number.ilike.${searchTerm}`)
        .eq("is_active", true)
        .order("first_name")
        .limit(20)

      if (error) {
        console.error("Error searching customers:", error)
        setFilteredCustomers([])
        return
      }

      console.log(`Found ${data?.length || 0} customers matching "${term}"`)
      if (data && data.length > 0) {
        console.log("First match:", `${data[0].first_name} ${data[0].last_name}`)
      }

      setFilteredCustomers(data || [])
    } catch (error) {
      console.error("Error in searchCustomers:", error)
      setFilteredCustomers([])
    }
  }

  // Fetch orders for selected customer
  const fetchCustomerOrders = async (customerId: string) => {
    setLoadingCustomerOrders(true)
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) throw error
      setSelectedCustomerOrders(data || [])
    } catch (error) {
      console.error("Error fetching customer orders:", error)
      setSelectedCustomerOrders([])
    } finally {
      setLoadingCustomerOrders(false)
    }
  }

  // File handling functions
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

    // Limit to 5 files total
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
      const fileName = `tickets/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

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

  const clearFileSelection = () => {
    // Revoke all preview URLs
    filePreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
    setSelectedFiles([])
    setFilePreviews([])
  }

  const handleOpenDialog = async (ticket?: SupportTicket) => {
    setCustomerSearchTerm("")
    setFilteredCustomers([])
    setSelectedCustomerOrders([])
    setSelectedCustomer(null)
    clearFileSelection()

    if (ticket) {
      setEditingTicket(ticket)
      setFormData({
        customer_id: ticket.customer_id,
        order_id: ticket.order_id,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        assigned_to: ticket.assigned_to || "",
        is_escalated: ticket.is_escalated,
        attachments: [],
      })
      // Fetch customer details and orders for this customer
      if (ticket.customer_id) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("id, first_name, last_name, email, mobile_primary, mobile_secondary_1, mobile_secondary_2, whatsapp_number, vip_number, is_vip")
          .eq("id", ticket.customer_id)
          .single()

        if (customerData) {
          setSelectedCustomer(customerData)
        }
        fetchCustomerOrders(ticket.customer_id)
      }
    } else {
      setEditingTicket(null)
      setFormData({
        customer_id: "",
        order_id: null,
        subject: "",
        description: "",
        category: "other",
        priority: "medium",
        status: "open",
        assigned_to: "",
        is_escalated: false,
        attachments: [],
      })
    }
    setDialogOpen(true)
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setFormData({ ...formData, customer_id: customer.id, order_id: null })
    setCustomerSearchOpen(false)
    setCustomerSearchTerm("")
    fetchCustomerOrders(customer.id)
  }

  const getSelectedCustomer = () => {
    return selectedCustomer
  }

  const generateTicketNumber = () => {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
    return `TKT-${timestamp}-${random}`
  }

  const handleSave = async () => {
    if (!formData.customer_id || !formData.subject) {
      toast.error("Please fill in all required fields")
      return
    }

    setSaving(true)
    setUploadingFiles(true)

    try {
      // Upload files first
      let uploadedUrls: string[] = []
      if (selectedFiles.length > 0) {
        uploadedUrls = await uploadFiles()
      }

      const dataToSave = {
        ...formData,
        order_id: formData.order_id || null,
        assigned_to: formData.assigned_to || null,
        attachments: uploadedUrls.length > 0 ? uploadedUrls : null,
      }

      if (editingTicket) {
        const { error } = await supabase
          .from("support_tickets")
          .update(dataToSave)
          .eq("id", editingTicket.id)

        if (error) throw error
        toast.success("Ticket updated successfully")
      } else {
        const { error } = await supabase.from("support_tickets").insert([
          {
            ...dataToSave,
            ticket_number: generateTicketNumber(),
          },
        ])

        if (error) throw error
        toast.success("Ticket created successfully")
      }

      clearFileSelection()
      setDialogOpen(false)
      fetchTicketsAndRelatedData()
    } catch (error: unknown) {
      console.error("Error saving ticket:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save ticket"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
      setUploadingFiles(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTicket) return

    try {
      const { error } = await supabase
        .from("support_tickets")
        .delete()
        .eq("id", deletingTicket.id)

      if (error) throw error

      toast.success("Ticket deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingTicket(null)
      fetchTicketsAndRelatedData()
    } catch (error: unknown) {
      console.error("Error deleting ticket:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete ticket"
      toast.error(errorMessage)
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.customer_name && ticket.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.status.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || ticket.status.toLowerCase() === statusFilter.toLowerCase()
    const matchesPriority = priorityFilter === "all" || ticket.priority.toLowerCase() === priorityFilter.toLowerCase()
    const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter
    const matchesEscalated = escalatedFilter === "all" ||
      (escalatedFilter === "escalated" && ticket.is_escalated) ||
      (escalatedFilter === "normal" && !ticket.is_escalated)

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesEscalated
  })

  const clearAllFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setPriorityFilter("all")
    setCategoryFilter("all")
    setEscalatedFilter("all")
  }

  const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all" || escalatedFilter !== "all"

  const getPriorityVariant = (priority: string) => {
    const lowerPriority = priority.toLowerCase()
    if (lowerPriority === "high" || lowerPriority === "urgent") return "destructive"
    if (lowerPriority === "medium") return "outline"
    return "secondary"
  }

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus === "resolved" || lowerStatus === "closed") return "default"
    if (lowerStatus === "in progress" || lowerStatus === "in_progress") return "outline"
    if (lowerStatus === "pending" || lowerStatus === "open") return "secondary"
    return "secondary"
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Support Tickets</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support Tickets</h1>
          <p className="text-muted-foreground">Manage customer support requests</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Create Ticket
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket List</CardTitle>
          <CardDescription>All customer support tickets with status and priority</CardDescription>
          <div className="mt-4 space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearAllFilters} size="sm">
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {priorityOptions.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={escalatedFilter} onValueChange={setEscalatedFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by escalation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tickets</SelectItem>
                  <SelectItem value="escalated">Escalated Only</SelectItem>
                  <SelectItem value="normal">Normal Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No tickets found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                    >
                      <TableCell className="font-medium">
                        {ticket.ticket_number}
                        {ticket.is_escalated && (
                          <Badge variant="destructive" className="ml-2">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Escalated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ticket.customer_name}</div>
                          {ticket.order_number && (
                            <div className="text-xs text-muted-foreground">
                              Order: {ticket.order_number}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{ticket.subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ticket.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPriorityVariant(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge>
                      </TableCell>
                      <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDialog(ticket)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingTicket(ticket)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredTickets.length} of {tickets.length} tickets
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTicket ? "Edit Ticket" : "Create New Ticket"}
            </DialogTitle>
            <DialogDescription>
              {editingTicket
                ? "Update ticket information"
                : "Enter ticket details to create a new support ticket"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Customer Search Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Customer Information</h3>
                <p className="text-sm text-muted-foreground">Search and select customer</p>
              </div>

              <div className="space-y-2">
                <Label>Customer *</Label>
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      className="w-full justify-between"
                    >
                      {formData.customer_id ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>
                            {getSelectedCustomer()?.first_name?.trim()} {getSelectedCustomer()?.last_name?.trim()}
                          </span>
                          {getSelectedCustomer()?.is_vip && (
                            <Badge variant="default" className="ml-2">
                              <Award className="h-3 w-3 mr-1" />
                              VIP
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Search customer...</span>
                      )}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by name, phone, email, VIP number..."
                        onValueChange={(value) => {
                          setCustomerSearchTerm(value)
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {customerSearchTerm.length < 2
                            ? "Type at least 2 characters to search..."
                            : "No customers found."}
                        </CommandEmpty>
                        {filteredCustomers.length > 0 && (
                          <CommandGroup>
                            {filteredCustomers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={`${customer.first_name} ${customer.last_name} ${customer.mobile_primary}`}
                                onSelect={() => handleCustomerSelect(customer)}
                                className="flex flex-col items-start gap-1 py-3"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <User className="h-4 w-4" />
                                  <span className="font-medium">
                                    {customer.first_name?.trim()} {customer.last_name?.trim()}
                                  </span>
                                  {customer.is_vip && (
                                    <Badge variant="default" className="ml-auto">
                                      <Award className="h-3 w-3 mr-1" />
                                      VIP {customer.vip_number?.trim()}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground ml-6">
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {customer.mobile_primary}
                                  </span>
                                  {customer.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {customer.email}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Display selected customer details */}
                {formData.customer_id && getSelectedCustomer() && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{getSelectedCustomer()?.mobile_primary}</span>
                      {getSelectedCustomer()?.mobile_secondary_1 && (
                        <span className="text-sm text-muted-foreground">
                          • {getSelectedCustomer()?.mobile_secondary_1}
                        </span>
                      )}
                    </div>
                    {getSelectedCustomer()?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{getSelectedCustomer()?.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Related Orders Section */}
              {formData.customer_id && (
                <div className="space-y-2">
                  <Label>Related Order (Optional)</Label>
                  {loadingCustomerOrders ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      Loading orders...
                    </div>
                  ) : selectedCustomerOrders.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 border rounded-md">
                      No orders found for this customer
                    </div>
                  ) : (
                    <Select
                      value={formData.order_id || "none"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, order_id: value === "none" ? null : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Order</SelectItem>
                        {selectedCustomerOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span className="font-medium">{order.order_number}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString()}
                              </span>
                              {order.total_amount && (
                                <span className="text-xs">
                                  ₹{order.total_amount.toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the issue"
                rows={4}
              />
            </div>

            {/* Attachments Section */}
            <div className="space-y-3">
              <Label>Attachments (Images/Videos)</Label>

              {/* File Previews */}
              {filePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      {preview.type === "image" ? (
                        <Image
                          src={preview.url}
                          alt={`Preview ${index + 1}`}
                          width={100}
                          height={100}
                          className="rounded border object-cover"
                        />
                      ) : (
                        <div className="w-[100px] h-[100px] rounded border bg-muted flex items-center justify-center">
                          <Video className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {preview.type === "video" && (
                        <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">
                          Video
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="ticket-file-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("ticket-file-upload")?.click()}
                  disabled={uploadingFiles || selectedFiles.length >= 5}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attach Files ({selectedFiles.length}/5)
                </Button>
                {selectedFiles.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFileSelection}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Clear All
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Max 5 files. Images up to 10MB, Videos up to 50MB each.
              </p>
            </div>

            {/* Ticket Details Section */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Ticket Details</h3>
                <p className="text-sm text-muted-foreground">Category, priority, status, and assignment</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {category.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger id="priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                priority.value === "urgent" || priority.value === "critical"
                                  ? "bg-red-600 animate-pulse"
                                  : priority.value === "high"
                                  ? "bg-red-500"
                                  : priority.value === "medium"
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }`}
                            />
                            <Badge
                              variant={
                                priority.value === "urgent" || priority.value === "critical" || priority.value === "high"
                                  ? "destructive"
                                  : priority.value === "medium"
                                  ? "outline"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {priority.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.priority && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          formData.priority === "urgent" || formData.priority === "critical"
                            ? "bg-red-600 animate-pulse"
                            : formData.priority === "high"
                            ? "bg-red-500"
                            : formData.priority === "medium"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                      />
                      <span>
                        {formData.priority === "urgent" || formData.priority === "critical"
                          ? "Requires immediate attention"
                          : formData.priority === "high"
                          ? "High priority - respond soon"
                          : formData.priority === "medium"
                          ? "Normal priority"
                          : "Low priority - can wait"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                status.value === "resolved" || status.value === "closed"
                                  ? "bg-green-500"
                                  : status.value === "in_progress"
                                  ? "bg-blue-500 animate-pulse"
                                  : status.value === "pending_customer" || status.value === "on_hold"
                                  ? "bg-yellow-500"
                                  : "bg-gray-500"
                              }`}
                            />
                            <Badge
                              variant={
                                status.value === "resolved" || status.value === "closed"
                                  ? "default"
                                  : status.value === "in_progress"
                                  ? "outline"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {status.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.status && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          formData.status === "resolved" || formData.status === "closed"
                            ? "bg-green-500"
                            : formData.status === "in_progress"
                            ? "bg-blue-500 animate-pulse"
                            : formData.status === "pending_customer" || formData.status === "on_hold"
                            ? "bg-yellow-500"
                            : "bg-gray-500"
                        }`}
                      />
                      <span>
                        {formData.status === "resolved" || formData.status === "closed"
                          ? "Ticket has been resolved"
                          : formData.status === "in_progress"
                          ? "Currently being worked on"
                          : formData.status === "pending_customer"
                          ? "Waiting for customer response"
                          : formData.status === "on_hold"
                          ? "Ticket is on hold"
                          : "New ticket"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assigned To (Optional)</Label>
                  <Select
                    value={formData.assigned_to || "unassigned"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, assigned_to: value === "unassigned" ? "" : value })
                    }
                  >
                    <SelectTrigger id="assigned_to" className="w-full">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>Unassigned</span>
                        </div>
                      </SelectItem>
                      {supportUsers.map((user) => (
                        <SelectItem key={user.id} value={user.email}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {user.full_name || user.email.split("@")[0]}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.assigned_to && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Assigned to {formData.assigned_to}</span>
                    </div>
                  )}
                  {!formData.assigned_to && (
                    <p className="text-xs text-muted-foreground">
                      Ticket will remain unassigned
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_escalated"
                checked={formData.is_escalated}
                onChange={(e) => setFormData({ ...formData, is_escalated: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="is_escalated" className="cursor-pointer">
                Mark as Escalated
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || uploadingFiles}>
              {uploadingFiles ? "Uploading files..." : saving ? "Saving..." : editingTicket ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the ticket{" "}
              <strong>{deletingTicket?.ticket_number}</strong> ({deletingTicket?.subject}). This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
