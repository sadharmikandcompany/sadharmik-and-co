-- Stage 1 (Production): converting raw ingredients into loose finished
-- khakhra per a fixed recipe. Ghee has no equivalent step (it's bought
-- already-finished), so there's nothing to repurpose for this stage.
-- Run AFTER khakhra_rename_litres_to_kg.sql.
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
