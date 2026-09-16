-- Factory warehouse stock table
CREATE TABLE public.factory_warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_inventory_id UUID NOT NULL REFERENCES public.stock_inventory(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  min_stock_level INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stock_inventory_id)
);

CREATE INDEX idx_factory_warehouse_stock_product_id ON public.factory_warehouse_stock(product_id);

COMMENT ON TABLE public.factory_warehouse_stock IS 'Tracks finished product stock at factory warehouse, separate from raw material inventory';

ALTER TABLE public.factory_warehouse_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.factory_warehouse_stock
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_factory_warehouse_stock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER factory_warehouse_stock_updated_at
  BEFORE UPDATE ON public.factory_warehouse_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_factory_warehouse_stock_updated_at();

-- Seed initial data from existing stock_inventory
INSERT INTO public.factory_warehouse_stock (stock_inventory_id, product_id, quantity, min_stock_level)
SELECT id, product_id, quantity, min_stock
FROM public.stock_inventory
WHERE product_id IS NOT NULL;
