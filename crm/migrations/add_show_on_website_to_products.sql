-- Lets each product opt in/out of the public website's product grid,
-- independent of is_active (which controls CRM/POS orderability).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_on_website boolean NOT NULL DEFAULT true;
