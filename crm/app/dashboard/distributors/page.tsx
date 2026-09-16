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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, CheckCircle, X, Eye, Download } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type Distributor = {
  id: string
  name: string
  email: string
  phone_primary: string
  phone_secondary: string | null
  phone_tertiary: string | null
  company_name: string
  gst_number: string
  invoice_code: string | null
  serviceable_pincodes: string[] | null
  shipping_address_line1: string
  shipping_address_line2: string | null
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  shipping_country: string | null
  billing_address_line1: string
  billing_address_line2: string | null
  billing_city: string
  billing_state: string
  billing_pincode: string
  billing_country: string | null
  aadhaar_number: string | null
  pan_number: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  bank_account_holder_name: string | null
  bank_branch: string | null
  aadhaar_card_url: string | null
  pan_card_url: string | null
  user_photo_url: string | null
  payment_qr_code_url: string | null
  gumasta_license_url: string | null
  udyog_aadhaar_url: string | null
  cancelled_cheque_url: string | null
  bank_passbook_url: string | null
  parent_id: string | null
  user_id: string | null
  is_active: boolean
  is_verified: boolean
  created_at: string
  updated_at: string | null
}

type DistributorFormData = Omit<Distributor, 'id' | 'created_at' | 'updated_at' | 'serviceable_pincodes' | 'phone_secondary' | 'phone_tertiary' | 'shipping_address_line2' | 'shipping_country' | 'billing_address_line2' | 'billing_country' | 'aadhaar_number' | 'pan_number' | 'bank_name' | 'bank_account_number' | 'bank_ifsc_code' | 'bank_account_holder_name' | 'bank_branch' | 'aadhaar_card_url' | 'pan_card_url' | 'user_photo_url' | 'payment_qr_code_url' | 'gumasta_license_url' | 'udyog_aadhaar_url' | 'cancelled_cheque_url' | 'bank_passbook_url' | 'parent_id' | 'user_id' | 'invoice_code'> & {
  phone_secondary: string
  phone_tertiary: string
  invoice_code: string
  serviceable_pincodes: string[]
  shipping_address_line2: string
  shipping_country: string
  billing_address_line2: string
  billing_country: string
  aadhaar_number: string
  pan_number: string
  bank_name: string
  bank_account_number: string
  bank_ifsc_code: string
  bank_account_holder_name: string
  bank_branch: string
  aadhaar_card_url: string
  pan_card_url: string
  user_photo_url: string
  payment_qr_code_url: string
  gumasta_license_url: string
  udyog_aadhaar_url: string
  cancelled_cheque_url: string
  bank_passbook_url: string
  parent_id: string
  user_id: string
}

