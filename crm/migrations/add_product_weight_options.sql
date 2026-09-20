-- Lets one product be sold in multiple independently-priced pack sizes
-- (e.g. Ghee Sada 250g @ Rs.90 and 500g @ Rs.160) instead of needing a
-- separate product row per size, and instead of the single net_weight_grams
-- added earlier (which assumed one fixed weight per product — doesn't work
-- once a product has more than one pack size).
CREATE TABLE IF NOT EXISTS public.product_weight_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  weight_grams numeric NOT NULL CHECK (weight_grams > 0),
  price numeric NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_weight_options_pkey PRIMARY KEY (id),
  CONSTRAINT product_weight_options_product_weight_key UNIQUE (product_id, weight_grams)
);

CREATE INDEX IF NOT EXISTS idx_product_weight_options_product_id
  ON public.product_weight_options (product_id);

-- Snapshot of which weight was actually sold on this line, same convention
-- as product_name/unit_price already being snapshots at time of sale rather
-- than live references — editing or deleting a weight option later must
-- never change what a past bill shows.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS weight_grams numeric;

ALTER TABLE public.product_weight_options DISABLE ROW LEVEL SECURITY;
