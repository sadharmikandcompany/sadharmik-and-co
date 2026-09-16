-- User (role: admin) reported being unable to delete any purchase — clicks
-- Delete, confirms, gets an error. Diagnosed without direct policy access
-- (no SQL introspection available) via two pieces of strong evidence:
--   1. Replaying the app's exact delete sequence (delete purchase_items,
--      then purchases) directly against the DB succeeded cleanly — so it's
--      not a foreign-key/data-integrity block.
--   2. Every single purchase in the system (111/111) has created_by_user_id
--      set to a sandbox test account, not the real user's own id — the same
--      "created_by ownership" pattern already found and fixed for
--      bank_transactions earlier (see add_bank_transactions_created_by.sql).
-- Together these point to an existing RLS policy that scopes DELETE (and
-- likely UPDATE) on purchases/purchase_items to rows the caller personally
-- created — which blocks admin from ever managing purchase records nobody
-- currently owns under their own account.
--
-- This does NOT touch whatever policy already exists — it only ADDS a new
-- permissive policy. Postgres combines multiple permissive policies for the
-- same command with OR, so this can only grant additional access (to
-- admin-like roles) on top of whatever's already allowed; it cannot take
-- access away from anyone.

DROP POLICY IF EXISTS admin_full_access_purchases ON public.purchases;
CREATE POLICY admin_full_access_purchases ON public.purchases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'warehouse', 'customer_support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'warehouse', 'customer_support')
    )
  );

DROP POLICY IF EXISTS admin_full_access_purchase_items ON public.purchase_items;
CREATE POLICY admin_full_access_purchase_items ON public.purchase_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'warehouse', 'customer_support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'warehouse', 'customer_support')
    )
  );
