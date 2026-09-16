"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Edit, Package, CheckCircle, XCircle, Star } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type Retailer = {
  id: string
  distributor_id: string | null
  name: string
  email: string | null
  company_name: string | null
  gst_number: string | null
  phone_primary: string | null
  phone_secondary: string | null
  phone_tertiary: string | null
  contact_person: string | null
  shipping_room_number: string | null
  shipping_flat_number: string | null
  shipping_floor_number: string | null
  shipping_wing: string | null
  shipping_building: string | null
  shipping_street: string | null
  shipping_landmark: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_pincode: string | null
  shipping_country: string | null
  billing_room_number: string | null
  billing_flat_number: string | null
  billing_floor_number: string | null
  billing_wing: string | null
  billing_building: string | null
  billing_street: string | null
  billing_landmark: string | null
  billing_city: string | null
  billing_state: string | null
  billing_pincode: string | null
  billing_country: string | null
  billing_same_as_shipping: boolean
  aadhaar_number: string | null
  pan_number: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  bank_account_holder_name: string | null
  bank_branch: string | null
  aadhaar_front_url: string | null
  aadhaar_back_url: string | null
  pan_card_url: string | null
  photo_url: string | null
  gst_certificate_url: string | null
  cancelled_cheque_url: string | null
  shop_license_url: string | null
  trade_license_url: string | null
  credit_limit: number
  credit_days: number
  serviceable_pincodes: string[] | null
  retailer_code: string | null
  is_active: boolean
  is_verified: boolean
  is_special: boolean
  opening_balance: number
  created_at: string
  updated_at: string | null
}

type Distributor = {
  id: string
  name: string
  company_name: string
}

