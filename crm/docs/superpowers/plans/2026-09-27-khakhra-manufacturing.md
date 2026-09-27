# Khakhra Manufacturing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unused, litres-only ghee packaging system with a khakhra manufacturing system: raw materials (kg) → per-flavor recipe production → packaging into sellable packs, matching the spec at `docs/superpowers/specs/2026-09-27-khakhra-manufacturing-design.md`.

**Architecture:** Three stages built on repurposed (renamed) ghee tables plus two new tables. Stage 0 (purchase raw materials) and Stage 2 (package loose khakhra) reuse the existing `loose_stock` / `variant_material_mapping` / `packaging_materials` machinery, renamed from litres to kg. Stage 1 (production) is new: `khakhra_recipes` (fixed grams-per-kg-output per flavor+ingredient) and `khakhra_production_runs` (logged batches that auto-deduct ingredients and credit the flavor's loose stock).

**Tech Stack:** Next.js 15 (App Router, client components), Supabase (Postgres), no test framework — verification is `tsc --noEmit`, direct Node scripts against Supabase (using `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`), and manual checks at `localhost:3001`.

## Global Constraints

- No test framework exists in this repo (confirmed: `package.json` has no `jest`/`vitest`, no test script). Every task's "test" step is `tsc --noEmit` plus a Node verification script or manual browser check — never invent a fake test suite.
- This session has no direct DB execution capability. Every schema change ships as a `.sql` file under `crm/migrations/` and must be run manually by the user in the Supabase SQL editor before any task that depends on it can be verified end-to-end.
- `product_categories`, `loose_stock`, `packaging_materials`, and `product_variants` are confirmed **empty** (0 rows) and unused — safe to seed/repurpose directly, no existing data to preserve or migrate.
- `khakhra_recipes` must ship with **zero seed rows** for the actual gram values — those are real food-recipe numbers only the business owner knows. Never fabricate them.
- Do not touch `app/dashboard/factory-dashboard/page.tsx`, `app/dashboard/warehouse-stock/*`, `app/dashboard/stock/page.tsx`, `app/dashboard/stock/low-stock/page.tsx`, or `app/dashboard/stock/factory-warehouse/page.tsx` — explicitly deferred per the spec.
- Do not run `git commit` or `git push` unless the user explicitly asks — this project has a standing "edit locally, batch commits" rule.
- The 8 pack-size variants link to these existing `products` rows (fetched directly from the live DB, do not re-derive from name matching — some names have trailing whitespace):
  | Flavor | Size | product_id |
  |---|---|---|
  | Classic Sada | 500g | `a4fda09b-4c28-485b-9ef6-129bdc8280de` |
  | Classic Sada | 250g | `e5da5ddf-4d99-4ceb-8180-ac3ddfd481c9` |
  | Spicy Masala | 500g | `482462aa-93b2-4199-96e8-97c1607ae738` |
  | Spicy Masala | 250g | `57274166-4981-4abe-8074-d5c82e295406` |
  | Magic Methi | 500g | `5e091cd1-2253-4f64-ab7a-d9ef132e9edc` |
  | Magic Methi | 250g | `7af2dbd8-d118-4947-9016-ecd2f42749e4` |
  | Zesty Jeera | 500g | `9d3ecd4f-7379-4522-9cfd-aa016290c27e` |
  | Zesty Jeera | 250g | `ccb64bbc-22ef-49e9-a5bb-c7bd07320eb4` |

---

### Task 1: Migration — rename litres columns to kg

**Files:**
- Create: `crm/migrations/khakhra_rename_litres_to_kg.sql`

**Interfaces:**
- Produces: `loose_stock.quantity_kg`, `loose_stock.price_per_kg`, `loose_stock_transactions.quantity_kg`, `loose_stock_transactions.price_per_kg`, `variant_material_mapping.kg_consumed_per_unit` — every later task and the existing (to-be-updated) pages reference these exact column names.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Hand the file to the user to run in the Supabase SQL editor**

Tell the user: "Run `crm/migrations/khakhra_rename_litres_to_kg.sql` in Supabase before continuing — later tasks depend on the renamed columns existing."

- [ ] **Step 3: Verify the rename took effect**

Run (after the user confirms they ran it):
```bash
cd "crm" && node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { error: e1 } = await supabase.from('loose_stock').select('quantity_kg, price_per_kg').limit(1);
  const { error: e2 } = await supabase.from('loose_stock_transactions').select('quantity_kg, price_per_kg').limit(1);
  const { error: e3 } = await supabase.from('variant_material_mapping').select('kg_consumed_per_unit').limit(1);
  console.log('loose_stock kg columns:', !e1); console.log('loose_stock_transactions kg columns:', !e2); console.log('variant_material_mapping kg column:', !e3);
})();
"
```
Expected: all three print `true`.

- [ ] **Step 4: Do not commit** (per Global Constraints — leave the migration file as an untracked/staged file, no `git add`/`commit`).

---

### Task 2: Migration — new khakhra_recipes and khakhra_production_runs tables

**Files:**
- Create: `crm/migrations/khakhra_manufacturing_tables.sql`

**Interfaces:**
- Consumes: `product_categories(id)` (existing table)
- Produces: `khakhra_recipes(id, flavor_category_id, raw_material_category_id, grams_per_kg_output)`, `khakhra_production_runs(id, flavor_category_id, output_quantity_kg, batch_number, production_date, user_id, user_email, notes)` — Task 6's production page reads/writes these exact tables and columns.

- [ ] **Step 1: Write the migration**

```sql
-- Stage 1 (Production): converting raw ingredients into loose finished
-- khakhra per a fixed recipe. Ghee has no equivalent step (it's bought
-- already-finished), so there's nothing to repurpose for this stage.
CREATE TABLE IF NOT EXISTS public.khakhra_recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  flavor_category_id uuid NOT NULL REFERENCES public.product_categories(id),
  raw_material_category_id uuid NOT NULL REFERENCES public.product_categories(id),
  grams_per_kg_output numeric NOT NULL CHECK (grams_per_kg_output > 0),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT khakhra_recipes_pkey PRIMARY KEY (id),
  CONSTRAINT khakhra_recipes_unique_ingredient UNIQUE (flavor_category_id, raw_material_category_id)
);

CREATE TABLE IF NOT EXISTS public.khakhra_production_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  flavor_category_id uuid NOT NULL REFERENCES public.product_categories(id),
  output_quantity_kg numeric NOT NULL CHECK (output_quantity_kg > 0),
  batch_number character varying,
  production_date timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  user_id uuid,
  user_email character varying,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT khakhra_production_runs_pkey PRIMARY KEY (id)
);

ALTER TABLE public.khakhra_recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.khakhra_production_runs DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Hand the file to the user to run in Supabase.**

- [ ] **Step 3: Verify**

```bash
cd "crm" && node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { error: e1 } = await supabase.from('khakhra_recipes').select('id').limit(1);
  const { error: e2 } = await supabase.from('khakhra_production_runs').select('id').limit(1);
  console.log('khakhra_recipes exists:', !e1); console.log('khakhra_production_runs exists:', !e2);
})();
"
```
Expected: both print `true`.

- [ ] **Step 4: Do not commit.**

---

### Task 3: Migration — seed categories, packaging materials, and pack-size variants

**Files:**
- Create: `crm/migrations/khakhra_manufacturing_seed.sql`

**Interfaces:**
- Consumes: `khakhra_rename_litres_to_kg.sql` must already be applied (uses `quantity_kg`/`price_per_kg` column names).
- Produces: 12 `product_categories` rows (8 raw ingredients + 4 flavors), 12 `loose_stock` tanks (one per category, starting at 0kg), 12 `packaging_materials` rows (4 content + 8 pouches) + 2 shared packaging rows, 8 `product_variants` rows, 16 `variant_material_mapping` rows (content + pouch per variant). Task 6 (recipe editor) reads the flavor/raw-ingredient categories; Task 7 (packaging/transfer page) reads the variants and their BOM rows.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Hand the file to the user to run in Supabase, after Task 1's migration.**

- [ ] **Step 3: Verify**

```bash
cd "crm" && node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: cats } = await supabase.from('product_categories').select('name');
  console.log('categories:', cats.length, '(expect 12)');
  const { data: ls } = await supabase.from('loose_stock').select('id');
  console.log('loose_stock tanks:', ls.length, '(expect 12)');
  const { data: pm } = await supabase.from('packaging_materials').select('name, material_type');
  console.log('packaging_materials:', pm.length, '(expect 14)');
  const { data: pv } = await supabase.from('product_variants').select('variant_name, product_id');
  console.log('product_variants:', pv.length, '(expect 8, all with product_id set):', pv.every(v => v.product_id));
  const { data: vmm } = await supabase.from('variant_material_mapping').select('id');
  console.log('variant_material_mapping rows:', vmm.length, '(expect 16)');
})();
"
```
Expected: 12 categories, 12 loose_stock tanks, 14 packaging_materials, 8 product_variants (all with `product_id` set), 16 variant_material_mapping rows.

- [ ] **Step 4: Do not commit.**

---

### Task 4: Recipe editor + production run page

**Files:**
- Create: `crm/app/dashboard/khakhra-production/page.tsx`

**Interfaces:**
- Consumes: `product_categories` (flavor rows: name ends in "Khakhra"; raw-ingredient rows: the other 8), `khakhra_recipes`, `khakhra_production_runs`, `loose_stock` (all from Task 1-3).
- Produces: nothing consumed by other tasks in this plan (this is a leaf page). Later, Task 6's sidebar entry links to `/dashboard/khakhra-production`.

- [ ] **Step 1: Write the page**

```tsx
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { format } from "date-fns"

