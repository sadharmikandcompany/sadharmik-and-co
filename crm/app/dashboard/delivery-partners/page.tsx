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
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, X, Link2, Unlink } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DeliveryPartner = {
  id: string
  name: string
  email: string | null
  mobile: string
  vehicle_type: string | null
  vehicle_number: string | null
  city: string | null
  state: string | null
  serviceable_pincodes: string[] | null
  assigned_godown_ids: string[] | null
  is_active: boolean
  is_available: boolean
  average_rating: number | null
  total_deliveries: number | null
  created_at: string
  linked_user?: {
    email: string
    full_name: string | null
  } | null
  assigned_warehouses?: Array<{
    id: string
    name: string
    godown_code: string
  }>
}

type DeliveryPartnerFormData = {
  name: string
  email: string
  mobile: string
  mobile_secondary_1: string
  mobile_secondary_2: string
  vehicle_type: string
  vehicle_number: string
  license_number: string
  flat_number: string
  floor_wing: string
  building_name: string
  street_name: string
  landmark: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  pincode: string
  country: string
  aadhar_number: string
  pan_number: string
  aadhar_card_url: string
  pan_card_url: string
  photo_url: string
  police_verification_url: string
  serviceable_pincodes: string[]
  assigned_godown_ids: string[]
  is_active: boolean
  is_available: boolean
}

type Godown = {
  id: string
  name: string
  godown_code: string
  godown_type: string
  city: string | null
  state: string | null
}

type User = {
  id: string
  email: string
  full_name: string | null
  role: string
  delivery_partner_id: string | null
}

