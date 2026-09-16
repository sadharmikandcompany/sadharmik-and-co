"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Package,
  Warehouse,
  Truck,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  FileText,
  Edit,
  Trash2,
  Download
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { generateStockTransferPDF } from "@/lib/stock-transfer-pdf"

type StockTransfer = {
  id: string
  transfer_number: string
  from_godown_id: string
  to_godown_id: string
  stock_inventory_id: string | null
  quantity: number | null
  transfer_status: "pending" | "in_transit" | "completed" | "cancelled" | "rejected"
  requested_date: string
  approved_date: string | null
  shipped_date: string | null
  received_date: string | null
  completed_date: string | null
  requested_by_email: string | null
  transfer_reason: string | null
  is_urgent: boolean
  expected_delivery_date: string | null
  vehicle_number: string | null
  driver_name: string | null
  driver_phone: string | null
  notes: string | null
  from_godown: {
    name: string
    godown_code: string
    city: string | null
    state: string | null
  } | null
  to_godown: {
    name: string
    godown_code: string
    city: string | null
    state: string | null
  } | null
  stock_inventory: {
    products: {
      name: string
      brand: string | null
    } | null
    product_variants: {
      variant_name: string
    } | null
    packaging_materials: {
      name: string
    } | null
  } | null
  stock_transfer_items: {
    id: string
    stock_inventory_id: string
    quantity: number
    stock_inventory: {
      products: {
        name: string
        brand: string | null
      } | null
      product_variants: {
        variant_name: string
      } | null
      packaging_materials: {
        name: string
      } | null
    } | null
  }[]
}

