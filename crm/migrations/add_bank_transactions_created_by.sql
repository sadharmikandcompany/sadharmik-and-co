-- bank_transactions has no owner/entity column, so non-admin-like roles
-- (Factories, Distributors, Retailers, Vendors, Delivery Drivers — anyone
-- who can reach /dashboard/accounting/reconciliation but isn't admin /
-- warehouse / customer_support) were shown an empty Transactions list
-- unconditionally, even for entries they themselves just created via
-- "Create Transaction". This lets the app scope the list to "admin-like
-- roles see everything, everyone else sees only rows they created" instead
-- of hiding the whole shared ledger from them.
--
-- The app is defensive about this column not existing yet (falls back to
-- the old admin-only-see-anything behavior on a PGRST204 "column not found"
-- error, same pattern used for shipping_charges/purchase_category), so
-- nothing breaks before this migration is run — new transactions just won't
-- be attributed to their creator, and non-admin roles won't see their own
-- entries, until it is.

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_created_by
  ON public.bank_transactions (created_by);
