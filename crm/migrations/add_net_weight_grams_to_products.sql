-- Replaces name-parsed liquid volume (Kalapurna's "... Bottle - 5 LTR"
-- convention) with an explicit per-product weight, since Sadharmik's khakhra
-- products don't encode a size in the product name at all. Powers the
-- Orders table's Kg column (see lib/product-weight.ts) via quantity *
-- net_weight_grams, rather than regex-guessing from the product name.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS net_weight_grams numeric CHECK (net_weight_grams IS NULL OR net_weight_grams > 0);

-- Backfill: the 8 khakhra products seeded from the website are all sold as
-- 500g packs (see index.html's product cards). Only sets it where it's
-- still unset, so re-running this is safe and won't clobber a manual edit.
UPDATE public.products
SET net_weight_grams = 500
WHERE net_weight_grams IS NULL
  AND name IN ('Ghee Sada', 'Ghee Jeera', 'Methi Masala', 'Special Masala', 'Methi', 'Punjabi', 'Nachani', 'Jeera Masala');
