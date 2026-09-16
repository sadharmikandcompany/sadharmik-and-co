// Database types for public.users table

export type UserRole =
  | 'admin'
  | 'warehouse'
  | 'customer_support'
  | 'factories'
  | 'main_distributor'
  | 'retailer'
  | 'sub_distributor'
  | 'delivery_driver'
  | 'vendors'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  delivery_partner_id?: string | null
}
