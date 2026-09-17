"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Plus, Pencil, Trash2, ShoppingCart, Eye, MapPin, Phone, Mail, Building, User, Package, Calendar, IndianRupee, Copy, FileText, Filter, X, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, FileSpreadsheet, FileDown } from "lucide-react"
import { toast } from "sonner"
import { lookupPincode } from "@/lib/pincode-lookup"
import Link from "next/link"
import { format } from "date-fns"
import { ExportButtons } from "@/components/export-buttons"
import { exportToCSV, exportToExcel, exportTableToPDF } from "@/lib/export-utils"

// Indian States and Union Territories
const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
]

type Customer = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  mobile_primary: string
  whatsapp_number: string | null
  mobile_secondary_1: string | null
  mobile_secondary_2: string | null
  company_name: string | null
  gst_number: string | null
  pan_card_number: string | null
  is_vip: boolean
  is_defaulter: boolean
  is_mandir: boolean
  shipping_flat_number: string | null
  shipping_floor_wing: string | null
  shipping_building_name: string | null
  shipping_street_area: string | null
  shipping_landmark: string | null
  shipping_pincode: string | null
  shipping_country: string | null
  shipping_state: string | null
  shipping_city: string | null
  billing_same_as_shipping: boolean
  billing_flat_number: string | null
  billing_floor_wing: string | null
  billing_building_name: string | null
  billing_street_area: string | null
  billing_landmark: string | null
  billing_pincode: string | null
  billing_country: string | null
  billing_state: string | null
  billing_city: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  whatsapp_same_as_primary: boolean
  full_address: string | null
  vip_number: string | null
  shipping_room_number: string | null
  shipping_floor: string | null
  shipping_wing: string | null
  billing_room_number: string | null
  billing_floor: string | null
  billing_wing: string | null
  opening_balance: number | null
}

type Order = {
  id: string
  order_number: string
  customer_id: string
  order_status: string
  payment_status: string
  payment_method: string | null
  total_amount: number
  order_date: string
  created_at: string
  is_priority: boolean
  source: string | null
  delivery_status: string | null
  invoice_number_gst: string | null
  invoice_number_non_gst: string | null
  is_gst_invoice: boolean | null
  delivery_partner_id: string | null
  cod_payment_method: string | null
  cod_collected_amount: string | number | null
  payment_out_method?: string | null
  payment_out_amount?: number
}

type EntityRole = 'customer' | 'distributor' | 'sub_distributor' | 'retailer' | 'vendor'

type ListEntity = {
  id: string
  role: EntityRole
  display_name: string
  phone: string
  email: string | null
  company_name: string | null
  city: string | null
  is_active: boolean
  created_at: string
  is_vip?: boolean
  is_defaulter?: boolean
  is_mandir?: boolean
  vip_number?: string | null
}

