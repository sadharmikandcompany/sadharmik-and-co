-- Warehouse stock in kg per flavour (Classic Sada, Spicy Masala, Magic Methi,
-- Zesty Jeera) instead of packets per pack size. One row per warehouse +
-- flavour (product_categories row); the Warehouse Stock page reads and edits
-- this table directly.
CREATE TABLE IF NOT EXISTS public.godown_kg_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  godown_id UUID NOT NULL REFERENCES public.godowns(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  quantity_kg NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (godown_id, category_id)
);

COMMENT ON TABLE public.godown_kg_stock IS 'Finished khakhra stock in kg per warehouse and flavour';

ALTER TABLE public.godown_kg_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.godown_kg_stock
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_godown_kg_stock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER godown_kg_stock_updated_at
  BEFORE UPDATE ON public.godown_kg_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_godown_kg_stock_updated_at();
