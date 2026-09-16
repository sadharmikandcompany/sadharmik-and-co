"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { UserRole, UserProfile } from "@/lib/types/database"

const ROLE_COOKIE = "user_role"

function readRoleCookie(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp("(?:^|; )" + ROLE_COOKIE + "=([^;]+)"))
  return m ? decodeURIComponent(m[1]) : null
}

function writeRoleCookie(role: string) {
  if (typeof document === "undefined") return
  // 30-day, SameSite=Lax, root path so server components can read it on every route
  document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(role)}; Path=/; SameSite=Lax; Max-Age=2592000`
}

function clearRoleCookie() {
  if (typeof document === "undefined") return
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  // Also clear the entity cookie set by useEntityData so signout fully resets server-side scoping.
  document.cookie = `user_entity_id=; Path=/; Max-Age=0; SameSite=Lax`
}

export function useUserRole() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        // Get current auth user
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // Fetch user profile from public.users table
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user role:', error)
          setLoading(false)
          return
        }

        setUserProfile(data as UserProfile)
        setRole(data.role as UserRole)

        // Mirror role into a cookie so server components can apply role-based filters
        // (e.g. orders-v2 restricting factory users to KP-prefixed invoices).
        // If the cookie was missing or stale, refresh the route so SSR re-runs with it.
        if (data?.role) {
          const previous = readRoleCookie()
          writeRoleCookie(data.role)
          if (previous !== data.role) {
            router.refresh()
          }
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session?.user) {
          setUserProfile(null)
          setRole(null)
          setLoading(false)
          clearRoleCookie()
          return
        }
        // Skip TOKEN_REFRESHED (fires on tab focus and would create a new
        // userProfile object reference, retriggering effects) and INITIAL_SESSION
        // (already handled by the fetchUserRole() call above).
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          fetchUserRole()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  return { userProfile, role, loading }
}
