"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LogOut,
  ChevronUp,
  ChevronDown,
  User2,
  Search,
  X,
} from "lucide-react"
import { menuGroups } from "@/lib/sidebar-menu"

import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { useUserRole } from "@/hooks/use-user-role"
import { getRoleBasedRedirectPath } from "@/lib/utils/role-redirect"
import { agentAutoCheckOut } from "@/lib/utils/agent-attendance"
import type { UserRole } from "@/lib/types/database"


export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const { userProfile, role, loading } = useUserRole()
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Overview": true,
    "Customer Engagement": true,
    "Sales & Orders": true,
    "People": true,
    "Logistics": false,
    "Products & Catalog": false,
    "Inventory Management": true,
    "Procurement": false,
    "Accounting": false,
    "Reports": false,
    "Support": true,
  })

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }))
  }

  const handleLogout = async () => {
    if (role === "customer_support" && userProfile?.id) {
      await agentAutoCheckOut(userProfile.id)
    }
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Filter menu groups and items based on user role and search query
  const isSearching = searchQuery.trim().length > 0
  const { state: sidebarState } = useSidebar()
  const isCollapsed = sidebarState === "collapsed"
  const visibleMenuGroups = useMemo(() => {
    if (!role) return []
    const query = searchQuery.trim().toLowerCase()
    return menuGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => {
          if (!item.roles.includes(role)) return false
          if (query) {
            return item.title.toLowerCase().includes(query)
          }
          return true
        }),
      }))
      .filter(group => group.items.length > 0)
  }, [role, searchQuery])

  // Format role for display
  const formatRole = (role: UserRole | null) => {
    if (!role) return "Loading..."
    return role
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="bg-[#1c1c1c] hover:bg-[#1c1c1c] rounded-none p-0! h-12 group-data-[collapsible=icon]:size-12! overflow-hidden">
              <Link href={getRoleBasedRedirectPath(role)} className="flex h-full w-full items-center justify-center">
                <img
                  src="/logo3.png"
                  alt="Sadharmik & Company"
                  className="h-full w-full px-3 py-1.5 object-contain group-data-[collapsible=icon]:hidden"
                />
                <img
                  src="/logo.webp"
                  alt="Sadharmik & Company"
                  className="hidden h-full w-full object-contain group-data-[collapsible=icon]:block"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/50"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("")
                  searchInputRef.current?.focus()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleMenuGroups.map((group) => (
          <Collapsible
            key={group.label}
            open={isCollapsed || isSearching || openGroups[group.label]}
            onOpenChange={() => !isSearching && !isCollapsed && toggleGroup(group.label)}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2 py-1.5 transition-colors cursor-pointer">
                  <span>{group.label}</span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.url}
                          tooltip={item.title}
                          className="data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:hover:bg-blue-600 data-[active=true]:hover:text-white"
                        >
                          <Link href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <User2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {userProfile?.full_name || user?.user_metadata?.full_name || "User"}
                    </span>
                    <span className="truncate text-xs">
                      {formatRole(role)}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link href="/dashboard/account">
                    <User2 className="mr-2 size-4" />
                    <span>Account</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 size-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
