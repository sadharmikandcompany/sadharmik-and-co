"use client"

import * as React from "react"
import { Check, ChevronsUpDown, User, Building2, Truck, Store, Loader2 } from "lucide-react"
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
import { supabase } from "@/lib/supabase"
import { useDebounce } from "@/hooks/use-debounce"

export type Party = {
  id: string
  name: string
  phone: string
  email?: string | null
  company_name?: string | null
  gst_number?: string | null
  type: "customer" | "vendor" | "distributor" | "retailer"
}

export const PARTY_TYPE_LABEL: Record<Party["type"], string> = {
  customer: "Customer",
  vendor: "Vendor",
  distributor: "Distributor",
  retailer: "Retailer",
}

function PartyTypeIcon({ type, className }: { type: Party["type"]; className?: string }) {
  switch (type) {
    case "customer":
      return <User className={cn(className, "text-blue-500")} />
    case "vendor":
      return <Building2 className={cn(className, "text-green-500")} />
    case "distributor":
      return <Truck className={cn(className, "text-orange-500")} />
    case "retailer":
      return <Store className={cn(className, "text-purple-500")} />
  }
}

const ALL_PARTY_TYPES: Party["type"][] = ["customer", "vendor", "distributor", "retailer"]

interface PartyComboboxProps {
  value: string
  onValueChange: (value: string, party: Party | null) => void
  disabled?: boolean
  placeholder?: string
  // Restricts which party tables are searched/shown — e.g. ["distributor",
  // "customer"] for a picker that has no business surfacing vendors or
  // retailers. Defaults to all four types (existing behavior, unchanged).
  types?: Party["type"][]
}

