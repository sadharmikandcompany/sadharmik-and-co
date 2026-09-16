"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// Shared quick date-range filter — one dropdown of presets (Today, This
// Month, Last Month, etc.) plus a Custom option that opens a two-month range
// picker, replacing the old pattern of two separate "Date From" / "Date To"
// calendar popovers duplicated across ~14 list pages.
export type DatePreset =
  | "all"
  | "today"
  | "this_month"
  | "last_month"
  | "last_to_last_month"
  | "this_quarter"
  | "this_year"
  | "this_financial_year"
  | "custom"

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All Time",
  today: "Today",
  this_month: "This Month",
  last_month: "Last Month",
  last_to_last_month: "Last-to-Last Month",
  this_quarter: "This Quarter",
  this_year: "This Year",
  this_financial_year: "This Financial Year",
  custom: "Custom",
}

const PRESET_ORDER: DatePreset[] = [
  "all",
  "today",
  "this_month",
  "last_month",
  "last_to_last_month",
  "this_quarter",
  "this_year",
  "this_financial_year",
  "custom",
]

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

/**
 * Resolves a preset into a concrete { from, to } range. "to" is always
 * pushed to 23:59:59.999 on its day — existing filter code across the app
 * compares raw record timestamps against `dateTo` with `<=`, so a plain
 * midnight Date would silently exclude every record from later that same
 * day (this was already a latent bug in the old two-calendar pickers).
 * Month/quarter/year presets return their FULL period regardless of where
 * "today" falls in it (e.g. "This Year" always spans Jan 1 – Dec 31) —
 * future dates just won't have any matching records yet.
 */
export function getDatePresetRange(
  preset: DatePreset,
  custom?: { from?: Date; to?: Date }
): { from: Date | undefined; to: Date | undefined } {
  if (preset === "all") return { from: undefined, to: undefined }
  if (preset === "custom") return { from: custom?.from, to: custom?.to ? endOfDay(custom.to) : undefined }

  const now = new Date()
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) }
    case "this_month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      }
    case "last_month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    case "last_to_last_month":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 0)),
      }
    case "this_quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3
      return {
        from: new Date(now.getFullYear(), qStartMonth, 1),
        to: endOfDay(new Date(now.getFullYear(), qStartMonth + 3, 0)),
      }
    }
    case "this_year":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(new Date(now.getFullYear(), 11, 31)) }
    case "this_financial_year": {
      // India FY: 1 Apr – 31 Mar.
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
      return {
        from: new Date(fyStartYear, 3, 1),
        to: endOfDay(new Date(fyStartYear + 1, 2, 31)),
      }
    }
  }
}

interface DateRangePresetFilterProps {
  preset: DatePreset
  onPresetChange: (preset: DatePreset, range: { from: Date | undefined; to: Date | undefined }) => void
  customFrom?: Date
  customTo?: Date
  onCustomRangeChange: (from: Date | undefined, to: Date | undefined) => void
  className?: string
}

export function DateRangePresetFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomRangeChange,
  className,
}: DateRangePresetFilterProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)

  const handlePick = (next: DatePreset) => {
    setMenuOpen(false)
    if (next === "custom") {
      // Nothing resolvable yet until a range is actually picked below.
      onPresetChange(next, { from: customFrom, to: customTo ? endOfDay(customTo) : undefined })
      setCustomOpen(true)
      return
    }
    onPresetChange(next, getDatePresetRange(next))
  }

  const label =
    preset === "custom"
      ? customFrom && customTo
        ? `${format(customFrom, "dd MMM yy")} – ${format(customTo, "dd MMM yy")}`
        : "Pick a range"
      : DATE_PRESET_LABELS[preset]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full sm:w-[190px] justify-start text-left font-normal",
              preset === "all" && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[190px]">
          {PRESET_ORDER.map((p) => (
            <DropdownMenuItem key={p} onClick={() => handlePick(p)} className="justify-between">
              {DATE_PRESET_LABELS[p]}
              {preset === p && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {preset === "custom" && (
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs shrink-0">
              {customFrom && customTo
                ? `${format(customFrom, "dd MMM")} → ${format(customTo, "dd MMM")}`
                : "Pick dates"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: customFrom, to: customTo }}
              onSelect={(range) => onCustomRangeChange(range?.from, range?.to)}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
