-- Migration: Add serviceable_pincodes column to delivery_partners table
-- Date: 2025-01-XX
-- Description: Adds an array field to store pincodes that a delivery partner can service

-- Add the serviceable_pincodes column
ALTER TABLE public.delivery_partners
ADD COLUMN serviceable_pincodes text[] DEFAULT '{}';

-- Add a comment to the column
COMMENT ON COLUMN public.delivery_partners.serviceable_pincodes IS 'Array of pincodes where this delivery partner can deliver orders';

-- Optional: Create an index for faster pincode lookups (useful for large datasets)
CREATE INDEX idx_delivery_partners_serviceable_pincodes ON public.delivery_partners USING GIN (serviceable_pincodes);
