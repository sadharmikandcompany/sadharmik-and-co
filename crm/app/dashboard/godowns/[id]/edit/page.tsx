"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Save, Warehouse } from "lucide-react"
import { toast } from "sonner"

type Distributor = {
  id: string
  name: string
  company_name: string
}

type Retailer = {
  id: string
  name: string
  company_name: string
}

export default function EditGodownPage() {
  const router = useRouter()
  const params = useParams()
  const godownId = params.id as string

  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [retailers, setRetailers] = useState<Retailer[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkingPrimary, setCheckingPrimary] = useState(false)
  const [originalGodownCode, setOriginalGodownCode] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    godown_code: "",
    godown_type: "company" as "company" | "distributor" | "retailer",
    distributor_id: "",
    retailer_id: "",

    // Address
    building: "",
    street: "",
    landmark: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    serviceable_pincodes: "",

    // Manager
    manager_name: "",
    manager_phone: "",
    manager_email: "",

    // Capacity & Storage
    total_capacity_sqft: "",
    storage_type: "",
    operating_hours: "",

    // Location
    latitude: "",
    longitude: "",

    // Status & Notes
    notes: "",
    is_active: true,
    is_primary: false,
  })

  useEffect(() => {
    fetchDistributors()
    fetchRetailers()
    fetchGodown()
  }, [godownId])

  const fetchGodown = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("godowns")
      .select("*")
      .eq("id", godownId)
      .single()

    if (error) {
      console.error("Error fetching godown:", error)
      toast.error("Failed to fetch warehouse details")
      router.push("/dashboard/godowns")
      return
    }

    if (data) {
      setOriginalGodownCode(data.godown_code)
      setFormData({
        name: data.name || "",
        godown_code: data.godown_code || "",
        godown_type: data.godown_type || "company",
        distributor_id: data.distributor_id || "",
        retailer_id: data.retailer_id || "",
        building: data.building || "",
        street: data.street || "",
        landmark: data.landmark || "",
        address_line1: data.address_line1 || "",
        address_line2: data.address_line2 || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        country: data.country || "India",
        serviceable_pincodes: data.serviceable_pincodes || "",
        manager_name: data.manager_name || "",
        manager_phone: data.manager_phone || "",
        manager_email: data.manager_email || "",
        total_capacity_sqft: data.total_capacity_sqft ? String(data.total_capacity_sqft) : "",
        storage_type: data.storage_type || "",
        operating_hours: data.operating_hours || "",
        latitude: data.latitude ? String(data.latitude) : "",
        longitude: data.longitude ? String(data.longitude) : "",
        notes: data.notes || "",
        is_active: data.is_active ?? true,
        is_primary: data.is_primary ?? false,
      })
    }
    setLoading(false)
  }

  const fetchDistributors = async () => {
    const { data, error } = await supabase
      .from("distributors")
      .select("id, name, company_name")
      .eq("is_active", true)
      .eq("is_verified", true)
      .order("name")

    if (!error && data) {
      setDistributors(data)
    }
  }

  const fetchRetailers = async () => {
    const { data, error } = await supabase
      .from("retailers")
      .select("id, name, company_name")
      .eq("is_active", true)
      .eq("is_verified", true)
      .order("name")

    if (!error && data) {
      setRetailers(data)
    }
  }

  const generateGodownCode = () => {
    const typePrefix = formData.godown_type === "company" ? "GDN" :
                       formData.godown_type === "distributor" ? "DIS" : "RET"
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    return `${typePrefix}${randomNum}`
  }

  const handleGenerateCode = () => {
    setFormData({ ...formData, godown_code: generateGodownCode() })
  }

  const validateGodownCode = async (code: string): Promise<boolean> => {
    if (!code || code.trim() === "") return false

    const codeTrimmed = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{3,10}$/.test(codeTrimmed)) {
      toast.error("Godown code must be 3-10 uppercase letters/numbers only")
      return false
    }

    // If code hasn't changed, no need to check for duplicates
    if (codeTrimmed === originalGodownCode.toUpperCase()) {
      return true
    }

    // Check if code is already used by another godown
    const { data: existingGodown, error: checkError } = await supabase
      .from("godowns")
      .select("id")
      .eq("godown_code", codeTrimmed)
      .neq("id", godownId) // Exclude current godown
      .maybeSingle()

    if (checkError) {
      console.error("Error checking godown code:", checkError)
      toast.error("Error validating godown code")
      return false
    }

    if (existingGodown) {
      toast.error("This godown code is already in use")
      return false
    }

    return true
  }

  const checkExistingPrimary = async (): Promise<boolean> => {
    if (!formData.is_primary) return true

    setCheckingPrimary(true)
    const { data, error } = await supabase
      .from("godowns")
      .select("id, name, godown_code")
      .eq("is_primary", true)
      .neq("id", godownId) // Exclude current godown
      .maybeSingle()

    setCheckingPrimary(false)

    if (error && error.code !== "PGRST116") {
      console.error("Error checking primary godown:", error)
      return true // Allow to proceed
    }

    if (data) {
      toast.error(`A primary warehouse already exists: ${data.name} (${data.godown_code}). Please unset it first.`)
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.name || !formData.godown_code || !formData.godown_type) {
      toast.error("Please fill in all required fields (Name, Code, and Type)")
      return
    }

    // Validate godown code
    const isCodeValid = await validateGodownCode(formData.godown_code)
    if (!isCodeValid) return

    // Check for existing primary warehouse
    const canBePrimary = await checkExistingPrimary()
    if (!canBePrimary) return

    // Validate type-specific requirements
    if (formData.godown_type === "distributor" && !formData.distributor_id) {
      toast.error("Please select a distributor for this warehouse")
      return
    }

    if (formData.godown_type === "retailer" && !formData.retailer_id) {
      toast.error("Please select a retailer for this warehouse")
      return
    }

    setSaving(true)

    try {
      const godownData: Record<string, unknown> = {
        name: formData.name,
        godown_code: formData.godown_code.trim().toUpperCase(),
        godown_type: formData.godown_type,
        distributor_id: formData.godown_type === "distributor" ? formData.distributor_id : null,
        retailer_id: formData.godown_type === "retailer" ? formData.retailer_id : null,

        // Address
        building: formData.building || null,
        street: formData.street || null,
        landmark: formData.landmark || null,
        address_line1: formData.address_line1 || null,
        address_line2: formData.address_line2 || null,
        city: formData.city || null,
        state: formData.state || null,
        pincode: formData.pincode || null,
        country: formData.country || "India",
        serviceable_pincodes: formData.serviceable_pincodes || null,

        // Manager
        manager_name: formData.manager_name || null,
        manager_phone: formData.manager_phone || null,
        manager_email: formData.manager_email || null,

        // Capacity & Storage
        total_capacity_sqft: formData.total_capacity_sqft ? parseFloat(formData.total_capacity_sqft) : null,
        storage_type: formData.storage_type || null,
        operating_hours: formData.operating_hours || null,

        // Location
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,

        // Status & Notes
        notes: formData.notes || null,
        is_active: formData.is_active,
        is_primary: formData.is_primary,
      }

      const { error } = await supabase
        .from("godowns")
        .update(godownData)
        .eq("id", godownId)

      if (error) throw error

      toast.success("Warehouse updated successfully")
      router.push(`/dashboard/godowns/${godownId}`)
    } catch (error: unknown) {
      console.error("Error updating godown:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update warehouse"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(`/dashboard/godowns/${godownId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <p>Loading warehouse details...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push(`/dashboard/godowns/${godownId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Warehouse className="h-8 w-8" />
            Edit Warehouse
          </h1>
          <p className="text-muted-foreground">Update warehouse/godown details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Essential warehouse details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Warehouse Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Main Warehouse, North Regional"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="godown_code">
                    Warehouse Code <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="godown_code"
                      placeholder="e.g., GDN1001"
                      value={formData.godown_code}
                      onChange={(e) => setFormData({ ...formData, godown_code: e.target.value.toUpperCase() })}
                      required
                    />
                    <Button type="button" variant="outline" onClick={handleGenerateCode}>
                      Generate
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">3-10 alphanumeric characters</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="godown_type">
                    Warehouse Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.godown_type}
                    onValueChange={(value: "company" | "distributor" | "retailer") =>
                      setFormData({ ...formData, godown_type: value, distributor_id: "", retailer_id: "" })
                    }
                  >
                    <SelectTrigger id="godown_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Company Owned</SelectItem>
                      <SelectItem value="distributor">Distributor</SelectItem>
                      <SelectItem value="retailer">Retailer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.godown_type === "distributor" && (
                  <div className="space-y-2">
                    <Label htmlFor="distributor_id">
                      Distributor <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.distributor_id}
                      onValueChange={(value) => setFormData({ ...formData, distributor_id: value })}
                    >
                      <SelectTrigger id="distributor_id">
                        <SelectValue placeholder="Select distributor" />
                      </SelectTrigger>
                      <SelectContent>
                        {distributors.map((dist) => (
                          <SelectItem key={dist.id} value={dist.id}>
                            {dist.name} {dist.company_name && `(${dist.company_name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.godown_type === "retailer" && (
                  <div className="space-y-2">
                    <Label htmlFor="retailer_id">
                      Retailer <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.retailer_id}
                      onValueChange={(value) => setFormData({ ...formData, retailer_id: value })}
                    >
                      <SelectTrigger id="retailer_id">
                        <SelectValue placeholder="Select retailer" />
                      </SelectTrigger>
                      <SelectContent>
                        {retailers.map((ret) => (
                          <SelectItem key={ret.id} value={ret.id}>
                            {ret.name} {ret.company_name && `(${ret.company_name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
              <CardDescription>Physical location details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="building">Building/Complex</Label>
                  <Input
                    id="building"
                    placeholder="e.g., Taj Complex"
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="street">Street</Label>
                  <Input
                    id="street"
                    placeholder="e.g., MG Road"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_line1">Address Line 1</Label>
                  <Input
                    id="address_line1"
                    placeholder="Door/Plot number, Street"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    placeholder="Area, Locality"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="landmark">Landmark</Label>
                <Input
                  id="landmark"
                  placeholder="e.g., Near City Mall"
                  value={formData.landmark}
                  onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Mumbai"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="e.g., Maharashtra"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    placeholder="e.g., 400001"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceable_pincodes">Serviceable Pincodes</Label>
                <Textarea
                  id="serviceable_pincodes"
                  placeholder="e.g., 400001, 400002, 400003"
                  value={formData.serviceable_pincodes}
                  onChange={(e) => setFormData({ ...formData, serviceable_pincodes: e.target.value })}
                  rows={2}
                />
                <p className="text-sm text-muted-foreground">
                  Enter comma-separated pincodes that this warehouse can service
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Manager Information */}
          <Card>
            <CardHeader>
              <CardTitle>Manager Information</CardTitle>
              <CardDescription>Warehouse manager contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manager_name">Manager Name</Label>
                  <Input
                    id="manager_name"
                    placeholder="e.g., John Doe"
                    value={formData.manager_name}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager_phone">Manager Phone</Label>
                  <Input
                    id="manager_phone"
                    placeholder="e.g., +91 9876543210"
                    value={formData.manager_phone}
                    onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager_email">Manager Email</Label>
                  <Input
                    id="manager_email"
                    type="email"
                    placeholder="e.g., manager@company.com"
                    value={formData.manager_email}
                    onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Capacity & Storage */}
          <Card>
            <CardHeader>
              <CardTitle>Capacity & Storage</CardTitle>
              <CardDescription>Warehouse capacity and operational details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_capacity_sqft">Total Capacity (sq ft)</Label>
                  <Input
                    id="total_capacity_sqft"
                    type="number"
                    placeholder="e.g., 5000"
                    value={formData.total_capacity_sqft}
                    onChange={(e) => setFormData({ ...formData, total_capacity_sqft: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storage_type">Storage Type</Label>
                  <Input
                    id="storage_type"
                    placeholder="e.g., Cold Storage, Ambient"
                    value={formData.storage_type}
                    onChange={(e) => setFormData({ ...formData, storage_type: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operating_hours">Operating Hours</Label>
                  <Input
                    id="operating_hours"
                    placeholder="e.g., 9 AM - 6 PM"
                    value={formData.operating_hours}
                    onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Coordinates */}
          <Card>
            <CardHeader>
              <CardTitle>GPS Coordinates (Optional)</CardTitle>
              <CardDescription>Precise location for mapping</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    placeholder="e.g., 19.0760"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    placeholder="e.g., 72.8777"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status & Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Status & Notes</CardTitle>
              <CardDescription>Additional information and settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes or special instructions..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_active">Active Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable this warehouse for operations
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_primary">Primary Warehouse</Label>
                    <p className="text-sm text-muted-foreground">
                      Set as the main/primary warehouse (only one allowed)
                    </p>
                  </div>
                  <Switch
                    id="is_primary"
                    checked={formData.is_primary}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
                    disabled={checkingPrimary}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/godowns/${godownId}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Updating..." : "Update Warehouse"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
