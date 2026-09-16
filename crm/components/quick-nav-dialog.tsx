"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, CornerDownLeft, LogOut, type LucideIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { menuGroups } from "@/lib/sidebar-menu"
import { supabase } from "@/lib/supabase"
import { agentAutoCheckOut } from "@/lib/utils/agent-attendance"
import type { UserRole } from "@/lib/types/database"

type Props = {
  role: UserRole | null
}

type ResultItem = {
  key: string
  title: string
  group: string
  description: string
  icon: LucideIcon
  kind: "page" | "action"
  url?: string
  onSelect?: () => void | Promise<void>
}

export function QuickNavDialog({ role }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleLogout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && role === "customer_support") {
        await agentAutoCheckOut(user.id)
      }
    } catch (err) {
      console.error("[QuickNav] checkout before logout failed", err)
    }
    await supabase.auth.signOut()
    router.push("/login")
  }

  const allItems = useMemo<ResultItem[]>(() => {
    if (!role) return []

    const pages: ResultItem[] = menuGroups.flatMap((group) =>
      group.items
        .filter((item) => item.roles.includes(role))
        .map<ResultItem>((item) => ({
          key: `page:${item.url}`,
          title: item.title,
          group: group.label,
          description: `${group.label} · ${item.url}`,
          icon: item.icon,
          kind: "page",
          url: item.url,
        }))
    )

    const actions: ResultItem[] = [
      {
        key: "action:logout",
        title: "Log out",
        group: "Actions",
        description: "Sign out of your account",
        icon: LogOut,
        kind: "action",
        onSelect: handleLogout,
      },
    ]

    return [...pages, ...actions]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems.slice(0, 12)
    return allItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          (item.url && item.url.toLowerCase().includes(q))
      )
      .slice(0, 20)
  }, [allItems, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "q" || e.key === "Q")) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleSelect = (item: ResultItem) => {
    setOpen(false)
    setQuery("")
    if (item.kind === "page" && item.url) {
      router.push(item.url)
    } else if (item.kind === "action" && item.onSelect) {
      void item.onSelect()
    }
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
      handleSelect(results[activeIndex])
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-medium">Go to page or run action</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Type a page name or action..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto border-t">
          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matches
            </div>
          ) : (
            <ul className="py-1">
              {results.map((item, idx) => {
                const Icon = item.icon
                const isActive = idx === activeIndex
                const isAction = item.kind === "action"
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelect(item)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-xs transition-colors ${
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/60"
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isAction ? "text-destructive" : "text-muted-foreground"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {item.description}
                        </div>
                      </div>
                      {isAction && !isActive && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                          Action
                        </span>
                      )}
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
        <div className="border-t bg-muted/30 px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            <kbd className="rounded border bg-background px-1 py-0.5 font-medium">↑↓</kbd> navigate
            <span className="mx-1.5">·</span>
            <kbd className="rounded border bg-background px-1 py-0.5 font-medium">Enter</kbd> select
            <span className="mx-1.5">·</span>
            <kbd className="rounded border bg-background px-1 py-0.5 font-medium">Esc</kbd> close
          </span>
          <span>
            <kbd className="rounded border bg-background px-1 py-0.5 font-medium">Ctrl+Q</kbd>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
