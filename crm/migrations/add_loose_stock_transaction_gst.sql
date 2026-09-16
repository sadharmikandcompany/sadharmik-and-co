-- Loose (litre-based) purchases had no way to record GST at all, so they
-- never contributed to Input Tax Credit even when the vendor genuinely
-- charges GST (e.g. 5% on ghee). Mirrors the GST columns already on
-- purchase_items.
ALTER TABLE public.loose_stock_transactions
  ADD COLUMN IF NOT EXISTS gst_percentage numeric,
  ADD COLUMN IF NOT EXISTS gst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_itc_eligible boolean NOT NULL DEFAULT true;
