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
import { Separator } from "@/components/ui/separator"
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
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2, X, MapPin, Loader2, Search } from "lucide-react"
import { toast } from "sonner"

type Route = {
  id: string
  route_name: string
  city: string
  pincodes: string[]
  description: string | null
  is_active: boolean
  created_at: string
}

type RouteFormData = {
  route_name: string
  city: string
  pincodes: string[]
  description: string
  is_active: boolean
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<RouteFormData>({
    route_name: "",
    city: "",
    pincodes: [],
    description: "",
    is_active: true,
  })

  const [pincodeInput, setPincodeInput] = useState("")
  const [pincodeError, setPincodeError] = useState("")

  useEffect(() => {
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching routes:", error)
      toast.error("Failed to fetch routes")
    } else {
      setRoutes(data || [])
    }
    setLoading(false)
  }

  const handleOpenDialog = (route?: Route) => {
    if (route) {
      setEditingRoute(route)
      setFormData({
        route_name: route.route_name,
        city: route.city,
        pincodes: route.pincodes || [],
        description: route.description || "",
        is_active: route.is_active,
      })
    } else {
      setEditingRoute(null)
      setFormData({
        route_name: "",
        city: "",
        pincodes: [],
        description: "",
        is_active: true,
      })
    }
    setPincodeInput("")
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

    if (formData.pincodes.includes(trimmed)) {
      setPincodeError("Pincode already added")
      return
    }

    setFormData({
      ...formData,
      pincodes: [...formData.pincodes, trimmed],
    })
    setPincodeInput("")
    setPincodeError("")
  }

  const handleRemovePincode = (pincode: string) => {
    setFormData({
      ...formData,
      pincodes: formData.pincodes.filter((p) => p !== pincode),
    })
  }

  const handleSave = async () => {
    if (formData.pincodes.length === 0) {
      toast.error("Please add at least one pincode")
      return
    }

    setSaving(true)

    try {
      if (editingRoute) {
        const { error } = await supabase
          .from("routes")
          .update(formData)
          .eq("id", editingRoute.id)

        if (error) throw error
        toast.success("Route updated successfully")
      } else {
        const { error } = await supabase
          .from("routes")
          .insert([formData])

        if (error) throw error
        toast.success("Route created successfully")
      }

      setDialogOpen(false)
      fetchRoutes()
    } catch (error: unknown) {
      console.error("Error saving route:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save route"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRoute) return

    try {
      const { error } = await supabase
        .from("routes")
        .delete()
        .eq("id", deletingRoute.id)

      if (error) throw error

      toast.success("Route deleted successfully")
      setDeleteDialogOpen(false)
      setDeletingRoute(null)
      fetchRoutes()
    } catch (error: unknown) {
      console.error("Error deleting route:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete route"
      toast.error(errorMessage)
    }
  }

  const filteredRoutes = routes.filter(
    (route) =>
      route.route_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.pincodes.some((pincode) => pincode.includes(searchTerm))
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <MapPin className="h-6 w-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Routes</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Routes</h1>
            <p className="text-sm text-muted-foreground">Manage delivery routes and zones</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Route
          </Button>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full">
      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900/50">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Route List</CardTitle>
                <CardDescription className="mt-0.5">A list of all delivery routes with pincode coverage</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="secondary" className="rounded-full">
                {filteredRoutes.length} {filteredRoutes.length === 1 ? "route" : "routes"}
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search routes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-[220px] pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-[1000px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Route Name</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">City</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Pincodes</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Description</TableHead>
                  <TableHead className="font-semibold uppercase tracking-wider text-[11px]">Status</TableHead>
                  <TableHead className="text-right font-semibold uppercase tracking-wider text-[11px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No routes found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoutes.map((route) => (
                    <TableRow key={route.id} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {route.route_name}
                      </TableCell>
                      <TableCell>{route.city}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {route.pincodes.slice(0, 5).map((pincode, index) => (
                            <Badge key={index} variant="outline" className="rounded-full">
                              {pincode}
                            </Badge>
                          ))}
                          {route.pincodes.length > 5 && (
                            <Badge variant="secondary" className="rounded-full">
                              +{route.pincodes.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{route.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={route.is_active ? "default" : "secondary"} className="rounded-full capitalize">
                          {route.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(route)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingRoute(route)
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
          <div className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Showing {filteredRoutes.length} of {routes.length} routes
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base">
                  {editingRoute ? "Edit Route" : "Add New Route"}
                </DialogTitle>
                <DialogDescription className="mt-0.5">
                  {editingRoute
                    ? "Update route information"
                    : "Enter route details to create a new route"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 px-4 pt-2 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="route_name">Route Name *</Label>
                <Input
                  id="route_name"
                  value={formData.route_name}
                  onChange={(e) =>
                    setFormData({ ...formData, route_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pincodes">Pincodes *</Label>
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    id="pincodes"
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
              {formData.pincodes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 rounded-md border p-3">
                  {formData.pincodes.map((pincode) => (
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Route Settings</Label>
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
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur px-4 py-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingRoute ? "Update" : "Create"}
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
              This will permanently delete the route{" "}
              <strong>{deletingRoute?.route_name}</strong>. This action cannot be undone.
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
