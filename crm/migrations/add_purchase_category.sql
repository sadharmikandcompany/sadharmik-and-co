-- Classifies a purchase as a material (stock) purchase vs a non-material
-- purchase that should be treated as a direct/indirect expense in P&L —
-- matching how Tally shows a GST bill in Total Purchase but bifurcates it
-- into Purchase/Expense on the P&L statement.
--
-- Replaces the old "Create Expense Record" behavior on the purchase form,
-- which mirrored the purchase into a SEPARATE expenses row — double-counting
-- the amount (once in Total Purchase, again as an expense). Purchases are
-- now classified in place instead; no second record is created.

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS purchase_category text NOT NULL DEFAULT 'material';

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_purchase_category_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_purchase_category_check
  CHECK (purchase_category = ANY (ARRAY['material'::text, 'direct_expense'::text, 'indirect_expense'::text]));

COMMENT ON COLUMN public.purchases.purchase_category IS
  'material = raw material/stock purchase (counts toward Total Purchase/COGS in P&L). direct_expense/indirect_expense = non-material GST purchase (e.g. office supplies, services) that should be excluded from Total Purchase and shown as an expense in P&L instead.';