const ROLE_BADGE_CONFIG: Record<EntityRole, { label: string; className: string }> = {
  customer: { label: 'Customer', className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  distributor: { label: 'Distributor', className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
  sub_distributor: { label: 'Sub Distributor', className: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800' },
  retailer: { label: 'Retailer', className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  vendor: { label: 'Vendor', className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
}

type FormData = Omit<Customer, "id" | "created_at" | "updated_at">

const initialFormData: FormData = {
  first_name: "",
  last_name: "",
  email: null,
  mobile_primary: "",
  whatsapp_number: null,
  mobile_secondary_1: null,
  mobile_secondary_2: null,
  company_name: null,
  gst_number: null,
  pan_card_number: null,
  is_vip: false,
  is_defaulter: false,
  is_mandir: false,
  shipping_flat_number: null,
  shipping_floor_wing: null,
  shipping_building_name: null,
  shipping_street_area: null,
  shipping_landmark: null,
  shipping_pincode: null,
  shipping_country: "India",
  shipping_state: null,
  shipping_city: null,
  billing_same_as_shipping: true,
  billing_flat_number: null,
  billing_floor_wing: null,
  billing_building_name: null,
  billing_street_area: null,
  billing_landmark: null,
  billing_pincode: null,
  billing_country: "India",
  billing_state: null,
  billing_city: null,
  is_active: true,
  whatsapp_same_as_primary: true,
  full_address: null,
  vip_number: null,
  shipping_room_number: null,
  shipping_floor: null,
  shipping_wing: null,
  billing_room_number: null,
  billing_floor: null,
  billing_wing: null,
  opening_balance: 0,
}

function CustomerForm({
  formData,
  setFormData,
  handlePincodeChange,
}: {
  formData: FormData
  setFormData: (data: FormData) => void
  handlePincodeChange: (value: string, type: "shipping" | "billing") => void
}) {
  return (
    <div className="grid gap-6 py-4">
      {/* Basic Information */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-semibold">Basic Information</h3>
          <p className="text-sm text-muted-foreground">Personal details of the customer</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email (Optional)</Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ""}
            onChange={(e) => setFormData({ ...formData, email: e.target.value || null })}
            placeholder="example@domain.com"
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-semibold">Contact Information</h3>
          <p className="text-sm text-muted-foreground">Phone numbers and contact details</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile_primary">Mobile Primary *</Label>
          <Input
            id="mobile_primary"
            value={formData.mobile_primary}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "")
              setFormData({ ...formData, mobile_primary: value })
            }}
            required
            maxLength={10}
            placeholder="10 digit mobile number"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
            <Input
              id="whatsapp_number"
              value={formData.whatsapp_same_as_primary ? formData.mobile_primary : (formData.whatsapp_number || "")}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "")
                setFormData({ ...formData, whatsapp_number: value, whatsapp_same_as_primary: false })
              }}
              disabled={formData.whatsapp_same_as_primary}
              maxLength={10}
              placeholder="10 digit number"
            />
          </div>
          <div className="space-y-2">
            <Label>&nbsp;</Label>
            <label className="flex items-center gap-2 h-10">
              <input
                type="checkbox"
                checked={formData.whatsapp_same_as_primary}
                onChange={(e) => {
                  const checked = e.target.checked
                  setFormData({
                    ...formData,
                    whatsapp_same_as_primary: checked,
                    whatsapp_number: checked ? formData.mobile_primary : formData.whatsapp_number,
                  })
                }}
                className="h-4 w-4"
              />
              <span className="text-sm">Same as Primary</span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mobile_secondary_1">Mobile Secondary 1</Label>
            <Input
              id="mobile_secondary_1"
              value={formData.mobile_secondary_1 || ""}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "")
                setFormData({ ...formData, mobile_secondary_1: value || null })
              }}
              maxLength={10}
              placeholder="10 digit number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile_secondary_2">Mobile Secondary 2</Label>
            <Input
              id="mobile_secondary_2"
              value={formData.mobile_secondary_2 || ""}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "")
                setFormData({ ...formData, mobile_secondary_2: value || null })
              }}
              maxLength={10}
              placeholder="10 digit number"
            />
          </div>
        </div>
      </div>

      {/* Business Information */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-semibold">Business Information</h3>
          <p className="text-sm text-muted-foreground">Company, GST, and PAN details (optional)</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company_name">Company Name</Label>
          <Input
            id="company_name"
            value={formData.company_name || ""}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value || null })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gst_number">GST Number</Label>
            <Input
              id="gst_number"
              value={formData.gst_number || ""}
              onChange={(e) => setFormData({ ...formData, gst_number: e.target.value || null })}
              maxLength={15}
              placeholder="15 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pan_card_number">PAN Card Number</Label>
            <Input
              id="pan_card_number"
              value={formData.pan_card_number || ""}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                setFormData({ ...formData, pan_card_number: value || null })
              }}
              maxLength={10}
              placeholder="ABCDE1234F"
            />
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-semibold">Shipping Address</h3>
          <p className="text-sm text-muted-foreground">Provide either full address OR structured address fields</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_address">Full Address (Option 1)</Label>
          <textarea
            id="full_address"
            value={formData.full_address || ""}
            onChange={(e) => setFormData({ ...formData, full_address: e.target.value || null })}
            rows={3}
            placeholder="Complete address as provided (optional if structured fields below are filled)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Enter complete address here to skip structured fields below
          </p>
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">OR</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Structured Address (Option 2)</Label>
        </div>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Input
              placeholder="Room/Flat No."
              value={formData.shipping_room_number || ""}
              onChange={(e) => setFormData({ ...formData, shipping_room_number: e.target.value || null })}
            />
            <Input
              placeholder="Floor"
              value={formData.shipping_floor || ""}
              onChange={(e) => setFormData({ ...formData, shipping_floor: e.target.value || null })}
            />
            <Input
              placeholder="Wing/Block"
              value={formData.shipping_wing || ""}
              onChange={(e) => setFormData({ ...formData, shipping_wing: e.target.value || null })}
            />
          </div>
          <Input
            placeholder="Building Name"
            value={formData.shipping_building_name || ""}
            onChange={(e) => setFormData({ ...formData, shipping_building_name: e.target.value || null })}
          />
          <Input
            placeholder="Street/Area"
            value={formData.shipping_street_area || ""}
            onChange={(e) => setFormData({ ...formData, shipping_street_area: e.target.value || null })}
          />
          <Input
            placeholder="Landmark"
            value={formData.shipping_landmark || ""}
            onChange={(e) => setFormData({ ...formData, shipping_landmark: e.target.value || null })}
          />
          <div className="grid grid-cols-4 gap-3">
            <Input
              placeholder="City"
              value={formData.shipping_city || ""}
              onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value || null })}
            />
            <Select
              value={formData.shipping_state || ""}
              onValueChange={(value) => setFormData({ ...formData, shipping_state: value || null })}
            >
              <SelectTrigger>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Pincode"
              value={formData.shipping_pincode || ""}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "")
                handlePincodeChange(value, "shipping")
              }}
              maxLength={6}
            />
            <Input
              placeholder="Country"
              value={formData.shipping_country || ""}
              onChange={(e) => setFormData({ ...formData, shipping_country: e.target.value || null })}
            />
          </div>
        </div>
      </div>

      {/* Billing Address */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-semibold">Billing Address</h3>
          <p className="text-sm text-muted-foreground">Invoice and billing address</p>
        </div>
        <div className="mb-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.billing_same_as_shipping}
              onChange={(e) => setFormData({ ...formData, billing_same_as_shipping: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Same as Shipping Address</span>
          </label>
        </div>
        {!formData.billing_same_as_shipping && (
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <Input
                placeholder="Room/Flat No."
                value={formData.billing_room_number || ""}
                onChange={(e) => setFormData({ ...formData, billing_room_number: e.target.value || null })}
              />
              <Input
                placeholder="Floor"
                value={formData.billing_floor || ""}
                onChange={(e) => setFormData({ ...formData, billing_floor: e.target.value || null })}
              />
              <Input
                placeholder="Wing/Block"
                value={formData.billing_wing || ""}
                onChange={(e) => setFormData({ ...formData, billing_wing: e.target.value || null })}
              />
            </div>
            <Input
              placeholder="Building Name"
              value={formData.billing_building_name || ""}
              onChange={(e) => setFormData({ ...formData, billing_building_name: e.target.value || null })}
            />
            <Input
              placeholder="Street/Area"
              value={formData.billing_street_area || ""}
              onChange={(e) => setFormData({ ...formData, billing_street_area: e.target.value || null })}
            />
            <Input
              placeholder="Landmark"
              value={formData.billing_landmark || ""}
              onChange={(e) => setFormData({ ...formData, billing_landmark: e.target.value || null })}
            />
            <div className="grid grid-cols-4 gap-3">
              <Input
                placeholder="City"
                value={formData.billing_city || ""}
                onChange={(e) => setFormData({ ...formData, billing_city: e.target.value || null })}
              />
              <Select
                value={formData.billing_state || ""}
                onValueChange={(value) => setFormData({ ...formData, billing_state: value || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Pincode"
                value={formData.billing_pincode || ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "")
                  handlePincodeChange(value, "billing")
                }}
                maxLength={6}
              />
              <Input
                placeholder="Country"
                value={formData.billing_country || ""}
                onChange={(e) => setFormData({ ...formData, billing_country: e.target.value || null })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Customer Classification */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-lg font-semibold">Customer Classification</h3>
          <p className="text-sm text-muted-foreground">Customer type and status tags</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_vip}
                onChange={(e) => setFormData({ ...formData, is_vip: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm">Sd Customer</span>
            </label>
            {formData.is_vip && (
              <div className="flex-1 max-w-xs">
                <Input
                  placeholder="Sd Number"
                  value={formData.vip_number || ""}
                  onChange={(e) => setFormData({ ...formData, vip_number: e.target.value || null })}
                  className="h-9"
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_mandir}
              onChange={(e) => setFormData({ ...formData, is_mandir: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Mandir/Temple</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_defaulter}
              onChange={(e) => setFormData({ ...formData, is_defaulter: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Defaulter</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Active</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default function CustomersV2Page() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerOrders, setCustomerOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filter and sorting states
  const [filterVip, setFilterVip] = useState<string>("all")
  const [filterDefaulter, setFilterDefaulter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"name" | "date" | "spend">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [customerTotalSpend, setCustomerTotalSpend] = useState<{ [key: string]: number }>({})
  const [customerBalanceData, setCustomerBalanceData] = useState<{ [key: string]: { totalPending: number; balanceAmount: number } }>({})

  const [filterMinSpend, setFilterMinSpend] = useState<string>("")
  const [filterMaxSpend, setFilterMaxSpend] = useState<string>("")

  // Entity states (distributors, retailers, vendors)
  // Defaults to "customer" so this page shows only customers; the Role filter
  // dropdown still lets staff switch to distributors/retailers/vendors.
  const [filterRole, setFilterRole] = useState<string>("customer")
  const [distributorsList, setDistributorsList] = useState<any[]>([])
  const [retailersList, setRetailersList] = useState<any[]>([])
  const [vendorsList, setVendorsList] = useState<any[]>([])
  const [entityBalanceData, setEntityBalanceData] = useState<Record<string, { totalPending: number; balanceAmount: number }>>({})
  const [selectedEntityRole, setSelectedEntityRole] = useState<EntityRole | null>(null)
  const [selectedEntityRaw, setSelectedEntityRaw] = useState<any>(null)
  const [vendorPurchases, setVendorPurchases] = useState<any[]>([])
  // Vyapar/Tally-style combined ledger — every bill AND every payment as its
  // own row, each with its own running "Balance/Unused" (how much of THAT
  // specific line is still outstanding/unallocated) instead of one lumped
  // "Paid: X" total, so a bill settled across several part-payments (e.g.
  // ₹2L today, ₹2L tomorrow) is actually visible.
  const [vendorLedger, setVendorLedger] = useState<any[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // Inline opening balance edit
  const [isEditingOpeningBalance, setIsEditingOpeningBalance] = useState(false)
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>("")
  const [savingOpeningBalance, setSavingOpeningBalance] = useState(false)

  // Export states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportDateFrom, setExportDateFrom] = useState<Date | undefined>(undefined)
  const [exportDateTo, setExportDateTo] = useState<Date | undefined>(undefined)
  const [exportLoading, setExportLoading] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const pageSize = 50

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 400)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterVip, filterDefaulter, filterRole])

  useEffect(() => {
    fetchCustomers()
  }, [currentPage, debouncedSearch, filterVip, filterDefaulter])

  // Fetch other entities on mount
  useEffect(() => {
    fetchDistributors()
    fetchRetailers()
    fetchVendors()
  }, [])

  useEffect(() => {
    if (customers.length > 0) {
      fetchCustomerSpendData()
      fetchCustomerBalanceData()
    }
  }, [customers])

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerOrders(selectedCustomer.id)
    }
    setIsEditingOpeningBalance(false)
    setOpeningBalanceInput("")
  }, [selectedCustomer])

  // Fetch entity balance data when entities are loaded
  useEffect(() => {
    if (distributorsList.length > 0 || retailersList.length > 0 || vendorsList.length > 0) {
      fetchEntityBalanceData()
    }
  }, [distributorsList, retailersList, vendorsList])

  // Fetch orders/purchases when a non-customer entity is selected
  useEffect(() => {
    if (selectedEntityRaw && selectedEntityRole) {
      if (selectedEntityRole === 'vendor') {
        fetchVendorPurchasesData(selectedEntityRaw.id)
        fetchVendorLedgerData(selectedEntityRaw.id)
      } else if (selectedEntityRole === 'distributor' || selectedEntityRole === 'sub_distributor') {
        fetchEntityOrders(selectedEntityRaw.id, 'distributor')
      } else if (selectedEntityRole === 'retailer') {
        fetchEntityOrders(selectedEntityRaw.id, 'retailer')
      }
    }
    setIsEditingOpeningBalance(false)
    setOpeningBalanceInput("")
  }, [selectedEntityRaw])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from("customers")
        .select("*", { count: "exact" })

      // Server-side search using ilike/or
      if (debouncedSearch.trim()) {
        const q = `%${debouncedSearch.trim()}%`
        query = query.or(
          `first_name.ilike.${q},last_name.ilike.${q},mobile_primary.ilike.${q},whatsapp_number.ilike.${q},mobile_secondary_1.ilike.${q},mobile_secondary_2.ilike.${q},email.ilike.${q},company_name.ilike.${q},vip_number.ilike.${q},full_address.ilike.${q},shipping_city.ilike.${q},shipping_state.ilike.${q},shipping_pincode.ilike.${q},shipping_street_area.ilike.${q},shipping_building_name.ilike.${q},shipping_landmark.ilike.${q},billing_city.ilike.${q},billing_state.ilike.${q},billing_pincode.ilike.${q}`
        )
      }

      // Server-side Sd filter
      if (filterVip === "vip") {
        query = query.eq("is_vip", true)
      } else if (filterVip === "non-vip") {
        query = query.eq("is_vip", false)
      }

      // Server-side defaulter filter
      if (filterDefaulter === "defaulter") {
        query = query.eq("is_defaulter", true)
      } else if (filterDefaulter === "non-defaulter") {
        query = query.eq("is_defaulter", false)
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) throw error
      setCustomers(data || [])
      setTotalCustomers(count || 0)
    } catch (error) {
      console.error("Error fetching customers:", error)
      toast.error("Failed to fetch customers")
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomerSpendData = async () => {
    try {
      const customerIds = customers.map((c) => c.id)
      if (customerIds.length === 0) return

      // Fetch all orders for current page's customers (override default 1000 limit)
      // With 50 customers per page, we set a generous limit to capture all their orders
      let allOrders: { customer_id: string; total_amount: number }[] = []
      let from = 0
      const batchSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from("orders")
          .select("customer_id, total_amount")
          .in("customer_id", customerIds)
          .range(from, from + batchSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break

        allOrders = allOrders.concat(data)
        if (data.length < batchSize) break
        from += batchSize
      }

      // Calculate total spend per customer
      const spendMap: { [key: string]: number } = {}
      allOrders.forEach((order) => {
        if (order.customer_id) {
          spendMap[order.customer_id] = (spendMap[order.customer_id] || 0) + (order.total_amount || 0)
        }
      })

      setCustomerTotalSpend(spendMap)
    } catch (error) {
      console.error("Error fetching customer spend data:", error)
    }
  }

  const fetchCustomerBalanceData = async () => {
    try {
      const customerIds = customers.map((c) => c.id)
      if (customerIds.length === 0) return

      // Fetch orders with pending/partial payment for current page's customers
      let allPendingOrders: any[] = []
      let from = 0
      const batchSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from("orders")
          .select("id, customer_id, total_amount, payment_status, order_status, cod_collected_amount, cod_payment_method")
          .in("customer_id", customerIds)
          .in("payment_status", ["pending", "partial"])
          .not("order_status", "eq", "cancelled")
          .range(from, from + batchSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allPendingOrders = allPendingOrders.concat(data)
        if (data.length < batchSize) break
        from += batchSize
      }

      if (allPendingOrders.length === 0) {
        setCustomerBalanceData({})
        return
      }

      // Fetch route_assignments for collected amounts
      const orderIds = allPendingOrders.map((o) => o.id)
      const raMap: Record<string, { collected: number; method: string | null }> = {}
      const chunkSize = 200

      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize)
        const { data: routeData } = await supabase
          .from("route_assignments")
          .select("order_id, collected_amount, collected_payment_method")
          .in("order_id", chunk)

        if (routeData) {
          routeData.forEach((r: any) => {
            const amt = parseFloat(r.collected_amount) || 0
            const existing = raMap[r.order_id]
            if (existing) {
              existing.collected += amt
            } else {
              raMap[r.order_id] = { collected: amt, method: r.collected_payment_method }
            }
          })
        }
      }

      // Calculate per customer: totalPending and balanceAmount
      const balanceMap: { [key: string]: { totalPending: number; balanceAmount: number } } = {}

      allPendingOrders.forEach((order) => {
        if (!order.customer_id) return
        const ra = raMap[order.id]
        const raCollected = ra?.collected || 0
        const raMethod = ra?.method || null
        const codCollected = parseFloat(order.cod_collected_amount) || 0
        const codMethod = order.cod_payment_method || null

        // Only count as collected if payment method is actual money (not "balance"/credit)
        const actualRaCollected = raMethod && raMethod !== "balance" ? raCollected : 0
        const actualCodCollected = codMethod && codMethod !== "balance" ? codCollected : 0
        const collected = actualRaCollected || actualCodCollected
        const balance = (order.total_amount || 0) - collected

        if (!balanceMap[order.customer_id]) {
          balanceMap[order.customer_id] = { totalPending: 0, balanceAmount: 0 }
        }
        balanceMap[order.customer_id].totalPending += order.total_amount || 0
        if (balance > 0) {
          balanceMap[order.customer_id].balanceAmount += balance
        }
      })

      setCustomerBalanceData(balanceMap)
    } catch (error) {
      console.error("Error fetching customer balance data:", error)
    }
  }

  const fetchCustomerOrders = async (customerId: string) => {
    setOrdersLoading(true)
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("order_date", { ascending: false })

      if (error) throw error

      // Fetch delivery partner names + route_assignments (payment-out) for these orders
      if (data && data.length > 0) {
        const partnerIds = data
          .filter((order) => order.delivery_partner_id)
          .map((order) => order.delivery_partner_id)

        const orderIds = data.map((o) => o.id)
        const payOutMap: Record<string, { method: string | null; amount: number }> = {}

        // Fetch all route_assignments for these orders (chunked for safety)
        const chunkSize = 200
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize)
          const { data: routeData } = await supabase
            .from("route_assignments")
            .select("order_id, collected_amount, collected_payment_method")
            .in("order_id", chunk)

          if (routeData) {
            routeData.forEach((r: any) => {
              const amt = parseFloat(r.collected_amount) || 0
              const existing = payOutMap[r.order_id]
              if (existing) {
                existing.amount += amt
                if (!existing.method && r.collected_payment_method) {
                  existing.method = r.collected_payment_method
                }
              } else {
                payOutMap[r.order_id] = {
                  method: r.collected_payment_method || null,
                  amount: amt,
                }
              }
            })
          }
        }

        let partners: { id: string; first_name: string; last_name: string }[] | null = null
        if (partnerIds.length > 0) {
          const { data: partnerData } = await supabase
            .from("delivery_partners")
            .select("id, first_name, last_name")
            .in("id", partnerIds)
          partners = partnerData || null
        }

        // Merge partner + payment-out info into each order
        const enrichedOrders = data.map((order) => {
          const partner = partners?.find((p) => p.id === order.delivery_partner_id)
          const ra = payOutMap[order.id]
          const codAmt = parseFloat(order.cod_collected_amount as any) || 0
          const codMethod = order.cod_payment_method || null

          // Prefer route_assignment collection; fall back to COD fields
          const payOutAmount = ra && ra.amount > 0 ? ra.amount : codAmt
          const payOutMethod = ra && ra.amount > 0 ? ra.method : codMethod

          return {
            ...order,
            delivery_partner: partner
              ? { first_name: partner.first_name, last_name: partner.last_name }
              : null,
            payment_out_method: payOutMethod,
            payment_out_amount: payOutAmount,
          }
        })

        setCustomerOrders(enrichedOrders as any)
      } else {
        setCustomerOrders(data || [])
      }
    } catch (error) {
      console.error("Error fetching customer orders:", error)
      toast.error("Failed to fetch customer orders")
    } finally {
      setOrdersLoading(false)
    }
  }

  const fetchDistributors = async () => {
    try {
      const { data, error } = await supabase
        .from("distributors")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      setDistributorsList(data || [])
    } catch (error) {
      console.error("Error fetching distributors:", error)
    }
  }

  const fetchRetailers = async () => {
    try {
      const { data, error } = await supabase
        .from("retailers")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      setRetailersList(data || [])
    } catch (error) {
      console.error("Error fetching retailers:", error)
    }
  }

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      setVendorsList(data || [])
    } catch (error) {
      console.error("Error fetching vendors:", error)
    }
  }

  const fetchEntityBalanceData = async () => {
    try {
      const balanceMap: Record<string, { totalPending: number; balanceAmount: number }> = {}

      // Distributor balances from orders
      const distIds = distributorsList.map((d: any) => d.id)
      if (distIds.length > 0) {
        const { data: distOrders } = await supabase
          .from("orders")
          .select("distributor_id, total_amount, payment_status, order_status")
          .in("distributor_id", distIds)
          .in("payment_status", ["pending", "partial"])
          .not("order_status", "eq", "cancelled")
        if (distOrders) {
          distOrders.forEach((o: any) => {
            if (!o.distributor_id) return
            const key = `distributor_${o.distributor_id}`
            if (!balanceMap[key]) balanceMap[key] = { totalPending: 0, balanceAmount: 0 }
            balanceMap[key].totalPending += o.total_amount || 0
            balanceMap[key].balanceAmount += o.total_amount || 0
          })
        }
      }

      // Retailer balances from orders
      const retIds = retailersList.map((r: any) => r.id)
      if (retIds.length > 0) {
        const { data: retOrders } = await supabase
          .from("orders")
          .select("retailer_id, total_amount, payment_status, order_status")
          .in("retailer_id", retIds)
          .in("payment_status", ["pending", "partial"])
          .not("order_status", "eq", "cancelled")
        if (retOrders) {
          retOrders.forEach((o: any) => {
            if (!o.retailer_id) return
            const key = `retailer_${o.retailer_id}`
            if (!balanceMap[key]) balanceMap[key] = { totalPending: 0, balanceAmount: 0 }
            balanceMap[key].totalPending += o.total_amount || 0
            balanceMap[key].balanceAmount += o.total_amount || 0
          })
        }
      }

      // Vendor balances from purchases
      const vendorIds = vendorsList.map((v: any) => v.id)
      if (vendorIds.length > 0) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select("vendor_id, total_amount, remaining_amount, payment_status")
          .in("vendor_id", vendorIds)
          .in("payment_status", ["pending", "partial"])
        if (purchases) {
          purchases.forEach((p: any) => {
            if (!p.vendor_id) return
            const key = `vendor_${p.vendor_id}`
            if (!balanceMap[key]) balanceMap[key] = { totalPending: 0, balanceAmount: 0 }
            balanceMap[key].totalPending += p.total_amount || 0
            balanceMap[key].balanceAmount += p.remaining_amount || 0
          })
        }
      }

      setEntityBalanceData(balanceMap)
    } catch (error) {
      console.error("Error fetching entity balance data:", error)
    }
  }

  const fetchEntityOrders = async (entityId: string, type: 'distributor' | 'retailer') => {
    setOrdersLoading(true)
    try {
      const column = type === 'distributor' ? 'distributor_id' : 'retailer_id'
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq(column, entityId)
        .order("order_date", { ascending: false })
      if (error) throw error
      setCustomerOrders(data || [])
    } catch (error) {
      console.error("Error fetching entity orders:", error)
      toast.error("Failed to fetch orders")
    } finally {
      setOrdersLoading(false)
    }
  }

  const fetchVendorPurchasesData = async (vendorId: string) => {
    setOrdersLoading(true)
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
      if (error) throw error
      setVendorPurchases(data || [])
    } catch (error) {
      console.error("Error fetching vendor purchases:", error)
    } finally {
      setOrdersLoading(false)
    }
  }

  // Builds the Vyapar-style combined ledger for a vendor: every purchase
  // bill and every payment as its own row. A bill's "Balance/Unused" is
  // just its remaining_amount; a payment's is amount minus whatever's been
  // allocated against bills so far (from payment_allocations) — so a
  // payment that's only partially applied, or one that's a pure advance
  // with no bill to apply to yet, is visible as such instead of just
  // vanishing into an aggregate.
  const fetchVendorLedgerData = async (vendorId: string) => {
    setLedgerLoading(true)
    try {
      const { data: purchases, error: purchasesErr } = await supabase
        .from("purchases")
        .select("id, purchase_number, purchase_date, total_amount, paid_amount, remaining_amount, payment_status")
        .eq("vendor_id", vendorId)
      if (purchasesErr) throw purchasesErr

      const purchaseIds = (purchases || []).map((p: any) => p.id)
      const refs = [`VENDOR:${vendorId}`, ...purchaseIds.map((id: string) => `PURCHASE:${id}`)]

      const { data: txns, error: txnsErr } = await supabase
        .from("bank_transactions")
        .select("id, txn_date, amount, txn_type, description, reference")
        .in("reference", refs)
      if (txnsErr) throw txnsErr

      const txnIds = (txns || []).map((t: any) => t.id)
      let allocations: any[] = []
      if (txnIds.length > 0) {
        const { data: allocs } = await supabase
          .from("payment_allocations")
          .select("bank_transaction_id, amount_applied")
          .in("bank_transaction_id", txnIds)
        allocations = allocs || []
      }
      const usedByTxn: Record<string, number> = {}
      allocations.forEach((a: any) => {
        usedByTxn[a.bank_transaction_id] = (usedByTxn[a.bank_transaction_id] || 0) + Number(a.amount_applied)
      })

      const purchaseRows = (purchases || []).map((p: any) => ({
        rowType: "purchase" as const,
        id: p.id,
        date: p.purchase_date,
        label: p.purchase_number,
        total: Number(p.total_amount || 0),
        balanceUnused: Number(p.remaining_amount || 0),
        statusLabel: p.payment_status === "completed" ? "Paid" : p.payment_status === "partial" ? "Partial" : "Unpaid",
      }))
      const txnRows = (txns || []).map((t: any) => {
        const used = usedByTxn[t.id] || 0
        const unused = Math.max(0, Number(t.amount || 0) - used)
        return {
          rowType: "payment" as const,
          id: t.id,
          date: t.txn_date,
          label: t.description,
          total: Number(t.amount || 0),
          balanceUnused: unused,
          statusLabel: unused <= 0 ? "Used" : unused >= Number(t.amount || 0) ? "Unused" : "Partially Used",
          txnType: t.txn_type,
        }
      })

      const combined = [...purchaseRows, ...txnRows].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setVendorLedger(combined)
    } catch (error) {
      console.error("Error fetching vendor ledger:", error)
      setVendorLedger([])
    } finally {
      setLedgerLoading(false)
    }
  }

  const handleEntityClick = (entity: ListEntity) => {
    if (entity.role === 'customer') {
      const customer = customers.find(c => c.id === entity.id)
      if (customer) {
        setSelectedCustomer(customer)
        setSelectedEntityRaw(null)
        setSelectedEntityRole(null)
      }
    } else {
      setSelectedCustomer(null)
      setCustomerOrders([])
      setVendorPurchases([])
      setSelectedEntityRole(entity.role)
      if (entity.role === 'distributor' || entity.role === 'sub_distributor') {
        setSelectedEntityRaw(distributorsList.find(d => d.id === entity.id))
      } else if (entity.role === 'retailer') {
        setSelectedEntityRaw(retailersList.find(r => r.id === entity.id))
      } else if (entity.role === 'vendor') {
        setSelectedEntityRaw(vendorsList.find(v => v.id === entity.id))
      }
    }
  }

  const startEditOpeningBalance = () => {
    if (selectedCustomer) {
      setOpeningBalanceInput(String(selectedCustomer.opening_balance ?? 0))
    } else if (selectedEntityRaw) {
      setOpeningBalanceInput(String(selectedEntityRaw.opening_balance ?? 0))
    } else {
      return
    }
    setIsEditingOpeningBalance(true)
  }

  const cancelEditOpeningBalance = () => {
    setIsEditingOpeningBalance(false)
    setOpeningBalanceInput("")
  }

  const saveOpeningBalance = async () => {
    const value = parseFloat(openingBalanceInput)
    if (isNaN(value)) {
      toast.error("Enter a valid number")
      return
    }
    setSavingOpeningBalance(true)
    try {
      if (selectedCustomer) {
        const { error } = await supabase
          .from("customers")
          .update({ opening_balance: value })
          .eq("id", selectedCustomer.id)
        if (error) throw error
        setSelectedCustomer({ ...selectedCustomer, opening_balance: value })
        setCustomers(customers.map(c => c.id === selectedCustomer.id ? { ...c, opening_balance: value } : c))
      } else if (selectedEntityRaw && selectedEntityRole) {
        const tableMap: Record<EntityRole, string> = {
          customer: "customers",
          distributor: "distributors",
          sub_distributor: "distributors",
          retailer: "retailers",
          vendor: "vendors",
        }
        const table = tableMap[selectedEntityRole]
        const { error } = await supabase
          .from(table)
          .update({ opening_balance: value })
          .eq("id", selectedEntityRaw.id)
        if (error) throw error
        const updated = { ...selectedEntityRaw, opening_balance: value }
        setSelectedEntityRaw(updated)
        if (selectedEntityRole === "distributor" || selectedEntityRole === "sub_distributor") {
          setDistributorsList(distributorsList.map(d => d.id === updated.id ? updated : d))
        } else if (selectedEntityRole === "retailer") {
          setRetailersList(retailersList.map(r => r.id === updated.id ? updated : r))
        } else if (selectedEntityRole === "vendor") {
          setVendorsList(vendorsList.map(v => v.id === updated.id ? updated : v))
        }
      } else {
        return
      }
      toast.success("Opening balance updated")
      setIsEditingOpeningBalance(false)
      setOpeningBalanceInput("")
    } catch (error) {
      console.error("Error updating opening balance:", error)
      toast.error("Failed to update opening balance")
    } finally {
      setSavingOpeningBalance(false)
    }
  }

  const getEntityBalance = (entity: ListEntity) => {
    if (entity.role === 'customer') {
      return customerBalanceData[entity.id] || { totalPending: 0, balanceAmount: 0 }
    }
    const roleKey = entity.role === 'sub_distributor' ? 'distributor' : entity.role
    const key = `${roleKey}_${entity.id}`
    return entityBalanceData[key] || { totalPending: 0, balanceAmount: 0 }
  }

  const handleAddCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert([formData])
        .select()

      if (error) throw error
      toast.success("Customer added successfully")
      setIsAddDialogOpen(false)
      setFormData(initialFormData)
      fetchCustomers()
    } catch (error) {
      console.error("Error adding customer:", error)
      toast.error("Failed to add customer")
    }
  }

  const handleEditCustomer = async () => {
    if (!editingId) return

    try {
      const { error } = await supabase
        .from("customers")
        .update(formData)
        .eq("id", editingId)

      if (error) throw error
      toast.success("Customer updated successfully")
      setIsEditDialogOpen(false)
      setFormData(initialFormData)
      setEditingId(null)
      fetchCustomers()
      if (selectedCustomer?.id === editingId) {
        const updatedCustomer = { ...selectedCustomer, ...formData }
        setSelectedCustomer(updatedCustomer as Customer)
      }
    } catch (error) {
      console.error("Error updating customer:", error)
      toast.error("Failed to update customer")
    }
  }

  const handleDeleteCustomer = async () => {
    if (!deletingId) return

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", deletingId)

      if (error) throw error
      toast.success("Customer deleted successfully")
      setIsDeleteDialogOpen(false)
      setDeletingId(null)
      fetchCustomers()
      if (selectedCustomer?.id === deletingId) {
        setSelectedCustomer(null)
        setCustomerOrders([])
      }
    } catch (error) {
      console.error("Error deleting customer:", error)
      toast.error("Failed to delete customer")
    }
  }

  const openEditDialog = (customer: Customer) => {
    setEditingId(customer.id)
    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      mobile_primary: customer.mobile_primary,
      whatsapp_number: customer.whatsapp_number,
      mobile_secondary_1: customer.mobile_secondary_1,
      mobile_secondary_2: customer.mobile_secondary_2,
      company_name: customer.company_name,
      gst_number: customer.gst_number,
      pan_card_number: customer.pan_card_number,
      is_vip: customer.is_vip,
      is_defaulter: customer.is_defaulter,
      is_mandir: customer.is_mandir,
      shipping_flat_number: customer.shipping_flat_number,
      shipping_floor_wing: customer.shipping_floor_wing,
      shipping_building_name: customer.shipping_building_name,
      shipping_street_area: customer.shipping_street_area,
      shipping_landmark: customer.shipping_landmark,
      shipping_pincode: customer.shipping_pincode,
      shipping_country: customer.shipping_country,
      shipping_state: customer.shipping_state,
      shipping_city: customer.shipping_city,
      billing_same_as_shipping: customer.billing_same_as_shipping,
      billing_flat_number: customer.billing_flat_number,
      billing_floor_wing: customer.billing_floor_wing,
      billing_building_name: customer.billing_building_name,
      billing_street_area: customer.billing_street_area,
      billing_landmark: customer.billing_landmark,
      billing_pincode: customer.billing_pincode,
      billing_country: customer.billing_country,
      billing_state: customer.billing_state,
      billing_city: customer.billing_city,
      is_active: customer.is_active,
      whatsapp_same_as_primary: customer.whatsapp_same_as_primary,
      full_address: customer.full_address,
      vip_number: customer.vip_number,
      shipping_room_number: customer.shipping_room_number,
      shipping_floor: customer.shipping_floor,
      shipping_wing: customer.shipping_wing,
      billing_room_number: customer.billing_room_number,
      billing_floor: customer.billing_floor,
      billing_wing: customer.billing_wing,
      opening_balance: customer.opening_balance ?? 0,
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (id: string) => {
    setDeletingId(id)
    setIsDeleteDialogOpen(true)
  }

  const handlePincodeChange = async (value: string, type: "shipping" | "billing") => {
    const cleanValue = value.replace(/\D/g, "")

    if (type === "shipping") {
      setFormData({ ...formData, shipping_pincode: cleanValue })
    } else {
      setFormData({ ...formData, billing_pincode: cleanValue })
    }

    if (cleanValue.length === 6) {
      const result = await lookupPincode(cleanValue)

      if (result) {
        if (type === "shipping") {
          setFormData({
            ...formData,
            shipping_pincode: cleanValue,
            shipping_city: result.city,
            shipping_state: result.state,
            shipping_country: "India",
          })
        } else {
          setFormData({
            ...formData,
            billing_pincode: cleanValue,
            billing_city: result.city,
            billing_state: result.state,
            billing_country: "India",
          })
        }
        toast.success("Location details filled automatically")
      } else {
        toast.error("Invalid pincode or details not found")
      }
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const clearFilters = () => {
    setFilterVip("all")
    setFilterDefaulter("all")
    setFilterMinSpend("")
    setFilterMaxSpend("")
    setSearchQuery("")
    setFilterRole("customer")
  }

  const handleExportWithDateRange = async (exportType: "csv" | "excel" | "pdf") => {
    if (!exportDateFrom || !exportDateTo) {
      toast.error("Please select both From and To dates")
      return
    }

    setExportLoading(true)
    try {
      // Fetch ALL customers within the date range (paginated to avoid limits)
      let allCustomers: Customer[] = []
      let from = 0
      const batchSize = 1000
      const fromDate = new Date(exportDateFrom)
      fromDate.setHours(0, 0, 0, 0)
      const toDate = new Date(exportDateTo)
      toDate.setHours(23, 59, 59, 999)

      while (true) {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .gte("created_at", fromDate.toISOString())
          .lte("created_at", toDate.toISOString())
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allCustomers = allCustomers.concat(data)
        if (data.length < batchSize) break
        from += batchSize
      }

      if (allCustomers.length === 0) {
        toast.error("No customers found in the selected date range")
        setExportLoading(false)
        return
      }

      const exportData = allCustomers.map((customer) => ({
        "First Name": customer.first_name,
        "Last Name": customer.last_name,
        "Mobile": customer.mobile_primary,
        "WhatsApp": customer.whatsapp_number || "",
        "Email": customer.email || "",
        "Company": customer.company_name || "",
        "GST Number": customer.gst_number || "",
        "PAN Number": customer.pan_card_number || "",
        "Sd": customer.is_vip ? "Yes" : "No",
        "Sd Number": customer.vip_number || "",
        "Defaulter": customer.is_defaulter ? "Yes" : "No",
        "Mandir": customer.is_mandir ? "Yes" : "No",
        "Active": customer.is_active ? "Yes" : "No",
        "City": customer.shipping_city || "",
        "State": customer.shipping_state || "",
        "Pincode": customer.shipping_pincode || "",
        "Created": format(new Date(customer.created_at), "PPP"),
      }))

      const filename = `customers_${format(exportDateFrom, "yyyy-MM-dd")}_to_${format(exportDateTo, "yyyy-MM-dd")}`

      if (exportType === "csv") {
        exportToCSV(exportData, filename)
        toast.success(`Exported ${allCustomers.length} customers to CSV`)
      } else if (exportType === "excel") {
        exportToExcel(exportData, filename)
        toast.success(`Exported ${allCustomers.length} customers to Excel`)
      } else if (exportType === "pdf") {
        const pdfColumns = Object.keys(exportData[0]).map((key) => ({
          header: key,
          dataKey: key,
        }))
        exportTableToPDF(exportData, pdfColumns, filename, "Customers Export")
        toast.success(`Exported ${allCustomers.length} customers to PDF`)
      }

      setIsExportDialogOpen(false)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export customers")
    } finally {
      setExportLoading(false)
    }
  }

  const hasActiveFilters = filterVip !== "all" || filterDefaulter !== "all" || filterMinSpend !== "" || filterMaxSpend !== "" || searchQuery !== "" || filterRole !== "customer"

  // Customer-only filters (Sd / Defaulter / spend) only apply when viewing customers
  const showCustomerFilters = filterRole === "all" || filterRole === "customer"

  const filteredCustomers = customers
    .filter((customer) => {
      // Spend filter (client-side since it depends on aggregated order data)
      const spend = customerTotalSpend[customer.id] || 0
      const minSpend = filterMinSpend ? parseFloat(filterMinSpend) : null
      const maxSpend = filterMaxSpend ? parseFloat(filterMaxSpend) : null
      const matchesSpend =
        (minSpend === null || spend >= minSpend) &&
        (maxSpend === null || spend <= maxSpend)

      return matchesSpend
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
        return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      } else if (sortBy === "date") {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA
      } else if (sortBy === "spend") {
        const spendA = customerTotalSpend[a.id] || 0
        const spendB = customerTotalSpend[b.id] || 0
        return sortOrder === "asc" ? spendA - spendB : spendB - spendA
      }
      return 0
    })

  const exportData = filteredCustomers.map((customer) => ({
    "First Name": customer.first_name,
    "Last Name": customer.last_name,
    "Mobile": customer.mobile_primary,
    "WhatsApp": customer.whatsapp_number || "",
    "Email": customer.email || "",
    "Company": customer.company_name || "",
    "GST Number": customer.gst_number || "",
    "PAN Number": customer.pan_card_number || "",
    "Sd": customer.is_vip ? "Yes" : "No",
    "Sd Number": customer.vip_number || "",
    "Defaulter": customer.is_defaulter ? "Yes" : "No",
    "Mandir": customer.is_mandir ? "Yes" : "No",
    "Active": customer.is_active ? "Yes" : "No",
    "City": customer.shipping_city || "",
    "State": customer.shipping_state || "",
    "Pincode": customer.shipping_pincode || "",
    "Created": format(new Date(customer.created_at), "PPP"),
  }))

  // Unified entity list for display
  const allEntities: ListEntity[] = useMemo(() => {
    const entities: ListEntity[] = []
    const searchLower = debouncedSearch.trim().toLowerCase()

    // Add customers
    if (filterRole === 'all' || filterRole === 'customer') {
      entities.push(...filteredCustomers.map(c => ({
        id: c.id,
        role: 'customer' as EntityRole,
        display_name: `${c.first_name} ${c.last_name}`,
        phone: c.mobile_primary,
        email: c.email,
        company_name: c.company_name,
        city: c.shipping_city,
        is_active: c.is_active,
        created_at: c.created_at,
        is_vip: c.is_vip,
        is_defaulter: c.is_defaulter,
        is_mandir: c.is_mandir,
        vip_number: c.vip_number,
      })))
    }

    // Add distributors (parent_id = null)
    if (filterRole === 'all' || filterRole === 'distributor') {
      const filtered = distributorsList.filter(d => !d.parent_id).filter(d => {
        if (!searchLower) return true
        return (d.name || '').toLowerCase().includes(searchLower) ||
          (d.company_name || '').toLowerCase().includes(searchLower) ||
          (d.phone_primary || '').includes(searchLower) ||
          (d.email || '').toLowerCase().includes(searchLower) ||
          (d.shipping_city || '').toLowerCase().includes(searchLower)
      })
      entities.push(...filtered.map(d => ({
        id: d.id,
        role: 'distributor' as EntityRole,
        display_name: d.name || d.company_name || 'Unnamed',
        phone: d.phone_primary || '',
        email: d.email,
        company_name: d.company_name,
        city: d.shipping_city,
        is_active: d.is_active,
        created_at: d.created_at,
      })))
    }

    // Add sub-distributors (parent_id != null)
    if (filterRole === 'all' || filterRole === 'sub_distributor') {
      const filtered = distributorsList.filter(d => d.parent_id).filter(d => {
        if (!searchLower) return true
        return (d.name || '').toLowerCase().includes(searchLower) ||
          (d.company_name || '').toLowerCase().includes(searchLower) ||
          (d.phone_primary || '').includes(searchLower) ||
          (d.email || '').toLowerCase().includes(searchLower) ||
          (d.shipping_city || '').toLowerCase().includes(searchLower)
      })
      entities.push(...filtered.map(d => ({
        id: d.id,
        role: 'sub_distributor' as EntityRole,
        display_name: d.name || d.company_name || 'Unnamed',
        phone: d.phone_primary || '',
        email: d.email,
        company_name: d.company_name,
        city: d.shipping_city,
        is_active: d.is_active,
        created_at: d.created_at,
      })))
    }

    // Add retailers
    if (filterRole === 'all' || filterRole === 'retailer') {
      const filtered = retailersList.filter(r => {
        if (!searchLower) return true
        return (r.name || '').toLowerCase().includes(searchLower) ||
          (r.company_name || '').toLowerCase().includes(searchLower) ||
          (r.phone_primary || '').includes(searchLower) ||
          (r.email || '').toLowerCase().includes(searchLower) ||
          (r.shipping_city || '').toLowerCase().includes(searchLower)
      })
      entities.push(...filtered.map(r => ({
        id: r.id,
        role: 'retailer' as EntityRole,
        display_name: r.name || r.company_name || 'Unnamed',
        phone: r.phone_primary || '',
        email: r.email,
        company_name: r.company_name,
        city: r.shipping_city,
        is_active: r.is_active,
        created_at: r.created_at,
      })))
    }

    // Add vendors
    if (filterRole === 'all' || filterRole === 'vendor') {
      const filtered = vendorsList.filter(v => {
        if (!searchLower) return true
        return (v.vendor_name || '').toLowerCase().includes(searchLower) ||
          (v.company_name || '').toLowerCase().includes(searchLower) ||
          (v.mobile_primary || '').includes(searchLower) ||
          (v.email || '').toLowerCase().includes(searchLower) ||
          (v.city || '').toLowerCase().includes(searchLower)
      })
      entities.push(...filtered.map(v => ({
        id: v.id,
        role: 'vendor' as EntityRole,
        display_name: v.vendor_name || v.company_name || 'Unnamed',
        phone: v.mobile_primary || '',
        email: v.email,
        company_name: v.company_name,
        city: v.city,
        is_active: v.is_active,
        created_at: v.created_at,
      })))
    }

    return entities
  }, [filteredCustomers, distributorsList, retailersList, vendorsList, filterRole, debouncedSearch])

  const getOrderStatusBadge = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "secondary",
      processing: "default",
      packed: "default",
      shipped: "default",
      delivered: "default",
      cancelled: "destructive",
      failed: "destructive",
    }
    return statusMap[status] || "secondary"
  }

  const getPaymentStatusBadge = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "secondary",
      paid: "default",
      failed: "destructive",
      refunded: "destructive",
    }
    return statusMap[status] || "secondary"
  }

  const formatAddress = (customer: Customer, type: "shipping" | "billing") => {
    const prefix = type === "shipping" ? "shipping_" : "billing_"
    const parts = [
      customer[`${prefix}room_number` as keyof Customer],
      customer[`${prefix}floor` as keyof Customer],
      customer[`${prefix}wing` as keyof Customer],
      customer[`${prefix}flat_number` as keyof Customer],
      customer[`${prefix}floor_wing` as keyof Customer],
      customer[`${prefix}building_name` as keyof Customer],
      customer[`${prefix}street_area` as keyof Customer],
      customer[`${prefix}landmark` as keyof Customer],
      customer[`${prefix}city` as keyof Customer],
      customer[`${prefix}state` as keyof Customer],
      customer[`${prefix}pincode` as keyof Customer],
      customer[`${prefix}country` as keyof Customer],
    ].filter(Boolean)

    return parts.join(", ") || "No address provided"
  }

  // Calculate customer statistics
  const totalSpend = customerOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
  const averageOrderValue = customerOrders.length > 0 ? totalSpend / customerOrders.length : 0
  const lastOrderDate = customerOrders.length > 0 ? customerOrders[0].order_date : null

  return (
    <div className="flex gap-3 -mx-6 -my-4 max-w-none w-[calc(100%+3rem)] px-3 py-3">
      {/* Left Panel - Customer List (1/3) */}
      <div className="w-1/3 flex flex-col sticky top-0 h-[calc(100vh-3.5rem)]">
        <Card className="flex flex-1 min-h-0 flex-col gap-3 py-3 border border-border ring-0 shadow-sm rounded-lg">
          <CardHeader className="px-4">
            {/* Title row with actions */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl tracking-tight">Contacts</CardTitle>
                  <CardDescription className="mt-0.5 text-xs flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                      {allEntities.length}
                    </span>
                    <span className="text-muted-foreground">total</span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExportDateFrom(undefined)
                    setExportDateTo(undefined)
                    setIsExportDialogOpen(true)
                  }}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Export
                </Button>
                <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 min-h-0 flex-col gap-3 px-4">
            {/* Search */}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, phone, email, Sd #, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter bar: two tidy rows */}
            <div className="flex flex-col gap-2">
              {/* Row 1: Role / Sd / Defaulter */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="h-8 min-w-[130px] flex-1 text-xs">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="distributor">Distributor</SelectItem>
                    <SelectItem value="sub_distributor">Sub Distributor</SelectItem>
                    <SelectItem value="retailer">Retailer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>

                {showCustomerFilters && (
                  <>
                    <Select value={filterVip} onValueChange={setFilterVip}>
                      <SelectTrigger className="h-8 min-w-[120px] flex-1 text-xs">
                        <SelectValue placeholder="Sd" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        <SelectItem value="vip">Sd Only</SelectItem>
                        <SelectItem value="non-vip">Non-Sd</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterDefaulter} onValueChange={setFilterDefaulter}>
                      <SelectTrigger className="h-8 min-w-[120px] flex-1 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="defaulter">Defaulter</SelectItem>
                        <SelectItem value="non-defaulter">Non-Defaulter</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>

              {/* Row 2: Min/Max spend + Sort + order toggle + Clear */}
              <div className="flex flex-wrap items-center gap-2">
                {showCustomerFilters && (
                  <>
                    <Input
                      type="number"
                      placeholder="Min ₹"
                      value={filterMinSpend}
                      onChange={(e) => setFilterMinSpend(e.target.value)}
                      className="h-8 w-[80px] text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Max ₹"
                      value={filterMaxSpend}
                      onChange={(e) => setFilterMaxSpend(e.target.value)}
                      className="h-8 w-[80px] text-xs"
                    />
                  </>
                )}

                <div className="flex items-center gap-1">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "date" | "spend")}>
                    <SelectTrigger className="h-8 min-w-[90px] text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="spend">Spend</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                    title={sortOrder === "asc" ? "Ascending" : "Descending"}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs ml-auto" onClick={clearFilters}>
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Column headers (Vyapar/Parties style) */}
            <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Party Name</span>
              <span className="text-right pr-1">Amount</span>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <TooltipProvider>
                <div className="divide-y divide-border/60">
                  {loading ? (
                    <div className="space-y-0">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="px-3 py-2.5 animate-pulse grid grid-cols-[1fr_auto] gap-2 items-center">
                          <div className="h-3 w-2/3 rounded bg-muted" />
                          <div className="h-3 w-16 rounded bg-muted/70" />
                        </div>
                      ))}
                    </div>
                  ) : allEntities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                        <User className="h-6 w-6 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">No results found</p>
                      <p className="text-xs mt-0.5">Try adjusting your filters or search</p>
                    </div>
                  ) : (
                    allEntities.map((entity) => {
                      const isSelected =
                        selectedCustomer?.id === entity.id || selectedEntityRaw?.id === entity.id
                      const balance = getEntityBalance(entity)
                      const outstanding = balance.balanceAmount > 0 ? balance.balanceAmount : balance.totalPending
                      const roleConfig = ROLE_BADGE_CONFIG[entity.role]
                      return (
                        <div
                          key={`${entity.role}-${entity.id}`}
                          className={`group relative grid grid-cols-[1fr_auto] gap-2 items-center px-3 py-2.5 cursor-pointer transition-colors ${
                            isSelected ? "bg-accent" : "hover:bg-muted/60"
                          }`}
                          onClick={() => handleEntityClick(entity)}
                        >
                          {isSelected && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" aria-hidden="true" />
                          )}
                          <div className="min-w-0 flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm font-medium truncate">
                                  {entity.display_name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{entity.display_name}</p>
                                {entity.phone && <p className="text-xs">{entity.phone}</p>}
                                {entity.company_name && <p className="text-xs">{entity.company_name}</p>}
                              </TooltipContent>
                            </Tooltip>
                            {entity.role !== "customer" && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${roleConfig.className}`}>
                                {roleConfig.label}
                              </span>
                            )}
                            {entity.is_vip && (
                              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 shrink-0">Sd</span>
                            )}
                            {entity.is_defaulter && (
                              <span className="text-[9px] font-bold text-red-600 dark:text-red-400 shrink-0">DFL</span>
                            )}
                          </div>
                          <span className={`text-sm font-medium tabular-nums text-right pr-1 ${
                            outstanding > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}>
                            {outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </TooltipProvider>
            </ScrollArea>

            {/* Pagination Controls */}
            {totalCustomers > pageSize && (
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCustomers)} of {totalCustomers}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">{currentPage} / {Math.ceil(totalCustomers / pageSize)}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalCustomers / pageSize), p + 1))}
                    disabled={currentPage >= Math.ceil(totalCustomers / pageSize)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(Math.ceil(totalCustomers / pageSize))}
                    disabled={currentPage >= Math.ceil(totalCustomers / pageSize)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Customer Details & Orders (2/3) */}
      <div className="w-2/3 sticky top-0 h-[calc(100vh-3.5rem)] flex flex-col gap-3 overflow-y-auto">
        {selectedCustomer ? (
          <>
            {/* Customer Details Card */}
            <Card className="gap-2 py-3 border border-border ring-0 shadow-sm rounded-lg">
              <CardHeader className="px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => openEditDialog(selectedCustomer)}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    {selectedCustomer.is_vip && <Badge variant="default">Sd</Badge>}
                    {selectedCustomer.is_defaulter && <Badge variant="destructive">Defaulter</Badge>}
                    {selectedCustomer.is_mandir && <Badge variant="secondary">Mandir</Badge>}
                    {!selectedCustomer.is_active && <Badge variant="outline">Inactive</Badge>}
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    {isEditingOpeningBalance ? (
                      <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 h-9">
                        <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          value={openingBalanceInput}
                          onChange={(e) => setOpeningBalanceInput(e.target.value)}
                          className="h-7 w-24 border-0 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="0.00"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveOpeningBalance()
                            if (e.key === "Escape") cancelEditOpeningBalance()
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                          onClick={saveOpeningBalance}
                          disabled={savingOpeningBalance}
                          title="Save"
                        >
                          ✓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={cancelEditOpeningBalance}
                          disabled={savingOpeningBalance}
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startEditOpeningBalance}
                        title="Edit Opening Balance"
                      >
                        <IndianRupee className="h-4 w-4 mr-1" />
                        Opening: {(selectedCustomer.opening_balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedCustomer)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openDeleteDialog(selectedCustomer.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
                {/* Compact Phone/Address summary row (Parties-style) */}
                <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 mt-2 text-sm">
                  <div className="text-xs text-muted-foreground">Phone Number</div>
                  <div className="text-xs text-muted-foreground">Billing Address</div>
                  <div className="font-medium">{selectedCustomer.mobile_primary || "—"}</div>
                  <div className="font-medium truncate">
                    {selectedCustomer.full_address
                      || [selectedCustomer.billing_street_area, selectedCustomer.billing_city, selectedCustomer.billing_state, selectedCustomer.billing_pincode].filter(Boolean).join(", ")
                      || "—"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4">
                <Tabs defaultValue="contact" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="contact">Contact</TabsTrigger>
                    <TabsTrigger value="statistics">Statistics</TabsTrigger>
                  </TabsList>

                  <TabsContent value="contact" className="mt-3">
                    <div className="grid grid-cols-4 gap-4">
                      {/* Mobile 1/4 */}
                      <div className="col-span-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          Primary Mobile
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="font-medium text-sm">{selectedCustomer.mobile_primary}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(selectedCustomer.mobile_primary)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* WhatsApp 1/4 */}
                      <div className="col-span-1 space-y-0.5">
                        {selectedCustomer.whatsapp_number ? (
                          <>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              WhatsApp
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-sm">{selectedCustomer.whatsapp_number}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(selectedCustomer.whatsapp_number!)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        ) : null}
                      </div>

                      {/* Address 2/4 */}
                      <div className="col-span-2 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          Address
                        </div>
                        {selectedCustomer.full_address ? (
                          <div className="flex items-start gap-1">
                            <p className="text-sm leading-relaxed">{selectedCustomer.full_address}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0"
                              onClick={() => copyToClipboard(selectedCustomer.full_address!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No address provided</p>
                        )}
                      </div>

                      {/* Email (full row below) */}
                      {selectedCustomer.email && (
                        <div className="col-span-4 space-y-0.5 pt-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </div>
                          <div className="flex items-center gap-1">
                            <p className="font-medium text-sm break-all">{selectedCustomer.email}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0"
                              onClick={() => copyToClipboard(selectedCustomer.email!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Secondary numbers */}
                      {selectedCustomer.mobile_secondary_1 && (
                        <div className="col-span-2 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            Secondary 1
                          </div>
                          <p className="font-medium text-sm">{selectedCustomer.mobile_secondary_1}</p>
                        </div>
                      )}

                      {selectedCustomer.mobile_secondary_2 && (
                        <div className="col-span-2 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            Secondary 2
                          </div>
                          <p className="font-medium text-sm">{selectedCustomer.mobile_secondary_2}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="statistics" className="space-y-4">
                    {ordersLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading statistics...</div>
                    ) : customerOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No orders to show statistics</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-3">
                        {/* Total Orders */}
                        <div className="p-3 rounded-lg border border-border bg-card">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Package className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                              Orders
                            </span>
                          </div>
                          <p className="text-2xl font-bold leading-none">
                            {customerOrders.length}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Total placed
                          </p>
                        </div>

                        {/* Total Spend */}
                        <div className="p-3 rounded-lg border border-border bg-card">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <IndianRupee className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                              Spend
                            </span>
                          </div>
                          <p className="text-2xl font-bold leading-none flex items-center">
                            <IndianRupee className="h-4 w-4" />
                            {totalSpend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Lifetime value
                          </p>
                        </div>

                        {/* Avg Order Value */}
                        <div className="p-3 rounded-lg border border-border bg-card">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <ShoppingCart className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                              Avg
                            </span>
                          </div>
                          <p className="text-2xl font-bold leading-none flex items-center">
                            <IndianRupee className="h-4 w-4" />
                            {averageOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Per order
                          </p>
                        </div>

                        {/* Last Order */}
                        <div className="p-3 rounded-lg border border-border bg-card">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                              Last
                            </span>
                          </div>
                          <p className="text-base font-bold leading-tight">
                            {lastOrderDate ? format(new Date(lastOrderDate), "dd MMM") : "N/A"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {lastOrderDate ? format(new Date(lastOrderDate), "yyyy") : "No orders"}
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Transactions Card (Parties-style table) */}
            <Card className="flex flex-col overflow-hidden border border-border ring-0 shadow-sm rounded-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Transactions</CardTitle>
                    <CardDescription>
                      {customerOrders.length} {customerOrders.length === 1 ? "order" : "orders"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {customerOrders.length > 0 && (
                      <ExportButtons
                        data={customerOrders.map((order) => ({
                          "Order Number": order.order_number,
                          "Order Date": format(new Date(order.order_date), "PPP"),
                          "Status": order.order_status,
                          "Payment Status": order.payment_status,
                          "Delivery Status": order.delivery_status || "",
                          "Total Amount": order.total_amount,
                          "Invoice Number": order.is_gst_invoice ? order.invoice_number_gst : order.invoice_number_non_gst || "",
                          "Assigned To": (order as any).delivery_partner
                            ? `${(order as any).delivery_partner.first_name} ${(order as any).delivery_partner.last_name}`
                            : "",
                          "Source": order.source || "",
                          "Priority": order.is_priority ? "Yes" : "No",
                        }))}
                        filename={`${selectedCustomer.first_name}_${selectedCustomer.last_name}_orders`}
                      />
                    )}
                    <Link href={`/dashboard/orders?customer=${selectedCustomer.id}`}>
                      <Button size="sm" variant="outline">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        View All Orders
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-hidden">
                {/* Compact Transactions Table (Parties-style) */}
                {!ordersLoading && customerOrders.length > 0 && (
                  <div className="border rounded-md overflow-hidden mb-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-[11px] uppercase tracking-wide">Type</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Number</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Date</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Total</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Balance / Unused</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Status</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerOrders.map((order) => {
                          const invoiceNo = order.is_gst_invoice ? order.invoice_number_gst : order.invoice_number_non_gst
                          const total = order.total_amount || 0
                          const payOut = order.payment_out_amount || 0
                          const balance = order.payment_status === "completed"
                            ? 0
                            : Math.max(0, total - payOut)
                          const statusLabel = order.payment_status === "completed"
                            ? "Paid"
                            : order.payment_status === "partial"
                              ? "Partial"
                              : "Unpaid"
                          const statusColor = order.payment_status === "completed"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : order.payment_status === "partial"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          return (
                            <TableRow key={`txn-${order.id}`} className="hover:bg-muted/30">
                              <TableCell className="font-medium text-sm">Sale</TableCell>
                              <TableCell className="font-mono text-xs">{invoiceNo || order.order_number}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {format(new Date(order.order_date), "dd/MM/yyyy")}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums font-medium">
                                ₹ {total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                ₹ {balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className={`text-sm font-medium ${statusColor}`}>{statusLabel}</TableCell>
                              <TableCell>
                                <Link href={`/dashboard/orders/${order.id}`}>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <ScrollArea className="h-[400px]">
                  {ordersLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
                  ) : customerOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No orders found for this customer</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-4">
                      {customerOrders.map((order) => (
                        <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                          <div className="p-4 rounded-lg border border-border hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-medium">{order.order_number}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(order.order_date), "PPP")}
                                </p>
                                {/* Invoice Number */}
                                {(order.invoice_number_gst || order.invoice_number_non_gst) && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Invoice: {order.is_gst_invoice ? order.invoice_number_gst : order.invoice_number_non_gst}
                                  </p>
                                )}
                                {/* Assigned To */}
                                {(order as any).delivery_partner && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Assigned: {(order as any).delivery_partner.first_name} {(order as any).delivery_partner.last_name}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <p className="font-semibold flex items-center">
                                  <IndianRupee className="h-4 w-4" />
                                  {order.total_amount.toFixed(2)}
                                </p>
                                {order.is_priority && (
                                  <Badge variant="destructive" className="text-xs">Priority</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={getOrderStatusBadge(order.order_status) as "default" | "secondary" | "destructive"}>
                                {order.order_status}
                              </Badge>
                              <Badge variant={getPaymentStatusBadge(order.payment_status) as "default" | "secondary" | "destructive"}>
                                {order.payment_status}
                              </Badge>
                              {order.delivery_status && (
                                <Badge variant="outline">{order.delivery_status}</Badge>
                              )}
                              {order.source && (
                                <Badge variant="outline" className="text-xs">{order.source}</Badge>
                              )}
                            </div>

                            {/* Payment In / Payment Out per order (stacked) */}
                            {(() => {
                              const total = order.total_amount || 0
                              const payOutAmount = order.payment_out_amount || 0
                              const payOutMethod = order.payment_out_method || null
                              // Payment In = money paid before delivery (pre-payment / advance).
                              // Only counts if the order is marked fully completed AND collected < total.
                              const payInAmount =
                                order.payment_status === "completed"
                                  ? Math.max(0, total - payOutAmount)
                                  : 0
                              const payInMethod = payInAmount > 0 ? order.payment_method : null
                              return (
                                <div className="mt-3 pt-3 border-t space-y-2">
                                  <div className="flex items-center justify-between rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400">
                                        Payment In
                                      </span>
                                      <span className="text-xs font-medium capitalize text-emerald-900 dark:text-emerald-200">
                                        {payInMethod || "—"}
                                      </span>
                                    </div>
                                    <p className="text-sm font-bold flex items-center text-emerald-700 dark:text-emerald-400">
                                      <IndianRupee className="h-3 w-3" />
                                      {payInAmount.toFixed(2)}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] uppercase tracking-wide font-semibold text-red-700 dark:text-red-400">
                                        Sale
                                      </span>
                                      <span className="text-xs font-medium capitalize text-red-900 dark:text-red-200">
                                        {payOutMethod || "—"}
                                      </span>
                                    </div>
                                    <p className="text-sm font-bold flex items-center text-red-700 dark:text-red-400">
                                      <IndianRupee className="h-3 w-3" />
                                      {payOutAmount.toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        ) : selectedEntityRaw && selectedEntityRole ? (
          <>
            {/* Entity Details Card */}
            <Card className="gap-2 py-3 border border-border ring-0 shadow-sm">
              <CardHeader className="px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {selectedEntityRole === 'vendor' ? selectedEntityRaw.vendor_name : selectedEntityRaw.name}
                    {selectedEntityRaw.company_name && selectedEntityRaw.company_name !== (selectedEntityRole === 'vendor' ? selectedEntityRaw.vendor_name : selectedEntityRaw.name) && (
                      <span className="text-sm font-normal text-muted-foreground">({selectedEntityRaw.company_name})</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ROLE_BADGE_CONFIG[selectedEntityRole].className}`}>
                      {ROLE_BADGE_CONFIG[selectedEntityRole].label}
                    </span>
                    {!selectedEntityRaw.is_active && <Badge variant="outline">Inactive</Badge>}
                    {selectedEntityRaw.is_verified && <Badge variant="default" className="text-[10px]">Verified</Badge>}
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    {isEditingOpeningBalance ? (
                      <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 h-9">
                        <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          value={openingBalanceInput}
                          onChange={(e) => setOpeningBalanceInput(e.target.value)}
                          className="h-7 w-24 border-0 px-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="0.00"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveOpeningBalance()
                            if (e.key === "Escape") cancelEditOpeningBalance()
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                          onClick={saveOpeningBalance}
                          disabled={savingOpeningBalance}
                          title="Save"
                        >
                          ✓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={cancelEditOpeningBalance}
                          disabled={savingOpeningBalance}
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startEditOpeningBalance}
                        title="Edit Opening Balance"
                      >
                        <IndianRupee className="h-4 w-4 mr-1" />
                        Opening: {(selectedEntityRaw.opening_balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Button>
                    )}
                    <Link href={`/dashboard/${selectedEntityRole === 'vendor' ? 'vendors' : selectedEntityRole === 'retailer' ? 'retailers' : 'distributors'}/${selectedEntityRaw.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Full Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* Phone */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      Phone
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="font-medium text-sm">
                        {selectedEntityRole === 'vendor' ? selectedEntityRaw.mobile_primary : selectedEntityRaw.phone_primary || '—'}
                      </p>
                      {(selectedEntityRole === 'vendor' ? selectedEntityRaw.mobile_primary : selectedEntityRaw.phone_primary) && (
                        <Button
                          variant="ghost" size="sm" className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(selectedEntityRole === 'vendor' ? selectedEntityRaw.mobile_primary : selectedEntityRaw.phone_primary)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  {selectedEntityRaw.email && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-sm break-all">{selectedEntityRaw.email}</p>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(selectedEntityRaw.email)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {(selectedEntityRaw.shipping_city || selectedEntityRaw.city) && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        Location
                      </div>
                      <p className="font-medium text-sm">
                        {selectedEntityRaw.shipping_city || selectedEntityRaw.city}
                        {(selectedEntityRaw.shipping_state || selectedEntityRaw.state) && `, ${selectedEntityRaw.shipping_state || selectedEntityRaw.state}`}
                      </p>
                    </div>
                  )}

                  {/* GST */}
                  {selectedEntityRaw.gst_number && (
                    <div className="space-y-0.5">
                      <div className="text-xs text-muted-foreground">GST Number</div>
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-sm">{selectedEntityRaw.gst_number}</p>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(selectedEntityRaw.gst_number)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Contact Person (retailer/vendor) */}
                  {selectedEntityRaw.contact_person && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        Contact Person
                      </div>
                      <p className="font-medium text-sm">{selectedEntityRaw.contact_person}</p>
                    </div>
                  )}

                  {/* Secondary Phone */}
                  {(selectedEntityRaw.phone_secondary || selectedEntityRaw.mobile_secondary_1) && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        Secondary
                      </div>
                      <p className="font-medium text-sm">{selectedEntityRaw.phone_secondary || selectedEntityRaw.mobile_secondary_1}</p>
                    </div>
                  )}
                </div>

                {/* Balance Summary */}
                {(() => {
                  const roleKey = selectedEntityRole === 'sub_distributor' ? 'distributor' : selectedEntityRole
                  const key = `${roleKey}_${selectedEntityRaw.id}`
                  const bal = entityBalanceData[key]
                  if (!bal || bal.balanceAmount === 0) return null
                  return (
                    <div className={`mt-4 p-3 rounded-lg border ${
                      selectedEntityRole === 'vendor'
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${
                          selectedEntityRole === 'vendor'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}>
                          {selectedEntityRole === 'vendor' ? 'Amount Payable (Hum unko denge)' : 'Amount Receivable (Humko milega)'}
                        </span>
                        <span className={`text-lg font-bold flex items-center ${
                          selectedEntityRole === 'vendor'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}>
                          <IndianRupee className="h-4 w-4" />
                          {bal.balanceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Orders / Purchases Card */}
            {selectedEntityRole !== 'vendor' ? (
              <Card className="flex flex-col overflow-hidden border border-border ring-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Orders</CardTitle>
                      <CardDescription>
                        {customerOrders.length} {customerOrders.length === 1 ? "order" : "orders"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-hidden">
                  <ScrollArea className="h-[400px]">
                    {ordersLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
                    ) : customerOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No orders found</p>
                      </div>
                    ) : (
                      <div className="space-y-3 pr-4">
                        {customerOrders.map((order) => (
                          <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                            <div className="p-4 rounded-lg border border-border hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer shadow-sm">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-medium">{order.order_number}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(order.order_date), "PPP")}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <p className="font-semibold flex items-center">
                                    <IndianRupee className="h-4 w-4" />
                                    {order.total_amount.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={getOrderStatusBadge(order.order_status) as "default" | "secondary" | "destructive"}>
                                  {order.order_status}
                                </Badge>
                                <Badge variant={getPaymentStatusBadge(order.payment_status) as "default" | "secondary" | "destructive"}>
                                  {order.payment_status}
                                </Badge>
                                {order.delivery_status && (
                                  <Badge variant="outline">{order.delivery_status}</Badge>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex flex-col overflow-hidden border border-border ring-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Transactions</CardTitle>
                      <CardDescription>
                        Every bill and every payment, each with its own remaining balance — so a bill paid across several part-payments is easy to follow.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-hidden">
                  {ledgerLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
                  ) : vendorLedger.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No transactions found</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="overflow-x-auto pr-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Number</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="text-right">Balance/Unused</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {vendorLedger.map((row: any) => (
                              <TableRow key={`${row.rowType}-${row.id}`}>
                                <TableCell className="whitespace-nowrap">
                                  {row.rowType === "purchase" ? "Purchase" : row.txnType === "Cr" ? "Payment-In" : "Payment-Out"}
                                </TableCell>
                                <TableCell className="max-w-[220px] truncate" title={row.label || ""}>
                                  {row.label || "—"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">{row.date ? format(new Date(row.date), "dd/MM/yyyy") : "—"}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">₹{row.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className={`text-right whitespace-nowrap ${row.balanceUnused > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                                  ₹{row.balanceUnused.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={row.statusLabel === "Paid" || row.statusLabel === "Used" ? "default" : row.statusLabel === "Partial" || row.statusLabel === "Partially Used" ? "secondary" : "outline"}>
                                    {row.statusLabel}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="flex-1 flex items-center justify-center border-2 border-dashed border-border ring-0 rounded-lg">
            <CardContent className="text-center py-12">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 ring-8 ring-primary/5">
                <User className="h-10 w-10 text-primary/60" />
              </div>
              <p className="text-lg font-medium mb-2">No Contact Selected</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">Select a customer, distributor, retailer or vendor from the list to view their details</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Customer Dialog */}
      {/* Add Customer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>Enter customer details to create a new customer</DialogDescription>
          </DialogHeader>
          <CustomerForm
            formData={formData}
            setFormData={setFormData}
            handlePincodeChange={handlePincodeChange}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCustomer}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer information</DialogDescription>
          </DialogHeader>
          <CustomerForm
            formData={formData}
            setFormData={setFormData}
            handlePincodeChange={handlePincodeChange}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditCustomer}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Date Range Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Customers</DialogTitle>
            <DialogDescription>Select a date range to export all customers created within that period</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${!exportDateFrom ? "text-muted-foreground" : ""}`}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {exportDateFrom ? format(exportDateFrom, "dd MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={exportDateFrom}
                      onSelect={setExportDateFrom}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${!exportDateTo ? "text-muted-foreground" : ""}`}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {exportDateTo ? format(exportDateTo, "dd MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={exportDateTo}
                      onSelect={setExportDateTo}
                      disabled={(date) => date > new Date() || (exportDateFrom ? date < exportDateFrom : false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {exportDateFrom && exportDateTo && (
              <p className="text-sm text-muted-foreground">
                Exporting customers created from <span className="font-medium text-foreground">{format(exportDateFrom, "dd MMM yyyy")}</span> to <span className="font-medium text-foreground">{format(exportDateTo, "dd MMM yyyy")}</span>
              </p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)} disabled={exportLoading}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportWithDateRange("csv")}
              disabled={!exportDateFrom || !exportDateTo || exportLoading}
            >
              <FileText className="mr-2 h-4 w-4" />
              {exportLoading ? "Exporting..." : "CSV"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExportWithDateRange("excel")}
              disabled={!exportDateFrom || !exportDateTo || exportLoading}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {exportLoading ? "Exporting..." : "Excel"}
            </Button>
            <Button
              onClick={() => handleExportWithDateRange("pdf")}
              disabled={!exportDateFrom || !exportDateTo || exportLoading}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {exportLoading ? "Exporting..." : "PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the customer and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