export function PartyCombobox({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Search customers or vendors...",
  types = ALL_PARTY_TYPES,
}: PartyComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [customers, setCustomers] = React.useState<Party[]>([])
  const [vendors, setVendors] = React.useState<Party[]>([])
  const [distributors, setDistributors] = React.useState<Party[]>([])
  const [retailers, setRetailers] = React.useState<Party[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedParty, setSelectedParty] = React.useState<Party | null>(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  // Fetch initial selected party if value is provided
  React.useEffect(() => {
    if (value && !selectedParty) {
      fetchSelectedParty(value)
    }
  }, [value])

  const fetchSelectedParty = async (partyId: string) => {
    // Try customers first
    const { data: customer } = types.includes("customer")
      ? await supabase
          .from("customers")
          .select("id, first_name, last_name, mobile_primary, email, company_name, gst_number")
          .eq("id", partyId)
          .single()
      : { data: null }

    if (customer) {
      const party: Party = {
        id: customer.id,
        name: `${customer.first_name} ${customer.last_name}`.trim(),
        phone: customer.mobile_primary,
        email: customer.email,
        company_name: customer.company_name,
        gst_number: customer.gst_number,
        type: "customer",
      }
      setSelectedParty(party)
      return
    }

    // Try vendors
    const { data: vendor } = types.includes("vendor")
      ? await supabase
          .from("vendors")
          .select("id, vendor_name, mobile_primary, email, company_name, gst_number")
          .eq("id", partyId)
          .single()
      : { data: null }

    if (vendor) {
      const party: Party = {
        id: vendor.id,
        name: vendor.vendor_name,
        phone: vendor.mobile_primary,
        email: vendor.email,
        company_name: vendor.company_name,
        gst_number: vendor.gst_number,
        type: "vendor",
      }
      setSelectedParty(party)
      return
    }

    // Try distributors
    const { data: distributor } = types.includes("distributor")
      ? await supabase
          .from("distributors")
          .select("id, name, phone_primary, email, company_name, gst_number")
          .eq("id", partyId)
          .single()
      : { data: null }

    if (distributor) {
      setSelectedParty({
        id: distributor.id,
        name: distributor.name,
        phone: distributor.phone_primary,
        email: distributor.email,
        company_name: distributor.company_name,
        gst_number: distributor.gst_number,
        type: "distributor",
      })
      return
    }

    // Try retailers
    const { data: retailer } = types.includes("retailer")
      ? await supabase
          .from("retailers")
          .select("id, name, phone_primary, email, company_name, gst_number")
          .eq("id", partyId)
          .single()
      : { data: null }

    if (retailer) {
      setSelectedParty({
        id: retailer.id,
        name: retailer.name,
        phone: retailer.phone_primary,
        email: retailer.email,
        company_name: retailer.company_name,
        gst_number: retailer.gst_number,
        type: "retailer",
      })
    }
  }

  // Search parties when query changes
  React.useEffect(() => {
    if (open) {
      searchParties(debouncedSearch)
    }
  }, [debouncedSearch, open])

  const searchParties = async (query: string) => {
    setLoading(true)
    try {
      const searchPattern = query ? `%${query}%` : "%"

      // Fetch customers with search
      const { data: customersData } = types.includes("customer")
        ? await supabase
            .from("customers")
            .select("id, first_name, last_name, mobile_primary, email, company_name, gst_number")
            .eq("is_active", true)
            .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},mobile_primary.ilike.${searchPattern},company_name.ilike.${searchPattern}`)
            .order("first_name")
            .limit(20)
        : { data: [] }

      // Fetch vendors with search
      const { data: vendorsData } = types.includes("vendor")
        ? await supabase
            .from("vendors")
            .select("id, vendor_name, mobile_primary, email, company_name, gst_number")
            .eq("is_active", true)
            .or(`vendor_name.ilike.${searchPattern},mobile_primary.ilike.${searchPattern},company_name.ilike.${searchPattern}`)
            .order("vendor_name")
            .limit(20)
        : { data: [] }

      // Fetch distributors with search
      const { data: distributorsData } = types.includes("distributor")
        ? await supabase
            .from("distributors")
            .select("id, name, phone_primary, email, company_name, gst_number")
            .eq("is_active", true)
            .or(`name.ilike.${searchPattern},phone_primary.ilike.${searchPattern},company_name.ilike.${searchPattern},gst_number.ilike.${searchPattern}`)
            .order("name")
            .limit(20)
        : { data: [] }

      // Fetch retailers with search
      const { data: retailersData } = types.includes("retailer")
        ? await supabase
            .from("retailers")
            .select("id, name, phone_primary, email, company_name, gst_number")
            .eq("is_active", true)
            .or(`name.ilike.${searchPattern},phone_primary.ilike.${searchPattern},company_name.ilike.${searchPattern},gst_number.ilike.${searchPattern}`)
            .order("name")
            .limit(20)
        : { data: [] }

      const mappedCustomers: Party[] = (customersData || []).map((c) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        phone: c.mobile_primary,
        email: c.email,
        company_name: c.company_name,
        gst_number: c.gst_number,
        type: "customer" as const,
      }))

      const mappedVendors: Party[] = (vendorsData || []).map((v) => ({
        id: v.id,
        name: v.vendor_name,
        phone: v.mobile_primary,
        email: v.email,
        company_name: v.company_name,
        gst_number: v.gst_number,
        type: "vendor" as const,
      }))

      const mappedDistributors: Party[] = (distributorsData || []).map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone_primary,
        email: d.email,
        company_name: d.company_name,
        gst_number: d.gst_number,
        type: "distributor" as const,
      }))

      const mappedRetailers: Party[] = (retailersData || []).map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone_primary,
        email: r.email,
        company_name: r.company_name,
        gst_number: r.gst_number,
        type: "retailer" as const,
      }))

      setCustomers(mappedCustomers)
      setVendors(mappedVendors)
      setDistributors(mappedDistributors)
      setRetailers(mappedRetailers)
    } catch (error) {
      console.error("Error searching parties:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (party: Party) => {
    setSelectedParty(party)
    onValueChange(party.id, party)
    setOpen(false)
    setSearchQuery("")
  }

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
          <span className="truncate flex items-center gap-2">
            {selectedParty ? (
              <>
                <PartyTypeIcon type={selectedParty.type} className="h-4 w-4" />
                <span>{selectedParty.name}</span>
                {selectedParty.company_name && (
                  <span className="text-muted-foreground text-xs">
                    ({selectedParty.company_name})
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, phone, company..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : (
              <>
                {customers.length === 0 && vendors.length === 0 && distributors.length === 0 && retailers.length === 0 && (
                  <CommandEmpty>No results found. Try a different search.</CommandEmpty>
                )}

                {([
                  { key: "customer", items: customers },
                  { key: "distributor", items: distributors },
                  { key: "retailer", items: retailers },
                  { key: "vendor", items: vendors },
                ] as const).map(({ key, items }) =>
                  items.length > 0 && (
                    <CommandGroup key={key} heading={`${PARTY_TYPE_LABEL[key]}s (${items.length})`}>
                      {items.map((party) => (
                        <CommandItem
                          key={party.id}
                          value={party.id}
                          onSelect={() => handleSelect(party)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === party.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <PartyTypeIcon type={party.type} className="mr-2 h-4 w-4" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{party.name}</span>
                              {party.company_name && (
                                <span className="text-xs text-muted-foreground truncate">
                                  ({party.company_name})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{party.phone}</span>
                              {party.gst_number && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  GST
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
