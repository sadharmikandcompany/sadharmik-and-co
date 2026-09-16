"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X, CornerDownLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { menuGroups } from "@/lib/sidebar-menu"
import type { UserRole } from "@/lib/types/database"

type Props = {
  role: UserRole | null
}

export function HeaderSearch({ role }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = useMemo(() => {
    if (!role) return []
    return menuGroups.flatMap((group) =>
      group.items
        .filter((item) => item.roles.includes(role))
        .map((item) => ({ ...item, group: group.label }))
    )
  }, [role])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems.slice(0, 8)
    return allItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q)
      )
      .slice(0, 12)
  }, [allItems, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === "Escape") {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSelect = (url: string) => {
    setOpen(false)
    setQuery("")
    router.push(url)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault()
      handleSelect(results[activeIndex].url)
    }
  }

  return (
    <div ref={containerRef} className="relative w-72 hidden md:block">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search pages..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={handleInputKeyDown}
        className="h-8 pl-8 pr-14 text-xs"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("")
            inputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[60vh] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          {results.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No pages found
            </div>
          ) : (
            <ul className="py-1">
              {results.map((item, idx) => {
                const Icon = item.icon
                const isActive = idx === activeIndex
                return (
                  <li key={`${item.url}-${idx}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelect(item.url)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {item.group} · {item.url}
                        </div>
                      </div>
                      {isActive && (
                        <CornerDownLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
