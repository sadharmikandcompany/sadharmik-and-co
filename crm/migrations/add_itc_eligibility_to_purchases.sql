-- Input Tax Credit (ITC) eligibility flags for GST payable calculation.
-- Milk purchases are GST-exempt (0%) and must never generate ITC; packaging,
-- transport, and other taxed inputs are ITC-eligible by default.

-- Per-item flag: does this specific line item's GST count toward ITC?
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS is_itc_eligible boolean NOT NULL DEFAULT true;

-- Per-purchase override: mark a whole purchase (e.g. a pure milk purchase) as
-- exempt in one click instead of toggling every line item individually.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS is_itc_eligible boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_purchase_items_itc_eligible
  ON public.purchase_items (is_itc_eligible);
