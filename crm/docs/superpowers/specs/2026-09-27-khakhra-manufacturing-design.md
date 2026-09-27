# Khakhra Manufacturing System — Design

Date: 2026-09-27

## Problem

The CRM's stock/manufacturing system (Loose Stock, Material Mapping, Stock Transfer, Factory Dashboard) was built for the previous business, Kalapurna, which sold bulk ghee/oil packaged into bottles: one liquid measured directly into a bottle, no transformation step. Every relevant table and page hardcodes litres as the unit.

Sadharmik & Company manufactures khakhra (a flatbread snack) in 4 flavors — Classic Sada, Spicy Masala, Magic Methi, Zesty Jeera — sold in weighed packets (500g, 250g). Khakhra is actually *manufactured* (dough mixed from wheat flour/oil/salt/spices, rolled, roasted) before packaging, so raw ingredient weight in does not equal finished product weight out. The existing one-stage "measure liquid into bottle" model does not fit.

Confirmed: the Loose Stock / Material Mapping / Stock Transfer (`main-stock/transfer`) tables and pages are unused leftovers — no real ghee business runs through them today. They are safe to repurpose directly rather than building a parallel schema.

## Scope

In scope: raw material purchasing (kg), a new production/recipe system (Stage 1), and repurposing the existing packaging "transfer" flow (Stage 2) for khakhra, all in kilograms.

Out of scope (explicitly deferred): Factory Dashboard's litres-based reports, Warehouse Stock, Stock Inventory, and Low Stock pages. These currently derive litres by regex-parsing product names; they get updated once real kg production data exists to report on. Do not touch `app/dashboard/factory-dashboard/page.tsx`, `app/dashboard/warehouse-stock/*`, `app/dashboard/stock/page.tsx`, `app/dashboard/stock/low-stock/page.tsx`, or `app/dashboard/stock/factory-warehouse/page.tsx` in this pass.

## The three-stage model

1. **Stage 0 — Raw material purchasing.** Buy Wheat Flour, Edible Oil, Salt, Red Chilli, Carom Seeds, Cumin Seeds, Turmeric Powder, Kasuri Methi in kg. Each ingredient has its own running stock "tank."
2. **Stage 1 — Production (new).** Each flavor has a fixed recipe: grams of each raw ingredient per 1kg of finished khakhra. Logging a production run (flavor + output kg produced) auto-deducts every ingredient per the recipe scaled to that output, and credits that flavor's loose (unpacked) khakhra stock.
3. **Stage 2 — Packaging (repurposes the existing ghee "transfer" flow).** Pick a flavor + pack size variant (e.g. "Spicy Masala 500g"), enter pack count. Deducts loose khakhra (packs × pack weight) + one pouch per pack + any shared packaging (carton/tape), credits the sellable product's stock. Same shape as today's `main-stock/transfer` logic, relabeled from litres to kg.

## Data model

Repurpose existing tables rather than duplicate, since they're confirmed unused:

- **`product_categories`** — the 4 ghee-type rows are replaced with: 8 raw-ingredient rows (Wheat Flour, Edible Oil, Salt, Red Chilli, Carom Seeds, Cumin Seeds, Turmeric Powder, Kasuri Methi) + 4 flavor rows (Classic Sada, Spicy Masala, Magic Methi, Zesty Jeera).
- **`loose_stock`** — rename `quantity_liters`→`quantity_kg`, `price_per_liter`→`price_per_kg`. One tank per raw-ingredient category (fed by Stage 0 purchases) and one tank per flavor category (fed by Stage 1 production, drawn down by Stage 2 packaging).
- **`loose_stock_transactions`** — same rename (`quantity_liters`→`quantity_kg`, `price_per_liter`→`price_per_kg`); `transaction_type` gains no new values, but Stage 1 production runs log a `'transfer'`-type transaction on the raw-ingredient tanks (consumption) alongside the new production-run record, same as today's ghee "transfer" logs a transaction on the ghee tank.
- **`product_variants`** — pack sizes per flavor (e.g. "Spicy Masala 500g", "Spicy Masala 250g"), `category_id` pointing at the flavor category. No structural change from ghee's bottle-size variants.
- **`variant_material_mapping`** — rename `liters_consumed_per_unit`→`kg_consumed_per_unit`. Stage 2 BOM: one row per pack size for the pouch (packaging-type material) plus shared packaging (carton/tape), unchanged in shape from ghee.
- **`packaging_materials`** — new rows added: one pouch material per flavor+size (e.g. "Classic Sada 500g Pouch"), plus shared materials (carton, tape) usable across flavors/sizes.
- **New: `khakhra_recipes`** — `id`, `flavor_category_id` (FK → `product_categories`), `raw_material_category_id` (FK → `product_categories`), `grams_per_kg_output numeric` CHECK > 0, timestamps. One row per (flavor, raw ingredient) pair.
- **New: `khakhra_production_runs`** — `id`, `flavor_category_id` (FK → `product_categories`), `output_quantity_kg numeric` CHECK > 0, `batch_number`, `production_date`, `user_id`/`user_email`, `notes`, timestamps. Submitting a run computes each ingredient's deduction as `recipe.grams_per_kg_output * output_quantity_kg / 1000`, decrements that ingredient's `loose_stock.quantity_kg`, logs a `loose_stock_transactions` row per ingredient, and increments the flavor's `loose_stock.quantity_kg`.

## Pages

- **Purchases** (`app/dashboard/purchases/loose/page.tsx` and its "loose stock" naming) — relabeled to raw-material purchases in kg; `quantityLiters`/`pricePerLiter` form fields renamed to kg equivalents.
- **New page: Khakhra Production** — two views: (a) recipe editor (define/edit each flavor's `khakhra_recipes` rows), (b) production run log (list past runs, form to log a new one with live-calculated ingredient consumption preview before submit).
- **`app/dashboard/loose-stock/page.tsx`** — relabeled "Raw Material & Flavor Stock", kg-denominated, same table/transaction-history shape.
- **`app/dashboard/main-stock/transfer/page.tsx`** and **`app/dashboard/stock/material-mapping/page.tsx`** — relabeled to kg and khakhra terminology ("Liters Consumed" → "Kg Consumed", ghee category constants → flavor constants), logic otherwise unchanged.
- Sidebar menu labels (`lib/sidebar-menu.ts`) updated to match (no "(Liters)" wording).

## Migration approach

All schema changes ship as new files under `crm/migrations/`, handed to the user to run manually in Supabase (no direct DB access available). Column renames use `ALTER TABLE ... RENAME COLUMN`. New tables (`khakhra_recipes`, `khakhra_production_runs`) are plain `CREATE TABLE IF NOT EXISTS`. Seed data (the 8 raw-ingredient + 4 flavor `product_categories` rows) ships as a data migration; existing ghee-category rows are left in place unless the user confirms they should be deleted (they're unused but deleting is a destructive, separate decision).

## Explicitly deferred

- Factory Dashboard rewrite (litres → kg reports, monthly breakdowns, charts).
- Warehouse Stock / Stock Inventory / Low Stock pages' litres-parsing cleanup.
- Reconciling `product_weight_options` (customer-facing pack-size pricing) with `product_variants` (manufacturing BOM) — today they're unconnected for ghee too; not addressed in this pass.
