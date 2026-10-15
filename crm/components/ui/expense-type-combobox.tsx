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
import { EXPENSE_TYPE_GROUPS, type ExpenseTypeOption } from "@/lib/expense-types"

interface ExpenseTypeComboboxProps {
  value: string
  onValueChange: (value: string) => void
  id?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  // Extra options rendered before the expense types (e.g. "All Types" in a filter)
  leadingOptions?: ExpenseTypeOption[]
  // Extra options rendered after the expense types (e.g. "Purchase" in a filter)
  trailingOptions?: ExpenseTypeOption[]
}

const NO_OPTIONS: ExpenseTypeOption[] = []

export function ExpenseTypeCombobox({
  value,
  onValueChange,
  id,
  placeholder = "Select expense type",
  className,
  disabled = false,
  leadingOptions = NO_OPTIONS,
  trailingOptions = NO_OPTIONS,
}: ExpenseTypeComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const groups = React.useMemo(
    () => [
      { heading: "", options: leadingOptions },
      ...EXPENSE_TYPE_GROUPS,
      { heading: "", options: trailingOptions },
    ],
    [leadingOptions, trailingOptions]
  )

  const filteredGroups = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        options: query
          ? g.options.filter(
              (o) => o.label.toLowerCase().includes(query) || o.value.replace(/_/g, " ").includes(query)
            )
          : g.options,
      }))
      .filter((g) => g.options.length > 0)
  }, [groups, searchQuery])

  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value)

  return (
    <Popover
      // modal so the list scrolls with the mouse wheel when used inside a Dialog
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearchQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search expense type..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-80">
            <CommandEmpty>No expense type found.</CommandEmpty>
            {filteredGroups.map((g, i) => (
              <CommandGroup key={g.heading || `extra-${i}`} heading={g.heading || undefined}>
                {g.options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue)
                      setOpen(false)
                      setSearchQuery("")
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")}
                    />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
