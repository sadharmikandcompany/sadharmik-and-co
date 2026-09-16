-- Purchases had no column to store a manual rounding adjustment; "Other Tax"
-- and "Other Charges" are being removed from the purchase form in favor of a
-- single editable Round Off amount (can be positive or negative, unlike
-- other_charges/tax_amount which are constrained to >= 0).
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS round_off numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.purchases.round_off IS
  'Manual rounding adjustment applied to total_amount; positive or negative.';
