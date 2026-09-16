"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Truck, Star, MapPin, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface DeliveryPartner {
  id: string
  name: string
  partner_code: string | null
  mobile: string
  vehicle_type: string | null
  vehicle_number: string | null
  serviceable_pincodes: string[]
  is_active: boolean
  is_available: boolean
  average_rating: number | null
  total_deliveries: number | null
  active_orders_count?: number
  city: string | null
  state: string | null
}

interface DeliveryPartnerSuggestionsProps {
  shippingPincode: string
  selectedPartnerId: string | null
  onPartnerSelect: (partnerId: string | null) => void
  warehouseId?: string | null
  className?: string
}

export function DeliveryPartnerSuggestions({
  shippingPincode,
  selectedPartnerId,
  onPartnerSelect,
  warehouseId,
  className,
}: DeliveryPartnerSuggestionsProps) {
  const [open, setOpen] = useState(false)
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [suggestedPartnerIds, setSuggestedPartnerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId)

  // Fetch active and available delivery partners
  useEffect(() => {
    const fetchPartners = async () => {
      setLoading(true)
      try {
        let url = "/api/delivery-partners?is_active=true&is_available=true"
        if (warehouseId) {
          url += `&warehouse_id=${warehouseId}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        // Ensure data is an array
        const partnersArray = Array.isArray(data) ? data : []
        setPartners(partnersArray)

        // Auto-suggest partners based on pincode and warehouse
        if (shippingPincode && shippingPincode.length === 6 && partnersArray.length > 0) {
          const suggested = partnersArray
            .filter((partner: DeliveryPartner) => {
              if (!partner.serviceable_pincodes || partner.serviceable_pincodes.length === 0) {
                return false
              }
              return partner.serviceable_pincodes.includes(shippingPincode)
            })
            .map((partner: DeliveryPartner) => partner.id)

          setSuggestedPartnerIds(suggested)

          // Auto-select first suggested partner if available
          if (suggested.length > 0 && !selectedPartnerId) {
            onPartnerSelect(suggested[0])
          }
        } else {
          setSuggestedPartnerIds([])
        }
      } catch (error) {
        console.error("Error fetching delivery partners:", error)
        setPartners([]) // Set empty array on error
      } finally {
        setLoading(false)
      }
    }

    fetchPartners()
  }, [shippingPincode, warehouseId])

  const suggestedPartners = partners.filter((p) => suggestedPartnerIds.includes(p.id))
  const otherPartners = partners.filter((p) => !suggestedPartnerIds.includes(p.id))

  const formatPincodes = (pincodes: string[]) => {
    if (pincodes.length === 0) return "No coverage"
    if (pincodes.length <= 3) return pincodes.join(", ")
    return `${pincodes.slice(0, 3).join(", ")} +${pincodes.length - 3} more`
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Delivery Partner <span className="text-muted-foreground">(Optional)</span>
          </label>
          {selectedPartnerId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPartnerSelect(null)}
              className="h-auto py-1 px-2 text-xs"
            >
              Clear selection
            </Button>
          )}
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedPartner ? (
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  <span>{selectedPartner.name}</span>
                  {typeof selectedPartner.active_orders_count !== 'undefined' && (
                    <Badge variant="outline" className="ml-1 text-xs">
                      {selectedPartner.active_orders_count} active
                    </Badge>
                  )}
                  {suggestedPartnerIds.includes(selectedPartner.id) && (
                    <Badge variant="secondary" className="ml-1">
                      Recommended
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">Select delivery partner...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search delivery partner..." />
              <CommandList>
                <CommandEmpty>No delivery partner found.</CommandEmpty>

                {suggestedPartners.length > 0 && (
                  <CommandGroup heading="Recommended (Pincode Match)">
                    {suggestedPartners.map((partner) => (
                      <CommandItem
                        key={partner.id}
                        value={partner.name}
                        onSelect={() => {
                          onPartnerSelect(partner.id)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedPartnerId === partner.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{partner.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              Recommended
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {partner.partner_code && (
                              <>
                                <span>{partner.partner_code}</span>
                                <span>•</span>
                              </>
                            )}
                            {partner.vehicle_type && (
                              <>
                                <span className="capitalize">{partner.vehicle_type}</span>
                                {partner.vehicle_number && <span>({partner.vehicle_number})</span>}
                                <span>•</span>
                              </>
                            )}
                            {partner.average_rating && (
                              <>
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  <span>{partner.average_rating.toFixed(1)}</span>
                                </div>
                                <span>•</span>
                              </>
                            )}
                            {typeof partner.active_orders_count !== 'undefined' && (
                              <span className={partner.active_orders_count > 5 ? "text-orange-600 font-medium" : ""}>
                                {partner.active_orders_count} active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{formatPincodes(partner.serviceable_pincodes)}</span>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {otherPartners.length > 0 && (
                  <CommandGroup heading={suggestedPartners.length > 0 ? "All Partners" : "Available Partners"}>
                    {otherPartners.map((partner) => (
                      <CommandItem
                        key={partner.id}
                        value={partner.name}
                        onSelect={() => {
                          onPartnerSelect(partner.id)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedPartnerId === partner.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{partner.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {partner.partner_code && (
                              <>
                                <span>{partner.partner_code}</span>
                                <span>•</span>
                              </>
                            )}
                            {partner.vehicle_type && (
                              <>
                                <span className="capitalize">{partner.vehicle_type}</span>
                                {partner.vehicle_number && <span>({partner.vehicle_number})</span>}
                                <span>•</span>
                              </>
                            )}
                            {partner.average_rating && (
                              <>
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  <span>{partner.average_rating.toFixed(1)}</span>
                                </div>
                                <span>•</span>
                              </>
                            )}
                            {typeof partner.active_orders_count !== 'undefined' && (
                              <span className={partner.active_orders_count > 5 ? "text-orange-600 font-medium" : ""}>
                                {partner.active_orders_count} active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{formatPincodes(partner.serviceable_pincodes)}</span>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {!loading && shippingPincode && suggestedPartnerIds.length === 0 && partners.length > 0 && (
        <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
          No delivery partners found servicing pincode {shippingPincode}, but {partners.length} delivery partner{partners.length > 1 ? 's are' : ' is'} available from this warehouse. Click above to select.
        </div>
      )}

      {!loading && shippingPincode && partners.length === 0 && (
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
          No delivery partners available from the selected warehouse. You can assign later.
        </div>
      )}

      {!loading && shippingPincode && suggestedPartnerIds.length > 0 && !selectedPartnerId && (
        <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
          {suggestedPartnerIds.length} delivery partner{suggestedPartnerIds.length > 1 ? "s" : ""} available for pincode {shippingPincode}
        </div>
      )}

      {selectedPartner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Delivery Partner Details</CardTitle>
            <CardDescription>Selected delivery partner information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span className="font-medium">{selectedPartner.name}</span>
              </div>
              {selectedPartner.partner_code && (
                <div>
                  <span className="text-muted-foreground">Code:</span>{" "}
                  <span className="font-medium">{selectedPartner.partner_code}</span>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-muted-foreground">Mobile:</span>{" "}
                <span className="font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {selectedPartner.mobile}
                </span>
              </div>
              {selectedPartner.vehicle_type && (
                <>
                  <div>
                    <span className="text-muted-foreground">Vehicle:</span>{" "}
                    <span className="font-medium capitalize">{selectedPartner.vehicle_type}</span>
                  </div>
                  {selectedPartner.vehicle_number && (
                    <div>
                      <span className="text-muted-foreground">Number:</span>{" "}
                      <span className="font-medium">{selectedPartner.vehicle_number}</span>
                    </div>
                  )}
                </>
              )}
              {selectedPartner.average_rating && (
                <div>
                  <span className="text-muted-foreground">Rating:</span>{" "}
                  <span className="font-medium flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {selectedPartner.average_rating.toFixed(1)}
                  </span>
                </div>
              )}
              {selectedPartner.total_deliveries && (
                <div>
                  <span className="text-muted-foreground">Deliveries:</span>{" "}
                  <span className="font-medium">{selectedPartner.total_deliveries}</span>
                </div>
              )}
              {typeof selectedPartner.active_orders_count !== 'undefined' && (
                <div>
                  <span className="text-muted-foreground">Active Orders:</span>{" "}
                  <span className={`font-medium ${selectedPartner.active_orders_count > 5 ? "text-orange-600" : ""}`}>
                    {selectedPartner.active_orders_count}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t">
              <h4 className="font-medium mb-1">Serviceable Pincodes</h4>
              <div className="flex flex-wrap gap-1">
                {selectedPartner.serviceable_pincodes.length > 0 ? (
                  selectedPartner.serviceable_pincodes.map((pincode) => (
                    <Badge
                      key={pincode}
                      variant={pincode === shippingPincode ? "default" : "outline"}
                      className="text-xs"
                    >
                      {pincode}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No coverage data</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
