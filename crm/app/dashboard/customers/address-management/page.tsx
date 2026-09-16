"use client"

import { useState, useEffect, useRef } from 'react'
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { MapPinned, Loader2, ChevronLeft, ChevronRight } from "lucide-react"

interface Customer {
  id: string
  first_name: string
  last_name: string
  mobile_primary: string
  full_address: string | null
  shipping_pincode: string | null
  shipping_building_name: string
  shipping_street_area: string
  shipping_city: string
  shipping_state: string
}

import { getGoogleMapsApiKey } from '@/lib/config/google-maps'

// Clean and format address for better geocoding
function cleanAddressForGeocoding(address: string): string {
  // Replace semicolons with commas
  let cleaned = address.replace(/;/g, ', ')

  // Remove multiple consecutive commas/spaces
  cleaned = cleaned.replace(/,\s*,/g, ',')
  cleaned = cleaned.replace(/\s+/g, ' ')

  // Remove leading/trailing commas and spaces
  cleaned = cleaned.replace(/^[\s,]+|[\s,]+$/g, '')

  return cleaned
}

// Google Maps Geocoding API
async function getAddressWithPincode(address: string): Promise<string | null> {
  const apiKey = getGoogleMapsApiKey()

  try {
    // Clean the address for better geocoding results
    const cleanedAddress = cleanAddressForGeocoding(address)
    console.log(`Original address: ${address}`)
    console.log(`Cleaned address for API: ${cleanedAddress}`)

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanedAddress)}&key=${apiKey}`
    )

    const data = await response.json()
    console.log(`Google Maps API response status: ${data.status}`)

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      console.log(`Found ${data.results.length} results from Google Maps`)

      // Search through ALL results for postal code (not just the first one)
      for (let i = 0; i < data.results.length; i++) {
        const result = data.results[i]

        // Find postal code from address components
        const postalCodeComponent = result.address_components?.find(
          (component: any) => component.types.includes('postal_code')
        )

        if (postalCodeComponent) {
          console.log(`Found pincode in result ${i + 1}: ${postalCodeComponent.long_name}`)
          return postalCodeComponent.long_name
        }
      }

      console.log('No postal code found in any of the results')
    } else if (data.status === 'ZERO_RESULTS') {
      console.log('Google Maps returned zero results for this address')
    } else if (data.error_message) {
      console.error('Google Maps API error:', data.error_message)
    }

    return null
  } catch (error) {
    console.error('Error fetching pincode from Google Maps:', error)
    return null
  }
}

export default function CustomerAddressManagement() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedAddress, setEditedAddress] = useState<string>('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [totalCustomers, setTotalCustomers] = useState(0)

  // States for name editing
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editedFirstName, setEditedFirstName] = useState<string>('')
  const [editedLastName, setEditedLastName] = useState<string>('')

  // Pagination states for table display
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50 // Show 50 items per page in the table

  // Bulk update states
  const [bulkUpdateDialogOpen, setBulkUpdateDialogOpen] = useState(false)
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState(0)
  const [bulkUpdateTotal, setBulkUpdateTotal] = useState(0)
  const [bulkUpdateCurrent, setBulkUpdateCurrent] = useState('')
  const [bulkUpdateRunning, setBulkUpdateRunning] = useState(false)
  const [bulkUpdateStats, setBulkUpdateStats] = useState({ updated: 0, skipped: 0, failed: 0 })
  const bulkUpdateCancelRef = useRef(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    setError(null)

    try {
      // First get the total count
      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })

      setTotalCustomers(count || 0)
      console.log(`Total customers in database: ${count}`)

      // Fetch all customers in batches if necessary
      let allCustomers: Customer[] = []
      const batchSize = 1000
      let offset = 0

      while (offset < (count || 0)) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, first_name, last_name, mobile_primary, full_address, shipping_pincode, shipping_building_name, shipping_street_area, shipping_city, shipping_state')
          .order('first_name', { ascending: true })
          .range(offset, offset + batchSize - 1)

        if (error) throw error

        if (data) {
          allCustomers = [...allCustomers, ...data]
          console.log(`Fetched batch: ${offset + 1} to ${offset + data.length}`)
        }

        offset += batchSize

        // Update UI with progress
        if (count && count > batchSize) {
          const progress = Math.min(100, (allCustomers.length / count) * 100)
          toast.loading(`Loading customers: ${allCustomers.length} / ${count} (${Math.round(progress)}%)`, {
            id: 'loading-customers'
          })
        }
      }

      setCustomers(allCustomers)
      console.log(`Successfully fetched all ${allCustomers.length} customers`)

      toast.dismiss('loading-customers')
      if (allCustomers.length > 0) {
        toast.success(`Successfully loaded all ${allCustomers.length} customers`)
      }
    } catch (err: any) {
      setError(err.message)
      toast.error('Failed to fetch customers')
      toast.dismiss('loading-customers')
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (customer: Customer) => {
    setEditingId(customer.id)
    setEditedAddress(customer.full_address || constructFullAddress(customer))
  }

  const startEditingName = (customer: Customer) => {
    setEditingNameId(customer.id)
    setEditedFirstName(customer.first_name)
    setEditedLastName(customer.last_name)
  }

  const constructFullAddress = (customer: Customer): string => {
    const parts = [
      customer.shipping_building_name,
      customer.shipping_street_area,
      customer.shipping_city,
      customer.shipping_state
    ].filter(Boolean)

    if (customer.shipping_pincode) {
      parts.push(customer.shipping_pincode)
    }

    return parts.join(', ')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditedAddress('')
  }

  const cancelEditingName = () => {
    setEditingNameId(null)
    setEditedFirstName('')
    setEditedLastName('')
  }

  const saveName = async (customer: Customer) => {
    if (!editedFirstName.trim() || !editedLastName.trim()) {
      toast.error('First name and last name are required')
      return
    }

    setUpdatingId(customer.id)

    try {
      // Update the database
      const { error } = await supabase
        .from('customers')
        .update({
          first_name: editedFirstName.trim(),
          last_name: editedLastName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id)

      if (error) throw error

      // Update local state
      setCustomers(prev =>
        prev.map(c =>
          c.id === customer.id
            ? { ...c, first_name: editedFirstName.trim(), last_name: editedLastName.trim() }
            : c
        )
      )

      toast.success('Name updated successfully')
      setEditingNameId(null)
      setEditedFirstName('')
      setEditedLastName('')

    } catch (err: any) {
      console.error('Error updating name:', err)
      toast.error('Failed to update name')
    } finally {
      setUpdatingId(null)
    }
  }

  const saveAddress = async (customer: Customer) => {
    if (!editedAddress.trim()) {
      toast.error('Address cannot be empty')
      return
    }

    setUpdatingId(customer.id)

    try {
      let finalAddress = editedAddress

      // Check if pincode exists in the address
      const pincodeRegex = /\b\d{6}\b/
      const hasPincode = pincodeRegex.test(editedAddress)

      if (!hasPincode) {
        toast.info('Detecting pincode using Google Maps...')

        // Try to get pincode from Google Maps
        const detectedPincode = await getAddressWithPincode(editedAddress)

        if (detectedPincode) {
          finalAddress = `${editedAddress}, ${detectedPincode}`
          toast.success(`Pincode ${detectedPincode} detected and added`)
        } else {
          toast.warning('Could not detect pincode. Please add it manually.')
        }
      }

      // Update the database
      const { error } = await supabase
        .from('customers')
        .update({
          full_address: finalAddress,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id)

      if (error) throw error

      // Update local state
      setCustomers(prev =>
        prev.map(c =>
          c.id === customer.id
            ? { ...c, full_address: finalAddress }
            : c
        )
      )

      toast.success('Address updated successfully')
      setEditingId(null)
      setEditedAddress('')

    } catch (err: any) {
      console.error('Error updating address:', err)
      toast.error('Failed to update address')
    } finally {
      setUpdatingId(null)
    }
  }

  // Helper function to add delay for rate limiting
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const bulkUpdateAllAddresses = async () => {
    console.log('Starting bulk update...')
    setBulkUpdateRunning(true)
    bulkUpdateCancelRef.current = false
    setBulkUpdateProgress(0)
    setBulkUpdateStats({ updated: 0, skipped: 0, failed: 0 })

    // Filter customers that need pincode
    const customersNeedingPincode = customers.filter(customer => {
      // Check full_address first
      if (customer.full_address && customer.full_address.trim() !== '') {
        const pincodeRegex = /\b\d{6}\b/
        const hasPincode = pincodeRegex.test(customer.full_address)
        return !hasPincode
      }

      // If no full_address, check if shipping_pincode exists
      const hasShippingPincode = customer.shipping_pincode && customer.shipping_pincode.trim() !== ''
      return !hasShippingPincode
    })

    console.log(`Found ${customersNeedingPincode.length} customers needing pincode out of ${customers.length} total`)
    setBulkUpdateTotal(customersNeedingPincode.length)

    // Show warning for large datasets
    if (customersNeedingPincode.length > 100) {
      const estimatedTime = Math.ceil((customersNeedingPincode.length * 0.3) / 60) // 0.3 seconds per customer
      toast.warning(`Processing ${customersNeedingPincode.length} customers. Estimated time: ${estimatedTime} minutes`, {
        duration: 5000
      })
    }

    if (customersNeedingPincode.length === 0) {
      toast.info('All customers already have pincodes in their addresses')
      setBulkUpdateDialogOpen(false)
      setBulkUpdateRunning(false)
      return
    }

    const stats = { updated: 0, skipped: 0, failed: 0 }

    for (let i = 0; i < customersNeedingPincode.length; i++) {
      const customer = customersNeedingPincode[i]

      if (bulkUpdateCancelRef.current) {
        console.log('Bulk update cancelled by user')
        // User cancelled the operation
        break
      }

      setBulkUpdateCurrent(`${customer.first_name} ${customer.last_name}`)
      setBulkUpdateProgress(((i + 1) / customersNeedingPincode.length) * 100)

      try {
        const currentAddress = customer.full_address || constructFullAddress(customer)
        console.log(`Processing customer ${i + 1}/${customersNeedingPincode.length}: ${customer.first_name} ${customer.last_name}`)
        console.log(`Address to process: ${currentAddress}`)

        // Add delay to respect rate limits (1 request per 300ms = ~3 requests per second for better reliability)
        await delay(300)

        const detectedPincode = await getAddressWithPincode(currentAddress)
        console.log(`Detected pincode: ${detectedPincode}`)

        if (detectedPincode) {
          const newAddress = `${currentAddress}, ${detectedPincode}`

          // Update database
          const { error } = await supabase
            .from('customers')
            .update({
              full_address: newAddress,
              shipping_pincode: detectedPincode,
              updated_at: new Date().toISOString()
            })
            .eq('id', customer.id)

          if (error) {
            console.error(`Error updating customer ${customer.id}:`, error)
            stats.failed++
          } else {
            // Update local state
            setCustomers(prev =>
              prev.map(c =>
                c.id === customer.id
                  ? { ...c, full_address: newAddress, shipping_pincode: detectedPincode }
                  : c
              )
            )
            stats.updated++
          }
        } else {
          console.log(`Could not detect pincode for customer ${customer.id}`)
          stats.skipped++
        }
      } catch (err) {
        console.error(`Error processing customer ${customer.id}:`, err)
        stats.failed++
      }

      setBulkUpdateStats({ ...stats })
    }

    // Final summary
    const summary = []
    if (stats.updated > 0) summary.push(`${stats.updated} updated`)
    if (stats.skipped > 0) summary.push(`${stats.skipped} skipped`)
    if (stats.failed > 0) summary.push(`${stats.failed} failed`)

    toast.success(`Bulk update completed: ${summary.join(', ')}`)

    setBulkUpdateRunning(false)
    setBulkUpdateProgress(100)

    // Close dialog after a short delay
    setTimeout(() => {
      setBulkUpdateDialogOpen(false)
      setBulkUpdateProgress(0)
      setBulkUpdateStats({ updated: 0, skipped: 0, failed: 0 })
    }, 2000)
  }

  const cancelBulkUpdate = () => {
    bulkUpdateCancelRef.current = true
    setBulkUpdateRunning(false)
    setBulkUpdateDialogOpen(false)
    toast.info('Bulk update cancelled')
  }

  const detectAndUpdatePincode = async (customer: Customer) => {
    setUpdatingId(customer.id)

    try {
      const currentAddress = customer.full_address || constructFullAddress(customer)

      // Check if address already has pincode
      const pincodeRegex = /\b\d{6}\b/
      if (pincodeRegex.test(currentAddress)) {
        toast.info('Address already contains a pincode')
        setUpdatingId(null)
        return
      }

      toast.info('Detecting pincode using Google Maps...')
      const detectedPincode = await getAddressWithPincode(currentAddress)

      if (detectedPincode) {
        const newAddress = `${currentAddress}, ${detectedPincode}`

        // Update database
        const { error } = await supabase
          .from('customers')
          .update({
            full_address: newAddress,
            shipping_pincode: detectedPincode,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)

        if (error) throw error

        // Update local state
        setCustomers(prev =>
          prev.map(c =>
            c.id === customer.id
              ? { ...c, full_address: newAddress, shipping_pincode: detectedPincode }
              : c
          )
        )

        toast.success(`Pincode ${detectedPincode} detected and added`)
      } else {
        toast.warning('Could not detect pincode for this address')
      }

    } catch (err: any) {
      console.error('Error detecting pincode:', err)
      toast.error('Failed to detect pincode')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Customer Address Management</h1>
        <div className="space-y-4">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading all customers from database...</p>
            {totalCustomers > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Total customers to load: {totalCustomers.toLocaleString()}
              </p>
            )}
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Customer Address Management</h1>
        <Alert variant="destructive">
          <AlertDescription>
            Error loading customers: {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customer Address Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Loaded: <strong>{customers.length.toLocaleString()}</strong> customers
            {totalCustomers > 0 && totalCustomers !== customers.length &&
              ` (Database total: ${totalCustomers.toLocaleString()})`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setBulkUpdateDialogOpen(true)}
            variant="default"
            disabled={loading || customers.length === 0}
          >
            <MapPinned className="mr-2 h-4 w-4" />
            Bulk Update All ({customers.length.toLocaleString()})
          </Button>
          <Button onClick={fetchCustomers} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableCaption>
            {customers.length > 0
              ? `Click on any name or address to edit inline. Pincode will be automatically detected if missing. Total loaded: ${customers.length.toLocaleString()} customers`
              : 'No customers loaded'
            }
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Name</TableHead>
              <TableHead className="w-[150px]">Number</TableHead>
              <TableHead>Full Address</TableHead>
              <TableHead className="w-[250px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">
                  {editingNameId === customer.id ? (
                    <div className="flex gap-1">
                      <Input
                        value={editedFirstName}
                        onChange={(e) => setEditedFirstName(e.target.value)}
                        className="w-[120px]"
                        placeholder="First name"
                        disabled={updatingId === customer.id}
                      />
                      <Input
                        value={editedLastName}
                        onChange={(e) => setEditedLastName(e.target.value)}
                        className="w-[120px]"
                        placeholder="Last name"
                        disabled={updatingId === customer.id}
                      />
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-muted p-2 rounded"
                      onClick={() => startEditingName(customer)}
                    >
                      {customer.first_name} {customer.last_name}
                    </div>
                  )}
                </TableCell>
                <TableCell>{customer.mobile_primary}</TableCell>
                <TableCell>
                  {editingId === customer.id ? (
                    <Input
                      value={editedAddress}
                      onChange={(e) => setEditedAddress(e.target.value)}
                      className="w-full"
                      placeholder="Enter full address"
                      disabled={updatingId === customer.id}
                    />
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-muted p-2 rounded"
                      onClick={() => startEditing(customer)}
                    >
                      {customer.full_address || constructFullAddress(customer)}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === customer.id ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveAddress(customer)}
                        disabled={updatingId === customer.id}
                      >
                        {updatingId === customer.id ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        disabled={updatingId === customer.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : editingNameId === customer.id ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveName(customer)}
                        disabled={updatingId === customer.id}
                      >
                        {updatingId === customer.id ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditingName}
                        disabled={updatingId === customer.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(customer)}
                        disabled={updatingId === customer.id || editingNameId !== null || editingId !== null}
                        title="Edit Address"
                      >
                        Edit Address
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => detectAndUpdatePincode(customer)}
                        disabled={updatingId === customer.id || editingNameId !== null || editingId !== null}
                        title="Detect Pincode"
                      >
                        {updatingId === customer.id ? 'Detecting...' : 'Detect Pincode'}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {customers.length > itemsPerPage && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, customers.length)} of {customers.length} customers
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {Math.ceil(customers.length / itemsPerPage)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(customers.length / itemsPerPage), p + 1))}
              disabled={currentPage >= Math.ceil(customers.length / itemsPerPage)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Update Progress Dialog */}
      <Dialog open={bulkUpdateDialogOpen} onOpenChange={setBulkUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Pincode Detection</DialogTitle>
            <DialogDescription>
              {bulkUpdateRunning
                ? `Processing customer addresses...`
                : `Ready to detect and add missing pincodes for all customers.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!bulkUpdateRunning && !bulkUpdateProgress ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This will check all customer addresses and automatically add pincodes where they are missing using Google Maps.
                </p>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total customers loaded: <strong>{customers.length.toLocaleString()}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Customers needing pincode detection will be identified after scanning.
                  </p>
                </div>
                <Alert>
                  <AlertDescription>
                    <div className="space-y-1">
                      <p>This operation may take considerable time for large datasets:</p>
                      <ul className="text-xs ml-4 mt-2 space-y-1">
                        <li>• 100 customers: ~30 seconds</li>
                        <li>• 1,000 customers: ~5 minutes</li>
                        <li>• 9,000 customers: ~45 minutes</li>
                      </ul>
                      <p className="mt-2">The process includes rate limiting (3 requests/second) to respect Google Maps API quotas.</p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="space-y-4">
                {bulkUpdateTotal > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(bulkUpdateProgress)}%</span>
                    </div>
                    <Progress value={bulkUpdateProgress} />
                  </div>
                )}

                {bulkUpdateCurrent && (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Processing: {bulkUpdateCurrent}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-green-600">{bulkUpdateStats.updated}</p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-yellow-600">{bulkUpdateStats.skipped}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-red-600">{bulkUpdateStats.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>

                {bulkUpdateTotal > 0 && (
                  <p className="text-sm text-center text-muted-foreground">
                    Processing {Math.min(
                      Math.ceil(bulkUpdateProgress * bulkUpdateTotal / 100),
                      bulkUpdateTotal
                    )} of {bulkUpdateTotal} customers needing pincodes
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {!bulkUpdateRunning && bulkUpdateProgress === 0 ? (
              <>
                <Button variant="outline" onClick={() => setBulkUpdateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={bulkUpdateAllAddresses}>
                  <MapPinned className="mr-2 h-4 w-4" />
                  Start Bulk Update
                </Button>
              </>
            ) : bulkUpdateRunning ? (
              <Button variant="destructive" onClick={cancelBulkUpdate}>
                Stop Processing
              </Button>
            ) : (
              <Button onClick={() => setBulkUpdateDialogOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}