-- Migration: Enhance Customer and Order Address Fields
-- Date: 2025-10-24
-- Description: Adds separate room_number, floor, and wing fields to customers and orders tables
-- This replaces the combined flat_number and floor_wing fields with more granular address components

-- ============================================
-- CUSTOMERS TABLE
-- ============================================

-- Add new columns for shipping address
ALTER TABLE public.customers
ADD COLUMN shipping_room_number text,
ADD COLUMN shipping_floor text,
ADD COLUMN shipping_wing text;

-- Add new columns for billing address
ALTER TABLE public.customers
ADD COLUMN billing_room_number text,
ADD COLUMN billing_floor text,
ADD COLUMN billing_wing text;

-- Migrate existing data from old fields to new fields
-- Split floor_wing into floor and wing (if it contains both, we'll keep it in floor for now)
UPDATE public.customers
SET
  shipping_room_number = shipping_flat_number,
  shipping_floor = shipping_floor_wing,
  billing_room_number = billing_flat_number,
  billing_floor = billing_floor_wing
WHERE shipping_flat_number IS NOT NULL OR shipping_floor_wing IS NOT NULL;

-- Add comments to new columns
COMMENT ON COLUMN public.customers.shipping_room_number IS 'Room number or flat number in the building';
COMMENT ON COLUMN public.customers.shipping_floor IS 'Floor number in the building';
COMMENT ON COLUMN public.customers.shipping_wing IS 'Wing or block in the building complex';
COMMENT ON COLUMN public.customers.billing_room_number IS 'Billing address room number or flat number';
COMMENT ON COLUMN public.customers.billing_floor IS 'Billing address floor number';
COMMENT ON COLUMN public.customers.billing_wing IS 'Billing address wing or block';

-- ============================================
-- ORDERS TABLE
-- ============================================

-- Add new columns for shipping address
ALTER TABLE public.orders
ADD COLUMN shipping_room_number text,
ADD COLUMN shipping_floor text,
ADD COLUMN shipping_wing text;

-- Add new columns for billing address
ALTER TABLE public.orders
ADD COLUMN billing_room_number text,
ADD COLUMN billing_floor text,
ADD COLUMN billing_wing text;

-- Migrate existing data from old fields to new fields
UPDATE public.orders
SET
  shipping_room_number = shipping_flat_number,
  shipping_floor = shipping_floor_wing,
  billing_room_number = billing_flat_number,
  billing_floor = billing_floor_wing
WHERE shipping_flat_number IS NOT NULL OR shipping_floor_wing IS NOT NULL;

-- Add comments to new columns
COMMENT ON COLUMN public.orders.shipping_room_number IS 'Room number or flat number in the building';
COMMENT ON COLUMN public.orders.shipping_floor IS 'Floor number in the building';
COMMENT ON COLUMN public.orders.shipping_wing IS 'Wing or block in the building complex';
COMMENT ON COLUMN public.orders.billing_room_number IS 'Billing address room number or flat number';
COMMENT ON COLUMN public.orders.billing_floor IS 'Billing address floor number';
COMMENT ON COLUMN public.orders.billing_wing IS 'Billing address wing or block';

-- ============================================
-- OPTIONAL: Drop old columns (uncomment if you want to remove old fields)
-- WARNING: Only run these after updating all application code
-- ============================================

-- ALTER TABLE public.customers
-- DROP COLUMN shipping_flat_number,
-- DROP COLUMN shipping_floor_wing,
-- DROP COLUMN billing_flat_number,
-- DROP COLUMN billing_floor_wing;

-- ALTER TABLE public.orders
-- DROP COLUMN shipping_flat_number,
-- DROP COLUMN shipping_floor_wing,
-- DROP COLUMN billing_flat_number,
-- DROP COLUMN billing_floor_wing;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check customers table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'customers'
-- AND column_name LIKE '%room%' OR column_name LIKE '%floor%' OR column_name LIKE '%wing%'
-- ORDER BY ordinal_position;

-- Check orders table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'orders'
-- AND column_name LIKE '%room%' OR column_name LIKE '%floor%' OR column_name LIKE '%wing%'
-- ORDER BY ordinal_position;
