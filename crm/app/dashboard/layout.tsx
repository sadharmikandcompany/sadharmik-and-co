"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { HeaderSearch } from "@/components/header-search"
import { QuickNavDialog } from "@/components/quick-nav-dialog"
import { CreateOrderShortcut } from "@/components/create-order-shortcut"
import { CreatePurchaseShortcut } from "@/components/create-purchase-shortcut"
import { CreateDebitNoteShortcut } from "@/components/create-debit-note-shortcut"
import { CreateCreditNoteShortcut } from "@/components/create-credit-note-shortcut"
import ChatWidget from "@/components/chatbot/chat-widget"
import { useUserRole } from "@/hooks/use-user-role"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { role } = useUserRole()
  const isFullWidth = pathname === "/dashboard/customers/v2"

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
      }
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          router.push("/login")
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <TooltipProvider delayDuration={0}>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 ">
          <SidebarTrigger className="-ml-1.5" />
          <Separator orientation="vertical" className="h-full" />
          <h1 className="text-base font-semibold tracking-tight">
            Sadharmik & Company Portal
          </h1>
          <div className="ml-auto flex items-center gap-1.5">
            <HeaderSearch role={role} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className={isFullWidth ? "w-full min-w-0" : "container mx-auto min-w-0 p-6"}>
            {children}
          </div>
        </main>
      </SidebarInset>
      <QuickNavDialog role={role} />
      <CreateOrderShortcut />
      <CreatePurchaseShortcut />
      <CreateDebitNoteShortcut />
      <CreateCreditNoteShortcut />
      {role === "admin" && <ChatWidget />}
    </SidebarProvider>
    </TooltipProvider>
  )
}
