-- A single purchase invoice can bundle items from two different manufacturing
-- batches (e.g. two batches of ghee on one vendor bill). The purchases table
-- already has one purchase-level batch_number, which can't represent that —
-- so batch tracking needs to move to the line-item level.
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS batch_number text;
