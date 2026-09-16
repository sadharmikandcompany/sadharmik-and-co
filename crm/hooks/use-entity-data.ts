"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "./use-user-role"

const ENTITY_COOKIE = "user_entity_id"

function readEntityCookie(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp("(?:^|; )" + ENTITY_COOKIE + "=([^;]+)"))
  return m ? decodeURIComponent(m[1]) : null
}

function writeEntityCookie(id: string) {
  if (typeof document === "undefined") return
  document.cookie = `${ENTITY_COOKIE}=${encodeURIComponent(id)}; Path=/; SameSite=Lax; Max-Age=2592000`
}

function clearEntityCookie() {
  if (typeof document === "undefined") return
  document.cookie = `${ENTITY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

interface EntityData {
  entityType: 'distributor' | 'retailer' | 'vendor' | null
  entityId: string | null
  entityName: string | null
  entityDetails: any | null
  loading: boolean
  error: string | null
}

export function useEntityData() {
  const { userProfile, role, loading: roleLoading } = useUserRole()
  const router = useRouter()
  const [entityData, setEntityData] = useState<EntityData>({
    entityType: null,
    entityId: null,
    entityName: null,
    entityDetails: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    if (roleLoading || !userProfile) {
      return
    }

    const fetchEntityData = async () => {
      try {
        setEntityData(prev => ({ ...prev, loading: true, error: null }))

        // Determine entity type based on role
        let tableName = ''
        let entityType: 'distributor' | 'retailer' | 'vendor' | null = null

        if (role === 'main_distributor' || role === 'sub_distributor') {
          tableName = 'distributors'
          entityType = 'distributor'
        } else if (role === 'retailer') {
          tableName = 'retailers'
          entityType = 'retailer'
        } else if (role === 'vendors') {
          tableName = 'vendors'
          entityType = 'vendor'
        } else {
          // User doesn't have an entity role
          clearEntityCookie()
          setEntityData({
            entityType: null,
            entityId: null,
            entityName: null,
            entityDetails: null,
            loading: false,
            error: null
          })
          return
        }

        // Fetch entity data
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', userProfile.id)
          .single()

        if (error) {
          console.error('Entity fetch error:', error)
          if (error.code === 'PGRST116') {
            // No entity found for this user
            setEntityData({
              entityType,
              entityId: null,
              entityName: null,
              entityDetails: null,
              loading: false,
              error: 'No entity profile found. Please contact administrator to link your account.'
            })
          } else {
            console.error('Database error:', error)
            setEntityData({
              entityType,
              entityId: null,
              entityName: null,
              entityDetails: null,
              loading: false,
              error: `Database error: ${error.message}`
            })
          }
          return
        }

        // Set entity data based on type
        let entityName = ''
        if (entityType === 'distributor') {
          entityName = data.name || data.company_name || 'Unknown Distributor'
        } else if (entityType === 'retailer') {
          entityName = data.name || data.company_name || 'Unknown Retailer'
        } else if (entityType === 'vendor') {
          entityName = data.vendor_name || data.company_name || 'Unknown Vendor'
        }

        setEntityData({
          entityType,
          entityId: data.id,
          entityName,
          entityDetails: data,
          loading: false,
          error: null
        })

        // Mirror entity id into a cookie so server components can scope queries
        // (e.g. orders-v2 restricting distributors to their own retailers/pincodes).
        if (data?.id) {
          const previous = readEntityCookie()
          writeEntityCookie(data.id)
          if (previous !== data.id) {
            router.refresh()
          }
        }
      } catch (error: any) {
        console.error('Error fetching entity data:', error)
        setEntityData(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to fetch entity data'
        }))
      }
    }

    fetchEntityData()
  }, [userProfile, role, roleLoading, router])

  return entityData
}