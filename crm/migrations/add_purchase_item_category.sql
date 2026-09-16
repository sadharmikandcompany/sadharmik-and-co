-- Lets a single purchase/invoice mix categories across its line items — e.g.
-- a Tally voucher with a "RO Material Purchase" line (Direct Expense) and a
-- "Transportation" line (Indirect Expense) in the SAME voucher. Previously
-- purchase_category only existed on the purchases row (see
-- add_purchase_category.sql / add_purchase_category_fixed_asset_other.sql),
-- forcing one category for the whole invoice.
--
-- NULL means "inherit the parent purchase's purchase_category" — most
-- purchases are single-category, so this stays unset for them; it's only
-- populated when a line item is deliberately overridden to a different
-- category than the rest of the purchase.

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS purchase_category text;

ALTER TABLE public.purchase_items DROP CONSTRAINT IF EXISTS purchase_items_purchase_category_check;
ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_purchase_category_check
  CHECK (purchase_category IS NULL OR purchase_category = ANY (ARRAY[
    'material'::text,
    'direct_expense'::text,
    'indirect_expense'::text,
    'fixed_asset'::text,
    'other'::text
  ]));

COMMENT ON COLUMN public.purchase_items.purchase_category IS
  'Per-line override of the parent purchase''s purchase_category, for invoices that mix categories across line items (e.g. a material line and a transportation-expense line on the same voucher). NULL = inherit the parent purchases.purchase_category.';
