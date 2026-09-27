-- Seed data for the khakhra manufacturing system. Idempotent (safe to
-- re-run): categories/materials use ON CONFLICT (name) DO NOTHING since
-- both have UNIQUE name constraints; variants and BOM rows use
-- WHERE NOT EXISTS since they have no natural unique constraint to
-- conflict on. Run AFTER khakhra_rename_litres_to_kg.sql.

-- 8 raw ingredient categories (shared "tanks" across all 4 flavor recipes)
INSERT INTO public.product_categories (name) VALUES
  ('Wheat Flour'),
  ('Edible Oil'),
  ('Salt'),
  ('Red Chilli Powder'),
  ('Carom Seeds'),
  ('Cumin Seeds'),
  ('Turmeric Powder'),
  ('Kasuri Methi')
ON CONFLICT (name) DO NOTHING;

-- 4 flavor categories (each is also a loose-stock "tank" for the finished,
-- unpacked khakhra produced by Stage 1)
INSERT INTO public.product_categories (name) VALUES
  ('Classic Sada Khakhra'),
  ('Spicy Masala Khakhra'),
  ('Magic Methi Khakhra'),
  ('Zesty Jeera Khakhra')
ON CONFLICT (name) DO NOTHING;

-- One loose_stock tank per category (raw ingredients + flavors), starting at 0kg
INSERT INTO public.loose_stock (category_id, quantity_kg, price_per_kg)
SELECT id, 0, 0 FROM public.product_categories
WHERE name IN (
  'Wheat Flour', 'Edible Oil', 'Salt', 'Red Chilli Powder', 'Carom Seeds',
  'Cumin Seeds', 'Turmeric Powder', 'Kasuri Methi',
  'Classic Sada Khakhra', 'Spicy Masala Khakhra', 'Magic Methi Khakhra', 'Zesty Jeera Khakhra'
)
ON CONFLICT (category_id) DO NOTHING;

-- Content material per flavor: represents the loose khakhra itself,
-- drawn from that flavor's loose_stock tank during Stage 2 packaging.
INSERT INTO public.packaging_materials (name, material_type)
SELECT name || ' (Loose)', 'content' FROM public.product_categories
WHERE name IN ('Classic Sada Khakhra', 'Spicy Masala Khakhra', 'Magic Methi Khakhra', 'Zesty Jeera Khakhra')
ON CONFLICT (name) DO NOTHING;

-- Pouch packaging material per flavor+size (each flavor's pouch is printed
-- with its own label design, so each is its own material)
INSERT INTO public.packaging_materials (name, material_type) VALUES
  ('Classic Sada 500g Pouch', 'packaging'),
  ('Classic Sada 250g Pouch', 'packaging'),
  ('Spicy Masala 500g Pouch', 'packaging'),
  ('Spicy Masala 250g Pouch', 'packaging'),
  ('Magic Methi 500g Pouch', 'packaging'),
  ('Magic Methi 250g Pouch', 'packaging'),
  ('Zesty Jeera 500g Pouch', 'packaging'),
  ('Zesty Jeera 250g Pouch', 'packaging')
ON CONFLICT (name) DO NOTHING;

-- Shared packaging usable across all flavors/sizes (add BOM rows for these
-- later via the Material Mapping UI once real carton/tape ratios are known
-- -- not seeded here since those ratios are business data, not structure)
INSERT INTO public.packaging_materials (name, material_type) VALUES
  ('Carton Box', 'packaging'),
  ('Packing Tape', 'packaging')
ON CONFLICT (name) DO NOTHING;

