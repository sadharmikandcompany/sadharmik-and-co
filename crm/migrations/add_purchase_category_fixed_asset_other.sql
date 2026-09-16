-- Adds two more purchase_category values on top of the original
-- material / direct_expense / indirect_expense set (see add_purchase_category.sql):
--
--   fixed_asset — machinery, vehicles, equipment, etc. Capitalized on the
--     Balance Sheet, NOT expensed — deliberately excluded from every P&L
--     bucket (it isn't material/COGS and isn't a direct/indirect expense).
--   other       — catch-all for a non-material purchase that doesn't clearly
--     fit direct or indirect expense. Treated as an indirect expense in P&L
--     so the amount is still accounted for somewhere, not silently dropped.

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_purchase_category_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_purchase_category_check
  CHECK (purchase_category = ANY (ARRAY[
    'material'::text,
    'direct_expense'::text,
    'indirect_expense'::text,
    'fixed_asset'::text,
    'other'::text
  ]));

COMMENT ON COLUMN public.purchases.purchase_category IS
  'material = raw material/stock purchase (counts toward Total Purchase/COGS in P&L). direct_expense/indirect_expense = non-material GST purchase (e.g. office supplies, services) shown as an expense in P&L instead of Total Purchase. fixed_asset = capitalized asset (machinery/vehicles/equipment), excluded from P&L entirely. other = non-material purchase that does not clearly fit direct/indirect expense, booked as an indirect expense so it is still accounted for.';
