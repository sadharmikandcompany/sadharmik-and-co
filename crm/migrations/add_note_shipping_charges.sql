-- Adds a Shipping Charges field to debit notes and credit notes, mirroring
-- purchases.shipping_charges (an amount added on top of the item total,
-- not itself taxed/discounted like a line item — e.g. courier/freight
-- charged separately on the original bill/invoice being adjusted).
--
-- The app is defensive about this column not existing yet (it retries the
-- save without shipping_charges on a PGRST204 "column not found" error, the
-- same pattern used for purchase_category), so nothing breaks before this
-- migration is run — but the field won't actually persist until it is.

ALTER TABLE public.debit_notes
  ADD COLUMN IF NOT EXISTS shipping_charges numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS shipping_charges numeric(12, 2) NOT NULL DEFAULT 0;
