"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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

export type Vendor = {
  id: string
  vendor_name: string
  contact_person: string | null
  email: string | null
  mobile_primary: string
  company_name: string | null
  gst_number: string | null
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  pincode: string
  country: string | null
  transport_vehicle?: string | null
  transporter_name?: string | null
  transporter_number?: string | null
}

interface VendorComboboxProps {
  vendors: Vendor[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function VendorCombobox({
  vendors,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Search vendors...",
}: VendorComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Filter vendors based on search query
  const filteredVendors = React.useMemo(() => {
    if (!searchQuery) return vendors

    const query = searchQuery.toLowerCase()
    return vendors.filter((vendor) => {
      const nameMatch = vendor.vendor_name.toLowerCase().includes(query)
      const phoneMatch = vendor.mobile_primary.includes(query)
      const companyMatch = vendor.company_name?.toLowerCase().includes(query)
      const gstMatch = vendor.gst_number?.toLowerCase().includes(query)

      return nameMatch || phoneMatch || companyMatch || gstMatch
    })
  }, [vendors, searchQuery])

  const selectedVendor = vendors.find((vendor) => vendor.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedVendor ? (
              <span>
                {selectedVendor.vendor_name}
                {selectedVendor.company_name && (
                  <span className="text-muted-foreground ml-2">
                    ({selectedVendor.company_name})
                  </span>
                )}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, phone, company..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No vendor found.</CommandEmpty>
            {filteredVendors.length > 0 && (
              <CommandGroup heading="Vendors">
                {filteredVendors.map((vendor) => (
                  <CommandItem
                    key={vendor.id}
                    value={vendor.id}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue)
                      setOpen(false)
                      setSearchQuery("")
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === vendor.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {vendor.vendor_name}
                        </span>
                        {vendor.company_name && (
                          <span className="text-xs text-muted-foreground truncate">
                            ({vendor.company_name})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>📱 {vendor.mobile_primary}</span>
                        {vendor.gst_number && (
                          <span className="truncate">GST: {vendor.gst_number}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {vendor.city}, {vendor.state}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
