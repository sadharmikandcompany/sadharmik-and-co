-- Adds Mandir/Shop numbering to customers, mirroring the existing
-- is_vip/vip_number pair. is_mandir already existed (boolean only); this
-- adds its number column plus the entirely-new Shop tier.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS mandir_number character varying,
  ADD COLUMN IF NOT EXISTS is_shop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_number character varying;
