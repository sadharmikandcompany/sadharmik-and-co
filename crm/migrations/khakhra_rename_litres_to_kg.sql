-- Renames litres-specific columns to unit-agnostic kg columns.
-- loose_stock, loose_stock_transactions, and variant_material_mapping are
-- confirmed unused leftovers from the previous ghee business (0 rows in
-- all of them) -- safe to repurpose directly for khakhra manufacturing
-- instead of building a parallel schema. Postgres CHECK constraints follow
-- column renames automatically (they're stored by attnum, not name), so
-- existing CHECK (quantity_liters >= 0) constraints keep working under
-- their new column name without any extra statement.
-- See docs/superpowers/specs/2026-09-27-khakhra-manufacturing-design.md
ALTER TABLE public.loose_stock RENAME COLUMN quantity_liters TO quantity_kg;
ALTER TABLE public.loose_stock RENAME COLUMN price_per_liter TO price_per_kg;

ALTER TABLE public.loose_stock_transactions RENAME COLUMN quantity_liters TO quantity_kg;
ALTER TABLE public.loose_stock_transactions RENAME COLUMN price_per_liter TO price_per_kg;

ALTER TABLE public.variant_material_mapping RENAME COLUMN liters_consumed_per_unit TO kg_consumed_per_unit;
