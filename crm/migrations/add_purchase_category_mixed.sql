-- Adds a "mixed" purchase_category value: for an invoice with no single
-- sensible default category (e.g. a voucher with a Direct Expense line AND
-- an Indirect Expense line, per add_purchase_item_category.sql), forcing the
-- user to pick an arbitrary "primary" category at the purchase level was
-- misleading — worse, it silently broke reporting, since the P&L/Expenses
-- page only look at line-item overrides when the purchase's OWN category
-- isn't "material" and, in the Expenses page, only when it's in the
-- direct_expense/indirect_expense/other allow-list.
--
-- "mixed" means: every line item on this purchase MUST have its own explicit
-- purchase_category (enforced client-side on save) — there is no
-- purchase-level default to fall back to.

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_purchase_category_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_purchase_category_check
  CHECK (purchase_category = ANY (ARRAY[
    'material'::text,
    'direct_expense'::text,
    'indirect_expense'::text,
    'fixed_asset'::text,
    'other'::text,
    'mixed'::text
  ]));

COMMENT ON COLUMN public.purchases.purchase_category IS
  'material = raw material/stock purchase (counts toward Total Purchase/COGS in P&L). direct_expense/indirect_expense = non-material GST purchase shown as an expense in P&L instead of Total Purchase. fixed_asset = capitalized asset, excluded from P&L entirely. other = non-material purchase that does not clearly fit direct/indirect expense, booked as an indirect expense. mixed = no single category applies to the whole invoice — every purchase_items row on it must carry its own purchase_category override instead.';