type User = {
  id: string
  full_name: string | null
  email: string
  role: string
}

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null)
  const [deletingDistributor, setDeletingDistributor] = useState<Distributor | null>(null)
  const [saving, setSaving] = useState(false)
  const [useSameAddress, setUseSameAddress] = useState(true)
  const [newPincode, setNewPincode] = useState("")
  const [uploadingFiles, setUploadingFiles] = useState<{[key: string]: boolean}>({})
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})

  // Helper function to get parent distributor name
  const getParentName = (parentId: string | null): string => {
    if (!parentId) return "Main Distributor"
    const parent = distributors.find(d => d.id === parentId)
    return parent ? `${parent.name}` : "Unknown"
  }

  // Helper functions for managing pincodes
  const handleAddPincode = () => {
    const input = newPincode.trim()
    if (!input) return

    // Split by comma and process each pincode
    const pincodes = input.split(',').map(p => p.trim()).filter(p => p.length > 0)

    if (pincodes.length === 0) return

    const invalidPincodes: string[] = []
    const duplicatePincodes: string[] = []
    const validPincodes: string[] = []

    pincodes.forEach(pincode => {
      // Basic validation - check if it's a 6-digit number
      if (!/^\d{6}$/.test(pincode)) {
        invalidPincodes.push(pincode)
      } else if (formData.serviceable_pincodes.includes(pincode) || validPincodes.includes(pincode)) {
        duplicatePincodes.push(pincode)
      } else {
        validPincodes.push(pincode)
      }
    })

    // Show error messages for invalid or duplicate pincodes
    if (invalidPincodes.length > 0) {
      toast.error(`Invalid pincodes (must be 6 digits): ${invalidPincodes.join(', ')}`)
    }
    if (duplicatePincodes.length > 0) {
      toast.error(`Already added: ${duplicatePincodes.join(', ')}`)
    }

    // Add valid pincodes
    if (validPincodes.length > 0) {
      setFormData({
        ...formData,
        serviceable_pincodes: [...formData.serviceable_pincodes, ...validPincodes]
      })
      toast.success(`Added ${validPincodes.length} pincode${validPincodes.length > 1 ? 's' : ''}`)
      setNewPincode("")
    }
  }

  const handleRemovePincode = (pincodeToRemove: string) => {
    setFormData({
      ...formData,
      serviceable_pincodes: formData.serviceable_pincodes.filter(p => p !== pincodeToRemove)
    })
  }

  // File upload handler
  const handleFileUpload = async (file: File, fieldName: string) => {
    if (!file) return

    // Functional updates — this form has ~9 document upload fields, and each
    // upload is an independent async operation. Spreading the `formData`/
    // `uploadingFiles`/`uploadProgress` closures directly (the old code) meant
    // that uploading two documents close together would let whichever one
    // resolved LAST overwrite the state with its own stale snapshot, silently
    // erasing whatever field the OTHER upload had just set — e.g. uploading
    // Aadhaar then PAN would wipe aadhaar_card_url back to empty even though
    // the file itself made it to storage, and the mandatory-Aadhaar check
    // would then (correctly, given the wiped state) block creating the
    // distributor with no obvious explanation why.
    setUploadingFiles(prev => ({ ...prev, [fieldName]: true }))
    setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }))

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `distributors/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, [fieldName]: publicUrl }))
      toast.success("File uploaded successfully")
    } catch (error: unknown) {
      console.error("Error uploading file:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file"
      toast.error(errorMessage)
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }))
      setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }))
    }
  }

  // Remove uploaded file
  const handleRemoveFile = (fieldName: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: "" }))
    toast.success("File removed")
  }

  const [formData, setFormData] = useState<DistributorFormData>({
    name: "",
    email: "",
    phone_primary: "",
    phone_secondary: "",
    phone_tertiary: "",
    company_name: "",
    gst_number: "",
    invoice_code: "",
    serviceable_pincodes: [],
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_pincode: "",
    shipping_country: "India",
    billing_address_line1: "",
    billing_address_line2: "",
    billing_city: "",
    billing_state: "",
    billing_pincode: "",
    billing_country: "India",
    aadhaar_number: "",
    pan_number: "",
    bank_name: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_account_holder_name: "",
    bank_branch: "",
    aadhaar_card_url: "",
    pan_card_url: "",
    user_photo_url: "",
    payment_qr_code_url: "",
    gumasta_license_url: "",
    udyog_aadhaar_url: "",
    cancelled_cheque_url: "",
    bank_passbook_url: "",
    parent_id: "",
    user_id: "",
    is_active: true,
    is_verified: false,
  })

  useEffect(() => {
    fetchDistributors()
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .in("role", ["main_distributor", "sub_distributor"])
      .order("full_name")

    if (error) {
      console.error("Error fetching users:", error)
    } else {
      setUsers(data || [])
    }
  }

  const fetchDistributors = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("distributors")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching distributors:", error)
      toast.error("Failed to fetch distributors")
    } else {
      setDistributors(data || [])
    }
    setLoading(false)
  }

  const handleOpenDialog = (distributor?: Distributor) => {
    if (distributor) {
      setEditingDistributor(distributor)
      setFormData({
        name: distributor.name,
        email: distributor.email,
        phone_primary: distributor.phone_primary,
        phone_secondary: distributor.phone_secondary || "",
        phone_tertiary: distributor.phone_tertiary || "",
        company_name: distributor.company_name,
        gst_number: distributor.gst_number,
        invoice_code: distributor.invoice_code || "",
        serviceable_pincodes: distributor.serviceable_pincodes || [],
        shipping_address_line1: distributor.shipping_address_line1,
        shipping_address_line2: distributor.shipping_address_line2 || "",
        shipping_city: distributor.shipping_city,
        shipping_state: distributor.shipping_state,
        shipping_pincode: distributor.shipping_pincode,
        shipping_country: distributor.shipping_country || "India",
        billing_address_line1: distributor.billing_address_line1,
        billing_address_line2: distributor.billing_address_line2 || "",
        billing_city: distributor.billing_city,
        billing_state: distributor.billing_state,
        billing_pincode: distributor.billing_pincode,
        billing_country: distributor.billing_country || "India",
        aadhaar_number: distributor.aadhaar_number || "",
        pan_number: distributor.pan_number || "",
        bank_name: distributor.bank_name || "",
        bank_account_number: distributor.bank_account_number || "",
        bank_ifsc_code: distributor.bank_ifsc_code || "",
        bank_account_holder_name: distributor.bank_account_holder_name || "",
        bank_branch: distributor.bank_branch || "",
        aadhaar_card_url: distributor.aadhaar_card_url || "",
        pan_card_url: distributor.pan_card_url || "",
        user_photo_url: distributor.user_photo_url || "",
        payment_qr_code_url: distributor.payment_qr_code_url || "",
        gumasta_license_url: distributor.gumasta_license_url || "",
        udyog_aadhaar_url: distributor.udyog_aadhaar_url || "",
        cancelled_cheque_url: distributor.cancelled_cheque_url || "",
        bank_passbook_url: distributor.bank_passbook_url || "",
        parent_id: distributor.parent_id || "",
        user_id: distributor.user_id || "",
        is_active: distributor.is_active,
        is_verified: distributor.is_verified,
      })
    } else {
      setEditingDistributor(null)
      setFormData({
        name: "",
        email: "",
        phone_primary: "",
        phone_secondary: "",
        phone_tertiary: "",
        company_name: "",
        gst_number: "",
        invoice_code: "",
        serviceable_pincodes: [],
        shipping_address_line1: "",
        shipping_address_line2: "",
        shipping_city: "",
        shipping_state: "",
        shipping_pincode: "",
        shipping_country: "India",
        billing_address_line1: "",
        billing_address_line2: "",
        billing_city: "",
        billing_state: "",
        billing_pincode: "",
        billing_country: "India",
        aadhaar_number: "",
        pan_number: "",
        bank_name: "",
        bank_account_number: "",
        bank_ifsc_code: "",
        bank_account_holder_name: "",
        bank_branch: "",
        aadhaar_card_url: "",
        pan_card_url: "",
        user_photo_url: "",
        payment_qr_code_url: "",
        gumasta_license_url: "",
        udyog_aadhaar_url: "",
        cancelled_cheque_url: "",
        bank_passbook_url: "",
        parent_id: "",
        user_id: "",
        is_active: true,
        is_verified: false,
      })
    }
    setUseSameAddress(true)
    setNewPincode("")
    setDialogOpen(true)
  }

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!formData.company_name.trim()) {
      toast.error("Company name is required")
      return
    }
    if (!formData.phone_primary.trim()) {
      toast.error("Primary phone number is required")
      return
    }

    // Validate email format if provided
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        toast.error("Please enter a valid email address")
        return
      }
    }

    // Validate phone number format (10 digits)
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(formData.phone_primary.replace(/\s/g, ''))) {
      toast.error("Primary phone must be a 10-digit number")
      return
    }
    if (formData.phone_secondary.trim() && !phoneRegex.test(formData.phone_secondary.replace(/\s/g, ''))) {
      toast.error("Secondary phone must be a 10-digit number")
      return
    }
    if (formData.phone_tertiary.trim() && !phoneRegex.test(formData.phone_tertiary.replace(/\s/g, ''))) {
      toast.error("Tertiary phone must be a 10-digit number")
      return
    }

    // Validate GST number format (15 characters)
    if (formData.gst_number.trim()) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
      if (!gstRegex.test(formData.gst_number.trim().toUpperCase())) {
        toast.error("Please enter a valid 15-character GST number")
        return
      }
    }

    // Validate PAN number format (10 characters)
    if (formData.pan_number.trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
      if (!panRegex.test(formData.pan_number.trim().toUpperCase())) {
        toast.error("Please enter a valid 10-character PAN number")
        return
      }
    }

    // Validate Aadhaar number format (12 digits)
    if (formData.aadhaar_number.trim()) {
      const aadhaarRegex = /^[0-9]{12}$/
      if (!aadhaarRegex.test(formData.aadhaar_number.replace(/\s/g, ''))) {
        toast.error("Please enter a valid 12-digit Aadhaar number")
        return
      }
    }

    // Validate shipping pincode (6 digits)
    if (formData.shipping_pincode.trim()) {
      if (!/^[0-9]{6}$/.test(formData.shipping_pincode.trim())) {
        toast.error("Shipping pincode must be a 6-digit number")
        return
      }
    }

    // Validate billing pincode (6 digits) if not using same address
    if (!useSameAddress && formData.billing_pincode.trim()) {
      if (!/^[0-9]{6}$/.test(formData.billing_pincode.trim())) {
        toast.error("Billing pincode must be a 6-digit number")
        return
      }
    }

    // Validate mandatory documents
    if (!formData.aadhaar_card_url) {
      toast.error("Aadhaar card document is mandatory")
      return
    }
    if (!formData.pan_card_url) {
      toast.error("PAN card document is mandatory")
      return
    }
    if (!formData.gumasta_license_url) {
      toast.error("Gumasta license document is mandatory")
      return
    }
    if (!formData.payment_qr_code_url) {
      toast.error("Payment QR code is mandatory")
      return
    }
    if (!formData.cancelled_cheque_url) {
      toast.error("Cancelled cheque document is mandatory")
      return
    }

    // Validate invoice code format (uppercase alphanumeric, 2-10 characters)
    if (formData.invoice_code && formData.invoice_code.trim()) {
      const invoiceCodeTrimmed = formData.invoice_code.trim().toUpperCase()
      if (!/^[A-Z0-9]{2,10}$/.test(invoiceCodeTrimmed)) {
        toast.error("Invoice code must be 2-10 uppercase letters/numbers only")
        return
      }

      // Check if invoice code is already used by another distributor
      const { data: existingDistributor, error: checkError } = await supabase
        .from("distributors")
        .select("id")
        .eq("invoice_code", invoiceCodeTrimmed)
        .single()

      if (checkError && checkError.code !== "PGRST116") { // PGRST116 means no rows found, which is fine
        console.error("Error checking invoice code:", checkError)
      }

      if (existingDistributor && (!editingDistributor || existingDistributor.id !== editingDistributor.id)) {
        toast.error("This invoice code is already in use by another distributor")
        return
      }

      // Update form data with uppercase invoice code
      formData.invoice_code = invoiceCodeTrimmed
    }

    // Prevent changing invoice code if it's already set
    if (editingDistributor && editingDistributor.invoice_code && formData.invoice_code !== editingDistributor.invoice_code) {
      toast.error("Invoice code cannot be changed once set")
      return
    }

    setSaving(true)

    try {
      const distributorData = { ...formData }

      // Convert empty UUID fields to null to prevent PostgreSQL UUID validation errors
      if (!distributorData.parent_id || distributorData.parent_id === "") {
        distributorData.parent_id = null as unknown as string
      }
      if (!distributorData.user_id || distributorData.user_id === "") {
        distributorData.user_id = null as unknown as string
      }

      // Convert empty optional string fields to null for database consistency
      const optionalStringFields = [
        'phone_secondary', 'phone_tertiary', 'invoice_code',
        'shipping_address_line2', 'shipping_country',
        'billing_address_line2', 'billing_country',
        'aadhaar_number', 'pan_number',
        'bank_name', 'bank_account_number', 'bank_ifsc_code', 'bank_account_holder_name', 'bank_branch',
        'aadhaar_card_url', 'pan_card_url', 'user_photo_url', 'payment_qr_code_url',
        'gumasta_license_url', 'udyog_aadhaar_url', 'cancelled_cheque_url', 'bank_passbook_url'
      ] as const

      optionalStringFields.forEach(field => {
        if (distributorData[field] === "") {
          (distributorData as Record<string, unknown>)[field] = null
        }
      })

      // Convert empty serviceable_pincodes array to null or keep the array
      if (distributorData.serviceable_pincodes.length === 0) {
        // Keep as empty array instead of null for consistency
      }

      // If using same address for billing, copy shipping to billing
      if (useSameAddress && !editingDistributor) {
        distributorData.billing_address_line1 = distributorData.shipping_address_line1
        distributorData.billing_address_line2 = distributorData.shipping_address_line2
        distributorData.billing_city = distributorData.shipping_city
        distributorData.billing_state = distributorData.shipping_state
        distributorData.billing_pincode = distributorData.shipping_pincode
        distributorData.billing_country = distributorData.shipping_country
      }

      if (editingDistributor) {
        const { error } = await supabase
          .from("distributors")
          .update(distributorData)
          .eq("id", editingDistributor.id)

        if (error) throw error
        toast.success("Distributor updated successfully")
      } else {
        const { error } = await supabase
          .from("distributors")
          .insert([distributorData])

        if (error) throw error
        toast.success("Distributor created successfully")
      }

      setDialogOpen(false)
      fetchDistributors()
    } catch (error: unknown) {
      console.error("Error saving distributor:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save distributor"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingDistributor) return

    try {
      const { error } = await supabase
        .from("distributors")
        .delete()
        .eq("id", deletingDistributor.id)

      if (error) throw error

      toast.success("Distributor deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingDistributor(null)
      fetchDistributors()
    } catch (error: unknown) {
      console.error("Error deleting distributor:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete distributor"
      toast.error(errorMessage)
    }
  }

  const handleQuickApprove = async (distributor: Distributor) => {
    try {
      const { error } = await supabase
        .from("distributors")
        .update({ is_verified: true })
        .eq("id", distributor.id)

      if (error) throw error

      toast.success(`${distributor.name} approved successfully`)
      fetchDistributors()
    } catch (error: unknown) {
      console.error("Error approving distributor:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to approve distributor"
      toast.error(errorMessage)
    }
  }

  const filteredDistributors = distributors.filter(
    (distributor) =>
      distributor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      distributor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      distributor.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      distributor.gst_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      distributor.phone_primary.includes(searchTerm)
  )

  // Separate distributors into approved and non-approved
  const nonApprovedDistributors = filteredDistributors.filter(d => !d.is_verified)
  const approvedDistributors = filteredDistributors.filter(d => d.is_verified)

  // Export distributors to CSV
  const exportToCSV = () => {
    try {
      // Define CSV headers
      const headers = [
        "Name",
        "Company Name",
        "Invoice Code",
        "Email",
        "Phone Primary",
        "Phone Secondary",
        "Phone Tertiary",
        "GST Number",
        "PAN Number",
        "Aadhaar Number",
        "Shipping Address Line 1",
        "Shipping Address Line 2",
        "Shipping City",
        "Shipping State",
        "Shipping Pincode",
        "Shipping Country",
        "Billing Address Line 1",
        "Billing Address Line 2",
        "Billing City",
        "Billing State",
        "Billing Pincode",
        "Billing Country",
        "Bank Name",
        "Bank Account Number",
        "Bank IFSC Code",
        "Bank Account Holder Name",
        "Bank Branch",
        "Type",
        "Status",
        "Verified",
        "Serviceable Pincodes Count",
        "Serviceable Pincodes"
      ]

      // Convert distributors to CSV rows
      const rows = filteredDistributors.map(distributor => {
        const parentName = distributor.parent_id ? getParentName(distributor.parent_id) : "Main Distributor"
        const pincodes = distributor.serviceable_pincodes || []

        return [
          distributor.name,
          distributor.company_name,
          distributor.invoice_code || "Not set",
          distributor.email,
          distributor.phone_primary,
          distributor.phone_secondary || "",
          distributor.phone_tertiary || "",
          distributor.gst_number,
          distributor.pan_number || "",
          distributor.aadhaar_number || "",
          distributor.shipping_address_line1,
          distributor.shipping_address_line2 || "",
          distributor.shipping_city,
          distributor.shipping_state,
          distributor.shipping_pincode,
          distributor.shipping_country || "India",
          distributor.billing_address_line1,
          distributor.billing_address_line2 || "",
          distributor.billing_city,
          distributor.billing_state,
          distributor.billing_pincode,
          distributor.billing_country || "India",
          distributor.bank_name || "",
          distributor.bank_account_number || "",
          distributor.bank_ifsc_code || "",
          distributor.bank_account_holder_name || "",
          distributor.bank_branch || "",
          distributor.parent_id ? `Sub (${parentName})` : "Main",
          distributor.is_active ? "Active" : "Inactive",
          distributor.is_verified ? "Verified" : "Not Verified",
          pincodes.length,
          pincodes.join("; ")
        ].map(field => {
          // Escape fields containing commas, quotes, or newlines
          const stringField = String(field)
          if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`
          }
          return stringField
        })
      })

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n')

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link.setAttribute('href', url)
      link.setAttribute('download', `distributors_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(`Exported ${filteredDistributors.length} distributor(s)`)
    } catch (error) {
      console.error("Error exporting distributors:", error)
      toast.error("Failed to export distributors")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Distributors</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Distributors</h1>
          <p className="text-muted-foreground">Manage your distributor network</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={distributors.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Distributor
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search distributors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Non-Approved Distributors */}
      <Card>
        <CardHeader>
          <CardTitle>Non-Approved Distributors</CardTitle>
          <CardDescription>
            Distributors pending verification ({nonApprovedDistributors.length})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Invoice Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GST Number</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nonApprovedDistributors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      No non-approved distributors found
                    </TableCell>
                  </TableRow>
                ) : (
                  nonApprovedDistributors.map((distributor) => (
                    <TableRow key={distributor.id}>
                      <TableCell className="font-medium">
                        {distributor.name}
                      </TableCell>
                      <TableCell>{distributor.company_name}</TableCell>
                      <TableCell>
                        {distributor.invoice_code ? (
                          <Badge variant="outline" className="font-mono">
                            {distributor.invoice_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>{distributor.email}</TableCell>
                      <TableCell>{distributor.phone_primary}</TableCell>
                      <TableCell>{distributor.gst_number}</TableCell>
                      <TableCell>
                        {distributor.shipping_city}, {distributor.shipping_state}
                      </TableCell>
                      <TableCell>
                        <Badge variant={distributor.parent_id ? "outline" : "default"}>
                          {distributor.parent_id ? `Sub (${getParentName(distributor.parent_id)})` : "Main"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={distributor.is_active ? "default" : "secondary"}>
                            {distributor.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/distributors/${distributor.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View distributor details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleQuickApprove(distributor)}
                            title="Approve distributor"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(distributor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingDistributor(distributor)
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
        </CardContent>
      </Card>

      {/* Approved Distributors */}
      <Card>
        <CardHeader>
          <CardTitle>Approved Distributors</CardTitle>
          <CardDescription>
            Verified distributors ({approvedDistributors.length})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Invoice Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GST Number</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedDistributors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      No approved distributors found
                    </TableCell>
                  </TableRow>
                ) : (
                  approvedDistributors.map((distributor) => (
                    <TableRow key={distributor.id}>
                      <TableCell className="font-medium">
                        {distributor.name}
                      </TableCell>
                      <TableCell>{distributor.company_name}</TableCell>
                      <TableCell>
                        {distributor.invoice_code ? (
                          <Badge variant="outline" className="font-mono">
                            {distributor.invoice_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>{distributor.email}</TableCell>
                      <TableCell>{distributor.phone_primary}</TableCell>
                      <TableCell>{distributor.gst_number}</TableCell>
                      <TableCell>
                        {distributor.shipping_city}, {distributor.shipping_state}
                      </TableCell>
                      <TableCell>
                        <Badge variant={distributor.parent_id ? "outline" : "default"}>
                          {distributor.parent_id ? `Sub (${getParentName(distributor.parent_id)})` : "Main"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={distributor.is_active ? "default" : "secondary"}>
                            {distributor.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">Verified</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/dashboard/distributors/${distributor.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View distributor details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(distributor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingDistributor(distributor)
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog - Simplified for brevity, showing only essential fields */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="!w-[95vw] !max-w-[1400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDistributor ? "Edit Distributor" : "Add New Distributor"}
            </DialogTitle>
            <DialogDescription>
              {editingDistributor
                ? "Update distributor information"
                : "Enter distributor details to create a new distributor"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_primary">Phone Primary *</Label>
                  <Input
                    id="phone_primary"
                    value={formData.phone_primary}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_primary: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number *</Label>
                  <Input
                    id="gst_number"
                    value={formData.gst_number}
                    onChange={(e) =>
                      setFormData({ ...formData, gst_number: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan_number">PAN Number</Label>
                  <Input
                    id="pan_number"
                    value={formData.pan_number}
                    onChange={(e) =>
                      setFormData({ ...formData, pan_number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_code">Invoice Code</Label>
                  <Input
                    id="invoice_code"
                    value={formData.invoice_code}
                    onChange={(e) =>
                      setFormData({ ...formData, invoice_code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g., ABC, XYZ123"
                    maxLength={10}
                    disabled={editingDistributor?.invoice_code ? true : false}
                    className={editingDistributor?.invoice_code ? "bg-muted cursor-not-allowed" : ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingDistributor?.invoice_code
                      ? "Invoice code cannot be changed once set"
                      : "2-10 uppercase letters/numbers. Used for order invoices. Cannot be changed later."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent_id">Parent Distributor (for Subdistributors)</Label>
                <Select
                  value={formData.parent_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parent_id: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent distributor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Main Distributor)</SelectItem>
                    {distributors
                      .filter((d) => d.is_verified && (!editingDistributor || d.id !== editingDistributor.id))
                      .map((distributor) => (
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
                    <SelectValue placeholder="Select a user account (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No User Linked</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link a user account to allow distributor panel login. User must have main_distributor or sub_distributor role.
                </p>
              </div>
            </div>

            {/* Additional Contact Numbers */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg border-b pb-2">Additional Contact Numbers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_secondary">Phone Secondary</Label>
                  <Input
                    id="phone_secondary"
                    value={formData.phone_secondary}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_secondary: e.target.value })
                    }
                    placeholder="Enter secondary phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_tertiary">Phone Tertiary</Label>
                  <Input
                    id="phone_tertiary"
                    value={formData.phone_tertiary}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_tertiary: e.target.value })
                    }
                    placeholder="Enter tertiary phone number"
                  />
                </div>
              </div>
            </div>

            {/* Identity Documents */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg border-b pb-2">Identity Documents</h3>
              <div className="space-y-2">
                <Label htmlFor="aadhaar_number">Aadhaar Number</Label>
                <Input
                  id="aadhaar_number"
                  value={formData.aadhaar_number}
                  onChange={(e) =>
                    setFormData({ ...formData, aadhaar_number: e.target.value })
                  }
                  placeholder="Enter 12-digit Aadhaar number"
                  maxLength={12}
                />
              </div>
            </div>

            {/* Banking Details */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg border-b pb-2">Banking Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_name: e.target.value })
                    }
                    placeholder="Enter bank name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_holder_name">Account Holder Name</Label>
                  <Input
                    id="bank_account_holder_name"
                    value={formData.bank_account_holder_name}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_account_holder_name: e.target.value })
                    }
                    placeholder="Enter account holder name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_account_number: e.target.value })
                    }
                    placeholder="Enter account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_ifsc_code">IFSC Code</Label>
                  <Input
                    id="bank_ifsc_code"
                    value={formData.bank_ifsc_code}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_ifsc_code: e.target.value })
                    }
                    placeholder="Enter IFSC code"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_branch">Bank Branch</Label>
                <Input
                  id="bank_branch"
                  value={formData.bank_branch}
                  onChange={(e) =>
                    setFormData({ ...formData, bank_branch: e.target.value })
                  }
                  placeholder="Enter branch name/location"
                />
              </div>
            </div>

            {/* Serviceable Pincodes */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg border-b pb-2">Serviceable Pincodes</h3>
              <div className="space-y-2">
                <Label htmlFor="pincode_input">Add Pincode(s)</Label>
                <div className="flex gap-2">
                  <Input
                    id="pincode_input"
                    placeholder="Enter pincodes (comma-separated: 411001, 411002, 411003)"
                    value={newPincode}
                    onChange={(e) => setNewPincode(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddPincode()
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddPincode} variant="secondary">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: Enter multiple pincodes separated by commas (e.g., 411001, 411002, 411003)
                </p>
                {formData.serviceable_pincodes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      Added Pincodes ({formData.serviceable_pincodes.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {formData.serviceable_pincodes.map((pincode) => (
                        <Badge key={pincode} variant="secondary" className="px-3 py-1">
                          {pincode}
                          <button
                            type="button"
                            onClick={() => handleRemovePincode(pincode)}
                            className="ml-2 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg border-b pb-2">Shipping Address</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipping_address_line1">Address Line 1 *</Label>
                  <Input
                    id="shipping_address_line1"
                    value={formData.shipping_address_line1}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_address_line1: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_address_line2">Address Line 2</Label>
                  <Input
                    id="shipping_address_line2"
                    value={formData.shipping_address_line2}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_address_line2: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipping_city">City *</Label>
                  <Input
                    id="shipping_city"
                    value={formData.shipping_city}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_city: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_state">State *</Label>
                  <Input
                    id="shipping_state"
                    value={formData.shipping_state}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_state: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_pincode">Pincode *</Label>
                  <Input
                    id="shipping_pincode"
                    value={formData.shipping_pincode}
                    onChange={(e) =>
                      setFormData({ ...formData, shipping_pincode: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {!editingDistributor && (
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
              )}
            </div>

            {/* Billing Address - only show if not using same address or editing */}
            {(!useSameAddress || editingDistributor) && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold text-lg border-b pb-2">Billing Address</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing_address_line1">Address Line 1 *</Label>
                    <Input
                      id="billing_address_line1"
                      value={formData.billing_address_line1}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_address_line1: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_address_line2">Address Line 2</Label>
                    <Input
                      id="billing_address_line2"
                      value={formData.billing_address_line2}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_address_line2: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing_city">City *</Label>
                    <Input
                      id="billing_city"
                      value={formData.billing_city}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_city: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_state">State *</Label>
                    <Input
                      id="billing_state"
                      value={formData.billing_state}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_state: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_pincode">Pincode *</Label>
                    <Input
                      id="billing_pincode"
                      value={formData.billing_pincode}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_pincode: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Document Uploads */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg border-b pb-2">Document Uploads</h3>
              <p className="text-sm text-muted-foreground">Upload required documents for verification</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Aadhaar Card Upload */}
                <div className="border rounded-lg p-4 space-y-3 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="aadhaar_card_url" className="font-semibold">Aadhaar Card *</Label>
                    {formData.aadhaar_card_url && (
                      <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                    )}
                  </div>
                  {!formData.aadhaar_card_url ? (
                    <div className="relative">
                      <Input
                        id="aadhaar_card_url"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, "aadhaar_card_url")
                        }}
                        disabled={uploadingFiles.aadhaar_card_url}
                        className="cursor-pointer"
                      />
                      {uploadingFiles.aadhaar_card_url && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(formData.aadhaar_card_url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile("aadhaar_card_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* PAN Card Upload */}
                <div className="border rounded-lg p-4 space-y-3 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pan_card_url" className="font-semibold">PAN Card *</Label>
                    {formData.pan_card_url && (
                      <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                    )}
                  </div>
                  {!formData.pan_card_url ? (
                    <div className="relative">
                      <Input
                        id="pan_card_url"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, "pan_card_url")
                        }}
                        disabled={uploadingFiles.pan_card_url}
                        className="cursor-pointer"
                      />
                      {uploadingFiles.pan_card_url && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(formData.pan_card_url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile("pan_card_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* User Photo Upload */}
                <div className="border rounded-lg p-4 space-y-3 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="user_photo_url" className="font-semibold">Distributor Photo</Label>
                    {formData.user_photo_url && (
                      <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                    )}
                  </div>
                  {!formData.user_photo_url ? (
                    <div className="relative">
                      <Input
                        id="user_photo_url"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, "user_photo_url")
                        }}
                        disabled={uploadingFiles.user_photo_url}
                        className="cursor-pointer"
                      />
                      {uploadingFiles.user_photo_url && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(formData.user_photo_url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile("user_photo_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment QR Code Upload */}
                <div className="border rounded-lg p-4 space-y-3 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="payment_qr_code_url" className="font-semibold">Payment QR Code *</Label>
                    {formData.payment_qr_code_url && (
                      <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                    )}
                  </div>
                  {!formData.payment_qr_code_url ? (
                    <div className="relative">
                      <Input
                        id="payment_qr_code_url"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, "payment_qr_code_url")
                        }}
                        disabled={uploadingFiles.payment_qr_code_url}
                        className="cursor-pointer"
                      />
                      {uploadingFiles.payment_qr_code_url && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(formData.payment_qr_code_url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile("payment_qr_code_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gumasta License Upload */}
                <div className="border rounded-lg p-4 space-y-3 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gumasta_license_url" className="font-semibold">Gumasta License *</Label>
                    {formData.gumasta_license_url && (
                      <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                    )}
                  </div>
                  {!formData.gumasta_license_url ? (
                    <div className="relative">
                      <Input
                        id="gumasta_license_url"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, "gumasta_license_url")
                        }}
                        disabled={uploadingFiles.gumasta_license_url}
                        className="cursor-pointer"
                      />
                      {uploadingFiles.gumasta_license_url && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(formData.gumasta_license_url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile("gumasta_license_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Udyog Aadhaar Upload */}
                <div className="border rounded-lg p-4 space-y-3 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="udyog_aadhaar_url" className="font-semibold">Udyog Aadhaar</Label>
                    {formData.udyog_aadhaar_url && (
                      <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                    )}
                  </div>
                  {!formData.udyog_aadhaar_url ? (
                    <div className="relative">
                      <Input
                        id="udyog_aadhaar_url"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, "udyog_aadhaar_url")
                        }}
                        disabled={uploadingFiles.udyog_aadhaar_url}
                        className="cursor-pointer"
                      />
                      {uploadingFiles.udyog_aadhaar_url && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(formData.udyog_aadhaar_url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile("udyog_aadhaar_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cancelled Cheque Upload */}
                <div className="border rounded-lg p-4 space-y-3 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cancelled_cheque_url" className="font-semibold">Cancelled Cheque *</Label>
                    {formData.cancelled_cheque_url && (
                      <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                    )}
                  </div>
                  {!formData.cancelled_cheque_url ? (
                    <div className="relative">
                      <Input
                        id="cancelled_cheque_url"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, "cancelled_cheque_url")
                        }}
                        disabled={uploadingFiles.cancelled_cheque_url}
                        className="cursor-pointer"
                      />
                      {uploadingFiles.cancelled_cheque_url && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(formData.cancelled_cheque_url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile("cancelled_cheque_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bank Passbook Upload */}
                <div className="border rounded-lg p-4 space-y-3 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bank_passbook_url" className="font-semibold">Bank Passbook</Label>
                    {formData.bank_passbook_url && (
                      <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                    )}
                  </div>
                  {!formData.bank_passbook_url ? (
                    <div className="relative">
                      <Input
                        id="bank_passbook_url"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, "bank_passbook_url")
                        }}
                        disabled={uploadingFiles.bank_passbook_url}
                        className="cursor-pointer"
                      />
                      {uploadingFiles.bank_passbook_url && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(formData.bank_passbook_url, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile("bank_passbook_url")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg border-b pb-2">Status</h3>
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
                    checked={formData.is_verified}
                    onChange={(e) =>
                      setFormData({ ...formData, is_verified: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <span>Verified</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingDistributor ? "Update" : "Create"}
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
              This will permanently delete the distributor{" "}
              <strong>{deletingDistributor?.name}</strong> from{" "}
              <strong>{deletingDistributor?.company_name}</strong>. This action cannot be undone.
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
    </div>
  )
}
