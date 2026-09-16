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
import { Plus, Eye, Building2, Store } from "lucide-react"
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
  shipping_city: string | null
  shipping_state: string | null
  shipping_pincode: string | null
  billing_city: string | null
  billing_state: string | null
  billing_pincode: string | null
  retailer_code: string | null
  credit_limit: number
  credit_days: number
  serviceable_pincodes: string[] | null
  is_active: boolean
  is_verified: boolean
  created_at: string
}

type Distributor = {
  id: string
  name: string
  company_name: string
}

export default function RetailersPage() {
  const [retailers, setRetailers] = useState<Retailer[]>([])
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchRetailers()
    fetchDistributors()
  }, [])

  const fetchRetailers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("retailers")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching retailers:", error)
      toast.error("Failed to fetch retailers")
    } else {
      setRetailers(data || [])
    }
    setLoading(false)
  }

  const fetchDistributors = async () => {
    const { data, error } = await supabase
      .from("distributors")
      .select("id, name, company_name")
      .eq("is_active", true)

    if (error) {
      console.error("Error fetching distributors:", error)
    } else {
      setDistributors(data || [])
    }
  }

  const getDistributorName = (distributorId: string | null): string => {
    if (!distributorId) return "Direct"
    const distributor = distributors.find(d => d.id === distributorId)
    return distributor ? `${distributor.name}` : "Unknown"
  }

  const filteredRetailers = retailers.filter(
    (retailer) =>
      retailer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (retailer.email && retailer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (retailer.company_name && retailer.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (retailer.gst_number && retailer.gst_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (retailer.phone_primary && retailer.phone_primary.includes(searchTerm)) ||
      (retailer.retailer_code && retailer.retailer_code.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Separate retailers into verified and non-verified
  const nonVerifiedRetailers = filteredRetailers.filter(r => !r.is_verified)
  const verifiedRetailers = filteredRetailers.filter(r => r.is_verified)

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Retailers</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Retailers</h1>
          <p className="text-muted-foreground">Manage your retail partner network</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/retailers/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Retailer
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Retailers</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{retailers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <Building2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verifiedRetailers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            <Building2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nonVerifiedRetailers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{retailers.filter(r => r.is_active).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search retailers by name, email, code, phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Non-Verified Retailers */}
      {nonVerifiedRetailers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Verification</CardTitle>
            <CardDescription>
              Retailers awaiting verification ({nonVerifiedRetailers.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Retailer Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Distributor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonVerifiedRetailers.map((retailer) => (
                    <TableRow key={retailer.id}>
                      <TableCell>
                        {retailer.retailer_code ? (
                          <Badge variant="outline" className="font-mono">
                            {retailer.retailer_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{retailer.name}</TableCell>
                      <TableCell>{retailer.company_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>{retailer.phone_primary || "—"}</span>
                          {retailer.email && (
                            <span className="text-xs text-muted-foreground">{retailer.email}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {retailer.shipping_city ? (
                          `${retailer.shipping_city}, ${retailer.shipping_state}`
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={retailer.distributor_id ? "secondary" : "outline"}>
                          {getDistributorName(retailer.distributor_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={retailer.is_active ? "default" : "secondary"}>
                          {retailer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/retailers/${retailer.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verified Retailers */}
      <Card>
        <CardHeader>
          <CardTitle>Verified Retailers</CardTitle>
          <CardDescription>
            Active retail partners ({verifiedRetailers.length})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Retailer Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifiedRetailers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No verified retailers found
                    </TableCell>
                  </TableRow>
                ) : (
                  verifiedRetailers.map((retailer) => (
                    <TableRow key={retailer.id}>
                      <TableCell>
                        {retailer.retailer_code ? (
                          <Badge variant="outline" className="font-mono">
                            {retailer.retailer_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{retailer.name}</TableCell>
                      <TableCell>{retailer.company_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>{retailer.phone_primary || "—"}</span>
                          {retailer.email && (
                            <span className="text-xs text-muted-foreground">{retailer.email}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {retailer.shipping_city ? (
                          `${retailer.shipping_city}, ${retailer.shipping_state}`
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={retailer.distributor_id ? "secondary" : "outline"}>
                          {getDistributorName(retailer.distributor_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          ₹{retailer.credit_limit.toLocaleString()} ({retailer.credit_days}d)
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={retailer.is_active ? "default" : "secondary"}>
                            {retailer.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="text-green-600">
                            Verified
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/retailers/${retailer.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