export default function StockTransferDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const transferId = params.id as string

  const [transfer, setTransfer] = useState<StockTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (transferId) {
      fetchTransferDetails()
    }
  }, [transferId])

  const fetchTransferDetails = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("stock_transfers")
      .select(`
        *,
        from_godown:godowns!from_godown_id (
          name,
          godown_code,
          city,
          state
        ),
        to_godown:godowns!to_godown_id (
          name,
          godown_code,
          city,
          state
        ),
        stock_inventory (
          products (
            name,
            brand
          ),
          product_variants (
            variant_name
          ),
          packaging_materials (
            name
          )
        ),
        stock_transfer_items (
          id,
          stock_inventory_id,
          quantity,
          stock_inventory (
            products (
              name,
              brand
            ),
            product_variants (
              variant_name
            ),
            packaging_materials (
              name
            )
          )
        )
      `)
      .eq("id", transferId)
      .single()

    if (error) {
      console.error("Error fetching transfer:", error)
      toast.error("Failed to fetch transfer details")
      router.push("/dashboard/stock-transfers")
    } else {
      setTransfer(data)
    }
    setLoading(false)
  }

  const updateStatus = async (newStatus: StockTransfer["transfer_status"]) => {
    if (!transfer) return

    setUpdating(true)
    try {
      const updateData: Record<string, unknown> = {
        transfer_status: newStatus
      }

      // Set appropriate date fields based on status
      const now = new Date().toISOString()
      if (newStatus === "in_transit" && !transfer.shipped_date) {
        updateData.shipped_date = now
      } else if (newStatus === "completed" && !transfer.completed_date) {
        updateData.completed_date = now
        updateData.received_date = now
      }

      const { error } = await supabase
        .from("stock_transfers")
        .update(updateData)
        .eq("id", transfer.id)

      if (error) throw error

      toast.success(`Transfer marked as ${newStatus.replace("_", " ")}`)
      fetchTransferDetails()
    } catch (error: unknown) {
      console.error("Error updating status:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update status"
      toast.error(errorMessage)
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!transfer) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from("stock_transfers")
        .delete()
        .eq("id", transfer.id)

      if (error) throw error

      toast.success("Transfer deleted successfully")
      router.push("/dashboard/stock-transfers")
    } catch (error: unknown) {
      console.error("Error deleting transfer:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete transfer"
      toast.error(errorMessage)
    } finally {
      setDeleting(false)
    }
  }

  const handleDownloadPDF = () => {
    if (!transfer) return

    try {
      // Prepare items data
      const items = transfer.stock_transfer_items && transfer.stock_transfer_items.length > 0
        ? transfer.stock_transfer_items.map(item => {
            const itemProduct = item.stock_inventory?.products
            const itemVariant = item.stock_inventory?.product_variants
            const itemMaterial = item.stock_inventory?.packaging_materials

            return {
              productName: itemProduct?.name || itemMaterial?.name || "Unknown Item",
              variantOrBrand: itemVariant?.variant_name || itemProduct?.brand || undefined,
              quantity: item.quantity
            }
          })
        : [
            {
              productName: transfer.stock_inventory?.products?.name ||
                           transfer.stock_inventory?.packaging_materials?.name ||
                           "Unknown Item",
              variantOrBrand: transfer.stock_inventory?.product_variants?.variant_name ||
                             transfer.stock_inventory?.products?.brand ||
                             undefined,
              quantity: transfer.quantity || 0
            }
          ]

      // Generate PDF
      generateStockTransferPDF({
        transferNumber: transfer.transfer_number,
        fromWarehouse: {
          name: transfer.from_godown?.name || "Unknown",
          code: transfer.from_godown?.godown_code || "N/A",
          city: transfer.from_godown?.city || undefined,
          state: transfer.from_godown?.state || undefined
        },
        toWarehouse: {
          name: transfer.to_godown?.name || "Unknown",
          code: transfer.to_godown?.godown_code || "N/A",
          city: transfer.to_godown?.city || undefined,
          state: transfer.to_godown?.state || undefined
        },
        status: transfer.transfer_status,
        requestedDate: transfer.requested_date,
        requestedBy: transfer.requested_by_email || undefined,
        shippedDate: transfer.shipped_date || undefined,
        completedDate: transfer.completed_date || undefined,
        expectedDeliveryDate: transfer.expected_delivery_date || undefined,
        transferReason: transfer.transfer_reason || undefined,
        isUrgent: transfer.is_urgent,
        items,
        vehicleNumber: transfer.vehicle_number || undefined,
        driverName: transfer.driver_name || undefined,
        driverPhone: transfer.driver_phone || undefined,
        notes: transfer.notes || undefined
      })

      toast.success("PDF downloaded successfully")
    } catch (error: unknown) {
      console.error("Error generating PDF:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to generate PDF"
      toast.error(errorMessage)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "in_transit":
        return <Truck className="h-5 w-5 text-blue-600" />
      case "pending":
        return <Clock className="h-5 w-5 text-orange-600" />
      case "cancelled":
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Package className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default"
      case "in_transit":
        return "secondary"
      case "pending":
        return "outline"
      case "cancelled":
      case "rejected":
        return "destructive"
      default:
        return "secondary"
    }
  }

  if (loading || !transfer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard/stock-transfers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <p>Loading...</p>
      </div>
    )
  }

  const product = transfer.stock_inventory?.products
  const variant = transfer.stock_inventory?.product_variants
  const material = transfer.stock_inventory?.packaging_materials

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/dashboard/stock-transfers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Transfer #{transfer.transfer_number}</h1>
            <p className="text-muted-foreground">Stock transfer details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          {getStatusIcon(transfer.transfer_status)}
          <Badge variant={getStatusVariant(transfer.transfer_status)} className="text-sm">
            {transfer.transfer_status.replace("_", " ").toUpperCase()}
          </Badge>
          {transfer.is_urgent && (
            <Badge variant="destructive" className="text-sm">
              URGENT
            </Badge>
          )}
        </div>
      </div>

      {/* Edit and Delete Actions */}
      {transfer.transfer_status === "pending" && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/stock-transfers/${transfer.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Transfer
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Transfer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Transfer?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the transfer and all related items.
                  {transfer.transfer_status === "pending" && (
                    <p className="mt-2 text-sm font-medium">
                      Reserved stock will be automatically released back to available inventory.
                    </p>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Transfer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Action Buttons */}
      {transfer.transfer_status === "pending" && (
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={updating}>
                <Truck className="mr-2 h-4 w-4" />
                Mark In Transit
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as In Transit?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will update the transfer status to "In Transit" and record the shipment date.
                  <p className="mt-2 text-sm font-medium text-orange-600">
                    Stock will be deducted from source warehouse and unreserved.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => updateStatus("in_transit")}>
                  Confirm Shipment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={updating}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Transfer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Transfer?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The transfer will be marked as cancelled.
                  <p className="mt-2 text-sm font-medium">
                    Reserved stock will be released back to available inventory.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Go Back</AlertDialogCancel>
                <AlertDialogAction onClick={() => updateStatus("cancelled")}>
                  Cancel Transfer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {transfer.transfer_status === "in_transit" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={updating}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Completed
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Transfer?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the transfer as completed.
                <p className="mt-2 text-sm font-medium text-green-600">
                  Stock will be added to destination warehouse inventory.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => updateStatus("completed")}>
                Complete Transfer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Transfer Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Source Warehouse */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              From Warehouse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Warehouse Name</p>
              <p className="font-medium">{transfer.from_godown?.name || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Code</p>
              <Badge variant="outline" className="font-mono">
                {transfer.from_godown?.godown_code || "—"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="text-sm flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {transfer.from_godown?.city && transfer.from_godown?.state
                  ? `${transfer.from_godown.city}, ${transfer.from_godown.state}`
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Destination Warehouse */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              To Warehouse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Warehouse Name</p>
              <p className="font-medium">{transfer.to_godown?.name || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Code</p>
              <Badge variant="outline" className="font-mono">
                {transfer.to_godown?.godown_code || "—"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="text-sm flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {transfer.to_godown?.city && transfer.to_godown?.state
                  ? `${transfer.to_godown.city}, ${transfer.to_godown.state}`
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product & Quantity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transfer Items
          </CardTitle>
          <CardDescription>
            {transfer.stock_transfer_items && transfer.stock_transfer_items.length > 0
              ? `${transfer.stock_transfer_items.length} product(s) in this transfer`
              : "Single item transfer"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {transfer.stock_transfer_items && transfer.stock_transfer_items.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Variant/Brand</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfer.stock_transfer_items.map((item) => {
                    const itemProduct = item.stock_inventory?.products
                    const itemVariant = item.stock_inventory?.product_variants
                    const itemMaterial = item.stock_inventory?.packaging_materials

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {itemProduct?.name || itemMaterial?.name || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {itemVariant?.variant_name || itemProduct?.brand || "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {item.quantity}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-semibold">
                      Total Quantity:
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      {transfer.stock_transfer_items.reduce((sum, item) => sum + item.quantity, 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Product</p>
                <p className="font-medium">
                  {product?.name || material?.name || "—"}
                </p>
                {variant?.variant_name && (
                  <p className="text-xs text-muted-foreground">{variant.variant_name}</p>
                )}
                {product?.brand && (
                  <p className="text-xs text-muted-foreground">{product.brand}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quantity</p>
                <p className="text-2xl font-bold">{transfer.quantity || "—"}</p>
              </div>
            </div>
          )}

          {transfer.transfer_reason && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Transfer Reason</p>
                <p className="text-sm">{transfer.transfer_reason}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transport Details */}
      {(transfer.vehicle_number || transfer.driver_name || transfer.driver_phone) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Transport Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {transfer.vehicle_number && (
              <div>
                <p className="text-sm text-muted-foreground">Vehicle Number</p>
                <p className="font-medium font-mono">{transfer.vehicle_number}</p>
              </div>
            )}
            {transfer.driver_name && (
              <div>
                <p className="text-sm text-muted-foreground">Driver Name</p>
                <p className="font-medium">{transfer.driver_name}</p>
              </div>
            )}
            {transfer.driver_phone && (
              <div>
                <p className="text-sm text-muted-foreground">Driver Phone</p>
                <p className="font-medium">{transfer.driver_phone}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Transfer Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Requested */}
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Requested</p>
              <p className="text-sm text-muted-foreground">
                {new Date(transfer.requested_date).toLocaleString()}
              </p>
              {transfer.requested_by_email && (
                <p className="text-xs text-muted-foreground">By: {transfer.requested_by_email}</p>
              )}
            </div>
          </div>

          {/* Shipped */}
          {transfer.shipped_date && (
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                <Truck className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Shipped</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(transfer.shipped_date).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Expected Delivery */}
          {transfer.expected_delivery_date && (
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                <Calendar className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Expected Delivery</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(transfer.expected_delivery_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Received */}
          {transfer.received_date && (
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Received</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(transfer.received_date).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Completed */}
          {transfer.completed_date && (
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Completed</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(transfer.completed_date).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Notes */}
      {transfer.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{transfer.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
