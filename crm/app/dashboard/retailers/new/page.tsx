"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"

type Distributor = {
  id: string
  name: string
  company_name: string
}

type User = {
  id: string
  full_name: string | null
  email: string
  role: string
}

export default function NewRetailerPage() {
  const router = useRouter()
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [useSameAddress, setUseSameAddress] = useState(true)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company_name: "",
    gst_number: "",
    phone_primary: "",
    phone_secondary: "",
    phone_tertiary: "",
    contact_person: "",
    whatsapp_number: "",
    distributor_id: "",
    retailer_code: "",
    user_id: "",

    // Address
    shipping_city: "",
    shipping_state: "",
    shipping_pincode: "",
    shipping_street: "",
    shipping_landmark: "",

    billing_city: "",
    billing_state: "",
    billing_pincode: "",
    billing_street: "",
    billing_landmark: "",

    // Legal
    aadhaar_number: "",
    pan_number: "",

    // Bank
    bank_name: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_account_holder_name: "",
    bank_branch: "",

    // Business
    credit_limit: "0",
    credit_days: "0",

    is_active: true,
    is_verified: false
  })

  useEffect(() => {
    fetchDistributors()
    fetchUsers()
  }, [])

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

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("role", "retailer")
      .order("full_name")

    if (!error && data) {
      setUsers(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.name || !formData.phone_primary) {
      toast.error("Please fill in all required fields (Name and Phone)")
      return
    }

    // Validate retailer code if provided
    if (formData.retailer_code && formData.retailer_code.trim()) {
      const retailerCodeTrimmed = formData.retailer_code.trim().toUpperCase()
      if (!/^[A-Z0-9]{2,10}$/.test(retailerCodeTrimmed)) {
        toast.error("Retailer code must be 2-10 uppercase letters/numbers only")
        return
      }

      // Check if code is already used
      const { data: existingRetailer, error: checkError } = await supabase
        .from("retailers")
        .select("id")
        .eq("retailer_code", retailerCodeTrimmed)
        .single()

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking retailer code:", checkError)
      }

      if (existingRetailer) {
        toast.error("This retailer code is already in use")
        return
      }

      formData.retailer_code = retailerCodeTrimmed
    }

    setSaving(true)

    try {
      const retailerData: Record<string, unknown> = { ...formData }

      // Convert empty strings to null for optional fields
      if (!retailerData.distributor_id || retailerData.distributor_id === "") {
        retailerData.distributor_id = null
      }
      if (!retailerData.email || retailerData.email === "") {
        retailerData.email = null
      }
      if (!retailerData.company_name || retailerData.company_name === "") {
        retailerData.company_name = null
      }
      if (!retailerData.gst_number || retailerData.gst_number === "") {
        retailerData.gst_number = null
      }
      if (!retailerData.retailer_code || retailerData.retailer_code === "") {
        retailerData.retailer_code = null
      }

      // Convert credit fields to numbers
      retailerData.credit_limit = parseFloat(formData.credit_limit) || 0
      retailerData.credit_days = parseInt(formData.credit_days) || 0

      // Copy shipping to billing if same address
      if (useSameAddress) {
        retailerData.billing_city = retailerData.shipping_city
        retailerData.billing_state = retailerData.shipping_state
        retailerData.billing_pincode = retailerData.shipping_pincode
        retailerData.billing_street = retailerData.shipping_street
        retailerData.billing_landmark = retailerData.shipping_landmark
        retailerData.billing_same_as_shipping = true
      } else {
        retailerData.billing_same_as_shipping = false
      }

      const { error } = await supabase
        .from("retailers")
        .insert([retailerData])

      if (error) throw error

      toast.success("Retailer created successfully")
      router.push("/dashboard/retailers")
    } catch (error: unknown) {
      console.error("Error creating retailer:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to create retailer"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push("/dashboard/retailers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Retailer</h1>
          <p className="text-muted-foreground">Create a new retail partner</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Primary retailer details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone_primary">Phone Primary *</Label>
                  <Input
                    id="phone_primary"
                    value={formData.phone_primary}
                    onChange={(e) => setFormData({ ...formData, phone_primary: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input
                    id="gst_number"
                    value={formData.gst_number}
                    onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_number">PAN Number</Label>
                  <Input
                    id="pan_number"
                    value={formData.pan_number}
                    onChange={(e) => setFormData({ ...formData, pan_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="retailer_code">Retailer Code</Label>
                  <Input
                    id="retailer_code"
                    value={formData.retailer_code}
                    onChange={(e) => setFormData({ ...formData, retailer_code: e.target.value.toUpperCase() })}
                    placeholder="e.g., RET001, SHOP123"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    2-10 uppercase letters/numbers. Used for invoicing.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distributor_id">Parent Distributor (Optional)</Label>
                  <Select
                    value={formData.distributor_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, distributor_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent distributor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Direct Retailer)</SelectItem>
                      {distributors.map((distributor) => (
                        <SelectItem key={distributor.id} value={distributor.id}>
                          {distributor.name} ({distributor.company_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user_id">Link User Account (Required for Panel Access)</Label>
                  <Select
                    value={formData.user_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, user_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No User Linked</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Link a user account to allow retailer panel login. User must have retailer role.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shipping_street">Street/Area</Label>
                  <Input
                    id="shipping_street"
                    value={formData.shipping_street}
                    onChange={(e) => setFormData({ ...formData, shipping_street: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_landmark">Landmark</Label>
                  <Input
                    id="shipping_landmark"
                    value={formData.shipping_landmark}
                    onChange={(e) => setFormData({ ...formData, shipping_landmark: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="shipping_city">City</Label>
                  <Input
                    id="shipping_city"
                    value={formData.shipping_city}
                    onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_state">State</Label>
                  <Input
                    id="shipping_state"
                    value={formData.shipping_state}
                    onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_pincode">Pincode</Label>
                  <Input
                    id="shipping_pincode"
                    value={formData.shipping_pincode}
                    onChange={(e) => setFormData({ ...formData, shipping_pincode: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use_same_address"
                  checked={useSameAddress}
                  onChange={(e) => setUseSameAddress(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="use_same_address">Use same address for billing</Label>
              </div>
            </CardContent>
          </Card>

          {/* Billing Address - only show if different */}
          {!useSameAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="billing_street">Street/Area</Label>
                    <Input
                      id="billing_street"
                      value={formData.billing_street}
                      onChange={(e) => setFormData({ ...formData, billing_street: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_landmark">Landmark</Label>
                    <Input
                      id="billing_landmark"
                      value={formData.billing_landmark}
                      onChange={(e) => setFormData({ ...formData, billing_landmark: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="billing_city">City</Label>
                    <Input
                      id="billing_city"
                      value={formData.billing_city}
                      onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_state">State</Label>
                    <Input
                      id="billing_state"
                      value={formData.billing_state}
                      onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_pincode">Pincode</Label>
                    <Input
                      id="billing_pincode"
                      value={formData.billing_pincode}
                      onChange={(e) => setFormData({ ...formData, billing_pincode: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Details (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_holder_name">Account Holder Name</Label>
                  <Input
                    id="bank_account_holder_name"
                    value={formData.bank_account_holder_name}
                    onChange={(e) => setFormData({ ...formData, bank_account_holder_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_ifsc_code">IFSC Code</Label>
                  <Input
                    id="bank_ifsc_code"
                    value={formData.bank_ifsc_code}
                    onChange={(e) => setFormData({ ...formData, bank_ifsc_code: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Business Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="credit_limit">Credit Limit (₹)</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit_days">Credit Days</Label>
                  <Input
                    id="credit_days"
                    type="number"
                    min="0"
                    value={formData.credit_days}
                    onChange={(e) => setFormData({ ...formData, credit_days: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span>Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_verified}
                    onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span>Verified</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/retailers")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Retailer
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