-- 8 pack-size variants, one per (flavor, size), linked to their existing
-- sellable `products` row by explicit product_id (not name matching --
-- some product names have trailing whitespace).
INSERT INTO public.product_variants (category_id, variant_name, product_id)
SELECT c.id, v.variant_name, v.product_id::uuid
FROM (VALUES
  ('Classic Sada Khakhra', '500g', 'a4fda09b-4c28-485b-9ef6-129bdc8280de'),
  ('Classic Sada Khakhra', '250g', 'e5da5ddf-4d99-4ceb-8180-ac3ddfd481c9'),
  ('Spicy Masala Khakhra', '500g', '482462aa-93b2-4199-96e8-97c1607ae738'),
  ('Spicy Masala Khakhra', '250g', '57274166-4981-4abe-8074-d5c82e295406'),
  ('Magic Methi Khakhra', '500g', '5e091cd1-2253-4f64-ab7a-d9ef132e9edc'),
  ('Magic Methi Khakhra', '250g', '7af2dbd8-d118-4947-9016-ecd2f42749e4'),
  ('Zesty Jeera Khakhra', '500g', '9d3ecd4f-7379-4522-9cfd-aa016290c27e'),
  ('Zesty Jeera Khakhra', '250g', 'ccb64bbc-22ef-49e9-a5bb-c7bd07320eb4')
) AS v(category_name, variant_name, product_id)
JOIN public.product_categories c ON c.name = v.category_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_variants pv
  WHERE pv.category_id = c.id AND pv.variant_name = v.variant_name
);

-- BOM per variant: the loose khakhra content (kg_consumed_per_unit = pack
-- weight) + the flavor+size's pouch (quantity_per_unit = 1 each).
INSERT INTO public.variant_material_mapping (variant_id, material_id, quantity_per_unit, kg_consumed_per_unit, is_required, display_order)
SELECT pv.id, pm.id, 1, bom.kg_per_unit, true, bom.display_order
FROM (VALUES
  ('Classic Sada Khakhra', '500g', 'Classic Sada Khakhra (Loose)', 0.5::numeric, 1),
  ('Classic Sada Khakhra', '500g', 'Classic Sada 500g Pouch', 0::numeric, 2),
  ('Classic Sada Khakhra', '250g', 'Classic Sada Khakhra (Loose)', 0.25::numeric, 1),
  ('Classic Sada Khakhra', '250g', 'Classic Sada 250g Pouch', 0::numeric, 2),
  ('Spicy Masala Khakhra', '500g', 'Spicy Masala Khakhra (Loose)', 0.5::numeric, 1),
  ('Spicy Masala Khakhra', '500g', 'Spicy Masala 500g Pouch', 0::numeric, 2),
  ('Spicy Masala Khakhra', '250g', 'Spicy Masala Khakhra (Loose)', 0.25::numeric, 1),
  ('Spicy Masala Khakhra', '250g', 'Spicy Masala 250g Pouch', 0::numeric, 2),
  ('Magic Methi Khakhra', '500g', 'Magic Methi Khakhra (Loose)', 0.5::numeric, 1),
  ('Magic Methi Khakhra', '500g', 'Magic Methi 500g Pouch', 0::numeric, 2),
  ('Magic Methi Khakhra', '250g', 'Magic Methi Khakhra (Loose)', 0.25::numeric, 1),
  ('Magic Methi Khakhra', '250g', 'Magic Methi 250g Pouch', 0::numeric, 2),
  ('Zesty Jeera Khakhra', '500g', 'Zesty Jeera Khakhra (Loose)', 0.5::numeric, 1),
  ('Zesty Jeera Khakhra', '500g', 'Zesty Jeera 500g Pouch', 0::numeric, 2),
  ('Zesty Jeera Khakhra', '250g', 'Zesty Jeera Khakhra (Loose)', 0.25::numeric, 1),
  ('Zesty Jeera Khakhra', '250g', 'Zesty Jeera 250g Pouch', 0::numeric, 2)
) AS bom(category_name, variant_name, material_name, kg_per_unit, display_order)
JOIN public.product_categories c ON c.name = bom.category_name
JOIN public.product_variants pv ON pv.category_id = c.id AND pv.variant_name = bom.variant_name
JOIN public.packaging_materials pm ON pm.name = bom.material_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.variant_material_mapping vmm
  WHERE vmm.variant_id = pv.id AND vmm.material_id = pm.id
);
