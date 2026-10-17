-- Credit notes linked to a real bill (via the bill-search picker on
-- Create Credit Note) already reduce that order's total_amount directly.
-- Without a way to tell which notes did this, every balance/spend
-- aggregate that subtracts credit_notes.total_amount from a party's total
-- double-counts those notes: once through the order's already-reduced
-- total, again through the separate subtraction. linked_order_id lets
-- those aggregates skip notes that are already baked into an order total.

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS linked_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.credit_notes.linked_order_id IS
  'Set when this credit note was linked to a bill and already reduced that order''s total_amount directly. Balance/spend aggregates must exclude it from their separate credit-note subtraction to avoid double-counting.';
