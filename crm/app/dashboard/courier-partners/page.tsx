"use client"

import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Plus,
  Trash2,
  Edit,
  Search,
  Truck,
  AlertCircle,
  ExternalLink,
  Package,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileText,
  Calendar,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

type CourierPartner = {
  id: string
  name: string
  code: string
  phone: string | null
  email: string | null
  website: string | null
  tracking_url_template: string | null
  default_delivery_days: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type CourierPartnerPincode = {
  id: string
  courier_partner_id: string
  pincode: string
  is_serviceable: boolean
  created_at: string
  updated_at: string
}

type CourierPartnerFormData = {
  name: string
  code: string
  phone: string
  email: string
  website: string
  tracking_url_template: string
  default_delivery_days: string
  notes: string
  is_active: boolean
}

export default function CourierPartnersPage() {
  const [courierPartners, setCourierPartners] = useState<CourierPartner[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCourier, setEditingCourier] = useState<CourierPartner | null>(null)
  const [deletingCourier, setDeletingCourier] = useState<CourierPartner | null>(null)
  const [saving, setSaving] = useState(false)
  const [pincodes, setPincodes] = useState<CourierPartnerPincode[]>([])
  const [newPincodes, setNewPincodes] = useState("")
  const [loadingPincodes, setLoadingPincodes] = useState(false)

  const [formData, setFormData] = useState<CourierPartnerFormData>({
    name: "",
    code: "",
    phone: "",
    email: "",
    website: "",
    tracking_url_template: "",
    default_delivery_days: "",
    notes: "",
    is_active: true,
  })

  const [usageStats, setUsageStats] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchCourierPartners()
  }, [])

  const fetchCourierPartners = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("courier_partners")
        .select("*")
        .order("name")

      if (error) throw error

      setCourierPartners(data || [])

      // Fetch usage statistics
      const { data: orders } = await supabase
        .from("orders")
        .select("courier_partner")

      if (orders) {
        const stats: Record<string, number> = {}
        orders.forEach((order) => {
          if (order.courier_partner) {
            stats[order.courier_partner] = (stats[order.courier_partner] || 0) + 1
          }
        })
        setUsageStats(stats)
      }
    } catch (error: unknown) {
      console.error("Error fetching courier partners:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to load courier partners"
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchPincodes = async (courierId: string) => {
    setLoadingPincodes(true)
    try {
      const { data, error } = await supabase
        .from("courier_partner_pincodes")
        .select("*")
        .eq("courier_partner_id", courierId)
        .order("pincode")

      if (error) throw error
      setPincodes(data || [])
    } catch (error: unknown) {
      console.error("Error fetching pincodes:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to load pincodes"
      toast.error(errorMessage)
    } finally {
      setLoadingPincodes(false)
    }
  }

  const handleOpenDialog = (courier?: CourierPartner) => {
    if (courier) {
      setEditingCourier(courier)
      setFormData({
        name: courier.name,
        code: courier.code,
        phone: courier.phone || "",
        email: courier.email || "",
        website: courier.website || "",
        tracking_url_template: courier.tracking_url_template || "",
        default_delivery_days: courier.default_delivery_days?.toString() || "",
        notes: courier.notes || "",
        is_active: courier.is_active,
      })
      fetchPincodes(courier.id)
    } else {
      setEditingCourier(null)
      setFormData({
        name: "",
        code: "",
        phone: "",
        email: "",
        website: "",
        tracking_url_template: "",
        default_delivery_days: "",
        notes: "",
        is_active: true,
      })
      setPincodes([])
    }
    setNewPincodes("")
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Name and Code are required")
      return
    }

    // Validate tracking URL template if provided
    if (formData.tracking_url_template && !formData.tracking_url_template.includes("{tracking_number}")) {
      toast.error("Tracking URL template must contain {tracking_number} placeholder")
      return
    }

    // Validate URL formats
    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      toast.error("Website must be a valid URL starting with http:// or https://")
      return
    }

    if (formData.tracking_url_template && !formData.tracking_url_template.match(/^https?:\/\/.+/)) {
      toast.error("Tracking URL must be a valid URL starting with http:// or https://")
      return
    }

    // Validate email format
    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error("Please enter a valid email address")
      return
    }

    setSaving(true)

    try {
      const courierData = {
        name: formData.name.trim(),
        code: formData.code.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website: formData.website.trim() || null,
        tracking_url_template: formData.tracking_url_template.trim() || null,
        default_delivery_days: formData.default_delivery_days ? parseInt(formData.default_delivery_days) : null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
      }

      if (editingCourier) {
        const { error } = await supabase
          .from("courier_partners")
          .update(courierData)
          .eq("id", editingCourier.id)

        if (error) throw error
        toast.success("Courier partner updated successfully")
      } else {
        const { error } = await supabase
          .from("courier_partners")
          .insert([courierData])

        if (error) throw error
        toast.success("Courier partner created successfully")
      }

      setDialogOpen(false)
      await fetchCourierPartners()
    } catch (error: unknown) {
      console.error("Error saving courier partner:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save courier partner"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCourier) return

    // Check if courier is being used
    const usageCount = usageStats[deletingCourier.code] || 0
    if (usageCount > 0) {
      toast.error(`Cannot delete courier partner that is used in ${usageCount} orders. Consider deactivating instead.`)
      setDeleteDialogOpen(false)
      return
    }

    try {
      const { error } = await supabase
        .from("courier_partners")
        .delete()
        .eq("id", deletingCourier.id)

      if (error) throw error

      toast.success("Courier partner deleted successfully")
      setDeleteDialogOpen(false)
      await fetchCourierPartners()
    } catch (error: unknown) {
      console.error("Error deleting courier partner:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete courier partner"
      toast.error(errorMessage)
    }
  }

  const handleToggleActive = async (courier: CourierPartner) => {
    try {
      const { error } = await supabase
        .from("courier_partners")
        .update({ is_active: !courier.is_active })
        .eq("id", courier.id)

      if (error) throw error

      toast.success(courier.is_active ? "Courier partner deactivated" : "Courier partner activated")
      await fetchCourierPartners()
    } catch (error: unknown) {
      console.error("Error toggling courier partner status:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update status"
      toast.error(errorMessage)
    }
  }

  const handleAddPincodes = async () => {
    if (!editingCourier || !newPincodes.trim()) {
      toast.error("Please enter pincodes")
      return
    }

    try {
      // Parse pincodes from comma/newline separated input
      const pincodeList = newPincodes
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter((p) => p.length === 6 && /^\d+$/.test(p))

      if (pincodeList.length === 0) {
        toast.error("Please enter valid 6-digit pincodes")
        return
      }

      const pincodeData = pincodeList.map((pincode) => ({
        courier_partner_id: editingCourier.id,
        pincode,
        is_serviceable: true,
      }))

      const { error } = await supabase
        .from("courier_partner_pincodes")
        .insert(pincodeData)

      if (error) throw error

      toast.success(`${pincodeList.length} pincodes added successfully`)
      setNewPincodes("")
      await fetchPincodes(editingCourier.id)
    } catch (error: unknown) {
      console.error("Error adding pincodes:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to add pincodes"
      toast.error(errorMessage)
    }
  }

  const handleDeletePincode = async (pincodeId: string) => {
    try {
      const { error } = await supabase
        .from("courier_partner_pincodes")
        .delete()
        .eq("id", pincodeId)

      if (error) throw error

      toast.success("Pincode removed")
      if (editingCourier) {
        await fetchPincodes(editingCourier.id)
      }
    } catch (error: unknown) {
      console.error("Error deleting pincode:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to remove pincode"
      toast.error(errorMessage)
    }
  }

  const handleTogglePincodeServiceable = async (pincode: CourierPartnerPincode) => {
    try {
      const { error } = await supabase
        .from("courier_partner_pincodes")
        .update({ is_serviceable: !pincode.is_serviceable })
        .eq("id", pincode.id)

      if (error) throw error

      toast.success(pincode.is_serviceable ? "Pincode marked as non-serviceable" : "Pincode marked as serviceable")
      if (editingCourier) {
        await fetchPincodes(editingCourier.id)
      }
    } catch (error: unknown) {
      console.error("Error toggling pincode status:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update pincode"
      toast.error(errorMessage)
    }
  }

  const filteredCouriers = courierPartners.filter(
    (courier) =>
      courier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      courier.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      courier.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      courier.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Courier Partners</h1>
            <p className="text-sm text-muted-foreground">Manage courier and logistics partners for order shipping</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Courier Partner
          </Button>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/50">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Courier Partners List</CardTitle>
                <CardDescription className="mt-0.5">View and manage all courier partners</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredCouriers.length} {filteredCouriers.length === 1 ? "partner" : "partners"}
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, phone, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-[320px] pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCouriers.length === 0 ? (
            <div className="p-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {searchQuery ? "No courier partners found matching your search" : "No courier partners found"}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-auto">
              <Table className="min-w-[1100px] w-full">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Name</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Code</TableHead>
                    <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Contact</TableHead>
                    <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px]">Delivery Days</TableHead>
                    <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px]">Pincodes</TableHead>
                    <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px]">Orders</TableHead>
                    <TableHead className="text-center font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                    <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCouriers.map((courier) => (
                    <TableRow key={courier.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{courier.name}</div>
                            {courier.tracking_url_template && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />
                                Tracking available
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full font-mono">
                          {courier.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {courier.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {courier.phone}
                            </div>
                          )}
                          {courier.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {courier.email}
                            </div>
                          )}
                          {courier.website && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              <a
                                href={courier.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                Website
                              </a>
                            </div>
                          )}
                          {!courier.phone && !courier.email && !courier.website && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {courier.default_delivery_days ? (
                          <div className="flex items-center justify-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>{courier.default_delivery_days} days</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="rounded-full">0</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="rounded-full">{usageStats[courier.code] || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={courier.is_active}
                          onCheckedChange={() => handleToggleActive(courier)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(courier)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingCourier(courier)
                              setDeleteDialogOpen(true)
                            }}
                            disabled={usageStats[courier.code] > 0}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base">{editingCourier ? "Edit Courier Partner" : "Add Courier Partner"}</DialogTitle>
                <DialogDescription className="mt-0.5">
                  {editingCourier
                    ? "Update courier partner information and manage serviceable pincodes"
                    : "Enter courier partner details to add a new courier"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-4 pt-2 pb-4">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Partner Details</TabsTrigger>
              <TabsTrigger value="pincodes" disabled={!editingCourier}>
                Serviceable Pincodes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Delhivery"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">
                    Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
                    placeholder="e.g., delhivery"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">Unique identifier (lowercase, no spaces)</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@courier.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website URL</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://www.courier.com"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Shipping Configuration</h4>
                <div className="space-y-2">
                  <Label htmlFor="tracking_url">Tracking URL Template</Label>
                  <Input
                    id="tracking_url"
                    value={formData.tracking_url_template}
                    onChange={(e) => setFormData({ ...formData, tracking_url_template: e.target.value })}
                    placeholder="https://courier.com/track/{tracking_number}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{tracking_number}"} as placeholder for auto-generating tracking links
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery_days">Default Delivery Days</Label>
                  <Input
                    id="delivery_days"
                    type="number"
                    min="1"
                    value={formData.default_delivery_days}
                    onChange={(e) => setFormData({ ...formData, default_delivery_days: e.target.value })}
                    placeholder="e.g., 3"
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used to auto-calculate expected delivery dates
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal notes about this courier partner..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Active Status</Label>
                  <div className="text-sm text-muted-foreground">
                    Only active courier partners appear in order forms
                  </div>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </TabsContent>

            <TabsContent value="pincodes" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_pincodes">Add Pincodes (Bulk)</Label>
                  <Textarea
                    id="new_pincodes"
                    value={newPincodes}
                    onChange={(e) => setNewPincodes(e.target.value)}
                    placeholder="Enter pincodes separated by comma or newline&#10;e.g., 400001, 400002, 400003&#10;or&#10;400001&#10;400002&#10;400003"
                    rows={4}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Enter 6-digit pincodes only</p>
                    <Button onClick={handleAddPincodes} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Pincodes
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Serviceable Pincodes ({pincodes.length})</Label>
                    {loadingPincodes && <span className="text-sm text-muted-foreground">Loading...</span>}
                  </div>

                  {pincodes.length === 0 ? (
                    <Alert>
                      <MapPin className="h-4 w-4" />
                      <AlertDescription>
                        No pincodes added yet. Add pincodes to track serviceable areas.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pincode</TableHead>
                            <TableHead className="text-center">Serviceable</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pincodes.map((pincode) => (
                            <TableRow key={pincode.id}>
                              <TableCell className="font-mono">{pincode.pincode}</TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={pincode.is_serviceable}
                                  onCheckedChange={() => handleTogglePincodeServiceable(pincode)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeletePincode(pincode.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          </div>

          <DialogFooter className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur px-4 py-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingCourier ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Courier Partner</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingCourier?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
