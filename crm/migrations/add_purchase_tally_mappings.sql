-- Remembers which CRM stock item or catalog product a given vendor's Tally
-- purchase-bill line description resolves to, once a human confirms it once
-- (mirrors tally_product_mappings, used for the Order-from-Factory sales
-- side). Scoped per-vendor since the same raw description could plausibly
-- mean different things for different vendors.
CREATE TABLE IF NOT EXISTS public.purchase_tally_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  tally_description text NOT NULL,
  stock_inventory_id uuid REFERENCES public.stock_inventory(id),
  product_id uuid REFERENCES public.products(id),
  is_loose_stock boolean NOT NULL DEFAULT false,
  loose_stock_category_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchase_tally_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_tally_mappings_vendor_desc_key UNIQUE (vendor_id, tally_description),
  CONSTRAINT purchase_tally_mappings_one_target CHECK (
    (stock_inventory_id IS NOT NULL)::int + (product_id IS NOT NULL)::int + (is_loose_stock)::int = 1
  )
);

ALTER TABLE public.purchase_tally_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage purchase tally mappings"
  ON public.purchase_tally_mappings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