export default function RetailerDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const retailerId = params.id as string

  const [retailer, setRetailer] = useState<Retailer | null>(null)
  const [distributor, setDistributor] = useState<Distributor | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (retailerId) {
      fetchRetailer()
    }
  }, [retailerId])

  const fetchRetailer = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("retailers")
      .select("*")
      .eq("id", retailerId)
      .single()

    if (error) {
      console.error("Error fetching retailer:", error)
      toast.error("Failed to fetch retailer details")
      router.push("/dashboard/retailers")
    } else {
      setRetailer(data)
      if (data.distributor_id) {
        fetchDistributor(data.distributor_id)
      }
    }
    setLoading(false)
  }

  const fetchDistributor = async (distributorId: string) => {
    const { data, error } = await supabase
      .from("distributors")
      .select("id, name, company_name")
      .eq("id", distributorId)
      .single()

    if (!error && data) {
      setDistributor(data)
    }
  }

  const handleToggleVerification = async () => {
    if (!retailer) return

    setUpdating(true)
    try {
      const { error } = await supabase
        .from("retailers")
        .update({ is_verified: !retailer.is_verified })
        .eq("id", retailer.id)

      if (error) throw error

      toast.success(`Retailer ${retailer.is_verified ? "unverified" : "verified"} successfully`)
      fetchRetailer()
    } catch (error: unknown) {
      console.error("Error updating verification:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update verification"
      toast.error(errorMessage)
    } finally {
      setUpdating(false)
    }
  }

  const handleToggleActive = async () => {
    if (!retailer) return

    setUpdating(true)
    try {
      const { error } = await supabase
        .from("retailers")
        .update({ is_active: !retailer.is_active })
        .eq("id", retailer.id)

      if (error) throw error

      toast.success(`Retailer ${retailer.is_active ? "deactivated" : "activated"} successfully`)
      fetchRetailer()
    } catch (error: unknown) {
      console.error("Error updating status:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update status"
      toast.error(errorMessage)
    } finally {
      setUpdating(false)
    }
  }

  const handleToggleSpecial = async () => {
    if (!retailer) return
    setUpdating(true)
    try {
      const { error } = await supabase
        .from("retailers")
        .update({ is_special: !retailer.is_special })
        .eq("id", retailer.id)
      if (error) throw error
      toast.success(`Retailer ${retailer.is_special ? "removed from" : "marked as"} special`)
      fetchRetailer()
    } catch (error: unknown) {
      console.error("Error updating special status:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update special status"
      toast.error(errorMessage)
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateOpeningBalance = async (value: string) => {
    if (!retailer) return
    const numVal = parseFloat(value) || 0
    if (numVal === retailer.opening_balance) return
    try {
      const { error } = await supabase
        .from("retailers")
        .update({ opening_balance: numVal })
        .eq("id", retailer.id)
      if (error) throw error
      toast.success("Opening balance updated")
      fetchRetailer()
    } catch (error: unknown) {
      console.error("Error updating opening balance:", error)
      toast.error("Failed to update opening balance")
    }
  }

  if (loading || !retailer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard/retailers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard/retailers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{retailer.name}</h1>
            <p className="text-muted-foreground">{retailer.company_name || "Retailer Details"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/retailers/${retailer.id}/stock`}>
            <Button variant="outline">
              <Package className="mr-2 h-4 w-4" />
              View Stock
            </Button>
          </Link>
          <Button variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2">
        <Badge variant={retailer.is_active ? "default" : "secondary"}>
          {retailer.is_active ? "Active" : "Inactive"}
        </Badge>
        <Badge variant={retailer.is_verified ? "default" : "destructive"}>
          {retailer.is_verified ? "Verified" : "Not Verified"}
        </Badge>
        {retailer.retailer_code && (
          <Badge variant="outline" className="font-mono">
            {retailer.retailer_code}
          </Badge>
        )}
        {retailer.is_special && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            <Star className="h-3 w-3 mr-1 fill-amber-400" />
            Special Retailer
          </Badge>
        )}
        {distributor && (
          <Badge variant="secondary">
            Under: {distributor.name}
          </Badge>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant={retailer.is_verified ? "destructive" : "default"}
            onClick={handleToggleVerification}
            disabled={updating}
          >
            {retailer.is_verified ? (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Unverify Retailer
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Verify Retailer
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleToggleActive}
            disabled={updating}
          >
            {retailer.is_active ? "Deactivate" : "Activate"}
          </Button>
          <Button
            variant={retailer.is_special ? "outline" : "secondary"}
            onClick={handleToggleSpecial}
            disabled={updating}
            className={retailer.is_special ? "border-amber-300 text-amber-700 hover:bg-amber-50" : ""}
          >
            <Star className={`mr-2 h-4 w-4 ${retailer.is_special ? "fill-amber-400 text-amber-600" : ""}`} />
            {retailer.is_special ? "Remove Special" : "Mark as Special"}
          </Button>
        </CardContent>
      </Card>

      {/* Special Retailer Settings */}
      {retailer.is_special && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 fill-amber-400 text-amber-600" />
              Special Retailer Settings
            </CardTitle>
            <CardDescription>
              This retailer is tracked in the Special Retailer Payments page. Set their opening balance below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-1.5">
              <Label>Opening Balance (₹)</Label>
              <Input
                type="number"
                defaultValue={retailer.opening_balance || 0}
                onBlur={(e) => handleUpdateOpeningBalance(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Carry-forward balance from before tracking started. This gets added to outstanding.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Primary Phone</p>
              <p className="font-medium">{retailer.phone_primary || "—"}</p>
            </div>
            {retailer.phone_secondary && (
              <div>
                <p className="text-sm text-muted-foreground">Secondary Phone</p>
                <p className="font-medium">{retailer.phone_secondary}</p>
              </div>
            )}
            {retailer.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{retailer.email}</p>
              </div>
            )}
            {retailer.contact_person && (
              <div>
                <p className="text-sm text-muted-foreground">Contact Person</p>
                <p className="font-medium">{retailer.contact_person}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {retailer.gst_number && (
              <div>
                <p className="text-sm text-muted-foreground">GST Number</p>
                <p className="font-medium font-mono">{retailer.gst_number}</p>
              </div>
            )}
            {retailer.pan_number && (
              <div>
                <p className="text-sm text-muted-foreground">PAN Number</p>
                <p className="font-medium font-mono">{retailer.pan_number}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Credit Limit</p>
              <p className="font-medium">₹{retailer.credit_limit.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credit Days</p>
              <p className="font-medium">{retailer.credit_days} days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Addresses */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent>
            <address className="not-italic">
              {[
                retailer.shipping_room_number && `Room ${retailer.shipping_room_number}`,
                retailer.shipping_flat_number && `Flat ${retailer.shipping_flat_number}`,
                retailer.shipping_floor_number && `Floor ${retailer.shipping_floor_number}`,
                retailer.shipping_wing && `Wing ${retailer.shipping_wing}`,
                retailer.shipping_building,
                retailer.shipping_street,
                retailer.shipping_landmark,
                retailer.shipping_city,
                retailer.shipping_state,
                retailer.shipping_pincode,
                retailer.shipping_country
              ].filter(Boolean).join(", ")}
            </address>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Address</CardTitle>
            <CardDescription>
              {retailer.billing_same_as_shipping && "(Same as shipping)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <address className="not-italic">
              {[
                retailer.billing_room_number && `Room ${retailer.billing_room_number}`,
                retailer.billing_flat_number && `Flat ${retailer.billing_flat_number}`,
                retailer.billing_floor_number && `Floor ${retailer.billing_floor_number}`,
                retailer.billing_wing && `Wing ${retailer.billing_wing}`,
                retailer.billing_building,
                retailer.billing_street,
                retailer.billing_landmark,
                retailer.billing_city,
                retailer.billing_state,
                retailer.billing_pincode,
                retailer.billing_country
              ].filter(Boolean).join(", ")}
            </address>
          </CardContent>
        </Card>
      </div>

      {/* Banking Details */}
      {retailer.bank_name && (
        <Card>
          <CardHeader>
            <CardTitle>Banking Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Bank Name</p>
              <p className="font-medium">{retailer.bank_name}</p>
            </div>
            {retailer.bank_account_holder_name && (
              <div>
                <p className="text-sm text-muted-foreground">Account Holder</p>
                <p className="font-medium">{retailer.bank_account_holder_name}</p>
              </div>
            )}
            {retailer.bank_account_number && (
              <div>
                <p className="text-sm text-muted-foreground">Account Number</p>
                <p className="font-medium font-mono">{retailer.bank_account_number}</p>
              </div>
            )}
            {retailer.bank_ifsc_code && (
              <div>
                <p className="text-sm text-muted-foreground">IFSC Code</p>
                <p className="font-medium font-mono">{retailer.bank_ifsc_code}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Serviceable Pincodes */}
      {retailer.serviceable_pincodes && retailer.serviceable_pincodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Serviceable Pincodes</CardTitle>
            <CardDescription>
              {retailer.serviceable_pincodes.length} pincode(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {retailer.serviceable_pincodes.map((pincode) => (
                <Badge key={pincode} variant="secondary">
                  {pincode}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