type Category = { id: string; name: string }
type Recipe = { id: string; flavor_category_id: string; raw_material_category_id: string; grams_per_kg_output: number }
type ProductionRun = {
  id: string
  flavor_category_id: string
  output_quantity_kg: number
  batch_number: string | null
  production_date: string
  notes: string | null
}

const FLAVOR_SUFFIX = "Khakhra"

export default function KhakhraProductionPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [runs, setRuns] = useState<ProductionRun[]>([])
  const [looseStock, setLooseStock] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [recipeFlavorId, setRecipeFlavorId] = useState<string>("")
  const [recipeInputs, setRecipeInputs] = useState<Record<string, string>>({})
  const [savingRecipe, setSavingRecipe] = useState(false)

  const [runFlavorId, setRunFlavorId] = useState<string>("")
  const [outputKg, setOutputKg] = useState("")
  const [batchNumber, setBatchNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [loggingRun, setLoggingRun] = useState(false)

  const flavors = categories.filter((c) => c.name.endsWith(FLAVOR_SUFFIX))
  const rawMaterials = categories.filter((c) => !c.name.endsWith(FLAVOR_SUFFIX))

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [catsRes, recipesRes, runsRes, looseRes] = await Promise.all([
        supabase.from("product_categories").select("id, name").order("name"),
        supabase.from("khakhra_recipes").select("id, flavor_category_id, raw_material_category_id, grams_per_kg_output"),
        supabase.from("khakhra_production_runs").select("id, flavor_category_id, output_quantity_kg, batch_number, production_date, notes").order("production_date", { ascending: false }).limit(50),
        supabase.from("loose_stock").select("category_id, quantity_kg"),
      ])
      if (catsRes.error) throw catsRes.error
      if (recipesRes.error) throw recipesRes.error
      if (runsRes.error) throw runsRes.error
      if (looseRes.error) throw looseRes.error

      setCategories(catsRes.data || [])
      setRecipes(recipesRes.data || [])
      setRuns(runsRes.data || [])
      const stockMap: Record<string, number> = {}
      ;(looseRes.data || []).forEach((row: any) => { stockMap[row.category_id] = Number(row.quantity_kg) })
      setLooseStock(stockMap)
    } catch (error) {
      console.error("Error loading khakhra production data:", error)
      toast.error("Failed to load production data")
    } finally {
      setLoading(false)
    }
  }

  // Populate the recipe input fields whenever the selected flavor (or the
  // loaded recipes) changes, so editing shows current saved values.
  useEffect(() => {
    if (!recipeFlavorId) { setRecipeInputs({}); return }
    const inputs: Record<string, string> = {}
    rawMaterials.forEach((m) => {
      const existing = recipes.find((r) => r.flavor_category_id === recipeFlavorId && r.raw_material_category_id === m.id)
      inputs[m.id] = existing ? String(existing.grams_per_kg_output) : ""
    })
    setRecipeInputs(inputs)
  }, [recipeFlavorId, recipes, rawMaterials.length])

  const saveRecipe = async () => {
    if (!recipeFlavorId) { toast.error("Select a flavor first"); return }
    setSavingRecipe(true)
    try {
      const rows = Object.entries(recipeInputs)
        .filter(([, value]) => value.trim() !== "")
        .map(([rawMaterialId, value]) => ({
          flavor_category_id: recipeFlavorId,
          raw_material_category_id: rawMaterialId,
          grams_per_kg_output: parseFloat(value),
        }))
        .filter((row) => !isNaN(row.grams_per_kg_output) && row.grams_per_kg_output > 0)

      if (rows.length === 0) { toast.error("Enter at least one ingredient amount"); return }

      const { error } = await supabase
        .from("khakhra_recipes")
        .upsert(rows, { onConflict: "flavor_category_id,raw_material_category_id" })
      if (error) throw error

      toast.success("Recipe saved")
      loadAll()
    } catch (error) {
      console.error("Error saving recipe:", error)
      toast.error("Failed to save recipe")
    } finally {
      setSavingRecipe(false)
    }
  }

  const flavorRecipeRows = recipes.filter((r) => r.flavor_category_id === runFlavorId)
  const outputKgNum = parseFloat(outputKg) || 0
  const consumptionPreview = flavorRecipeRows.map((r) => {
    const material = rawMaterials.find((m) => m.id === r.raw_material_category_id)
    const gramsNeeded = r.grams_per_kg_output * outputKgNum
    const kgNeeded = gramsNeeded / 1000
    const available = looseStock[r.raw_material_category_id] || 0
    return { material: material?.name || "Unknown", kgNeeded, available, sufficient: available >= kgNeeded }
  })
  const canLogRun = runFlavorId && outputKgNum > 0 && flavorRecipeRows.length > 0 && consumptionPreview.every((c) => c.sufficient)

  const logProductionRun = async () => {
    if (!canLogRun) return
    setLoggingRun(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: run, error: runError } = await supabase
        .from("khakhra_production_runs")
        .insert({
          flavor_category_id: runFlavorId,
          output_quantity_kg: outputKgNum,
          batch_number: batchNumber.trim() || null,
          notes: notes.trim() || null,
          user_id: user?.id || null,
          user_email: user?.email || null,
        })
        .select("id")
        .single()
      if (runError) throw runError

      // Deduct each raw ingredient from its loose_stock tank, logging a
      // transaction per ingredient (mirrors how ghee's packaging "transfer"
      // logs one loose_stock_transactions row per consumption event).
      for (const row of flavorRecipeRows) {
        const kgNeeded = (row.grams_per_kg_output * outputKgNum) / 1000
        const { data: stockRow, error: stockFetchError } = await supabase
          .from("loose_stock")
          .select("id, quantity_kg")
          .eq("category_id", row.raw_material_category_id)
          .single()
        if (stockFetchError) throw stockFetchError

        const { error: updateError } = await supabase
          .from("loose_stock")
          .update({ quantity_kg: Number(stockRow.quantity_kg) - kgNeeded })
          .eq("id", stockRow.id)
        if (updateError) throw updateError

        const { error: txnError } = await supabase.from("loose_stock_transactions").insert({
          loose_stock_id: stockRow.id,
          transaction_type: "transfer",
          quantity_kg: -kgNeeded,
          user_id: user?.id || null,
          user_email: user?.email || null,
          transaction_notes: `Consumed for production run ${run.id}`,
        })
        if (txnError) throw txnError
      }

      // Credit the flavor's own loose-stock tank with the produced weight.
      const { data: flavorStock, error: flavorFetchError } = await supabase
        .from("loose_stock")
        .select("id, quantity_kg")
        .eq("category_id", runFlavorId)
        .single()
      if (flavorFetchError) throw flavorFetchError

      const { error: flavorUpdateError } = await supabase
        .from("loose_stock")
        .update({ quantity_kg: Number(flavorStock.quantity_kg) + outputKgNum })
        .eq("id", flavorStock.id)
      if (flavorUpdateError) throw flavorUpdateError

      toast.success(`Logged production run: ${outputKgNum}kg`)
      setOutputKg("")
      setBatchNumber("")
      setNotes("")
      loadAll()
    } catch (error) {
      console.error("Error logging production run:", error)
      toast.error("Failed to log production run")
    } finally {
      setLoggingRun(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Khakhra Production</h1>
        <p className="text-sm text-muted-foreground">Recipes and production runs, in kg</p>
      </div>

      <Tabs defaultValue="runs" className="w-full">
        <TabsList>
          <TabsTrigger value="runs">Production Runs</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Log a Production Run</CardTitle>
              <CardDescription>Enter the flavor and how much finished khakhra came out of this batch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Flavor</Label>
                  <Select value={runFlavorId} onValueChange={setRunFlavorId}>
                    <SelectTrigger><SelectValue placeholder="Select flavor" /></SelectTrigger>
                    <SelectContent>
                      {flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Output (kg)</Label>
                  <Input type="number" step="0.01" value={outputKg} onChange={(e) => setOutputKg(e.target.value)} placeholder="e.g. 12" />
                </div>
                <div className="space-y-2">
                  <Label>Batch Number</Label>
                  <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>

              {runFlavorId && flavorRecipeRows.length === 0 && (
                <p className="text-sm text-amber-600">No recipe defined for this flavor yet — add one in the Recipes tab first.</p>
              )}

              {consumptionPreview.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead className="text-right">Needed (kg)</TableHead>
                        <TableHead className="text-right">Available (kg)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consumptionPreview.map((c) => (
                        <TableRow key={c.material}>
                          <TableCell>{c.material}</TableCell>
                          <TableCell className="text-right">{c.kgNeeded.toFixed(3)}</TableCell>
                          <TableCell className={`text-right ${c.sufficient ? "" : "text-red-600 font-medium"}`}>{c.available.toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Button onClick={logProductionRun} disabled={!canLogRun || loggingRun}>
                {loggingRun ? "Logging..." : "Log Production Run"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Flavor</TableHead>
                    <TableHead className="text-right">Output (kg)</TableHead>
                    <TableHead>Batch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{format(new Date(run.production_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{categories.find((c) => c.id === run.flavor_category_id)?.name || "Unknown"}</TableCell>
                      <TableCell className="text-right">{run.output_quantity_kg}</TableCell>
                      <TableCell>{run.batch_number || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Flavor Recipe</CardTitle>
              <CardDescription>Grams of each raw ingredient per 1kg of finished khakhra</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-xs">
                <Label>Flavor</Label>
                <Select value={recipeFlavorId} onValueChange={setRecipeFlavorId}>
                  <SelectTrigger><SelectValue placeholder="Select flavor" /></SelectTrigger>
                  <SelectContent>
                    {flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {recipeFlavorId && (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Raw Material</TableHead>
                          <TableHead className="text-right">Grams per kg output</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawMaterials.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>{m.name}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.1"
                                className="w-32 ml-auto text-right"
                                value={recipeInputs[m.id] || ""}
                                onChange={(e) => setRecipeInputs({ ...recipeInputs, [m.id]: e.target.value })}
                                placeholder="0"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={saveRecipe} disabled={savingRecipe}>
                    {savingRecipe ? "Saving..." : "Save Recipe"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd "crm" && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors mentioning `khakhra-production`.

- [ ] **Step 3: Manual verification in browser**

With Tasks 1-3's migrations applied, open `http://localhost:3001/dashboard/khakhra-production` as an admin user:
1. Go to the Recipes tab, select "Spicy Masala Khakhra," enter a grams-per-kg value for at least Wheat Flour and Edible Oil, click Save Recipe. Reload the page and reselect the flavor — the values should still be there.
2. Go to Production Runs, select the same flavor, enter an output kg (e.g. 1). Confirm the consumption preview table shows the expected kg needed for each ingredient you set a recipe for.
3. Click Log Production Run. Confirm the toast succeeds and the run appears in the "Recent Runs" table.
4. Verify via Node script that the raw material's `loose_stock.quantity_kg` went negative (since the seed starts every tank at 0kg and no purchases have been logged yet) — this is expected at this stage; Task 5 wires up the purchase flow that would normally fund the tank first:

```bash
cd "crm" && node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase.from('loose_stock').select('category_id, quantity_kg, product_categories(name)');
  console.log(JSON.stringify(data, null, 2));
})();
"
```

- [ ] **Step 4: Do not commit.**

---

### Task 5: Relabel the raw-material purchase page to kg

**Files:**
- Modify: `crm/app/dashboard/purchases/loose/page.tsx`

**Interfaces:**
- Consumes: `loose_stock.quantity_kg`/`price_per_kg` (Task 1), the 8 raw-ingredient `product_categories` rows (Task 3).

- [ ] **Step 1: Update the category list and type**

Find (around line 44-57):
```tsx
type LooseStock = {
  id: string
  category_id: string
  category_name: string
  quantity_liters: number
  price_per_liter: number
}

const MAIN_STOCK_CATEGORIES = [
  "Buffalo Ghee",
  "Cow Ghee",
  "Valona Ghee",
  "Groundnut Oil"
]
```

Replace with:
```tsx
type LooseStock = {
  id: string
  category_id: string
  category_name: string
  quantity_kg: number
  price_per_kg: number
}

const MAIN_STOCK_CATEGORIES = [
  "Wheat Flour",
  "Edible Oil",
  "Salt",
  "Red Chilli Powder",
  "Carom Seeds",
  "Cumin Seeds",
  "Turmeric Powder",
  "Kasuri Methi",
]
```

- [ ] **Step 2: Rename remaining `quantity_liters`/`price_per_liter`/`quantityLiters`/`pricePerLiter` references**

Run this to find every remaining reference in the file:
```bash
cd "crm" && grep -n "quantity_liters\|price_per_liter\|quantityLiters\|pricePerLiter\|[Ll]iters\|[Ll]itre" app/dashboard/purchases/loose/page.tsx
```

For each hit: rename `quantity_liters`→`quantity_kg`, `price_per_liter`→`price_per_kg`, `quantityLiters`→`quantityKg`, `pricePerLiter`→`pricePerKg` (keep the same casing convention already used at that spot), and rename any user-facing label text ("Liters"/"Litre(s)") to "Kg". Apply each rename with the Edit tool using the exact surrounding line as context so the match is unambiguous.

- [ ] **Step 3: Type-check**

Run: `cd "crm" && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors mentioning `purchases/loose`.

- [ ] **Step 4: Manual verification**

With Tasks 1-3 applied, open `http://localhost:3001/dashboard/purchases/loose`. Confirm the category dropdown shows the 8 raw ingredients (not ghee types), and the form labels say "Kg"/"per Kg" rather than "Liters"/"per Liter". Submit a test purchase (e.g. 10kg Wheat Flour) and confirm it succeeds and `loose_stock.quantity_kg` for Wheat Flour increases by 10 (verify with a Node script against Supabase, same pattern as Task 3 Step 3).

- [ ] **Step 5: Do not commit.**

---

### Task 6: Relabel the Loose Stock dashboard page to kg

**Files:**
- Modify: `crm/app/dashboard/loose-stock/page.tsx`

**Interfaces:**
- Consumes: `loose_stock.quantity_kg`/`price_per_kg` (Task 1).

- [ ] **Step 1: Find every litres reference**

```bash
cd "crm" && grep -n "quantity_liters\|price_per_liter\|[Ll]iters\|[Ll]itre" app/dashboard/loose-stock/page.tsx
```

- [ ] **Step 2: Rename each hit**

Same rule as Task 5 Step 2: rename the DB field references (`quantity_liters`→`quantity_kg`, `price_per_liter`→`price_per_kg`) and every user-facing label ("Quantity (Liters)" → "Quantity (Kg)", "Price per Liter" → "Price per Kg", "New quantity (liters)" → "New quantity (kg)", any inline "…L" display suffix → "…kg"). Use the Edit tool per hit with surrounding context.

- [ ] **Step 3: Update the page title/description if present**

If the page header says something like "Loose Stock" with ghee-specific copy, update the description to reflect it now covers both raw ingredients and flavors (e.g. "Raw materials and flavor stock, in kg").

- [ ] **Step 4: Type-check**

Run: `cd "crm" && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors mentioning `loose-stock`.

- [ ] **Step 5: Manual verification**

Open `http://localhost:3001/dashboard/loose-stock`. Confirm it lists all 12 tanks (8 raw ingredients + 4 flavors) with kg-labeled columns, and that the Wheat Flour balance reflects the test purchase from Task 5 (and, if Task 4 was tested, the negative draw from the test production run).

- [ ] **Step 6: Do not commit.**

---

### Task 7: Relabel the packaging (transfer) page to kg

**Files:**
- Modify: `crm/app/dashboard/main-stock/transfer/page.tsx`

**Interfaces:**
- Consumes: `loose_stock.quantity_kg` (Task 1), `variant_material_mapping.kg_consumed_per_unit` (Task 1), the 4 flavor categories + 8 variants + BOM rows (Task 3).

- [ ] **Step 1: Update the hardcoded category list**

Find (around line 81-86):
```tsx
const MAIN_STOCK_CATEGORIES = [
  "Buffalo Ghee",
  "Cow Ghee",
  "Valona Ghee",
  "Groundnut Oil"
]
```

Replace with:
```tsx
const MAIN_STOCK_CATEGORIES = [
  "Classic Sada Khakhra",
  "Spicy Masala Khakhra",
  "Magic Methi Khakhra",
  "Zesty Jeera Khakhra",
]
```

- [ ] **Step 2: Find every remaining litres reference**

```bash
cd "crm" && grep -n "liters_consumed_per_unit\|totalLitersNeeded\|looseStockSufficient\|quantity_liters\|price_per_liter\|[Ll]iters\|[Ll]itre" app/dashboard/main-stock/transfer/page.tsx
```

- [ ] **Step 3: Rename each hit**

Rename `liters_consumed_per_unit`→`kg_consumed_per_unit`, `quantity_liters`→`quantity_kg`, `price_per_liter`→`price_per_kg`, `totalLitersNeeded`→`totalKgNeeded`, `looseStockSufficient` stays (unit-agnostic name already), and any user-facing "Liters"/"L" labels → "Kg"/"kg". Use the Edit tool per hit with surrounding context, same as Tasks 5-6.

- [ ] **Step 4: Leave `PACKAGING_CONFIG` (line ~125-141) as-is for now**

It's a display-only helper for carton/bag math keyed by substrings like "500ml"/"1l" — since it doesn't block functionality (it's not validated against, just used for an optional display calculation) and the correct khakhra carton ratios aren't yet known, leave it unmodified. Note this as a known cosmetic gap, not a blocker.

- [ ] **Step 5: Type-check**

Run: `cd "crm" && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors mentioning `main-stock/transfer`.

- [ ] **Step 6: Manual verification**

Open `http://localhost:3001/dashboard/main-stock/transfer`. Select "Spicy Masala Khakhra" as the category, and its "500g" variant. Confirm the page shows the content (loose khakhra) and pouch requirement in kg, not litres, and that the loose-stock balance shown matches what Task 4/6 produced. If a production run was logged for Spicy Masala in Task 4, run a test transfer of 1 pack and confirm: the flavor's `loose_stock.quantity_kg` decreases by 0.5kg, the "Spicy Masala 500g Pouch" `stock_inventory.quantity` decreases by 1 (or blocks the transfer with a clear error if pouch stock is 0 — that's correct behavior, not a bug, since no pouches have been purchased yet in this test flow).

- [ ] **Step 7: Do not commit.**

---

### Task 8: Relabel the Material Mapping (BOM editor) page to kg

**Files:**
- Modify: `crm/app/dashboard/stock/material-mapping/page.tsx`

**Interfaces:**
- Consumes: `variant_material_mapping.kg_consumed_per_unit` (Task 1).

- [ ] **Step 1: Find every litres reference**

```bash
cd "crm" && grep -n "liters_consumed_per_unit\|[Ll]iters\|[Ll]itre" app/dashboard/stock/material-mapping/page.tsx
```

- [ ] **Step 2: Rename each hit**

Rename `liters_consumed_per_unit`→`kg_consumed_per_unit` in every query/type/state reference, and every user-facing label ("Liters Consumed" column header → "Kg Consumed", the "Content vs Packaging" explainer alert that mentions "Ghee, oil" → update the example to "e.g. loose khakhra" instead of ghee/oil). Use the Edit tool per hit with surrounding context.

- [ ] **Step 3: Type-check**

Run: `cd "crm" && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors mentioning `material-mapping`.

- [ ] **Step 4: Manual verification**

Open `http://localhost:3001/dashboard/stock/material-mapping`. Confirm the 8 seeded variants show up grouped by flavor, each with its content (Loose khakhra, kg) and pouch material rows, column header says "Kg Consumed," and editing a row's value saves correctly (spot-check by editing one row's Kg Consumed value, saving, reloading the page, and confirming the new value persisted).

- [ ] **Step 5: Do not commit.**

---

### Task 9: Update sidebar menu labels and add the new page's entry

**Files:**
- Modify: `crm/lib/sidebar-menu.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: a working sidebar link to `/dashboard/khakhra-production` (Task 4).

- [ ] **Step 1: Find every litres-labeled menu item**

```bash
cd "crm" && grep -n "[Ll]iters\|[Ll]itre\|Loose Stock\|Loose Opening Stock\|Material Mapping" lib/sidebar-menu.ts
```

- [ ] **Step 2: Update labels**

For any menu item whose `title` contains "(Liters)" or similar, remove that suffix. Leave "Loose Stock," "Loose Opening Stock," and "Material Mapping" titles as-is (they're already unit-agnostic names) — only their icon/route are affected if at all.

- [ ] **Step 3: Add a menu entry for the new Khakhra Production page**

Find the existing entry for `/dashboard/loose-stock` (to place the new item near related manufacturing pages) — read enough surrounding lines to match its exact `roles` array — and add immediately after it:

```ts
{ title: "Khakhra Production", url: "/dashboard/khakhra-production", icon: Factory, roles: ["admin", "factories"] },
```

Check the top of `lib/sidebar-menu.ts` for the existing `lucide-react` import line; if `Factory` isn't already imported, add it to that import list (it's a valid `lucide-react` icon name, same import source as the other icons in that file).

- [ ] **Step 4: Type-check**

Run: `cd "crm" && node ./node_modules/typescript/bin/tsc --noEmit`
Expected: no errors mentioning `sidebar-menu`.

- [ ] **Step 5: Manual verification**

Log in as a `factories`-role user at `http://localhost:3001/dashboard`. Confirm "Khakhra Production" appears in the sidebar and navigates to the working page from Task 4.

- [ ] **Step 6: Do not commit.**

---

## Plan Self-Review

**Spec coverage:**
- Stage 0 (raw material purchasing, kg) → Task 5. ✓
- Stage 1 (production/recipes, new tables) → Tasks 2, 4. ✓
- Stage 2 (packaging, repurposed transfer flow) → Tasks 1, 3, 7, 8. ✓
- Sidebar labels → Task 9. ✓
- Explicitly-deferred pages (Factory Dashboard, Warehouse Stock, Stock Inventory, Low Stock) → untouched, called out in Global Constraints. ✓
- `product_weight_options` vs `product_variants` reconciliation → explicitly deferred per spec, not a task here. ✓

**Placeholder scan:** No "TBD"/"TODO" — the only intentionally-unfilled data is `khakhra_recipes` seed rows, which the spec explicitly calls for (real recipe data only the user has) and Task 4's UI exists specifically to let them fill in.

**Type consistency:** `quantity_kg`/`price_per_kg` (Task 1) used consistently in Tasks 3, 5, 6, 7. `kg_consumed_per_unit` (Task 1) used consistently in Tasks 3, 7, 8. Task 4's `Recipe`/`ProductionRun`/`Category` types match the exact column names from Tasks 1-3's migrations.