export default function DeliveryPartnersPage() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [linkUserDialogOpen, setLinkUserDialogOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null)
  const [deletingPartner, setDeletingPartner] = useState<DeliveryPartner | null>(null)
  const [linkingPartner, setLinkingPartner] = useState<DeliveryPartner | null>(null)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [pincodeInput, setPincodeInput] = useState("")
  const [pincodeError, setPincodeError] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Godown[]>([])

  const [formData, setFormData] = useState<DeliveryPartnerFormData>({
    name: "",
    email: "",
    mobile: "",
    mobile_secondary_1: "",
    mobile_secondary_2: "",
    vehicle_type: "",
    vehicle_number: "",
    license_number: "",
    flat_number: "",
    floor_wing: "",
    building_name: "",
    street_name: "",
    landmark: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    aadhar_number: "",
    pan_number: "",
    aadhar_card_url: "",
    pan_card_url: "",
    photo_url: "",
    police_verification_url: "",
    serviceable_pincodes: [],
    assigned_godown_ids: [],
    is_active: true,
    is_available: true,
  })

  useEffect(() => {
    fetchPartners()
    fetchUsers()
    fetchWarehouses()
  }, [])

  const fetchWarehouses = async () => {
    const { data, error } = await supabase
      .from("godowns")
      .select("id, name, godown_code, godown_type, city, state")
      .eq("is_active", true)
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching warehouses:", error)
      toast.error("Failed to fetch warehouses")
      return
    }

    setWarehouses(data || [])
  }

  const fetchPartners = async () => {
    setLoading(true)
    const { data: partnersData, error } = await supabase
      .from("delivery_partners")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching delivery partners:", error)
      toast.error("Failed to fetch delivery partners")
      setLoading(false)
      return
    }

    // Fetch linked users for each delivery partner
    const partnerIds = partnersData?.map(p => p.id) || []
    const { data: usersData } = await supabase
      .from("users")
      .select("delivery_partner_id, email, full_name")
      .in("delivery_partner_id", partnerIds)

    // Create a map of delivery_partner_id to user
    const userMap = new Map(usersData?.map(u => [u.delivery_partner_id, u]))

    // Fetch warehouse details for assigned warehouses
    const allWarehouseIds = partnersData?.flatMap(p => p.assigned_godown_ids || []).filter(Boolean) || []
    const uniqueWarehouseIds = [...new Set(allWarehouseIds)]

    const warehouseMap = new Map()
    if (uniqueWarehouseIds.length > 0) {
      const { data: warehousesData } = await supabase
        .from("godowns")
        .select("id, name, godown_code")
        .in("id", uniqueWarehouseIds)

      warehousesData?.forEach(w => warehouseMap.set(w.id, w))
    }

    // Enrich partners with linked user data and warehouse details
    const enrichedPartners = partnersData?.map(partner => ({
      ...partner,
      linked_user: userMap.get(partner.id) || null,
      assigned_warehouses: (partner.assigned_godown_ids || [])
        .map((id: string) => warehouseMap.get(id))
        .filter(Boolean)
    }))

    setPartners(enrichedPartners || [])
    setLoading(false)
  }

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, delivery_partner_id")
      .order("email", { ascending: true })

    if (error) {
      console.error("Error fetching users:", error)
      toast.error("Failed to fetch users")
      return
    }

    setUsers(data || [])
  }

  const handleOpenDialog = (partner?: DeliveryPartner) => {
    setFormErrors({}) // Clear errors when opening dialog
    setPincodeInput("")
    setPincodeError("")
    if (partner) {
      setEditingPartner(partner)
      // Fetch full partner data to populate form
      setFormData({
        name: partner.name,
        email: partner.email || "",
        mobile: partner.mobile,
        mobile_secondary_1: (partner as any).mobile_secondary_1 || "",
        mobile_secondary_2: (partner as any).mobile_secondary_2 || "",
        vehicle_type: partner.vehicle_type || "",
        vehicle_number: partner.vehicle_number || "",
        license_number: (partner as any).license_number || "",
        flat_number: (partner as any).flat_number || "",
        floor_wing: (partner as any).floor_wing || "",
        building_name: (partner as any).building_name || "",
        street_name: (partner as any).street_name || "",
        landmark: (partner as any).landmark || "",
        address_line1: (partner as any).address_line1 || "",
        address_line2: (partner as any).address_line2 || "",
        city: partner.city || "",
        state: partner.state || "",
        pincode: (partner as any).pincode || "",
        country: (partner as any).country || "India",
        aadhar_number: (partner as any).aadhar_number || "",
        pan_number: (partner as any).pan_number || "",
        aadhar_card_url: (partner as any).aadhar_card_url || "",
        pan_card_url: (partner as any).pan_card_url || "",
        photo_url: (partner as any).photo_url || "",
        police_verification_url: (partner as any).police_verification_url || "",
        serviceable_pincodes: partner.serviceable_pincodes || [],
        assigned_godown_ids: partner.assigned_godown_ids || [],
        is_active: partner.is_active,
        is_available: partner.is_available,
      })
    } else {
      setEditingPartner(null)
      setFormData({
        name: "",
        email: "",
        mobile: "",
        mobile_secondary_1: "",
        mobile_secondary_2: "",
        vehicle_type: "",
        vehicle_number: "",
        license_number: "",
        flat_number: "",
        floor_wing: "",
        building_name: "",
        street_name: "",
        landmark: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        pincode: "",
        country: "India",
        aadhar_number: "",
        pan_number: "",
        aadhar_card_url: "",
        pan_card_url: "",
        photo_url: "",
        police_verification_url: "",
        serviceable_pincodes: [],
        assigned_godown_ids: [],
        is_active: true,
        is_available: true,
      })
    }
    setDialogOpen(true)
  }

  const validatePincode = (pincode: string): boolean => {
    // Indian pincode must be exactly 6 digits
    const pincodeRegex = /^\d{6}$/
    return pincodeRegex.test(pincode)
  }

  const handleAddPincode = () => {
    const trimmed = pincodeInput.trim()

    if (!trimmed) {
      setPincodeError("Pincode cannot be empty")
      return
    }

    if (!validatePincode(trimmed)) {
      setPincodeError("Pincode must be exactly 6 digits")
      return
    }

    if (formData.serviceable_pincodes.includes(trimmed)) {
      setPincodeError("Pincode already added")
      return
    }

    setFormData({
      ...formData,
      serviceable_pincodes: [...formData.serviceable_pincodes, trimmed],
    })
    setPincodeInput("")
    setPincodeError("")
  }

  const handleRemovePincode = (pincode: string) => {
    setFormData({
      ...formData,
      serviceable_pincodes: formData.serviceable_pincodes.filter((p) => p !== pincode),
    })
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    // Name validation
    if (!formData.name.trim()) {
      errors.name = "Name is required"
    }

    // Mobile validation - exactly 10 digits
    const mobileRegex = /^\d{10}$/
    if (!formData.mobile.match(mobileRegex)) {
      errors.mobile = "Mobile number must be exactly 10 digits"
    }

    // Secondary mobile validation - optional but must be 10 digits if provided
    if (formData.mobile_secondary_1 && formData.mobile_secondary_1.trim().length > 0) {
      if (!formData.mobile_secondary_1.match(mobileRegex)) {
        errors.mobile_secondary_1 = "Mobile number must be exactly 10 digits"
      }
    }

    if (formData.mobile_secondary_2 && formData.mobile_secondary_2.trim().length > 0) {
      if (!formData.mobile_secondary_2.match(mobileRegex)) {
        errors.mobile_secondary_2 = "Mobile number must be exactly 10 digits"
      }
    }

    // Email validation - optional but must be valid if provided
    if (formData.email && formData.email.trim().length > 0) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
      if (!formData.email.match(emailRegex)) {
        errors.email = "Please enter a valid email address"
      }
    }

    // Pincode validation - 6 digits if provided
    if (formData.pincode && formData.pincode.trim().length > 0) {
      const pincodeRegex = /^\d{6}$/
      if (!formData.pincode.match(pincodeRegex)) {
        errors.pincode = "Pincode must be exactly 6 digits"
      }
    }

    // Aadhar validation - 12 digits if provided
    if (formData.aadhar_number && formData.aadhar_number.trim().length > 0) {
      const aadharRegex = /^\d{12}$/
      if (!formData.aadhar_number.match(aadharRegex)) {
        errors.aadhar_number = "Aadhar number must be exactly 12 digits"
      }
    }

    // PAN validation - 10 characters (5 letters, 4 digits, 1 letter) if provided
    if (formData.pan_number && formData.pan_number.trim().length > 0) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
      if (!formData.pan_number.match(panRegex)) {
        errors.pan_number = "PAN must be in format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)"
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix the validation errors before saving")
      return
    }

    setSaving(true)

    try {
      if (editingPartner) {
        const { error } = await supabase
          .from("delivery_partners")
          .update(formData)
          .eq("id", editingPartner.id)

        if (error) throw error
        toast.success("Delivery partner updated successfully")
      } else {
        const { error } = await supabase
          .from("delivery_partners")
          .insert([formData])

        if (error) throw error
        toast.success("Delivery partner created successfully")
      }

      setDialogOpen(false)
      fetchPartners()
    } catch (error: unknown) {
      console.error("Error saving delivery partner:", error)
      
      if (error && typeof error === "object" && "code" in error) {
        const dbError = error as { code: string; message: string }

        if (dbError.code === "23505") {
          if (dbError.message.includes("email")) {
            toast.error("This email is already registered")
          } else if (dbError.message.includes("partner_code")) {
            toast.error("This partner code already exists")
          } else {
            toast.error("A delivery partner with this information already exists")
          }
        } else {
          const errorMessage = error instanceof Error ? error.message : "Failed to save delivery partner"
          toast.error(errorMessage)
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : "Failed to save delivery partner"
        toast.error(errorMessage)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingPartner) return

    try {
      const { error } = await supabase
        .from("delivery_partners")
        .delete()
        .eq("id", deletingPartner.id)

      if (error) throw error

      toast.success("Delivery partner deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingPartner(null)
      fetchPartners()
    } catch (error: unknown) {
      console.error("Error deleting delivery partner:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete delivery partner"
      toast.error(errorMessage)
    }
  }

  const handleOpenLinkUserDialog = (partner: DeliveryPartner) => {
    setLinkingPartner(partner)
    setSelectedUserId("")
    setLinkUserDialogOpen(true)
  }

  const handleLinkUser = async () => {
    if (!linkingPartner || !selectedUserId) {
      toast.error("Please select a user to link")
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from("users")
        .update({ delivery_partner_id: linkingPartner.id })
        .eq("id", selectedUserId)

      if (error) throw error

      toast.success("User linked to delivery partner successfully")
      setLinkUserDialogOpen(false)
      setLinkingPartner(null)
      setSelectedUserId("")
      fetchPartners()
      fetchUsers()
    } catch (error: unknown) {
      console.error("Error linking user:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to link user"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleUnlinkUser = async (partner: DeliveryPartner) => {
    if (!partner.linked_user) return

    try {
      const { error } = await supabase
        .from("users")
        .update({ delivery_partner_id: null })
        .eq("delivery_partner_id", partner.id)

      if (error) throw error

      toast.success("User unlinked from delivery partner successfully")
      fetchPartners()
      fetchUsers()
    } catch (error: unknown) {
      console.error("Error unlinking user:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to unlink user"
      toast.error(errorMessage)
    }
  }

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    documentType: 'aadhar_card' | 'pan_card' | 'photo' | 'police_verification'
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPEG, PNG, WEBP) or PDF file')
      return
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploadingDoc(documentType)

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${documentType}_${Date.now()}.${fileExt}`
      const filePath = `delivery-partners/${fileName}`

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl

      // Update form data with the URL
      const fieldMap = {
        'aadhar_card': 'aadhar_card_url',
        'pan_card': 'pan_card_url',
        'photo': 'photo_url',
        'police_verification': 'police_verification_url'
      }

      setFormData({
        ...formData,
        [fieldMap[documentType]]: publicUrl
      })

      toast.success(`${documentType.replace('_', ' ')} uploaded successfully`)
    } catch (error: unknown) {
      console.error('Error uploading file:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
      toast.error(errorMessage)
    } finally {
      setUploadingDoc(null)
      // Reset input
      event.target.value = ''
    }
  }

  const handleRemoveDocument = (documentType: 'aadhar_card_url' | 'pan_card_url' | 'photo_url' | 'police_verification_url') => {
    setFormData({
      ...formData,
      [documentType]: ''
    })
    toast.success('Document removed')
  }

  const filteredPartners = partners.filter(
    (partner) =>
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (partner.email && partner.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      partner.mobile.includes(searchTerm) ||
      (partner.vehicle_number && partner.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Delivery Partners</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Delivery Partners</h1>
          <p className="text-muted-foreground">Manage your delivery partner network</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Delivery Partner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Partner List</CardTitle>
          <CardDescription>
            A list of all delivery partners with their details and performance
          </CardDescription>
          <div className="mt-4">
            <Input
              placeholder="Search partners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned Warehouses</TableHead>
                  <TableHead>Serviceable Pincodes</TableHead>
                  <TableHead>Linked User</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      No delivery partners found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPartners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">
                        {partner.name}
                      </TableCell>
                      <TableCell>{partner.mobile}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{partner.vehicle_type || "-"}</div>
                          {partner.vehicle_number && (
                            <div className="text-muted-foreground">
                              {partner.vehicle_number}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {partner.city && partner.state
                          ? `${partner.city}, ${partner.state}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {partner.assigned_warehouses && partner.assigned_warehouses.length > 0 ? (
                            <>
                              {partner.assigned_warehouses.slice(0, 2).map((warehouse) => (
                                <Badge key={warehouse.id} variant="default" className="text-xs">
                                  {warehouse.name}
                                </Badge>
                              ))}
                              {partner.assigned_warehouses.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{partner.assigned_warehouses.length - 2}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">No warehouses</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {partner.serviceable_pincodes && partner.serviceable_pincodes.length > 0 ? (
                            <>
                              {partner.serviceable_pincodes.slice(0, 3).map((pincode, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {pincode}
                                </Badge>
                              ))}
                              {partner.serviceable_pincodes.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{partner.serviceable_pincodes.length - 3}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">No pincodes</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {partner.linked_user ? (
                          <div className="text-sm">
                            <div className="font-medium">
                              {partner.linked_user.full_name || "No name"}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {partner.linked_user.email}
                            </div>
                            <div className="flex gap-1 mt-1">
                              <Badge variant="default" className="text-xs">
                                Linked
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => handleUnlinkUser(partner)}
                              >
                                <Unlink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm">
                            <Badge variant="secondary" className="text-xs">
                              Not Linked
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 mt-1 text-xs"
                              onClick={() => handleOpenLinkUserDialog(partner)}
                            >
                              <Link2 className="h-3 w-3 mr-1" />
                              Link User
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>
                            {partner.average_rating !== null
                              ? `⭐ ${partner.average_rating.toFixed(1)}`
                              : "-"}
                          </div>
                          <div className="text-muted-foreground">
                            {partner.total_deliveries || 0} deliveries
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={partner.is_active ? "default" : "secondary"}>
                            {partner.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {partner.is_active && (
                            <Badge variant={partner.is_available ? "outline" : "secondary"}>
                              {partner.is_available ? "Available" : "Busy"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(partner)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingPartner(partner)
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
            Showing {filteredPartners.length} of {partners.length} delivery partners
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="!w-[85vw] !max-w-5xl max-h-[95vh] overflow-y-auto sm:!max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {editingPartner ? "Edit Delivery Partner" : "Add New Delivery Partner"}
            </DialogTitle>
            <DialogDescription>
              {editingPartner
                ? "Update delivery partner information"
                : "Enter delivery partner details to create a new partner"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className={formErrors.name ? "border-red-500" : ""}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-500">{formErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile *</Label>
                <Input
                  id="mobile"
                  value={formData.mobile}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "")
                    setFormData({ ...formData, mobile: value })
                  }}
                  required
                  maxLength={10}
                  placeholder="10 digit mobile number"
                  className={formErrors.mobile ? "border-red-500" : ""}
                />
                {formErrors.mobile && (
                  <p className="text-sm text-red-500">{formErrors.mobile}</p>
                )}
                {formData.mobile && formData.mobile.length > 0 && !formErrors.mobile && (
                  <p className="text-sm text-muted-foreground">{formData.mobile.length}/10 digits</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Optional"
                  className={formErrors.email ? "border-red-500" : ""}
                />
                {formErrors.email && (
                  <p className="text-sm text-red-500">{formErrors.email}</p>
                )}
              </div>
            </div>

            {/* Secondary Mobile Numbers */}
            <div className="space-y-2">
              <Label className="font-semibold">Secondary Mobile Numbers</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_1">Mobile (Secondary 1)</Label>
                  <Input
                    id="mobile_secondary_1"
                    value={formData.mobile_secondary_1}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, mobile_secondary_1: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit mobile number (Optional)"
                    className={formErrors.mobile_secondary_1 ? "border-red-500" : ""}
                  />
                  {formErrors.mobile_secondary_1 && (
                    <p className="text-sm text-red-500">{formErrors.mobile_secondary_1}</p>
                  )}
                  {formData.mobile_secondary_1 && formData.mobile_secondary_1.length > 0 && !formErrors.mobile_secondary_1 && (
                    <p className="text-sm text-muted-foreground">{formData.mobile_secondary_1.length}/10 digits</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile_secondary_2">Mobile (Secondary 2)</Label>
                  <Input
                    id="mobile_secondary_2"
                    value={formData.mobile_secondary_2}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, mobile_secondary_2: value })
                    }}
                    maxLength={10}
                    placeholder="10 digit mobile number (Optional)"
                    className={formErrors.mobile_secondary_2 ? "border-red-500" : ""}
                  />
                  {formErrors.mobile_secondary_2 && (
                    <p className="text-sm text-red-500">{formErrors.mobile_secondary_2}</p>
                  )}
                  {formData.mobile_secondary_2 && formData.mobile_secondary_2.length > 0 && !formErrors.mobile_secondary_2 && (
                    <p className="text-sm text-muted-foreground">{formData.mobile_secondary_2.length}/10 digits</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Vehicle Type</Label>
                <Input
                  id="vehicle_type"
                  placeholder="e.g., Bike, Car, Van"
                  value={formData.vehicle_type}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicle_type: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_number">Vehicle Number</Label>
                <Input
                  id="vehicle_number"
                  value={formData.vehicle_number}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicle_number: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) =>
                    setFormData({ ...formData, license_number: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Address</Label>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="Flat Number"
                    value={formData.flat_number}
                    onChange={(e) =>
                      setFormData({ ...formData, flat_number: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Floor / Wing"
                    value={formData.floor_wing}
                    onChange={(e) =>
                      setFormData({ ...formData, floor_wing: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Building Name / Plot Number"
                    value={formData.building_name}
                    onChange={(e) =>
                      setFormData({ ...formData, building_name: e.target.value })
                    }
                  />
                </div>
                <Input
                  placeholder="Street Name and Area"
                  value={formData.street_name}
                  onChange={(e) =>
                    setFormData({ ...formData, street_name: e.target.value })
                  }
                />
                <Input
                  placeholder="Landmark"
                  value={formData.landmark}
                  onChange={(e) =>
                    setFormData({ ...formData, landmark: e.target.value })
                  }
                />
                <Input
                  placeholder="Address Line 1"
                  value={formData.address_line1}
                  onChange={(e) =>
                    setFormData({ ...formData, address_line1: e.target.value })
                  }
                />
                <Input
                  placeholder="Address Line 2"
                  value={formData.address_line2}
                  onChange={(e) =>
                    setFormData({ ...formData, address_line2: e.target.value })
                  }
                />
                <div className="grid grid-cols-4 gap-3">
                  <Input
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                  <Input
                    placeholder="State"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                  />
                  <div className="space-y-1">
                    <Input
                      placeholder="Pincode"
                      value={formData.pincode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "")
                        setFormData({ ...formData, pincode: value })
                      }}
                      maxLength={6}
                      className={formErrors.pincode ? "border-red-500" : ""}
                    />
                    {formErrors.pincode && (
                      <p className="text-xs text-red-500">{formErrors.pincode}</p>
                    )}
                    {formData.pincode && formData.pincode.length > 0 && !formErrors.pincode && (
                      <p className="text-xs text-muted-foreground">{formData.pincode.length}/6 digits</p>
                    )}
                  </div>
                  <Input
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Aadhar and PAN */}
            <div className="space-y-2">
              <Label className="font-semibold">Aadhar Number and PAN</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aadhar_number">Aadhar Number</Label>
                  <Input
                    id="aadhar_number"
                    value={formData.aadhar_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, aadhar_number: value })
                    }}
                    maxLength={12}
                    placeholder="12 digit Aadhar number"
                    className={formErrors.aadhar_number ? "border-red-500" : ""}
                  />
                  {formErrors.aadhar_number && (
                    <p className="text-sm text-red-500">{formErrors.aadhar_number}</p>
                  )}
                  {formData.aadhar_number && formData.aadhar_number.length > 0 && !formErrors.aadhar_number && (
                    <p className="text-sm text-muted-foreground">{formData.aadhar_number.length}/12 digits</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_number">PAN</Label>
                  <Input
                    id="pan_number"
                    value={formData.pan_number}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase()
                      setFormData({ ...formData, pan_number: value })
                    }}
                    maxLength={10}
                    placeholder="10 character PAN number"
                    className={formErrors.pan_number ? "border-red-500" : ""}
                  />
                  {formErrors.pan_number && (
                    <p className="text-sm text-red-500">{formErrors.pan_number}</p>
                  )}
                  {formData.pan_number && formData.pan_number.length > 0 && !formErrors.pan_number && (
                    <p className="text-sm text-muted-foreground">{formData.pan_number.length}/10 characters</p>
                  )}
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <Label className="font-semibold">Documents</Label>
              <p className="text-sm text-muted-foreground">
                Upload documents (Images or PDF, max 5MB)
              </p>
              <div className="grid gap-4">
                {/* Aadhar Card */}
                <div className="space-y-2">
                  <Label htmlFor="aadhar_card_url">Aadhar Card</Label>
                  <div className="flex gap-2">
                    <Input
                      id="aadhar_card_url"
                      value={formData.aadhar_card_url}
                      onChange={(e) =>
                        setFormData({ ...formData, aadhar_card_url: e.target.value })
                      }
                      placeholder="URL to Aadhar card document"
                      className="flex-1"
                    />
                    <input
                      type="file"
                      id="aadhar_card_upload"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, 'aadhar_card')}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('aadhar_card_upload')?.click()}
                      disabled={uploadingDoc === 'aadhar_card'}
                    >
                      {uploadingDoc === 'aadhar_card' ? 'Uploading...' : 'Upload'}
                    </Button>
                    {formData.aadhar_card_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDocument('aadhar_card_url')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.aadhar_card_url && (
                    <a
                      href={formData.aadhar_card_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View uploaded document
                    </a>
                  )}
                </div>

                {/* PAN Card */}
                <div className="space-y-2">
                  <Label htmlFor="pan_card_url">PAN Card</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pan_card_url"
                      value={formData.pan_card_url}
                      onChange={(e) =>
                        setFormData({ ...formData, pan_card_url: e.target.value })
                      }
                      placeholder="URL to PAN card document"
                      className="flex-1"
                    />
                    <input
                      type="file"
                      id="pan_card_upload"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, 'pan_card')}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('pan_card_upload')?.click()}
                      disabled={uploadingDoc === 'pan_card'}
                    >
                      {uploadingDoc === 'pan_card' ? 'Uploading...' : 'Upload'}
                    </Button>
                    {formData.pan_card_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDocument('pan_card_url')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.pan_card_url && (
                    <a
                      href={formData.pan_card_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View uploaded document
                    </a>
                  )}
                </div>

                {/* User Photo */}
                <div className="space-y-2">
                  <Label htmlFor="photo_url">User Photo</Label>
                  <div className="flex gap-2">
                    <Input
                      id="photo_url"
                      value={formData.photo_url}
                      onChange={(e) =>
                        setFormData({ ...formData, photo_url: e.target.value })
                      }
                      placeholder="URL to user photo"
                      className="flex-1"
                    />
                    <input
                      type="file"
                      id="photo_upload"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'photo')}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('photo_upload')?.click()}
                      disabled={uploadingDoc === 'photo'}
                    >
                      {uploadingDoc === 'photo' ? 'Uploading...' : 'Upload'}
                    </Button>
                    {formData.photo_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDocument('photo_url')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.photo_url && (
                    <div className="flex items-center gap-2">
                      <img
                        src={formData.photo_url}
                        alt="User photo preview"
                        className="h-16 w-16 object-cover rounded border"
                      />
                      <a
                        href={formData.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View full photo
                      </a>
                    </div>
                  )}
                </div>

                {/* Police Verification */}
                <div className="space-y-2">
                  <Label htmlFor="police_verification_url">Police Verification</Label>
                  <div className="flex gap-2">
                    <Input
                      id="police_verification_url"
                      value={formData.police_verification_url}
                      onChange={(e) =>
                        setFormData({ ...formData, police_verification_url: e.target.value })
                      }
                      placeholder="URL to police verification document"
                      className="flex-1"
                    />
                    <input
                      type="file"
                      id="police_verification_upload"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, 'police_verification')}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('police_verification_upload')?.click()}
                      disabled={uploadingDoc === 'police_verification'}
                    >
                      {uploadingDoc === 'police_verification' ? 'Uploading...' : 'Upload'}
                    </Button>
                    {formData.police_verification_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDocument('police_verification_url')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.police_verification_url && (
                    <a
                      href={formData.police_verification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View uploaded document
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Assigned Warehouses</Label>
              <p className="text-sm text-muted-foreground">
                Select which warehouses this delivery partner can work for
              </p>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-[200px] overflow-y-auto">
                {warehouses.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2">No warehouses available</p>
                ) : (
                  warehouses.map((warehouse) => (
                    <div key={warehouse.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`warehouse-${warehouse.id}`}
                        checked={formData.assigned_godown_ids.includes(warehouse.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              assigned_godown_ids: [...formData.assigned_godown_ids, warehouse.id]
                            })
                          } else {
                            setFormData({
                              ...formData,
                              assigned_godown_ids: formData.assigned_godown_ids.filter(id => id !== warehouse.id)
                            })
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <label
                        htmlFor={`warehouse-${warehouse.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        <div className="font-medium">{warehouse.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {warehouse.godown_code} • {warehouse.godown_type}
                          {warehouse.city && ` • ${warehouse.city}`}
                        </div>
                      </label>
                    </div>
                  ))
                )}
              </div>
              {formData.assigned_godown_ids.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formData.assigned_godown_ids.length} warehouse{formData.assigned_godown_ids.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Serviceable Pincodes</Label>
              <p className="text-sm text-muted-foreground">
                Define the pincodes where this partner can deliver
              </p>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    id="serviceable_pincodes"
                    placeholder="Enter 6-digit pincode and press Add"
                    value={pincodeInput}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/\D/g, '')
                      setPincodeInput(value)
                      setPincodeError("")
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddPincode()
                      }
                    }}
                    maxLength={6}
                    className={pincodeError ? "border-red-500" : ""}
                  />
                  {pincodeError && (
                    <p className="text-sm text-red-500">{pincodeError}</p>
                  )}
                  {pincodeInput && pincodeInput.length > 0 && !pincodeError && (
                    <p className="text-sm text-muted-foreground">
                      {pincodeInput.length}/6 digits
                    </p>
                  )}
                </div>
                <Button type="button" onClick={handleAddPincode} variant="outline">
                  Add
                </Button>
              </div>
              {formData.serviceable_pincodes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 rounded-md border p-3">
                  {formData.serviceable_pincodes.map((pincode) => (
                    <Badge key={pincode} variant="secondary" className="gap-1">
                      {pincode}
                      <button
                        type="button"
                        onClick={() => handleRemovePincode(pincode)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Partner Status</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span>Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_available}
                    onChange={(e) =>
                      setFormData({ ...formData, is_available: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span>Available for Assignments</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingPartner ? "Update" : "Create"}
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
              This will permanently delete the delivery partner{" "}
              <strong>{deletingPartner?.name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link User Dialog */}
      <Dialog open={linkUserDialogOpen} onOpenChange={setLinkUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link User to Delivery Partner</DialogTitle>
            <DialogDescription>
              Select a user account to link with <strong>{linkingPartner?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(user => !user.delivery_partner_id)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.full_name || user.email}
                          </span>
                          {user.full_name && (
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground capitalize">
                            {user.role.replace('_', ' ')}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  {users.filter(user => !user.delivery_partner_id).length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No available users to link
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Only users without an existing delivery partner link are shown
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLinkUser} disabled={saving || !selectedUserId}>
              {saving ? "Linking..." : "Link User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
